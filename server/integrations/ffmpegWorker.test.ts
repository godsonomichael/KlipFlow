import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { __private__, processVideoIntoClips } from "./ffmpegWorker";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const bundledFfmpeg = require("ffmpeg-static") as string;

describe("FFmpeg clip worker", () => {
  it("creates five evenly distributed short-form windows", () => {
    const windows = __private__.makeWindows(120);
    expect(windows).toHaveLength(5);
    expect(windows[0].start).toBe(0);
    expect(windows[4].end).toBe(120);
    expect(windows.every(window => window.duration > 0 && window.duration <= 45)).toBe(true);
  });

  it("cuts and transcodes a source video into five uploaded mp4 clips", async () => {
    const directory = await mkdtemp(join(tmpdir(), "klipflow-worker-test-"));
    const sourcePath = join(directory, "source.mp4");
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "video/mp4" });
      createReadStream(sourcePath).pipe(res);
    });
    try {
      await execFileAsync(bundledFfmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=24", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "8", "-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p", sourcePath]);
      await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Test server did not start");
      const uploaded: Array<{ key: string; bytes: number; contentType: string }> = [];
      const result = await processVideoIntoClips({ userId: "test-user", projectId: "test-project", source: `http://127.0.0.1:${address.port}/source.mp4`, upload: async (key, body, contentType) => { uploaded.push({ key, bytes: body.byteLength, contentType }); return { url: `/manus-storage/${key}` }; } });
      expect(result.clips).toHaveLength(5);
      expect(uploaded).toHaveLength(5);
      expect(uploaded.every(file => file.bytes > 0 && file.contentType === "video/mp4")).toBe(true);
      expect((await readFile(sourcePath)).byteLength).toBeGreaterThan(0);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    }
  }, 60_000);
});
