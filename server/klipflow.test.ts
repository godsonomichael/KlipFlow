import { describe, expect, it } from "vitest";
import { calculatePayout, KLIPFLOW_BRAND, recoveredIntegrationStatus } from "@shared/klipflow";
import { extractDriveId } from "./integrations/googleDrive";

describe("KlipFlow recovery contracts", () => {
  it("uses the final KlipFlow brand and required palette", () => {
    expect(KLIPFLOW_BRAND.name).toBe("KlipFlow");
    expect(KLIPFLOW_BRAND.appStoreTitle).toBe("KlipFlow - Content Rewards Automation");
    expect(KLIPFLOW_BRAND.colors).toEqual({
      background: "#F7F7F5",
      card: "#FFFFFF",
      border: "#E8E8E5",
      accent: "#FF4D00",
    });
  });

  it("preserves legacy n8n webhook paths while the migration is in progress", () => {
    expect(KLIPFLOW_BRAND.legacyWebhookPaths).toContain("/webhook/campaign-intake");
    expect(KLIPFLOW_BRAND.legacyWebhookPaths).toContain("/webhook/clipflow-telegram-alert");
  });

  it("does not claim unverified integrations are production-ready", () => {
    expect(recoveredIntegrationStatus.n8n).toBe("connected");
    expect(recoveredIntegrationStatus.whop).toBe("needs_configuration");
    expect(recoveredIntegrationStatus.supabase).toBe("not_verified");
  });

  it("extracts Drive IDs from file and query-string URLs", () => {
    expect(extractDriveId("https://drive.google.com/file/d/abc_123/view")).toBe("abc_123");
    expect(extractDriveId("https://drive.google.com/open?id=xyz-789")).toBe("xyz-789");
    expect(extractDriveId("not-a-drive-url")).toBeNull();
  });

  it("calculates personal Whop estimates by completed thousands of views", () => {
    expect(calculatePayout(2499, 5)).toBe(10);
    expect(calculatePayout(999, 5)).toBe(0);
    expect(calculatePayout(2000, null)).toBe(0);
    expect(calculatePayout(50000, 0)).toBe(0);
  });
});
