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
        
        /* Light mode (default) */
        :root {
            --bg-primary: #f5f5f5;
            --bg-card: #ffffff;
            --bg-input: #ffffff;
            --text-primary: #333333;
            --text-secondary: #666666;
            --text-muted: #999999;
            --border-color: #e0e0e0;
            --border-light: #ddd;
            --shadow-color: rgba(0,0,0,0.1);
            --info-bg: #fff3cd;
            --info-border: #CC0000;
            --table-stripe: #f8f9fa;
            --table-hover: #fff3cd;
            --table-selected: #d4edda;
            --danger-bg: #fff3f3;
            --danger-border: #ffcccc;
        }
        
        /* Dark mode */
        [data-theme="dark"] {
            --bg-primary: #0f0f14;
            --bg-card: #1a1a24;
            --bg-input: #252532;
            --text-primary: #e4e4e7;
            --text-secondary: #a1a1aa;
            --text-muted: #71717a;
            --border-color: #3f3f46;
            --border-light: #27272a;
            --shadow-color: rgba(0,0,0,0.4);
            --info-bg: #27251e;
            --info-border: #CC0000;
            --table-stripe: #1f1f28;
            --table-hover: #2a2820;
            --table-selected: #1a2e1f;
            --danger-bg: #2a1f1f;
            --danger-border: #4a2a2a;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg-primary);
            padding: 20px;
            color: var(--text-primary);
            transition: background 0.3s, color 0.3s;
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
        .header-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .theme-toggle {
            padding: 10px 14px;
            background: rgba(255,255,255,0.15);
            color: white;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 6px;
            cursor: pointer;
            font-size: 18px;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .theme-toggle:hover {
            background: rgba(255,255,255,0.25);
        }
        .content {
            background: var(--bg-card);
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px var(--shadow-color);
            transition: background 0.3s;
        }
        .content h2 {
            color: var(--text-primary);
        }
        .actions {
            background: var(--bg-card);
            padding: 20px 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px var(--shadow-color);
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            transition: background 0.3s;
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
            background: var(--bg-card);
            padding: 8px 14px;
            border-radius: 6px;
            border: 2px solid var(--border-color);
            transition: background 0.3s, border-color 0.3s;
        }
        .validity-selector label {
            font-size: 13px;
            color: var(--text-secondary);
            white-space: nowrap;
        }
        .validity-selector select {
            padding: 6px 10px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary);
            background: var(--bg-input);
            cursor: pointer;
            transition: background 0.3s, color 0.3s, border-color 0.3s;
        }
        .validity-selector select:focus {
            outline: none;
            border-color: #CC0000;
        }
        .info {
            background: var(--info-bg);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border-left: 4px solid var(--info-border);
            color: var(--text-primary);
            transition: background 0.3s, color 0.3s;
        }
        #data-table { margin-top: 20px; }
        .dataTables_wrapper {
            font-size: 14px;
            color: var(--text-primary);
        }
        .dataTables_wrapper label,
        .dataTables_wrapper .dataTables_length label,
        .dataTables_wrapper .dataTables_filter label,
        .dataTables_wrapper .dataTables_info,
        div.dt-container .dt-info,
        div.dt-container .dt-length,
        div.dt-container .dt-search,
        div.dt-container .dt-length label,
        div.dt-container .dt-search label {
            color: var(--text-secondary) !important;
        }
        .dataTables_wrapper select,
        .dataTables_wrapper input,
        div.dt-container select,
        div.dt-container input {
            color: var(--text-primary) !important;
        }
        table.dataTable {
            border: 1px solid var(--border-light) !important;
            width: 100% !important;
        }
        table.dataTable thead th {
            background: var(--table-stripe) !important;
            border-bottom: 2px solid #CC0000 !important;
            padding: 12px;
            font-weight: 600;
            color: var(--text-primary) !important;
        }
        table.dataTable tbody td {
            padding: 10px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 300px;
            color: var(--text-primary);
            background: var(--bg-card);
            border-color: var(--border-light) !important;
        }
        table.dataTable tbody tr:nth-child(even) td {
            background-color: var(--table-stripe) !important;
        }
        table.dataTable tbody tr:hover td {
            background-color: var(--table-hover) !important;
        }
        table.dataTable tbody tr.selected td {
            background-color: var(--table-selected) !important;
        }
        .dataTables_filter input {
            padding: 6px 12px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            margin-left: 8px;
            background: var(--bg-input);
            color: var(--text-primary);
        }
        .dataTables_length select {
            padding: 6px 12px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            margin: 0 8px;
            background: var(--bg-input);
            color: var(--text-primary);
        }
        .dataTables_info, .dataTables_paginate {
            color: var(--text-secondary) !important;
        }
        .dataTables_paginate .paginate_button,
        .dataTables_paginate .paginate_button.disabled,
        .dataTables_paginate .paginate_button.disabled:hover {
            color: var(--text-primary) !important;
            background: transparent !important;
            border: 1px solid var(--border-color) !important;
        }
        .dataTables_paginate .paginate_button.disabled,
        .dataTables_paginate .paginate_button.disabled:hover {
            color: var(--text-muted) !important;
            cursor: default;
        }
        .dataTables_paginate .paginate_button.current,
        .dataTables_paginate .paginate_button.current:hover {
            background: #CC0000 !important;
            color: white !important;
            border-color: #CC0000 !important;
        }
        .dataTables_paginate .paginate_button:hover:not(.disabled):not(.current) {
            background: var(--table-hover) !important;
            color: var(--text-primary) !important;
            border-color: var(--border-color) !important;
        }
        .dataTables_wrapper .dataTables_paginate .paginate_button {
            color: var(--text-primary) !important;
        }
        .dataTables_wrapper .dataTables_paginate span .paginate_button {
            color: var(--text-primary) !important;
        }
        div.dataTables_wrapper div.dataTables_length label,
        div.dataTables_wrapper div.dataTables_filter label,
        div.dataTables_wrapper div.dataTables_info {
            color: var(--text-secondary) !important;
        }
        /* DataTables 2.x pagination overrides */
        div.dt-container .dt-paging .dt-paging-button {
            color: var(--text-primary) !important;
            background: transparent !important;
            border: 1px solid var(--border-color) !important;
        }
        div.dt-container .dt-paging .dt-paging-button.current {
            background: #CC0000 !important;
            color: white !important;
            border-color: #CC0000 !important;
        }
        div.dt-container .dt-paging .dt-paging-button.disabled {
            color: var(--text-muted) !important;
        }
        div.dt-container .dt-paging .dt-paging-button:hover:not(.disabled):not(.current) {
            background: var(--table-hover) !important;
            color: var(--text-primary) !important;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .stat-card {
            background: var(--bg-card);
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px var(--shadow-color);
            border-left: 4px solid #CC0000;
            transition: background 0.3s;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #CC0000;
            margin: 10px 0;
        }
        .stat-label {
            color: var(--text-secondary);
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .stat-detail {
            color: var(--text-muted);
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
            border-bottom: 1px solid var(--border-light);
            color: var(--text-primary);
        }
        .field-item:last-child {
            border-bottom: none;
        }
        .danger-zone {
            background: var(--danger-bg);
            border: 1px solid var(--danger-border);
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            transition: background 0.3s, border-color 0.3s;
        }
        .danger-zone h3 {
            color: #c00;
            margin-bottom: 10px;
            font-size: 16px;
        }
        .danger-zone p {
            color: var(--text-secondary);
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
            background: var(--bg-card);
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px var(--shadow-color);
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
            color: var(--text-primary);
        }
        .toast-close {
            cursor: pointer;
            opacity: 0.5;
            font-size: 20px;
            flex-shrink: 0;
            color: var(--text-secondary);
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
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }
        .modal {
            background: var(--bg-card);
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 20px var(--shadow-color);
            max-width: 500px;
            width: 90%;
        }
        .modal h3 {
            margin: 0 0 15px 0;
            color: var(--text-primary);
        }
        .modal p {
            margin: 0 0 20px 0;
            color: var(--text-secondary);
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
        
        /* Loading overlay */
        .loading-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            backdrop-filter: blur(4px);
        }
        .loading-card {
            background: var(--bg-card);
            border-radius: 16px;
            padding: 40px 50px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
            max-width: 400px;
            width: 90%;
        }
        .loading-spinner {
            width: 60px;
            height: 60px;
            border: 4px solid var(--border-color);
            border-top-color: #CC0000;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 25px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .loading-title {
            font-size: 20px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 10px;
        }
        .loading-message {
            font-size: 14px;
            color: var(--text-secondary);
            margin-bottom: 20px;
        }
        .loading-progress {
            background: var(--border-color);
            border-radius: 10px;
            height: 8px;
            overflow: hidden;
            margin-bottom: 10px;
        }
        .loading-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #CC0000, #ff4444);
            border-radius: 10px;
            transition: width 0.3s ease;
            animation: progressPulse 1.5s ease-in-out infinite;
        }
        @keyframes progressPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        .loading-stats {
            font-size: 12px;
            color: var(--text-muted);
        }
        .loading-tip {
            margin-top: 20px;
            padding: 12px;
            background: var(--info-bg);
            border-radius: 8px;
            font-size: 12px;
            color: var(--text-secondary);
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
            <div class="header-actions">
                <button id="themeToggle" class="theme-toggle" title="Dark Mode umschalten">🌙</button>
                <a href="/logout" class="logout-btn">Abmelden</a>
            </div>
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
            <a href="/letters/preview/demo" class="action-btn secondary" target="_blank">Demo-Vorschau</a>
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
            <div class="action-bar" style="margin: 15px 0; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <span id="tokenSelectedCount" style="font-weight: 600;">0</span> Token ausgewählt
                <button id="selectAllTokensBtn" class="action-btn secondary">Alle auswählen</button>
                <button id="regenerateTokensBtn" class="action-btn" disabled>Neu generieren</button>
                <button id="deleteTokensBtn" class="action-btn" style="background: #dc3545; border-color: #dc3545;" disabled>Löschen</button>
            </div>
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
        let selectedTokens = new Set();

        // Toast notification system
        function showToast(message, type = 'info') {
            // Remove existing toasts
            document.querySelectorAll('.toast').forEach(t => t.remove());
            
            const icons = {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️'
            };
            
            const toast = document.createElement('div');
            toast.className = 'toast ' + type;
            toast.innerHTML = 
                '<span class="toast-icon">' + icons[type] + '</span>' +
                '<span class="toast-message">' + message + '</span>' +
                '<span class="toast-close">×</span>';
            
            document.body.appendChild(toast);
            
            toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.style.animation = 'slideIn 0.3s ease reverse';
                    setTimeout(() => toast.remove(), 300);
                }
            }, 5000);
        }

        // Confirmation modal
        function showConfirm(title, message) {
            return new Promise((resolve) => {
                const overlay = document.createElement('div');
                overlay.className = 'modal-overlay';
                overlay.innerHTML = 
                    '<div class="modal">' +
                        '<h3>' + title + '</h3>' +
                        '<p>' + message + '</p>' +
                        '<div class="modal-buttons">' +
                            '<button class="modal-btn secondary" data-action="cancel">Abbrechen</button>' +
                            '<button class="modal-btn primary" data-action="confirm">Bestätigen</button>' +
                        '</div>' +
                    '</div>';
                
                document.body.appendChild(overlay);
                
                overlay.addEventListener('click', (e) => {
                    const action = e.target.dataset.action;
                    if (action === 'confirm') {
                        resolve(true);
                        overlay.remove();
                    } else if (action === 'cancel' || e.target === overlay) {
                        resolve(false);
                        overlay.remove();
                    }
                });
            });
        }

        // Loading overlay for long operations
        let loadingOverlay = null;
        
        function showLoading(title, message, showProgress = false) {
            hideLoading();
            
            loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'loading-overlay';
            loadingOverlay.innerHTML = 
                '<div class="loading-card">' +
                    '<div class="loading-spinner"></div>' +
                    '<div class="loading-title">' + title + '</div>' +
                    '<div class="loading-message" id="loadingMessage">' + message + '</div>' +
                    (showProgress ? 
                        '<div class="loading-progress"><div class="loading-progress-bar" id="loadingProgressBar" style="width: 0%"></div></div>' +
                        '<div class="loading-stats" id="loadingStats"></div>' : '') +
                    '<div class="loading-tip">💡 Tipp: Bei vielen Mitgliedern kann dies einige Minuten dauern.</div>' +
                '</div>';
            
            document.body.appendChild(loadingOverlay);
        }
        
        function updateLoading(message, progress = null, stats = null) {
            const msgEl = document.getElementById('loadingMessage');
            if (msgEl) msgEl.textContent = message;
            
            if (progress !== null) {
                const bar = document.getElementById('loadingProgressBar');
                if (bar) bar.style.width = progress + '%';
            }
            
            if (stats !== null) {
                const statsEl = document.getElementById('loadingStats');
                if (statsEl) statsEl.textContent = stats;
            }
        }
        
        function hideLoading() {
            if (loadingOverlay) {
                loadingOverlay.remove();
                loadingOverlay = null;
            }
        }

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

        function updateTokenSelectedCount() {
            document.getElementById('tokenSelectedCount').textContent = selectedTokens.size;
            document.getElementById('regenerateTokensBtn').disabled = selectedTokens.size === 0;
            document.getElementById('deleteTokensBtn').disabled = selectedTokens.size === 0;
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

                // Clear selection when reloading
                selectedTokens.clear();
                updateTokenSelectedCount();

                tokenTable = $('#token-table').DataTable({
                    data: tokens,
                    columns: [
                        {
                            title: '<input type="checkbox" id="selectAllTokens">',
                            data: null,
                            orderable: false,
                            className: 'dt-center',
                            render: function(data, type, row) {
                                const checked = selectedTokens.has(row.member_id) ? 'checked' : '';
                                return '<input type="checkbox" class="token-checkbox" data-id="' + row.member_id + '" ' + checked + '>';
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
                    order: [[4, 'desc']],
                    scrollX: true
                });

                // Handle select all tokens checkbox - selects ALL tokens across all pages
                $('#token-table').on('click', '#selectAllTokens', function() {
                    const isChecked = $(this).prop('checked');
                    
                    // Get all data from DataTable (not just visible rows)
                    const allData = tokenTable.rows().data().toArray();
                    
                    if (isChecked) {
                        // Select all tokens
                        allData.forEach(function(row) {
                            selectedTokens.add(row.member_id);
                        });
                    } else {
                        // Deselect all tokens
                        selectedTokens.clear();
                    }
                    
                    // Update visible checkboxes on current page
                    $('#token-table .token-checkbox').each(function() {
                        $(this).prop('checked', isChecked);
                    });
                    
                    updateTokenSelectedCount();
                });

                // Handle individual token checkbox
                $('#token-table').on('click', '.token-checkbox', function() {
                    const id = $(this).data('id');
                    if ($(this).prop('checked')) {
                        selectedTokens.add(id);
                    } else {
                        selectedTokens.delete(id);
                        $('#selectAllTokens').prop('checked', false);
                    }
                    updateTokenSelectedCount();
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
            const memberCount = selectedRows.size;
            
            btn.disabled = true;
            btn.textContent = '⏳ Generiere...';
            
            // Show loading overlay for larger operations
            const showProgressOverlay = memberCount > 10;
            if (showProgressOverlay) {
                showLoading(
                    'PDFs werden generiert',
                    'Bereite ' + memberCount + ' Briefe vor...',
                    true
                );
                updateLoading('Sende Anfrage an Server...', 10, memberCount + ' Mitglieder ausgewählt');
            }

            try {
                const memberIds = Array.from(selectedRows);
                const validityDays = parseInt(document.getElementById('validityDays').value, 10);
                
                if (showProgressOverlay) {
                    updateLoading('Server generiert PDFs...', 30, 'Dies kann bei vielen Mitgliedern etwas dauern');
                }

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
                
                if (showProgressOverlay) {
                    updateLoading('PDFs generiert! Bereite Download vor...', 80, 'Fast fertig...');
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
                
                if (showProgressOverlay) {
                    updateLoading('Starte Download...', 95, 'ZIP-Datei: ' + (blob.size / 1024 / 1024).toFixed(1) + ' MB');
                }
                
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                hideLoading();
                showToast('PDFs erfolgreich generiert und heruntergeladen! (Token gültig für ' + validityDays + ' Tage)', 'success');
            } catch (error) {
                hideLoading();
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

        // Handle bulk token regeneration - single API call for all tokens
        document.getElementById('regenerateTokensBtn').addEventListener('click', async function() {
            if (selectedTokens.size === 0) {
                showToast('Bitte wählen Sie mindestens ein Token aus.', 'warning');
                return;
            }

            const confirmed = await showConfirm(
                'Token neu generieren',
                'Möchten Sie ' + selectedTokens.size + ' Token wirklich neu generieren? Die alten Links werden ungültig.'
            );
            
            if (!confirmed) return;

            const btn = this;
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Generiere...';

            try {
                const response = await fetch('/api/bulk-regenerate-tokens', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberIds: Array.from(selectedTokens) })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Fehler beim Generieren');
                }
                
                const result = await response.json();
                showToast(result.message, 'success');
                
                selectedTokens.clear();
                await loadTokenStatus();
            } catch (error) {
                showToast('Fehler: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });

        // Handle bulk token deletion - single API call for all tokens
        document.getElementById('deleteTokensBtn').addEventListener('click', async function() {
            if (selectedTokens.size === 0) {
                showToast('Bitte wählen Sie mindestens ein Token aus.', 'warning');
                return;
            }

            const confirmed = await showConfirm(
                'Token löschen',
                'Möchten Sie ' + selectedTokens.size + ' Token wirklich löschen? Die betroffenen Mitglieder können dann nicht mehr auf ihre Datenänderungslinks zugreifen.'
            );
            
            if (!confirmed) return;

            const btn = this;
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Lösche...';

            try {
                const response = await fetch('/api/bulk-delete-tokens', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberIds: Array.from(selectedTokens) })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Fehler beim Löschen');
                }
                
                const result = await response.json();
                showToast(result.message, 'success');
                
                selectedTokens.clear();
                await loadTokenStatus();
            } catch (error) {
                showToast('Fehler: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });

        // Handle "Select All Tokens" button
        document.getElementById('selectAllTokensBtn').addEventListener('click', function() {
            if (!tokenTable) return;
            
            const allData = tokenTable.rows().data().toArray();
            const allSelected = selectedTokens.size === allData.length;
            
            if (allSelected) {
                // Deselect all
                selectedTokens.clear();
                this.textContent = 'Alle auswählen';
            } else {
                // Select all
                allData.forEach(function(row) {
                    selectedTokens.add(row.member_id);
                });
                this.textContent = 'Auswahl aufheben';
            }
            
            // Update visible checkboxes
            $('#token-table .token-checkbox').prop('checked', !allSelected);
            $('#selectAllTokens').prop('checked', !allSelected);
            
            updateTokenSelectedCount();
        });

        // Dark mode toggle
        const themeToggle = document.getElementById('themeToggle');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Initialize theme from localStorage or system preference
        function initTheme() {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                document.documentElement.setAttribute('data-theme', savedTheme);
                updateToggleIcon(savedTheme);
            } else if (prefersDark) {
                document.documentElement.setAttribute('data-theme', 'dark');
                updateToggleIcon('dark');
            }
        }
        
        function updateToggleIcon(theme) {
            themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
            themeToggle.title = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
        }
        
        themeToggle.addEventListener('click', function() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            if (newTheme === 'light') {
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
            }
            
            localStorage.setItem('theme', newTheme);
            updateToggleIcon(newTheme);
        });
        
        // Initialize theme before other init
        initTheme();

        init();
    </script>
</body>
</html>`;
}

export interface NotFoundStats {
    requestedPath: string;
    colo?: string;
    country?: string;
    city?: string;
}

export function render404Page(stats: NotFoundStats): string {
    const edgeLocation = stats.city && stats.country 
        ? `${stats.city}, ${stats.country}` 
        : (stats.colo || 'Edge Server');
    
    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - Seite nicht gefunden | SV 1945 Untereuerheim</title>
    <link rel="icon" type="image/png" href="https://sv-untereuerheim.de/wp-content/uploads/2024/11/logo_svu-241x300.png">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Outfit:wght@300;400;500;600;700&display=swap');
        
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
            --warning: #f59e0b;
            --info: #3b82f6;
            --purple: #8b5cf6;
            --orange: #f97316;
        }
        
        body {
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg-dark);
            min-height: 100vh;
            color: var(--text);
            overflow-x: hidden;
            line-height: 1.6;
        }
        
        /* Animated background */
        .bg-pattern {
            position: fixed;
            inset: 0;
            background: 
                radial-gradient(circle at 20% 50%, rgba(204, 0, 0, 0.08) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
                radial-gradient(circle at 40% 80%, rgba(139, 92, 246, 0.06) 0%, transparent 40%);
            z-index: -1;
        }
        
        .grid-overlay {
            position: fixed;
            inset: 0;
            background-image: 
                linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
            background-size: 60px 60px;
            z-index: -1;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 50px 20px;
        }
        
        /* Header */
        .header {
            text-align: center;
            margin-bottom: 50px;
        }
        
        .error-code {
            font-size: 140px;
            font-weight: 700;
            line-height: 1;
            background: linear-gradient(135deg, #fff 0%, var(--accent) 50%, #666 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 20px;
            animation: shimmer 3s ease-in-out infinite;
        }
        
        @keyframes shimmer {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.2); }
        }
        
        h1 {
            font-size: 32px;
            font-weight: 600;
            margin-bottom: 15px;
        }
        
        .subtitle {
            color: var(--text-dim);
            font-size: 18px;
            max-width: 500px;
            margin: 0 auto 30px;
        }
        
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 14px 28px;
            background: var(--accent);
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 15px;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
        }
        
        .btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 40px var(--accent-glow);
        }
        
        /* Section titles */
        .section-title {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: var(--text-dim);
            margin: 50px 0 25px;
        }
        
        .section-title::after {
            content: '';
            flex: 1;
            height: 1px;
            background: linear-gradient(90deg, rgba(255,255,255,0.15), transparent);
        }
        
        /* Explanation cards */
        .explainer-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
        }
        
        @media (max-width: 700px) {
            .explainer-grid { grid-template-columns: 1fr; }
        }
        
        .explainer-card {
            background: var(--bg-card);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 16px;
            padding: 28px;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .explainer-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--card-accent, var(--accent));
            opacity: 0;
            transition: opacity 0.3s;
        }
        
        .explainer-card:hover {
            transform: translateY(-4px);
            border-color: rgba(255,255,255,0.1);
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        
        .explainer-card:hover::before {
            opacity: 1;
        }
        
        .explainer-card.worker { --card-accent: var(--warning); }
        .explainer-card.d1 { --card-accent: var(--info); }
        .explainer-card.edge { --card-accent: var(--success); }
        .explainer-card.speed { --card-accent: var(--purple); }
        
        .card-icon {
            font-size: 40px;
            margin-bottom: 16px;
            display: block;
        }
        
        .card-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--text);
        }
        
        .card-text {
            font-size: 15px;
            color: var(--text-dim);
            line-height: 1.7;
        }
        
        .card-text strong {
            color: var(--text);
        }
        
        /* Animated flow diagram */
        .flow-container {
            background: var(--bg-card);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 16px;
            padding: 35px;
            margin-top: 30px;
        }
        
        .flow-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 25px;
            text-align: center;
        }
        
        .flow {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            flex-wrap: wrap;
        }
        
        .flow-step {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            animation: fadeInUp 0.6s ease-out backwards;
        }
        
        .flow-step:nth-child(1) { animation-delay: 0.1s; }
        .flow-step:nth-child(2) { animation-delay: 0.3s; }
        .flow-step:nth-child(3) { animation-delay: 0.5s; }
        .flow-step:nth-child(4) { animation-delay: 0.7s; }
        .flow-step:nth-child(5) { animation-delay: 0.9s; }
        
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .flow-icon {
            width: 70px;
            height: 70px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            transition: transform 0.3s, box-shadow 0.3s;
        }
        
        .flow-icon:hover {
            transform: scale(1.1);
        }
        
        .flow-icon.you { background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 8px 25px rgba(99, 102, 241, 0.3); }
        .flow-icon.edge { background: linear-gradient(135deg, #f59e0b, #f97316); box-shadow: 0 8px 25px rgba(245, 158, 11, 0.3); }
        .flow-icon.worker { background: linear-gradient(135deg, #CC0000, #991b1b); box-shadow: 0 8px 25px rgba(204, 0, 0, 0.3); }
        .flow-icon.d1 { background: linear-gradient(135deg, #3b82f6, #1d4ed8); box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3); }
        .flow-icon.response { background: linear-gradient(135deg, #22c55e, #16a34a); box-shadow: 0 8px 25px rgba(34, 197, 94, 0.3); }
        
        .flow-label {
            font-size: 12px;
            font-weight: 500;
            color: var(--text-dim);
            text-align: center;
        }
        
        .flow-arrow {
            font-size: 24px;
            color: var(--text-dim);
            animation: pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 0.4; transform: translateX(0); }
            50% { opacity: 1; transform: translateX(5px); }
        }
        
        /* Your request info */
        .your-request {
            background: linear-gradient(135deg, rgba(204, 0, 0, 0.1), rgba(59, 130, 246, 0.1));
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 16px;
            padding: 25px;
            margin-top: 30px;
        }
        
        .your-request-title {
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: var(--text-dim);
            margin-bottom: 18px;
        }
        
        .request-details {
            display: flex;
            flex-wrap: wrap;
            gap: 25px;
        }
        
        .request-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .request-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-dim);
        }
        
        .request-value {
            font-family: 'JetBrains Mono', monospace;
            font-size: 14px;
            color: var(--text);
        }
        
        .request-value.path {
            color: var(--warning);
            word-break: break-all;
        }
        
        .request-value.location {
            color: var(--success);
        }
        
        /* Footer */
        .footer {
            text-align: center;
            margin-top: 60px;
            padding-top: 30px;
            border-top: 1px solid rgba(255,255,255,0.06);
        }
        
        .footer-text {
            font-size: 14px;
            color: var(--text-dim);
            margin-bottom: 15px;
        }
        
        .footer-logo {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            color: var(--text-dim);
            font-size: 13px;
        }
        
        .footer-logo img {
            width: 35px;
            height: auto;
            opacity: 0.6;
            transition: opacity 0.3s;
        }
        
        .footer-logo:hover img {
            opacity: 1;
        }
        
        /* Fun fact badge */
        .fun-fact {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(139, 92, 246, 0.15);
            border: 1px solid rgba(139, 92, 246, 0.3);
            padding: 12px 20px;
            border-radius: 50px;
            font-size: 13px;
            color: var(--purple);
            margin-top: 15px;
        }
        
        .fun-fact::before {
            content: '💡';
        }
    </style>
</head>
<body>
    <div class="bg-pattern"></div>
    <div class="grid-overlay"></div>
    
    <div class="container">
        <div class="header">
            <div class="error-code">404</div>
            <h1>Seite nicht gefunden</h1>
            <p class="subtitle">
                Diese Seite gibt es leider nicht – aber da du schonmal hier bist: 
                Schau dir an, wie diese Website funktioniert!
            </p>
            <a href="/" class="btn">
                ← Zurück zur Startseite
            </a>
        </div>
        
        <div class="section-title">Wie funktioniert diese Seite?</div>
        
        <div class="explainer-grid">
            <div class="explainer-card worker">
                <span class="card-icon">⚡</span>
                <h3 class="card-title">Cloudflare Workers</h3>
                <p class="card-text">
                    Kleine Programme, die <strong>direkt am Edge</strong> laufen – 
                    also auf Servern in deiner Nähe, nicht irgendwo weit weg. 
                    Dadurch ist alles super schnell!
                </p>
            </div>
            
            <div class="explainer-card d1">
                <span class="card-icon">🗄️</span>
                <h3 class="card-title">D1 Datenbank</h3>
                <p class="card-text">
                    Eine <strong>SQLite-Datenbank</strong>, die auch am Edge läuft. 
                    Hier speichern wir Mitgliederdaten – sicher, schnell und 
                    ohne klassischen Server.
                </p>
            </div>
            
            <div class="explainer-card edge">
                <span class="card-icon">🌍</span>
                <h3 class="card-title">Edge Computing</h3>
                <p class="card-text">
                    Deine Anfrage wurde von <strong>${escapeHtml(edgeLocation)}</strong> 
                    bearbeitet – einem Server ganz in deiner Nähe. 
                    Cloudflare hat über 300 solcher Standorte weltweit!
                </p>
            </div>
            
            <div class="explainer-card speed">
                <span class="card-icon">🏎️</span>
                <h3 class="card-title">Warum so schnell?</h3>
                <p class="card-text">
                    Keine langen Wege zu Rechenzentren. Der Code startet in 
                    <strong>unter 1ms</strong>, weil er bereits auf dem nächsten 
                    Server bereit steht!
                </p>
            </div>
        </div>
        
        <!-- Animated flow diagram -->
        <div class="flow-container">
            <h3 class="flow-title">So kam diese Seite zu dir:</h3>
            <div class="flow">
                <div class="flow-step">
                    <div class="flow-icon you">👤</div>
                    <span class="flow-label">Du<br>(${escapeHtml(stats.city || 'irgendwo')})</span>
                </div>
                <span class="flow-arrow">→</span>
                <div class="flow-step">
                    <div class="flow-icon edge">🌐</div>
                    <span class="flow-label">Edge Server<br>(${escapeHtml(stats.colo || 'Cloudflare')})</span>
                </div>
                <span class="flow-arrow">→</span>
                <div class="flow-step">
                    <div class="flow-icon worker">⚡</div>
                    <span class="flow-label">Worker<br>(Code läuft)</span>
                </div>
                <span class="flow-arrow">→</span>
                <div class="flow-step">
                    <div class="flow-icon d1">🗄️</div>
                    <span class="flow-label">D1<br>(Datenbank)</span>
                </div>
                <span class="flow-arrow">→</span>
                <div class="flow-step">
                    <div class="flow-icon response">✨</div>
                    <span class="flow-label">Fertig!<br>(Diese Seite)</span>
                </div>
            </div>
        </div>
        
        <!-- Your request details -->
        <div class="your-request">
            <h3 class="your-request-title">Deine Anfrage</h3>
            <div class="request-details">
                <div class="request-item">
                    <span class="request-label">Gesuchte Seite</span>
                    <span class="request-value path">${escapeHtml(stats.requestedPath)}</span>
                </div>
                <div class="request-item">
                    <span class="request-label">Bearbeitet von</span>
                    <span class="request-value location">${escapeHtml(stats.colo || 'Edge')} ${stats.country ? `(${escapeHtml(stats.country)})` : ''}</span>
                </div>
                <div class="request-item">
                    <span class="request-label">Technologie</span>
                    <span class="request-value">Cloudflare Workers + D1</span>
                </div>
            </div>
            <div class="fun-fact">
                Wusstest du? Cloudflare Workers starten in unter 5ms – schneller als ein Lidschlag (300ms)!
            </div>
        </div>
        
        <div class="footer">
            <p class="footer-text">
                Auch wenn diese Seite nicht existiert – cool, dass du jetzt weißt, wie alles funktioniert! 🎓
            </p>
            <div class="footer-logo">
                <img src="https://sv-untereuerheim.de/wp-content/uploads/2024/11/logo_svu-241x300.png" alt="SVU Logo">
                <span>SV 1945 Untereuerheim e.V.</span>
            </div>
        </div>
    </div>
</body>
</html>`;
}
