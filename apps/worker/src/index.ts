/** Railway worker - ETL pipeline processor */
import 'dotenv/config';
import { Worker } from './worker.js';
import { logger } from './utils/logger.js';

const log = logger('worker-main');

async function main() {
  log.info('Starting ETL worker...');
  log.info('Environment check:', {
    hasDbUrl: !!process.env.SUPABASE_DB_URL,
    hasMetaToken: !!process.env.META_ACCESS_TOKEN,
    hasGA4Creds: !!process.env.GA4_CREDENTIALS_JSON,
    hasKlaviyoKey: !!process.env.KLAVIYO_API_KEY,
  });

  const worker = new Worker();
  
  try {
    await worker.start();
  } catch (error) {
    log.error('Worker failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

main().catch((error) => {
  log.error('Fatal error:', error);
  process.exit(1);
});

