import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { storageGetSignedUrl, storagePut } from "../storage";
import { getDriveDownloadRequest } from "./googleDrive";
import { resolveMediaSource } from "./mediaIngest";

const CLIP_COUNT = 5;
const MIN_SOURCE_SECONDS = 8;
const require = createRequire(import.meta.url);

function maxSourceBytes() {
  const megabytes = Number(process.env.KLIPFLOW_MAX_SOURCE_MB || 0);
  return Number.isFinite(megabytes) && megabytes > 0 ? Math.floor(megabytes * 1024 * 1024) : Number.POSITIVE_INFINITY;
}

function sourceLimitMessage() {
  const megabytes = Number(process.env.KLIPFLOW_MAX_SOURCE_MB || 0);
  return Number.isFinite(megabytes) && megabytes > 0 ? `Source video is larger than the configured ${megabytes} MB processing limit.` : "Source video exceeds the available processing storage capacity.";
}

function bundledFfmpegBinary() {
  return require("ffmpeg-static") as string | null;
}

function bundledFfprobeBinary() {
  return require("ffprobe-static").path as string;
}

type ClipWindow = {
  index: number;
  start: number;
  duration: number;
  end: number;
};

export type ProcessedClip = {
  title: string;
  caption: string;
  clipUrl: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  processingJobId: string;
};

function ffmpegBinary() {
  return process.env.FFMPEG_PATH || bundledFfmpegBinary() || "ffmpeg";
}

function ffprobeBinary() {
  return process.env.FFPROBE_PATH || bundledFfprobeBinary() || "ffprobe";
}

function publicAppUrl() {
  return process.env.PUBLIC_APP_URL || process.env.APP_PUBLIC_URL || process.env.VITE_APP_URL || "";
}

function sourceStorageKey(url: string) {
  const prefix = "/manus-storage/";
  if (url.startsWith(prefix)) return url.slice(prefix.length);
  return null;
}

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  const ipv4 = host.split(".").map(Number);
  if (ipv4.length === 4 && ipv4.every(part => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [first, second] = ipv4;
    return first === 0 || first === 10 || first === 127 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || (first === 100 && second >= 64 && second <= 127) || (first === 198 && (second === 18 || second === 19));
  }
  return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb");
}

export function isSafeRemoteSource(source: string) {
  try {
    const url = new URL(source);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname) && !isPrivateHostname(url.hostname);
  } catch { return false; }
}

async function resolveSourceUrl(source: string) {
  const key = sourceStorageKey(source);
  if (key) return storageGetSignedUrl(key);
  if (isSafeRemoteSource(source) || (process.env.NODE_ENV !== "production" && /^https?:\/\/127\.0\.0\.1(?::\d+)?(?:\/|$)/i.test(source))) return source;
  if (/^https?:\/\//i.test(source)) throw new Error("The source video URL must point to a public HTTP(S) host.");
  throw new Error("The source video is not a supported URL.");
}

async function downloadSource(source: string, directory: string) {
  const resolvedSource = await resolveMediaSource(source);
  const driveRequest = getDriveDownloadRequest(resolvedSource);
  const url = driveRequest?.url ?? await resolveSourceUrl(resolvedSource);
  const response = await fetch(url, { headers: driveRequest?.headers, redirect: "follow" });
  if (!response.ok) throw new Error(`Source video download failed (${response.status}).`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxSourceBytes()) throw new Error(sourceLimitMessage());
  const inputPath = join(directory, "source-video");
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxSourceBytes()) throw new Error(sourceLimitMessage());
    await import("node:fs/promises").then(fs => fs.writeFile(inputPath, buffer));
  } else {
    let received = 0;
    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        if (received > maxSourceBytes()) callback(new Error(sourceLimitMessage()));
        else callback(null, chunk);
      },
    });
    await pipeline(response.body as unknown as NodeJS.ReadableStream, limiter, createWriteStream(inputPath));
  }
  const fileInfo = await stat(inputPath);
  if (!fileInfo.size) throw new Error("The downloaded source video is empty.");
  if (fileInfo.size > maxSourceBytes()) throw new Error(sourceLimitMessage());
  return inputPath;
}

