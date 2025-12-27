/**
 * Letter generation routes for member mail merge
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { generateMemberToken } from '../utils/tokens';
import { jsonResponse, jsonError } from '../utils/helpers';
import { zipSync, strToU8 } from 'fflate';

const letters = new Hono<{ Bindings: Env }>();

/**
 * Generate PDFs for selected members and return as ZIP
 */
letters.post('/generate-pdfs', async (c) => {
	try {
		const { memberIds } = await c.req.json();

		if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
			return jsonError('Keine Mitglieder-IDs angegeben', 400);
		}

		// Fetch member data
		const placeholders = memberIds.map(() => '?').join(',');
		const result = await c.env.svu_prod01.prepare(
			`SELECT * FROM auswertung WHERE AdrNr IN (${placeholders}) OR MitglNr IN (${placeholders})`
		).bind(...memberIds, ...memberIds).all();

		if (!result.results || result.results.length === 0) {
			return jsonError('Keine Mitglieder gefunden', 404);
		}

		const baseUrl = new URL(c.req.url).origin;
		const secret = c.env.ADMIN_PASSWORD;

		// Generate HTML for each member
		const htmlDocuments: Array<{ filename: string; html: string }> = await Promise.all(
			result.results.map(async (member: any) => {
				const memberId = member.AdrNr || member.MitglNr;
				const token = await generateMemberToken(memberId, secret);
				const updateUrl = `${baseUrl}/update/${token}`;
				const html = renderLetterHTML(member, updateUrl);
				
				const filename = `Brief_${member.Nachname}_${member.Vorname}_${memberId}.html`.replace(/[^a-zA-Z0-9_.-]/g, '_');
				
				return { filename, html };
			})
		);

		// For now, we'll create a simple ZIP with HTML files
		// In production, you'd want to convert these to PDFs using Puppeteer or a PDF service
		const zipContent = await createZipFromHtmlFiles(htmlDocuments);

		return new Response(zipContent, {
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="serienbriefe_${new Date().toISOString().split('T')[0]}.zip"`,
			},
		});
	} catch (error: any) {
		console.error('PDF generation error:', error);
		return jsonError(error.message);
	}
});

/**
 * Create a ZIP file from HTML files using fflate
 */
async function createZipFromHtmlFiles(files: Array<{ filename: string; html: string }>): Promise<Uint8Array> {
	// Create a file map for fflate
	const fileMap: Record<string, Uint8Array> = {};
	
	for (const file of files) {
		fileMap[file.filename] = strToU8(file.html);
	}
	
	// Add a README
	fileMap['README.txt'] = strToU8(
		'SV 1945 Untereuerheim - Serienbriefe\n\n' +
		'Diese HTML-Dateien können Sie:\n' +
		'1. Im Browser öffnen und als PDF drucken (Strg+P oder Cmd+P)\n' +
		'2. Mit einem PDF-Drucker in PDF konvertieren\n' +
		'3. Direkt ausdrucken\n\n' +
		'Jeder Brief enthält:\n' +
		'- Mitgliederdaten\n' +
		'- QR-Code für Online-Aktualisierung\n' +
		'- Eindeutige Update-URL\n\n' +
		'Generiert am: ' + new Date().toLocaleString('de-DE')
	);
	
	// Create ZIP
	const zipped = zipSync(fileMap, {
		level: 6, // Compression level (0-9)
	});
	
	return zipped;
}

/**
 * Generate letter data for all members
 * Returns JSON with member data and unique update URLs
 */
letters.get('/generate', async (c) => {
	try {
		const result = await c.env.svu_prod01.prepare(
			`SELECT * FROM auswertung ORDER BY AdrNr`
		).all();

		const baseUrl = new URL(c.req.url).origin;
		const secret = c.env.ADMIN_PASSWORD; // Use password as signing secret

		const letterData = await Promise.all(
			(result.results || []).map(async (member: any) => {
				const token = await generateMemberToken(member.AdrNr || member.MitglNr, secret);
				const updateUrl = `${baseUrl}/update/${token}`;

				return {
					member,
					updateUrl,
					qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(updateUrl)}`,
				};
			})
		);

		return jsonResponse({
			count: letterData.length,
			letters: letterData,
			generatedAt: new Date().toISOString(),
		});
	} catch (error: any) {
		console.error('Letter generation error:', error);
		return jsonError(error.message);
	}
});

