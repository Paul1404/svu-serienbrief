/**
 * HTML page templates
 */

import { escapeHtml } from '../utils/helpers';

export function renderLoginPage(error?: string): string {
    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SV 1945 Untereuerheim - Login</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #CC0000 0%, #000000 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 400px;
        }
        h1 {
            color: #CC0000;
            margin-bottom: 10px;
            font-size: 24px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .logo {
            text-align: center;
            margin-bottom: 20px;
        }
        .logo img {
            max-width: 120px;
            height: auto;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
            font-size: 14px;
        }
        input[type="password"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input[type="password"]:focus {
            outline: none;
            border-color: #CC0000;
        }
        button {
            width: 100%;
            padding: 12px;
            background: #CC0000;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s;
        }
        button:hover {
            background: #990000;
        }
        .error {
            background: #ffe7e7;
            color: #c00;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            border-left: 4px solid #c00;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <img src="https://sv-untereuerheim.de/wp-content/uploads/2024/11/logo_svu-241x300.png" alt="SV Untereuerheim Logo" />
        </div>
        <h1>SV 1945 Untereuerheim e.V.</h1>
        <div class="subtitle">Mitgliederverwaltung</div>
        
        ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
        
        <form method="POST" action="/login">
            <div class="form-group">
                <label for="password">Passwort</label>
                <input 
                    type="password" 
                    id="password" 
                    name="password" 
                    required 
                    autofocus
                    autocomplete="current-password"
                />
            </div>
            <button type="submit">Anmelden</button>
        </form>
    </div>
</body>
</html>`;
}

export function renderDashboard(): string {
	return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SV 1945 Untereuerheim - Mitgliederverwaltung</title>
    <link href="https://unpkg.com/tabulator-tables@6.2.5/dist/css/tabulator.min.css" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            background: linear-gradient(135deg, #CC0000 0%, #000000 100%);
            color: white;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .header-left { 
            flex: 1; 
            display: flex;
            align-items: center;
            gap: 20px;
        }
        .header-logo {
            width: 60px;
            height: auto;
        }
        .header-text { flex: 1; }
        .header-left h1 { margin-bottom: 5px; }
        .subtitle { opacity: 0.9; font-size: 14px; }
        .logout-btn {
            padding: 10px 20px;
            background: white;
            color: #CC0000;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            font-weight: 600;
            font-size: 14px;
        }
        .logout-btn:hover { background: #f0f0f0; }
        .content {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .info {
            background: #fff3cd;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border-left: 4px solid #CC0000;
            color: #000;
        }
        #data-table { margin-top: 20px; }
        .tabulator {
            font-size: 14px;
            border: 1px solid #ddd;
        }
        .tabulator .tabulator-header {
            background: #f8f9fa;
            border-bottom: 2px solid #CC0000;
        }
        .tabulator .tabulator-header .tabulator-col {
            background: #f8f9fa;
            border-right: 1px solid #ddd;
        }
        .tabulator .tabulator-header .tabulator-col-content {
            padding: 12px;
        }
        .tabulator-row {
            min-height: 40px;
        }
        .tabulator-row.tabulator-row-even {
            background-color: #f8f9fa;
        }
        .tabulator-row:hover {
            background-color: #fff3cd !important;
        }
        .tabulator-cell {
            padding: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-left">
                <img src="https://sv-untereuerheim.de/wp-content/uploads/2024/11/logo_svu-241x300.png" alt="SVU Logo" class="header-logo" />
                <div class="header-text">
                    <h1>SV 1945 Untereuerheim e.V.</h1>
                    <div class="subtitle">Mitgliederverwaltung • "Wir sind Untereuerheim"</div>
                </div>
            </div>
            <a href="/logout" class="logout-btn">Abmelden</a>
        </div>

        <div class="content">
            <div class="info" id="tableInfo">
                <strong>Mitgliederdatenbank</strong> — Lade Daten...
            </div>
            <div id="data-table"></div>
        </div>
    </div>

    <script src="https://unpkg.com/tabulator-tables@6.2.5/dist/js/tabulator.min.js"></script>
    <script>
        const columnNames = ['AdrNr', 'Vorname', 'Nachname', 'Strasse', 'PLZ', 'Ort', 'Telefon1', 'Telefon3', 'Geburtsdatum', 'Eintritt', 'Austritt', 'mandatsrefenz', 'IBAN1', 'BIC1', 'Bank1', 'Anrede', 'Firma1', 'LKZ', 'Aktiv', 'Mitglied'];

        async function init() {
            try {
                document.getElementById('tableInfo').innerHTML = 
                    '<strong>Mitgliederdatenbank</strong> — Daten werden geladen...';

                // Load all data at once for client-side filtering and pagination
                const response = await fetch('/api/data?page=1&limit=10000');
                if (!response.ok) throw new Error(await response.text());
                const data = await response.json();
                
                document.getElementById('tableInfo').innerHTML = 
                    '<strong>Mitgliederdatenbank</strong> — ' + data.data.length + ' Mitglieder';

                const columns = columnNames.map(col => ({
                    title: col,
                    field: col,
                    headerFilter: "input",
                    headerFilterPlaceholder: "Filter...",
                }));

                new Tabulator("#data-table", {
                    data: data.data,
                    columns: columns,
                    layout: "fitDataFill",
                    pagination: true,
                    paginationSize: 50,
                    paginationSizeSelector: [25, 50, 100, 200],
                    movableColumns: true,
                    resizableColumns: true,
                    langs: {
                        "de": {
                            "pagination": {
                                "first": "Erste",
                                "first_title": "Erste Seite",
                                "last": "Letzte",
                                "last_title": "Letzte Seite",
                                "prev": "Zurück",
                                "prev_title": "Vorherige Seite",
                                "next": "Weiter",
                                "next_title": "Nächste Seite",
                                "page_size": "Einträge pro Seite",
                            },
                        }
                    },
                    locale: "de",
                });
            } catch (error) {
                document.getElementById('tableInfo').innerHTML = 
                    '<div style="background: #ffe7e7; color: #c00; padding: 15px; border-radius: 4px;">Fehler: ' + error.message + '</div>';
            }
        }

        init();
    </script>
</body>
</html>`;
}
