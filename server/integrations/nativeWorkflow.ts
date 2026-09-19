import { randomUUID } from "node:crypto";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { calculatePayout } from "@shared/klipflow";
import { processVideoIntoClips } from "./ffmpegWorker";
import { storagePut } from "../storage";

let pool: Pool | null = null;

function db() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "KlipFlow database is not configured." });
    pool = mysql.createPool({ uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 8, enableKeepAlive: true });
  }
  return pool;
}

async function query<T extends RowDataPacket = RowDataPacket>(sql: string, values: unknown[] = []) {
  const [rows] = await db().execute<T[]>(sql, values);
  return rows;
}

async function execute(sql: string, values: unknown[] = []) {
  await db().execute(sql, values);
}

function workflowError(message: string, code: "BAD_GATEWAY" | "NOT_FOUND" | "PRECONDITION_FAILED" = "BAD_GATEWAY"): never {
  throw new TRPCError({ code, message });
}

export type WorkflowAccount = { id: string; platform: string; handle: string; status: string };

export async function listConnectedAccounts(userId: string) {
  try { return await query<WorkflowAccount & RowDataPacket>("SELECT id, platform, handle, status FROM connected_accounts WHERE user_id = ? ORDER BY created_at ASC LIMIT 50", [userId]); }
  catch { workflowError("We could not load your connected accounts."); }
}

export async function addConnectedAccount(userId: string, platform: string, handle: string) {
  const id = randomUUID();
  try {
    await execute("INSERT INTO connected_accounts (id,user_id,platform,handle,status) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status), updated_at=CURRENT_TIMESTAMP", [id, userId, platform, handle, "placeholder"]);
    const rows = await query<WorkflowAccount & RowDataPacket>("SELECT id,platform,handle,status FROM connected_accounts WHERE user_id=? AND platform=? AND handle=? LIMIT 1", [userId, platform, handle]);
    return rows[0];
  } catch { workflowError("We could not save that account."); }
}

export async function removeConnectedAccount(userId: string, id: string) {
  try { await execute("DELETE FROM connected_accounts WHERE id=? AND user_id=?", [id, userId]); return { success: true } as const; }
  catch { workflowError("We could not remove that account."); }
}

export type OAuthAccount = { id: string; platform: string; handle: string; access_token: string | null; refresh_token: string | null; token_expires_at: string | null; provider_user_id: string | null; provider_metadata: Record<string, unknown> | null };

export async function getOAuthAccount(userId: string, platform: string) {
  const rows = await query<OAuthAccount & RowDataPacket>("SELECT id,platform,handle,access_token,refresh_token,token_expires_at,provider_user_id,provider_metadata FROM connected_accounts WHERE user_id=? AND platform=? ORDER BY created_at DESC LIMIT 1", [userId, platform]);
  const row = rows[0];
  if (!row) return null;
  return { ...row, provider_metadata: typeof row.provider_metadata === "string" ? JSON.parse(row.provider_metadata) : row.provider_metadata } as OAuthAccount;
}

export async function saveOAuthAccount(userId: string, platform: string, input: { handle: string; accessToken: string; refreshToken?: string | null; expiresAt?: string | null; providerUserId?: string | null; providerAccountName?: string | null; providerMetadata?: Record<string, unknown> | null }) {
  const existing = await getOAuthAccount(userId, platform);
  const id = existing?.id ?? randomUUID();
  await execute(`INSERT INTO connected_accounts (id,user_id,platform,handle,access_token,refresh_token,token_expires_at,provider_user_id,provider_account_name,provider_metadata,status) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE handle=VALUES(handle),access_token=VALUES(access_token),refresh_token=VALUES(refresh_token),token_expires_at=VALUES(token_expires_at),provider_user_id=VALUES(provider_user_id),provider_account_name=VALUES(provider_account_name),provider_metadata=VALUES(provider_metadata),status='active',updated_at=CURRENT_TIMESTAMP`, [id, userId, platform, input.handle, input.accessToken, input.refreshToken ?? null, input.expiresAt ? new Date(input.expiresAt) : null, input.providerUserId ?? null, input.providerAccountName ?? null, input.providerMetadata ? JSON.stringify(input.providerMetadata) : null, "active"]);
  return { success: true } as const;
}

