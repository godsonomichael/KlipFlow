import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { storageGetSignedUrl, storagePut } from "../storage";

const MAX_SOURCE_BYTES = 750 * 1024 * 1024;
const CLIP_COUNT = 5;
const MIN_SOURCE_SECONDS = 8;

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
  return process.env.FFMPEG_PATH || "ffmpeg";
}

function publicAppUrl() {
  return process.env.PUBLIC_APP_URL || process.env.APP_PUBLIC_URL || process.env.VITE_APP_URL || "";
}

function sourceStorageKey(url: string) {
  const prefix = "/manus-storage/";
  if (url.startsWith(prefix)) return url.slice(prefix.length);
  return null;
}

async function resolveSourceUrl(source: string) {
  const key = sourceStorageKey(source);
  if (key) return storageGetSignedUrl(key);
  if (/^https?:\/\//i.test(source)) return source;
  throw new Error("The source video is not a supported URL.");
}

async function downloadSource(source: string, directory: string) {
  const url = await resolveSourceUrl(source);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Source video download failed (${response.status}).`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_SOURCE_BYTES) throw new Error("Source video is larger than the 750 MB processing limit.");
  const inputPath = join(directory, "source-video");
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_SOURCE_BYTES) throw new Error("Source video is larger than the 750 MB processing limit.");
    await import("node:fs/promises").then(fs => fs.writeFile(inputPath, buffer));
  } else {
    await pipeline(response.body as unknown as NodeJS.ReadableStream, createWriteStream(inputPath));
  }
  const fileInfo = await stat(inputPath);
  if (!fileInfo.size) throw new Error("The downloaded source video is empty.");
  if (fileInfo.size > MAX_SOURCE_BYTES) throw new Error("Source video is larger than the 750 MB processing limit.");
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
    const child = spawn("ffprobe", args, { stdio: ["ignore", "pipe", "pipe"] });
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
}) {
  const jobId = randomUUID();
  const directory = await mkdtemp(join(tmpdir(), `klipflow-${jobId}-`));
  try {
    const inputPath = await downloadSource(options.source, directory);
    const duration = await readDuration(inputPath);
    const windows = makeWindows(duration);
    const clips: ProcessedClip[] = [];
    for (const window of windows) {
      const outputPath = join(directory, `clip-${window.index + 1}.mp4`);
      await runFfmpeg(inputPath, outputPath, window);
      const buffer = await readFile(outputPath);
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
    return { jobId, sourceDurationSeconds: Number(duration.toFixed(2)), clips };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export const __private__ = { makeWindows, sourceStorageKey };
