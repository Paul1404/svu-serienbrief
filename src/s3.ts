/**
 * S3 client and helper functions for file storage.
 * Used for: club logo caching, PDF archive storage, data exports/backups.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';

let client: S3Client | null = null;

function getClient(): S3Client {
	if (!client) {
		const endpoint = process.env.AWS_ENDPOINT_URL;
		const region = process.env.AWS_DEFAULT_REGION || 'us-east-1';

		client = new S3Client({
			region,
			...(endpoint ? { endpoint, forcePathStyle: true } : {}),
		});
	}
	return client;
}

function getBucket(): string {
	const bucket = process.env.AWS_S3_BUCKET_NAME;
	if (!bucket) throw new Error('AWS_S3_BUCKET_NAME is not configured');
	return bucket;
}

/** Check whether S3 is configured (all required env vars present). */
export function isS3Configured(): boolean {
	return !!(
		process.env.AWS_ACCESS_KEY_ID &&
		process.env.AWS_SECRET_ACCESS_KEY &&
		process.env.AWS_S3_BUCKET_NAME
	);
}

/** Upload a file to S3. */
export async function putObject(key: string, body: Uint8Array | Buffer, contentType: string): Promise<void> {
	const s3 = getClient();
	await s3.send(new PutObjectCommand({
		Bucket: getBucket(),
		Key: key,
		Body: body,
		ContentType: contentType,
	}));
}

/** Download a file from S3. Returns null if the key does not exist. */
export async function getObject(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
	const s3 = getClient();
	try {
		const resp = await s3.send(new GetObjectCommand({
			Bucket: getBucket(),
			Key: key,
		}));
		const bytes = await resp.Body!.transformToByteArray();
		return { body: bytes, contentType: resp.ContentType || 'application/octet-stream' };
	} catch (err: any) {
		if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
			return null;
		}
		throw err;
	}
}

/** Check if an object exists in S3. */
export async function objectExists(key: string): Promise<boolean> {
	const s3 = getClient();
	try {
		await s3.send(new HeadObjectCommand({
			Bucket: getBucket(),
			Key: key,
		}));
		return true;
	} catch (err: any) {
		if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
			return false;
		}
		throw err;
	}
}

/** List objects under a prefix. Returns keys, sizes, and last-modified dates. */
export async function listObjects(prefix: string): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
	const s3 = getClient();
	const items: Array<{ key: string; size: number; lastModified: Date }> = [];

	let continuationToken: string | undefined;
	do {
		const resp = await s3.send(new ListObjectsV2Command({
			Bucket: getBucket(),
			Prefix: prefix,
			ContinuationToken: continuationToken,
		}));

		for (const obj of resp.Contents || []) {
			if (obj.Key) {
				items.push({
					key: obj.Key,
					size: obj.Size || 0,
					lastModified: obj.LastModified || new Date(),
				});
			}
		}

		continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
	} while (continuationToken);

	return items;
}

// ── S3 key conventions ──────────────────────────────────────────────────

/** S3 key for the cached club logo. */
export const LOGO_KEY = 'assets/logo_svu.png';

/** S3 key prefix for archived letter ZIPs. */
export const ARCHIVE_PREFIX = 'archives/letters/';

/** S3 key prefix for data export backups. */
export const EXPORT_PREFIX = 'exports/';
