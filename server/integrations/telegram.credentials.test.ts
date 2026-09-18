import { describe, expect, it } from "vitest";

describe("Telegram credentials", () => {
  it.skipIf(!process.env.TELEGRAM_BOT_TOKEN)("accepts the configured bot token", async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const payload = (await response.json()) as {
      ok?: boolean;
      result?: { username?: string };
    };

    expect(response.ok).toBe(true);
    expect(payload.ok).toBe(true);
    expect(payload.result?.username).toBeTruthy();
  }, 15_000);
});
