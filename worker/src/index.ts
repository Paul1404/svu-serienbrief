/**
 * Cloudflare Worker for SV 1945 Untereuerheim Member Verification System
 * Provides secure token-based verification portal and admin panel
 */

import { neon } from '@neondatabase/serverless';

// Club logo URL
const CLUB_LOGO = 'https://sv-untereuerheim.de/wp-content/uploads/2024/11/logo_svu-241x300.png';

// Environment interface for TypeScript
interface Env {
  DATABASE_URL: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
}

// Member data interface
interface Member {
  id: number;
  token: string;
  mitgl_nr: string | null;
  vorname: string;
  nachname: string;
  strasse: string;
  plz: string;
  ort: string;
  email: string | null;
  telefon: string | null;
  geschlecht: string | null;
  verified_at: string | null;
  updated_data: any;
  created_at: string;
}

/**
 * HTTP Basic Authentication check
 */
function checkAuth(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }
  
  const base64Credentials = authHeader.substring(6);
  const credentials = atob(base64Credentials);
  const [username, password] = credentials.split(':');
  
  return username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD;
}

/**
 * Request HTTP Basic Authentication
 */
function requireAuth(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Admin Panel"',
      'Content-Type': 'text/plain',
    },
  });
}

/**
 * Handle CORS preflight requests
 */
function handleCORS(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  return null;
}

/**
 * Add CORS headers to response
 */
function addCORSHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * GET /verify/:token - Member verification page
 */
