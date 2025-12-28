/**
 * Letter generation routes for member mail merge
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { generateMemberToken } from '../utils/tokens';
import { jsonResponse, jsonError } from '../utils/helpers';
import { zipSync } from 'fflate';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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

		// Generate PDFs for each member
		const pdfFiles: Array<{ filename: string; data: Uint8Array }> = await Promise.all(
			result.results.map(async (member: any) => {
				const memberId = member.AdrNr || member.MitglNr;
				const token = await generateMemberToken(memberId, secret);
				const updateUrl = `${baseUrl}/update/${token}`;
				const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(updateUrl)}`;
				
				const pdfBytes = await generateLetterPDF(member, updateUrl, qrCodeUrl);
				
				const filename = `Brief_${member.Nachname}_${member.Vorname}_${memberId}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
				
				return { filename, data: pdfBytes };
			})
		);

		// Create ZIP with PDF files
		const zipContent = createZipFromPdfFiles(pdfFiles);

		const filename = `serienbriefe_${new Date().toISOString().split('T')[0]}.zip`;

		return new Response(zipContent, {
			status: 200,
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Content-Length': zipContent.length.toString(),
			},
		});
	} catch (error: any) {
		console.error('PDF generation error:', error);
		return jsonError(error.message || 'Fehler beim Generieren der PDFs');
	}
});

/**
 * Generate a DIN A4 letter PDF for a member
 */
