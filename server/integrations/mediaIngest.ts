import { TRPCError } from "@trpc/server";

function isSafeMediaUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch { return false; }
}

export function isYouTubeSource(source: string) {
  try {
    const url = new URL(source);
    return /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(url.hostname);
  } catch { return false; }
}

export async function resolveMediaSource(source: string) {
  if (!isYouTubeSource(source)) return source;
  const workerUrl = process.env.MEDIA_INGEST_WORKER_URL;
  if (!workerUrl) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "YouTube links require a configured media-ingestion worker. Use a direct video URL or Google Drive link for now." });
  let endpoint: URL;
  try { endpoint = new URL("/v1/ingest", workerUrl); } catch { throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The media-ingestion worker URL is invalid." }); }
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", ...(process.env.MEDIA_INGEST_WORKER_TOKEN ? { authorization: `Bearer ${process.env.MEDIA_INGEST_WORKER_TOKEN}` } : {}) }, body: JSON.stringify({ source }) });
  const body = await response.json().catch(() => ({})) as { mediaUrl?: string; storagePath?: string; message?: string };
  if (!response.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: body.message || `Media-ingestion worker returned HTTP ${response.status}.` });
  const mediaUrl = body.mediaUrl || body.storagePath;
  if (!mediaUrl || (!mediaUrl.startsWith("/manus-storage/") && !isSafeMediaUrl(mediaUrl))) throw new TRPCError({ code: "BAD_GATEWAY", message: "Media-ingestion worker returned no safe downloadable media URL." });
  return mediaUrl;
}