export async function createProject(userId: string, input: { sourceLink?: string; fileUrl?: string; requirementsLink?: string; requirementsFile?: string; title?: string }) {
  const id = randomUUID();
  try {
    await execute("INSERT INTO projects (id,user_id,title,source_link,file_url,requirements_link,requirements_file,status) VALUES (?,?,?,?,?,?,?,?)", [id, userId, input.title ?? "New clipping project", input.sourceLink ?? null, input.fileUrl ?? null, input.requirementsLink ?? null, input.requirementsFile ?? null, "created"]);
    const rows = await query("SELECT id,title,source_link,file_url,requirements_link,requirements_file,status,created_at FROM projects WHERE id=? AND user_id=?", [id, userId]);
    return rows[0];
  } catch { workflowError("We could not create that project."); }
}

export async function listProjects(userId: string) {
  try {
    const rows = await query("SELECT p.id,p.title,p.source_link,p.file_url,p.requirements_link,p.requirements_file,p.status,p.created_at,COUNT(c.id) AS clip_count FROM projects p LEFT JOIN generated_clips c ON c.project_id=p.id WHERE p.user_id=? GROUP BY p.id ORDER BY p.created_at DESC LIMIT 50", [userId]);
    return rows.map((row: any) => ({ ...row, generated_clips: [{ count: Number(row.clip_count ?? 0) }] }));
  } catch { workflowError("We could not load your projects."); }
}

export async function getProject(userId: string, projectId: string) {
  const rows = await query("SELECT id,title,source_link,file_url,requirements_link,requirements_file,status,created_at,processing_error FROM projects WHERE id=? AND user_id=? LIMIT 1", [projectId, userId]);
  if (!rows[0]) workflowError("That project was not found.", "NOT_FOUND");
  return rows[0];
}

export async function generationHistory(userId: string, projectId: string) {
  await getProject(userId, projectId);
  return query<any>("SELECT id,project_id,status,progress,current_step,error_message,cancel_requested,started_at,completed_at,created_at,updated_at FROM generation_jobs WHERE project_id=? AND user_id=? ORDER BY created_at DESC LIMIT 20", [projectId, userId]);
}

export async function cancelGeneration(userId: string, projectId: string, jobId?: string) {
  await getProject(userId, projectId);
  const rows = await query<any>("SELECT id,status FROM generation_jobs WHERE project_id=? AND user_id=? AND (? IS NULL OR id=?) ORDER BY created_at DESC LIMIT 1", [projectId, userId, jobId ?? null, jobId ?? null]);
  const job = rows[0];
  if (!job) workflowError("There is no generation job to cancel.", "NOT_FOUND");
  if (!["queued", "running", "cancelling"].includes(job.status)) return { id: job.id, status: job.status };
  await execute("UPDATE generation_jobs SET cancel_requested=TRUE,status='cancelling',current_step='Cancellation requested' WHERE id=? AND user_id=?", [job.id, userId]);
  return { id: job.id, status: "cancelling" } as const;
}

async function updateGenerationJob(jobId: string, values: { status?: string; progress?: number; currentStep?: string; errorMessage?: string | null; startedAt?: Date | null; completedAt?: Date | null }) {
  await execute("UPDATE generation_jobs SET status=COALESCE(?,status),progress=COALESCE(?,progress),current_step=COALESCE(?,current_step),error_message=?,started_at=COALESCE(?,started_at),completed_at=? WHERE id=?", [values.status ?? null, values.progress ?? null, values.currentStep ?? null, values.errorMessage ?? null, values.startedAt ?? null, values.completedAt ?? null, jobId]);
}

