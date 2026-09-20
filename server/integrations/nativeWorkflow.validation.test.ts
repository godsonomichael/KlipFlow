import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { validatePostUrl } from "./nativeWorkflow";

describe("validatePostUrl", () => {
  it("normalizes valid provider URLs", () => {
    expect(validatePostUrl("https://www.instagram.com/reel/example/?utm_source=klipflow", "instagram")).toBe("https://www.instagram.com/reel/example/?utm_source=klipflow");
    expect(validatePostUrl("https://youtu.be/example", "youtube")).toBe("https://youtu.be/example");
  });

  it("rejects a URL from the wrong platform", () => {
    expect(() => validatePostUrl("https://example.com/post/1", "tiktok")).toThrow(TRPCError);
    expect(() => validatePostUrl("https://www.youtube.com/shorts/abc", "instagram")).toThrow("does not belong to instagram");
  });

  it("rejects malformed and non-web URLs", () => {
    expect(() => validatePostUrl("not a url", "instagram")).toThrow("valid public post URL");
    expect(() => validatePostUrl("javascript:alert(1)", "instagram")).toThrow("valid public post URL");
  });
});
