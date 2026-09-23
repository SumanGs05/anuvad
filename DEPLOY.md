# Deployment Guide

This guide covers deploying Anuvad to Railway (backend) and Vercel (frontend).

## Railway: Backend Setup

### Service configuration

- **Root directory:** `backend`
- **Start command:** `npm start`
- **Health check path:** `/health`
- **Node.js version:** 20 (set via `.nvmrc` or `engines` in `package.json`)

### MongoDB

Two options:

| Option | Notes |
|---|---|
| Railway Mongo plugin | Private network (`MONGODB_URI` uses internal hostname). No egress cost. Single-region. |
| MongoDB Atlas free/paid | Managed, replicated, multi-region. Small additional latency over the public internet. |

Set `MONGODB_URI` to the connection string. Atlas strings look like `mongodb+srv://user:pass@cluster.mongodb.net/anuvad?retryWrites=true`.

### File storage volume

Railway volumes provide persistent storage across deploys.

1. Attach a volume to your service.
2. Set `STORAGE_DIR` to the volume mount path (e.g. `/data/storage`).
3. The server creates `uploads/` and `translated/` subdirectories at startup.

Without a volume, files are lost on every deploy.

### Generating 32-byte base64 secrets

Run this in your terminal to generate each secret:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Run it separately for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MONGO_ENCRYPTION_KEY`, and `MONGO_SIGNING_KEY`. Never reuse the same value for two variables.

**Warning:** Changing `MONGO_ENCRYPTION_KEY` or `MONGO_SIGNING_KEY` after data has been written makes all existing encrypted records unreadable. Rotate these keys only with a planned migration.

### Environment variable table

| Variable | Required in prod | Notes |
|---|---|---|
| `NODE_ENV` | Yes | Must be `production` |
| `PORT` | No | Railway sets this automatically |
| `MONGODB_URI` | Yes | Full connection string |
| `JWT_ACCESS_SECRET` | Yes | 32+ chars, unique |
| `JWT_REFRESH_SECRET` | Yes | 32+ chars, different from access secret |
| `JWT_ACCESS_EXPIRES_IN` | No | Default `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | Default `7d` |
| `SARVAM_API_KEY` | Yes | From Sarvam AI dashboard |
| `SARVAM_API_BASE_URL` | No | Default `https://api.sarvam.ai` |
| `MONGO_ENCRYPTION_KEY` | Yes | 32+ chars base64 |
| `MONGO_SIGNING_KEY` | Yes | 32+ chars base64, different from encryption key |
| `CORS_ORIGIN` | Yes | Exact Vercel URL, no trailing slash (e.g. `https://anuvad.vercel.app`) |
| `TRUST_PROXY` | No | Default `1` in production; set to your actual hop count |
| `STORAGE_DIR` | Yes (volume) | Volume mount path (e.g. `/data/storage`) |
| `RETENTION_DAYS` | No | Default `7`; days before uploaded and translated files are deleted |
| `DAILY_JOB_LIMIT` | No | Default `10`; max translation jobs per user per 24 hours |
| `MAX_PDF_PAGES` | No | Default `50`; PDFs with more pages are rejected |
| `MAX_CONCURRENT_JOBS` | No | Default `2`; parallel pipeline slots |
| `REGISTRATION_ENABLED` | No | Default `true`; set `false` to close new signups |

---

## Vercel: Frontend Setup

### Service configuration

- **Root directory:** `frontend`
- **Build command:** `npm run build`
- **Output directory:** `dist`

### Environment variable

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | Your Railway backend URL, e.g. `https://anuvad-api.up.railway.app` |

### Updating the CSP

After you know your backend URL, open `frontend/vercel.json` and replace `REPLACE-WITH-BACKEND-URL` with the bare hostname (no `https://`, no trailing slash), for example `anuvad-api.up.railway.app`.

Then set `CORS_ORIGIN` in Railway to the exact Vercel deployment URL (e.g. `https://anuvad.vercel.app`) with no trailing slash.

---

## Pre-deploy Checklist

- [ ] All secrets generated fresh with `crypto.randomBytes(32)` and not reused between variables
- [ ] Set up a Sarvam AI usage alert or spend cap at dashboard.sarvam.ai
- [ ] `NODE_ENV=production` is set on Railway
- [ ] `npm test` passes locally with zero failures
- [ ] `npm audit --omit=dev` has no high or critical issues (or each is documented)
- [ ] Decide on `REGISTRATION_ENABLED` (close signups if this is a private tool)
- [ ] Decide on `RETENTION_DAYS` and add a privacy notice: "Documents are sent to Sarvam AI for translation and deleted from our servers after N days."
- [ ] `CORS_ORIGIN` set to exact Vercel URL, no trailing slash
- [ ] CSP in `vercel.json` updated with real backend hostname
- [ ] MongoDB Atlas network access list locked to Railway egress IPs (if using Atlas)

---

## Post-deploy Smoke Test

Run these checks after every deployment:

1. **Health:** `GET https://<backend>/health` returns `{"status":"ok"}`
2. **Register:** POST to `/auth/register` with a test account
3. **Upload:** Upload a small DOCX, verify it reaches `completed` status by polling `/jobs/:id`
4. **Download:** Download the translated file and verify it opens
5. **Isolation:** Log in as a second account and try `GET /jobs/:id` with the first account's job ID - must return 404
6. **Rate limiting:** Hit `/auth/login` 6 times rapidly from the same IP - the 6th should return 429
7. **CORS:** Send a request to the backend with `Origin: https://attacker.com` - must not include `Access-Control-Allow-Origin` in the response
8. **Log safety:** Check Railway logs after an upload - confirm no document text or filenames appear in log output

---

## Known Limitations

- **Files on a volume:** File storage is local to the Railway instance. Multi-region or multi-instance deployments are not supported without switching to object storage (e.g. S3).
- **In-process queue:** The job queue lives in memory. A restart loses any queued (but not yet started) jobs. The startup sweep marks in-flight jobs as failed.
- **Tokens in localStorage:** Access and refresh tokens are stored in localStorage, which is accessible to JavaScript on the page. This is an accepted trade-off for this MVP. A future version could use HttpOnly cookies.
- **Single instance only:** The rate limiter and job queue are in-memory and not shared across multiple Railway replicas. Scale to one instance only.
