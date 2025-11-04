/** Meta (Facebook Ads) ETL processor - Full implementation */
import { Pool } from 'pg';
import type { PoolClient as Client } from 'pg';
import { logger } from '../utils/logger.js';
import { MetaClient, MetaInsightsData } from '../clients/meta-client.js';
import { JobType } from '@dashboard/config';

const log = logger('meta-etl');

export class MetaETL {
  private client: MetaClient | null = null;

  constructor(private pool: Pool) {}

  /**
   * Initialize Meta client from environment variables
   */
  private getClient(shopId: string): MetaClient {
    if (this.client) {
      return this.client;
    }

    const accessToken = process.env.META_ACCESS_TOKEN;
    const adAccountId = process.env.META_AD_ACCOUNT_ID;

    if (!accessToken) {
      throw new Error('META_AUTH_ERROR: META_ACCESS_TOKEN environment variable is required');
    }

    if (!adAccountId) {
      throw new Error('META_AUTH_ERROR: META_AD_ACCOUNT_ID environment variable is required');
    }

    this.client = new MetaClient(accessToken, adAccountId);
    return this.client;
  }

  /**
   * Run historical backfill - fetches all data from a start date
   */
  async runHistorical(shopId: string, dbClient: Client): Promise<number> {
    log.info(`Running historical Meta sync for shop ${shopId}`);

    try {
      const client = this.getClient(shopId);

      // Get shop's timezone and currency from core_warehouse.shops
      const shopResult = await dbClient.query(
        `SELECT timezone, currency FROM core_warehouse.shops WHERE shop_id = $1`,
        [shopId]
      );

      if (shopResult.rows.length === 0) {
        throw new Error(`Shop ${shopId} not found in core_warehouse.shops`);
      }

      const shop = shopResult.rows[0];
      const timezone = shop.timezone || 'UTC';
      const currency = shop.currency || 'USD';

      // For historical, fetch last 2 years of data (or adjust as needed)
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 2 years ago

      log.info(`Fetching historical Meta data from ${startDate} to ${endDate}`);

      // Fetch insights from Meta API
      const insights = await client.getInsights(startDate, endDate);

      if (insights.length === 0) {
        log.warn('No Meta insights found for date range');
        return 0;
      }

      // Load into staging
      const recordsLoaded = await this.loadToStaging(shopId, insights, dbClient);

      // Run transforms
      await this.runTransforms(shopId, currency, timezone, dbClient);

      log.info(`Historical Meta sync completed: ${recordsLoaded} records`);
      return recordsLoaded;
    } catch (error) {
      log.error('Historical Meta sync failed:', error);
      throw error;
    }
  }

  /**
   * Run incremental sync - fetches data since last successful sync
   */
  async runIncremental(shopId: string, dbClient: Client): Promise<number> {
    log.info(`Running incremental Meta sync for shop ${shopId}`);

    try {
      const client = this.getClient(shopId);

      // Get last cursor from sync_cursors
      const cursorResult = await dbClient.query(
        `SELECT cursor_value, last_success_at 
         FROM core_warehouse.sync_cursors 
         WHERE shop_id = $1 AND platform = $2`,
        [shopId, 'META']
      );

      let startDate: string;
      if (cursorResult.rows.length > 0 && cursorResult.rows[0].cursor_value) {
        // Use last success date + 1 day to avoid duplicates
        const lastDate = new Date(cursorResult.rows[0].cursor_value);
        lastDate.setDate(lastDate.getDate() + 1);
        startDate = lastDate.toISOString().split('T')[0];
      } else {
        // If no cursor, default to last 30 days
        const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        startDate = defaultStart.toISOString().split('T')[0];
      }

      const endDate = new Date().toISOString().split('T')[0];

      log.info(`Fetching incremental Meta data from ${startDate} to ${endDate}`);

      // Fetch insights from Meta API
      const insights = await client.getInsights(startDate, endDate);

      if (insights.length === 0) {
        log.info('No new Meta insights found');
        return 0;
      }

      // Get shop's currency and timezone
      const shopResult = await dbClient.query(
        `SELECT timezone, currency FROM core_warehouse.shops WHERE shop_id = $1`,
        [shopId]
      );

      if (shopResult.rows.length === 0) {
        throw new Error(`Shop ${shopId} not found in core_warehouse.shops`);
      }

      const shop = shopResult.rows[0];
      const timezone = shop.timezone || 'UTC';
      const currency = shop.currency || 'USD';

      // Load into staging
      const recordsLoaded = await this.loadToStaging(shopId, insights, dbClient);

      // Run transforms
      await this.runTransforms(shopId, currency, timezone, dbClient);

      log.info(`Incremental Meta sync completed: ${recordsLoaded} records`);
      return recordsLoaded;
    } catch (error) {
      log.error('Incremental Meta sync failed:', error);
      throw error;
    }
  }

  /**
   * Load insights data into staging_ingest table
   */
  private async loadToStaging(
    shopId: string,
    insights: MetaInsightsData[],
    dbClient: Client
  ): Promise<number> {
    log.info(`Loading ${insights.length} Meta insights into staging`);

    for (const insight of insights) {
      await dbClient.query(
        `INSERT INTO staging_ingest.meta_insights_raw (shop_id, raw_data, ingested_at)
         VALUES ($1, $2, now())`,
        [
          shopId,
          JSON.stringify({
            date: insight.date,
            spend: insight.spend,
            impressions: insight.impressions,
            clicks: insight.clicks,
            conversions: insight.conversions,
            revenue: insight.revenue,
            currency: insight.currency,
          }),
        ]
      );
    }

    return insights.length;
  }

  /**
   * Run SQL transforms to move data from staging to core_warehouse
   */
  private async runTransforms(
    shopId: string,
    currency: string,
    timezone: string,
    dbClient: Client
  ): Promise<void> {
    log.info('Running Meta transforms');

    // Transform staging data to core_warehouse.fact_marketing_daily
    await dbClient.query(
      `INSERT INTO core_warehouse.fact_marketing_daily (
        shop_id, date, platform, spend, impressions, clicks, conversions, revenue, currency
      )
      SELECT 
        shop_id,
        (raw_data->>'date')::date as date,
        'META' as platform,
        (raw_data->>'spend')::numeric as spend,
        (raw_data->>'impressions')::integer as impressions,
        (raw_data->>'clicks')::integer as clicks,
        (raw_data->>'conversions')::integer as conversions,
        (raw_data->>'revenue')::numeric as revenue,
        COALESCE((raw_data->>'currency')::text, $1) as currency
      FROM staging_ingest.meta_insights_raw
      WHERE shop_id = $2
      ON CONFLICT (shop_id, date, platform) 
      DO UPDATE SET
        spend = EXCLUDED.spend,
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        conversions = EXCLUDED.conversions,
        revenue = EXCLUDED.revenue,
        currency = EXCLUDED.currency,
        updated_at = now()`,
      [currency, shopId]
    );

    log.info('Meta transforms completed');
  }
}
