import { randomBytes } from "node:crypto";
import type { Express, Request, Response as ExpressResponse } from "express";
import { parse as parseCookie } from "cookie";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { getOAuthAccount, saveOAuthAccount } from "./supabaseWorkflow";

const YOUTUBE_STATE_COOKIE = "klipflow_youtube_oauth_state";
const INSTAGRAM_STATE_COOKIE = "klipflow_instagram_oauth_state";
const stateMaxAge = 10 * 60 * 1000;
const graphVersion = process.env.META_GRAPH_VERSION || "v26.0";

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function publicBaseUrl(req: Request) {
  const configured = env("PUBLIC_APP_URL") || env("APP_PUBLIC_URL") || env("VITE_APP_URL");
  if (configured) return configured.replace(/\/$/, "");
  const forwardedProto = String(req.headers["x-forwarded-proto"] || req.protocol).split(",")[0];
  return `${forwardedProto}://${req.get("host")}`.replace(/\/$/, "");
}

function redirectWithError(res: ExpressResponse, provider: string, error: unknown) {
  const message = error instanceof Error ? error.message : "OAuth connection failed.";
  res.redirect(302, `/accounts?oauth=${encodeURIComponent(provider)}-error&message=${encodeURIComponent(message.slice(0, 180))}`);
}

async function requireUser(req: Request) {
  const user = await sdk.authenticateRequest(req);
  if (!user?.openId) throw new Error("Please sign in before connecting an account.");
  return user;
}

async function fetchJson(provider: string, response: Response) {
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) throw new Error(`${provider} OAuth error (${response.status}): ${String(body?.error?.message || body?.error_description || body?.message || response.statusText).slice(0, 300)}`);
  return body;
}

function stateCookie(req: Request, res: ExpressResponse, name: string, state: string) {
  res.cookie(name, state, { ...getSessionCookieOptions(req), maxAge: stateMaxAge });
}

function clearStateCookie(req: Request, res: ExpressResponse, name: string) {
  res.clearCookie(name, { ...getSessionCookieOptions(req), maxAge: 0 });
}

function verifyState(req: Request, res: ExpressResponse, name: string, expected: string) {
  const actual = parseCookie(req.headers.cookie || "")[name];
  clearStateCookie(req, res, name);
  if (!actual || !expected || actual !== expected) throw new Error("OAuth state expired or did not match.");
}

export function registerSocialOAuthRoutes(app: Express) {
  app.get("/api/oauth/youtube/start", async (req, res) => {
    try {
      await requireUser(req);
      const clientId = env("YOUTUBE_CLIENT_ID");
      if (!clientId) throw new Error("YouTube OAuth is not configured yet.");
      const state = randomBytes(24).toString("hex");
      stateCookie(req, res, YOUTUBE_STATE_COOKIE, state);
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: `${publicBaseUrl(req)}/api/oauth/youtube/callback`, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly", state }).toString();
      res.redirect(302, url.toString());
    } catch (error) { redirectWithError(res, "youtube", error); }
  });

  app.get("/api/oauth/youtube/callback", async (req, res) => {
    try {
      const user = await requireUser(req);
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (req.query.error) throw new Error(`YouTube authorization was declined: ${String(req.query.error)}`);
      verifyState(req, res, YOUTUBE_STATE_COOKIE, state);
      const clientId = env("YOUTUBE_CLIENT_ID");
      const clientSecret = env("YOUTUBE_CLIENT_SECRET");
      if (!code || !clientId || !clientSecret) throw new Error("YouTube OAuth callback is missing required configuration.");
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${publicBaseUrl(req)}/api/oauth/youtube/callback`, grant_type: "authorization_code" }) });
      const token = await fetchJson("YouTube", tokenResponse);
      const accessToken = String(token.access_token || "");
      if (!accessToken) throw new Error("YouTube did not return an access token.");
      const profileResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${accessToken}` } });
      const profile = await fetchJson("YouTube", profileResponse);
      const channel = profile.items?.[0];
      const channelId = String(channel?.id || "");
      const title = String(channel?.snippet?.title || "YouTube channel");
      if (!channelId) throw new Error("No YouTube channel was available for this account.");
      const existing = await getOAuthAccount(user.openId, "youtube");
      await saveOAuthAccount(user.openId, "youtube", { handle: title, accessToken, refreshToken: String(token.refresh_token || existing?.refresh_token || "") || null, expiresAt: new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString(), providerUserId: channelId, providerAccountName: title, providerMetadata: { channel_id: channelId } });
      res.redirect(302, "/accounts?oauth=youtube-success");
    } catch (error) { redirectWithError(res, "youtube", error); }
  });

  app.get("/api/oauth/instagram/start", async (req, res) => {
    try {
      await requireUser(req);
      const appId = env("INSTAGRAM_APP_ID") || env("META_APP_ID");
      if (!appId) throw new Error("Instagram OAuth is not configured yet.");
      const state = randomBytes(24).toString("hex");
      stateCookie(req, res, INSTAGRAM_STATE_COOKIE, state);
      const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
      url.search = new URLSearchParams({ client_id: appId, redirect_uri: `${publicBaseUrl(req)}/api/oauth/instagram/callback`, response_type: "code", auth_type: "rerequest", scope: "instagram_basic,instagram_content_publish,pages_read_engagement,instagram_manage_insights", state }).toString();
      res.redirect(302, url.toString());
    } catch (error) { redirectWithError(res, "instagram", error); }
  });

  app.get("/api/oauth/instagram/callback", async (req, res) => {
    try {
      const user = await requireUser(req);
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (req.query.error) throw new Error(`Instagram authorization was declined: ${String(req.query.error_description || req.query.error)}`);
      verifyState(req, res, INSTAGRAM_STATE_COOKIE, state);
      const appId = env("INSTAGRAM_APP_ID") || env("META_APP_ID");
      const appSecret = env("INSTAGRAM_APP_SECRET") || env("META_APP_SECRET");
      if (!code || !appId || !appSecret) throw new Error("Instagram OAuth callback is missing required configuration.");
      const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
      tokenUrl.search = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: `${publicBaseUrl(req)}/api/oauth/instagram/callback`, code }).toString();
      const token = await fetchJson("Instagram", await fetch(tokenUrl));
      const userToken = String(token.access_token || "");
      if (!userToken) throw new Error("Instagram did not return an access token.");
      const accounts = await fetchJson("Instagram", await fetch(`https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(userToken)}`));
      const page = accounts.data?.find((item: any) => item.instagram_business_account?.id && item.access_token);
      if (!page) throw new Error("No Instagram professional account connected to a Facebook Page was found.");
      const igId = String(page.instagram_business_account.id);
      const pageToken = String(page.access_token);
      const profile = await fetchJson("Instagram", await fetch(`https://graph.facebook.com/${graphVersion}/${igId}?fields=username,name&access_token=${encodeURIComponent(pageToken)}`));
      const handle = String(profile.username || profile.name || "Instagram professional account");
      await saveOAuthAccount(user.openId, "instagram", { handle, accessToken: pageToken, expiresAt: null, providerUserId: igId, providerAccountName: handle, providerMetadata: { api_host: "https://graph.facebook.com", page_id: String(page.id), page_name: String(page.name || "") } });
      res.redirect(302, "/accounts?oauth=instagram-success");
    } catch (error) { redirectWithError(res, "instagram", error); }
  });
}