export async function generateClips(userId: string, projectId: string) {
  const rows = await query<any>("SELECT id,source_link,file_url FROM projects WHERE id=? AND user_id=? LIMIT 1", [projectId, userId]);
  const project = rows[0];
  if (!project) workflowError("That project was not found.", "NOT_FOUND");
  const sourceVideo = project.file_url ?? project.source_link ?? null;
  if (!sourceVideo) workflowError("Add a video file or a direct video URL before generating clips.", "BAD_GATEWAY");
  const active = await query("SELECT id FROM generation_jobs WHERE project_id=? AND user_id=? AND status IN ('queued','running','cancelling') LIMIT 1", [projectId, userId]);
  if (active[0]) workflowError("This project is already generating clips. You can monitor it below.", "PRECONDITION_FAILED");
  const jobId = randomUUID();
  await execute("INSERT INTO generation_jobs (id,project_id,user_id,status,progress,current_step,started_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)", [jobId, projectId, userId, "queued", 0, "Waiting to start"]);
  await execute("UPDATE projects SET status='processing', processing_error=NULL, processed_at=NULL WHERE id=? AND user_id=?", [projectId, userId]);
  try {
    await updateGenerationJob(jobId, { status: "running", progress: 1, currentStep: "Starting video processing", startedAt: new Date() });
    const result = await processVideoIntoClips({ userId, projectId, source: sourceVideo, jobId, upload: async (key, body, contentType) => storagePut(key, body, contentType), onProgress: (progress, currentStep) => updateGenerationJob(jobId, { progress, currentStep }), shouldCancel: async () => Boolean((await query<any>("SELECT cancel_requested FROM generation_jobs WHERE id=? LIMIT 1", [jobId]))[0]?.cancel_requested) });
    const clipRows = [];
    for (const clip of result.clips) {
      const id = randomUUID();
      await execute("INSERT INTO generated_clips (id,project_id,title,caption,clip_url,status,start_seconds,end_seconds,duration_seconds,processing_job_id) VALUES (?,?,?,?,?,?,?,?,?,?)", [id, projectId, clip.title, clip.caption, clip.clipUrl, "ready", clip.startSeconds, clip.endSeconds, clip.durationSeconds, clip.processingJobId]);
      clipRows.push({ id, project_id: projectId, title: clip.title, caption: clip.caption, clip_url: clip.clipUrl, status: "ready", start_seconds: clip.startSeconds, end_seconds: clip.endSeconds, duration_seconds: clip.durationSeconds, processing_job_id: clip.processingJobId, created_at: new Date() });
    }
    await execute("UPDATE projects SET status='ready', processed_at=CURRENT_TIMESTAMP, processing_error=NULL WHERE id=? AND user_id=?", [projectId, userId]);
    await updateGenerationJob(jobId, { status: "completed", progress: 100, currentStep: "Generation complete", completedAt: new Date() });
    await createNotification(userId, "clip_ready", "Your clips are ready", `${clipRows.length} clips are ready to review.`, "/clips");
    return clipRows;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video processing failed.";
    const cancelled = message === "GENERATION_CANCELLED";
    const displayMessage = cancelled ? "Generation cancelled." : message;
    await execute("UPDATE projects SET status=?, processing_error=? WHERE id=? AND user_id=?", [cancelled ? "cancelled" : "failed", displayMessage, projectId, userId]);
    await updateGenerationJob(jobId, { status: cancelled ? "cancelled" : "failed", currentStep: displayMessage, errorMessage: displayMessage, completedAt: new Date() });
    throw new TRPCError({ code: cancelled ? "CONFLICT" : "BAD_GATEWAY", message: displayMessage });
  }
}

export async function listClips(userId: string) {
  try {
    const clips = await query<any>("SELECT c.id,c.project_id,c.title,c.caption,c.clip_url,c.status,c.start_seconds,c.end_seconds,c.duration_seconds,c.processing_job_id,c.created_at,p.id AS p_id,p.title AS p_title,p.source_link,p.file_url,p.requirements_link,p.requirements_file FROM generated_clips c JOIN projects p ON p.id=c.project_id AND p.user_id=? ORDER BY c.created_at DESC LIMIT 100", [userId]);
    const result = [];
    for (const clip of clips) {
      const submissions = await query("SELECT id,post_url,views,status,earnings,platform,whop_submission_status,whop_submitted_at,posted_at,provider_post_id,last_view_sync_at,view_sync_error FROM submissions WHERE clip_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1", [clip.id, userId]);
      result.push({ id: clip.id, project_id: clip.project_id, title: clip.title, caption: clip.caption, clip_url: clip.clip_url, status: clip.status, start_seconds: clip.start_seconds, end_seconds: clip.end_seconds, duration_seconds: clip.duration_seconds, processing_job_id: clip.processing_job_id, created_at: clip.created_at, projects: [{ id: clip.p_id, title: clip.p_title, source_link: clip.source_link, file_url: clip.file_url, requirements_link: clip.requirements_link, requirements_file: clip.requirements_file }], submissions });
    }
    return result;
  } catch { workflowError("We could not load your clips."); }
}

