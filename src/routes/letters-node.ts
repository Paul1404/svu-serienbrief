/**
 * Letter generation routes for member mail merge (Node/Neon version).
 * Ported from the original Cloudflare D1 implementation to Postgres/Neon.
 */

import { Hono } from 'hono';
import { generateMemberToken } from '../utils/tokens';
import { jsonResponse, jsonError } from '../utils/helpers';
import { zipSync } from 'fflate';
import { PDFDocument, rgb, StandardFonts, PDFArray, PDFName } from 'pdf-lib';
import { encode as encodeQR } from 'uqr';
import { query } from '../db';

const letters = new Hono();

// Batch size for SQL queries (kept conservative)
const SQL_BATCH_SIZE = 50;
// Batch size for PDF generation (memory management)
const PDF_BATCH_SIZE = 10;

/**
 * Normalize member ID - removes .0 from floats, handles missing IDs
 */
function normalizeMemberId(member: any): string | null {
	const raw = member.AdrNr || member.MitglNr;
	if (raw === null || raw === undefined) return null;
	const str = String(raw);
	return str.endsWith('.0') ? str.slice(0, -2) : str;
}

/**
 * Generate PDFs for selected members and return as ZIP
 */
letters.post('/generate-pdfs', async (c) => {
	try {
		const { memberIds, validityDays = 90 } = await c.req.json();

		if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
			return jsonError('Keine Mitglieder-IDs angegeben', 400);
		}

		const tokenValidityDays = Math.min(
			Math.max(Number(validityDays) || 90, 7),
			730
		);

		const allMembers: any[] = [];
		const seenIds = new Set<string>();

		for (let i = 0; i < memberIds.length; i += SQL_BATCH_SIZE) {
			const batchIds = memberIds.slice(i, i + SQL_BATCH_SIZE);
			const placeholders = batchIds
				.map((_, idx) => `$${idx + 1}`)
				.join(',');

			// First query: lookup by AdrNr
			const result1 = await query<any>(
				`SELECT * FROM auswertung WHERE AdrNr IN (${placeholders})`,
				batchIds
			);

			for (const member of result1.rows as any[]) {
				const id = normalizeMemberId(member);
				if (id && !seenIds.has(id)) {
					seenIds.add(id);
					allMembers.push(member);
				}
			}

			// Second query: lookup by MitglNr (for any not found by AdrNr)
			const result2 = await query<any>(
				`SELECT * FROM auswertung WHERE MitglNr IN (${placeholders})`,
				batchIds
			);

			for (const member of result2.rows as any[]) {
				const id = normalizeMemberId(member);
				if (id && !seenIds.has(id)) {
					seenIds.add(id);
					allMembers.push(member);
				}
			}
		}

		if (allMembers.length === 0) {
			return jsonError('Keine Mitglieder gefunden', 404);
		}

		const baseUrl = new URL(c.req.url).origin.replace(/^http:/, 'https:');
		const secret = process.env.ADMIN_PASSWORD || '';

		// Pre-fetch club logo once
		let cachedLogoBytes: Uint8Array | null = null;
		try {
			const logoResponse = await fetch(
				'https://sv-untereuerheim.de/wp-content/uploads/2024/11/logo_svu-241x300.png'
			);
			if (logoResponse.ok) {
				cachedLogoBytes = new Uint8Array(await logoResponse.arrayBuffer());
			}
		} catch (e) {
			console.warn('Could not pre-fetch club logo:', e);
		}

		const pdfFiles: Array<{ filename: string; data: Uint8Array }> = [];

		for (let i = 0; i < allMembers.length; i += PDF_BATCH_SIZE) {
			const batch = allMembers.slice(i, i + PDF_BATCH_SIZE);

			const batchResults = await Promise.all(
				batch.map(async (member: any) => {
					const memberId = normalizeMemberId(member);
					if (!memberId) {
						console.warn(
							'Skipping member without ID:',
							member.Vorname,
							member.Nachname
						);
						return null;
					}

					const token = await generateMemberToken(memberId, secret);
					const updateUrl = `${baseUrl}/update/${token}`;

					const now = Date.now();
					const expiresAt = now + tokenValidityDays * 24 * 60 * 60 * 1000;

					await query(
						`INSERT INTO member_tokens (member_id, token, generated_at, expires_at, regenerated_count)
						 VALUES ($1, $2, $3, $4, 0)
						 ON CONFLICT (member_id) DO UPDATE SET
						 	token = EXCLUDED.token,
						 	generated_at = EXCLUDED.generated_at,
						 	expires_at = EXCLUDED.expires_at,
						 	regenerated_count = member_tokens.regenerated_count + 1`,
						[memberId, token, now, expiresAt]
					);

					const pdfBytes = await generateLetterPDF(
						member,
						updateUrl,
						cachedLogoBytes
					);

					const filename = `Brief_${member.Nachname}_${member.Vorname}_${memberId}.pdf`.replace(
						/[^a-zA-Z0-9_.-]/g,
						'_'
					);

					return { filename, data: pdfBytes };
				})
			);

			pdfFiles.push(
				...batchResults.filter(
					(r): r is { filename: string; data: Uint8Array } => r !== null
				)
			);
		}

		const zipContent = createZipFromPdfFiles(pdfFiles);

		const now = new Date();
		const pad = (num: number) => num.toString().padStart(2, '0');
		const timestamp = `${now.getFullYear()}-${pad(
			now.getMonth() + 1
		)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(
			now.getMinutes()
		)}-${pad(now.getSeconds())}`;
		const filename = `serienbriefe_${timestamp}.zip`;

		return new Response(zipContent, {
			status: 200,
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Content-Length': zipContent.length.toString()
			}
		});
	} catch (error: any) {
		console.error('PDF generation error:', error);
		return jsonError(error.message || 'Fehler beim Generieren der PDFs');
	}
});

