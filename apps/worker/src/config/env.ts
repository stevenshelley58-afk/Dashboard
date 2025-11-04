/** Environment variable validation and configuration */
import { z } from 'zod';

const envSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_DB_URL: z.string().url(),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),

  // Shopify (optional for now)
  SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().optional(),
  SHOPIFY_SHOP_DOMAIN: z.string().optional(),
  SHOPIFY_API_VERSION: z.string().optional(),

  // Meta
  META_ACCESS_TOKEN: z.string().optional(),
  META_AD_ACCOUNT_ID: z.string().optional(),

  // GA4
  GA4_PROPERTY_ID: z.string().optional(),
  GA4_CREDENTIALS_JSON: z.string().optional(),

  // Klaviyo
  KLAVIYO_API_KEY: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate and parse environment variables
 */
export function validateEnv(): EnvConfig {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map((e) => e.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables: ${missing}`);
    }
    throw error;
  }
}

/**
 * Get environment config with defaults
 */
export function getEnvConfig(): Partial<EnvConfig> {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
    SHOPIFY_ADMIN_ACCESS_TOKEN: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    SHOPIFY_SHOP_DOMAIN: process.env.SHOPIFY_SHOP_DOMAIN,
    SHOPIFY_API_VERSION: process.env.SHOPIFY_API_VERSION,
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
    META_AD_ACCOUNT_ID: process.env.META_AD_ACCOUNT_ID,
    GA4_PROPERTY_ID: process.env.GA4_PROPERTY_ID,
    GA4_CREDENTIALS_JSON: process.env.GA4_CREDENTIALS_JSON,
    KLAVIYO_API_KEY: process.env.KLAVIYO_API_KEY,
    LOG_LEVEL: (process.env.LOG_LEVEL as EnvConfig['LOG_LEVEL']) || 'INFO',
  };
}

