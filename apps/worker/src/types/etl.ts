/** Type definitions for ETL operations */
import type { PoolClient } from 'pg';
import { RunStatus, JobType, Platform, ErrorPayload } from '@dashboard/config';

export interface ETLRunRecord {
  id: string;
  shop_id: string;
  status: RunStatus;
  job_type: JobType;
  platform: Platform;
  error: ErrorPayload | null;
  records_synced: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface SyncCursor {
  shop_id: string;
  platform: Platform;
  cursor_value: string;
  last_success_at: string;
  updated_at: string;
}

export interface ShopConfig {
  shop_id: string;
  shop_domain: string | null;
  shop_name: string | null;
  currency: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export interface ETLProcessor {
  runHistorical(shopId: string, client: PoolClient): Promise<number>;
  runIncremental(shopId: string, client: PoolClient): Promise<number>;
}

