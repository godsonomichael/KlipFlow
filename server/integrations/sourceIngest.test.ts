import { describe, expect, it } from "vitest";
import { extractDriveId } from "./googleDrive";
import { isYouTubeSource } from "./mediaIngest";

describe("source ingestion helpers", () => {
  it("recognizes supported YouTube URL shapes", () => {
    expect(isYouTubeSource("https://www.youtube.com/watch?v=abc123")).toBe(true);
    expect(isYouTubeSource("https://youtu.be/abc123")).toBe(true);
    expect(isYouTubeSource("https://example.com/watch?v=abc123")).toBe(false);
  });

  it("extracts Drive file IDs only from Drive or Docs hosts", () => {
    expect(extractDriveId("https://drive.google.com/file/d/drive-file-123/view")).toBe("drive-file-123");
    expect(extractDriveId("https://docs.google.com/document/d/docs-file-456/edit")).toBe("docs-file-456");
    expect(extractDriveId("https://example.com/file/d/not-allowed")).toBeNull();
  });
});
