# SV 1945 Untereuerheim e.V. - Member Verification System

A secure, serverless system for verifying and updating member contact data through personalized QR-coded letters.

## 🏗️ Architecture

This system bridges analog communication (physical letters) and digital data management through three main components:

1. **Generator (Python)** - Reads member data from CSV, generates secure tokens, creates personalized PDF letters with QR codes
2. **Verification Portal (Cloudflare Worker)** - Serverless web application where members verify/update their data
3. **Database (Neon PostgreSQL)** - Stores member data, tokens, and updates

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│  Export.csv │ ───> │  Generator   │ ───> │  PDF Letters    │
│  (Source)   │      │  (Python/uv) │      │  with QR Codes  │
└─────────────┘      └──────┬───────┘      └─────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Neon Database │
                    │  (PostgreSQL) │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────────┐
                    │ Cloudflare Worker │
                    │ Verification Portal│
                    └───────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Member Scans  │
                    │  QR Code      │
                    └───────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.12+** with [uv](https://github.com/astral-sh/uv) installed
- **Node.js 18+** for Cloudflare Worker
- **Neon Database** account (serverless PostgreSQL)
- **Cloudflare** account with Workers enabled

### 1. Clone and Setup

```bash
git clone <repository-url>
cd svu-serienbrief
```

### 2. Database Setup

1. Create a new project at [neon.tech](https://neon.tech)
2. Copy your connection string (looks like `postgresql://user:pass@host.neon.tech/dbname?sslmode=require`)

**Note**: The database schema will be automatically created when you first run the generator. No manual SQL execution needed!

### 3. Configure Environment

Create `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env`:

```ini
DATABASE_URL=postgresql://user:pass@host.neon.tech/dbname?sslmode=require
VERIFICATION_URL=https://svu-mitgliedschaft.untereuerheim.com
```

### 4. Generate Letters

```bash
cd generator
uv run main.py
```

This will:
- ✓ Automatically create database tables (if not exists)
- ✓ Read `linear-in/Export.csv`
- ✓ Validate addresses
- ✓ Generate secure tokens
- ✓ Store data in database
- ✓ Create PDFs in `output/` and `output/edge-cases/`

### 5. Deploy Verification Portal

```bash
cd worker

# Set secrets (only once)
npx wrangler secret put DATABASE_URL
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD

# Deploy to Cloudflare
npm run deploy
```

### 6. Configure DNS

In your Cloudflare dashboard:
1. Go to **Workers & Pages** → Your worker
2. Add custom domain: `svu-mitgliedschaft.untereuerheim.com`
3. Cloudflare will automatically configure DNS

## 📁 Project Structure

```
svu-serienbrief/
├── generator/              # Python letter generator
│   ├── main.py            # Main orchestration script
│   ├── validator.py       # CSV validation logic
│   ├── pdf_generator.py   # PDF creation with QR codes
│   ├── schema.sql         # Database schema
│   ├── pyproject.toml     # Python dependencies (uv)
│   └── .venv/             # Virtual environment
├── worker/                 # Cloudflare Worker
│   ├── src/
│   │   └── index.ts       # Worker request handler
│   ├── wrangler.toml      # Worker configuration
│   ├── package.json       # Node dependencies
│   └── tsconfig.json      # TypeScript config
├── linear-in/             # Input data
│   └── Export.csv         # Member data export
├── output/                # Generated PDFs
│   └── edge-cases/        # Letters with validation issues
├── .env                   # Environment variables (not in git)
├── .env.example           # Template for .env
└── README.md             # This file
```

## 🔄 Workflow

### For Club Administration

1. **Export Data**: Export member list from your management system to `linear-in/Export.csv`
2. **Generate Letters**: Run `uv run main.py` in `generator/`
3. **Review Edge Cases**: Check `output/edge-cases/` for records with missing addresses
4. **Print & Mail**: Print PDFs from `output/` and send via postal mail
5. **Monitor**: Visit `https://svu-mitgliedschaft.untereuerheim.com/admin` to track verifications

### For Members

1. **Receive Letter**: Get personalized letter by mail
2. **Scan QR Code**: Use smartphone camera to scan the QR code
3. **Verify Data**: Review displayed contact information
4. **Update if Needed**: Correct any outdated information
5. **Submit**: Click "Bestätigen" to save changes

## 🎯 Features

### Generator
- ✅ Auto-creates database schema on first run
- ✅ Reads German CSV with proper encoding (cp1252)
- ✅ Validates address completeness
- ✅ Generates cryptographically secure tokens (32-byte)
- ✅ Creates professional DIN A4 letters
- ✅ Embeds QR codes with verification URLs
- ✅ Separates edge cases for manual review
- ✅ Batch database operations with retry logic
- ✅ Structured logging with INFO level

### Verification Portal
- ✅ Token-based authentication (no passwords)
- ✅ Mobile-responsive design
- ✅ User-friendly German interface
- ✅ Real-time form validation
- ✅ JSONB storage for data updates
- ✅ Verification timestamp tracking

### Admin Panel
- ✅ HTTP Basic Authentication
- ✅ Statistics dashboard (total, verified, pending)
- ✅ Real-time search/filter
- ✅ View all member records
- ✅ See submitted changes
- ✅ CSV export for reimport
- ✅ Responsive table layout

## 🔐 Security

### Token Security
- **32-byte URL-safe tokens** = 43 characters of base64
- **Entropy**: ~256 bits (2^256 possible combinations)
- **Brute force resistance**: Computationally infeasible
- **No expiration**: Tokens remain valid indefinitely for member convenience

### Transport Security
- **HTTPS enforced** via Cloudflare
- **Encrypted database connections** (SSL mode required)
- **CORS restricted** to prevent cross-site attacks

### Admin Security
- **HTTP Basic Authentication** with secrets stored in Cloudflare
- **Read-only panel**: No write operations exposed
- **Audit trail**: All actions timestamped in database

## 📊 Database Schema

```sql
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,           -- 32-byte secure token
    mitgl_nr TEXT,                        -- Member ID (nullable)
    vorname TEXT NOT NULL,                -- First name
    nachname TEXT NOT NULL,               -- Last name
    strasse TEXT NOT NULL,                -- Street address
    plz TEXT NOT NULL,                    -- Postal code
    ort TEXT NOT NULL,                    -- City
    email TEXT,                           -- Email (optional)
    telefon TEXT,                         -- Phone (optional)
    geschlecht TEXT,                      -- Gender (optional)
    verified_at TIMESTAMP,                -- Verification timestamp
    updated_data JSONB,                   -- Submitted changes
    created_at TIMESTAMP DEFAULT NOW(),   -- Record creation
    updated_at TIMESTAMP DEFAULT NOW()    -- Last update
);

-- Indexes for performance
CREATE INDEX idx_members_token ON members(token);
CREATE INDEX idx_members_nachname ON members(nachname);
CREATE INDEX idx_members_verified_at ON members(verified_at);
```

## 🛠️ Maintenance

### Regenerating Tokens

If you need to run the generator again (e.g., after updating CSV data), tokens will be regenerated:

```bash
cd generator
uv run main.py
```

**Important**: This deletes all existing records and creates fresh tokens. Previously printed letters will become invalid.

### Updating the Worker

After code changes:

```bash
cd worker
npm run deploy
```

### Viewing Logs

```bash
cd worker
npx wrangler tail
```

### Exporting Data

1. Visit: `https://svu-mitgliedschaft.untereuerheim.com/admin`
2. Enter admin credentials
3. Click "CSV Export"
4. File downloads with format: `svu-members-export-YYYY-MM-DD.csv`

## 📝 CSV Format

Expected format for `linear-in/Export.csv`:

```csv
Status;Mitgl.Nr.;Vorname;Nachname;Firma;Spender;Strasse;PLZ;Ort;Telefon;E-Mail;Geburtstag;Sparte;Geschlecht;Ausgetreten
;;Max;Mustermann;;N;Musterstraße 1;12345;Musterstadt;0123456789;max@example.com;;;MÄNNLICH;N
```

**Key Points**:
- Delimiter: semicolon (`;`)
- Encoding: `cp1252` (Windows German)
- Required fields: `Vorname`, `Nachname`, `Strasse`, `PLZ`, `Ort`
- Optional: `Mitgl.Nr.`, `E-Mail`, `Telefon`, `Geschlecht`

## 🐛 Troubleshooting

### "Database connection failed"
- Verify `DATABASE_URL` in `.env` is correct
- Check Neon database is active (it auto-suspends after inactivity)
- Ensure `?sslmode=require` is in connection string

### "No letters generated"
- Check `linear-in/Export.csv` exists and has data
- Verify CSV encoding is `cp1252`
- Review validation errors in console output
- Check `output/edge-cases/` for problematic records

### "QR code doesn't work"
- Ensure `VERIFICATION_URL` matches deployed worker URL
- Check worker is deployed: `npx wrangler deployments list`
- Verify DNS is configured correctly

### "Admin panel won't login"
- Confirm secrets are set: `npx wrangler secret list`
- Re-upload credentials: `npx wrangler secret put ADMIN_USERNAME`
- Check browser is sending correct credentials

### "Worker deploy fails"
- Ensure you're logged in: `npx wrangler login`
- Check `wrangler.toml` domain matches your Cloudflare zone
- Verify account has Workers enabled

## 📜 License

MIT License - Copyright 2025 Paul Dresch

## 🤝 Contributing

This project is maintained for SV 1945 Untereuerheim e.V. For issues or feature requests, please contact:

- Email: info@sv-untereuerheim.de
- Phone: 09729/432

## 🙏 Acknowledgments

Built with:
- [uv](https://github.com/astral-sh/uv) - Fast Python package manager
- [ReportLab](https://www.reportlab.com/) - PDF generation
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless compute
- [Neon](https://neon.tech) - Serverless PostgreSQL
- [Loguru](https://github.com/Delgan/loguru) - Python logging

---

**SV 1945 Untereuerheim e.V.** | Triebweg 9, 97508 Grettstadt/Untereuerheim | [sv-untereuerheim.de](https://sv-untereuerheim.de)
