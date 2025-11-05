# Railway Environment Variables Setup Script - Legacy IPv4 (Deprecated)
# This script now delegates to the transaction pooler configuration to avoid TLS issues.

Write-Host "Setting Railway environment variables (transaction pooler replacement for legacy IPv4)..." -ForegroundColor Green

# Link to Railway project (if not already linked)
Write-Host "`n1. Linking to Railway project..." -ForegroundColor Yellow
Write-Host "   Select 'refreshing-strength' when prompted" -ForegroundColor Gray
railway link

# Set pooler connection string instead of IPv4 direct host
Write-Host "`n2. Setting SUPABASE_DB_URL (transaction pooler)..." -ForegroundColor Yellow
railway variables --set "SUPABASE_DB_URL=postgresql://postgres.gywjhlqmqucjkneucjbp:J7Tg4LkQiTbz%21cS@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require&application_name=worker-listener&keepalives=1&connect_timeout=5"

# Verify variables
Write-Host "`n3. Verifying variables..." -ForegroundColor Yellow
railway variables

Write-Host "`n✅ Environment variables set! Railway will automatically redeploy." -ForegroundColor Green
Write-Host "`nNote: Legacy IPv4 direct host is no longer supported; this script now sets the transaction pooler URI." -ForegroundColor Gray

