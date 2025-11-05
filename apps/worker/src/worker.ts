/** Main worker class - polls and processes ETL jobs */
import { Pool, PoolConfig } from 'pg';
import { RunStatus, JobType, Platform, ErrorPayload } from '@dashboard/config';
import { logger } from './utils/logger.js';
import { ShopifyETL } from './etl/shopify.js';
import { MetaETL } from './etl/meta.js';
import { GA4ETL } from './etl/ga4.js';
import { KlaviyoETL } from './etl/klaviyo.js';

const log = logger('worker');

const poolerHostSuffix = '.pooler.supabase.com';
const poolerPort = '6543';
const expectedPoolerUser = 'postgres.gywjhlqmqucjkneucjbp';

const poolDefaults = {
  max: 1,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 5000,
  sslRejectUnauthorized: false,
};

interface PoolerConnectionDetails {
  host: string;
  port: string;
  user: string;
  sanitizedUrl: string;
}

import type { ETLRunRecord } from './types/etl.js';

function sanitizeConnectionUrl(url: URL): string {
  const portSegment = url.port ? `:${url.port}` : '';
  const userSegment = url.username
    ? `${url.username}${url.password ? ':***' : ''}@`
    : '';

  return `${url.protocol}//${userSegment}${url.hostname}${portSegment}${url.pathname}${url.search}${url.hash}`;
}

function assertPoolerConnection(connStr: string): PoolerConnectionDetails {
  const parsed = new URL(connStr);

  if (!parsed.hostname.endsWith(poolerHostSuffix)) {
    throw new Error(
      `SUPABASE_DB_URL must end with ${poolerHostSuffix}. Current host: ${parsed.hostname}`
    );
  }

  if (parsed.port !== poolerPort) {
    throw new Error(
      `SUPABASE_DB_URL must use port ${poolerPort}. Current port: ${parsed.port || 'undefined'}`
    );
  }

  if (parsed.username !== expectedPoolerUser) {
    throw new Error(
      `SUPABASE_DB_URL username must match ${expectedPoolerUser}. Current username: ${parsed.username || 'undefined'}`
    );
  }

  return {
    host: parsed.hostname,
    port: parsed.port,
    user: parsed.username,
    sanitizedUrl: sanitizeConnectionUrl(parsed),
  };
}

/**
 * Create a PostgreSQL pool tuned for the Supabase transaction pooler.
 */
function createPool(connStr: string, host: string): Pool {
  // DIAGNOSTIC: Log PG* env vars injected by Railway (before cleanup)
  console.info('[pg-env-before-cleanup]', {
    PGHOST: process.env.PGHOST,
    PGPORT: process.env.PGPORT,
    PGUSER: process.env.PGUSER,
    PGPASSWORD: process.env.PGPASSWORD ? '***REDACTED***' : undefined,
    PGDATABASE: process.env.PGDATABASE,
    DATABASE_URL: process.env.DATABASE_URL ? '***EXISTS***' : undefined,
  });

  // Parse and log the Supabase URL we want to use
  const url = new URL(connStr);
  console.info('[supabase-url]', {
    host: url.hostname,
    port: url.port,
    user: url.username,
  });

  // CRITICAL FIX: Delete Railway-injected PG* vars
  // node-postgres reads these and they override connectionString
  // Since we're using external Supabase, not Railway Postgres, we must remove these
  delete process.env.PGHOST;
  delete process.env.PGPORT;
  delete process.env.PGUSER;
  delete process.env.PGPASSWORD;
  delete process.env.PGDATABASE;
  delete process.env.DATABASE_URL;

  console.info('[pg-env-after-cleanup]', 'All PG* environment variables deleted');

  const poolConfig: PoolConfig = {
    connectionString: connStr,
    ssl: {
      rejectUnauthorized: poolDefaults.sslRejectUnauthorized,
      servername: host,
    },
    max: poolDefaults.max,
    connectionTimeoutMillis: poolDefaults.connectionTimeoutMillis,
    idleTimeoutMillis: poolDefaults.idleTimeoutMillis,
  };

  // Log the clean Pool config (without password)
  console.info('[pool-config]', {
    hasConnectionString: !!poolConfig.connectionString,
    ssl: poolConfig.ssl,
    max: poolConfig.max,
    timeouts: {
      connection: poolConfig.connectionTimeoutMillis,
      idle: poolConfig.idleTimeoutMillis,
    },
  });

  return new Pool(poolConfig);
}

export class Worker {
  private pool: Pool | null = null;
  private running: boolean = false;
  private pollInterval: number = 5000; // 5 seconds
  private connectionDetails: PoolerConnectionDetails;

  constructor() {
    const dbUrl = process.env.SUPABASE_DB_URL;
    if (!dbUrl) {
      throw new Error('SUPABASE_DB_URL environment variable is required');
    }

    this.connectionDetails = assertPoolerConnection(dbUrl);

    log.info('Worker initialized', {
      connection: {
        host: this.connectionDetails.host,
        port: Number(this.connectionDetails.port),
        user: this.connectionDetails.user,
        sslRejectUnauthorized: poolDefaults.sslRejectUnauthorized,
        connectionTimeoutMillis: poolDefaults.connectionTimeoutMillis,
        idleTimeoutMillis: poolDefaults.idleTimeoutMillis,
      },
    });
    log.info('SUPABASE_DB_URL (redacted)', this.connectionDetails.sanitizedUrl);
  }

