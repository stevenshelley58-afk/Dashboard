#!/usr/bin/env node
/** Validate environment variables */
import 'dotenv/config';
import { validateEnv, getEnvConfig } from '../config/env.js';
import { logger } from '../utils/logger.js';

const log = logger('validate-env');

async function main() {
  console.log('\n🔍 Validating Environment Variables\n');

  try {
    // Try strict validation (will fail if required vars missing)
    validateEnv();
    console.log('✅ All required environment variables are set\n');
  } catch (error) {
    console.log('⚠️  Some required variables may be missing\n');
    if (error instanceof Error) {
      console.log(`   ${error.message}\n`);
    }
  }

  // Show what's configured
  const config = getEnvConfig();
  console.log('📋 Current Configuration:\n');
  console.log('Supabase:');
  console.log(`  SUPABASE_URL: ${config.SUPABASE_URL ? '✅' : '❌'}`);
  console.log(`  SUPABASE_DB_URL: ${config.SUPABASE_DB_URL ? '✅' : '❌'}`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${config.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌'}`);
  console.log('\nPlatform APIs:');
  console.log(`  Meta: ${config.META_ACCESS_TOKEN && config.META_AD_ACCOUNT_ID ? '✅' : '❌'}`);
  console.log(`  GA4: ${config.GA4_CREDENTIALS_JSON && config.GA4_PROPERTY_ID ? '✅' : '❌'}`);
  console.log(`  Klaviyo: ${config.KLAVIYO_API_KEY ? '✅' : '❌'}`);
  console.log(`  Shopify: ${config.SHOPIFY_ADMIN_ACCESS_TOKEN ? '✅' : '❌'}`);
  console.log('\n');

  process.exit(0);
}

main().catch((error) => {
  log.error('Validation failed:', error);
  process.exit(1);
});