/**
 * Generate letter HTML for a specific member (for preview)
 */
letters.get('/preview/:token', async (c) => {
	try {
		const token = c.req.param('token');
		const baseUrl = new URL(c.req.url).origin;

		// For preview, we'll just use the first member
		const result = await c.env.svu_prod01.prepare(
			`SELECT * FROM auswertung LIMIT 1`
		).first();

		if (!result) {
			return c.html('<h1>Keine Mitglieder gefunden</h1>', 404);
		}

		const updateUrl = `${baseUrl}/update/${token}`;
		const html = renderLetterHTML(result, updateUrl);

		return c.html(html);
	} catch (error: any) {
		return c.html(`<h1>Fehler</h1><p>${error.message}</p>`, 500);
	}
});

/**
 * Render letter HTML with member data and QR code
 */
function renderLetterHTML(member: any, updateUrl: string): string {
	const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(updateUrl)}`;
	
	return `<!DOCTYPE html>
<html lang="de">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Mitgliederdaten - ${member.Vorname} ${member.Nachname}</title>
	<style>
		@page { size: A4; margin: 2cm; }
		@media print {
			body { margin: 0; }
			.no-print { display: none; }
			.print-button { display: none; }
		}
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: Arial, sans-serif;
			line-height: 1.6;
			color: #333;
			max-width: 21cm;
			margin: 0 auto;
			padding: 20px;
			background: white;
		}
		.print-button {
			position: fixed;
			top: 20px;
			right: 20px;
			padding: 12px 24px;
			background: #CC0000;
			color: white;
			border: none;
			border-radius: 6px;
			font-weight: 600;
			cursor: pointer;
			box-shadow: 0 2px 8px rgba(0,0,0,0.2);
			z-index: 1000;
		}
		.print-button:hover {
			background: #990000;
		}
		.header {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			margin-bottom: 30px;
			padding-bottom: 20px;
			border-bottom: 3px solid #CC0000;
		}
		.header-left h1 {
			color: #CC0000;
			font-size: 20px;
			margin-bottom: 5px;
		}
		.header-left p {
			font-size: 12px;
			color: #666;
		}
		.header-right {
			text-align: right;
			font-size: 11px;
		}
		.qr-section {
			float: right;
			text-align: center;
			margin: 0 0 20px 20px;
			padding: 15px;
			border: 2px solid #CC0000;
			border-radius: 8px;
			background: #f9f9f9;
		}
		.qr-section img {
			width: 150px;
			height: 150px;
			display: block;
			margin: 0 auto 10px;
		}
		.qr-section p {
			font-size: 11px;
			color: #666;
			max-width: 150px;
		}
		.content {
			margin-top: 30px;
		}
		.content h2 {
			color: #CC0000;
			font-size: 16px;
			margin-bottom: 15px;
		}
		.content p {
			margin-bottom: 15px;
			text-align: justify;
		}
		.data-table {
			width: 100%;
			border-collapse: collapse;
			margin: 20px 0;
			clear: both;
		}
		.data-table th,
		.data-table td {
			padding: 10px;
			border: 1px solid #ddd;
			text-align: left;
		}
		.data-table th {
			background: #f5f5f5;
			font-weight: 600;
			width: 35%;
		}
		.data-table tr:nth-child(even) {
			background: #fafafa;
		}
		.editable-cell {
			background: white;
			min-height: 30px;
		}
		.instructions {
			background: #fff3cd;
			border-left: 4px solid #CC0000;
			padding: 15px;
			margin: 20px 0;
		}
		.instructions h3 {
			color: #CC0000;
			font-size: 14px;
			margin-bottom: 10px;
		}
		.instructions ul {
			margin-left: 20px;
			font-size: 13px;
		}
		.instructions li {
			margin-bottom: 5px;
		}
		.footer {
			margin-top: 40px;
			padding-top: 20px;
			border-top: 1px solid #ddd;
			font-size: 11px;
			color: #666;
			text-align: center;
		}
	</style>
