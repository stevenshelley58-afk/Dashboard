# Vercel Deployment Guide

This guide will help you deploy the frontend to Vercel by connecting your GitHub repository.

## Prerequisites

1. A GitHub account
2. A Vercel account (sign up at [vercel.com](https://vercel.com))
3. Your repository pushed to GitHub

## Step 1: Push Code to GitHub

If you haven't already, push your code to GitHub:

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

## Step 2: Connect GitHub to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Select your GitHub account if prompted
5. Find and select your `Dashboard` repository
6. Click **"Import"**

## Step 3: Configure Project Settings

Vercel should auto-detect Next.js, but verify these settings:

### Framework Preset
- **Framework Preset**: Next.js (auto-detected)

### Root Directory
- **Root Directory**: `apps/web` (or leave blank if using the root vercel.json)

### Build and Output Settings
- **Build Command**: `cd apps/web && pnpm install && pnpm run build` (or auto-detected)
- **Output Directory**: `apps/web/.next` (or auto-detected)
- **Install Command**: `pnpm install` (or auto-detected)

## Step 4: Configure Environment Variables

Click **"Environment Variables"** and add the following:

### Required Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Where to Find Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Environment Scope

Set these variables for:
- ✅ **Production**
- ✅ **Preview** 
- ✅ **Development**

## Step 5: Deploy

1. Click **"Deploy"**
2. Vercel will:
   - Install dependencies with pnpm
   - Build your Next.js app
   - Deploy to production

## Step 6: Verify Deployment

1. Once deployed, Vercel will provide you with a production URL (e.g., `https://your-project.vercel.app`)
2. Visit the URL to verify your dashboard is working
3. Check that:
   - Page loads correctly
   - Supabase connection works
   - Components render properly

## Troubleshooting

### Build Fails with "pnpm: command not found"

If Vercel doesn't detect pnpm automatically:
1. Go to **Settings** → **General**
2. Under **Node.js Version**, select Node.js 18 or higher
3. Under **Package Manager**, ensure pnpm is selected (or add it manually)

### Missing Environment Variables

If you see errors related to Supabase:
1. Go to **Settings** → **Environment Variables**
2. Verify all required variables are set
3. Ensure they're enabled for the correct environments
4. Redeploy after adding variables

### Monorepo Issues

If Vercel has trouble with the monorepo structure:
1. Ensure `vercel.json` is in the root directory
2. Verify the `rootDirectory` is set to `apps/web`
3. Check that `pnpm-workspace.yaml` exists in the root

### API Routes Not Working

If your API routes (`/api/sync`) aren't working:
1. Verify the route files are in `apps/web/src/app/api/`
2. Check Vercel Function logs in the dashboard
3. Ensure all dependencies are listed in `apps/web/package.json`

## Continuous Deployment

Once connected, Vercel will automatically:
- Deploy on every push to `main` branch (production)
- Create preview deployments for pull requests
- Show build status in GitHub

## Next Steps

- [ ] Set up custom domain (optional)
- [ ] Configure preview deployments
- [ ] Set up analytics (optional)
- [ ] Configure security headers (optional)

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