export async function getClipForProvider(userId: string, clipId: string) {
  const rows = await query<any>("SELECT c.id,c.title,c.caption,c.clip_url,p.user_id,p.title AS project_title FROM generated_clips c JOIN projects p ON p.id=c.project_id WHERE c.id=? AND p.user_id=? LIMIT 1", [clipId, userId]);
  const row = rows[0];
  if (!row) workflowError("That clip was not found.", "NOT_FOUND");
  return { id: row.id, title: row.title, caption: row.caption, clip_url: row.clip_url, projects: { user_id: row.user_id, title: row.project_title } };
}

export async function getSubmissionForProvider(userId: string, submissionId: string) {
  const rows = await query<any>("SELECT s.id,s.clip_id,s.post_url,s.platform,s.provider_post_id,s.views,c.id AS generated_id,c.title,c.caption,c.clip_url,p.user_id,p.title AS project_title FROM submissions s JOIN generated_clips c ON c.id=s.clip_id JOIN projects p ON p.id=c.project_id WHERE s.id=? AND s.user_id=? LIMIT 1", [submissionId, userId]);
  const row = rows[0];
  if (!row) workflowError("That posted clip was not found.", "NOT_FOUND");
  return { id: row.id, clip_id: row.clip_id, post_url: row.post_url, platform: row.platform, provider_post_id: row.provider_post_id, views: row.views, generated_clips: { id: row.generated_id, title: row.title, caption: row.caption, clip_url: row.clip_url, projects: { user_id: row.user_id, title: row.project_title } } };
}

export async function submitClip(userId: string, clipId: string, postUrl: string, platform?: string, providerPostId?: string) {
  const clip = await getClipForProvider(userId, clipId);
  const normalizedUrl = validatePostUrl(postUrl, platform);
  const existing = await query<any>("SELECT id,clip_id,post_url,views,status,earnings,platform,provider_post_id,whop_submission_status,posted_at FROM submissions WHERE user_id=? AND clip_id=? AND post_url=? LIMIT 1", [userId, clip.id, normalizedUrl]);
  if (existing[0]) return existing[0];
  const id = randomUUID();
  const postedAt = new Date();
  await execute("INSERT INTO submissions (id,user_id,clip_id,post_url,platform,provider_post_id,provider_status,posted_at,status,whop_submission_status) VALUES (?,?,?,?,?,?,?,?,?,?)", [id, userId, clip.id, normalizedUrl, platform ?? null, providerPostId ?? null, providerPostId ? "published" : null, postedAt, "pending", "not_submitted"]);
  return { id, clip_id: clipId, post_url: normalizedUrl, views: 0, status: "pending", earnings: 0, platform: platform ?? null, provider_post_id: providerPostId ?? null, whop_submission_status: "not_submitted", posted_at: postedAt };
}

const platformHosts: Record<string, RegExp> = {
  tiktok: /(^|\.)tiktok\.com$/i,
  instagram: /(^|\.)instagram\.com$/i,
  youtube: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i,
  x: /(^|\.)x\.com$|(^|\.)twitter\.com$/i,
};

export function validatePostUrl(postUrl: string, platform?: string) {
  let parsed: URL;
  try { parsed = new URL(postUrl); } catch { workflowError("Enter a valid public post URL.", "BAD_GATEWAY"); }
  if (!parsed! || !["https:", "http:"].includes(parsed.protocol) || !parsed.hostname) workflowError("Enter a valid public post URL.", "BAD_GATEWAY");
  if (platform && platformHosts[platform] && !platformHosts[platform].test(parsed!.hostname)) workflowError(`This URL does not belong to ${platform}.`, "BAD_GATEWAY");
  return parsed!.toString();
}

