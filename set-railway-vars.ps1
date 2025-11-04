# Railway Environment Variables Setup Script
# Run this script to set environment variables in Railway

Write-Host "Setting Railway environment variables..." -ForegroundColor Green

# Link to Railway project (if not already linked)
Write-Host "`n1. Linking to Railway project..." -ForegroundColor Yellow
Write-Host "   Select 'refreshing-strength' when prompted" -ForegroundColor Gray
railway link

# Set required environment variable (using CONNECTION POOLER for IPv4 compatibility)
Write-Host "`n2. Setting SUPABASE_DB_URL..." -ForegroundColor Yellow
railway variables --set "SUPABASE_DB_URL=postgresql://postgres.gywjhlqmqucjkneucjbp:J7Tg4LkQiTbz!cS@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require&application_name=worker-listener&keepalives=1"

# Verify variables
Write-Host "`n3. Verifying variables..." -ForegroundColor Yellow
railway variables

Write-Host "`n✅ Environment variables set! Railway will automatically redeploy." -ForegroundColor Green
Write-Host "`nNote: Optional variables (META_ACCESS_TOKEN, GA4_CREDENTIALS_JSON, etc.) can be set manually via Railway dashboard if needed." -ForegroundColor Gray

