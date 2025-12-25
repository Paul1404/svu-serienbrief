# Member Data Explorer

Password-protected web dashboard for browsing the SVU member database.

## Features

- 🔐 **Form-based Login** - Secure session-based authentication
- 📊 **Table Browser** - View all tables and their schemas
- 🔍 **Column Search** - Search any column with LIKE queries
- 📄 **Pagination** - Browse large datasets efficiently
- 🎨 **Clean UI** - Responsive, modern interface

## Quick Start

**Set admin password:**
```bash
npx wrangler secret put ADMIN_PASSWORD
# Enter your secure password when prompted
```

**Install dependencies:**
```bash
npm install
```

**Run locally:**
```bash
npm run dev
```

Access at `http://localhost:8787/login` and enter your password.

**Deploy to Cloudflare:**
```bash
npm run deploy
```

## Change Password

Update the password anytime using Wrangler secrets:

```bash
npx wrangler secret put ADMIN_PASSWORD
# Enter your new password
```

For local development, create a `.dev.vars` file:
```bash
echo "ADMIN_PASSWORD=your-dev-password" > .dev.vars
```

## API Endpoints

All require active session (login first):

- `GET /login` - Login form
- `POST /login` - Submit password
- `GET /logout` - End session
- `GET /` - Dashboard UI
- `GET /api/tables` - List all tables
- `GET /api/table-info?table=adresse` - Get columns & row count
- `GET /api/data?table=adresse&page=1&limit=50` - Fetch table data
- `GET /api/search?table=adresse&column=Nachname&q=Müller` - Search records

## Security Notes

- Sessions expire after 8 hours of inactivity
- Cookies are HttpOnly, Secure, and SameSite=Strict
- Password must be set via `wrangler secret` (required)
- Database is read-only (no INSERT/UPDATE/DELETE)
- SQL injection protected via parameterized queries
