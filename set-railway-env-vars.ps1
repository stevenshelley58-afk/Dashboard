# Set Railway Environment Variables
# Run this script after linking to Railway project

Write-Host "Setting Railway environment variables..." -ForegroundColor Green

# Link to Railway project (if not already linked)
Write-Host "`n1. Linking to Railway project..." -ForegroundColor Yellow
Write-Host "   Select 'refreshing-strength' when prompted" -ForegroundColor Gray
railway link

# Set required environment variables
Write-Host "`n2. Setting environment variables..." -ForegroundColor Yellow

railway variables --set "NODE_ENV=production"

railway variables --set "SUPABASE_DB_URL=postgresql://postgres.gywjhlqmqucjkneucjbp:J7Tg4LkQiTbz%21cS@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?application_name=worker-listener&keepalives=1&connect_timeout=5"

railway variables --set "PACKAGE_MANAGER=pnpm"

# Verify variables
Write-Host "`n3. Verifying variables..." -ForegroundColor Yellow
railway variables

Write-Host "`n✅ Environment variables set! Railway will automatically redeploy." -ForegroundColor Green
Write-Host "`nConnection string details:" -ForegroundColor Cyan
Write-Host "  - Host: aws-1-ap-southeast-2.pooler.supabase.com" -ForegroundColor Gray
Write-Host "  - Port: 6543" -ForegroundColor Gray
Write-Host "  - SSL: enabled (sslmode=require)" -ForegroundColor Gray
Write-Host "  - Application name: worker-listener" -ForegroundColor Gray
Write-Host "  - Keepalives: enabled" -ForegroundColor Gray
Write-Host "  - connect_timeout: 5" -ForegroundColor Gray

