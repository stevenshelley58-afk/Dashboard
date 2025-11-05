# Railway Environment Variables Setup Script - IPv4 Direct Connection
# Run this script to set the IPv4 connection string in Railway

Write-Host "Setting Railway environment variables for IPv4 direct connection..." -ForegroundColor Green

# Link to Railway project (if not already linked)
Write-Host "`n1. Linking to Railway project..." -ForegroundColor Yellow
Write-Host "   Select 'refreshing-strength' when prompted" -ForegroundColor Gray
railway link

# Set IPv4 direct connection string
Write-Host "`n2. Setting SUPABASE_DB_URL (IPv4 direct connection)..." -ForegroundColor Yellow
railway variables --set "SUPABASE_DB_URL=postgresql://postgres:J7Tg4LkQiTbz%21cS@db.gywjhlqmqucjkneucjbp.supabase.co:5432/postgres?sslmode=require&application_name=worker-listener&keepalives=1"

# Verify variables
Write-Host "`n3. Verifying variables..." -ForegroundColor Yellow
railway variables

Write-Host "`n✅ Environment variables set! Railway will automatically redeploy." -ForegroundColor Green
Write-Host "`nNote: This uses the IPv4 direct connection (requires Supabase IPv4 add-on enabled)." -ForegroundColor Gray

