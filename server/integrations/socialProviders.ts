import { getOAuthAccount, getClipForProvider, getSubmissionForProvider, notifyClipPosted, saveOAuthAccount, submitClip, updateProviderSubmissionViews } from "./supabaseWorkflow";

type ProviderAccount = NonNullable<Awaited<ReturnType<typeof getOAuthAccount>>>;
type Clip = Awaited<ReturnType<typeof getClipForProvider>>;

type JsonRecord = Record<string, any>;

const graphVersion = process.env.META_GRAPH_VERSION || "v26.0";

function providerError(provider: string, response: Response, body: JsonRecord | string) {
  const message = typeof body === "string" ? body : body?.error?.message || body?.error_description || body?.message || response.statusText;
  return new Error(`${provider} API error (${response.status}): ${String(message).slice(0, 500)}`);
}

async function jsonRequest(provider: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: JsonRecord | string = text;
  try { body = text ? JSON.parse(text) : {}; } catch { /* keep text */ }
  if (!response.ok) throw providerError(provider, response, body);
  return body as JsonRecord;
}

function clipTitle(clip: Clip) {
  return (clip.title || "KlipFlow clip").slice(0, 100);
}

function clipCaption(clip: Clip) {
  return (clip.caption || clipTitle(clip)).slice(0, 2200);
}

