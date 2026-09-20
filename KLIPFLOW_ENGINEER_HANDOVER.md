# KlipFlow — Engineer Handover, Access, and Migration Note

**Prepared:** 19 September 2026
**Purpose:** Give a software engineer enough context to continue KlipFlow safely, distinguish working functionality from unverified integrations, and complete the migration to a fully production-owned deployment.

> **Important:** This document intentionally contains no secret values. Credentials, database URLs, OAuth client secrets, access tokens, and internal WebDev tokens must be transferred through a secure secret manager or a controlled password vault, never through GitHub issues, chat, email, or this Markdown file.

## Executive status

KlipFlow is a real, bootable, mobile-first application with the original orange, white, and black product interface. The current source includes authenticated project management, video upload and source-link ingestion, persistent project and clip records, bundled FFmpeg/FFprobe processing, clip review, manual submission tracking, provider OAuth routes, provider publishing code for TikTok, YouTube, and Instagram, Telegram reminder handlers, view synchronization handlers, account-health checks, earnings calculations, and CI validation.

It is **not yet a complete production version of the original AI Viral Clip Factory specification**. The current media worker renders **five evenly distributed clips**, applies a basic 9:16 scale-and-pad transform, and uses generic clip titles. It does not yet transcribe audio, identify hooks with AI, score viral moments, generate animated captions, track faces, perform intelligent reframing, or produce thirty selected clips. Some integration paths are implemented in code but have not been validated with production credentials and approved provider applications. The Whop workflow currently tracks manual submission status; it is not a completed Whop API submission integration.

The correct engineering approach is therefore to **preserve the current product UI and working workflow, establish a new production-owned infrastructure boundary, then complete the AI processing and provider-validation work in small, testable increments**. Do not replace the interface with a new visual system or hardcoded demo state.

## Current verified baseline

The audit was performed against the real KlipFlow source and the active WebDev project on 19 September 2026.

| Area | Current state | Evidence or location | Production confidence |
|---|---|---|---|
| Frontend | Real KlipFlow interface with light theme, orange actions, protected dashboard shell, responsive pages, onboarding, notifications, and account settings | `client/src/App.tsx`, `client/src/components/KlipFlowShell.tsx`, `client/src/pages/` | Confirmed in WebDev preview |
| Authentication | Manus OAuth/session integration and protected tRPC procedures are present | `server/_core/oauth.ts`, `server/_core/context.ts`, `server/_core/sdk.ts`, `server/_core/trpc.ts` | Works in the current Manus environment; must be replaced or retained intentionally during migration |
| Project creation | Supports a direct source URL, uploaded video, optional requirements link, optional requirements file, and project title | `client/src/pages/NewProject.tsx`, `server/integrations/workflowUpload.ts`, `server/routers.ts` | Code and automated checks pass; end-to-end production storage test still required |
| Storage | Uses Manus Forge presigned upload/download storage and `/manus-storage/{key}` proxy paths | `server/storage.ts`, `server/_core/storageProxy.ts` | Works only while the Forge storage environment is retained |
| Database | Active router uses native MySQL/TiDB persistence through `DATABASE_URL`; the schema includes projects, generation jobs, clips, connected accounts, submissions, notifications, reminders, and settings | `server/integrations/nativeWorkflow.ts`, `drizzle/schema.ts`, `drizzle/*.sql` | Code is present; production backup, restore, and migration procedure still required |
| Media generation | Bundled FFmpeg and FFprobe fallback paths are implemented. The worker downloads the source, reads duration, renders five clips, uploads each clip, records progress, and supports cancellation | `server/integrations/ffmpegWorker.ts` | Unit-tested and build-tested; real production long-video load test still required |
| Clip review | Clip list, video preview, download, metadata editing, post-link capture, view display, Whop status, and retry/generation history UI are present | `client/src/pages/Clips.tsx`, `client/src/pages/ProjectDetail.tsx` | Code present; requires authenticated user acceptance testing |
| TikTok | OAuth start/callback, token storage/refresh, account health check, direct posting, publish-status polling, and developer verification endpoints are present | `server/integrations/socialOAuth.ts`, `server/integrations/socialProviders.ts`, `server/_core/index.ts` | Requires approved app, valid credentials, verified public media URL, and live sandbox/production test |
| YouTube Shorts | OAuth start/callback, token refresh, resumable upload through the YouTube Data API, and YouTube view synchronization are present | `server/integrations/socialOAuth.ts`, `server/integrations/socialProviders.ts` | Requires Google Cloud configuration, consent-screen readiness, valid credentials, quota review, and live test |
| Instagram Reels | Facebook Login-based OAuth, professional-account discovery, Reel container creation, processing poll, publish call, and insight sync are present | `server/integrations/socialOAuth.ts`, `server/integrations/socialProviders.ts` | Requires Meta Business/Page setup, correct permissions, public media URLs, app review/advanced access as applicable, and live test |
| Manual publishing | Manual post URL submission is available, including the Instagram manual fallback | `client/src/pages/Clips.tsx`, `server/routers.ts` | Available now and should remain the fallback while provider approvals are pending |
| Simulated publishing path | A compatibility procedure named `autoPost`/`simulatePost` creates a synthetic post URL. The current frontend uses real provider posting for YouTube, Instagram, and TikTok, but the simulated backend path must not be presented as production publishing | `server/routers.ts`, `server/integrations/nativeWorkflow.ts` | Must be removed, disabled, or explicitly marked as test-only before production launch |
| Telegram | Reminder logic, notification records, and cron-only handlers are present | `server/integrations/nativeWorkflow.ts`, `server/integrations/telegramReminders.ts` | Requires bot token, chat ID/settings, and an active recurring scheduler |
| View sync | YouTube and Instagram sync handlers are present; TikTok view synchronization is not implemented in the current provider module | `server/integrations/socialProviders.ts`, `server/integrations/viewSync.ts` | Requires scheduled execution and provider validation |
| CI | GitHub Actions runs `pnpm install --frozen-lockfile`, type check, tests, and production build. `master` is protected and requires `Check, test, and build` | `.github/workflows/ci.yml`, GitHub branch protection | Confirmed in GitHub |

