import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../config/env.js";
import { logger } from "../lib/logger.js";

/**
 * Server-only Supabase Storage client using the service-role key.
 * All buckets are private. Clients never receive this key.
 *
 * Created lazily on first use so that environment variables can be set
 * before the client is constructed (important for testing).
 */
let _storageAdmin: SupabaseClient | null = null;

export function storageAdmin(): SupabaseClient {
  if (!_storageAdmin) {
    const env = getEnv();
    _storageAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return _storageAdmin;
}

export type StorageBucket =
  | "project-resources"
  | "templates"
  | "generated-documents";

export interface UploadResult {
  path: string;
  size: number;
  mimeType: string;
  bucket: StorageBucket;
  url?: string; // short-lived signed URL, only when explicitly requested
}

/**
 * Ensure a bucket exists (idempotent). Called at startup so local/dev
 * environments work without manually creating buckets in the dashboard.
 */
export async function ensureBucket(bucket: StorageBucket) {
  const { data } = await storageAdmin()
    .storage.listBuckets()
    .catch(() => ({ data: [] as any[], error: null }));

  const exists = (data || []).some((b: any) => b.id === bucket);
  if (!exists) {
    const { error: createErr } = await storageAdmin().storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: getEnv().MAX_FILE_SIZE_MB * 1024 * 1024,
    });
    if (createErr) {
      logger.warn({ bucket, error: createErr }, "failed to create bucket");
    }
  }
}

/**
 * Upload a file to a private bucket.
 * `path` should be a safe, unique storage path (e.g. `resources/<userId>/<uuid>.<ext>`).
 * Returns the storage path; no public URL is exposed.
 */
export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  buffer: Buffer,
  mimeType: string,
): Promise<UploadResult> {
  const { data, error } = await storageAdmin()
    .storage.from(bucket)
    .upload(path, buffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    logger.error({ bucket, path, error }, "storage upload failed");
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return {
    path: data.path,
    size: buffer.length,
    mimeType,
    bucket,
  };
}

/**
 * Generate a short-lived signed URL (default 5 minutes) for private download.
 * Only call this when a download is actually needed.
 *
 * `downloadName` makes Storage return a Content-Disposition attachment with
 * that filename. Without it the browser would save the random storage key.
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 300,
  downloadName?: string,
): Promise<string> {
  const { data, error } = await storageAdmin()
    .storage.from(bucket)
    .createSignedUrl(
      path,
      expiresInSeconds,
      downloadName ? { download: downloadName } : undefined,
    );

  if (error || !data?.signedUrl) {
    logger.error({ bucket, path, error }, "signed URL generation failed");
    throw new Error("Failed to generate download URL");
  }

  return data.signedUrl;
}

/**
 * Download a private file as a Buffer. Used for template-preserving export,
 * where the original uploaded DOCX is the formatting source of truth.
 */
export async function downloadFile(
  bucket: StorageBucket,
  path: string,
): Promise<Buffer> {
  const { data, error } = await storageAdmin()
    .storage.from(bucket)
    .download(path);

  if (error || !data) {
    logger.error({ bucket, path, error }, "storage download failed");
    throw new Error(`Failed to download file: ${error?.message ?? "not found"}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

/**
 * Delete a file from a private bucket.
 */
export async function deleteFile(
  bucket: StorageBucket,
  path: string,
): Promise<void> {
  const { error } = await storageAdmin().storage.from(bucket).remove([path]);
  if (error) {
    logger.error({ bucket, path, error }, "storage delete failed");
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}
