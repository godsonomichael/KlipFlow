import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";
import { calculatePayout } from "@shared/klipflow";
import { processVideoIntoClips } from "./ffmpegWorker";
import { storagePut } from "../storage";

let client: SupabaseClient | null = null;

function getClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "KlipFlow data is not connected yet." });
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

function publicAppUrl() {
  return process.env.PUBLIC_APP_URL || process.env.APP_PUBLIC_URL || process.env.VITE_APP_URL || "";
}

async function getTelegramChatId(userId: string) {
  const db = getClient();
  const { data: settings } = await db.from("clipper_settings").select("telegram_chat_id,telegram_enabled").eq("user_id", userId).limit(1).maybeSingle();
  if (settings?.telegram_chat_id && settings.telegram_enabled !== false) return String(settings.telegram_chat_id);
  const { data: connected } = await db.from("connected_accounts").select("handle,status").eq("user_id", userId).eq("platform", "telegram").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (connected?.handle && connected.status !== "disconnected") return String(connected.handle);
  return null;
}

export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function sendPersonalTelegramAlert(userId: string, text: string) {
  const chatId = await getTelegramChatId(userId);
  if (!chatId) return false;
  return sendTelegramMessage(chatId, text);
}

export type WorkflowAccount = { id: string; platform: string; handle: string; status: string };

export async function listConnectedAccounts(userId: string) {
  const { data, error } = await getClient().from("connected_accounts").select("id,platform,handle,status").eq("user_id", userId).order("created_at", { ascending: true }).limit(50);
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not load your connected accounts." });
  return (data ?? []) as WorkflowAccount[];
}

export async function addConnectedAccount(userId: string, platform: string, handle: string) {
  const { data, error } = await getClient().from("connected_accounts").upsert({ user_id: userId, platform, handle, status: "placeholder" }, { onConflict: "user_id,platform,handle" }).select("id,platform,handle,status").single();
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not save that account." });
  return data as WorkflowAccount;
}

export type OAuthAccount = {
  id: string;
  platform: string;
  handle: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  provider_user_id: string | null;
  provider_metadata: Record<string, unknown> | null;
};

export async function getOAuthAccount(userId: string, platform: string) {
  const { data, error } = await getClient().from("connected_accounts").select("id,platform,handle,access_token,refresh_token,token_expires_at,provider_user_id,provider_metadata").eq("user_id", userId).eq("platform", platform).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not load that connected account." });
  return (data ?? null) as OAuthAccount | null;
}

export async function saveOAuthAccount(userId: string, platform: string, input: { handle: string; accessToken: string; refreshToken?: string | null; expiresAt?: string | null; providerUserId?: string | null; providerAccountName?: string | null; providerMetadata?: Record<string, unknown> | null }) {
  const db = getClient();
  const existing = await getOAuthAccount(userId, platform);
  const values = { user_id: userId, platform, handle: input.handle, access_token: input.accessToken, refresh_token: input.refreshToken ?? null, token_expires_at: input.expiresAt ?? null, provider_user_id: input.providerUserId ?? null, provider_account_name: input.providerAccountName ?? null, provider_metadata: input.providerMetadata ?? null, status: "active" };
  const query = existing?.id ? db.from("connected_accounts").update(values).eq("id", existing.id).eq("user_id", userId) : db.from("connected_accounts").insert(values);
  const { error } = await query;
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not save the OAuth connection." });
  return { success: true } as const;
}

export async function removeConnectedAccount(userId: string, id: string) {
  const { error } = await getClient().from("connected_accounts").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not remove that account." });
  return { success: true } as const;
}

export async function createProject(userId: string, input: { sourceLink?: string; fileUrl?: string; requirementsLink?: string; requirementsFile?: string; title?: string }) {
  const { data, error } = await getClient().from("projects").insert({ user_id: userId, title: input.title ?? "New clipping project", source_link: input.sourceLink ?? null, file_url: input.fileUrl ?? null, requirements_link: input.requirementsLink ?? null, requirements_file: input.requirementsFile ?? null, status: "created" }).select("id,title,source_link,file_url,requirements_link,requirements_file,status,created_at").single();
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not create that project." });
  return data;
}

export async function listProjects(userId: string) {
  const { data, error } = await getClient().from("projects").select("id,title,source_link,file_url,requirements_link,requirements_file,status,created_at,generated_clips(count)").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not load your projects." });
  return data ?? [];
}

