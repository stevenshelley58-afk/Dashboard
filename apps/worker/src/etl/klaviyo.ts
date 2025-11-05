/** Klaviyo ETL processor - Full implementation */
import { Pool } from 'pg';
import type { PoolClient as Client } from 'pg';
import { logger } from '../utils/logger.js';
import { KlaviyoClient, KlaviyoMetricsData } from '../clients/klaviyo-client.js';

const log = logger('klaviyo-etl');

export class KlaviyoETL {
  private client: KlaviyoClient | null = null;

  constructor(private pool: Pool) {}

  /**
   * Initialize Klaviyo client from environment variables
   */
  private getClient(): KlaviyoClient {
    if (this.client) {
      return this.client;
    }

    const apiKey = process.env.KLAVIYO_API_KEY;

    if (!apiKey) {
      throw new Error('KLAVIYO_AUTH_ERROR: KLAVIYO_API_KEY environment variable is required');
    }

    this.client = new KlaviyoClient(apiKey);
    return this.client;
  }

  /**
   * Run historical backfill - fetches all data from a start date
   */
  async runHistorical(shopId: string, dbClient: Client): Promise<number> {
    log.info(`Running historical Klaviyo sync for shop ${shopId}`);

    try {
      const client = this.getClient();

      // Get shop's timezone and currency
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

      // For historical, fetch last 2 years of data
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 2 years ago

      log.info(`Fetching historical Klaviyo data from ${startDate} to ${endDate}`);

      // Fetch metrics from Klaviyo API
      const metricsData = await client.getMetrics(startDate, endDate);

      if (metricsData.length === 0) {
        log.warn('No Klaviyo metrics found for date range');
        return 0;
      }

      // Load into staging
      const recordsLoaded = await this.loadToStaging(shopId, metricsData, dbClient);

      // Run transforms
      await this.runTransforms(shopId, currency, timezone, dbClient);

      log.info(`Historical Klaviyo sync completed: ${recordsLoaded} records`);
      return recordsLoaded;
    } catch (error) {
      log.error('Historical Klaviyo sync failed:', error);
      throw error;
    }
  }

  /**
   * Run incremental sync - fetches data since last successful sync
   */
  async runIncremental(shopId: string, dbClient: Client): Promise<number> {
    log.info(`Running incremental Klaviyo sync for shop ${shopId}`);

    try {
      const client = this.getClient();

      // Get last cursor from sync_cursors
      const cursorResult = await dbClient.query(
        `SELECT cursor_value, last_success_at 
         FROM core_warehouse.sync_cursors 
         WHERE shop_id = $1 AND platform = $2`,
        [shopId, 'KLAVIYO']
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

      log.info(`Fetching incremental Klaviyo data from ${startDate} to ${endDate}`);

      // Fetch metrics from Klaviyo API
      const metricsData = await client.getMetrics(startDate, endDate);

      if (metricsData.length === 0) {
        log.info('No new Klaviyo metrics found');
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
      const recordsLoaded = await this.loadToStaging(shopId, metricsData, dbClient);

      // Run transforms
      await this.runTransforms(shopId, currency, timezone, dbClient);

      log.info(`Incremental Klaviyo sync completed: ${recordsLoaded} records`);
      return recordsLoaded;
    } catch (error) {
      log.error('Incremental Klaviyo sync failed:', error);
      throw error;
    }
  }

  /**
   * Load metrics data into staging_ingest table
   */
  private async loadToStaging(
    shopId: string,
    metricsData: KlaviyoMetricsData[],
    dbClient: Client
  ): Promise<number> {
    log.info(`Loading ${metricsData.length} Klaviyo metrics into staging`);

    for (const metric of metricsData) {
      await dbClient.query(
        `INSERT INTO staging_ingest.klaviyo_metrics_raw (shop_id, raw_data, ingested_at)
         VALUES ($1, $2, now())`,
        [
          shopId,
          JSON.stringify({
            date: metric.date,
            emails_sent: metric.emails_sent,
            emails_delivered: metric.emails_delivered,
            opens: metric.opens,
            clicks: metric.clicks,
            unsubscribes: metric.unsubscribes,
            revenue: metric.revenue,
            currency: metric.currency,
          }),
        ]
      );
    }

    return metricsData.length;
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
    log.info('Running Klaviyo transforms');

    // Transform staging data to core_warehouse.fact_email_daily
    await dbClient.query(
      `INSERT INTO core_warehouse.fact_email_daily (
        shop_id, date, emails_sent, emails_delivered, opens, clicks, unsubscribes, revenue, currency
      )
      SELECT 
        shop_id,
        (raw_data->>'date')::date as date,
        (raw_data->>'emails_sent')::integer as emails_sent,
        (raw_data->>'emails_delivered')::integer as emails_delivered,
        (raw_data->>'opens')::integer as opens,
        (raw_data->>'clicks')::integer as clicks,
        (raw_data->>'unsubscribes')::integer as unsubscribes,
        (raw_data->>'revenue')::numeric as revenue,
        COALESCE((raw_data->>'currency')::text, $1) as currency
      FROM staging_ingest.klaviyo_metrics_raw
      WHERE shop_id = $2
      ON CONFLICT (shop_id, date) 
      DO UPDATE SET
        emails_sent = EXCLUDED.emails_sent,
        emails_delivered = EXCLUDED.emails_delivered,
        opens = EXCLUDED.opens,
        clicks = EXCLUDED.clicks,
        unsubscribes = EXCLUDED.unsubscribes,
        revenue = EXCLUDED.revenue,
        currency = EXCLUDED.currency,
        updated_at = now()`,
      [currency, shopId]
    );

    log.info('Klaviyo transforms completed');
  }
}
