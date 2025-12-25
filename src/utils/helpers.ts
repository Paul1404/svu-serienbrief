/**
 * Utility helper functions
 */

export function escapeHtml(text: string): string {
	const map: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;',
	};
	return text.replace(/[&<>"']/g, (m) => map[m]);
}

export function sanitizeIdentifier(name: string): string {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
		throw new Error('Invalid identifier');
	}
	return name;
}

export function jsonResponse(data: any): Response {
	return new Response(JSON.stringify(data), {
		headers: { 'Content-Type': 'application/json' },
	});
}

export function jsonError(message: string, status = 500): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}
