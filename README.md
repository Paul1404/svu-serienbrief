# Serienbrief

Member management and mail-merge platform for sports clubs and membership organizations. Built with Node.js, Hono, and Postgres.

[![TypeScript](https://img.shields.io/badge/TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Hono-green.svg)](https://hono.dev/)
[![Postgres](https://img.shields.io/badge/Database-Postgres-blue.svg)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What It Does

- **Mail-merge PDF letters** — generate personalized DIN A4 letters with QR codes for hundreds of members, bundled as a ZIP download
- **Self-service member portal** — members scan their QR code, review their data, and submit corrections through a validated form
- **Admin dashboard** — sortable/filterable member table, change history, token status, and statistics
- **Token-based access** — HMAC-SHA256 signed URLs with 90-day validity, no member accounts needed
- **Audit trail** — every access and data change is logged with timestamps, IPs, and field-level diffs

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
