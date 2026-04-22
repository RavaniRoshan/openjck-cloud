# OpenJCK Cloud — Deployment Guide

This guide covers deploying OpenJCK Cloud to production using Render (backend) and Vercel (frontend) with Supabase as the database.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Backend Deployment (Render)](#backend-deployment-render)
4. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
5. [DNS Configuration](#dns-configuration)
6. [Testing](#testing)
7. [Cost Estimate](#cost-estimate)

---

## Prerequisites

- GitHub repository with the code pushed
- Supabase account (free tier works)
- Render account (free tier works)
- Vercel account (free tier works)
- Domain (optional for launch; Vercel provides default)

---

## Supabase Setup

1. **Create Supabase project**
   - Go to https://app.supabase.com
   - Click "New project"
   - Name: `openjck-prod`
   - Region: Choose closest (e.g., Singapore for India)
   - Password: Generate strong password
   - Wait for provisioning (~2 minutes)

2. **Get credentials**
   - Project Settings → API
   - Copy **URL** (e.g., `https://xyz.supabase.co`)
   - Copy **anon public** key
   - Copy **service_role** key (secret)

3. **Run migrations**
   ```bash
   # Install Supabase CLI if not already
   npm install -g supabase

   # Link your project
   supabase link --project-ref your-project-ref

   # Push migrations
   supabase db push
   ```

4. **Enable Row Level Security (RLS)**
   - Already enabled by default
   - Verify: Database → Policies → RLS enabled on all tables

---

## Backend Deployment (Render)

### Step 1: Prepare Repository

Ensure your repository has:
- `server/Dockerfile` ✅ (already in repo)
- `render.yaml` ✅ (already in repo)
- `server/package.json` ✅

### Step 2: Create Render Service

1. Go to https://render.com
2. Click "New" → "Web Service"
3. Connect your GitHub repo
4. Configure:
   - **Name**: `openjck-api`
   - **Environment**: Node
   - **Region**: Singapore (closest to India)
   - **Branch**: main
   - **Build Command**: `cd server && npm ci`
   - **Start Command**: `node server.js`
   - **Plan**: Free

5. **Environment Variables** (click "Advanced" → "Environment Variables"):
   Add these key-value pairs (replace with your actual values):

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `7070` |
   | `SUPABASE_URL` | `https://your-project.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` (OpenJCK hosted key) |
   | `ENCRYPTION_KEY` | `64-char-hex-string` |
   | `LOG_LEVEL` | `info` |

   **Important**: Do not use quotes around values.

6. Click "Create Web Service"

7. Wait for build and deploy (~5-10 minutes)

8. **Note your API URL**: `https://openjck-api.onrender.com`

---

## Frontend Deployment (Vercel)

### Step 1: Prepare Repository

Ensure your repository has:
- `dashboard/vercel.json` ✅ (already in repo)
- Dashboard package.json with correct scripts

### Step 2: Import Project to Vercel

1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - Project name: `openjck-dashboard`
   - Framework preset: Next.js
   - Root directory: `dashboard`
   - Build and output settings: default

5. **Environment Variables** (in Vercel dashboard → Project Settings → Environment Variables):
   Add these for **Production** environment:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` |
   | `NEXT_PUBLIC_OPENJCK_API_URL` | `https://openjck-api.onrender.com` |

6. Click "Deploy"

7. Wait for build (~3-5 minutes)

8. **Note your dashboard URL**: `https://openjck-dashboard.vercel.app`

---

## DNS Configuration (Optional)

If you have a custom domain (e.g., `openjck.cloud`):

### API subdomain
```
api.openjck.cloud CNAME openjck-api.onrender.com
```

### Dashboard subdomain
```
dashboard.openjck.cloud CNAME cname.vercel-dns.com
```

Set these in your DNS provider (or use Cloudflare Free tier for DDoS/WAF protection).

If you don't have a custom domain, use the Render and Vercel default URLs.

---

## Testing

### Health Checks

**Backend**:
```bash
curl https://openjck-api.onrender.com/health
```
Expected:
```json
{
  "status": "ok",
  "timestamp": "...",
  "version": "0.4.0",
  "services": { "database": "ok", "workers": "ok" }
}
```

**Frontend**:
Open your Vercel dashboard URL — should load without errors.

### End-to-End

1. Create an organization via dashboard
2. Generate an API key (or use the hosted key for testing)
3. Run Python SDK:
   ```python
   from openjck import ClawSession
   import anthropic

   session = ClawSession(
       client=anthropic.Anthropic(),
       api_key="openjck_prod_test",
       project="test"
   )
   response = session.client.messages.create(
       model="claude-sonnet-4",
       max_tokens=10,
       messages=[{"role": "user", "content": "Hello"}]
   )
   print("Session ID:", session.session_id)
   ```
4. Check dashboard: session should appear in real-time

---

## Cost Estimate

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Supabase | Pro | $25/mo |
| Render | Free | $0/mo |
| Vercel | Free | $0/mo |
| Domain (optional) | - | ~$10-15/yr |
| **Total** | | **$25/mo** |

Render free tier: 512MB RAM, 0.1 CPU, 100GB outbound transfer/month.
Vercel free tier: 100GB bandwidth, unlimited builds.

---

## Staging Environment (Optional)

For a staging setup:

1. **Supabase**: Create `openjck-staging` project
2. **Render**: Create another service `openjck-api-staging` pointing to `develop` branch, with staging env vars
3. **Vercel**: Already provides preview URLs for PRs; can also create `openjck-dashboard-staging` project

Update `openjck-master-truth.md` environment matrix accordingly.

---

## Troubleshooting

### Render build fails
- Check build logs in Render dashboard
- Ensure `cd server && npm ci` works locally
- Verify `server/Dockerfile` is present

### Vercel build fails
- Ensure `NEXT_PUBLIC_` env vars are set in Vercel
- Check that `dashboard/package.json` scripts are correct
- Verify Node.js version matches (20.x)

### Database connection errors
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check Supabase project is active
- Ensure table schema exists (run migrations)

### Health endpoint returns 500
- Check Render logs for errors
- Common issues: missing env vars, Supabase connection failure

### Dashboard cannot connect to API
- Check `NEXT_PUBLIC_OPENJCK_API_URL` is set correctly in Vercel
- Ensure CORS is enabled (it is by default with `cors()` middleware)
- Test API from browser: `https://openjck-api.onrender.com/health`

---

## Maintenance

### Deploying updates

**Backend**:
- Push to `main` branch → Render auto-deploys (unless disabled)
- Or manually trigger deploy in Render dashboard

**Frontend**:
- Push to `main` branch → Vercel auto-deploys
- Or manually trigger deploy in Vercel dashboard

### Monitoring

- Render: Dashboard → Metrics (CPU, memory, logs)
- Vercel: Dashboard → Analytics
- Supabase: Dashboard → Database → Insights

Set up alerts (optional):
- Render: Can integrate with Slack/email for failures
- Vercel: Email notifications on build failures

---

## Security Checklist

- [ ] `ENCRYPTION_KEY` is 64-char hex and stored in Render secrets
- [ ] `SUPABASE_SERVICE_ROLE_KEY` never exposed to client (only backend)
- [ ] CORS configured to allow dashboard origin (currently `*` in dev)
- [ ] HTTPS enforced by Render/Vercel (automatic)
- [ ] Rate limiting enabled on `/api/v1/events` (already implemented)
- [ ] API keys stored as bcrypt hashes (implementation pending)
- [ ] RLS policies active in Supabase (by default)

---

## Next Steps After Deployment

1. Set up custom domain if desired
2. Configure monitoring (Sentry for errors, Uptime Robot for health checks)
3. Set up billing alerts (Supabase, Render)
4. Create landing page/docs
5. Add CI/CD tests (already have test files)

---

*Document version: 1.0 — April 2026*
*For: OpenJCK Cloud production deployment*
*Stack: Render (Node.js), Vercel (Next.js), Supabase (PostgreSQL)*