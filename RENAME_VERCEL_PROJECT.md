# Rename Vercel Project to "Dashboard"

## Quick Method (Vercel Dashboard)

1. **Go to Project Settings:**
   - Visit: https://vercel.com/steven-shelleys-projects/web/settings/general
   - Or: https://vercel.com/dashboard → Click on `web` project → Settings → General

2. **Rename the Project:**
   - Find the "Project Name" field at the top
   - Change from `web` to `Dashboard`
   - Click **"Save"**

3. **Verify:**
   ```powershell
   vercel project ls
   ```
   You should see `Dashboard` instead of `web`

## After Renaming

Once renamed, the project will be accessible at:
- **Dashboard URL**: https://dashboard-steven-shelleys-projects.vercel.app (or similar)
- The old `web` URL will redirect to the new name

## Note

The local `.vercel/project.json` file will update automatically on the next deployment or when you run `vercel link`.

