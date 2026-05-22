# Deployment Guide

Two services:
- **Frontend** → Vercel (free tier)
- **Backend** → Render (free tier; the free Python plan sleeps after 15 min idle, wakes on first request in ~30s — fine for hackathon demos)

Supabase is already hosted. Circle is already configured.

---

## 1. Push code to GitHub

```bash
cd /Users/suchithkoduru/Desktop/suchith/Agora
git init -b main
git add .
git status                # ← review what's being committed; .env, .venv, node_modules, register/ should NOT appear
git commit -m "Initial commit: AI escrow on Arc + Gemini judge"
gh repo create agora-escrow --public --source=. --remote=origin --push
```

If `gh` isn't installed: create the repo manually at https://github.com/new, then:
```bash
git remote add origin https://github.com/<you>/agora-escrow.git
git push -u origin main
```

### What gets committed (✅) vs ignored (❌)

**Committed:**
- `backend/` — all .py files, `requirements.txt`, `render.yaml`, `runtime.txt`, `.env.example`
- `frontend/` — all .ts/.tsx, `package.json`, `package-lock.json`, `tailwind.config.ts`, `vercel.json`, `.env.local.example`
- `supabase/migrations/` — the schema migration
- `README.md`, `PROGRESS.md`, `DEPLOY.md`, `CLAUDE.md`, `.gitignore`

**Ignored (`.gitignore`):**
- `**/.env`, `**/.env.local` — secrets
- `register/`, `*.dat` — Circle entity secret recovery file
- `.venv/`, `node_modules/`, `.next/`, `.vercel/`
- `__pycache__/`, IDE/OS junk

> Double-check no secret file leaked into the commit:
> ```bash
> git ls-files | grep -E "\.env$|\.env\.local|\.dat$"   # should print nothing
> ```

---

## 2. Deploy backend → Render

1. Sign up at https://render.com (GitHub login is easiest).
2. **New +** → **Blueprint** → select your repo → Render reads [backend/render.yaml](backend/render.yaml) and proposes the service.
3. Click **Apply**. Render starts building.
4. While it builds, go to the service's **Environment** tab and paste these (values, not keys):
   - `CIRCLE_API_KEY`
   - `CIRCLE_ENTITY_SECRET`
   - `SUPABASE_URL` = `https://cajvqzexeqgcrhxqccef.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `FRONTEND_ORIGIN` = leave blank for now; fill in after step 3
5. Once deployed, copy the public URL (e.g. `https://agora-escrow-backend.onrender.com`).
6. Test: `curl https://agora-escrow-backend.onrender.com/health` → should return `{"status":"ok"}`.

> **Render free tier note:** the service sleeps after 15 min of no traffic. The first request after a sleep takes ~30s to wake. For demo videos, hit `/health` once 30s before recording.

---

## 3. Deploy frontend → Vercel

1. Sign up at https://vercel.com (GitHub login).
2. **Add New** → **Project** → select your repo.
3. **Important — set Root Directory to `frontend`** (Vercel asks during setup).
4. **Environment Variables** (Production scope):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://cajvqzexeqgcrhxqccef.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon public key
   - `NEXT_PUBLIC_API_BASE_URL` = the Render URL from step 2 (`https://agora-escrow-backend.onrender.com`)
5. **Deploy**.
6. Once live, copy the Vercel URL (e.g. `https://agora-escrow.vercel.app`).

---

## 4. Wire the two together (critical — CORS + auth callback)

### 4a. Update backend `FRONTEND_ORIGIN`
Back in Render → Environment → set `FRONTEND_ORIGIN` to the Vercel URL → Render redeploys automatically.

### 4b. Add Vercel URL to Supabase redirect allowlist
Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL:** `https://agora-escrow.vercel.app`
- **Redirect URLs:** add `https://agora-escrow.vercel.app/auth/callback` (keep `http://localhost:3001/auth/callback` too if you still test locally)
- **Save**

### 4c. Smoke test the live app
1. Open the Vercel URL
2. Click Sign in → enter your email → magic link should redirect to `<vercel-url>/dashboard`
3. Create a new escrow → vault address appears → fund it → submit deliverable → run judge → settle
4. Confirm the on-chain explorer link shows the transfer

---

## 5. Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Magic link redirects to `localhost:3001` from production | Supabase Site URL still points to localhost | Set Site URL to your Vercel domain in step 4b |
| `CORS: blocked` in browser console | `FRONTEND_ORIGIN` on backend doesn't match Vercel URL exactly (https vs http, trailing slash) | Update env var in Render, wait for redeploy |
| 504 / cold start on first call | Render free tier sleep | First request takes ~30s; subsequent calls are fast |
| `401: Invalid token` from `/me` | Wrong Supabase JWT alg — make sure `SUPABASE_URL` env is set on Render (JWKS endpoint needs it) | Re-check env var |
| Frontend builds locally but fails on Vercel | Root Directory not set to `frontend` | Project Settings → General → Root Directory |

---

## 6. Optional polish before submission

- Custom domain on Vercel (`agora-escrow.com` etc.) — Project Settings → Domains
- Better favicon/OG image — replace `frontend/app/favicon.ico` + add `frontend/app/opengraph-image.png`
- Disable Supabase email rate limit for the demo — Auth → Rate Limits (default 4 emails/hour is fine for a demo, just don't go wild)
