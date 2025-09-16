// vision_model_apis/gcs_upload_and_sign.js
import "dotenv/config";
import { Storage } from "@google-cloud/storage";
import path from "node:path";

function buildStorageFromEnv() {
  const b64 = process.env.GCS_KEY_BASE64;
  const keyPath = process.env.GCS_KEY_PATH;

  if (b64) {
    const creds = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return new Storage({
      projectId: creds.project_id,
      credentials: { client_email: creds.client_email, private_key: creds.private_key },
    });
  }
  if (keyPath) {
    return new Storage({ keyFilename: keyPath });
  }
  // Fallback to ADC only if present; otherwise error clearly:
  try {
    return new Storage();
  } catch {
    throw new Error("No GCS auth found. Set GCS_KEY_BASE64 or GCS_KEY_PATH in .env");
  }
}

const storage = buildStorageFromEnv();
const BUCKET = process.env.GCS_BUCKET;
if (!BUCKET) throw new Error("GCS_BUCKET not set in .env");

const FOLDER = "screenshots";

/**
 * Upload local file to GCS and return a V4 signed URL (read) valid for N minutes.
 * @param {string} localPath
 * @param {number} minutes
 */
export async function uploadAndSign(localPath, minutes = Number(process.env.SIGNED_URL_MINUTES || 15)) {
  const bucket = storage.bucket(BUCKET);

  const base = path.basename(localPath);
  const dest = `${FOLDER}/${Date.now()}_${base}`;
  const file = bucket.file(dest);

  const ext = path.extname(base).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png" :
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
    "application/octet-stream";

  await bucket.upload(localPath, {
    destination: dest,
    resumable: false,
    metadata: { contentType, cacheControl: "private, max-age=0" },
  });

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + minutes * 60 * 1000,
  });

  return url;
}