### Automated validation result

The current real source passed the following local checks during this handover audit:

- `pnpm check` — passed.
- `pnpm test` — **13 tests passed, 2 credential-dependent tests skipped**.
- `pnpm build` — passed.
- The WebDev project booted successfully on port 3000 and displayed the real KlipFlow UI.

The skipped tests are expected when provider credentials are not supplied to the test process. They are not evidence that TikTok or Telegram production credentials work.

## Repository and project access

### Source of truth

The portable source of truth is the public GitHub repository:

- **Repository:** `godsonomichael/KlipFlow`
- **URL:** https://github.com/godsonomichael/KlipFlow
- **Default branch:** `master`
- **Current GitHub master commit at audit time:** `b462e3545b2f0c3449460ef55f91f5587ebdd2a0`
- **Visibility:** Public
- **Branch protection:** Enabled. The required status check is `Check, test, and build`, and the check must be up to date before merging.

An engineer should clone the repository and work from a feature branch:

```bash
git clone https://github.com/godsonomichael/KlipFlow.git
cd KlipFlow
git checkout master
git pull --ff-only
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Do not use the temporary sandbox paths `/tmp/KlipFlow` or `/home/ubuntu/klipflow` as the long-term source of truth. Those are working copies associated with the current Manus task. Do not copy the internal WebDev artifact remote, token, or `.project-config.json` into another environment.

### Current WebDev project

The existing managed WebDev project is:

- **Project name:** `klipflow`
- **WebDev project ID:** `g6pMN7FApnJhzqQERtdnRz`
- **Current internal WebDev checkpoint:** `d6e472f7`
- **Existing public URL referenced by the repository:** https://klipflow-g6pmn7fa.manus.space
- **Current preview behavior:** An unauthenticated request shows the real project-loading state because the preview has no session cookie. That state is not seeded demo content and should not be mistaken for a database failure.

GitHub access does **not** automatically grant access to the WebDev database, storage, secrets, built-in OAuth, deployment history, or the `manus.space` domain. If the engineer must continue using the existing WebDev project, the project owner must provide access through the Manus project workflow or arrange an ownership migration with Manus. If the goal is to remove Manus from the runtime, use the migration plan below instead of trying to copy internal WebDev metadata.

### Relevant enabled session connectors

The current Manus session has access to GitHub, WebDev/Manus tools, Instagram, Vercel, Netlify, Whop, and n8n connectors, among others. These are session-level capabilities, not a portable credential package for an external engineer. A handover must provide the engineer with account-level access to the relevant GitHub organization, hosting provider, database, object storage, OAuth developer consoles, and notification providers.

## Repository map

The following files are the primary starting points for continued development:

| Path | Responsibility |
|---|---|
| `client/src/App.tsx` | Route map, shell, onboarding, theme, and global providers |
| `client/src/pages/NewProject.tsx` | Source video/requirements upload and project creation UI |
| `client/src/pages/ProjectDetail.tsx` | Generation status, progress, retry, cancel, and source details |
| `client/src/pages/Clips.tsx` | Clip review, download, manual post links, provider posting, view sync, and Whop status |
| `client/src/pages/Accounts.tsx` | Connected accounts, OAuth entry points, manual fallback, and health state |
| `client/src/pages/Dashboard.tsx` | Real dashboard summaries and recent project activity |
| `client/src/pages/Earnings.tsx` | Views, estimated payout, rates, and submission history |
| `client/src/pages/Settings.tsx` | Payout rates and Telegram notification settings |
| `server/routers.ts` | The complete tRPC API contract and procedure authorization |
| `server/integrations/nativeWorkflow.ts` | Active MySQL/TiDB workflows for projects, clips, submissions, earnings, notifications, reminders, and scheduled processing |
| `server/integrations/ffmpegWorker.ts` | Current five-clip FFmpeg implementation |
| `server/integrations/workflowUpload.ts` | Authenticated multipart upload route and storage writes |
| `server/integrations/socialOAuth.ts` | TikTok, YouTube, and Instagram OAuth start/callback routes |
| `server/integrations/socialProviders.ts` | Provider posting, token refresh, provider health, and YouTube/Instagram view synchronization |
| `server/integrations/telegramReminders.ts` | Cron-only Telegram reminder callback |
| `server/integrations/viewSync.ts` | Cron-only provider view synchronization callback |
| `server/integrations/accountHealth.ts` | Cron-only connected-account health callback |
| `server/storage.ts` | Manus Forge presigned storage adapter; replace for a non-Manus deployment |
| `server/_core/oauth.ts` and `server/_core/sdk.ts` | Manus authentication and session integration |
| `drizzle/schema.ts` | TypeScript database model definitions |
| `drizzle/*.sql` | Existing SQL migration history |
| `.github/workflows/ci.yml` | Required GitHub validation workflow |
| `README.md` | Product intent, current limitations, and repository maintenance rules |

## Runtime configuration and secret transfer

The application reads the following configuration categories. The names below are safe to share with an engineer; the values are not included in this document.

### Core runtime and authentication

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `PUBLIC_APP_URL`, with `APP_PUBLIC_URL` and `VITE_APP_URL` accepted as fallbacks
- `JWT_SECRET`
- `OAUTH_SERVER_URL`
- `VITE_APP_ID`
- `OWNER_OPEN_ID`

### Manus WebDev storage and built-in services

- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`
- `VITE_FRONTEND_FORGE_API_URL`
- `VITE_FRONTEND_FORGE_API_KEY`
- `VITE_ANALYTICS_ENDPOINT`
- `VITE_ANALYTICS_WEBSITE_ID`
- `VITE_APP_TITLE`
- `VITE_APP_LOGO`

These variables are sufficient only for the current Manus-hosted shape. They are not a replacement for infrastructure that an external engineer owns.

### Media processing

- `FFMPEG_PATH`
- `FFPROBE_PATH`
- `FFMPEG_PRESET`
- `FFMPEG_CRF`

The worker falls back to the bundled `ffmpeg-static` and `ffprobe-static` packages. A production host must still verify executable permissions, temporary disk space, memory, process limits, timeout behavior, and concurrent-job capacity.

### Social providers

- TikTok: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_ID` as a fallback alias, and `TIKTOK_CLIENT_SECRET`.
- YouTube: `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`.
- Instagram/Meta: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `META_APP_ID`, `META_APP_SECRET`, and `META_GRAPH_VERSION`.
- Telegram: `TELEGRAM_BOT_TOKEN`.

### Retained legacy or optional adapters

- `SUPABASE_URL` and `SUPABASE_KEY` are used only by the retained `server/integrations/supabaseWorkflow.ts` adapter. The active router imports `nativeWorkflow.ts`, so Supabase is not the active data path today.
- `GOOGLE_DRIVE_TOKEN` is retained for the Google Drive inspection adapter. It must be validated before being described as an active production ingestion path.

### Required secret-handling procedure

The current WebDev project stores secrets in its managed environment. The file `.project-config.json` also contains internal project metadata and secret references; it must not be committed, pasted into a ticket, or handed to an engineer as a raw file.

For a migration away from Manus, provision a new secret store first. Copy only the required values into that store, rotate any credential that has been exposed to an untrusted person, and then configure the application by environment-variable name. After the cutover, revoke old OAuth client secrets, bot tokens, database credentials, and internal Forge keys that are no longer required.

## Migration plan for full ownership

The migration should be treated as four separate assets. GitHub only covers the source code.

### 1. Source code

Use the public GitHub repository and protected `master` branch. Create a feature branch for each change, run the required checks, open a pull request, and merge only after CI passes. Keep the handover document in the repository so future engineers have the same baseline.

### 2. Database

The active application path uses a MySQL-compatible database through `DATABASE_URL`. The current WebDev project has a managed TiDB-compatible connection. No database export was performed during this audit.

Before moving hosting:

1. Provision a new MySQL-compatible database owned by the project owner or engineering organization.
2. Export the current schema and data, including users, projects, generation jobs, clips, connected accounts, submissions, notifications, reminder deliveries, and clipper settings.
3. Apply the existing Drizzle/SQL migrations to the new database.
4. Compare row counts and foreign-key relationships before cutover.
5. Run an authenticated smoke test that creates a project, generates a test clip, posts a manual URL, records a submission, and reads earnings.
6. Keep the old database read-only until the new deployment has passed acceptance testing and the rollback window has expired.

Do not delete the old database as part of the first deployment. The existing README explicitly says to preserve the current data and legacy contracts until an explicit migration plan exists.

### 3. Media storage

The current media path uses Manus Forge presigned URLs and stores source videos and generated clips behind `/manus-storage/` paths. GitHub contains no uploaded videos or generated clips.

For a non-Manus deployment, provision S3, Cloudflare R2, or equivalent object storage. Migrate source and generated media, preserve the database URLs or rewrite them through a migration script, replace `server/storage.ts`, and provide a public HTTPS media URL. Public media URLs are required for provider pull-based publishing. Test both authenticated downloads and provider fetches from outside the application network.

### 4. Authentication and ownership

The current app uses Manus OAuth/session services. An engineer moving the app to an independent host must either keep the Manus auth integration under an authorized account or replace it with an owned provider such as Auth.js, Clerk, Supabase Auth, or another explicitly selected system. A replacement must preserve the user identifier used in `projects.user_id`, `connected_accounts.user_id`, and related tables, or include a user-ID migration.

The engineer must also decide whether the existing `users` records are retained, mapped to the new identity provider, or re-created. Do not silently change this mapping because it can detach all existing projects and connected accounts from their owners.

## OAuth and provider production checklist

The callback origin must use the final HTTPS domain. Register the exact routes below in each provider console:

- `https://<production-domain>/api/oauth/tiktok/callback`
- `https://<production-domain>/api/oauth/youtube/callback`
- `https://<production-domain>/api/oauth/instagram/callback`

Also configure `PUBLIC_APP_URL` to the same canonical origin so generated media and reminder links are externally reachable.

### TikTok

The code requests `user.info.basic`, `video.publish`, and `video.upload`, stores access and refresh tokens, uses `PULL_FROM_URL`, and polls the publish status endpoint. TikTok’s current documentation requires a registered app, Content Posting API configuration, approval and authorization for `video.publish`, and a verified domain or URL prefix when media is pulled from a URL. Unaudited clients can be restricted to private viewing until the required audit is completed [3].

The engineer must verify the Login Kit/Content Posting API app, redirect URI, scope approval, domain verification, public clip URL, publish status behavior, token refresh, and user-facing error handling. Add an integration test that uses a provider-approved test account without committing credentials.

### YouTube Shorts

The code requests YouTube OAuth scopes, stores refresh tokens, refreshes access tokens, uploads through a resumable `videos.insert` flow, and reads statistics. Google’s official upload guide requires a registered OAuth application and an enabled YouTube Data API project [4].

The engineer must configure the Google Cloud OAuth consent screen, authorized redirect URI, test users or production publishing status, API enablement, quota monitoring, video metadata policy, privacy defaults, refresh-token persistence, and a live upload/readback test. The current code uses `privacyStatus: public`; this should be made an explicit product setting before general release.

### Instagram Reels

The code uses Facebook Login to discover an Instagram professional account connected to a Facebook Page, creates a Reel media container, polls its processing state, publishes it, and attempts to retrieve a permalink. Meta’s current documentation requires an Instagram professional account and a publicly accessible media URL; the publishing flow depends on the appropriate login mode, access token, permissions, and account/Page authorization [5].

The engineer must complete the Meta app setup, connected Page and professional account, permission review/advanced access as required, redirect URI, token handling, public media test, container processing timeout/retry policy, and view-insights permission validation. Keep the manual Reel upload fallback until the live API path is confirmed.

## What remains to reach the intended product specification

### P0 — Required before calling the app production-ready

**Establish a production owner and infrastructure boundary.** Decide whether the application remains on Manus WebDev or moves to an engineer-owned host. If it moves, provision the database, object storage, authentication, secret manager, DNS, TLS, logging, and backups before changing application code.

**Validate the complete authenticated media path.** Test upload of a representative long video, source download, FFprobe duration detection, five FFmpeg renders, object-storage upload, database writes, progress updates, cancellation, retry, and clip playback from an external browser. Include a failure test for a missing source, an oversized source, a malformed video, insufficient disk space, and an interrupted upload.

**Configure and validate provider credentials.** Complete TikTok, YouTube, and Meta setup, register the final callback URLs, verify token refresh, and perform one real post per provider from a non-production test account. Record provider IDs and post URLs in the database and confirm that the UI reflects the result.

**Remove production ambiguity.** Disable or remove the `autoPost` simulated procedure, make any manual fallback explicit in the UI, and prevent synthetic post URLs from being counted as published provider submissions.

**Add recurring automation.** The code exposes cron-only endpoints, but the current task-level schedule inventory is empty. Configure a managed scheduler or worker for:

- `POST /api/scheduled/telegram-reminders`
- `POST /api/scheduled/provider-view-sync`
- `POST /api/scheduled/account-health`

Each callback must authenticate as a cron identity, run with idempotency, emit structured logs, and alert on repeated failure. The heartbeat helper in `server/integrations/heartbeat.ts` can be used if the project stays within the Manus scheduling model.

### P1 — Required for the full AI Viral Clip Factory promise

**Replace the current deterministic clip selection.** The worker currently sets `CLIP_COUNT = 5`, derives evenly distributed windows, and renders generic clips. Implement a staged pipeline that stores intermediate results:

1. Extract audio and transcribe it with timestamps.
2. Detect sentence boundaries, speaker turns, pauses, and topic segments.
3. Score hooks, surprising claims, emotional peaks, questions, and self-contained moments.
4. Select and de-duplicate the best five to thirty candidates according to a configurable campaign goal.
5. Render 9:16 output with an explicit crop strategy.
6. Track faces or important subjects for smart framing.
7. Generate captions and styling from a user-selected template.
8. Persist the transcript, candidate windows, scores, render settings, and model/version metadata for reproducibility.

This work needs a real background-job design rather than a single long-running HTTP mutation. Use a queue, durable job records, retry limits, cancellation semantics, concurrency limits, and cleanup for temporary files.

**Add AI-generated copy and caption styling.** The current worker returns an empty caption and generic title. Add an explicit model/provider decision, prompt and output schemas, content-safety handling, token/cost limits, fallback behavior, and a way for a user to edit the title, caption, hashtags, and caption style before publishing.

**Add actual source ingestion.** A source link is currently treated as a downloadable HTTP URL. If YouTube links are intended, add a supported resolver/downloader path with platform terms compliance, domain restrictions, clear user consent, and tests. Do not silently assume that any web page URL is a video file.

### P1 — Platform, scheduling, and analytics completion

**Add real scheduling.** The current product supports manual generation and posting. Add a durable publish queue with scheduled timestamps, per-platform jobs, provider rate limits, retry/backoff, timezone handling, duplicate prevention, and a clear user approval state.

**Complete analytics coverage.** YouTube and Instagram view sync handlers exist. TikTok view sync is not present in the current provider module. Define the supported metrics, fetch cadence, retention policy, provider error state, and dashboard aggregation before calling analytics complete.

**Decide the Whop integration boundary.** The current implementation stores `not_submitted`, `submitted`, and `approved` statuses and reminders, but does not call a Whop submission API. Either implement and test the official Whop API path or clearly name this feature “manual Whop submission tracking.” Do not describe it as automatic submission until an API call is implemented and verified.

### P2 — Operational hardening

Add structured logs and error tracking for uploads, generation jobs, OAuth callbacks, provider calls, storage failures, and scheduler callbacks. Add rate limits and abuse controls to uploads and provider posting. Add retention and deletion policies for source videos, generated clips, OAuth tokens, and logs. Add database and object-storage backups with a restore drill. Review privacy, terms, provider disclosures, consent, and AI-content disclosure requirements. Add browser-level acceptance tests for sign-in, upload, generation, review, account connection, publish, and earnings flows.

## Recommended engineer execution order

1. **Freeze the baseline.** Clone GitHub `master`, confirm the WebDev checkpoint and source tree are equivalent, and record the exact deployment commit.
2. **Create a production inventory.** Identify the current database, object storage, auth provider, domain, provider apps, bot, and Whop campaign contracts. Confirm ownership of each one.
3. **Choose migration mode.** Retain Manus temporarily or migrate to owned infrastructure. Do not mix a new database with old media URLs without a mapping plan.
4. **Provision staging.** Use a separate database, storage bucket, OAuth app/test users, and public staging domain. Configure all secrets through the staging secret manager.
5. **Run the core smoke test.** Sign in, upload a real test video, generate clips, open clips from an external browser, edit metadata, and record a manual submission.
6. **Validate providers.** Complete OAuth and one real post/readback cycle per platform. Keep manual Instagram fallback enabled until Meta publishing is stable.
7. **Implement the AI pipeline.** Add transcription, selection, captions, framing, and durable jobs behind feature flags. Preserve the existing UI structure while adding review controls.
8. **Add automation and observability.** Configure the three scheduled callbacks, logs, alerts, backups, and restore checks.
9. **Run acceptance and cutover.** Test real user data in staging, migrate database and media, switch DNS and secrets, monitor the first production jobs, and keep rollback access until stable.

## Definition of done for the intended product

The project is ready to be called fully production-ready only when a real authenticated user can upload a long video or supported source link, receive multiple AI-selected clips with timestamps and a stored transcript, see accurate progress and recoverable failures, edit captions and framing, preview and download each clip, publish or schedule approved clips to TikTok, YouTube Shorts, and Instagram Reels, retrieve supported platform metrics, receive Telegram alerts, track manual or API-backed Whop submissions, and view earnings based on verified submission data.

The deployment must be owned by the project owner or engineering organization, with no critical dependency on a personal Manus session, a temporary WebDev artifact remote, an unknown database owner, or unrotated credentials. A documented backup and restore procedure, provider callback inventory, monitoring, and a successful rollback drill are part of completion.

## Handover checklist

The project owner should provide the engineer with the following through secure channels:

- GitHub collaborator or organization access to `godsonomichael/KlipFlow`.
- Access to the Manus WebDev project only if the existing project, domain, database, storage, or checkpoint history will be retained.
- Access to the database owner or a verified database export.
- Access to the media-storage owner or a verified object-storage export.
- Secret-manager access for the environment variable names listed above, without sending secrets in GitHub.
- TikTok developer account and app access, including Content Posting API status.
- Google Cloud project and OAuth client access.
- Meta developer app, Facebook Page, and Instagram professional account access.
- Telegram bot and chat configuration if reminders will be enabled.
- Whop campaign/API ownership and submission requirements.
- DNS and TLS access for the chosen production domain.
- An approved staging account and test media file.

The owner should revoke access when the engagement ends and rotate any credentials that were shared during the handover.

## References

[1]: https://github.com/godsonomichael/KlipFlow "KlipFlow GitHub repository"
[2]: https://manus.im/docs/features/collab "Manus collaboration documentation"
[3]: https://developers.tiktok.com/doc/content-posting-api-get-started "TikTok Content Posting API — Get Started"
[4]: https://developers.google.com/youtube/v3/guides/uploading_a_video "YouTube Data API — Upload a Video"
[5]: https://developers.facebook.com/documentation/instagram-platform/content-publishing "Meta Instagram Platform — Content Publishing"
[6]: https://help.manus.im "Manus support portal"
