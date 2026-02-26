# Fly.io deployment guide

This project now has a Node/Hono server (`src/server.ts`) and a `Dockerfile`/`fly.toml` for running on Fly.io with Neon Postgres.

## 1. Prerequisites

- Fly CLI installed (`flyctl`)
- Neon database created and migrated (see `docs/neon-setup.md`)
- `DATABASE_URL` connection string for Neon
- Admin password for the dashboard (`ADMIN_PASSWORD`)

## 2. Launch the Fly app

From the project root:

```bash
flyctl apps create svu-serienbrief
```

If you want a different app name, update `app` in `fly.toml` accordingly.

## 3. Configure secrets

```bash
flyctl secrets set \
  DATABASE_URL="postgres://user:password@host/dbname" \
  ADMIN_PASSWORD="your-strong-admin-password"
```

## 4. Deploy

```bash
flyctl deploy
```

The app listens on port `3000` inside the container, mapped via `fly.toml`:

- HTTP service: `internal_port = 3000`

## 5. Verify

```bash
flyctl open
```

Check:

- `/login` – admin login page
- `/` – dashboard (after login)
- `/api/*` – JSON APIs
- `/update/:token` – member self-service flow using a real or test token

## 6. DNS cutover from Cloudflare Worker

Once the Fly app is healthy and tested:

1. Decide the target hostname (e.g. `svu-mitgliedschaft.untereuerheim.com`).
2. In Fly:
   - Add the hostname: `flyctl certificates add svu-mitgliedschaft.untereuerheim.com`.
3. In your DNS (Cloudflare or other):
   - Point the hostname to the Fly app as instructed by `flyctl certificates show ...`
     (typically a CNAME to `<app>.fly.dev`).
4. After traffic is flowing through Fly and stable, disable the Cloudflare Worker
   route for that hostname and keep the old D1 database read-only for a while.