export async function updateClipMetadata(userId: string, clipId: string, title: string, caption: string) {
  const clip = await getClipForProvider(userId, clipId);
  await execute("UPDATE generated_clips c JOIN projects p ON p.id=c.project_id SET c.title=?, c.caption=? WHERE c.id=? AND p.user_id=?", [title, caption, clipId, userId]);
  return { ...clip, title, caption };
}

export async function notifyClipPosted(userId: string, clipId: string, platform: string) {
  await createNotification(userId, "post_success", "Your clip was posted", `Your clip was posted to ${platform}. Submit it to Whop within 30 minutes.`, "/clips");
}

export async function updateProviderSubmissionViews(userId: string, submissionId: string, views: number, syncError: string | null = null) {
  const rows = await query("SELECT id FROM submissions WHERE id=? AND user_id=? LIMIT 1", [submissionId, userId]);
  if (!rows[0]) workflowError("That posted clip was not found.", "NOT_FOUND");
  await execute("UPDATE submissions SET views=?,last_view_sync_at=CURRENT_TIMESTAMP,view_sync_error=? WHERE id=? AND user_id=?", [Math.max(0, Math.floor(views)), syncError, submissionId, userId]);
  return { id: submissionId, views: Math.max(0, Math.floor(views)), last_view_sync_at: new Date(), view_sync_error: syncError };
}

export async function markWhopSubmitted(userId: string, clipId: string) { return updateWhopStatus(userId, clipId, "submitted"); }

export async function updateWhopStatus(userId: string, clipId: string, status: "not_submitted" | "submitted" | "approved") {
  await getClipForProvider(userId, clipId);
  const existing = await query<any>("SELECT id FROM submissions WHERE user_id=? AND clip_id=? ORDER BY created_at DESC LIMIT 1", [userId, clipId]);
  const submittedAt = status === "not_submitted" ? null : new Date();
  if (existing[0]) await execute("UPDATE submissions SET whop_submission_status=?,whop_submitted_at=? WHERE id=? AND user_id=?", [status, submittedAt, existing[0].id, userId]);
  else await execute("INSERT INTO submissions (id,user_id,clip_id,status,whop_submission_status,whop_submitted_at) VALUES (?,?,?,?,?,?)", [randomUUID(), userId, clipId, "pending", status, submittedAt]);
  return { clip_id: clipId, whop_submission_status: status, whop_submitted_at: submittedAt };
}

export async function getClipperSettings(userId: string) {
  const rows = await query<any>("SELECT tiktok_rate,instagram_rate,youtube_rate,x_rate,telegram_chat_id,telegram_enabled,telegram_milestone FROM clipper_settings WHERE user_id=? LIMIT 1", [userId]);
  return rows[0] ?? { tiktok_rate: null, instagram_rate: null, youtube_rate: null, x_rate: null, telegram_chat_id: null, telegram_enabled: false, telegram_milestone: 10000 };
}

export async function saveClipperSettings(userId: string, input: { tiktokRate?: number | null; instagramRate?: number | null; youtubeRate?: number | null; xRate?: number | null; telegramChatId?: string | null; telegramEnabled?: boolean; telegramMilestone?: number }) {
  await execute("INSERT INTO clipper_settings (user_id,tiktok_rate,instagram_rate,youtube_rate,x_rate,telegram_chat_id,telegram_enabled,telegram_milestone) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE tiktok_rate=VALUES(tiktok_rate),instagram_rate=VALUES(instagram_rate),youtube_rate=VALUES(youtube_rate),x_rate=VALUES(x_rate),telegram_chat_id=VALUES(telegram_chat_id),telegram_enabled=VALUES(telegram_enabled),telegram_milestone=VALUES(telegram_milestone),updated_at=CURRENT_TIMESTAMP", [userId, input.tiktokRate ?? null, input.instagramRate ?? null, input.youtubeRate ?? null, input.xRate ?? null, input.telegramChatId ?? null, input.telegramEnabled ?? false, input.telegramMilestone ?? 10000]);
  return getClipperSettings(userId);
}