/**
 * Generate a DIN A4 letter PDF for a member
 * (logic copied from original implementation)
 */
async function generateLetterPDF(
	member: any,
	updateUrl: string,
	cachedLogoBytes?: Uint8Array | null
): Promise<Uint8Array> {
	const pdfDoc = await PDFDocument.create();
	const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points

	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

	const { width, height } = page.getSize();
	const margin = 56.7; // 2cm in points
	const lineHeight = 14;
	let yPosition = height - margin;

	let clubLogo = null;
	try {
		if (cachedLogoBytes) {
			clubLogo = await pdfDoc.embedPng(cachedLogoBytes);
		} else {
			const logoResponse = await fetch(
				'https://sv-untereuerheim.de/wp-content/uploads/2024/11/logo_svu-241x300.png'
			);
			const logoImageBytes = await logoResponse.arrayBuffer();
			clubLogo = await pdfDoc.embedPng(new Uint8Array(logoImageBytes));
		}
	} catch (e) {
		console.warn('Could not embed club logo:', e);
	}

	let qrMatrix: boolean[][] | null = null;
	try {
		const qrResult = encodeQR(updateUrl);
		qrMatrix = qrResult.data;
	} catch (e) {
		console.warn('Could not generate QR code:', e);
	}

	if (clubLogo) {
		const logoHeight = 50;
		const logoWidth = (clubLogo.width / clubLogo.height) * logoHeight;
		page.drawImage(clubLogo, {
			x: margin,
			y: yPosition - logoHeight,
			width: logoWidth,
			height: logoHeight
		});
	}

	const headerX = clubLogo ? margin + 50 : margin;
	page.drawText('SV 1945 Untereuerheim e.V.', {
		x: headerX,
		y: yPosition,
		size: 12,
		font: fontBold
	});
	yPosition -= lineHeight + 5;

	page.drawText('"Wir sind Untereuerheim"', {
		x: headerX,
		y: yPosition,
		size: 10,
		font,
		color: rgb(0.4, 0.4, 0.4)
	});
	yPosition -= lineHeight * 5;

	const addressX = width - margin - 160;
	let addressY = height - margin;
	const addressLines = [
		'Sportverein 1945 Untereuerheim e.V.',
		'Triebweg 9',
		'97508 Grettstadt/Untereuerheim',
		'',
		'Tel: 09729/432',
		'info@sv-untereuerheim.de',
		''
	];
	addressLines.forEach((line) => {
		if (line) {
			page.drawText(line, {
				x: addressX,
				y: addressY,
				size: 9,
				font
			});
		}
		addressY -= 12;
	});

	const qrReservedSpace = qrMatrix ? 180 : 0;
	if (qrMatrix) {
		const qrSize = 100;
		const qrX = width - margin - qrSize;
		const qrY = yPosition - 40;

		const moduleCount = qrMatrix.length;
		const moduleSize = qrSize / moduleCount;

		page.drawRectangle({
			x: qrX,
			y: qrY - qrSize,
			width: qrSize,
			height: qrSize,
			color: rgb(1, 1, 1)
		});

		for (let row = 0; row < moduleCount; row++) {
			for (let col = 0; col < moduleCount; col++) {
				if (qrMatrix[row][col]) {
					page.drawRectangle({
						x: qrX + col * moduleSize,
						y: qrY - qrSize + (moduleCount - 1 - row) * moduleSize,
						width: moduleSize,
						height: moduleSize,
						color: rgb(0, 0, 0)
					});
				}
			}
		}

		let qrTextY = qrY - qrSize - 10;
		page.drawText('Online aktualisieren:', {
			x: qrX - 5,
			y: qrTextY,
			size: 8,
			font: fontBold
		});
		qrTextY -= 10;

		const fullUrl = updateUrl.replace('https://', '');

		if (fullUrl.includes('/')) {
			const parts = fullUrl.split('/');
			page.drawText(parts[0], {
				x: qrX - 5,
				y: qrTextY,
				size: 6,
				font,
				color: rgb(0, 0, 1)
			});
			qrTextY -= 8;

			const remainingUrl = parts.slice(1).join('/');
			const chunkSize = 18;
			for (let i = 0; i < remainingUrl.length; i += chunkSize) {
				const chunk =
					(i === 0 ? '/' : '') + remainingUrl.substring(i, i + chunkSize);
				page.drawText(chunk, {
					x: qrX - 5,
					y: qrTextY,
					size: 6,
					font,
					color: rgb(0, 0, 1)
				});
				qrTextY -= 8;
			}
		} else {
			page.drawText(fullUrl, {
				x: qrX - 5,
				y: qrTextY,
				size: 6,
				font,
				color: rgb(0, 0, 1)
			});
		}

		const linkEndY = qrTextY - 5;
		const linkAnnotation = {
			Type: 'Annot',
			Subtype: 'Link',
			Rect: [qrX - 5, linkEndY, qrX + qrSize + 5, qrY + 10],
			Border: [0, 0, 0],
			C: [0, 0, 1],
			A: {
				Type: 'Action',
				S: 'URI',
				URI: updateUrl
			}
		};

		const linkRef = pdfDoc.context.register(pdfDoc.context.obj(linkAnnotation));
		const existingAnnots = page.node.lookup(
			pdfDoc.context.obj('Annots')
		) as PDFArray | undefined;

		if (existingAnnots instanceof PDFArray) {
			existingAnnots.push(linkRef);
		} else {
			page.node.set(
				PDFName.of('Annots'),
				pdfDoc.context.obj([linkRef])
			);
		}
	}

	page.drawLine({
		start: { x: margin, y: yPosition },
		end: { x: width - margin, y: yPosition },
		thickness: 2,
		color: rgb(0.8, 0, 0)
	});
	yPosition -= lineHeight * 2;

	const recipient = [
		`${member.Anrede || ''} ${member.Vorname || ''} ${
			member.Nachname || ''
		}`.trim(),
		member.Strasse || '',
		`${member.PLZ || ''} ${member.Ort || ''}`.trim()
	].filter((line: string) => line);

	recipient.forEach((line: string) => {
		page.drawText(line, {
			x: margin,
			y: yPosition,
			size: 11,
			font
		});
		yPosition -= lineHeight;
	});
	yPosition -= lineHeight;

	const dateStr = new Date().toLocaleDateString('de-DE', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
	page.drawText(`Untereuerheim, den ${dateStr}`, {
		x: margin,
		y: yPosition,
		size: 10,
		font
	});
	yPosition -= lineHeight * 2;

	page.drawText('Aktualisierung Ihrer Mitgliederdaten', {
		x: margin,
		y: yPosition,
		size: 12,
		font: fontBold
	});
	yPosition -= lineHeight * 2;

	const greeting = `Sehr geehrte/r ${member.Anrede || ''} ${
		member.Vorname || ''
	} ${member.Nachname || ''},`;
	page.drawText(greeting, {
		x: margin,
		y: yPosition,
		size: 11,
		font
	});
	yPosition -= lineHeight * 2;

	const bodyText = [
		'im Rahmen der Aktualisierung unserer Mitgliederdatenbank bitten wir Sie,',
		'Ihre Daten zu überprüfen und gegebenenfalls zu korrigieren. Bitte nehmen',
		'Sie sich einen Moment Zeit, um die unten aufgeführten Informationen zu',
		'kontrollieren.'
	];
	const textWidth = width - margin * 2 - qrReservedSpace;
	bodyText.forEach((line) => {
		page.drawText(line, {
			x: margin,
			y: yPosition,
			size: 11,
			font
		});
		yPosition -= lineHeight;
	});
	yPosition -= lineHeight;

	page.drawText('Ihre aktuellen Daten:', {
		x: margin,
		y: yPosition,
		size: 11,
		font: fontBold
	});
	yPosition -= lineHeight * 1.5;

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
		['Abteilung:', member.Abteilung ? String(member.Abteilung) : '']
	];

	const labelWidth = 120;
	for (const [label, value] of tableData) {
		if (yPosition < margin + 100) break;

		page.drawText(label, {
			x: margin,
			y: yPosition,
			size: 9,
			font: fontBold
		});

		page.drawText(value, {
			x: margin + labelWidth,
			y: yPosition,
			size: 9,
			font
		});

		page.drawLine({
			start: { x: margin, y: yPosition - 3 },
			end: { x: width - margin - 140, y: yPosition - 3 },
			thickness: 0.5,
			color: rgb(0.8, 0.8, 0.8)
		});

		yPosition -= lineHeight + 2;
	}

	if (yPosition < margin + 150) {
		const page2 = pdfDoc.addPage([595.28, 841.89]);
		yPosition = height - margin;

		page2.drawRectangle({
			x: margin,
			y: yPosition - 120,
			width: width - 2 * margin,
			height: 110,
			borderColor: rgb(0.8, 0, 0),
			borderWidth: 2,
			color: rgb(1, 0.98, 0.9)
		});

		yPosition -= 15;
		page2.drawText('So können Sie Ihre Daten aktualisieren:', {
			x: margin + 10,
			y: yPosition,
			size: 10,
			font: fontBold
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

		instructions.forEach((line) => {
			page2.drawText(line, {
				x: margin + 10,
				y: yPosition,
				size: 9,
				font
			});
			yPosition -= lineHeight;
		});

		yPosition -= lineHeight * 2;

		page2.drawText('Vielen Dank für Ihre Unterstützung!', {
			x: margin,
			y: yPosition,
			size: 11,
			font
		});
		yPosition -= lineHeight * 3;

		page2.drawText('Mit sportlichen Grüßen', {
			x: margin,
			y: yPosition,
			size: 11,
			font
		});
		yPosition -= lineHeight;

		page2.drawText(
			'Der Vorstand des SV 1945 Untereuerheim e.V.',
			{
				x: margin,
				y: yPosition,
				size: 11,
				font: fontBold
			}
		);

		const footerText =
			'Sportverein 1945 Untereuerheim e.V. • Registergericht Schweinfurt • Steuer-ID: 249/111/20506';
		page2.drawText(footerText, {
			x: margin,
			y: 30,
			size: 7,
			font,
			color: rgb(0.5, 0.5, 0.5)
		});
	} else {
		yPosition -= lineHeight;

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
				font: i === 0 ? fontBold : font
			});
			yPosition -= lineHeight;
		});

		yPosition -= lineHeight;

		page.drawText('Vielen Dank für Ihre Unterstützung!', {
			x: margin,
			y: yPosition,
			size: 11,
			font
		});
		yPosition -= lineHeight * 2;

		page.drawText('Mit sportlichen Grüßen', {
			x: margin,
			y: yPosition,
			size: 11,
			font
		});
		yPosition -= lineHeight;

		page.drawText(
			'Der Vorstand des SV 1945 Untereuerheim e.V.',
			{
				x: margin,
				y: yPosition,
				size: 11,
				font: fontBold
			}
		);

		const footerText =
			'Sportverein 1945 Untereuerheim e.V. • Registergericht Schweinfurt • Steuer-ID: 249/111/20506';
		page.drawText(footerText, {
			x: margin,
			y: 30,
			size: 7,
			font,
			color: rgb(0.5, 0.5, 0.5)
		});
	}

	return await pdfDoc.save();
}