  /**
   * Initialize database connection using Supabase transaction pooler
   */
  async initializeConnection(): Promise<void> {
    const dbUrl = process.env.SUPABASE_DB_URL;
    if (!dbUrl) {
      throw new Error('SUPABASE_DB_URL environment variable is required');
    }

    // Re-assert details in case the environment changed between constructor and runtime
    this.connectionDetails = assertPoolerConnection(dbUrl);

    try {
      // Close existing pool if it exists
      if (this.pool) {
        await this.pool.end().catch(() => {});
      }

      // Create pool with standard configuration
      this.pool = createPool(dbUrl, this.connectionDetails.host);

      log.info('Supabase pooler configuration', {
        host: this.connectionDetails.host,
        port: Number(this.connectionDetails.port),
        user: this.connectionDetails.user,
        sslRejectUnauthorized: poolDefaults.sslRejectUnauthorized,
        connectionTimeoutMillis: poolDefaults.connectionTimeoutMillis,
        idleTimeoutMillis: poolDefaults.idleTimeoutMillis,
      });
      log.info('SUPABASE_DB_URL (redacted)', this.connectionDetails.sanitizedUrl);
      
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      log.info('Database connection established successfully');
    } catch (error) {
      log.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    // Initialize database connection
    await this.initializeConnection();
    
    this.running = true;
    log.info('Worker started, polling for jobs...');

    while (this.running) {
      try {
        await this.processNextJob();
        await this.sleep(this.pollInterval);
      } catch (error) {
        log.error('Error in worker loop:', error);
        await this.sleep(this.pollInterval);
      }
    }
  }

  private async processNextJob(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    const client = await this.pool.connect();

    try {
      // Find next QUEUED job (with partial unique index preventing duplicates)
      const result = await client.query<ETLRunRecord>(
        `SELECT * FROM core_warehouse.etl_runs 
         WHERE status = $1 
         ORDER BY created_at ASC 
         LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [RunStatus.QUEUED]
      );

      if (result.rows.length === 0) {
        return; // No jobs to process
      }

      const job = result.rows[0];
      log.info(`Processing job ${job.id}: ${job.platform} ${job.job_type} for shop ${job.shop_id}`);

      // Mark as IN_PROGRESS
      await client.query(
        `UPDATE core_warehouse.etl_runs 
         SET status = $1, started_at = now() 
         WHERE id = $2`,
        [RunStatus.IN_PROGRESS, job.id]
      );

      // Process the job
      await this.executeJob(job, client);
    } finally {
      client.release();
    }
  }

  private async executeJob(job: ETLRunRecord, client: any): Promise<void> {
    let recordsSynced = 0;
    let error: ErrorPayload | null = null;

    try {
      // Route to appropriate ETL processor
      const etl = this.getETLProcessor(job.platform);
      
      // Use transaction for atomicity
      await client.query('BEGIN');
      
      try {
        if (job.job_type === JobType.HISTORICAL) {
          recordsSynced = await etl.runHistorical(job.shop_id, client);
        } else {
          recordsSynced = await etl.runIncremental(job.shop_id, client);
        }

        // Commit transaction
        await client.query('COMMIT');
      } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        throw error;
      }

      // Update cursor on success
      if (recordsSynced > 0) {
        await this.updateCursor(job.shop_id, job.platform, client);
      }

      // Mark as SUCCEEDED
      await client.query(
        `UPDATE core_warehouse.etl_runs 
         SET status = $1, records_synced = $2, completed_at = now() 
         WHERE id = $3`,
        [RunStatus.SUCCEEDED, recordsSynced, job.id]
      );

      log.info(`Job ${job.id} completed successfully: ${recordsSynced} records synced`);
    } catch (err) {
      error = {
        code: this.getErrorCode(err),
        message: err instanceof Error ? err.message : String(err),
        service: 'apps/worker',
        task: `etl_${job.platform.toLowerCase()}`,
        stack_trace: err instanceof Error ? err.stack : undefined,
      };

      // Mark as FAILED - do NOT update cursor
      await client.query(
        `UPDATE core_warehouse.etl_runs 
         SET status = $1, error = $2, completed_at = now() 
         WHERE id = $3`,
        [RunStatus.FAILED, JSON.stringify(error), job.id]
      );

      log.error(`Job ${job.id} failed:`, error.message);
    }
  }

  private getETLProcessor(platform: Platform): ShopifyETL | MetaETL | GA4ETL | KlaviyoETL {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    switch (platform) {
      case Platform.SHOPIFY:
        return new ShopifyETL(this.pool);
      case Platform.META:
        return new MetaETL(this.pool);
      case Platform.GA4:
        return new GA4ETL(this.pool);
      case Platform.KLAVIYO:
        return new KlaviyoETL(this.pool);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async updateCursor(shopId: string, platform: Platform, client: any): Promise<void> {
    // Update sync cursor with current timestamp
    await client.query(
      `INSERT INTO core_warehouse.sync_cursors (shop_id, platform, cursor_value, last_success_at, updated_at)
       VALUES ($1, $2, $3, now(), now())
       ON CONFLICT (shop_id, platform) 
       DO UPDATE SET cursor_value = $3, last_success_at = now(), updated_at = now()`,
      [shopId, platform, new Date().toISOString()]
    );
  }

  private getErrorCode(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes('auth')) return 'AUTH_ERROR';
    if (message.includes('rate limit')) return 'RATE_LIMIT';
    if (message.includes('bulk')) return 'BULK_NOT_READY';
    if (message.includes('permission')) return 'PERMISSION_DENIED';
    if (message.includes('database')) return 'DB_WRITE_ERROR';
    if (message.includes('schema')) return 'SCHEMA_MISMATCH';
    
    return 'UNKNOWN';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pool) {
      await this.pool.end();
    }
    log.info('Worker stopped');
  }
}

