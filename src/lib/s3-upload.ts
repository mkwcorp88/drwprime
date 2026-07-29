import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Self-hosted MinIO (S3-compatible) on the VPS. Replaces Vercel Blob for
// app-managed uploads (best-deals images, blog cover images). Public files are
// served straight from the CDN domain that fronts the bucket.
const ENDPOINT = process.env.S3_ENDPOINT || 'https://cdn.drwskincare.com';
const BUCKET = process.env.S3_BUCKET || 'drwprime';
// Public base for path-style addressing: <cdn>/<bucket>/<key>
const PUBLIC_BASE = process.env.S3_PUBLIC_BASE || `${ENDPOINT}/${BUCKET}`;

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    endpoint: ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    // MinIO requires path-style addressing (bucket in the path, not subdomain).
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
  });
  return client;
}

export function isUploadConfigured(): boolean {
  return Boolean(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

/**
 * Upload a File to the public bucket under `key` and return its public URL.
 * The bucket has an anonymous read policy, so the returned URL is directly
 * loadable (used as next/image src and stored in the DB).
 */
export async function uploadPublicObject(
  key: string,
  file: File
): Promise<{ url: string; pathname: string }> {
  const body = Buffer.from(await file.arrayBuffer());

  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: file.type || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return { url: `${PUBLIC_BASE}/${key}`, pathname: key };
}

export async function deletePublicObject(key: string): Promise<void> {
  if (!key) return;
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}
