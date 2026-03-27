# Serienbrief

A tool for sports clubs and associations to collect up-to-date contact data from their members — via postal mail.

[![TypeScript](https://img.shields.io/badge/TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Hono-green.svg)](https://hono.dev/)
[![Postgres](https://img.shields.io/badge/Database-Postgres-blue.svg)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## The Problem

Many clubs — especially those using software like [Linear Vereinsverwaltung](https://linear.de/) — have member data that's years out of date: wrong addresses, old phone numbers, missing email addresses. And when you don't have current contact info, the only way to reach everyone is by post.

## How It Works

1. **Import your data** — Upload a MySQL dump from your Vereinsverwaltung (e.g. the `datensicherung.sql` from Linear). The app converts and imports it automatically.
2. **Generate Serienbriefe** — Select members in the admin dashboard and generate personalized DIN A4 letters as a ZIP of PDFs, ready to print and mail. Each letter contains a QR code with a unique, time-limited link.
3. **Members update their own data** — When a member scans their QR code (or types the URL), they see a pre-filled form with their current data and can correct it — address, phone, email, IBAN, etc.
4. **Review the results** — The admin dashboard shows who accessed their link, what they changed, and what's still outstanding.

That's it. It's designed as a one-shot operation: send out letters, collect corrections, done. No member accounts, no passwords — just a signed link that's valid for 90 days.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js + [Hono](https://hono.dev/) |
| Database | PostgreSQL (any provider — Neon, Railway Postgres, self-hosted, etc.) |
| Language | TypeScript |
| PDF generation | [pdf-lib](https://pdf-lib.js.org/) |
| QR codes | [uqr](https://github.com/nicolo-ribaudo/uqr) |
| ZIP compression | [fflate](https://github.com/101arrowz/fflate) |
| Storage (optional) | S3-compatible (logo caching, ZIP archival) |

---

## Getting Started

### Environment Variables

Copy `.env.example` and fill in the required values:

```bash
cp .env.example .env
```

**Required:**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string |
| `ADMIN_PASSWORD` | Admin dashboard password |

**Optional — Organization Branding:**

| Variable | Description |
|----------|-------------|
| `ORG_NAME` | Full organization name |
| `ORG_SHORT_NAME` | Short name for page titles |
| `ORG_SLOGAN` | Tagline displayed in headers |
| `ORG_LOGO_URL` | URL to club logo (PNG) |
| `ORG_WEBSITE_URL` | Club website URL |
| `ORG_PRIVACY_URL` | Privacy policy URL |
| `ORG_EMAIL` | Contact email |
| `ORG_PHONE` | Contact phone number |
| `ORG_LOCATION` | Location for letter date lines |
| `ORG_ADDRESS_LINES` | Letterhead address (use `\n` for line breaks) |
| `ORG_FOOTER_LEGAL` | Legal footer for PDFs |

**Optional — S3 Storage:**

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | S3 access key |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key |
| `AWS_S3_BUCKET_NAME` | S3 bucket name |
| `AWS_ENDPOINT_URL` | Custom S3 endpoint (for S3-compatible providers) |
| `AWS_DEFAULT_REGION` | AWS region (default: `us-east-1`) |

### Local Development

```bash
npm install
npm run build
npm start
# → http://localhost:3000
```

### Deployment

The app is a standard Node.js server. Deploy it anywhere that runs Node.js and can connect to Postgres — Railway, Fly.io, Render, a VPS with Docker, etc.

The repo includes a `Dockerfile` and `railway.json` for one-click Railway deploys, but neither is required. The only hard requirements are:

1. **Node.js >= 24**
2. **A Postgres database**
3. **`DATABASE_URL` and `ADMIN_PASSWORD` set as environment variables**

The app reads `PORT` from the environment (default `3000`) and exposes a `/health` endpoint for health checks.

---

## API Overview

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/login` | Authenticate with admin password |
| GET | `/logout` | End session |

### Admin (session required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/data` | Paginated member records |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/access-stats` | Member access counts |
| GET | `/api/change-history` | Audit log of data changes |
| GET | `/api/token-status` | Token expiry status for all members |
| POST | `/api/regenerate-token/:id` | Regenerate a member's access token |
| POST | `/api/clear-history` | Delete all audit logs |
| POST | `/letters/generate-pdfs` | Generate mail-merge PDFs as ZIP |

### Member Portal (token required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/update/:token` | View pre-populated data form |
| POST | `/update/:token` | Submit data corrections |

---

## Security

- **Sessions**: Postgres-backed, 8-hour expiry, 30-minute idle timeout, IP + User-Agent validation
- **Brute-force protection**: 1-second delay on failed login, 5 sessions per IP limit
- **Member tokens**: HMAC-SHA256 signed, 90-day validity, tracked in database
- **Validation**: Email (RFC 5322), IBAN (checksum), PLZ (5-digit), phone format checks
- **Audit**: All member access and data changes are logged for GDPR compliance

---

## License

[MIT](LICENSE)
