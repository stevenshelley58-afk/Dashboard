/** Shopify ETL processor */
import { Pool } from 'pg';
import { logger } from '../utils/logger.js';

const log = logger('shopify-etl');

export class ShopifyETL {
  constructor(private pool: Pool) {}

  async runHistorical(shopId: string, client: any): Promise<number> {
    log.info(`Running historical sync for shop ${shopId}`);
    
    // TODO: Implement Shopify GraphQL Bulk Operations API
    // 1. Create bulk operation
    // 2. Poll for completion
    // 3. Download JSONL
    // 4. Load into staging_ingest
    // 5. Run transforms
    
    // For now, return 0
    return 0;
  }

  async runIncremental(shopId: string, client: any): Promise<number> {
    log.info(`Running incremental sync for shop ${shopId}`);
    
    // TODO: Implement incremental sync
    // 1. Get last cursor from sync_cursors
    // 2. Query Shopify API since cursor
    // 3. Load into staging_ingest
    // 4. Run transforms
    
    return 0;
  }
}

