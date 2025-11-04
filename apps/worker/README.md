# Dashboard Worker

ETL pipeline worker service for Railway. Processes queued jobs from `core_warehouse.etl_runs` and syncs data from external platforms.

## Features

- **Multi-platform ETL**: Meta, GA4, Klaviyo (Shopify coming soon)
- **Job Processing**: Polls for QUEUED jobs and processes them
- **Error Handling**: Comprehensive error codes matching spec
- **Rate Limiting**: Built-in rate limiting for all API clients
- **Retry Logic**: Exponential backoff for transient failures
- **Transaction Support**: Atomic operations with rollback on failure

## Environment Variables

Required:
- `SUPABASE_DB_URL` - Direct database connection string

Optional (for each platform):
- `META_ACCESS_TOKEN` - Meta Business System User token
- `META_AD_ACCOUNT_ID` - Meta ad account ID
- `GA4_CREDENTIALS_JSON` - GA4 service account JSON
- `GA4_PROPERTY_ID` - GA4 property ID
- `KLAVIYO_API_KEY` - Klaviyo private API key

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Test connections
npm run test-connections

# Start production
npm start
```

## How It Works

1. Worker polls `core_warehouse.etl_runs` for QUEUED jobs
2. Claims job by setting status to IN_PROGRESS
3. Routes to appropriate ETL processor (Meta/GA4/Klaviyo)
4. ETL processor:
   - Fetches data from external API
   - Loads into `staging_ingest` schema
   - Runs SQL transforms to `core_warehouse` schema
   - Updates sync cursor on success
5. Marks job as SUCCEEDED or FAILED
6. Cursor is NOT updated on failure (per spec)

## Job Types

- **HISTORICAL**: Backfill all data (default: 2 years)
- **INCREMENTAL**: Sync since last successful cursor

## Error Handling

Errors are stored in `etl_runs.error` as JSONB with:
- `code`: Error code (e.g., `META_AUTH_ERROR`, `GA4_PERMISSION_DENIED`)
- `message`: Human-readable error message
- `service`: Service name (`apps/worker`)
- `task`: Task identifier
- `stack_trace`: Optional stack trace

## Monitoring

- Logs to console and `logs/agents.log`
- Check job status in `core_warehouse.etl_runs`
- View sync status in `reporting.sync_status` view