async function generateLetterPDF(member: any, updateUrl: string, qrCodeUrl: string): Promise<Uint8Array> {
	const pdfDoc = await PDFDocument.create();
	const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
	
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
	
	const { width, height } = page.getSize();
	const margin = 56.7; // 2cm in points
	const lineHeight = 14;
	let yPosition = height - margin;

	// Fetch and embed club logo
	let clubLogo = null;
	try {
		const logoResponse = await fetch('https://sv-untereuerheim.de/wp-content/uploads/2024/11/logo_svu-241x300.png');
		const logoImageBytes = await logoResponse.arrayBuffer();
		clubLogo = await pdfDoc.embedPng(new Uint8Array(logoImageBytes));
	} catch (e) {
		console.warn('Could not embed club logo:', e);
	}

	// Fetch and embed QR code
	let qrImage = null;
	try {
		const qrResponse = await fetch(qrCodeUrl);
		const qrImageBytes = await qrResponse.arrayBuffer();
		qrImage = await pdfDoc.embedPng(new Uint8Array(qrImageBytes));
	} catch (e) {
		console.warn('Could not embed QR code:', e);
	}

	// Draw club logo (top left)
	if (clubLogo) {
		const logoHeight = 50;
		const logoWidth = (clubLogo.width / clubLogo.height) * logoHeight;
		page.drawImage(clubLogo, {
			x: margin,
			y: yPosition - logoHeight,
			width: logoWidth,
			height: logoHeight,
		});
	}

	// Header - Club name (next to logo)
	const headerX = clubLogo ? margin + 50 : margin;
	page.drawText('SV 1945 Untereuerheim e.V.', {
		x: headerX,
		y: yPosition,
		size: 12,
		font: fontBold,
	});
	yPosition -= lineHeight + 5;
	
	page.drawText('"Wir sind Untereuerheim"', {
		x: headerX,
		y: yPosition,
		size: 10,
		font: font,
		color: rgb(0.4, 0.4, 0.4),
	});
	yPosition -= lineHeight * 5;

	// Club address (right side)
	const addressX = width - margin - 160;
	let addressY = height - margin;
	const addressLines = [
		'Sportverein 1945 Untereuerheim e.V.',
		'Triebweg 9',
		'97508 Grettstadt/Untereuerheim',
		'',
		'Tel: 09729/432',
		'info@sv-untereuerheim.de',
        '',
	];
	addressLines.forEach(line => {
		if (line) {
			page.drawText(line, {
				x: addressX,
				y: addressY,
				size: 9,
				font: font,
			});
		}
		addressY -= 12;
	});

	// QR Code (if available) - positioned on the right side
	const qrReservedSpace = qrImage ? 180 : 0;
	if (qrImage) {
		const qrSize = 100;
		const qrX = width - margin - qrSize;
		const qrY = yPosition - 40;
		
		page.drawImage(qrImage, {
			x: qrX,
			y: qrY - qrSize,
			width: qrSize,
			height: qrSize,
		});
		
		// QR code description
		let qrTextY = qrY - qrSize - 10;
		page.drawText('Online aktualisieren:', {
			x: qrX - 5,
			y: qrTextY,
			size: 8,
			font: fontBold,
		});
		qrTextY -= 10;
		
		// Add full URL below QR code (split into multiple lines if needed)
		const fullUrl = updateUrl.replace('https://', '');
		const maxWidth = qrSize + 10;
		
		// Split URL intelligently
		if (fullUrl.includes('/')) {
			const parts = fullUrl.split('/');
			page.drawText(parts[0], {
				x: qrX - 5,
				y: qrTextY,
				size: 6,
				font: font,
			});
			qrTextY -= 8;
			
			// Display rest of URL in chunks
			const remainingUrl = parts.slice(1).join('/');
			const chunkSize = 18;
			for (let i = 0; i < remainingUrl.length; i += chunkSize) {
				const chunk = (i === 0 ? '/' : '') + remainingUrl.substring(i, i + chunkSize);
				page.drawText(chunk, {
					x: qrX - 5,
					y: qrTextY,
					size: 6,
					font: font,
				});
				qrTextY -= 8;
			}
		} else {
			page.drawText(fullUrl, {
				x: qrX - 5,
				y: qrTextY,
				size: 6,
				font: font,
			});
		}
	}

	// Line separator
	page.drawLine({
		start: { x: margin, y: yPosition },
		end: { x: width - margin, y: yPosition },
		thickness: 2,
		color: rgb(0.8, 0, 0),
	});
	yPosition -= lineHeight * 2;

	// Recipient address
	const recipient = [
		`${member.Anrede || ''} ${member.Vorname || ''} ${member.Nachname || ''}`.trim(),
		member.Strasse || '',
		`${member.PLZ || ''} ${member.Ort || ''}`.trim()
	].filter(line => line);

	recipient.forEach(line => {
		page.drawText(line, {
			x: margin,
			y: yPosition,
			size: 11,
			font: font,
		});
		yPosition -= lineHeight;
	});
	yPosition -= lineHeight;

	// Date
	const dateStr = new Date().toLocaleDateString('de-DE', { 
		year: 'numeric', 
		month: 'long', 
		day: 'numeric' 
	});
	page.drawText(`Untereuerheim, den ${dateStr}`, {
		x: margin,
		y: yPosition,
		size: 10,
		font: font,
	});
	yPosition -= lineHeight * 2;

	// Subject
	page.drawText('Aktualisierung Ihrer Mitgliederdaten', {
		x: margin,
		y: yPosition,
		size: 12,
		font: fontBold,
	});
	yPosition -= lineHeight * 2;

	// Greeting
	const greeting = `Sehr geehrte/r ${member.Anrede || ''} ${member.Vorname || ''} ${member.Nachname || ''},`;
	page.drawText(greeting, {
		x: margin,
		y: yPosition,
		size: 11,
		font: font,
	});
	yPosition -= lineHeight * 2;

	// Body text (adjusted to avoid QR code)
	const bodyText = [
		'im Rahmen der Aktualisierung unserer Mitgliederdatenbank bitten wir Sie,',
		'Ihre Daten zu überprüfen und gegebenenfalls zu korrigieren. Bitte nehmen',
		'Sie sich einen Moment Zeit, um die unten aufgeführten Informationen zu',
		'kontrollieren.'
	];
	const textWidth = width - margin * 2 - qrReservedSpace;
	bodyText.forEach(line => {
		page.drawText(line, {
			x: margin,
			y: yPosition,
			size: 11,
			font: font,
		});
		yPosition -= lineHeight;
	});
	yPosition -= lineHeight;

	// Data table header
	page.drawText('Ihre aktuellen Daten:', {
		x: margin,
		y: yPosition,
		size: 11,
		font: fontBold,
	});
	yPosition -= lineHeight * 1.5;

	// Data table
	const tableData = [
		['Mitgliedsnummer:', member.MitglNr ? String(member.MitglNr) : '-'],
		['Anrede:', member.Anrede ? String(member.Anrede) : ''],
		['Vorname:', member.Vorname ? String(member.Vorname) : ''],
		['Nachname:', member.Nachname ? String(member.Nachname) : ''],
		['Straße:', member.Strasse ? String(member.Strasse) : ''],
		['PLZ:', member.PLZ ? String(member.PLZ) : ''],
		['Ort:', member.Ort ? String(member.Ort) : ''],
		['Telefon:', member.Telefon ? String(member.Telefon) : ''],
		['Mobil:', member.Mobil ? String(member.Mobil) : ''],
		['E-Mail:', member.EMail ? String(member.EMail) : ''],
		['IBAN:', member.IBAN ? String(member.IBAN) : ''],
		['Bank:', member.Bankbezeichnung ? String(member.Bankbezeichnung) : ''],
		['Abteilung:', member.Abteilung ? String(member.Abteilung) : ''],
	];

	const labelWidth = 120;
	tableData.forEach(([label, value]) => {
		if (yPosition < margin + 100) return; // Stop if too close to bottom
		
		// Draw label
		page.drawText(label, {
			x: margin,
			y: yPosition,
			size: 9,
			font: fontBold,
		});
		
		// Draw value
		page.drawText(value, {
			x: margin + labelWidth,
			y: yPosition,
			size: 9,
			font: font,
		});
		
		// Draw line
		page.drawLine({
			start: { x: margin, y: yPosition - 3 },
			end: { x: width - margin - 140, y: yPosition - 3 },
			thickness: 0.5,
			color: rgb(0.8, 0.8, 0.8),
		});
		
		yPosition -= lineHeight + 2;
	});

	// Continue on second page if needed
	if (yPosition < margin + 150) {
		const page2 = pdfDoc.addPage([595.28, 841.89]);
		yPosition = height - margin;
		
		// Instructions box
		page2.drawRectangle({
			x: margin,
			y: yPosition - 120,
			width: width - 2 * margin,
			height: 110,
			borderColor: rgb(0.8, 0, 0),
			borderWidth: 2,
			color: rgb(1, 0.98, 0.9),
		});
		
		yPosition -= 15;
		page2.drawText('So können Sie Ihre Daten aktualisieren:', {
			x: margin + 10,
			y: yPosition,
			size: 10,
			font: fontBold,
		});
		yPosition -= lineHeight + 3;
		
        const instructions = [
            '• Online (empfohlen): Scannen Sie den QR-Code mit Ihrem Smartphone',
            `  oder besuchen Sie: ${updateUrl}`,
            '• Per Post: Tragen Sie Korrekturen direkt in die Tabelle ein und senden',
            '  Sie das ausgefüllte Formular zurück an die oben genannte Adresse',
            '• Persönlich: Geben Sie das ausgefüllte Formular bei einem',
            '  Vorstandsmitglied ab'
        ];
		
		instructions.forEach(line => {
			page2.drawText(line, {
				x: margin + 10,
				y: yPosition,
				size: 9,
				font: font,
			});
			yPosition -= lineHeight;
		});
		
		yPosition -= lineHeight * 2;
		
		// Closing
		page2.drawText('Vielen Dank für Ihre Unterstützung!', {
			x: margin,
			y: yPosition,
			size: 11,
			font: font,
		});
		yPosition -= lineHeight * 3;
		
		page2.drawText('Mit sportlichen Grüßen', {
			x: margin,
			y: yPosition,
			size: 11,
			font: font,
		});
		yPosition -= lineHeight;
		
		page2.drawText('Der Vorstand des SV 1945 Untereuerheim e.V.', {
			x: margin,
			y: yPosition,
			size: 11,
			font: fontBold,
		});
		
		// Footer
		const footerText = 'Sportverein 1945 Untereuerheim e.V. • Registergericht Schweinfurt • Steuer-ID: 249/111/20506';
		page2.drawText(footerText, {
			x: margin,
			y: 30,
			size: 7,
			font: font,
			color: rgb(0.5, 0.5, 0.5),
		});
	} else {
		// Add instructions and closing on first page
		yPosition -= lineHeight;
		
		// Instructions
		const shortInstructions = [
			'So können Sie Ihre Daten aktualisieren:',
			'• Online: Scannen Sie den QR-Code oben rechts',
			'• Per Post: Korrekturen eintragen und zurücksenden',
			'• Persönlich: Bei einem Vorstandsmitglied abgeben'
		];
		
		shortInstructions.forEach((line, i) => {
			page.drawText(line, {
				x: margin,
				y: yPosition,
				size: 9,
				font: i === 0 ? fontBold : font,
			});
			yPosition -= lineHeight;
		});
		
		yPosition -= lineHeight;
		
		// Closing
		page.drawText('Vielen Dank für Ihre Unterstützung!', {
			x: margin,
			y: yPosition,
			size: 11,
			font: font,
		});
		yPosition -= lineHeight * 2;
		
		page.drawText('Mit sportlichen Grüßen', {
			x: margin,
			y: yPosition,
			size: 11,
			font: font,
		});
		yPosition -= lineHeight;
		
		page.drawText('Der Vorstand des SV 1945 Untereuerheim e.V.', {
			x: margin,
			y: yPosition,
			size: 11,
			font: fontBold,
		});
		
		// Footer
		const footerText = 'Sportverein 1945 Untereuerheim e.V. • Registergericht Schweinfurt • Steuer-ID: 249/111/20506';
		page.drawText(footerText, {
			x: margin,
			y: 30,
			size: 7,
			font: font,
			color: rgb(0.5, 0.5, 0.5),
		});
	}

	return await pdfDoc.save();
}

