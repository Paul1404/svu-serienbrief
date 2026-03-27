# Serienbrief

Your club's member data is probably a mess. Wrong addresses, old phone numbers, no email on file. And if you can't email them, the only way to reach everyone is good old paper mail.

This app lets you do exactly that: import your member data (e.g. from [Linear Vereinsverwaltung](https://linear.de/)), generate personalized letters with QR codes, print and send them out, and let members correct their own data through a simple web form.

[![TypeScript](https://img.shields.io/badge/TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Hono-green.svg)](https://hono.dev/)
[![Postgres](https://img.shields.io/badge/Database-Postgres-blue.svg)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## The workflow

1. **Import** your MySQL dump from Linear (or similar) — just upload the `.sql` file in the UI, the app handles the conversion.
2. **Pick members** in the dashboard, hit generate, get a ZIP full of DIN A4 PDFs. Each letter has a personal QR code.
3. **Print & mail** the letters.
4. **Members scan the QR code**, see their current data pre-filled, fix whatever's wrong (address, phone, email, IBAN, ...), submit.
5. **Check the dashboard** to see who responded, what changed, who still hasn't opened their link.

It's meant as a one-shot thing — send letters, collect corrections, get your data in order. Members don't need accounts or passwords, just a signed link that expires after 90 days.

---

## Running it

Node.js + Postgres, that's all you need. Works on Railway, Fly.io, Render, a random VPS, your laptop — doesn't matter.

```bash
npm install
npm run build
npm start
# http://localhost:3000
```

There's a `Dockerfile` and `railway.json` in the repo if you want one-click Railway deploys.

### Required env vars

| Variable | What it is |
|----------|------------|
| `DATABASE_URL` | Postgres connection string |
| `ADMIN_PASSWORD` | Password for the admin dashboard |

### Optional: branding

Set these to customize letters and the member portal with your club's name, logo, address, etc. Everything works without them, you just get generic defaults.

| Variable | What it is |
|----------|------------|
| `ORG_NAME` | Full name (e.g. `SV Musterstadt e.V.`) |
| `ORG_SHORT_NAME` | Short name for page titles |
| `ORG_SLOGAN` | Tagline for headers |
| `ORG_LOGO_URL` | URL to your logo |
| `ORG_WEBSITE_URL` | Club website |
| `ORG_PRIVACY_URL` | Privacy policy link |
| `ORG_EMAIL` | Contact email |
| `ORG_PHONE` | Contact phone |
| `ORG_LOCATION` | Location for the date line on letters |
| `ORG_ADDRESS_LINES` | Letterhead address (`\n` for line breaks) |
| `ORG_FOOTER_LEGAL` | Legal footer text for PDFs |

### Optional: S3

If you want logo caching or ZIP archival, point it at any S3-compatible bucket.

| Variable | What it is |
|----------|------------|
| `AWS_ACCESS_KEY_ID` | Access key |
| `AWS_SECRET_ACCESS_KEY` | Secret key |
| `AWS_S3_BUCKET_NAME` | Bucket name |
| `AWS_ENDPOINT_URL` | Custom endpoint (for Minio, R2, etc.) |
| `AWS_DEFAULT_REGION` | Region (default: `us-east-1`) |

See [`.env.example`](.env.example) for a full example.

---

## API routes

### Auth
| Method | Path | |
|--------|------|-|
| POST | `/login` | Log in |
| GET | `/logout` | Log out |

### Admin (needs session)
| Method | Path | |
|--------|------|-|
| GET | `/api/data` | Member list |
| GET | `/api/stats` | Dashboard stats |
| GET | `/api/access-stats` | Who opened their link |
| GET | `/api/change-history` | What got changed |
| GET | `/api/token-status` | Token expiry overview |
| POST | `/api/regenerate-token/:id` | New token for a member |
| POST | `/api/clear-history` | Wipe audit logs |
| POST | `/api/import-sql` | Upload MySQL dump |
| POST | `/letters/generate-pdfs` | Generate letters (ZIP) |

### Member portal (needs token)
| Method | Path | |
|--------|------|-|
| GET | `/update/:token` | Show data form |
| POST | `/update/:token` | Submit corrections |

---

## Security notes

- Sessions live in Postgres, expire after 8h (or 30min idle), and are tied to IP + User-Agent
- Failed logins get a 1s delay, max 5 sessions per IP
- Member tokens are HMAC-SHA256 signed, valid 90 days, tracked in the DB
- Form inputs are validated server-side (email, IBAN checksum, PLZ format, etc.)
- All access and changes are logged (GDPR audit trail)

---

## Tech

Node.js, [Hono](https://hono.dev/), TypeScript, Postgres, [pdf-lib](https://pdf-lib.js.org/), [uqr](https://github.com/nicolo-ribaudo/uqr), [fflate](https://github.com/101arrowz/fflate).

## License

[MIT](LICENSE)
