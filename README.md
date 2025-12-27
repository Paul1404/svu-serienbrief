# SVU Serienbrief - Member Mail-Merge System

Complete member management system for Sportverein 1945 Untereuerheim e.V., built on Cloudflare Workers with D1 database integration.

## Project Overview

This system provides automated PDF letter generation with QR codes for member data verification, self-service member update forms, comprehensive change tracking, and an admin dashboard for oversight. The application handles 474 active members with secure authentication and session management.

## Core Features

### PDF Letter Generation
- Automated mail-merge system generating personalized DIN A4 format letters
- Embedded club logo and member-specific QR codes
- Each QR code links to a secure, tokenized member update form (90-day validity)
- Batch generation with ZIP archive download
- Proper German formatting with full URLs displayed beneath QR codes

### Member Self-Service Portal
- Secure, tokenized access links for member data verification
- Comprehensive form validation (email format, IBAN structure, PLZ 5-digit validation, phone number formatting)
- No-changes detection to prevent unnecessary database writes
- Real-time validation with German language feedback
- HMAC-SHA256 token generation with 90-day expiration

### Admin Dashboard
- DataTables-powered interface with jQuery 3.7.1
- Member database browser with inline selection (checkbox-based)
- Change history tracking with timestamp and field-level detail
- Optimized for large screens (1800px container width)
- Refresh functionality and German localization
- Pagination defaulting to 100 items per page

### Security & Session Management
- IP address validation for session binding
- 30-minute idle timeout with automatic cleanup
- Session limit of 5 per IP address
- Activity tracking with createdAt and lastActivity timestamps
- Brute force protection with 1-second login delay
- Probabilistic session cleanup (1% of requests) due to Cloudflare Workers constraints

### Data Import & Processing
- CSV import system with ISO-8859-1 encoding detection
- Automatic type inference (INTEGER, REAL, TEXT)
- Semicolon delimiter support for German-formatted data
- MySQL to D1 SQL conversion tooling
- Chunked SQL output for large datasets (10 chunks)

## Technical Stack

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (svu_prod01 binding)
- **Language**: TypeScript 5.7.2
- **Frontend**: jQuery 3.7.1, DataTables 2.3.6
- **PDF Generation**: pdf-lib 1.17.1
- **Build Tool**: esbuild via Wrangler

## Database Schema

### auswertung (474 members)
Primary member table containing: mitglieds_nr, vorname, nachname, geburtstag, strasse, PLZ, ort, telefon, handy, email, IBAN, abteilung

### member_access_log
Tracks member portal access with timestamps and IP addresses

### member_changes_log
Records all member data modifications with field-level detail, old/new values, and timestamps

### admin_sessions
Session storage with expiration, IP binding, user agent tracking, and activity timestamps

## API Endpoints

### Admin Routes
- `GET /` - Admin dashboard with DataTables interface
- `GET /login` - Admin login form
- `POST /login` - Session creation with IP validation
- `GET /logout` - Session termination
- `POST /api/generate-letters` - PDF batch generation with member selection
- `GET /api/change-history` - Fetch member change log with JOIN to auswertung

### Member Routes
- `GET /update/:token` - Tokenized member update form
- `POST /update/:token` - Process member data updates with validation

## Deployment

### Prerequisites
Set admin password via Wrangler secrets:
```bash
npx wrangler secret put ADMIN_PASSWORD
```

### Local Development
```bash
npm install
echo "ADMIN_PASSWORD=your-dev-password" > .dev.vars
npm run dev
```

Access at `http://localhost:8787/login`

### Production Deployment
```bash
npm run deploy
```

Deployed to Cloudflare Workers with automatic D1 binding.

## Data Import Process

### CSV to D1
1. Place CSV file in `D1-Import-CSV/linear-in/`
2. Run Python import script (handles encoding detection)
3. Data inserted into auswertung table

### MySQL to D1
1. Export MySQL dump to `D1-Import-SQL/linear-in/datesicherung.sql`
2. Run `make` in D1-Import-SQL directory
3. Python conversion script generates chunked SQL output
4. Schema and data chunks created in `d1-output/` directory

## Configuration

### Security Settings
- Admin session timeout: 8 hours
- Member token validity: 90 days
- Session idle timeout: 30 minutes
- Sessions per IP limit: 5
- Login delay (brute force protection): 1 second

### PDF Settings
- Format: DIN A4 (595.28 x 841.89 points)
- QR code size: 100x100 pixels
- URL chunk size: 18 characters per line
- Font: Helvetica (embedded)

## Known Constraints

- Cloudflare Workers prohibit setInterval/setTimeout in global scope
- Session cleanup uses probabilistic execution (1% of auth requests)
- Maximum payload size limited by Workers platform limits
- No file system access; all operations use D1 or external APIs

## Project Structure

```
src/
  index.ts              # Main Hono router
  types.ts              # TypeScript interfaces
  middleware/auth.ts    # Session management with IP validation
  routes/
    api.ts              # Admin API endpoints
    pages.ts            # Admin dashboard rendering
    letters.ts          # PDF generation with QR codes
    update.ts           # Member self-service form
  templates/pages.ts    # HTML templates with DataTables
  utils/helpers.ts      # Utility functions

D1-Import-CSV/          # CSV import tooling
D1-Import-SQL/          # MySQL to D1 conversion
```
