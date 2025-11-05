# Vercel CLI Deployment - Complete Guide

## ✅ Completed Steps

1. **Vercel CLI Installed**: ✅ Version 48.2.9
2. **Logged In**: ✅ Account: stevenshelley58-1483
3. **Project Linked**: ✅ Project: `dashboard` (steven-shelleys-projects/dashboard)
4. **Environment Variable Set**: ✅ `NEXT_PUBLIC_SUPABASE_URL=https://gywjhlqmqucjkneucjbp.supabase.co`
5. **Deployed to Production**: ✅ Deployment completed
   - **Production URL**: https://web-mu-black.vercel.app

## 🔧 Remaining Steps

### Step 1: Get Supabase Anon Key

You need to retrieve the anon key from your Supabase project:

1. Go to https://supabase.com/dashboard/project/gywjhlqmqucjkneucjbp
2. Navigate to **Settings** → **API**
3. Under **Project API keys**, copy the **anon/public** key
4. It should look like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Step 2: Set Anon Key in Vercel

**Option A: Using Vercel CLI**
```powershell
cd apps/web
echo "YOUR_ANON_KEY_HERE" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "YOUR_ANON_KEY_HERE" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
echo "YOUR_ANON_KEY_HERE" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development
```

**Option B: Using Vercel Dashboard (Recommended)**
1. Go to https://vercel.com/dashboard
2. Select project: `dashboard`
3. Go to **Settings** → **Environment Variables**
4. Add:
   - **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value**: `[paste your anon key]`
   - **Environments**: Select all (Production, Preview, Development)
5. Click **Save**

**Option C: Use Supabase Integration (Auto-sync)**
1. Go to https://vercel.com/dashboard
2. Select project: `dashboard`
3. Go to **Settings** → **Integrations**
4. Find **Supabase** integration and click **Add**
5. Select your Supabase project: `Dashboard (gywjhlqmqucjkneucjbp)`
6. This will automatically sync `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Step 3: Deploy to Vercel

Once the environment variables are set, deploy:

```powershell
cd apps/web
vercel --prod
```

Or deploy from the root directory:
```powershell
cd C:\Dashboard
vercel --cwd apps/web --prod
```

## 📋 Project Configuration

- **Project Name**: `web`
- **Framework**: Next.js (auto-detected)
- **Root Directory**: `apps/web`
- **Build Command**: Auto-detected (Next.js default)
- **Install Command**: Auto-detected (pnpm/npm/yarn)
- **Output Directory**: `.next` (Next.js default)

## 🔍 Verification

After deployment, verify:

1. **Check deployment URL**:
   ```powershell
   vercel ls
   ```

2. **View environment variables**:
   ```powershell
   vercel env ls
   ```

3. **Check deployment logs**:
   ```powershell
   vercel logs [deployment-url]
   ```

## 🚀 Quick Deployment Commands

```powershell
# Navigate to web app
cd C:\Dashboard\apps\web

# View current environment variables
vercel env ls

# Add environment variable (if needed)
echo "value" | vercel env add VARIABLE_NAME production

# Deploy to production
vercel --prod

# Deploy to preview
vercel

# View deployments
vercel ls
```

## 📝 Notes

- The `vercel.json` in the root directory is configured for the monorepo structure
- Vercel auto-detects Next.js when deploying from `apps/web`
- Environment variables set via CLI are automatically synced to Vercel dashboard
- The Supabase integration is the easiest way to keep environment variables in sync

## 🔗 Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Project**: https://vercel.com/steven-shelleys-projects/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard/project/gywjhlqmqucjkneucjbp
- **Supabase API Settings**: https://supabase.com/dashboard/project/gywjhlqmqucjkneucjbp/settings/api

