/**
 * Centralized organization branding configuration.
 * All values are read from environment variables with safe defaults.
 */

export const ORG_NAME = process.env.ORG_NAME || 'My Sports Club e.V.';
export const ORG_SHORT_NAME = process.env.ORG_SHORT_NAME || ORG_NAME;
export const ORG_SLOGAN = process.env.ORG_SLOGAN || '';
export const ORG_LOGO_URL = process.env.ORG_LOGO_URL || '';
export const ORG_WEBSITE_URL = process.env.ORG_WEBSITE_URL || '';
export const ORG_PRIVACY_URL = process.env.ORG_PRIVACY_URL || '';
export const ORG_EMAIL = process.env.ORG_EMAIL || '';
export const ORG_PHONE = process.env.ORG_PHONE || '';
export const ORG_LOCATION = process.env.ORG_LOCATION || '';
export const ORG_ADDRESS_LINES = (process.env.ORG_ADDRESS_LINES || '')
	.replace(/\\n/g, '\n')
	.split('\n')
	.filter(Boolean);
export const ORG_FOOTER_LEGAL = process.env.ORG_FOOTER_LEGAL || '';
