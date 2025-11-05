/** Connection and integration tests */
import { Pool } from 'pg';
import { MetaClient } from '../clients/meta-client.js';
import { GA4Client } from '../clients/ga4-client.js';
import { KlaviyoClient } from '../clients/klaviyo-client.js';
import { logger } from './logger.js';

const log = logger('connection-test');

export interface TestResult {
  name: string;
  success: boolean;
  error?: string;
}

/**
 * Test database connection
 */
export async function testDatabase(dbUrl: string): Promise<TestResult> {
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
  });

  try {
    const result = await pool.query('SELECT 1 as test');
    await pool.end();

    if (result.rows[0]?.test === 1) {
      return { name: 'Database', success: true };
    }
    return { name: 'Database', success: false, error: 'Unexpected result' };
  } catch (error) {
    await pool.end();
    return {
      name: 'Database',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test Meta API connection
 */
export async function testMeta(
  accessToken: string,
  adAccountId: string
): Promise<TestResult> {
  try {
    const client = new MetaClient(accessToken, adAccountId);
    const success = await client.testConnection();
    return { name: 'Meta API', success };
  } catch (error) {
    return {
      name: 'Meta API',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test GA4 API connection
 */
export async function testGA4(credentialsJson: string, propertyId: string): Promise<TestResult> {
  try {
    const client = new GA4Client(credentialsJson, propertyId);
    const success = await client.testConnection();
    return { name: 'GA4 API', success };
  } catch (error) {
    return {
      name: 'GA4 API',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test Klaviyo API connection
 */
export async function testKlaviyo(apiKey: string): Promise<TestResult> {
  try {
    const client = new KlaviyoClient(apiKey);
    const success = await client.testConnection();
    return { name: 'Klaviyo API', success };
  } catch (error) {
    return {
      name: 'Klaviyo API',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run all connection tests
 */
export async function runAllTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test database
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (dbUrl) {
    results.push(await testDatabase(dbUrl));
  } else {
    results.push({ name: 'Database', success: false, error: 'SUPABASE_DB_URL not set' });
  }

  // Test Meta
  const metaToken = process.env.META_ACCESS_TOKEN;
  const metaAccountId = process.env.META_AD_ACCOUNT_ID;
  if (metaToken && metaAccountId) {
    results.push(await testMeta(metaToken, metaAccountId));
  } else {
    results.push({ name: 'Meta API', success: false, error: 'Credentials not set' });
  }

  // Test GA4
  const ga4Creds = process.env.GA4_CREDENTIALS_JSON;
  const ga4PropertyId = process.env.GA4_PROPERTY_ID;
  if (ga4Creds && ga4PropertyId) {
    results.push(await testGA4(ga4Creds, ga4PropertyId));
  } else {
    results.push({ name: 'GA4 API', success: false, error: 'Credentials not set' });
  }

  // Test Klaviyo
  const klaviyoKey = process.env.KLAVIYO_API_KEY;
  if (klaviyoKey) {
    results.push(await testKlaviyo(klaviyoKey));
  } else {
    results.push({ name: 'Klaviyo API', success: false, error: 'API key not set' });
  }

  return results;
}

