import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

/**
 * S3-compatible object storage for member documents.
 *
 * Works with Cloudflare R2, Backblaze B2, AWS S3 or any MinIO-compatible
 * endpoint - configured through the S3_* environment variables (see
 * docs/BACKUP.md). When it is not configured the upload route falls back to
 * writing into public/uploads, which only works in local development:
 * Vercel's filesystem is read-only and ephemeral, so files written there
 * disappear on the next deploy.
 */

const endpoint = process.env.S3_ENDPOINT || ""
const region = process.env.S3_REGION || "auto"
const bucket = process.env.S3_BUCKET || ""
const accessKeyId = process.env.S3_ACCESS_KEY_ID || ""
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || ""
/** Public base URL of the bucket (custom domain, R2 public bucket, ...). */
const publicBaseUrl = process.env.S3_PUBLIC_URL || ""

export function isRemoteStorageConfigured(): boolean {
  return Boolean(bucket && accessKeyId && secretAccessKey)
}

let client: S3Client | null = null

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      credentials: { accessKeyId, secretAccessKey },
      // Path-style addressing keeps R2/B2/MinIO happy; plain AWS S3 (no
      // endpoint) uses the default virtual-hosted style.
      forcePathStyle: Boolean(endpoint),
    })
  }
  return client
}

export async function uploadDocument(params: {
  fileName: string
  buffer: Buffer
  contentType: string
}): Promise<{ url: string; key: string }> {
  if (!isRemoteStorageConfigured()) {
    throw new Error(
      "Object storage is not configured (S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)"
    )
  }

  const key = `documents/${params.fileName}`

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType || "application/octet-stream",
    })
  )

  if (publicBaseUrl) {
    return { url: `${publicBaseUrl.replace(/\/+$/, "")}/${key}`, key }
  }
  if (endpoint) {
    return { url: `${endpoint.replace(/\/+$/, "")}/${bucket}/${key}`, key }
  }
  return { url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`, key }
}
