# Neon setup guide (Postgres)

This project now includes Postgres migrations in the `migrations/` directory for running on Neon (or any Postgres-compatible database).

## 1. Create a Neon project and database

1. Sign in at `https://console.neon.tech`.
2. Create a new project and database.
3. Copy the **Postgres connection string** for server-side Node usage (e.g. `postgres://user:password@host/dbname`).

## 2. Apply migrations

From your local machine (with `psql` installed), run:

```bash
export DATABASE_URL="postgres://user:password@host/dbname"

psql "$DATABASE_URL" -f migrations/001_init_core_tables.sql
```

This will create:

- `admin_sessions`
- `member_tokens`
- `auswertung` (member data)
- `member_access_log`
- `member_changes_log`

## 3. Import initial data

If you still have the original CSV/MySQL source used for D1, you can:

1. Export it to a CSV that matches the `auswertung` columns used in the app.
2. Use `psql` to import:

```bash
psql "$DATABASE_URL" -c "\copy auswertung FROM 'members.csv' CSV HEADER ENCODING 'LATIN1'"
```

Adjust the path, delimiter, and encoding as needed for your data.

## 4. Configure the app

On Fly.io (or locally for testing), set:

- `DATABASE_URL` – your Neon Postgres connection string.
- `ADMIN_PASSWORD` – the same admin password you currently use with Cloudflare Workers.

The Node/Hono server uses these values to connect to Neon and to validate admin logins and member tokens.