export async function getProject(userId: string, projectId: string) {
  const { data, error } = await getClient().from("projects").select("id,title,source_link,file_url,requirements_link,requirements_file,status,created_at").eq("id", projectId).eq("user_id", userId).limit(1).maybeSingle();
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not load that project." });
  if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "That project was not found." });
  return data;
}

export async function generateClips(userId: string, projectId: string) {
  const db = getClient();
  const { data: project, error: projectError } = await db.from("projects").select("id,source_link,file_url,status").eq("id", projectId).eq("user_id", userId).limit(1).maybeSingle();
  if (projectError || !project) throw new TRPCError({ code: "NOT_FOUND", message: "That project was not found." });
  const sourceVideo = project.file_url ?? project.source_link ?? null;
  if (!sourceVideo) throw new TRPCError({ code: "BAD_REQUEST", message: "Add a video file or a direct video URL before generating clips." });
  await db.from("projects").update({ status: "processing", processing_error: null, processed_at: null }).eq("id", projectId).eq("user_id", userId);
  try {
    const result = await processVideoIntoClips({ userId, projectId, source: sourceVideo, upload: async (key, body, contentType) => storagePut(key, body, contentType) });
    const clips = result.clips.map(clip => ({ project_id: projectId, title: clip.title, caption: clip.caption, clip_url: clip.clipUrl, status: "ready", start_seconds: clip.startSeconds, end_seconds: clip.endSeconds, duration_seconds: clip.durationSeconds, processing_job_id: clip.processingJobId }));
    const { data, error } = await db.from("generated_clips").insert(clips).select("id,project_id,title,caption,clip_url,status,start_seconds,end_seconds,duration_seconds,processing_job_id,created_at");
    if (error) throw new Error(error.message);
    await db.from("projects").update({ status: "ready", processed_at: new Date().toISOString(), processing_error: null }).eq("id", projectId).eq("user_id", userId);
    await sendPersonalTelegramAlert(userId, `KlipFlow: ${data?.length ?? 0} real clips are ready for your project.`);
    await createNotification(userId, "clip_ready", "Your clips are ready", `${data?.length ?? 0} real clips are ready to review.`, "/clips");
    return data ?? [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video processing failed.";
    await db.from("projects").update({ status: "failed", processing_error: message }).eq("id", projectId).eq("user_id", userId);
    throw new TRPCError({ code: "BAD_GATEWAY", message });
  }
}

export async function listClips(userId: string) {
  const db = getClient();
  const { data, error } = await db.from("generated_clips").select("id,project_id,title,caption,clip_url,status,start_seconds,end_seconds,duration_seconds,processing_job_id,created_at,projects!inner(user_id,title,source_link,file_url,requirements_link),submissions(id,post_url,views,status,earnings,platform,whop_submission_status,whop_submitted_at,posted_at,provider_post_id,last_view_sync_at,view_sync_error)").eq("projects.user_id", userId).order("created_at", { ascending: false }).limit(100);
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not load your clips." });
  return data ?? [];
}

export async function submitClip(userId: string, clipId: string, postUrl: string, platform?: string, providerPostId?: string) {
  const db = getClient();
  const { data: clip, error: clipError } = await db.from("generated_clips").select("id,projects!inner(user_id)").eq("id", clipId).eq("projects.user_id", userId).single();
  if (clipError || !clip) throw new TRPCError({ code: "NOT_FOUND", message: "That clip was not found." });
  const { data, error } = await db.from("submissions").insert({ user_id: userId, clip_id: clipId, post_url: postUrl, platform: platform ?? null, provider_post_id: providerPostId ?? null, provider_status: providerPostId ? "published" : null, posted_at: new Date().toISOString(), status: "pending", whop_submission_status: "not_submitted" }).select("id,clip_id,post_url,views,status,earnings,platform,provider_post_id,provider_status,whop_submission_status,posted_at,created_at").single();
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not submit that clip." });
  return data;
}

export async function notifyClipPosted(userId: string, clipId: string, platform: string) {
  const { data: project } = await getClient().from("generated_clips").select("projects!inner(requirements_link,user_id)").eq("id", clipId).eq("projects.user_id", userId).limit(1).maybeSingle();
  const campaignLink = (project?.projects as { requirements_link?: string | null } | null)?.requirements_link;
  await sendPersonalTelegramAlert(userId, `KlipFlow: your clip was posted to ${platform}. Submit it to Whop within 30 minutes.${campaignLink ? ` Campaign link: ${campaignLink}` : " Open My Clips to submit."}`);
  await createNotification(userId, "post_success", "Your clip was posted", `Your clip was posted to ${platform}. Submit it to Whop within 30 minutes.`, "/clips");
}

export async function updateClipMetadata(userId: string, clipId: string, title: string, caption: string) {
  const { data, error } = await getClient().from("generated_clips").update({ title, caption }).eq("id", clipId).eq("projects.user_id", userId).select("id,title,caption,clip_url,status,created_at,projects!inner(user_id)").single();
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not save your clip text." });
  return data;
}

export async function getClipForProvider(userId: string, clipId: string) {
  const { data, error } = await getClient().from("generated_clips").select("id,title,caption,clip_url,projects!inner(user_id,title)").eq("id", clipId).eq("projects.user_id", userId).limit(1).maybeSingle();
  if (error || !data) throw new TRPCError({ code: "NOT_FOUND", message: "That clip was not found." });
  return data as { id: string; title: string | null; caption: string | null; clip_url: string | null; projects: { user_id: string; title: string } | { user_id: string; title: string }[] };
}

export async function updateProviderSubmissionViews(userId: string, submissionId: string, views: number, syncError: string | null = null) {
  const { data, error } = await getClient().from("submissions").update({ views: Math.max(0, Math.floor(views)), last_view_sync_at: new Date().toISOString(), view_sync_error: syncError }).eq("id", submissionId).eq("user_id", userId).select("id,views,last_view_sync_at,view_sync_error").single();
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not save the latest view count." });
  return data;
}

export async function getSubmissionForProvider(userId: string, submissionId: string) {
  const { data, error } = await getClient().from("submissions").select("id,clip_id,post_url,platform,provider_post_id,views,generated_clips!inner(id,title,caption,clip_url,projects!inner(user_id,title))").eq("id", submissionId).eq("user_id", userId).limit(1).maybeSingle();
  if (error || !data) throw new TRPCError({ code: "NOT_FOUND", message: "That posted clip was not found." });
  return data;
}

export async function simulatePost(userId: string, clipId: string, platform: string, handle: string) {
  const clean = handle.replace(/^@/, "").replace(/[^a-zA-Z0-9_.-]/g, "") || "clipper";
  const postUrl = `${platform === "instagram" ? "https://instagram.com/reel" : platform === "youtube" ? "https://youtube.com/shorts" : platform === "x" ? "https://x.com" : "https://tiktok.com/@" + clean + "/video"}/${Date.now()}`;
  const result = await submitClip(userId, clipId, postUrl, platform);
  await notifyClipPosted(userId, clipId, platform);
  return result;
}

export async function markWhopSubmitted(userId: string, clipId: string) {
  const db = getClient();
  const { data: clip, error: clipError } = await db.from("generated_clips").select("id,projects!inner(user_id)").eq("id", clipId).eq("projects.user_id", userId).single();
  if (clipError || !clip) throw new TRPCError({ code: "NOT_FOUND", message: "That clip was not found." });
  const { data: existing } = await db.from("submissions").select("id").eq("user_id", userId).eq("clip_id", clipId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing?.id) {
    const { data, error } = await db.from("submissions").update({ whop_submission_status: "submitted", whop_submitted_at: new Date().toISOString() }).eq("id", existing.id).eq("user_id", userId).select("id,clip_id,post_url,views,status,earnings,platform,whop_submission_status,whop_submitted_at").single();
    if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not update the Whop submission status." });
    return data;
  }
  const { data, error } = await db.from("submissions").insert({ user_id: userId, clip_id: clipId, status: "pending", whop_submission_status: "submitted", whop_submitted_at: new Date().toISOString() }).select("id,clip_id,post_url,views,status,earnings,platform,whop_submission_status,whop_submitted_at").single();
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not save the Whop submission." });
  return data;
}

export async function updateWhopStatus(userId: string, clipId: string, status: "not_submitted" | "submitted" | "approved") {
  const db = getClient();
  const { data: clip } = await db.from("generated_clips").select("id,projects!inner(user_id)").eq("id", clipId).eq("projects.user_id", userId).single();
  if (!clip) throw new TRPCError({ code: "NOT_FOUND", message: "That clip was not found." });
  const { data: existing } = await db.from("submissions").select("id").eq("user_id", userId).eq("clip_id", clipId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const values = { whop_submission_status: status, whop_submitted_at: status === "not_submitted" ? null : new Date().toISOString() };
  if (existing?.id) {
    const { data, error } = await db.from("submissions").update(values).eq("id", existing.id).select("id,clip_id,post_url,views,platform,whop_submission_status,whop_submitted_at").single();
    if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not update that status." });
    return data;
  }
  const { data, error } = await db.from("submissions").insert({ user_id: userId, clip_id: clipId, status: "pending", whop_submission_status: status, whop_submitted_at: values.whop_submitted_at }).select("id,clip_id,post_url,views,platform,whop_submission_status,whop_submitted_at").single();
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not save that status." });
  return data;
}

export async function getClipperSettings(userId: string) {
  const { data, error } = await getClient().from("clipper_settings").select("tiktok_rate,instagram_rate,youtube_rate,x_rate,telegram_chat_id,telegram_enabled,telegram_milestone").eq("user_id", userId).limit(1).maybeSingle();
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not load your settings." });
  return data ?? { tiktok_rate: null, instagram_rate: null, youtube_rate: null, x_rate: null, telegram_chat_id: null, telegram_enabled: false, telegram_milestone: 10000 };
}

export async function saveClipperSettings(userId: string, input: { tiktokRate?: number | null; instagramRate?: number | null; youtubeRate?: number | null; xRate?: number | null; telegramChatId?: string | null; telegramEnabled?: boolean; telegramMilestone?: number }) {
  const { data, error } = await getClient().from("clipper_settings").upsert({ user_id: userId, tiktok_rate: input.tiktokRate ?? null, instagram_rate: input.instagramRate ?? null, youtube_rate: input.youtubeRate ?? null, x_rate: input.xRate ?? null, telegram_chat_id: input.telegramChatId ?? null, telegram_enabled: input.telegramEnabled ?? false, telegram_milestone: input.telegramMilestone ?? 10000, updated_at: new Date().toISOString() }).select("tiktok_rate,instagram_rate,youtube_rate,x_rate,telegram_chat_id,telegram_enabled,telegram_milestone").single();
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not save your settings." });
  return data;
}

export async function getEarningsSummary(userId: string) {
  const db = getClient();
  const { data, error } = await db.from("submissions").select("id,views,status,earnings,rate_per_thousand,platform,created_at,post_url,whop_submission_status").eq("user_id", userId).order("created_at", { ascending: false }).limit(500);
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not load your earnings." });
  const { data: settings } = await db.from("clipper_settings").select("tiktok_rate,instagram_rate,youtube_rate,x_rate").eq("user_id", userId).limit(1).maybeSingle();
  const rates: Record<string, number | null> = { tiktok: settings?.tiktok_rate ?? null, instagram: settings?.instagram_rate ?? null, youtube: settings?.youtube_rate ?? null, x: settings?.x_rate ?? null };
  const rows = data ?? [];
  const estimate = (row: { views?: number | null; platform?: string | null; rate_per_thousand?: number | null }) => calculatePayout(Number(row.views ?? 0), row.rate_per_thousand == null ? rates[row.platform ?? ""] : Number(row.rate_per_thousand));
  return { totalViews: rows.reduce((sum, row) => sum + Number(row.views ?? 0), 0), estimatedEarnings: rows.reduce((sum, row) => sum + estimate(row), 0), submittedClips: rows.filter(row => row.whop_submission_status === "submitted").length, rates, history: rows.slice(0, 100).map(row => ({ ...row, estimated: estimate(row) })) };
}

export type NotificationRow = { id: string; type: string; title: string; body: string; href: string | null; is_read: boolean; created_at: string };

export async function createNotification(userId: string, type: string, title: string, body: string, href: string | null = null) {
  const { data, error } = await getClient().from("klipflow_notifications").insert({ user_id: userId, type, title, body, href }).select("id,type,title,body,href,is_read,created_at").single();
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not save that notification." });
  return data as NotificationRow;
}

export async function listNotifications(userId: string) {
  const { data, error } = await getClient().from("klipflow_notifications").select("id,type,title,body,href,is_read,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not load your notifications." });
  return (data ?? []) as NotificationRow[];
}

export async function countUnreadNotifications(userId: string) {
  const { count, error } = await getClient().from("klipflow_notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_read", false);
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not count your notifications." });
  return count ?? 0;
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const { error } = await getClient().from("klipflow_notifications").update({ is_read: true }).eq("id", notificationId).eq("user_id", userId);
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not update that notification." });
  return { success: true } as const;
}

export function getDueReminderMinutes(postedAt: string, now = new Date()) {
  const elapsedMinutes = (now.getTime() - new Date(postedAt).getTime()) / 60_000;
  return [10, 25].filter((minute) => elapsedMinutes >= minute && elapsedMinutes < 30);
}

export async function processDueTelegramReminders(now = new Date()) {
  const db = getClient();
  const lower = new Date(now.getTime() - 30 * 60_000).toISOString();
  const { data: submissions, error } = await db.from("submissions").select("id,user_id,clip_id,post_url,platform,views,whop_submission_status,posted_at,generated_clips(title,projects(title,requirements_link))").not("posted_at", "is", null).neq("whop_submission_status", "submitted").neq("whop_submission_status", "approved").gte("posted_at", lower).limit(500);
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not load reminder candidates." });
  let sent = 0;
  let skipped = 0;
  for (const row of submissions ?? []) {
    if (!row.posted_at || !row.user_id) continue;
    const dueMinutes = getDueReminderMinutes(row.posted_at, now);
    for (const reminderMinute of dueMinutes) {
      const { data: delivery, error: deliveryError } = await db.from("klipflow_reminder_deliveries").upsert({ submission_id: row.id, reminder_minute: reminderMinute, channel: "telegram" }, { onConflict: "submission_id,reminder_minute,channel", ignoreDuplicates: true }).select("id").maybeSingle();
      if (deliveryError || !delivery?.id) { skipped += 1; continue; }
      const clip = Array.isArray(row.generated_clips) ? row.generated_clips[0] : row.generated_clips;
      const project = clip && (Array.isArray(clip.projects) ? clip.projects[0] : clip.projects);
      const title = clip?.title || "Your clip";
      const platform = row.platform || "social media";
      const appLink = publicAppUrl() ? `${publicAppUrl().replace(/\/$/, "")}/clips` : "Open KlipFlow → My Clips";
      const campaignLink = project?.requirements_link ? `\nWhop campaign: ${project.requirements_link}` : "";
      const text = reminderMinute === 10
        ? `KlipFlow reminder: ${title} was posted to ${platform}. You have about 20 minutes left to submit it to Whop.\nPost: ${row.post_url || "Open My Clips"}${campaignLink}\n${appLink}`
        : `KlipFlow urgent reminder: ${title} was posted to ${platform}. You have about 5 minutes left to submit it to Whop.\nPost: ${row.post_url || "Open My Clips"}${campaignLink}\n${appLink}`;
      const delivered = await sendPersonalTelegramAlert(row.user_id, text);
      if (!delivered) {
        await db.from("klipflow_reminder_deliveries").delete().eq("id", delivery.id);
        skipped += 1;
        continue;
      }
      await createNotification(row.user_id, "submission_reminder", reminderMinute === 10 ? "20 minutes left to submit" : "5 minutes left to submit", text, "/clips");
      sent += 1;
    }
  }
  return { sent, skipped, candidates: submissions?.length ?? 0 };
}

export async function processProviderViewSync() {
  const db = getClient();
  const { data: submissions, error } = await db.from("submissions").select("id,user_id,platform,provider_post_id").in("platform", ["youtube", "instagram"]).not("provider_post_id", "is", null).limit(500);
  if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: "We could not load view-sync candidates." });
  const { syncProviderViews } = await import("./socialProviders");
  let synced = 0;
  let failed = 0;
  for (const row of submissions ?? []) {
    if (!row.user_id || (row.platform !== "youtube" && row.platform !== "instagram")) continue;
    const result = await syncProviderViews(row.user_id, row.id, row.platform);
    if (result?.view_sync_error) failed += 1;
    else synced += 1;
  }
  return { synced, failed, candidates: submissions?.length ?? 0 };
}
