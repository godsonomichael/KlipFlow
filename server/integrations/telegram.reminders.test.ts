import { describe, expect, it } from "vitest";
import { getDueReminderMinutes } from "./supabaseWorkflow";

describe("Telegram reminder timing", () => {
  const postedAt = "2026-09-17T10:00:00.000Z";

  it("returns the 10-minute reminder once the first threshold is reached", () => {
    expect(getDueReminderMinutes(postedAt, new Date("2026-09-17T10:10:00.000Z"))).toEqual([10]);
  });

  it("returns both thresholds during the reminder window so the database deduplicates deliveries", () => {
    expect(getDueReminderMinutes(postedAt, new Date("2026-09-17T10:25:00.000Z"))).toEqual([10, 25]);
  });

  it("stops scheduling reminders after the 30-minute submission window", () => {
    expect(getDueReminderMinutes(postedAt, new Date("2026-09-17T10:30:00.000Z"))).toEqual([]);
  });
});