/**
 * Create a ZIP file from PDF files
 */
function createZipFromPdfFiles(files: Array<{ filename: string; data: Uint8Array }>): Uint8Array {
	const fileMap: Record<string, Uint8Array> = {};
	
	for (const file of files) {
		fileMap[file.filename] = file.data;
	}
	
	// Add a README
	const encoder = new TextEncoder();
	const readmeText = 
		'SV 1945 Untereuerheim - Serienbriefe\n\n' +
		'Diese PDF-Dateien koennen Sie:\n' +
		'1. Direkt ausdrucken und per Post versenden\n' +
		'2. Per E-Mail an Mitglieder senden\n\n' +
		'Jeder Brief enthaelt:\n' +
		'- Aktuelle Mitgliederdaten\n' +
		'- QR-Code fuer Online-Aktualisierung\n' +
		'- Eindeutige Update-URL (90 Tage gueltig)\n' +
		'- Anleitung fuer Datenaktualisierung\n\n' +
		'Generiert am: ' + new Date().toLocaleString('de-DE') + '\n' +
		'Anzahl Briefe: ' + files.length;
	
	fileMap['README.txt'] = encoder.encode(readmeText);
	
	try {
		// Create ZIP using fflate
		const zipped = zipSync(fileMap, {
			level: 6,
		});
		
		return zipped;
	} catch (error) {
		console.error('ZIP creation error:', error);
		throw error;
	}
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
