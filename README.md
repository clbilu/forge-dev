[README.md](https://github.com/user-attachments/files/26610451/README.md)
<div align="center">

# FORGE — Portfolio OS

**An open-source portfolio management platform for indie hackers and micro-SaaS builders.**

Track your apps from idea to launch — roadmap, sprints, branding, backlog, docs, team, and more.

[![Deploy to Cloudflare](https://img.shields.io/badge/Deploy_to-Cloudflare-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Stack: Cloudflare](https://img.shields.io/badge/Stack-100%25_Cloudflare-F38020)](https://cloudflare.com)

![FORGE Overview](https://raw.githubusercontent.com/your-username/forge/main/docs/overview.png)

</div>

---

## What is FORGE?

FORGE is a self-hosted Portfolio OS built entirely on Cloudflare's free tier. It helps you manage multiple SaaS products in one place — each app gets its own workspace with:

- 📋 **Roadmap** — sprints with tasks, dates, and progress tracking
- 🎨 **Branding** — color palettes, typography, and asset storage
- 💡 **Backlog** — capture ideas and promote them directly to your roadmap
- 📝 **Docs** — technical documentation per app
- 🚀 **Launch** — stage-based checklist (Idea → MVP → Beta → Launch → Active)
- 👥 **Team** — invite collaborators with role-based access (Owner / Editor / Viewer)
- 📊 **Portfolio Overview** — see all your apps and key metrics at a glance
- 🎯 **Presentation Mode** — clean, full-screen view for meetings and demos

**Platform support:** Web, iPad, iPhone (PWA) — fully responsive with bottom navigation on mobile.

**Languages:** English and Spanish (toggle in the login screen).

---

## Tech Stack

| Layer | Service | Purpose |
|-------|---------|---------|
| Frontend | Cloudflare Pages | React + Vite, auto-deploy from GitHub |
| API | Cloudflare Workers | Serverless REST API (itty-router) |
| Database | Cloudflare D1 | SQLite at the edge |
| Files | Cloudflare R2 | Branding assets (logos, icons, screenshots) |
| Sessions | Cloudflare KV | Refresh token storage with TTL |

**Everything runs on Cloudflare's free tier.** No servers, no egress fees, no cold starts.

**Auth:** JWT (HMAC-SHA256) + httpOnly cookies + PBKDF2 password hashing (100k iterations) — all using Web Crypto API natively in Workers.

---

## Project Structure

```
forge/
├── frontend/          # React + Vite (Cloudflare Pages)
│   ├── src/
│   │   ├── components/
│   │   │   ├── modules/       # Roadmap, Branding, Backlog, Docs, Launch, Team
│   │   │   ├── screens/       # Overview, Presentation Mode
│   │   │   └── auth/          # Login, Invite
│   │   ├── hooks/             # useAuth, useBreakpoint
│   │   ├── i18n/              # ES / EN translations
│   │   └── api/               # Fetch client with auto-refresh
│   └── public/                # PWA manifest, service worker, icons
│
└── worker/            # Cloudflare Workers (API)
    └── src/
        ├── routes/            # auth, apps, sprints, tasks, backlog,
        │                      # docs, launch, branding, team
        ├── middleware/        # JWT auth guard, CORS
        ├── lib/               # JWT sign/verify, PBKDF2, UUID
        └── db/                # SQL schema + migrations
```

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- [Cloudflare account](https://cloudflare.com) (free tier works)
- [GitHub account](https://github.com) (for auto-deploy via Pages)

---

## Setup Guide

### 1. Clone the repository

```bash
git clone https://github.com/your-username/forge.git
cd forge
```

### 2. Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 3. Create Cloudflare resources

```bash
cd worker

# Create D1 database
wrangler d1 create forge
# → Copy the database_id from the output

# Create KV namespace
wrangler kv namespace create KV
# → Copy the id from the output

# Create R2 bucket
wrangler r2 bucket create forge-assets
```

### 4. Configure wrangler.toml

Open `worker/wrangler.toml` and replace the placeholder values:

```toml
[[d1_databases]]
database_id = "PASTE_YOUR_D1_ID_HERE"

[[kv_namespaces]]
id = "PASTE_YOUR_KV_ID_HERE"

[vars]
FRONTEND_URL = "https://your-app.pages.dev"
```

### 5. Apply the database schema

```bash
# From the worker/ directory
wrangler d1 execute forge --file=src/db/schema.sql --remote
wrangler d1 execute forge --file=src/db/migration_multiuser.sql --remote
wrangler d1 execute forge --file=src/db/migration_sprint_dates.sql --remote
```

### 6. Set the JWT secret

Generate a secure random string and register it as a secret:

```bash
# Generate a 64-char random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Register it (paste the generated value when prompted)
wrangler secret put JWT_SECRET
```

### 7. Deploy the Worker

```bash
npm install
wrangler deploy
# → Copy the Worker URL: https://forge-api.YOUR-SUBDOMAIN.workers.dev
```

### 8. Create your user account

The `/api/auth/setup` endpoint only works once — when no users exist:

```bash
curl -X POST https://forge-api.YOUR-SUBDOMAIN.workers.dev/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"YourPassword123"}'
```

### 9. Deploy the Frontend to Cloudflare Pages

1. Push the project to GitHub
2. Go to **Cloudflare → Workers & Pages → Create a project → Connect to Git**
3. Select your repository and configure:

| Setting | Value |
|---------|-------|
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `VITE_API_URL` = `https://forge-api.YOUR-SUBDOMAIN.workers.dev` |

4. Click **Save and Deploy**

### 10. Update CORS

Once you have your Pages URL (e.g. `https://your-app.pages.dev`), update `wrangler.toml`:

```toml
[vars]
FRONTEND_URL = "https://your-app.pages.dev"
```

Then redeploy the Worker:

```bash
wrangler deploy
```

---

## Custom Domain (optional)

If you have a domain managed by Cloudflare:

1. **Cloudflare → Workers & Pages → your-project → Custom domains**
2. Add your domain (e.g. `forge.yourdomain.com`)
3. For the API, go to **Workers & Pages → forge-api → Settings → Triggers → Custom Domains** and add `api.yourdomain.com`
4. Update `VITE_API_URL` in Pages environment variables to `https://api.yourdomain.com`
5. Update `FRONTEND_URL` in `wrangler.toml` to `https://forge.yourdomain.com` and redeploy

---

## Local Development

```bash
# Terminal 1 — Worker (API)
cd worker
npm install
wrangler dev --port 8787

# Terminal 2 — Frontend
cd frontend
npm install
cp .env.example .env.local
# .env.local already points to http://localhost:8787
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Team & Roles

FORGE supports multi-user collaboration per app:

| Role | View | Edit | Invite | Delete App |
|------|------|------|--------|-----------|
| Owner | ✅ | ✅ | ✅ | ✅ |
| Editor | ✅ | ✅ | ❌ | ❌ |
| Viewer | ✅ | ❌ | ❌ | ❌ |

Invite links are generated from the **Team** tab inside each app. Invitees register with just an email and password — no separate account creation flow needed.

---

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `JWT_SECRET` | Worker secret | 64+ char random string for signing JWTs |
| `FRONTEND_URL` | `wrangler.toml` | Your Pages URL (for CORS) |
| `VITE_API_URL` | Pages env vars | Your Worker URL (baked at build time) |

---

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with ☁️ on Cloudflare · Designed for indie hackers and micro-SaaS builders

</div>
