/**
 * Member self-service update routes
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { validateMemberToken } from '../utils/tokens';
import { jsonResponse, jsonError, escapeHtml } from '../utils/helpers';

const update = new Hono<{ Bindings: Env }>();

/**
 * Display update form for a member
 */
update.get('/:token', async (c) => {
	try {
		const token = c.req.param('token');
		const secret = c.env.ADMIN_PASSWORD;
		
		// Validate token and get member ID
		const memberId = await validateMemberToken(token, secret);
		
		if (!memberId) {
			return c.html(renderErrorPage('Ungültiger oder abgelaufener Link'), 403);
		}

		// Fetch member data
		const member = await c.env.svu_prod01.prepare(
			`SELECT * FROM auswertung WHERE AdrNr = ? OR MitglNr = ?`
		).bind(memberId, memberId).first();

		if (!member) {
			return c.html(renderErrorPage('Mitglied nicht gefunden'), 404);
		}

		return c.html(renderUpdateForm(member, token));
	} catch (error: any) {
		console.error('Update form error:', error);
		return c.html(renderErrorPage('Ein Fehler ist aufgetreten'), 500);
	}
});

/**
 * Handle form submission
 */
update.post('/:token', async (c) => {
	try {
		const token = c.req.param('token');
		const secret = c.env.ADMIN_PASSWORD;
		
		// Validate token
		const memberId = await validateMemberToken(token, secret);
		
		if (!memberId) {
			return jsonError('Ungültiger oder abgelaufener Link', 403);
		}

		// Parse form data
		const formData = await c.req.formData();
		const updates: any = {};
		
		// Allowed fields for update
		const allowedFields = [
			'Strasse', 'PLZ', 'Ort', 'Telefon', 'Mobil', 
			'EMail', 'IBAN', 'BIC', 'Bankbezeichnung'
		];

		for (const field of allowedFields) {
			const value = formData.get(field);
			if (value !== null) {
				updates[field] = value.toString().trim();
			}
		}

		if (Object.keys(updates).length === 0) {
			return jsonError('Keine Änderungen übermittelt', 400);
		}

		// Build UPDATE query
		const setClause = Object.keys(updates)
			.map(key => `\`${key}\` = ?`)
			.join(', ');
		
		const values = Object.values(updates);
		values.push(memberId);

		await c.env.svu_prod01.prepare(
			`UPDATE auswertung SET ${setClause} WHERE AdrNr = ? OR MitglNr = ?`
		).bind(...values, memberId).run();

		return c.html(renderSuccessPage());
	} catch (error: any) {
		console.error('Update submission error:', error);
		return jsonError(error.message, 500);
	}
});

