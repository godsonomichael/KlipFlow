import { afterEach, describe, expect, it } from "vitest";
import { isInstagramOAuthConfigured } from "./socialOAuth";

describe("Instagram OAuth configuration", () => {
  const originalId = process.env.INSTAGRAM_APP_ID;
  const originalSecret = process.env.INSTAGRAM_APP_SECRET;

  afterEach(() => {
    if (originalId === undefined) delete process.env.INSTAGRAM_APP_ID;
    else process.env.INSTAGRAM_APP_ID = originalId;
    if (originalSecret === undefined) delete process.env.INSTAGRAM_APP_SECRET;
    else process.env.INSTAGRAM_APP_SECRET = originalSecret;
  });

  it("uses manual fallback for temporary secrets", () => {
    process.env.INSTAGRAM_APP_ID = "instagram-app";
    process.env.INSTAGRAM_APP_SECRET = "temp_optional_placeholder";
    expect(isInstagramOAuthConfigured()).toBe(false);
  });

  it("accepts a real app id and secret", () => {
    process.env.INSTAGRAM_APP_ID = "instagram-app";
    process.env.INSTAGRAM_APP_SECRET = "real-secret-value";
    expect(isInstagramOAuthConfigured()).toBe(true);
  });
});
