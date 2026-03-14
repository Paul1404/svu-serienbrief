/**
 * Member self-service update routes (Node/Neon version).
 * Ported from the original Cloudflare D1 implementation to Postgres/Neon.
 */

const DATENSCHUTZ_URL = 'https://sv-untereuerheim.de/datenschutz/';

import { Hono } from 'hono';
import { validateMemberToken } from '../utils/tokens';
import { jsonResponse, jsonError, escapeHtml } from '../utils/helpers';
import { icons } from '../utils/icons';
import { query, queryOne } from '../db';

const update = new Hono();

/**
 * Display update form for a member
 */
update.get('/:token', async (c) => {
	try {
		const token = c.req.param('token');
		const secret = process.env.ADMIN_PASSWORD || '';

		const memberId = await validateMemberToken(token, secret);

		if (!memberId) {
			return c.html(renderErrorPage('Ungültiger oder abgelaufener Link'), 403);
		}

		// Fetch member data
		const member = await queryOne<any>(
			`SELECT * FROM auswertung WHERE "AdrNr" = $1 OR "MitglNr" = $2`,
			[memberId, memberId]
		);

		if (!member) {
			return c.html(renderErrorPage('Mitglied nicht gefunden'), 404);
		}

		// Log access
		try {
			const ipAddress =
				c.req.header('cf-connecting-ip') ||
				c.req.header('x-forwarded-for') ||
				'unknown';
			const userAgent = (c.req.header('user-agent') || 'unknown').substring(
				0,
				255
			);

			await query(
				`INSERT INTO member_access_log (member_id, accessed_at, ip_address, user_agent)
				 VALUES ($1, now(), $2, $3)`,
				[String(memberId), ipAddress, userAgent]
			);

			console.log({
				event: 'member_access',
				member_id: memberId,
				ip: ipAddress
			});
		} catch (logError: any) {
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
		const secret = process.env.ADMIN_PASSWORD || '';

		const memberId = await validateMemberToken(token, secret);

		if (!memberId) {
			return jsonError('Ungültiger oder abgelaufener Link', 403);
		}

		const formData = await c.req.formData();
		const updates: any = {};

		const allowedFields = [
			'Strasse',
			'PLZ',
			'Ort',
			'Telefon',
			'Mobil',
			'EMail',
			'IBAN',
			'BIC',
			'Bankbezeichnung',
			'Geburtsdatum'
		];

		const commentField = 'aenderungskommentar';

		const currentMember = await queryOne<any>(
			`SELECT * FROM auswertung WHERE "AdrNr" = $1 OR "MitglNr" = $2`,
			[memberId, memberId]
		);

		if (!currentMember) {
			return c.html(renderErrorPage('Mitglied nicht gefunden'), 404);
		}

		const actualChanges: any = {};
		let hasChanges = false;

		for (const field of allowedFields) {
			const rawValue = formData.get(field);
			if (rawValue !== null) {
				const newValue = rawValue.toString().trim();
				const oldValue = String((currentMember as any)?.[field] || '').trim();

				if (field === 'EMail' && newValue && newValue !== oldValue) {
					const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
					if (!emailRegex.test(newValue)) {
						return c.html(
							renderErrorPage('Ungültige E-Mail-Adresse'),
							400
						);
					}
				}

				if (field === 'IBAN' && newValue && newValue !== oldValue) {
					const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/;
					const cleanIban = newValue.replace(/\s/g, '').toUpperCase();
					if (cleanIban && !ibanRegex.test(cleanIban)) {
						return c.html(
							renderErrorPage('Ungültiges IBAN-Format'),
							400
						);
					}
					updates[field] = cleanIban;
					if (oldValue !== cleanIban) {
						actualChanges[field] = { old: oldValue, new: cleanIban };
						hasChanges = true;
					}
					continue;
				}

				if (
					(field === 'Telefon' || field === 'Mobil') &&
					newValue &&
					newValue !== oldValue
				) {
					const phoneRegex = /^[\d\s\+\-\/\(\)]+$/;
					if (!phoneRegex.test(newValue)) {
						return c.html(
							renderErrorPage('Ungültiges Telefonnummer-Format'),
							400
						);
					}
				}

				if (field === 'PLZ' && newValue && newValue !== oldValue) {
					const plzRegex = /^\d{5}$/;
					if (!plzRegex.test(newValue)) {
						return c.html(
							renderErrorPage(
								'Ungültige Postleitzahl (muss 5 Ziffern sein)'
							),
							400
						);
					}
				}

				if (field === 'Geburtsdatum' && newValue && newValue !== oldValue) {
					const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
					if (!dateRegex.test(newValue)) {
						return c.html(
							renderErrorPage(
								'Ungültiges Datumsformat für Geburtsdatum'
							),
							400
						);
					}
				}

				if (
					(field === 'funktion_beginn' || field === 'funktion_ende') &&
					newValue &&
					newValue !== oldValue
				) {
					const monthRegex = /^\d{4}-\d{2}$/;
					if (!monthRegex.test(newValue)) {
						return c.html(
							renderErrorPage(
								'Ungültiges Format für Funktionszeitraum (JJJJ-MM erwartet)'
							),
							400
						);
					}
				}

				updates[field] = newValue;

				if (oldValue !== newValue) {
					actualChanges[field] = { old: oldValue, new: newValue };
					hasChanges = true;
				}
			}
		}

		const commentValue = formData.get(commentField);
		let hasComment = false;
		if (commentValue) {
			const commentText = commentValue.toString().trim();
			if (commentText) {
				updates[commentField] = commentText;
				hasComment = true;
				const oldComment = String(
					(currentMember as any)?.[commentField] || ''
				).trim();
				if (oldComment !== commentText) {
					actualChanges[commentField] = {
						old: oldComment,
						new: commentText
					};
					hasChanges = true;
				}
			}
		}

		// Parse and validate funktionen (multiple functions)
		const funktionenRaw = formData.get('funktionen');
		if (funktionenRaw !== null) {
			let funktionen: Array<{ rolle: string; beginn: string; ende: string }> = [];
			try {
				const parsed = JSON.parse(funktionenRaw.toString());
				if (Array.isArray(parsed)) {
					funktionen = parsed.map((f: any) => ({
						rolle: String(f?.rolle ?? '').trim(),
						beginn: String(f?.beginn ?? '').trim(),
						ende: String(f?.ende ?? '').trim()
					}));
				}
			} catch {
				// ignore invalid JSON
			}
			const monthRegex = /^\d{4}-\d{2}$/;
			for (const f of funktionen) {
				if (f.beginn && !monthRegex.test(f.beginn)) {
					return c.html(
						renderErrorPage(
							'Ungültiges Format für Funktionsbeginn (JJJJ-MM erwartet)'
						),
						400
					);
				}
				if (f.ende && !monthRegex.test(f.ende)) {
					return c.html(
						renderErrorPage(
							'Ungültiges Format für Funktionsende (JJJJ-MM erwartet)'
						),
						400
					);
				}
			}
			const oldFunktionen = getMemberFunktionen(currentMember);
			const oldJson = JSON.stringify(oldFunktionen);
			const newJson = JSON.stringify(funktionen);
			if (oldJson !== newJson) {
				updates.funktionen = funktionen;
				actualChanges.funktionen = { old: oldJson, new: newJson };
				hasChanges = true;
				// Sync first function to legacy columns for admin display
				const first = funktionen[0];
				updates.funktion_rolle = first?.rolle ?? '';
				updates.funktion_beginn = first?.beginn ?? '';
				updates.funktion_ende = first?.ende ?? '';
			}
		}

		if (Object.keys(updates).length === 0 && !hasComment) {
			return c.html(renderErrorPage('Keine Daten übermittelt'), 400);
		}

		if (!hasChanges) {
			return c.html(
				renderSuccessPage(
					'Keine Änderungen vorgenommen - Ihre Daten waren bereits aktuell.'
				)
			);
		}

		const changedFields = Object.keys(actualChanges);
		const setParts: string[] = [];
		const values: any[] = [];
		let paramIdx = 1;
		for (const key of changedFields) {
			if (key === 'funktionen') {
				setParts.push(`"funktionen" = $${paramIdx}::jsonb`);
				values.push(JSON.stringify(updates.funktionen));
				paramIdx++;
				// Sync legacy columns for admin display
				setParts.push(`"funktion_rolle" = $${paramIdx}`);
				values.push(updates.funktion_rolle ?? '');
				paramIdx++;
				setParts.push(`"funktion_beginn" = $${paramIdx}`);
				values.push(updates.funktion_beginn ?? '');
				paramIdx++;
				setParts.push(`"funktion_ende" = $${paramIdx}`);
				values.push(updates.funktion_ende ?? '');
				paramIdx++;
			} else {
				setParts.push(`"${key}" = $${paramIdx}`);
				values.push(updates[key]);
				paramIdx++;
			}
		}
		const setClause = setParts.join(', ');
		values.push(memberId);

		await query(
			`UPDATE auswertung SET ${setClause} WHERE "AdrNr" = $${paramIdx} OR "MitglNr" = $${paramIdx}`,
			[...values, memberId]
		);

		try {
			const ipAddress =
				c.req.header('cf-connecting-ip') ||
				c.req.header('x-forwarded-for') ||
				'unknown';
			const userAgent = (c.req.header('user-agent') || 'unknown').substring(
				0,
				255
			);

			for (const [field, change] of Object.entries(actualChanges)) {
				const { old, new: newValue } = change as any;

				await query(
					`INSERT INTO member_changes_log 
					 (member_id, field_name, old_value, new_value, changed_at, ip_address, user_agent)
					 VALUES ($1, $2, $3, $4, now(), $5, $6)`,
					[String(memberId), field, old, newValue, ipAddress, userAgent]
				);
			}

			console.log({
				event: 'member_data_updated',
				member_id: memberId,
				fields_changed: Object.keys(actualChanges),
				change_count: Object.keys(actualChanges).length
			});
		} catch (logError: any) {
			console.error('Failed to log changes:', logError);
		}

		return c.html(
			renderSuccessPage('Ihre Daten wurden erfolgreich aktualisiert.')
		);
	} catch (error: any) {
		console.error('Update submission error:', error);
		return jsonError(error.message, 500);
	}
});

// Render a single function row for the form
function renderFunktionRow(f: { rolle: string; beginn: string; ende: string }, index: number): string {
	const canRemove = index > 0;
	return `
		<div class="funktion-row" data-index="${index}">
			<div class="form-row" style="align-items: flex-end;">
				<div class="form-group" style="flex: 2;">
					<label>Funktion</label>
					<input type="text" class="funktion-rolle" placeholder="z.B. Trainer, Vorstand" value="${escapeHtml(f.rolle)}">
				</div>
				<div class="form-group" style="flex: 1;">
					<label>Beginn</label>
					<input type="month" class="funktion-beginn" value="${escapeHtml(f.beginn)}" title="JJJJ-MM">
				</div>
				<div class="form-group" style="flex: 1;">
					<label>Ende</label>
					<input type="month" class="funktion-ende" value="${escapeHtml(f.ende)}" placeholder="leer = bis heute" title="Leer = noch aktiv">
				</div>
				${canRemove ? '<div class="form-group" style="flex: 0;"><button type="button" class="remove-funktion-btn" title="Entfernen">×</button></div>' : ''}
			</div>
		</div>`;
}

// Parse member functions: from funktionen JSON array or legacy single fields
function getMemberFunktionen(member: any): Array<{ rolle: string; beginn: string; ende: string }> {
	if (member.funktionen && Array.isArray(member.funktionen) && member.funktionen.length > 0) {
		return member.funktionen.map((f: any) => ({
			rolle: String(f?.rolle ?? '').trim(),
			beginn: String(f?.beginn ?? '').trim(),
			ende: String(f?.ende ?? '').trim()
		}));
	}
	// Legacy: single funktion_rolle, funktion_beginn, funktion_ende
	const rolle = String(member.funktion_rolle ?? '').trim();
	if (rolle || member.funktion_beginn || member.funktion_ende) {
		return [{
			rolle,
			beginn: String(member.funktion_beginn ?? '').trim(),
			ende: String(member.funktion_ende ?? '').trim()
		}];
	}
	return [];
}

// Below: HTML rendering helpers copied from original implementation

function renderUpdateForm(member: any, token: string): string {
	const funktionen = getMemberFunktionen(member);
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
		.footer a {
			color: #666;
			text-decoration: none;
		}
		.footer a:hover {
			text-decoration: underline;
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
		.funktion-row {
			margin-bottom: 15px;
			padding: 12px;
			background: #f8f9fa;
			border-radius: 8px;
			border: 1px solid #e9ecef;
		}
		.add-row-btn {
			width: auto !important;
			padding: 10px 16px !important;
			background: #6c757d !important;
			font-size: 14px !important;
			margin-top: 0 !important;
		}
		.add-row-btn:hover {
			background: #5a6268 !important;
		}
		.remove-funktion-btn {
			width: 36px;
			height: 36px;
			padding: 0;
			background: #dc3545;
			color: white;
			border: none;
			border-radius: 6px;
			font-size: 20px;
			line-height: 1;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.remove-funktion-btn:hover {
			background: #c82333;
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

				<!-- Function/Role Section (multiple functions) -->
				<div class="form-section">
					<div class="section-title">Funktionen im Verein</div>
					<p class="hint" style="margin-bottom: 15px;">Sie können mehrere Funktionen angeben, z.B. Trainer, Vorstand, Abteilungsleiter.</p>
					
					<div id="funktionenContainer">
						${funktionen.length > 0 ? funktionen.map((f, i) => renderFunktionRow(f, i)).join('') : renderFunktionRow({ rolle: '', beginn: '', ende: '' }, 0)}
					</div>
					
					<button type="button" id="addFunktionBtn" class="add-row-btn">+ Weitere Funktion hinzufügen</button>
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
			SV 1945 Untereuerheim e.V. • "Wir sind Untereuerheim" • <a href="${DATENSCHUTZ_URL}" target="_blank" rel="noopener">Datenschutz</a>
		</div>
	</div>

	<script>
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

		// Multiple functions: add row
		document.getElementById('addFunktionBtn').addEventListener('click', function() {
			const container = document.getElementById('funktionenContainer');
			const rows = container.querySelectorAll('.funktion-row');
			const index = rows.length;
			const row = document.createElement('div');
			row.className = 'funktion-row';
			row.dataset.index = String(index);
			row.innerHTML = '<div class="form-row" style="align-items: flex-end;">' +
				'<div class="form-group" style="flex: 2;"><label>Funktion</label><input type="text" class="funktion-rolle" placeholder="z.B. Trainer, Vorstand"></div>' +
				'<div class="form-group" style="flex: 1;"><label>Beginn</label><input type="month" class="funktion-beginn" title="JJJJ-MM"></div>' +
				'<div class="form-group" style="flex: 1;"><label>Ende</label><input type="month" class="funktion-ende" title="Leer = noch aktiv"></div>' +
				'<div class="form-group" style="flex: 0;"><button type="button" class="remove-funktion-btn" title="Entfernen">×</button></div>' +
				'</div>';
			container.appendChild(row);
			row.querySelector('.remove-funktion-btn').addEventListener('click', function() {
				row.remove();
			});
		});

		// Multiple functions: remove row
		document.querySelectorAll('.remove-funktion-btn').forEach(btn => {
			btn.addEventListener('click', function() {
				this.closest('.funktion-row').remove();
			});
		});

		document.getElementById('updateForm').addEventListener('submit', async (e) => {
			e.preventDefault();
			
			const form = e.target;
			const formData = new FormData(form);
			
			// Collect funktionen from dynamic rows
			const funktionen = [];
			document.querySelectorAll('.funktion-row').forEach(row => {
				const rolle = (row.querySelector('.funktion-rolle')?.value || '').trim();
				const beginn = (row.querySelector('.funktion-beginn')?.value || '').trim();
				const ende = (row.querySelector('.funktion-ende')?.value || '').trim();
				if (rolle || beginn || ende) {
					funktionen.push({ rolle, beginn, ende });
				}
			});
			formData.set('funktionen', JSON.stringify(funktionen));
			
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
		.success-icon svg {
			width: 48px;
			height: 48px;
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
		.success-footer {
			margin-top: 24px;
			font-size: 12px;
		}
		.success-footer a {
			color: #999;
			text-decoration: none;
		}
		.success-footer a:hover {
			text-decoration: underline;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="success-icon">${icons.checkLarge}</div>
		<h1>Vielen Dank!</h1>
		<p>${escapeHtml(displayMessage)}</p>
		<p>Sie können dieses Fenster nun schließen.</p>
		<div class="success-footer">
			<a href="${DATENSCHUTZ_URL}" target="_blank" rel="noopener">Datenschutz</a>
		</div>
	</div>
</body>
</html>`;
}

function renderErrorPage(message: string, isExpired: boolean = false): string {
	const isInvalidLink =
		message.includes('Ungültiger') || message.includes('abgelaufen');
	
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
			color: ${isInvalidLink ? '#333' : 'white'};
		}
		.error-icon svg { width: 40px; height: 40px; }
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
		.footer a {
			color: #999;
			text-decoration: none;
		}
		.footer a:hover {
			text-decoration: underline;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="error-icon">${isInvalidLink ? icons.link : icons.warning}</div>
		<h1>${isInvalidLink ? 'Link ungültig oder abgelaufen' : 'Fehler'}</h1>
		<p class="message">${escapeHtml(message)}</p>
		
		${
			isInvalidLink
				? `
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
		`
				: ''
		}
		
		<div class="footer">
			SV 1945 Untereuerheim e.V. • "Wir sind Untereuerheim" • <a href="${DATENSCHUTZ_URL}" target="_blank" rel="noopener">Datenschutz</a>
		</div>
	</div>
</body>
</html>`;
}

export default update;

