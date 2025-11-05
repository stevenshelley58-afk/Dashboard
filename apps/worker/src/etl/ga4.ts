/** Google Analytics 4 ETL processor - Full implementation */
import { Pool } from 'pg';
import type { PoolClient as Client } from 'pg';
import { logger } from '../utils/logger.js';
import { GA4Client, GA4ReportData } from '../clients/ga4-client.js';

const log = logger('ga4-etl');

export class GA4ETL {
  private client: GA4Client | null = null;

  constructor(private pool: Pool) {}

  /**
   * Initialize GA4 client from environment variables
   */
  private getClient(): GA4Client {
    if (this.client) {
      return this.client;
    }

    const credentialsJson = process.env.GA4_CREDENTIALS_JSON;
    const propertyId = process.env.GA4_PROPERTY_ID;

    if (!credentialsJson) {
      throw new Error('GA4_PERMISSION_DENIED: GA4_CREDENTIALS_JSON environment variable is required');
    }

    if (!propertyId) {
      throw new Error('GA4_PERMISSION_DENIED: GA4_PROPERTY_ID environment variable is required');
    }

    this.client = new GA4Client(credentialsJson, propertyId);
    return this.client;
  }

  /**
   * Run historical backfill - fetches all data from a start date
   */
  async runHistorical(shopId: string, dbClient: Client): Promise<number> {
    log.info(`Running historical GA4 sync for shop ${shopId}`);

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

      log.info(`Fetching historical GA4 data from ${startDate} to ${endDate}`);

      // Fetch report from GA4 API
      const reportData = await client.getDailyReport(startDate, endDate);

      if (reportData.length === 0) {
        log.warn('No GA4 report data found for date range');
        return 0;
      }

      // Load into staging
      const recordsLoaded = await this.loadToStaging(shopId, reportData, dbClient);

      // Run transforms
      await this.runTransforms(shopId, currency, timezone, dbClient);

      log.info(`Historical GA4 sync completed: ${recordsLoaded} records`);
      return recordsLoaded;
    } catch (error) {
      log.error('Historical GA4 sync failed:', error);
      throw error;
    }
  }

  /**
   * Run incremental sync - fetches data since last successful sync
   */
  async runIncremental(shopId: string, dbClient: Client): Promise<number> {
    log.info(`Running incremental GA4 sync for shop ${shopId}`);

    try {
      const client = this.getClient();

      // Get last cursor from sync_cursors
      const cursorResult = await dbClient.query(
        `SELECT cursor_value, last_success_at 
         FROM core_warehouse.sync_cursors 
         WHERE shop_id = $1 AND platform = $2`,
        [shopId, 'GA4']
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

      log.info(`Fetching incremental GA4 data from ${startDate} to ${endDate}`);

      // Fetch report from GA4 API
      const reportData = await client.getDailyReport(startDate, endDate);

      if (reportData.length === 0) {
        log.info('No new GA4 report data found');
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
      const recordsLoaded = await this.loadToStaging(shopId, reportData, dbClient);

      // Run transforms
      await this.runTransforms(shopId, currency, timezone, dbClient);

      log.info(`Incremental GA4 sync completed: ${recordsLoaded} records`);
      return recordsLoaded;
    } catch (error) {
      log.error('Incremental GA4 sync failed:', error);
      throw error;
    }
  }

  /**
   * Load report data into staging_ingest table
   */
  private async loadToStaging(
    shopId: string,
    reportData: GA4ReportData[],
    dbClient: Client
  ): Promise<number> {
    log.info(`Loading ${reportData.length} GA4 report rows into staging`);

    for (const row of reportData) {
      await dbClient.query(
        `INSERT INTO staging_ingest.ga4_report_raw (shop_id, raw_data, ingested_at)
         VALUES ($1, $2, now())`,
        [
          shopId,
          JSON.stringify({
            date: row.date,
            sessions: row.sessions,
            users: row.users,
            pageviews: row.pageviews,
            conversions: row.conversions,
            revenue: row.revenue,
            currency: row.currency,
          }),
        ]
      );
    }

    return reportData.length;
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
    log.info('Running GA4 transforms');

    // Transform staging data to core_warehouse.fact_ga4_daily
    await dbClient.query(
      `INSERT INTO core_warehouse.fact_ga4_daily (
        shop_id, date, sessions, users, pageviews, conversions, revenue, currency
      )
      SELECT 
        shop_id,
        (raw_data->>'date')::date as date,
        (raw_data->>'sessions')::integer as sessions,
        (raw_data->>'users')::integer as users,
        (raw_data->>'pageviews')::integer as pageviews,
        (raw_data->>'conversions')::numeric as conversions,
        (raw_data->>'revenue')::numeric as revenue,
        COALESCE((raw_data->>'currency')::text, $1) as currency
      FROM staging_ingest.ga4_report_raw
      WHERE shop_id = $2
      ON CONFLICT (shop_id, date) 
      DO UPDATE SET
        sessions = EXCLUDED.sessions,
        users = EXCLUDED.users,
        pageviews = EXCLUDED.pageviews,
        conversions = EXCLUDED.conversions,
        revenue = EXCLUDED.revenue,
        currency = EXCLUDED.currency,
        updated_at = now()`,
      [currency, shopId]
    );

    log.info('GA4 transforms completed');
  }
}
