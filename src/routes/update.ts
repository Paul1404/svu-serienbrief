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

		// Log access (create access log table if not exists and record visit)
		try {
			// Create table if not exists
			await c.env.svu_prod01.prepare(`
				CREATE TABLE IF NOT EXISTS member_access_log (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					member_id TEXT NOT NULL,
					accessed_at TEXT NOT NULL,
					ip_address TEXT,
					user_agent TEXT
				)
			`).run();

			// Log this access
			const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
			const userAgent = c.req.header('user-agent') || 'unknown';
			
			await c.env.svu_prod01.prepare(`
				INSERT INTO member_access_log (member_id, accessed_at, ip_address, user_agent)
				VALUES (?, datetime('now'), ?, ?)
			`).bind(memberId, ipAddress, userAgent.substring(0, 255)).run();

			console.log({
				event: 'member_access',
				member_id: memberId,
				ip: ipAddress
			});
		} catch (logError: any) {
			// Don't fail the request if logging fails
			console.error('Failed to log access:', logError);
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
			'EMail', 'IBAN', 'BIC', 'Bankbezeichnung',
			'Geburtsdatum', 'funktion_rolle', 'funktion_beginn', 'funktion_ende'
		];
		
		// Comment field is handled separately
		const commentField = 'aenderungskommentar';

		// Fetch current values before processing
		const currentMember = await c.env.svu_prod01.prepare(
			`SELECT * FROM auswertung WHERE AdrNr = ? OR MitglNr = ?`
		).bind(memberId, memberId).first();

		if (!currentMember) {
			return c.html(renderErrorPage('Mitglied nicht gefunden'), 404);
		}

		// Collect updates and validate
		const actualChanges: any = {};
		let hasChanges = false;
		
		for (const field of allowedFields) {
			const rawValue = formData.get(field);
			if (rawValue !== null) {
				const newValue = rawValue.toString().trim();
				const oldValue = String((currentMember as any)?.[field] || '').trim();
				
				// Validate email format if provided
				if (field === 'EMail' && newValue && newValue !== oldValue) {
					const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
					if (!emailRegex.test(newValue)) {
						return c.html(renderErrorPage('Ungültige E-Mail-Adresse'), 400);
					}
				}
				
				// Validate IBAN format if provided
				if (field === 'IBAN' && newValue && newValue !== oldValue) {
					const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/;
					const cleanIban = newValue.replace(/\s/g, '').toUpperCase();
					if (cleanIban && !ibanRegex.test(cleanIban)) {
						return c.html(renderErrorPage('Ungültiges IBAN-Format'), 400);
					}
					updates[field] = cleanIban;
					if (oldValue !== cleanIban) {
						actualChanges[field] = { old: oldValue, new: cleanIban };
						hasChanges = true;
					}
					continue;
				}
				
				// Validate phone numbers (basic check)
				if ((field === 'Telefon' || field === 'Mobil') && newValue && newValue !== oldValue) {
					const phoneRegex = /^[\d\s\+\-\/\(\)]+$/;
					if (!phoneRegex.test(newValue)) {
						return c.html(renderErrorPage('Ungültiges Telefonnummer-Format'), 400);
					}
				}
				
				// Validate PLZ (German postal code)
				if (field === 'PLZ' && newValue && newValue !== oldValue) {
					const plzRegex = /^\d{5}$/;
					if (!plzRegex.test(newValue)) {
						return c.html(renderErrorPage('Ungültige Postleitzahl (muss 5 Ziffern sein)'), 400);
					}
				}
				
				// Validate date format (YYYY-MM-DD)
				if (field === 'Geburtsdatum' && newValue && newValue !== oldValue) {
					const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
					if (!dateRegex.test(newValue)) {
						return c.html(renderErrorPage('Ungültiges Datumsformat für Geburtsdatum'), 400);
					}
				}
				
				// Validate month format (YYYY-MM)
				if ((field === 'funktion_beginn' || field === 'funktion_ende') && newValue && newValue !== oldValue) {
					const monthRegex = /^\d{4}-\d{2}$/;
					if (!monthRegex.test(newValue)) {
						return c.html(renderErrorPage('Ungültiges Format für Funktionszeitraum (JJJJ-MM erwartet)'), 400);
					}
				}
				
				updates[field] = newValue;
				
				// Track actual changes
				if (oldValue !== newValue) {
					actualChanges[field] = { old: oldValue, new: newValue };
					hasChanges = true;
				}
			}
		}
		
		// Handle comment field separately - only store if not empty
		const commentValue = formData.get(commentField);
		let hasComment = false;
		if (commentValue) {
			const commentText = commentValue.toString().trim();
			if (commentText) {
				updates[commentField] = commentText;
				hasComment = true;
				// Always log comment as a change if it's new content
				const oldComment = String((currentMember as any)?.[commentField] || '').trim();
				if (oldComment !== commentText) {
					actualChanges[commentField] = { old: oldComment, new: commentText };
					hasChanges = true;
				}
			}
		}

		if (Object.keys(updates).length === 0 && !hasComment) {
			return c.html(renderErrorPage('Keine Daten übermittelt'), 400);
		}

		// Check if there are any actual changes
		if (!hasChanges) {
			return c.html(renderSuccessPage('Keine Änderungen vorgenommen - Ihre Daten waren bereits aktuell.'));
		}

		// Build UPDATE query only for changed fields
		const changedFields = Object.keys(actualChanges);
		const setClause = changedFields
			.map(key => `\`${key}\` = ?`)
			.join(', ');
		
		const values = changedFields.map(key => updates[key]);
		values.push(memberId);

		await c.env.svu_prod01.prepare(
			`UPDATE auswertung SET ${setClause} WHERE AdrNr = ? OR MitglNr = ?`
		).bind(...values, memberId).run();

		// Log the changes
		try {
			// Create change log table if not exists
			await c.env.svu_prod01.prepare(`
				CREATE TABLE IF NOT EXISTS member_changes_log (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					member_id TEXT NOT NULL,
					field_name TEXT NOT NULL,
					old_value TEXT,
					new_value TEXT,
					changed_at TEXT NOT NULL,
					ip_address TEXT,
					user_agent TEXT
				)
			`).run();

			const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
			const userAgent = c.req.header('user-agent') || 'unknown';

			// Log each changed field (only actual changes)
			for (const [field, change] of Object.entries(actualChanges)) {
				const { old, new: newValue } = change as any;
				
				await c.env.svu_prod01.prepare(`
					INSERT INTO member_changes_log (member_id, field_name, old_value, new_value, changed_at, ip_address, user_agent)
					VALUES (?, ?, ?, ?, datetime('now'), ?, ?)
				`).bind(memberId, field, old, newValue, ipAddress, userAgent.substring(0, 255)).run();
			}
			
			console.log({
				event: 'member_data_updated',
				member_id: memberId,
				fields_changed: Object.keys(actualChanges),
				change_count: Object.keys(actualChanges).length
			});
		} catch (logError: any) {
			// Don't fail the request if logging fails
			console.error('Failed to log changes:', logError);
		}

		return c.html(renderSuccessPage('Ihre Daten wurden erfolgreich aktualisiert.'));
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
	<link rel="icon" type="image/png" href="https://sv-untereuerheim.de/wp-content/uploads/2024/11/logo_svu-241x300.png">
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
		.form-section {
			margin-bottom: 30px;
			padding-bottom: 20px;
			border-bottom: 1px solid #eee;
		}
		.form-section:last-of-type {
			border-bottom: none;
		}
		.section-title {
			font-size: 14px;
			font-weight: 600;
			color: #CC0000;
			margin-bottom: 15px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}
		.form-group {
			margin-bottom: 20px;
		}
		.form-row {
			display: flex;
			gap: 15px;
		}
		.form-row .form-group {
			flex: 1;
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
		input[type="tel"],
		input[type="date"],
		input[type="month"],
		select,
		textarea {
			width: 100%;
			padding: 12px;
			border: 2px solid #e0e0e0;
			border-radius: 6px;
			font-size: 16px;
			font-family: inherit;
			transition: border-color 0.3s, background-color 0.3s;
		}
		textarea {
			min-height: 100px;
			resize: vertical;
		}
		input:focus, select:focus, textarea:focus {
			outline: none;
			border-color: #CC0000;
		}
		.readonly {
			background: #f5f5f5;
			color: #666;
		}
		/* Empty field indicator */
		.form-group.is-empty input:not(.readonly),
		.form-group.is-empty select:not(.readonly),
		.form-group.is-empty textarea:not(.readonly) {
			border-color: #ffc107;
			background: #fffdf5;
		}
		.form-group.is-empty input:not(.readonly):focus,
		.form-group.is-empty select:not(.readonly):focus,
		.form-group.is-empty textarea:not(.readonly):focus {
			border-color: #CC0000;
			background: white;
		}
		.empty-badge {
			display: inline-block;
			background: #ffc107;
			color: #000;
			font-size: 10px;
			font-weight: 600;
			padding: 2px 8px;
			border-radius: 10px;
			margin-left: 8px;
			vertical-align: middle;
		}
		.form-group:not(.is-empty) .empty-badge {
			display: none;
		}
		.hint {
			font-size: 12px;
			color: #888;
			margin-top: 5px;
		}
		.comment-hint {
			background: #e8f4fd;
			padding: 12px;
			border-radius: 6px;
			margin-bottom: 15px;
			font-size: 13px;
			color: #0c5460;
			border-left: 3px solid #17a2b8;
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
				<p style="margin-top: 10px; font-size: 13px;">
					<span style="display: inline-block; background: #ffc107; color: #000; padding: 2px 8px; border-radius: 10px; font-weight: 600; font-size: 10px;">LEER</span>
					<span style="color: #666;"> = Bitte ergänzen Sie diese Angabe, falls vorhanden</span>
				</p>
			</div>

			<div class="member-info">
				<strong>Mitglied:</strong> ${escapeHtml(member.Vorname || '')} ${escapeHtml(member.Nachname || '')}<br>
				<strong>Mitgliedsnummer:</strong> ${escapeHtml(member.MitglNr?.toString() || '-')}<br>
				<strong>Mitglied seit:</strong> ${escapeHtml(member.eintrittsdatum || member.Eintritt || '-')}
			</div>

			<div id="successMessage" class="success-message">
				Ihre Daten wurden erfolgreich aktualisiert!
			</div>
			<div id="errorMessage" class="error-message"></div>

			<form id="updateForm" method="POST" action="/update/${token}">
				<!-- Personal Data Section (Read-only) -->
				<div class="form-section">
					<div class="section-title">Persönliche Daten</div>
					
					<div class="form-row">
						<div class="form-group">
							<label>Vorname (nicht änderbar)</label>
							<input type="text" value="${escapeHtml(member.Vorname || '')}" class="readonly" readonly>
						</div>
						<div class="form-group">
							<label>Nachname (nicht änderbar)</label>
							<input type="text" value="${escapeHtml(member.Nachname || '')}" class="readonly" readonly>
						</div>
					</div>

					<div class="form-group${!member.Geburtsdatum ? ' is-empty' : ''}">
						<label for="Geburtsdatum">Geburtsdatum${!member.Geburtsdatum ? '<span class="empty-badge">LEER</span>' : ''}</label>
						<input type="date" id="Geburtsdatum" name="Geburtsdatum" value="${escapeHtml(member.Geburtsdatum || '')}">
					</div>
				</div>

				<!-- Address Section -->
				<div class="form-section">
					<div class="section-title">Adresse</div>
					
					<div class="form-group${!member.Strasse ? ' is-empty' : ''}">
						<label for="Strasse">Straße und Hausnummer${!member.Strasse ? '<span class="empty-badge">LEER</span>' : ''}</label>
						<input type="text" id="Strasse" name="Strasse" value="${escapeHtml(member.Strasse || '')}">
					</div>

					<div class="form-row">
						<div class="form-group${!member.PLZ ? ' is-empty' : ''}" style="flex: 0 0 120px;">
							<label for="PLZ">PLZ${!member.PLZ ? '<span class="empty-badge">LEER</span>' : ''}</label>
							<input type="text" id="PLZ" name="PLZ" value="${escapeHtml(member.PLZ?.toString() || '')}">
						</div>
						<div class="form-group${!member.Ort ? ' is-empty' : ''}">
							<label for="Ort">Ort${!member.Ort ? '<span class="empty-badge">LEER</span>' : ''}</label>
							<input type="text" id="Ort" name="Ort" value="${escapeHtml(member.Ort || '')}">
						</div>
					</div>
				</div>

				<!-- Contact Section -->
				<div class="form-section">
					<div class="section-title">Kontakt</div>
					
					<div class="form-row">
						<div class="form-group${!member.Telefon ? ' is-empty' : ''}">
							<label for="Telefon">Telefon${!member.Telefon ? '<span class="empty-badge">LEER</span>' : ''}</label>
							<input type="tel" id="Telefon" name="Telefon" value="${escapeHtml(member.Telefon || '')}">
						</div>
						<div class="form-group${!member.Mobil ? ' is-empty' : ''}">
							<label for="Mobil">Mobil${!member.Mobil ? '<span class="empty-badge">LEER</span>' : ''}</label>
							<input type="tel" id="Mobil" name="Mobil" value="${escapeHtml(member.Mobil || '')}">
						</div>
					</div>

					<div class="form-group${!member.EMail ? ' is-empty' : ''}">
						<label for="EMail">E-Mail${!member.EMail ? '<span class="empty-badge">LEER</span>' : ''}</label>
						<input type="email" id="EMail" name="EMail" value="${escapeHtml(member.EMail || '')}">
					</div>
				</div>

				<!-- Function/Role Section -->
				<div class="form-section">
					<div class="section-title">Funktion im Verein</div>
					
					<div class="form-group${!member.funktion_rolle ? ' is-empty' : ''}">
						<label for="funktion_rolle">Aktuelle Funktion${!member.funktion_rolle ? '<span class="empty-badge">LEER</span>' : ''}</label>
						<input type="text" id="funktion_rolle" name="funktion_rolle" value="${escapeHtml(member.funktion_rolle || '')}" placeholder="z.B. Trainer, Vorstand, Abteilungsleiter">
					</div>

					<div class="form-row">
						<div class="form-group${!member.funktion_beginn ? ' is-empty' : ''}">
							<label for="funktion_beginn">Beginn${!member.funktion_beginn ? '<span class="empty-badge">LEER</span>' : ''}</label>
							<input type="month" id="funktion_beginn" name="funktion_beginn" value="${escapeHtml(member.funktion_beginn || '')}">
							<div class="hint">Format: JJJJ-MM</div>
						</div>
						<div class="form-group">
							<label for="funktion_ende">Ende (leer = bis heute)</label>
							<input type="month" id="funktion_ende" name="funktion_ende" value="${escapeHtml(member.funktion_ende || '')}">
							<div class="hint">Leer lassen wenn noch aktiv</div>
						</div>
					</div>
				</div>

				<!-- Bank Section -->
				<div class="form-section">
					<div class="section-title">Bankverbindung</div>
					
					<div class="form-group${!member.IBAN ? ' is-empty' : ''}">
						<label for="IBAN">IBAN${!member.IBAN ? '<span class="empty-badge">LEER</span>' : ''}</label>
						<input type="text" id="IBAN" name="IBAN" value="${escapeHtml(member.IBAN || '')}">
					</div>

					<div class="form-row">
						<div class="form-group${!member.BIC ? ' is-empty' : ''}">
							<label for="BIC">BIC${!member.BIC ? '<span class="empty-badge">LEER</span>' : ''}</label>
							<input type="text" id="BIC" name="BIC" value="${escapeHtml(member.BIC || '')}">
						</div>
						<div class="form-group${!member.Bankbezeichnung ? ' is-empty' : ''}">
							<label for="Bankbezeichnung">Bank${!member.Bankbezeichnung ? '<span class="empty-badge">LEER</span>' : ''}</label>
							<input type="text" id="Bankbezeichnung" name="Bankbezeichnung" value="${escapeHtml(member.Bankbezeichnung || '')}">
						</div>
					</div>
				</div>

				<!-- Comment Section -->
				<div class="form-section">
					<div class="section-title">Mitteilung an den Verein</div>
					
					<div class="comment-hint">
						Falls Angaben wie Vorname, Nachname oder Eintrittsdatum nicht stimmen, 
						können Sie dies hier mitteilen. Der Verein wird die Änderungen prüfen und durchführen.
					</div>
					
					<div class="form-group">
						<label for="aenderungskommentar">Ihr Kommentar / Änderungswunsch</label>
						<textarea id="aenderungskommentar" name="aenderungskommentar" placeholder="z.B. Namensänderung nach Heirat, falsches Eintrittsdatum, etc.">${escapeHtml(member.aenderungskommentar || '')}</textarea>
					</div>
				</div>

				<button type="submit">Daten aktualisieren</button>
			</form>
		</div>

		<div class="footer">
			SV 1945 Untereuerheim e.V. • "Wir sind Untereuerheim"
		</div>
	</div>

	<script>
		// Update empty indicators when user types
		document.querySelectorAll('#updateForm input:not(.readonly), #updateForm select, #updateForm textarea').forEach(input => {
			input.addEventListener('input', function() {
				const formGroup = this.closest('.form-group');
				if (formGroup) {
					if (this.value.trim()) {
						formGroup.classList.remove('is-empty');
					} else {
						formGroup.classList.add('is-empty');
					}
				}
			});
		});

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

function renderSuccessPage(message?: string): string {
	const defaultMessage = 'Ihre Daten wurden erfolgreich aktualisiert!';
	const displayMessage = message || defaultMessage;
	
	return `<!DOCTYPE html>
<html lang="de">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Erfolgreich aktualisiert</title>
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
		<p>${escapeHtml(displayMessage)}</p>
		<p>Sie können dieses Fenster nun schließen.</p>
	</div>
</body>
</html>`;
}

function renderErrorPage(message: string, isExpired: boolean = false): string {
	const isInvalidLink = message.includes('Ungültiger') || message.includes('abgelaufen');
	
	return `<!DOCTYPE html>
<html lang="de">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${isExpired ? 'Link abgelaufen' : 'Fehler'} - SV Untereuerheim</title>
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
		.container {
			background: white;
			padding: 40px;
			border-radius: 12px;
			box-shadow: 0 10px 40px rgba(0,0,0,0.3);
			text-align: center;
			max-width: 500px;
		}
		.error-icon {
			width: 80px;
			height: 80px;
			background: ${isInvalidLink ? '#ffc107' : '#dc3545'};
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			margin: 0 auto 20px;
			font-size: 40px;
		}
		h1 {
			color: #CC0000;
			margin-bottom: 15px;
			font-size: 24px;
		}
		.message {
			color: #333;
			font-size: 16px;
			line-height: 1.6;
			margin-bottom: 25px;
		}
		.help-box {
			background: #f8f9fa;
			border-left: 4px solid #CC0000;
			padding: 20px;
			text-align: left;
			border-radius: 4px;
			margin-bottom: 25px;
		}
		.help-box h3 {
			color: #CC0000;
			font-size: 14px;
			margin-bottom: 12px;
		}
		.help-box ul {
			color: #666;
			font-size: 14px;
			line-height: 1.8;
			margin-left: 20px;
		}
		.help-box li {
			margin-bottom: 5px;
		}
		.contact-info {
			background: #e8f4fd;
			padding: 15px;
			border-radius: 8px;
			font-size: 14px;
			color: #333;
		}
		.contact-info strong {
			color: #CC0000;
		}
		.footer {
			margin-top: 25px;
			padding-top: 20px;
			border-top: 1px solid #eee;
			font-size: 12px;
			color: #999;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="error-icon">${isInvalidLink ? '🔗' : '⚠️'}</div>
		<h1>${isInvalidLink ? 'Link ungültig oder abgelaufen' : 'Fehler'}</h1>
		<p class="message">${escapeHtml(message)}</p>
		
		${isInvalidLink ? `
		<div class="help-box">
			<h3>Was könnte passiert sein?</h3>
			<ul>
				<li>Der Link ist abgelaufen (nach 90 Tagen)</li>
				<li>Der QR-Code wurde nicht vollständig gescannt</li>
				<li>Der Link wurde falsch abgetippt</li>
				<li>Es wurde bereits ein neuer Link für Sie erstellt</li>
			</ul>
		</div>
		
		<div class="contact-info">
			<strong>Benötigen Sie einen neuen Link?</strong><br>
			Bitte kontaktieren Sie den Verein, um einen neuen Aktualisierungslink zu erhalten.
		</div>
		` : ''}
		
		<div class="footer">
			SV 1945 Untereuerheim e.V. • "Wir sind Untereuerheim"
		</div>
	</div>
</body>
</html>`;
}

export default update;