async function downloadClip(clipUrl: string) {
  const response = await fetch(clipUrl, { redirect: "follow" });
  if (!response.ok) throw new Error(`KlipFlow clip download failed (${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("KlipFlow clip is empty.");
  return buffer;
}

async function youtubeAccessToken(userId: string, account: ProviderAccount) {
  if (!account.access_token) throw new Error("Reconnect YouTube before posting.");
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  if (!account.refresh_token || !expiresAt || expiresAt > Date.now() + 60_000) return account.access_token;
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("YouTube OAuth is not configured yet.");
  const body = await jsonRequest("YouTube", "https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: account.refresh_token, grant_type: "refresh_token" }) });
  const accessToken = String(body.access_token || "");
  if (!accessToken) throw new Error("YouTube token refresh returned no access token.");
  await saveOAuthAccount(userId, "youtube", { handle: account.handle, accessToken, refreshToken: account.refresh_token, expiresAt: new Date(Date.now() + Number(body.expires_in || 3600) * 1000).toISOString(), providerUserId: account.provider_user_id, providerMetadata: account.provider_metadata });
  return accessToken;
}

export async function postToYouTube(userId: string, clip: Clip) {
  if (!clip.clip_url) throw new Error("This clip has no video file to post.");
  const account = await getOAuthAccount(userId, "youtube");
  if (!account) throw new Error("Connect YouTube before posting.");
  const accessToken = await youtubeAccessToken(userId, account);
  const video = await downloadClip(clip.clip_url);
  const metadata = { snippet: { title: clipTitle(clip), description: clipCaption(clip), categoryId: "22" }, status: { privacyStatus: "public", selfDeclaredMadeForKids: false } };
  const initResponse = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": String(video.length) }, body: JSON.stringify(metadata) });
  if (!initResponse.ok) throw providerError("YouTube", initResponse, await initResponse.text());
  const uploadUrl = initResponse.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube did not return an upload URL.");
  const uploaded = await jsonRequest("YouTube", uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "video/mp4", "Content-Length": String(video.length) }, body: video });
  const providerPostId = String(uploaded.id || "");
  if (!providerPostId) throw new Error("YouTube upload returned no video ID.");
  const postUrl = `https://www.youtube.com/shorts/${providerPostId}`;
  const result = await submitClip(userId, clip.id, postUrl, "youtube", providerPostId);
  await notifyClipPosted(userId, clip.id, "youtube");
  return { result, providerPostId, postUrl };
}

async function instagramRequest(account: ProviderAccount, path: string, init: RequestInit = {}) {
  const host = String(account.provider_metadata?.api_host || "https://graph.instagram.com");
  return jsonRequest("Instagram", `${host}/${graphVersion}/${path.replace(/^\//, "")}`, init);
}

async function instagramForm(account: ProviderAccount, path: string, params: Record<string, string>) {
  const form = new URLSearchParams({ ...params, access_token: String(account.access_token || "") });
  return instagramRequest(account, path, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
}

export async function postToInstagram(userId: string, clip: Clip) {
  if (!clip.clip_url) throw new Error("This clip has no video file to post.");
  const account = await getOAuthAccount(userId, "instagram");
  if (!account?.access_token || !account.provider_user_id) throw new Error("Connect an Instagram professional account before posting.");
  if (!/^https?:\/\//i.test(clip.clip_url)) throw new Error("Instagram needs a public HTTPS clip URL. Set PUBLIC_APP_URL and regenerate this clip.");
  const container = await instagramForm(account, `${account.provider_user_id}/media`, { media_type: "REELS", video_url: clip.clip_url, caption: clipCaption(clip) });
  const containerId = String(container.id || "");
  if (!containerId) throw new Error("Instagram returned no media container ID.");
  let status = "IN_PROGRESS";
  for (let attempt = 0; attempt < 12 && status === "IN_PROGRESS"; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const state = await instagramRequest(account, `${containerId}?fields=status_code`);
    status = String(state.status_code || "");
    if (status === "ERROR" || status === "EXPIRED") throw new Error(`Instagram media container failed with status ${status}.`);
  }
  if (status !== "FINISHED") throw new Error("Instagram media is still processing. Try again in a moment.");
  const published = await instagramForm(account, `${account.provider_user_id}/media_publish`, { creation_id: containerId });
  const providerPostId = String(published.id || "");
  if (!providerPostId) throw new Error("Instagram returned no published media ID.");
  let postUrl = `https://www.instagram.com/reel/${providerPostId}/`;
  try {
    const permalink = await instagramRequest(account, providerPostId, { method: "GET" });
    if (permalink.permalink) postUrl = String(permalink.permalink);
  } catch { /* permalink is optional; the media ID remains valid for syncing */ }
  const result = await submitClip(userId, clip.id, postUrl, "instagram", providerPostId);
  await notifyClipPosted(userId, clip.id, "instagram");
  return { result, providerPostId, postUrl };
}

export async function postClipToProvider(userId: string, clipId: string, platform: "youtube" | "instagram") {
  const clip = await getClipForProvider(userId, clipId);
  return platform === "youtube" ? postToYouTube(userId, clip) : postToInstagram(userId, clip);
}

export async function syncYouTubeViews(userId: string, submissionId: string) {
  const submission = await getSubmissionForProvider(userId, submissionId);
  const account = await getOAuthAccount(userId, "youtube");
  if (!account) throw new Error("Connect YouTube to sync views.");
  const accessToken = await youtubeAccessToken(userId, account);
  const id = String(submission.provider_post_id || "");
  if (!id) throw new Error("This YouTube submission has no provider video ID.");
  const body = await jsonRequest("YouTube", `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const views = Number(body.items?.[0]?.statistics?.viewCount || 0);
  return updateProviderSubmissionViews(userId, submissionId, views);
}

export async function syncInstagramViews(userId: string, submissionId: string) {
  const submission = await getSubmissionForProvider(userId, submissionId);
  const account = await getOAuthAccount(userId, "instagram");
  if (!account?.access_token) throw new Error("Connect Instagram to sync views.");
  const id = String(submission.provider_post_id || "");
  if (!id) throw new Error("This Instagram submission has no provider media ID.");
  const body = await instagramRequest(account, `${id}/insights?metric=views,total_views`);
  const metrics = Array.isArray(body.data) ? body.data : [];
  const metric = metrics.find((item: JsonRecord) => item.name === "views") || metrics.find((item: JsonRecord) => item.name === "total_views");
  const values = Array.isArray(metric?.values) ? metric.values : [];
  const latest = values.length ? values[values.length - 1]?.value : metric?.value;
  return updateProviderSubmissionViews(userId, submissionId, Number(latest || 0));
}

export async function syncProviderViews(userId: string, submissionId: string, platform: "youtube" | "instagram") {
  try {
    return platform === "youtube" ? await syncYouTubeViews(userId, submissionId) : await syncInstagramViews(userId, submissionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "View sync failed.";
    let previousViews = 0;
    try { previousViews = Number((await getSubmissionForProvider(userId, submissionId)).views || 0); } catch { /* ownership or provider error is already represented below */ }
    return updateProviderSubmissionViews(userId, submissionId, previousViews, message);
  }
}