</head>
<body>
	<button class="print-button no-print" onclick="window.print()">🖨️ Als PDF drucken</button>
	
	<div class="header">
		<div class="header-left">
			<h1>SV 1945 Untereuerheim e.V.</h1>
			<p>"Wir sind Untereuerheim"</p>
		</div>
		<div class="header-right">
			<strong>SV 1945 Untereuerheim e.V.</strong><br>
			Hauptstraße 42<br>
			97508 Untereuerheim<br>
			Tel: 09729 / 123456
		</div>
	</div>

	<div class="qr-section">
		<img src="${qrCodeUrl}" alt="QR Code für Datenaktualisierung" />
		<p><strong>Online aktualisieren:</strong><br>Scannen Sie diesen QR-Code mit Ihrem Smartphone</p>
	</div>

	<div class="content">
		<h2>Aktualisierung Ihrer Mitgliederdaten</h2>
		
		<p>Sehr geehrte/r ${member.Anrede || ''} ${member.Vorname || ''} ${member.Nachname || ''},</p>
		
		<p>im Rahmen der Aktualisierung unserer Mitgliederdatenbank möchten wir Sie bitten, Ihre 
		aktuellen Daten zu überprüfen und gegebenenfalls zu korrigieren.</p>

		<h2>Ihre aktuellen Daten:</h2>

		<table class="data-table">
			<tr>
				<th>Mitgliedsnummer</th>
				<td>${member.MitglNr || '-'}</td>
			</tr>
			<tr>
				<th>Anrede</th>
				<td>${member.Anrede || ''}</td>
			</tr>
			<tr>
				<th>Vorname</th>
				<td>${member.Vorname || ''}</td>
			</tr>
			<tr>
				<th>Nachname</th>
				<td>${member.Nachname || ''}</td>
			</tr>
			<tr>
				<th>Straße</th>
				<td>${member.Strasse || ''}</td>
			</tr>
			<tr>
				<th>PLZ</th>
				<td>${member.PLZ || ''}</td>
			</tr>
			<tr>
				<th>Ort</th>
				<td>${member.Ort || ''}</td>
			</tr>
			<tr>
				<th>Telefon</th>
				<td>${member.Telefon || ''}</td>
			</tr>
			<tr>
				<th>Mobil</th>
				<td>${member.Mobil || ''}</td>
			</tr>
			<tr>
				<th>E-Mail</th>
				<td>${member.EMail || ''}</td>
			</tr>
			<tr>
				<th>IBAN</th>
				<td>${member.IBAN || ''}</td>
			</tr>
			<tr>
				<th>Bank</th>
				<td>${member.Bankbezeichnung || ''}</td>
			</tr>
			<tr>
				<th>Abteilung</th>
				<td>${member.Abteilung || ''}</td>
			</tr>
		</table>

		<div class="instructions">
			<h3>So können Sie Ihre Daten aktualisieren:</h3>
			<ul>
				<li><strong>Online (empfohlen):</strong> Scannen Sie den QR-Code oben rechts mit Ihrem Smartphone 
				oder besuchen Sie die folgende Adresse: <br><small>${updateUrl}</small></li>
				<li><strong>Per Post:</strong> Tragen Sie Korrekturen direkt in diese Tabelle ein und senden 
				Sie das ausgefüllte Formular zurück an die oben genannte Adresse</li>
				<li><strong>Persönlich:</strong> Geben Sie das ausgefüllte Formular bei einem Vorstandsmitglied ab</li>
			</ul>
		</div>

		<p>Vielen Dank für Ihre Unterstützung!</p>
		
		<p style="margin-top: 30px;">
			Mit sportlichen Grüßen<br>
			<strong>Der Vorstand des SV 1945 Untereuerheim e.V.</strong>
		</p>
	</div>

	<div class="footer">
		SV 1945 Untereuerheim e.V. • Vereinsregister AG Schweinfurt • Steuernummer: 123/456/78901
	</div>
</body>
</html>`;
}

export default letters;
