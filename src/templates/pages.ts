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
    <link rel="icon" type="image/png" href="https://sv-untereuerheim.de/wp-content/uploads/2024/11/logo_svu-241x300.png">
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
    <link rel="icon" type="image/png" href="https://sv-untereuerheim.de/wp-content/uploads/2024/11/logo_svu-241x300.png">
    <link href="https://unpkg.com/tabulator-tables@6.2.5/dist/css/tabulator.min.css" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container { max-width: 1800px; margin: 0 auto; }
        .header {
            background: linear-gradient(135deg, #CC0000 0%, #000000 100%);
            color: white;
            padding: 30px 40px;
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
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .actions {
            background: white;
            padding: 20px 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .action-btn {
            padding: 12px 24px;
            background: #CC0000;
            color: white;
            border: none;
            border-radius: 6px;
            text-decoration: none;
            display: inline-block;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.3s;
        }
        .action-btn:hover {
            background: #990000;
        }
        .action-btn.secondary {
            background: #666;
        }
        .action-btn.secondary:hover {
            background: #444;
        }
        .action-btn.icon {
            padding: 12px 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .action-btn.icon svg {
            width: 18px;
            height: 18px;
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

        <div class="actions">
            <button id="generatePdfsBtn" class="action-btn" disabled>PDFs für ausgewählte Mitglieder generieren (<span id="selectedCount">0</span>)</button>
            <a href="/letters/preview/demo" class="action-btn secondary" target="_blank">Brief-Vorschau</a>
            <button id="refreshBtn" class="action-btn secondary icon" title="Tabelle aktualisieren">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
            </button>
        </div>

        <div class="content">
            <div class="info" id="tableInfo">
                <strong>Mitgliederdatenbank</strong> - Lade Daten...
            </div>
            <div id="data-table"></div>
        </div>

        <div class="content" style="margin-top: 30px;">
            <div class="info" id="changesInfo">
                <strong>Änderungsprotokoll</strong> - Zeigt die letzten Änderungen von Mitgliedern
            </div>
            <div id="changes-table"></div>
        </div>
    </div>

    <script src="https://unpkg.com/tabulator-tables@6.2.5/dist/js/tabulator.min.js"></script>
    <script>
        const columnNames = ['MitglNr', 'Anrede', 'Vorname', 'Nachname', 'Firma', 'Strasse', 'PLZ', 'Ort', 'Telefon', 'Geburtsdatum', 'IBAN', 'BIC', 'Fax', 'Mobil', 'EMail', 'Nationalitaet', 'Geschlecht', 'Familienstand', 'Beruf', 'Bankbezeichnung', 'Eintritt', 'Austritt', 'Abteilung', 'Funktionen', 'MandatsNr', 'Alter', 'Kurzname'];
        let table = null;
        let changesTable = null;

        async function init() {
            try {
                document.getElementById('tableInfo').innerHTML = 
                    '<strong>Mitgliederdatenbank</strong> - Daten werden geladen...';

                // Load all data and access stats in parallel
                const [dataResponse, statsResponse] = await Promise.all([
                    fetch('/api/data?page=1&limit=10000'),
                    fetch('/api/access-stats')
                ]);
                
                if (!dataResponse.ok) throw new Error(await dataResponse.text());
                
                const data = await dataResponse.json();
                const accessStats = statsResponse.ok ? await statsResponse.json() : {};
                
                document.getElementById('tableInfo').innerHTML = 
                    '<strong>Mitgliederdatenbank</strong> - ' + data.data.length + ' Mitglieder';

                // Enrich data with access information
                const enrichedData = data.data.map(member => {
                    const memberId = member.AdrNr || member.MitglNr;
                    const stats = accessStats[memberId];
                    return {
                        ...member,
                        Letzter_Zugriff: stats?.last_accessed || null,
                        Zugriffe: stats?.access_count || 0
                    };
                });

                // Add selection column and access columns
                const columns = [
                    {
                        formatter: "rowSelection",
                        titleFormatter: "rowSelection",
                        titleFormatterParams: {
                            rowRange: "active"
                        },
                        hozAlign: "center",
                        headerSort: false,
                        cellClick: function(e, cell) {
                            cell.getRow().toggleSelect();
                        }
                    },
                    ...columnNames.map(col => ({
                        title: col,
                        field: col,
                        headerFilter: "input",
                        headerFilterPlaceholder: "Filter...",
                    })),
                    {
                        title: "Letzter Zugriff",
                        field: "Letzter_Zugriff",
                        headerFilter: "input",
                        formatter: function(cell) {
                            const value = cell.getValue();
                            if (!value) return '<span style="color: #999;">Nie</span>';
                            const date = new Date(value);
                            return date.toLocaleString('de-DE', { 
                                year: 'numeric', 
                                month: '2-digit', 
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        },
                        sorter: "datetime",
                    },
                    {
                        title: "Zugriffe",
                        field: "Zugriffe",
                        hozAlign: "center",
                        width: 100,
                        formatter: function(cell) {
                            const value = cell.getValue();
                            if (value === 0) return '<span style="color: #999;">0</span>';
                            return '<span style="color: #28a745; font-weight: 600;">' + value + '</span>';
                        },
                        sorter: "number",
                    }
                ];

                table = new Tabulator("#data-table", {
                    data: enrichedData,
                    columns: columns,
                    layout: "fitDataTable",
                    pagination: true,
                    paginationSize: 100,
                    paginationSizeSelector: [50, 100, 200, 500],
                    movableColumns: true,
                    resizableColumns: true,
                    selectable: true,
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

                // Update button state on selection change
                table.on("rowSelectionChanged", function(data, rows) {
                    const count = rows.length;
                    document.getElementById('selectedCount').textContent = count;
                    document.getElementById('generatePdfsBtn').disabled = count === 0;
                });

                // Load change history
                await loadChangeHistory();

            } catch (error) {
                document.getElementById('tableInfo').innerHTML = 
                    '<div style="background: #ffe7e7; color: #c00; padding: 15px; border-radius: 4px;">Fehler: ' + error.message + '</div>';
            }
        }

        async function loadChangeHistory() {
            try {
                document.getElementById('changesInfo').innerHTML = 
                    '<strong>Änderungsprotokoll</strong> - Lade Daten...';

                const response = await fetch('/api/change-history');
                if (!response.ok) throw new Error('Fehler beim Laden der Änderungen');
                
                const data = await response.json();
                const changes = data.changes || [];

                document.getElementById('changesInfo').innerHTML = 
                    '<strong>Änderungsprotokoll</strong> - ' + changes.length + ' Änderungen';

                changesTable = new Tabulator("#changes-table", {
                    data: changes,
                    layout: "fitDataTable",
                    pagination: true,
                    paginationSize: 50,
                    paginationSizeSelector: [20, 50, 100, 200],
                    columns: [
                        { title: "Zeitpunkt", field: "changed_at", width: 160, formatter: function(cell) {
                            const value = cell.getValue();
                            if (!value) return '';
                            const date = new Date(value + 'Z'); // Assume UTC
                            return date.toLocaleString('de-DE', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        }},
                        { title: "Mitglieds-ID", field: "member_id", width: 120 },
                        { title: "Name", field: "Nachname", width: 150, formatter: function(cell) {
                            const row = cell.getRow().getData();
                            return (row.Vorname || '') + ' ' + (row.Nachname || '');
                        }},
                        { title: "E-Mail", field: "EMail", width: 200 },
                        { title: "Feld", field: "field_name", width: 150 },
                        { title: "Alter Wert", field: "old_value", width: 200, formatter: function(cell) {
                            const value = cell.getValue();
                            return value || '<leer>';
                        }},
                        { title: "Neuer Wert", field: "new_value", width: 200, formatter: function(cell) {
                            const value = cell.getValue();
                            return value || '<leer>';
                        }},
                        { title: "IP-Adresse", field: "ip_address", width: 130 },
                    ],
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
                document.getElementById('changesInfo').innerHTML = 
                    '<div style="background: #ffe7e7; color: #c00; padding: 15px; border-radius: 4px;">Fehler beim Laden der Änderungen: ' + error.message + '</div>';
            }
        }

        // Handle PDF generation
        document.getElementById('generatePdfsBtn').addEventListener('click', async function() {
            if (!table) return;

            const selectedRows = table.getSelectedData();
            if (selectedRows.length === 0) {
                alert('Bitte wählen Sie mindestens ein Mitglied aus.');
                return;
            }

            const btn = this;
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = '⏳ PDFs werden generiert...';

            try {
                // Extract member IDs (use AdrNr or MitglNr)
                const memberIds = selectedRows.map(row => row.AdrNr || row.MitglNr).filter(id => id);

                const response = await fetch('/letters/generate-pdfs', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ memberIds })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Fehler beim Generieren der PDFs');
                }

                // Download the ZIP file
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'serienbriefe_' + new Date().toISOString().split('T')[0] + '.zip';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                alert('PDFs erfolgreich generiert und heruntergeladen!');
            } catch (error) {
                alert('Fehler: ' + error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });

        // Handle table refresh
        document.getElementById('refreshBtn').addEventListener('click', async function() {
            const btn = this;
            btn.disabled = true;
            btn.style.opacity = '0.5';
            
            try {
                await init();
            } catch (error) {
                alert('Fehler beim Aktualisieren: ' + error.message);
            } finally {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        });

        init();
    </script>
</body>
</html>`;
}