async function handleVerifyPage(token: string, env: Env): Promise<Response> {
  const sql = neon(env.DATABASE_URL);
  
  try {
    const members = await sql`
      SELECT * FROM members WHERE token = ${token} LIMIT 1
    `;
    
    if (members.length === 0) {
      return new Response(renderNotFoundPage(), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    
    const member = members[0] as Member;
    
    return new Response(renderVerificationPage(member), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    
  } catch (error) {
    console.error('Database error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * POST /api/verify/:token - Update member data
 */
async function handleVerifyUpdate(token: string, request: Request, env: Env): Promise<Response> {
  const sql = neon(env.DATABASE_URL);
  
  try {
    const updates = await request.json();
    
    // Validate the token exists
    const members = await sql`
      SELECT id FROM members WHERE token = ${token} LIMIT 1
    `;
    
    if (members.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Update the member record
    await sql`
      UPDATE members 
      SET 
        updated_data = ${JSON.stringify(updates)},
        verified_at = COALESCE(verified_at, NOW())
      WHERE token = ${token}
    `;
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Update error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /admin - Admin panel with member list
 */
async function handleAdminPanel(env: Env, searchQuery?: string): Promise<Response> {
  const sql = neon(env.DATABASE_URL);
  
  try {
    // Get statistics
    const stats = await sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(verified_at)::int as verified,
        COUNT(*) FILTER (WHERE verified_at IS NULL)::int as pending
      FROM members
    `;
    
    // Get all members
    const members = await sql`
      SELECT * FROM members ORDER BY created_at DESC
    `;
    
    return new Response(renderAdminPage(stats[0], members as Member[]), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    
  } catch (error) {
    console.error('Admin panel error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * GET /admin/export/csv - Export member data as CSV
 */
async function handleAdminExport(env: Env): Promise<Response> {
  const sql = neon(env.DATABASE_URL);
  
  try {
    const members = await sql`
      SELECT 
        id, mitgl_nr, vorname, nachname, strasse, plz, ort,
        email, telefon, geschlecht, verified_at, updated_data, created_at
      FROM members
      ORDER BY nachname, vorname
    `;
    
    const csv = generateCSV(members as Member[]);
    
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="svu-members-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
    
  } catch (error) {
    console.error('Export error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Generate CSV from member data with UTF-8 BOM for German umlauts
 */
function generateCSV(members: Member[]): string {
  const headers = [
    'ID', 'Mitgl.Nr.', 'Vorname', 'Nachname', 'Strasse', 'PLZ', 'Ort',
    'E-Mail', 'Telefon', 'Geschlecht', 'Verifiziert', 'Aktualisiert', 'Erstellt'
  ];
  
  const rows = members.map(m => {
    // Merge original data with updates for export
    const data = m.updated_data ? { ...m, ...m.updated_data } : m;
    return [
      m.id,
      m.mitgl_nr || '',
      data.vorname,
      data.nachname,
      data.strasse,
      data.plz,
      data.ort,
      data.email || '',
      data.telefon || '',
      m.geschlecht || '',
      m.verified_at || '',
      m.updated_data ? 'Ja' : 'Nein',
      m.created_at,
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(';');
  });
  
  // Add UTF-8 BOM for proper Excel handling of German umlauts
  const BOM = '\uFEFF';
  return BOM + [headers.join(';'), ...rows].join('\n');
}

/**
 * Render 404 page for invalid tokens
 */
function renderNotFoundPage(): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ungültiger Link - SV 1945 Untereuerheim</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #1a1a1a 0%, #8B0000 100%);
      margin: 0;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      background: white;
      border-radius: 10px;
      padding: 40px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    h1 {
      color: #DC143C;
      margin-bottom: 20px;
    }
    p {
      color: #666;
      line-height: 1.6;
      margin-bottom: 15px;
    }
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
    }
    .logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .contact {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 14px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo"><img src="${CLUB_LOGO}" alt="SV Untereuerheim Logo"></div>
    <h1>Ungültiger Verifizierungslink</h1>
    <p>Der von Ihnen verwendete Link ist leider nicht mehr gültig oder wurde bereits verwendet.</p>
    <p>Bitte überprüfen Sie, ob Sie den vollständigen Link aus Ihrem Schreiben verwendet haben.</p>
    <div class="contact">
      <p>Bei Fragen kontaktieren Sie uns:<br>
      <strong>info@sv-untereuerheim.de</strong><br>
      Tel.: 09729/432</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Render member verification page
 */
function renderVerificationPage(member: Member): string {
  const hasUpdates = member.updated_data !== null;
  const isVerified = member.verified_at !== null;
  
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mitgliedsdaten - SV 1945 Untereuerheim</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #1a1a1a 0%, #8B0000 100%);
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #f0f0f0;
    }
    .header-logo {
      width: 60px;
      height: 60px;
    }
    .header-logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .header-text h1 {
      color: #DC143C;
      margin-bottom: 5px;
      font-size: 24px;
    }
    .header-text .subtitle {
      color: #666;
      font-size: 14px;
    }
    h2 {
      color: #333;
      margin-top: 30px;
      margin-bottom: 15px;
      font-size: 18px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      color: #333;
      font-weight: 500;
    }
    input, textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-size: 16px;
      font-family: inherit;
    }
    input:focus, textarea:focus {
      outline: none;
      border-color: #DC143C;
    }
    .btn {
      background: #DC143C;
      color: white;
      border: none;
      padding: 15px 30px;
      border-radius: 5px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      margin-top: 20px;
    }
    .btn:hover {
      background: #B22222;
    }
    .btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .success {
      background: #10b981;
      color: white;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
      text-align: center;
    }
    .status {
      background: #fff5f5;
      border-left: 4px solid #DC143C;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 5px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #999;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-logo">
        <img src="${CLUB_LOGO}" alt="SV Untereuerheim Logo">
      </div>
      <div class="header-text">
        <h1>SV 1945 Untereuerheim e.V.</h1>
        <p class="subtitle">Ihre Mitgliedsdaten</p>
      </div>
    </div>
    
    ${isVerified ? '<div class="success">✓ Ihre Daten wurden bereits verifiziert</div>' : ''}
    
    <div class="status">
      <strong>${member.vorname} ${member.nachname}</strong><br>
      ${member.mitgl_nr ? `Mitgliedsnummer: ${member.mitgl_nr}<br>` : ''}
      Erstellt: ${new Date(member.created_at).toLocaleDateString('de-DE')}
    </div>
    
    <form id="verificationForm">
      <h2>Persönliche Daten</h2>
      
      <div class="form-group">
        <label for="vorname">Vorname</label>
        <input type="text" id="vorname" name="vorname" value="${member.vorname}" required>
      </div>
      
      <div class="form-group">
        <label for="nachname">Nachname</label>
        <input type="text" id="nachname" name="nachname" value="${member.nachname}" required>
      </div>
      
      <h2>Adresse</h2>
      
      <div class="form-group">
        <label for="strasse">Straße und Hausnummer</label>
        <input type="text" id="strasse" name="strasse" value="${member.strasse}" required>
      </div>
      
      <div class="form-group">
        <label for="plz">Postleitzahl</label>
        <input type="text" id="plz" name="plz" value="${member.plz}" required>
      </div>
      
      <div class="form-group">
        <label for="ort">Ort</label>
        <input type="text" id="ort" name="ort" value="${member.ort}" required>
      </div>
      
      <h2>Kontaktdaten</h2>
      
      <div class="form-group">
        <label for="email">E-Mail</label>
        <input type="email" id="email" name="email" value="${member.email || ''}">
      </div>
      
      <div class="form-group">
        <label for="telefon">Telefon</label>
        <input type="tel" id="telefon" name="telefon" value="${member.telefon || ''}">
      </div>
      
      <button type="submit" class="btn" id="submitBtn">Daten bestätigen und speichern</button>
    </form>
    
    <div class="footer">
      <p>SV 1945 Untereuerheim e.V.<br>
      info@sv-untereuerheim.de · Tel.: 09729/432</p>
    </div>
  </div>
  
  <script>
    document.getElementById('verificationForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.textContent = 'Wird gespeichert...';
      
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());
      
      try {
        const response = await fetch('/api/verify/${member.token}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        
        if (response.ok) {
          btn.textContent = '✓ Gespeichert!';
          btn.style.background = '#10b981';
          setTimeout(() => {
            btn.textContent = 'Daten bestätigen und speichern';
            btn.style.background = '#667eea';
            btn.disabled = false;
          }, 3000);
        } else {
          throw new Error('Server error');
        }
      } catch (error) {
        btn.textContent = 'Fehler beim Speichern';
        btn.style.background = '#ef4444';
        setTimeout(() => {
          btn.textContent = 'Daten bestätigen und speichern';
          btn.style.background = '#667eea';
          btn.disabled = false;
        }, 3000);
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Render admin panel
 */
function renderAdminPage(stats: any, members: Member[]): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Panel - SV 1945 Untereuerheim</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f7fa;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 30px;
    }
    .header-logo {
      width: 50px;
      height: 50px;
    }
    .header-logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    h1 {
      color: #333;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stat-value {
      font-size: 36px;
      font-weight: bold;
      color: #DC143C;
    }
    .stat-label {
      color: #666;
      margin-top: 5px;
    }
    .controls {
      background: white;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 20px;
      display: flex;
      gap: 15px;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .search-box {
      flex: 1;
      padding: 10px 15px;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-size: 16px;
    }
    .btn {
      background: #DC143C;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    .btn:hover {
      background: #B22222;
    }
    .table-container {
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #f8f9fa;
      padding: 15px;
      text-align: left;
      font-weight: 600;
      color: #333;
      border-bottom: 2px solid #e9ecef;
    }
    td {
      padding: 12px 15px;
      border-bottom: 1px solid #e9ecef;
    }
    tr:hover {
      background: #f8f9fa;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-success {
      background: #d1fae5;
      color: #065f46;
    }
    .badge-warning {
      background: #fef3c7;
      color: #92400e;
    }
    .has-updates {
      color: #DC143C;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-logo">
        <img src="${CLUB_LOGO}" alt="SV Untereuerheim Logo">
      </div>
      <h1>Admin Panel - SV 1945 Untereuerheim</h1>
    </div>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">Gesamt</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.verified}</div>
        <div class="stat-label">Verifiziert</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.pending}</div>
        <div class="stat-label">Ausstehend</div>
      </div>
    </div>
    
    <div class="controls">
      <input type="text" id="searchBox" class="search-box" placeholder="Suche nach Name, Ort oder Mitgliedsnummer...">
      <a href="/admin/export/csv" class="btn">CSV Export</a>
    </div>
    
    <div class="table-container">
      <table id="membersTable">
        <thead>
          <tr>
            <th>Nr.</th>
            <th>Name</th>
            <th>Ort</th>
            <th>E-Mail</th>
            <th>Telefon</th>
            <th>Status</th>
            <th>Änderungen</th>
            <th>Erstellt</th>
          </tr>
        </thead>
        <tbody>
          ${members.map(m => {
            // Merge original data with updates
            const data = m.updated_data ? { ...m, ...m.updated_data } : m;
            return `
            <tr data-search="${m.vorname} ${m.nachname} ${m.ort} ${m.mitgl_nr || ''}">
              <td>${m.mitgl_nr || '-'}</td>
              <td><strong>${data.vorname} ${data.nachname}</strong><br><small>${data.strasse}, ${data.plz} ${data.ort}</small></td>
              <td>${data.ort}</td>
              <td>${data.email || '-'}</td>
              <td>${data.telefon || '-'}</td>
              <td>
                ${m.verified_at 
                  ? '<span class="badge badge-success">Verifiziert</span>' 
                  : '<span class="badge badge-warning">Ausstehend</span>'}
              </td>
              <td>
                ${m.updated_data 
                  ? '<span class="has-updates">✓ Ja</span>' 
                  : '-'}
              </td>
              <td>${new Date(m.created_at).toLocaleDateString('de-DE')}</td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  </div>
  
  <script>
    // Client-side search filtering
    document.getElementById('searchBox').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('#membersTable tbody tr');
      
      rows.forEach(row => {
        const searchText = row.getAttribute('data-search').toLowerCase();
        row.style.display = searchText.includes(query) ? '' : 'none';
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle CORS preflight
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;
    
    // Route: GET /verify/:token
    if (path.startsWith('/verify/') && request.method === 'GET') {
      const token = path.split('/')[2];
      if (!token) {
        return new Response('Bad Request', { status: 400 });
      }
      return await handleVerifyPage(token, env);
    }
    
    // Route: POST /api/verify/:token
    if (path.startsWith('/api/verify/') && request.method === 'POST') {
      const token = path.split('/')[3];
      if (!token) {
        return new Response('Bad Request', { status: 400 });
      }
      const response = await handleVerifyUpdate(token, request, env);
      return addCORSHeaders(response);
    }
    
    // Route: GET /admin
    if (path === '/admin' && request.method === 'GET') {
      if (!checkAuth(request, env)) {
        return requireAuth();
      }
      return await handleAdminPanel(env);
    }
    
    // Route: GET /admin/export/csv
    if (path === '/admin/export/csv' && request.method === 'GET') {
      if (!checkAuth(request, env)) {
        return requireAuth();
      }
      return await handleAdminExport(env);
    }
    
    // Default: 404
    return new Response('Not Found', { status: 404 });
  },
};