/**
 * Create a ZIP file from PDF files
 */
function createZipFromPdfFiles(
	files: Array<{ filename: string; data: Uint8Array }>
): Uint8Array {
	const fileMap: Record<string, Uint8Array> = {};

	for (const file of files) {
		fileMap[file.filename] = file.data;
	}

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
		'Generiert am: ' +
		new Date().toLocaleString('de-DE') +
		'\n' +
		'Anzahl Briefe: ' +
		files.length;

	fileMap['README.txt'] = encoder.encode(readmeText);

	try {
		const zipped = zipSync(fileMap, {
			level: 6
		});

		return zipped;
	} catch (error) {
		console.error('ZIP creation error:', error);
		throw error;
	}
}

/**
 * Generate letter data for all members (JSON)
 */
letters.get('/generate', async (c) => {
	try {
		const result = await query<any>(
			`SELECT * FROM auswertung ORDER BY AdrNr`
		);

		const baseUrl = new URL(c.req.url).origin.replace(/^http:/, 'https:');
		const secret = process.env.ADMIN_PASSWORD || '';

		const letterData = await Promise.all(
			(result.rows || []).map(async (member: any) => {
				const token = await generateMemberToken(
					member.AdrNr || member.MitglNr,
					secret
				);
				const updateUrl = `${baseUrl}/update/${token}`;

				return {
					member,
					updateUrl,
					qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
						updateUrl
					)}`
				};
			})
		);

		return jsonResponse({
			count: letterData.length,
			letters: letterData,
			generatedAt: new Date().toISOString()
		});
	} catch (error: any) {
		console.error('Letter generation error:', error);
		return jsonError(error.message);
	}
});

export default letters;