function renderUpdateForm(member: any, token: string): string {
	return `<!DOCTYPE html>
<html lang="de">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Daten aktualisieren - SV Untereuerheim</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			background: linear-gradient(135deg, #CC0000 0%, #000000 100%);
			min-height: 100vh;
			padding: 20px;
		}
		.container {
			max-width: 600px;
			margin: 0 auto;
			background: white;
			border-radius: 12px;
			box-shadow: 0 10px 40px rgba(0,0,0,0.3);
			overflow: hidden;
		}
		.header {
			background: #CC0000;
			color: white;
			padding: 30px;
			text-align: center;
		}
		.header h1 {
			font-size: 24px;
			margin-bottom: 5px;
		}
		.header p {
			font-size: 14px;
			opacity: 0.9;
		}
		.content {
			padding: 30px;
		}
		.info-box {
			background: #f8f9fa;
			border-left: 4px solid #CC0000;
			padding: 15px;
			margin-bottom: 25px;
			border-radius: 4px;
		}
		.info-box h2 {
			color: #CC0000;
			font-size: 16px;
			margin-bottom: 10px;
		}
		.info-box p {
			font-size: 14px;
			color: #666;
			line-height: 1.6;
		}
		.member-info {
			background: #fff3cd;
			padding: 15px;
			margin-bottom: 25px;
			border-radius: 4px;
		}
		.member-info strong {
			color: #CC0000;
		}
		.form-group {
			margin-bottom: 20px;
		}
		label {
			display: block;
			margin-bottom: 8px;
			color: #333;
			font-weight: 600;
			font-size: 14px;
		}
		input[type="text"],
		input[type="email"],
		input[type="tel"] {
			width: 100%;
			padding: 12px;
			border: 2px solid #e0e0e0;
			border-radius: 6px;
			font-size: 16px;
			transition: border-color 0.3s;
		}
		input:focus {
			outline: none;
			border-color: #CC0000;
		}
		.readonly {
			background: #f5f5f5;
			color: #666;
		}
		button {
			width: 100%;
			padding: 14px;
			background: #CC0000;
			color: white;
			border: none;
			border-radius: 6px;
			font-size: 16px;
			font-weight: 600;
			cursor: pointer;
			transition: background 0.3s;
			margin-top: 10px;
		}
		button:hover {
			background: #990000;
		}
		.footer {
			padding: 20px 30px;
			background: #f8f9fa;
			text-align: center;
			font-size: 12px;
			color: #666;
		}
		.success-message {
			background: #d4edda;
			color: #155724;
			padding: 15px;
			border-radius: 4px;
			margin-bottom: 20px;
			display: none;
		}
		.error-message {
			background: #f8d7da;
			color: #721c24;
			padding: 15px;
			border-radius: 4px;
			margin-bottom: 20px;
			display: none;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>SV 1945 Untereuerheim e.V.</h1>
			<p>Datenaktualisierung</p>
		</div>

		<div class="content">
			<div class="info-box">
				<h2>Ihre Daten aktualisieren</h2>
				<p>Bitte überprüfen Sie Ihre Daten und korrigieren Sie diese bei Bedarf. 
				Felder mit grauem Hintergrund können nicht geändert werden.</p>
			</div>

			<div class="member-info">
				<strong>Mitglied:</strong> ${escapeHtml(member.Vorname || '')} ${escapeHtml(member.Nachname || '')}<br>
				<strong>Mitgliedsnummer:</strong> ${escapeHtml(member.MitglNr?.toString() || '-')}
			</div>

			<div id="successMessage" class="success-message">
				Ihre Daten wurden erfolgreich aktualisiert!
			</div>
			<div id="errorMessage" class="error-message"></div>

			<form id="updateForm" method="POST" action="/update/${token}">
				<div class="form-group">
					<label>Vorname (nicht änderbar)</label>
					<input type="text" value="${escapeHtml(member.Vorname || '')}" class="readonly" readonly>
				</div>

				<div class="form-group">
					<label>Nachname (nicht änderbar)</label>
					<input type="text" value="${escapeHtml(member.Nachname || '')}" class="readonly" readonly>
				</div>

				<div class="form-group">
					<label for="Strasse">Straße und Hausnummer</label>
					<input type="text" id="Strasse" name="Strasse" value="${escapeHtml(member.Strasse || '')}">
				</div>

				<div class="form-group">
					<label for="PLZ">Postleitzahl</label>
					<input type="text" id="PLZ" name="PLZ" value="${escapeHtml(member.PLZ?.toString() || '')}">
				</div>

				<div class="form-group">
					<label for="Ort">Ort</label>
					<input type="text" id="Ort" name="Ort" value="${escapeHtml(member.Ort || '')}">
				</div>

				<div class="form-group">
					<label for="Telefon">Telefon</label>
					<input type="tel" id="Telefon" name="Telefon" value="${escapeHtml(member.Telefon || '')}">
				</div>

				<div class="form-group">
					<label for="Mobil">Mobil</label>
					<input type="tel" id="Mobil" name="Mobil" value="${escapeHtml(member.Mobil || '')}">
				</div>

				<div class="form-group">
					<label for="EMail">E-Mail</label>
					<input type="email" id="EMail" name="EMail" value="${escapeHtml(member.EMail || '')}">
				</div>

				<div class="form-group">
					<label for="IBAN">IBAN</label>
					<input type="text" id="IBAN" name="IBAN" value="${escapeHtml(member.IBAN || '')}">
				</div>

				<div class="form-group">
					<label for="BIC">BIC</label>
					<input type="text" id="BIC" name="BIC" value="${escapeHtml(member.BIC || '')}">
				</div>

				<div class="form-group">
					<label for="Bankbezeichnung">Bank</label>
					<input type="text" id="Bankbezeichnung" name="Bankbezeichnung" value="${escapeHtml(member.Bankbezeichnung || '')}">
				</div>

				<button type="submit">Daten aktualisieren</button>
			</form>
		</div>

		<div class="footer">
			SV 1945 Untereuerheim e.V. • "Wir sind Untereuerheim"
		</div>
	</div>

	<script>
		document.getElementById('updateForm').addEventListener('submit', async (e) => {
			e.preventDefault();
			
			const form = e.target;
			const formData = new FormData(form);
			const successMsg = document.getElementById('successMessage');
			const errorMsg = document.getElementById('errorMessage');
			
			successMsg.style.display = 'none';
			errorMsg.style.display = 'none';

			try {
				const response = await fetch(form.action, {
					method: 'POST',
					body: formData
				});

				if (response.ok) {
					successMsg.style.display = 'block';
					window.scrollTo(0, 0);
				} else {
					const data = await response.json();
					errorMsg.textContent = data.error || 'Ein Fehler ist aufgetreten';
					errorMsg.style.display = 'block';
					window.scrollTo(0, 0);
				}
			} catch (error) {
				errorMsg.textContent = 'Verbindungsfehler. Bitte versuchen Sie es später erneut.';
				errorMsg.style.display = 'block';
				window.scrollTo(0, 0);
			}
		});
	</script>
</body>
</html>`;
}

function renderSuccessPage(): string {
	return `<!DOCTYPE html>
<html lang="de">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Erfolgreich aktualisiert</title>
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
		.container {
			background: white;
			padding: 40px;
			border-radius: 12px;
			box-shadow: 0 10px 40px rgba(0,0,0,0.3);
			text-align: center;
			max-width: 500px;
		}
		.success-icon {
			width: 80px;
			height: 80px;
			background: #28a745;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			margin: 0 auto 20px;
		}
		.success-icon::after {
			content: "✓";
			color: white;
			font-size: 48px;
			font-weight: bold;
		}
		h1 {
			color: #CC0000;
			margin-bottom: 15px;
		}
		p {
			color: #666;
			line-height: 1.6;
			margin-bottom: 15px;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="success-icon"></div>
		<h1>Vielen Dank!</h1>
		<p>Ihre Daten wurden erfolgreich aktualisiert.</p>
		<p>Sie können dieses Fenster nun schließen.</p>
	</div>
</body>
</html>`;
}

function renderErrorPage(message: string): string {
	return `<!DOCTYPE html>
<html lang="de">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Fehler</title>
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
		.container {
			background: white;
			padding: 40px;
			border-radius: 12px;
			box-shadow: 0 10px 40px rgba(0,0,0,0.3);
			text-align: center;
			max-width: 500px;
		}
		h1 {
			color: #CC0000;
			margin-bottom: 15px;
		}
		p {
			color: #666;
			line-height: 1.6;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>Fehler</h1>
		<p>${escapeHtml(message)}</p>
	</div>
</body>
</html>`;
}

export default update;
