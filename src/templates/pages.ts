/**
 * HTML page templates
 */

import { escapeHtml } from '../utils/helpers';

export function renderLoginPage(options?: { error?: string; sessionExpired?: boolean }): string {
    const { error, sessionExpired } = options || {};
    
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
        .info {
            background: #fff8e6;
            color: #856404;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            border-left: 4px solid #ffc107;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .info-icon {
            font-size: 18px;
            flex-shrink: 0;
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
        
        ${sessionExpired ? `<div class="info"><span class="info-icon">⏱️</span><span>Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.</span></div>` : ''}
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
    <link href="https://cdn.datatables.net/2.3.6/css/dataTables.dataTables.min.css" rel="stylesheet">
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
        .validity-selector {
            display: flex;
            align-items: center;
            gap: 8px;
            background: white;
            padding: 8px 14px;
            border-radius: 6px;
            border: 2px solid #e0e0e0;
        }
        .validity-selector label {
            font-size: 13px;
            color: #666;
            white-space: nowrap;
        }
        .validity-selector select {
            padding: 6px 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 600;
            color: #333;
            background: #f8f8f8;
            cursor: pointer;
        }
        .validity-selector select:focus {
            outline: none;
            border-color: #CC0000;
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
        .dataTables_wrapper {
            font-size: 14px;
        }
        table.dataTable {
            border: 1px solid #ddd;
            width: 100% !important;
        }
        table.dataTable thead th {
            background: #f8f9fa;
            border-bottom: 2px solid #CC0000;
            padding: 12px;
            font-weight: 600;
        }
        table.dataTable tbody td {
            padding: 10px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 300px;
        }
        table.dataTable tbody tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        table.dataTable tbody tr:hover {
            background-color: #fff3cd !important;
        }
        table.dataTable tbody tr.selected {
            background-color: #d4edda !important;
        }
        .dataTables_filter input {
            padding: 6px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-left: 8px;
        }
        .dataTables_length select {
            padding: 6px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin: 0 8px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 4px solid #CC0000;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #CC0000;
            margin: 10px 0;
        }
        .stat-label {
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .stat-detail {
            color: #999;
            font-size: 12px;
            margin-top: 8px;
        }
        .top-fields {
            margin-top: 10px;
        }
        .field-item {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #eee;
        }
        .field-item:last-child {
            border-bottom: none;
        }
        .danger-zone {
            background: #fff3f3;
            border: 1px solid #ffcccc;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .danger-zone h3 {
            color: #c00;
            margin-bottom: 10px;
            font-size: 16px;
        }
        .danger-btn {
            background: #dc3545;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
        }
        .danger-btn:hover {
            background: #c82333;
        }
        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            max-width: 500px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            border-left: 4px solid #CC0000;
        }
        .toast.success {
            border-left-color: #28a745;
        }
        .toast.error {
            border-left-color: #dc3545;
        }
        .toast.warning {
            border-left-color: #ffc107;
        }
        .toast-icon {
            font-size: 24px;
            flex-shrink: 0;
        }
        .toast-message {
            flex: 1;
            color: #333;
        }
        .toast-close {
            cursor: pointer;
            opacity: 0.5;
            font-size: 20px;
            flex-shrink: 0;
        }
        .toast-close:hover {
            opacity: 1;
        }
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }
        .modal {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            max-width: 500px;
            width: 90%;
        }
        .modal h3 {
            margin: 0 0 15px 0;
            color: #333;
        }
        .modal p {
            margin: 0 0 20px 0;
            color: #666;
        }
        .modal-buttons {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        .modal-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
        }
        .modal-btn.primary {
            background: #dc3545;
            color: white;
        }
        .modal-btn.primary:hover {
            background: #c82333;
        }
        .modal-btn.secondary {
            background: #6c757d;
            color: white;
        }
        .modal-btn.secondary:hover {
            background: #5a6268;
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
            <div class="validity-selector">
                <label for="validityDays">Token gültig:</label>
                <select id="validityDays">
                    <option value="30">30 Tage</option>
                    <option value="60">60 Tage</option>
                    <option value="90" selected>90 Tage</option>
                    <option value="180">180 Tage</option>
                    <option value="365">1 Jahr</option>
                </select>
            </div>
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
            <table id="data-table" class="display" style="width:100%"></table>
        </div>

        <div class="content" style="margin-top: 30px;">
            <div class="info" id="changesInfo">
                <strong>Änderungsprotokoll</strong> - Zeigt die letzten Änderungen von Mitgliedern
            </div>
            <table id="changes-table" class="display" style="width:100%"></table>
        </div>

        <div class="content" style="margin-top: 30px;">
            <h2 style="margin-bottom: 20px;">Token Status</h2>
            <div id="tokenInfo" class="info">Lade Token-Informationen...</div>
            <table id="token-table" class="display" style="width:100%"></table>
        </div>

        <div class="content" style="margin-top: 30px;">
            <h2 style="margin-bottom: 20px;">Statistik Dashboard</h2>
            <div id="statsInfo" class="info">Lade Statistiken...</div>
            <div id="stats-dashboard"></div>
            
            <div class="danger-zone">
                <h3>Gefahrenzone</h3>
                <p style="margin-bottom: 10px; color: #666;">Löscht alle Änderungen und Zugriffsprotokolle permanent. Diese Aktion kann nicht rückgängig gemacht werden.</p>
                <button id="clearHistoryBtn" class="danger-btn">Verlauf und Statistiken löschen</button>
            </div>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.datatables.net/2.3.6/js/dataTables.min.js"></script>
    <script>
        const columnNames = ['MitglNr', 'Anrede', 'Vorname', 'Nachname', 'Firma', 'Strasse', 'PLZ', 'Ort', 'Telefon', 'Geburtsdatum', 'IBAN', 'BIC', 'Fax', 'Mobil', 'EMail', 'Nationalitaet', 'Geschlecht', 'Familienstand', 'Beruf', 'Bankbezeichnung', 'Eintritt', 'Austritt', 'Abteilung', 'Funktionen', 'MandatsNr', 'Alter', 'Kurzname'];
        let table = null;
        let changesTable = null;
        let selectedRows = new Set();

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

                // Build columns for DataTables
                const columns = [
                    {
                        title: '<input type="checkbox" id="selectAll">',
                        data: null,
                        orderable: false,
                        searchable: false,
                        className: 'dt-center',
                        width: '40px',
                        render: function(data, type, row) {
                            const memberId = row.AdrNr || row.MitglNr;
                            return '<input type="checkbox" class="row-select" data-id="' + memberId + '">';
                        }
                    },
                    ...columnNames.map(col => {
                        const config = {
                            title: col,
                            data: col
                        };
                        // Set minimum widths for specific columns
                        if (col === 'IBAN') config.width = '180px';
                        else if (col === 'BIC') config.width = '100px';
                        else if (col === 'EMail') config.width = '200px';
                        else if (col === 'Strasse') config.width = '150px';
                        else if (col === 'Bankbezeichnung') config.width = '150px';
                        else if (col === 'Telefon' || col === 'Mobil' || col === 'Fax') config.width = '120px';
                        else if (col === 'MitglNr' || col === 'AdrNr') config.width = '80px';
                        else if (col === 'PLZ') config.width = '70px';
                        else if (col === 'Vorname' || col === 'Nachname') config.width = '120px';
                        return config;
                    }),
                    {
                        title: 'Letzter Zugriff',
                        data: 'Letzter_Zugriff',
                        width: '140px',
                        render: function(data, type) {
                            if (type === 'display') {
                                if (!data) return '<span style="color: #999;">Nie</span>';
                                const date = new Date(data);
                                return date.toLocaleString('de-DE', { 
                                    year: 'numeric', 
                                    month: '2-digit', 
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                            }
                            return data;
                        }
                    },
                    {
                        title: 'Zugriffe',
                        data: 'Zugriffe',
                        className: 'dt-center',
                        width: '80px',
                        render: function(data, type) {
                            if (type === 'display') {
                                if (data === 0) return '<span style="color: #999;">0</span>';
                                return '<span style="color: #28a745; font-weight: 600;">' + data + '</span>';
                            }
                            return data;
                        }
                    }
                ];

                // Destroy existing table if it exists
                if (table) {
                    table.destroy();
                    $('#data-table').empty();
                }

                // Initialize DataTable
                table = $('#data-table').DataTable({
                    data: enrichedData,
                    columns: columns,
                    pageLength: 100,
                    lengthMenu: [[50, 100, 200, 500], [50, 100, 200, 500]],
                    language: {
                        lengthMenu: 'Zeige _MENU_ Einträge',
                        search: 'Suchen:',
                        info: 'Zeige _START_ bis _END_ von _TOTAL_ Einträgen',
                        infoEmpty: 'Keine Einträge vorhanden',
                        infoFiltered: '(gefiltert von _MAX_ Einträgen)',
                        paginate: {
                            first: 'Erste',
                            last: 'Letzte',
                            next: 'Weiter',
                            previous: 'Zurück'
                        }
                    },
                    order: [[1, 'asc']],
                    scrollX: true
                });

                // Handle select all checkbox
                $('#selectAll').on('click', function() {
                    const isChecked = $(this).prop('checked');
                    $('.row-select:visible').prop('checked', isChecked).each(function() {
                        const id = $(this).data('id');
                        if (isChecked) {
                            selectedRows.add(id);
                        } else {
                            selectedRows.delete(id);
                        }
                    });
                    updateSelectedCount();
                });

                // Handle individual row selection
                $('#data-table').on('change', '.row-select', function() {
                    const id = $(this).data('id');
                    if ($(this).prop('checked')) {
                        selectedRows.add(id);
                    } else {
                        selectedRows.delete(id);
                        $('#selectAll').prop('checked', false);
                    }
                    updateSelectedCount();
                });

                // Load change history
                await loadChangeHistory();
                
                // Load token status
                await loadTokenStatus();
                
                // Load statistics
                await loadStats();

            } catch (error) {
                document.getElementById('tableInfo').innerHTML = 
                    '<div style="background: #ffe7e7; color: #c00; padding: 15px; border-radius: 4px;">Fehler: ' + error.message + '</div>';
            }
        }

        function updateSelectedCount() {
            document.getElementById('selectedCount').textContent = selectedRows.size;
            document.getElementById('generatePdfsBtn').disabled = selectedRows.size === 0;
        }

        async function loadStats() {
            try {
                const response = await fetch('/api/stats');
                if (!response.ok) throw new Error('Fehler beim Laden der Statistiken');
                
                const stats = await response.json();
                
                document.getElementById('statsInfo').style.display = 'none';
                
                const dashboard = document.getElementById('stats-dashboard');
                
                let topFieldsHtml = '';
                if (stats.topFields.length > 0) {
                    const fieldsHtml = stats.topFields.map(field => 
                        '<div class="field-item"><span>' + field.field_name + '</span><span style="font-weight: 600; color: #CC0000;">' + field.count + 'x</span></div>'
                    ).join('');
                    
                    topFieldsHtml = '<div class="stat-card" style="margin-top: 20px;"><div class="stat-label" style="margin-bottom: 15px;">Meist geänderte Felder</div><div class="top-fields">' + fieldsHtml + '</div></div>';
                }
                
                dashboard.innerHTML = '<div class="stats-grid">' +
                    '<div class="stat-card"><div class="stat-label">Gesamt Mitglieder</div><div class="stat-value">' + stats.totalMembers + '</div></div>' +
                    '<div class="stat-card"><div class="stat-label">Portal Zugriffe</div><div class="stat-value">' + stats.membersWithAccess + '</div>' +
                    '<div class="stat-detail">' + stats.accessRate + '% der Mitglieder</div>' +
                    '<div class="stat-detail">' + stats.totalAccesses + ' Gesamt Zugriffe</div></div>' +
                    '<div class="stat-card"><div class="stat-label">Änderungen</div><div class="stat-value">' + stats.totalChanges + '</div>' +
                    '<div class="stat-detail">' + stats.membersWithChanges + ' Mitglieder haben Änderungen vorgenommen</div>' +
                    '<div class="stat-detail">' + stats.changeRate + '% Änderungsrate</div></div>' +
                    '<div class="stat-card"><div class="stat-label">Letzte 7 Tage</div><div class="stat-value">' + stats.recentActivity + '</div>' +
                    '<div class="stat-detail">Änderungen in der letzten Woche</div></div>' +
                    '</div>' + topFieldsHtml;
            } catch (error) {
                showToast('Fehler beim Laden der Statistiken: ' + error.message, 'error');
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

                // Destroy existing table if it exists
                if (changesTable) {
                    changesTable.destroy();
                    $('#changes-table').empty();
                }

                changesTable = $('#changes-table').DataTable({
                    data: changes,
                    columns: [
                        {
                            title: 'Zeitpunkt',
                            data: 'changed_at',
                            render: function(data, type) {
                                if (type === 'display' && data) {
                                    const date = new Date(data + 'Z');
                                    return date.toLocaleString('de-DE', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    });
                                }
                                return data;
                            }
                        },
                        { title: 'Mitglieds-ID', data: 'member_id' },
                        {
                            title: 'Name',
                            data: 'Nachname',
                            render: function(data, type, row) {
                                return (row.Vorname || '') + ' ' + (row.Nachname || '');
                            }
                        },
                        { title: 'E-Mail', data: 'EMail' },
                        { title: 'Feld', data: 'field_name' },
                        {
                            title: 'Alter Wert',
                            data: 'old_value',
                            render: function(data) {
                                return data || '<leer>';
                            }
                        },
                        {
                            title: 'Neuer Wert',
                            data: 'new_value',
                            render: function(data) {
                                return data || '<leer>';
                            }
                        },
                        { title: 'IP-Adresse', data: 'ip_address' }
                    ],
                    pageLength: 50,
                    lengthMenu: [[20, 50, 100, 200], [20, 50, 100, 200]],
                    language: {
                        lengthMenu: 'Zeige _MENU_ Einträge',
                        search: 'Suchen:',
                        info: 'Zeige _START_ bis _END_ von _TOTAL_ Einträgen',
                        infoEmpty: 'Keine Einträge vorhanden',
                        infoFiltered: '(gefiltert von _MAX_ Einträgen)',
                        paginate: {
                            first: 'Erste',
                            last: 'Letzte',
                            next: 'Weiter',
                            previous: 'Zurück'
                        }
                    },
                    order: [[0, 'desc']],
                    scrollX: true
                });

            } catch (error) {
                document.getElementById('changesInfo').innerHTML = 
                    '<div style="background: #ffe7e7; color: #c00; padding: 15px; border-radius: 4px;">Fehler beim Laden der Änderungen: ' + error.message + '</div>';
            }
        }

        let tokenTable = null;
        async function loadTokenStatus() {
            try {
                document.getElementById('tokenInfo').innerHTML = 
                    '<strong>Token Status</strong> - Lade Daten...';

                const response = await fetch('/api/token-status');
                if (!response.ok) throw new Error('Fehler beim Laden der Token');
                
                const data = await response.json();
                const tokens = data.tokens || [];

                document.getElementById('tokenInfo').innerHTML = 
                    '<strong>Token Status</strong> - ' + tokens.length + ' generierte Token';

                // Destroy existing table if it exists
                if (tokenTable) {
                    tokenTable.destroy();
                    $('#token-table').empty();
                }

                tokenTable = $('#token-table').DataTable({
                    data: tokens,
                    columns: [
                        { title: 'Mitglieds-ID', data: 'member_id' },
                        {
                            title: 'Name',
                            data: 'Nachname',
                            render: function(data, type, row) {
                                return (row.Vorname || '') + ' ' + (row.Nachname || '');
                            }
                        },
                        { title: 'E-Mail', data: 'EMail' },
                        {
                            title: 'Erstellt',
                            data: 'generated_at',
                            render: function(data, type) {
                                if (type === 'display' && data) {
                                    const date = new Date(data);
                                    return date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'});
                                }
                                return data;
                            }
                        },
                        {
                            title: 'Status',
                            data: 'is_expired',
                            render: function(data, type, row) {
                                if (type === 'display') {
                                    if (data) {
                                        return '<span style="color: #dc3545; font-weight: 600;">Abgelaufen</span>';
                                    }
                                    const days = row.days_remaining;
                                    const color = days < 7 ? '#ffc107' : days < 30 ? '#17a2b8' : '#28a745';
                                    return '<span style="color: ' + color + '; font-weight: 600;">' + days + ' Tage</span>';
                                }
                                return data;
                            }
                        },
                        {
                            title: 'Neu generiert',
                            data: 'regenerated_count',
                            className: 'dt-center'
                        },
                        {
                            title: 'Aktionen',
                            data: null,
                            orderable: false,
                            render: function(data, type, row) {
                                return '<button class="action-btn regenerate-token" data-id="' + row.member_id + '">Token neu generieren</button>';
                            }
                        }
                    ],
                    pageLength: 50,
                    lengthMenu: [[20, 50, 100, 200], [20, 50, 100, 200]],
                    language: {
                        lengthMenu: 'Zeige _MENU_ Einträge',
                        search: 'Suchen:',
                        info: 'Zeige _START_ bis _END_ von _TOTAL_ Einträgen',
                        infoEmpty: 'Keine Einträge vorhanden',
                        infoFiltered: '(gefiltert von _MAX_ Einträgen)',
                        paginate: {
                            first: 'Erste',
                            last: 'Letzte',
                            next: 'Weiter',
                            previous: 'Zurück'
                        }
                    },
                    order: [[3, 'desc']],
                    scrollX: true
                });

                // Handle token regeneration
                $('#token-table').on('click', '.regenerate-token', async function() {
                    const memberId = $(this).data('id');
                    const btn = $(this);
                    const originalText = btn.text();
                    
                    btn.prop('disabled', true).text('Generiere...');
                    
                    try {
                        const response = await fetch('/api/regenerate-token/' + memberId, {
                            method: 'POST'
                        });
                        
                        if (!response.ok) {
                            const error = await response.json();
                            throw new Error(error.error || 'Fehler beim Generieren');
                        }
                        
                        const result = await response.json();
                        showToast('Token neu generiert! URL: ' + result.updateUrl, 'success');
                        await loadTokenStatus();
                    } catch (error) {
                        showToast('Fehler: ' + error.message, 'error');
                    } finally {
                        btn.prop('disabled', false).text(originalText);
                    }
                });

            } catch (error) {
                document.getElementById('tokenInfo').innerHTML = 
                    '<div style="background: #ffe7e7; color: #c00; padding: 15px; border-radius: 4px;">Fehler beim Laden der Token: ' + error.message + '</div>';
            }
        }

        // Handle PDF generation
        document.getElementById('generatePdfsBtn').addEventListener('click', async function() {
            if (selectedRows.size === 0) {
                showToast('Bitte wählen Sie mindestens ein Mitglied aus.', 'warning');
                return;
            }

            const btn = this;
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = '⏳ PDFs werden generiert...';

            try {
                const memberIds = Array.from(selectedRows);
                const validityDays = parseInt(document.getElementById('validityDays').value, 10);

                const response = await fetch('/letters/generate-pdfs', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ memberIds, validityDays })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Fehler beim Generieren der PDFs');
                }

                // Get filename from Content-Disposition header (server provides detailed timestamp)
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = 'serienbriefe.zip';
                if (contentDisposition) {
                    const match = contentDisposition.match(/filename="(.+)"/);
                    if (match) {
                        filename = match[1];
                    }
                }

                // Download the ZIP file
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                showToast('PDFs erfolgreich generiert und heruntergeladen! (Token gültig für ' + validityDays + ' Tage)', 'success');
            } catch (error) {
                showToast('Fehler: ' + error.message, 'error');
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
                selectedRows.clear();
                await init();
                showToast('Tabelle erfolgreich aktualisiert', 'success');
            } catch (error) {
                showToast('Fehler beim Aktualisieren: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        });

        // Handle clear history
        document.getElementById('clearHistoryBtn').addEventListener('click', async function() {
            const confirmed = await showConfirm(
                'Verlauf löschen', 
                'Sind Sie sicher, dass Sie alle Änderungen und Zugriffsprotokolle löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden!'
            );
            
            if (!confirmed) return;

            const btn = this;
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Lösche...';

            try {
                const response = await fetch('/api/clear-history', {
                    method: 'POST'
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Fehler beim Löschen');
                }

                showToast('Verlauf und Statistiken erfolgreich gelöscht!', 'success');
                await loadChangeHistory();
                await loadStats();
            } catch (error) {
                showToast('Fehler: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });

        init();
    </script>
</body>
</html>`;
}

export interface NotFoundStats {
    // Request info
    requestedPath: string;
    method: string;
    timestamp: string;
    cfRay?: string;
    colo?: string;
    country?: string;
    city?: string;
    
    // D1 Database stats
    totalMembers: number;
    totalTokens: number;
    totalChanges: number;
    totalSessions: number;
    totalAccesses: number;
    
    // Computed stats
    dbQueryTimeMs: number;
    workerCpuTimeMs: number;
}

export function render404Page(stats: NotFoundStats): string {
    const timestamp = new Date(stats.timestamp);
    const formattedTime = timestamp.toLocaleString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
    });
    
    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - Seite nicht gefunden (aber vieles andere schon!) | SV 1945 Untereuerheim</title>
    <link rel="icon" type="image/png" href="https://sv-untereuerheim.de/wp-content/uploads/2024/11/logo_svu-241x300.png">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@400;600;700&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --bg-dark: #0a0a0f;
            --bg-card: #12121a;
            --bg-card-hover: #1a1a25;
            --accent: #CC0000;
            --accent-glow: rgba(204, 0, 0, 0.3);
            --text: #e4e4e7;
            --text-dim: #71717a;
            --success: #22c55e;
            --warning: #eab308;
            --info: #3b82f6;
        }
        
        body {
            font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg-dark);
            min-height: 100vh;
            color: var(--text);
            overflow-x: hidden;
        }
        
        /* Animated grid background */
        .grid-bg {
            position: fixed;
            inset: 0;
            background-image: 
                linear-gradient(rgba(204, 0, 0, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(204, 0, 0, 0.03) 1px, transparent 1px);
            background-size: 50px 50px;
            animation: gridMove 20s linear infinite;
            z-index: -1;
        }
        
        @keyframes gridMove {
            0% { transform: translate(0, 0); }
            100% { transform: translate(50px, 50px); }
        }
        
        /* Glowing orbs */
        .orb {
            position: fixed;
            border-radius: 50%;
            filter: blur(80px);
            opacity: 0.4;
            z-index: -1;
            animation: float 10s ease-in-out infinite;
        }
        
        .orb-1 {
            width: 400px;
            height: 400px;
            background: var(--accent);
            top: -100px;
            right: -100px;
        }
        
        .orb-2 {
            width: 300px;
            height: 300px;
            background: #3b82f6;
            bottom: -50px;
            left: -50px;
            animation-delay: -5s;
        }
        
        @keyframes float {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(30px, -30px) scale(1.1); }
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        
        /* Header section */
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .error-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(204, 0, 0, 0.1);
            border: 1px solid rgba(204, 0, 0, 0.3);
            padding: 8px 16px;
            border-radius: 50px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: var(--accent);
            margin-bottom: 20px;
            animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow); }
            50% { box-shadow: 0 0 20px 5px var(--accent-glow); }
        }
        
        .error-badge::before {
            content: '';
            width: 8px;
            height: 8px;
            background: var(--accent);
            border-radius: 50%;
            animation: blink 1s ease-in-out infinite;
        }
        
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        
        .error-code {
            font-size: 120px;
            font-weight: 700;
            line-height: 1;
            background: linear-gradient(180deg, #fff 0%, #999 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 10px;
        }
        
        h1 {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 15px;
        }
        
        .subtitle {
            color: var(--text-dim);
            font-size: 16px;
            max-width: 500px;
            margin: 0 auto 30px;
            line-height: 1.6;
        }
        
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 14px 28px;
            background: var(--accent);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 15px;
            transition: all 0.2s ease;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px var(--accent-glow);
        }
        
        /* Stats dashboard */
        .dashboard {
            display: grid;
            gap: 20px;
        }
        
        .section-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: var(--text-dim);
            margin: 30px 0 15px;
        }
        
        .section-title::after {
            content: '';
            flex: 1;
            height: 1px;
            background: linear-gradient(90deg, rgba(255,255,255,0.1), transparent);
        }
        
        .cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .card {
            background: var(--bg-card);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 20px;
            transition: all 0.2s ease;
        }
        
        .card:hover {
            background: var(--bg-card-hover);
            border-color: rgba(255,255,255,0.1);
            transform: translateY(-2px);
        }
        
        .card-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-dim);
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .card-value {
            font-family: 'JetBrains Mono', monospace;
            font-size: 28px;
            font-weight: 600;
            color: var(--text);
        }
        
        .card-value.accent { color: var(--accent); }
        .card-value.success { color: var(--success); }
        .card-value.warning { color: var(--warning); }
        .card-value.info { color: var(--info); }
        
        .card-detail {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            color: var(--text-dim);
            margin-top: 8px;
        }
        
        /* Request info panel */
        .request-panel {
            background: var(--bg-card);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 12px;
            overflow: hidden;
        }
        
        .request-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 15px 20px;
            background: rgba(204, 0, 0, 0.1);
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        
        .method-badge {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 4px;
            background: var(--accent);
            color: white;
        }
        
        .request-path {
            font-family: 'JetBrains Mono', monospace;
            font-size: 14px;
            color: var(--text);
            word-break: break-all;
        }
        
        .request-body {
            padding: 15px 20px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 15px;
        }
        
        .request-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .request-item-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-dim);
        }
        
        .request-item-value {
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            color: var(--text);
        }
        
        /* Performance bar */
        .perf-bar {
            display: flex;
            align-items: center;
            gap: 15px;
            background: var(--bg-card);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 15px 20px;
            margin-top: 20px;
        }
        
        .perf-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .perf-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        
        .perf-dot.green { background: var(--success); box-shadow: 0 0 10px var(--success); }
        .perf-dot.yellow { background: var(--warning); box-shadow: 0 0 10px var(--warning); }
        .perf-dot.blue { background: var(--info); box-shadow: 0 0 10px var(--info); }
        
        .perf-label {
            font-size: 12px;
            color: var(--text-dim);
        }
        
        .perf-value {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: var(--text);
        }
        
        /* Footer joke */
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 30px;
            border-top: 1px solid rgba(255,255,255,0.05);
        }
        
        .footer-joke {
            font-size: 13px;
            color: var(--text-dim);
            margin-bottom: 15px;
        }
        
        .footer-logo {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            color: var(--text-dim);
            font-size: 12px;
        }
        
        .footer-logo img {
            width: 30px;
            height: auto;
            opacity: 0.5;
        }
        
        /* Terminal-style timestamp */
        .terminal {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            color: var(--text-dim);
            background: rgba(0,0,0,0.3);
            padding: 10px 15px;
            border-radius: 6px;
            margin-top: 15px;
            display: inline-block;
        }
        
        .terminal::before {
            content: '$ ';
            color: var(--success);
        }
        
        /* Live counter animation */
        @keyframes countUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .card-value {
            animation: countUp 0.5s ease-out;
        }
        
        .cards .card:nth-child(1) .card-value { animation-delay: 0.1s; }
        .cards .card:nth-child(2) .card-value { animation-delay: 0.2s; }
        .cards .card:nth-child(3) .card-value { animation-delay: 0.3s; }
        .cards .card:nth-child(4) .card-value { animation-delay: 0.4s; }
        .cards .card:nth-child(5) .card-value { animation-delay: 0.5s; }
    </style>
</head>
<body>
    <div class="grid-bg"></div>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    
    <div class="container">
        <div class="header">
            <div class="error-badge">HTTP ${escapeHtml(stats.method)} REQUEST FAILED</div>
            <div class="error-code">404</div>
            <h1>Seite nicht gefunden</h1>
            <p class="subtitle">
                Die angeforderte Seite existiert nicht. Aber keine Sorge – 
                wir haben trotzdem <em>sehr wichtige</em> Daten für Sie gesammelt! 🤓
            </p>
            <a href="/" class="btn">
                <span>←</span>
                Zurück zur Startseite
            </a>
            <div class="terminal">render_404_page --with-unnecessary-stats --verbose</div>
        </div>
        
        <div class="dashboard">
            <!-- Failed Request Info -->
            <div class="section-title">📡 Fehlgeschlagene Anfrage</div>
            <div class="request-panel">
                <div class="request-header">
                    <span class="method-badge">${escapeHtml(stats.method)}</span>
                    <span class="request-path">${escapeHtml(stats.requestedPath)}</span>
                </div>
                <div class="request-body">
                    <div class="request-item">
                        <span class="request-item-label">Zeitstempel</span>
                        <span class="request-item-value">${escapeHtml(formattedTime)}</span>
                    </div>
                    <div class="request-item">
                        <span class="request-item-label">CF-Ray</span>
                        <span class="request-item-value">${escapeHtml(stats.cfRay || 'N/A')}</span>
                    </div>
                    <div class="request-item">
                        <span class="request-item-label">Edge Location</span>
                        <span class="request-item-value">${escapeHtml(stats.colo || 'Unknown')} ${stats.country ? `(${escapeHtml(stats.country)})` : ''}</span>
                    </div>
                    <div class="request-item">
                        <span class="request-item-label">Stadt</span>
                        <span class="request-item-value">${escapeHtml(stats.city || 'Unknown')}</span>
                    </div>
                </div>
            </div>
            
            <!-- D1 Database Stats -->
            <div class="section-title">🗄️ D1 Datenbank-Statistiken (völlig unnötig, aber beeindruckend)</div>
            <div class="cards">
                <div class="card">
                    <div class="card-label">👥 Mitglieder</div>
                    <div class="card-value accent">${stats.totalMembers.toLocaleString('de-DE')}</div>
                    <div class="card-detail">registrierte Vereinsmitglieder</div>
                </div>
                <div class="card">
                    <div class="card-label">🎟️ Aktive Tokens</div>
                    <div class="card-value info">${stats.totalTokens.toLocaleString('de-DE')}</div>
                    <div class="card-detail">gültige Zugangstoken</div>
                </div>
                <div class="card">
                    <div class="card-label">📝 Änderungen</div>
                    <div class="card-value warning">${stats.totalChanges.toLocaleString('de-DE')}</div>
                    <div class="card-detail">protokollierte Datenänderungen</div>
                </div>
                <div class="card">
                    <div class="card-label">🔐 Admin-Sessions</div>
                    <div class="card-value success">${stats.totalSessions.toLocaleString('de-DE')}</div>
                    <div class="card-detail">aktive Sitzungen</div>
                </div>
                <div class="card">
                    <div class="card-label">👁️ Portal-Zugriffe</div>
                    <div class="card-value">${stats.totalAccesses.toLocaleString('de-DE')}</div>
                    <div class="card-detail">Mitglieder-Seitenaufrufe</div>
                </div>
            </div>
            
            <!-- Performance -->
            <div class="perf-bar">
                <div class="perf-item">
                    <span class="perf-dot green"></span>
                    <span class="perf-label">DB Query:</span>
                    <span class="perf-value">${stats.dbQueryTimeMs.toFixed(2)}ms</span>
                </div>
                <div class="perf-item">
                    <span class="perf-dot blue"></span>
                    <span class="perf-label">Worker CPU:</span>
                    <span class="perf-value">${stats.workerCpuTimeMs.toFixed(2)}ms</span>
                </div>
                <div class="perf-item">
                    <span class="perf-dot yellow"></span>
                    <span class="perf-label">Status:</span>
                    <span class="perf-value">Overengineered ✓</span>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p class="footer-joke">
                "Wir haben Ihre Seite nicht gefunden, aber immerhin wissen wir jetzt, 
                wie viele Mitglieder wir haben. Das ist doch auch was!" 
                <br>— Unser Backend-Entwickler, wahrscheinlich
            </p>
            <div class="footer-logo">
                <img src="https://sv-untereuerheim.de/wp-content/uploads/2024/11/logo_svu-241x300.png" alt="SVU">
                <span>SV 1945 Untereuerheim e.V. • "Wir sind Untereuerheim"</span>
            </div>
        </div>
    </div>
</body>
</html>`;
}