export async function getEarningsSummary(userId: string) {
  const rows = await query<any>("SELECT id,views,status,earnings,rate_per_thousand,platform,created_at,post_url,whop_submission_status FROM submissions WHERE user_id=? ORDER BY created_at DESC LIMIT 500", [userId]);
  const settings = await getClipperSettings(userId);
  const rates: Record<string, number | null> = { tiktok: settings.tiktok_rate == null ? null : Number(settings.tiktok_rate), instagram: settings.instagram_rate == null ? null : Number(settings.instagram_rate), youtube: settings.youtube_rate == null ? null : Number(settings.youtube_rate), x: settings.x_rate == null ? null : Number(settings.x_rate) };
  const estimate = (row: any) => calculatePayout(Number(row.views ?? 0), row.rate_per_thousand == null ? rates[row.platform ?? ""] : Number(row.rate_per_thousand));
  return { totalViews: rows.reduce((sum, row) => sum + Number(row.views ?? 0), 0), estimatedEarnings: rows.reduce((sum, row) => sum + estimate(row), 0), submittedClips: rows.filter(row => row.whop_submission_status === "submitted").length, rates, history: rows.slice(0, 100).map(row => ({ ...row, estimated: estimate(row) })) };
}

export type NotificationRow = { id: string; type: string; title: string; body: string; href: string | null; is_read: boolean; created_at: Date | string };

export async function createNotification(userId: string, type: string, title: string, body: string, href: string | null = null) {
  const id = randomUUID();
  await execute("INSERT INTO klipflow_notifications (id,user_id,type,title,body,href) VALUES (?,?,?,?,?,?)", [id, userId, type, title, body, href]);
  return { id, user_id: userId, type, title, body, href, is_read: false, created_at: new Date() } as NotificationRow;
}

export async function listNotifications(userId: string) { return query<NotificationRow & RowDataPacket>("SELECT id,type,title,body,href,is_read,created_at FROM klipflow_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50", [userId]); }
export async function countUnreadNotifications(userId: string) { const rows = await query<any>("SELECT COUNT(*) AS count FROM klipflow_notifications WHERE user_id=? AND is_read=FALSE", [userId]); return Number(rows[0]?.count ?? 0); }
export async function markNotificationRead(userId: string, notificationId: string) { await execute("UPDATE klipflow_notifications SET is_read=TRUE WHERE id=? AND user_id=?", [notificationId, userId]); return { success: true } as const; }

export function getDueReminderMinutes(postedAt: string, now = new Date()) { const elapsedMinutes = (now.getTime() - new Date(postedAt).getTime()) / 60000; return [10, 25].filter(minute => elapsedMinutes >= minute && elapsedMinutes < 30); }

async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }) });
    return response.ok;
  } catch { return false; }
}

