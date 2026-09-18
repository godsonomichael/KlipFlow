import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { processDueTelegramReminders } from "./supabaseWorkflow";

export async function handleTelegramReminders(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }
    const result = await processDueTelegramReminders();
    return res.json({ ok: true, ...result, startedAt, taskUid: user.taskUid ?? null });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      context: { url: req.originalUrl, taskUid: null },
      timestamp: new Date().toISOString(),
    });
  }
}
