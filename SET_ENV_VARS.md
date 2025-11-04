# Quick Guide: Set Railway Environment Variables

## Option 1: Using Railway CLI (Recommended)

1. **Link to your Railway project:**
   ```powershell
   railway link
   ```
   - Select workspace: `stevenshelley58-afk's Projects`
   - Select project: `refreshing-strength`

2. **Set the required environment variable:**
   ```powershell
   railway variables --set "SUPABASE_DB_URL=postgresql://postgres.gywjhlqmqucjkneucjbp.supabase.co:5432/postgres?sslmode=require"
   ```

3. **Verify it was set:**
   ```powershell
   railway variables
   ```

4. **Or use the provided script:**
   ```powershell
   .\set-railway-vars.ps1
   ```

## Option 2: Using Railway Dashboard (Manual)

1. Go to https://railway.app
2. Select project: `refreshing-strength`
3. Click on your **worker service**
4. Go to the **Variables** tab
5. Click **New Variable**
6. Enter:
   - **Name:** `SUPABASE_DB_URL`
   - **Value:** `postgresql://postgres.gywjhlqmqucjkneucjbp.supabase.co:5432/postgres?sslmode=require`
7. Click **Add**
8. Railway will automatically redeploy

## Verify Variables Are Set

After setting variables, check:

1. **Via CLI:**
   ```powershell
   railway variables
   ```

2. **Via Dashboard:**
   - Railway Dashboard → Service → Variables
   - Should see `SUPABASE_DB_URL` listed

3. **Check deployment:**
   - Railway Dashboard → Service → Deployments
   - Should see a new deployment starting
   - Check logs to ensure worker starts successfully

## Troubleshooting

### "Project is deleted" error
```powershell
railway link
```
Select your project again.

### Variables not showing
- Wait a few seconds for Railway to sync
- Refresh the dashboard
- Run `railway variables` again

### Service not starting
- Check deployment logs for errors
- Verify `SUPABASE_DB_URL` is set correctly
- Ensure the connection string includes `?sslmode=require`