export async function processDueTelegramReminders(now = new Date()) {
  const lower = new Date(now.getTime() - 30 * 60_000);
  const candidates = await query<any>("SELECT s.id,s.user_id,s.post_url,s.platform,s.posted_at,c.title,p.requirements_link FROM submissions s JOIN generated_clips c ON c.id=s.clip_id JOIN projects p ON p.id=c.project_id WHERE s.posted_at IS NOT NULL AND s.posted_at>=? AND s.whop_submission_status NOT IN ('submitted','approved') LIMIT 500", [lower]);
  let sent = 0;
  let skipped = 0;
  for (const row of candidates) {
    for (const reminderMinute of getDueReminderMinutes(String(row.posted_at), now)) {
      const existing = await query("SELECT id FROM klipflow_reminder_deliveries WHERE submission_id=? AND reminder_minute=? AND channel='telegram' LIMIT 1", [row.id, reminderMinute]);
      if (existing[0]) continue;
      const deliveryId = randomUUID();
      await execute("INSERT INTO klipflow_reminder_deliveries (id,submission_id,reminder_minute,channel) VALUES (?,?,?,'telegram')", [deliveryId, row.id, reminderMinute]);
      const settings = await query<any>("SELECT telegram_chat_id,telegram_enabled FROM clipper_settings WHERE user_id=? LIMIT 1", [row.user_id]);
      const connected = await query<any>("SELECT handle,status FROM connected_accounts WHERE user_id=? AND platform='telegram' ORDER BY created_at DESC LIMIT 1", [row.user_id]);
      const chatId = settings[0]?.telegram_chat_id && settings[0]?.telegram_enabled !== false ? String(settings[0].telegram_chat_id) : connected[0]?.handle && connected[0]?.status !== "disconnected" ? String(connected[0].handle) : null;
      if (!chatId) { await execute("DELETE FROM klipflow_reminder_deliveries WHERE id=?", [deliveryId]); skipped += 1; continue; }
      const publicUrl = process.env.PUBLIC_APP_URL || process.env.APP_PUBLIC_URL || process.env.VITE_APP_URL || "";
      const campaign = row.requirements_link ? `\\nWhop campaign: ${row.requirements_link}` : "";
      const clipsUrl = publicUrl ? `${publicUrl.replace(/\/$/, "")}/clips` : "Open KlipFlow → My Clips";
      const text = reminderMinute === 10
        ? `KlipFlow reminder: ${row.title || "Your clip"} was posted to ${row.platform || "social media"}. You have about 20 minutes left to submit it to Whop.\\nPost: ${row.post_url || "Open My Clips"}${campaign}\\n${clipsUrl}`
        : `KlipFlow urgent reminder: ${row.title || "Your clip"} was posted to ${row.platform || "social media"}. You have about 5 minutes left to submit it to Whop.\\nPost: ${row.post_url || "Open My Clips"}${campaign}\\n${clipsUrl}`;
      if (await sendTelegramMessage(chatId, text)) { await createNotification(row.user_id, "submission_reminder", reminderMinute === 10 ? "20 minutes left to submit" : "5 minutes left to submit", text, "/clips"); sent += 1; }
      else { await execute("DELETE FROM klipflow_reminder_deliveries WHERE id=?", [deliveryId]); skipped += 1; }
    }
  }
  return { sent, skipped, candidates: candidates.length };
}

export async function processProviderViewSync() {
  const candidates = await query<any>("SELECT id,user_id,platform FROM submissions WHERE platform IN ('youtube','instagram') AND provider_post_id IS NOT NULL LIMIT 500");
  const { syncProviderViews } = await import("./socialProviders");
  let synced = 0;
  let failed = 0;
  for (const row of candidates) {
    try { const result = await syncProviderViews(row.user_id, row.id, row.platform); if (result?.view_sync_error) failed += 1; else synced += 1; }
    catch { failed += 1; }
  }
  return { synced, failed, candidates: candidates.length };
}

export async function processConnectedAccountHealth() {
  const users = await query<any>("SELECT DISTINCT user_id FROM connected_accounts LIMIT 1000");
  const { checkConnectedAccountsHealth } = await import("./socialProviders");
  let checked = 0;
  let attention = 0;
  for (const row of users) {
    const results = await checkConnectedAccountsHealth(String(row.user_id));
    for (const result of results) {
      if (!result.connected || result.status === "manual") continue;
      checked += 1;
      if (result.status === "healthy") await execute("UPDATE connected_accounts SET status='active',updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND platform=?", [row.user_id, result.platform]);
      if (result.status === "needs_attention") {
        attention += 1;
        await execute("UPDATE connected_accounts SET status='needs_attention',updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND platform=?", [row.user_id, result.platform]);
        const recent = await query("SELECT id FROM klipflow_notifications WHERE user_id=? AND type='connection_attention' AND title=? AND created_at>=DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR) LIMIT 1", [row.user_id, `${result.platform} authorization required`]);
        if (!recent[0]) await createNotification(String(row.user_id), "connection_attention", `${result.platform} authorization required`, result.message || `Reconnect ${result.platform} to keep posting enabled.`, "/accounts");
      }
    }
  }
  return { users: users.length, checked, attention };
}