function runFfmpeg(inputPath: string, outputPath: string, window: ClipWindow) {
  return new Promise<void>((resolve, reject) => {
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      String(window.start),
      "-i",
      inputPath,
      "-t",
      String(window.duration),
      "-vf",
      "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      process.env.FFMPEG_PRESET || "veryfast",
      "-crf",
      process.env.FFMPEG_CRF || "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ];
    const child = spawn(ffmpegBinary(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", chunk => {
      stderr += String(chunk);
      if (stderr.length > 10_000) stderr = stderr.slice(-10_000);
    });
    child.once("error", error => reject(new Error(`FFmpeg could not start: ${error.message}`)));
    child.once("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg failed for clip ${window.index + 1}: ${stderr.trim() || `exit code ${code}`}`));
    });
  });
}

async function readDuration(inputPath: string) {
  return new Promise<number>((resolve, reject) => {
    const args = ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", inputPath];
    const child = spawn(ffprobeBinary(), args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += String(chunk); });
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.once("error", error => reject(new Error(`ffprobe could not start: ${error.message}`)));
    child.once("close", code => {
      const duration = Number(stdout.trim());
      if (code !== 0 || !Number.isFinite(duration) || duration < MIN_SOURCE_SECONDS) {
        reject(new Error(`Could not read a usable source duration${stderr.trim() ? `: ${stderr.trim()}` : "."}`));
        return;
      }
      resolve(duration);
    });
  });
}

function makeWindows(duration: number): ClipWindow[] {
  const clipDuration = Math.min(45, Math.max(8, duration * 0.32));
  const maxStart = Math.max(0, duration - clipDuration);
  return Array.from({ length: CLIP_COUNT }, (_, index) => {
    const start = maxStart * (index / Math.max(1, CLIP_COUNT - 1));
    return { index, start, duration: Math.min(clipDuration, duration - start), end: start + Math.min(clipDuration, duration - start) };
  });
}

export async function processVideoIntoClips(options: {
  userId: string;
  projectId: string;
  source: string;
  upload: (key: string, body: Buffer, contentType: string) => Promise<{ url: string }>;
  jobId?: string;
  onProgress?: (progress: number, currentStep: string) => Promise<void> | void;
  shouldCancel?: () => Promise<boolean> | boolean;
}) {
  const jobId = options.jobId ?? randomUUID();
  const directory = await mkdtemp(join(tmpdir(), `klipflow-${jobId}-`));
  try {
    await options.onProgress?.(5, "Downloading source video");
    const inputPath = await downloadSource(options.source, directory);
    await options.onProgress?.(15, "Reading source duration");
    const duration = await readDuration(inputPath);
    const windows = makeWindows(duration);
    const clips: ProcessedClip[] = [];
    for (const window of windows) {
      if (await options.shouldCancel?.()) throw new Error("GENERATION_CANCELLED");
      await options.onProgress?.(20 + window.index * 16, `Rendering clip ${window.index + 1} of ${windows.length}`);
      const outputPath = join(directory, `clip-${window.index + 1}.mp4`);
      await runFfmpeg(inputPath, outputPath, window);
      const buffer = await readFile(outputPath);
      await options.onProgress?.(28 + window.index * 16, `Uploading clip ${window.index + 1} of ${windows.length}`);
      const stored = await options.upload(`klipflow/${options.userId}/clips/${options.projectId}/${jobId}-${window.index + 1}.mp4`, buffer, "video/mp4");
      const clipUrl = publicAppUrl() ? `${publicAppUrl().replace(/\/$/, "")}${stored.url}` : stored.url;
      clips.push({
        title: `Viral clip ${window.index + 1}`,
        caption: "",
        clipUrl,
        startSeconds: Number(window.start.toFixed(2)),
        endSeconds: Number(window.end.toFixed(2)),
        durationSeconds: Number(window.duration.toFixed(2)),
        processingJobId: jobId,
      });
    }
    await options.onProgress?.(100, "Generation complete");
    return { jobId, sourceDurationSeconds: Number(duration.toFixed(2)), clips };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export const __private__ = { makeWindows, sourceStorageKey, isPrivateHostname, isSafeRemoteSource };
