import { describe, expect, it } from "vitest";

describe("TikTok supplied credentials", () => {
  it.skipIf(!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET)("reaches the TikTok OAuth token endpoint with the configured client", async () => {
    const clientKey = process.env.TIKTOK_CLIENT_KEY!;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET!;
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, grant_type: "authorization_code", code: "smoke-test-invalid-code", redirect_uri: "https://klipflow-g6pmn7fa.manus.space/api/oauth/tiktok/callback" }),
    });
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  }, 20_000);
});
