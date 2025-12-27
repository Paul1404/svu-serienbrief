/**
 * Token generation and validation for member update links
 */

/**
 * Generate a secure token for a member
 * Format: base64url(memberId:timestamp:hmac)
 */
export async function generateMemberToken(
	memberId: string | number,
	secret: string
): Promise<string> {
	const timestamp = Date.now();
	const data = `${memberId}:${timestamp}`;
	
	// Create HMAC signature
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	
	const signature = await crypto.subtle.sign(
		'HMAC',
		key,
		encoder.encode(data)
	);
	
	// Convert to base64url
	const signatureArray = Array.from(new Uint8Array(signature));
	const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
	
	// Combine and encode
	const token = `${memberId}.${timestamp}.${signatureHex}`;
	return btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Validate and extract member ID from token
 * Returns member ID if valid, null if invalid or expired
 */
export async function validateMemberToken(
	token: string,
	secret: string,
	maxAgeMs: number = 90 * 24 * 60 * 60 * 1000 // 90 days default
): Promise<string | null> {
	try {
		// Decode from base64url
		const decoded = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
		const parts = decoded.split('.');
		
		if (parts.length !== 3) return null;
		
		const [memberId, timestampStr, signatureHex] = parts;
		const timestamp = parseInt(timestampStr);
		
		// Check if expired
		if (Date.now() - timestamp > maxAgeMs) return null;
		
		// Verify signature
		const data = `${memberId}:${timestamp}`;
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			'raw',
			encoder.encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign', 'verify']
		);
		
		const expectedSignature = await crypto.subtle.sign(
			'HMAC',
			key,
			encoder.encode(data)
		);
		
		const expectedArray = Array.from(new Uint8Array(expectedSignature));
		const expectedHex = expectedArray.map(b => b.toString(16).padStart(2, '0')).join('');
		
		if (signatureHex !== expectedHex) return null;
		
		return memberId;
	} catch (e) {
		return null;
	}
}
