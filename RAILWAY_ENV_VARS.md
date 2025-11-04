# Railway Environment Variables Configuration

This file contains the exact environment variables needed for the Railway worker deployment.

## Required Variables

### SUPABASE_DB_URL
**Required for all deployments**

```
SUPABASE_DB_URL=postgresql://postgres.gywjhlqmqucjkneucjbp.supabase.co:5432/postgres?sslmode=require
```

**Important:** 
- Replace `gywjhlqmqucjkneucjbp` with your actual Supabase project ref if different
- The `?sslmode=require` parameter is mandatory for secure connections
- Get this from Supabase Dashboard → Project Settings → Database → Connection string

## Optional Variables (for ETL functionality)

These are only needed if you want to sync data from these platforms.

### Meta (Facebook Ads)
```
META_ACCESS_TOKEN=<your-meta-business-system-user-token>
META_AD_ACCOUNT_ID=act_<your-ad-account-id>
```

### Google Analytics 4
```
GA4_CREDENTIALS_JSON='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}'
GA4_PROPERTY_ID=<your-ga4-property-id>
```

**Note:** GA4_CREDENTIALS_JSON must be a single-line JSON string wrapped in single quotes.

### Klaviyo
```
KLAVIYO_API_KEY=<your-klaviyo-private-api-key>
```

## How to Set in Railway

1. Go to https://railway.app
2. Select your project: `refreshing-strength`
3. Click on the worker service
4. Go to the **Variables** tab
5. Click **New Variable** for each variable
6. Enter the variable name and value
7. Click **Add**

## Verify Deployment

After setting variables, Railway will automatically redeploy. Check:

1. **Deployment Logs:**
   - Railway Dashboard → Service → Deployments
   - Look for successful build and startup

2. **Service Logs:**
   - Railway Dashboard → Service → Logs
   - You should see: "Starting ETL worker..."
   - No connection errors to Supabase

3. **Test Connection:**
   ```bash
   railway logs --tail 50
   ```
   Look for successful database connection messages.

## Troubleshooting

### Worker won't start
- Verify `SUPABASE_DB_URL` is set correctly
- Check logs for connection errors
- Ensure TLS is enabled (`?sslmode=require`)

### Build fails
- Check Railway logs for TypeScript errors
- Verify `pnpm-workspace.yaml` exists in repository
- Ensure all workspace dependencies are installed

### Runtime errors
- Check all required environment variables are set
- Verify API keys are valid (if using ETL features)
- Check Railway logs for specific error messages

