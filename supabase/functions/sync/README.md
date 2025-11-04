# Sync Edge Function

Edge Function that enqueues ETL jobs for processing by the worker.

## Endpoint

`POST /functions/v1/sync`

## Authentication

Requires Supabase Auth JWT token in `Authorization` header:
```
Authorization: Bearer <supabase-auth-token>
```

## Request Body

```json
{
  "shop_id": "sh_123abc",
  "job_type": "INCREMENTAL",
  "platform": "META"
}
```

### Fields

- `shop_id` (string, required): Shop identifier
- `job_type` (string, required): `HISTORICAL` or `INCREMENTAL`
- `platform` (string, required): `SHOPIFY`, `META`, `GA4`, or `KLAVIYO`

## Responses

### 202 Accepted
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 400 Bad Request
Invalid `job_type` or `platform`

### 401 Unauthorized
Missing or invalid JWT token

### 403 Forbidden
User does not have access to the specified shop

### 404 Not Found
Shop does not exist

### 409 Conflict
A job for this shop and platform is already in progress

### 500 Internal Server Error
Unexpected server error

## Security

- JWT verification enabled by default
- Shop access validation via `app_dashboard.user_shops` table
- Shop existence verification
- Duplicate job prevention (partial unique index)

## Deployment

```bash
supabase functions deploy sync
```

## Local Testing

```bash
supabase functions serve sync
```

## Notes

- Latency target: sub-1 second
- Side-effect minimal: Only inserts QUEUED row
- Actual processing done by worker service
- Jobs are picked up asynchronously by worker

