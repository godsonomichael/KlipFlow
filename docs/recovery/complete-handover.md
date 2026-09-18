# KlipFlow — Complete Project Handover Prompt

You are taking over an active Manus WebDev project named **KlipFlow**. Continue the work directly and do not restart the project, create a new Supabase project, or replace the existing WebDev project.

## 1. Product identity and direction

**Product name:** KlipFlow

**App title:** KlipFlow - Content Rewards Automation

**Product description:** KlipFlow is a personal clipping tool for individual clippers. It helps a user add a video, generate short clips, edit captions, auto-post to connected social accounts, track views, and submit posted links to Whop Content Rewards before the deadline.

This is **not a marketplace** and is **not an admin campaign-management platform**.

Do not reintroduce:

- Campaign marketplace discovery
- Bounties
- Admin review screens
- Campaign-owner tools
- Pay-per-1,000-view controls for other users
- Approve/reject workflows for other clippers
- Technical dashboard language such as Workspace, Flows, Drops, or Production Automation

The user is clipping content for their own projects and submitting their own posts to Whop or another content-rewards platform.

## 2. Existing project

**WebDev project:** `klipflow`

**Project path:** `/home/ubuntu/klipflow`

**Latest verified checkpoint:** `ac636c79`

**Latest website link:** use the latest WebDev checkpoint link from the current Manus session.

The project is a React 19 + Vite + Express + tRPC TypeScript WebDev application. It uses Manus OAuth for application authentication and Supabase for personal workflow data.

Important: preserve the existing project and domain. Do not initialize another project.

## 3. Current frontend experience

The app is mobile-first with a simple white creator interface and orange KlipFlow branding.

Main routes:

- `/` — My Clipping Projects
- `/new-project` — Add a video to clip
- `/project/:id` — Generate, edit, download, and auto-post project clips
- `/clips` — My Clips
- `/earnings` — Personal earnings estimator
- `/accounts` — Connected Accounts
- `/settings` — Personal Whop rates and Telegram preferences

Bottom navigation has three main tabs:

- Home
- My Clips
- Earnings

The app uses the supplied orange KF logo. Do not generate a replacement logo.

Current visual direction:

- White background
- Orange accent `#FF4D00`
- Dark logo panel using `#0A0A0A`
- Simple rounded creator UI
- Large buttons and clear plain-English labels
- Mobile-first responsive layout

## 4. Completed functionality

### Personal projects

The home page shows **My Clipping Projects**. Each project is owned by the authenticated user and stores:

- Source link
- Uploaded source video URL
- Optional Whop/content-rewards requirements link
- Optional requirements file URL
- Project status
- Generated clip count

### New Project flow

`/new-project` now has three sections:

1. Add your video
   - Paste YouTube, Drive, Dropbox, or another source link
   - Upload a supported video file
   - Upload route: `/api/workflow/upload`
2. Add requirements, optional
   - Paste Whop/content-rewards guidelines or campaign link
   - Upload PDF, DOCX, or text requirements file
3. Generate viral clips
   - Creates the Supabase project row
   - Uploads files where applicable
   - Navigates to `/project/:id`

### Project detail and clip generation

`/project/:id`:

- Shows source video preview
- Shows original source link
- Shows requirements/campaign link
- Waits approximately three seconds with “AI is finding viral moments…”
- Creates five simulated source-backed clips for now
- Shows 30–60 second duration labels
- Supports preview and download
- Supports auto-post platform selection

The generated clips currently reuse the source video URL as a safe simulation. Replace this with real video clipping/AI generation in a future phase, but do not break the current flow.

### Editable clip text

Each project clip now supports:

- Editable title
- Editable caption and hashtags
- Save text action
- Supabase persistence in `generated_clips.title` and `generated_clips.caption`
- Text is saved before auto-posting

The protected tRPC procedure is:

- `klipflow.clips.updateMetadata`

### Connected accounts

Connected account platforms:

- TikTok
- Instagram
- YouTube
- X
- Telegram

Current account connection is a placeholder flow that stores a username/handle or Telegram chat ID in Supabase. Real OAuth must replace this safely after credentials and platform app configuration are available.

The onboarding popup:

- Uses the supplied orange KF logo
- Explains that accounts can be connected for auto-posting and Telegram alerts
- Includes all five account options
- Includes **Skip for now**
- Stores local skip state so the user can enter the app
- Allows accounts to be connected later in Connected Accounts

Do not force users to connect an account before using the app.

### My Clips

`/clips` shows the user’s generated clips with:

- Preview
- Title
- Original project
- Posted platform
- Clickable tracked post URL
- View count
- Whop status: Not submitted, Submitted, Approved
- Download
- Auto-post
- Copy post link
- Open campaign
- Mark submitted

After a post is created, the app displays:

- Success animation
- Success toast
- Quick link to View My Clips
- 30-minute Whop submission reminder context

`submissions.posted_at` has been added for deadline tracking.

### Whop submission deadline UX

When a clip has a posted URL and is not submitted or approved, My Clips displays a live countdown from the post time:

- “Submit this post to Whop within MM:SS”
- Link to the project’s saved requirements/campaign URL
- Open campaign button
- Mark submitted action

The app currently displays the countdown in the client. Background Telegram reminders still need to be implemented.

### Earnings

Earnings are personal estimates only. The app does not pay users and does not control campaign rates.

Users may set their own expected Whop rate per platform in Settings. Earnings are estimated from:

- Actual stored views
- User-owned platform rate
- Completed thousands of views

Do not describe these as guaranteed payouts.

## 5. Existing backend and database

Supabase project to reuse:

- URL: `https://olybogkdlygghegvsmkc.supabase.co`
- Existing Supabase credentials are already configured in the project environment.
- Never create a replacement Supabase project.
- Never delete legacy tables or data.

Existing workflow tables include or should include:

- `projects`
- `generated_clips`
- `connected_accounts`
- `submissions`
- `clipper_settings`

Important fields include:

### `projects`

- `id`
- `user_id`
- `title`
- `source_link`
- `file_url`
- `requirements_link`
- `requirements_file`
- `status`
- `created_at`

### `generated_clips`

- `id`
- `project_id`
- `title`
- `caption`
- `clip_url`
- `status`
- `created_at`

### `connected_accounts`

- `id`
- `user_id`
- `platform`
- `handle`
- `access_token` or token fields if added
- created/updated timestamps as applicable

### `submissions`

- `id`
- `user_id`
- `clip_id`
- `post_url`
- `platform`
- `views`
- `status`
- `earnings`
- `rate_per_thousand`
- `whop_submission_status`
- `whop_submitted_at`
- `posted_at`
- `created_at`

Use additive migrations only. Keep existing data.

## 6. Existing integrations and infrastructure

Previously recovered infrastructure:

- n8n connector/workflows exist and must not be broken
- Legacy webhook path `/webhook/campaign-intake` must remain preserved
- Legacy webhook path `/webhook/clipflow-telegram-alert` must remain preserved
- Whop app ID: `app_S4RGogwKdyb2hT`
- Old failed Whop app ID: `app_x4tj5wrcdQiaVr` — never use it
- Whop company: Clipper OS
- Whop checkout URL was previously a placeholder and must not be treated as verified production billing

Do not expose secrets in logs, UI, tests, or responses.

## 7. Credentials currently missing for real integrations

The project currently has Supabase credentials, but the runtime audit showed these are not yet present:

- `TELEGRAM_BOT_TOKEN`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

The user intends to add these securely through WebDev project secrets. Do not ask the user to paste secrets into chat.

Required external setup:

### Telegram

- Create a bot with BotFather
- Add `TELEGRAM_BOT_TOKEN`
- Each user must start the bot so KlipFlow can associate their chat ID
- Store only the user’s own Telegram chat ID

### TikTok

- Create a TikTok developer app
- Enable Content Posting API
- Request/enable required analytics scopes
- Configure OAuth callback:
  `/api/auth/tiktok/callback`

### Instagram

- Create a Meta developer app
- Enable Instagram publishing and insights permissions
- Configure OAuth callback:
  `/api/auth/instagram/callback`

### YouTube

- Create a Google OAuth client
- Enable YouTube Data API v3
- Enable YouTube Analytics API
- Configure OAuth callback:
  `/api/auth/youtube/callback`

Use the final deployed KlipFlow domain in callback URLs. Do not hard-code a temporary preview domain as the permanent callback.

## 8. Immediate next implementation phase

Implement the following only after the required secrets are available.

### A. Real OAuth connection flows

Add secure server routes:

- `/api/auth/tiktok/start`
- `/api/auth/tiktok/callback`
- `/api/auth/instagram/start`
- `/api/auth/instagram/callback`
- `/api/auth/youtube/start`
- `/api/auth/youtube/callback`

Requirements:

- Use server-side OAuth state validation
- Encrypt or securely store refresh/access tokens
- Never send client secrets to the browser
- Associate tokens with the authenticated user and platform
- Support disconnect and token refresh
- Display connection health and reauthorization errors

### B. Real posting

Replace simulated URLs in `simulatePost` with provider-specific posting services:

- TikTok Content Posting API for TikTok
- Instagram Graph API Reels publishing for Instagram
- YouTube Data API resumable upload for YouTube Shorts
- X posting API only if X credentials and permissions are explicitly configured

Keep a provider abstraction so the UI calls one tRPC mutation while each platform uses its own adapter.

Persist:

- Provider post ID
- Real post URL
- Platform
- Posted timestamp
- Caption/title used
- Provider error state

Do not claim a post succeeded until the provider confirms publication.

### C. Automatic view syncing

Implement a server-side sync job that:

- Finds active submissions with real provider post IDs
- Fetches current view counts from each provider
- Updates `submissions.views`
- Updates last sync time and provider errors
- Avoids duplicate API calls and respects rate limits
- Sends milestone notifications only once per milestone

Suggested initial sync cadence: every five minutes while a post is in its first hour, then hourly for active posts. Do not use an in-process `setInterval` timer in production.

### D. Telegram reminders

Implement reminders at:

- 10 minutes after `posted_at`
- 25 minutes after `posted_at`

Each reminder should contain:

- Clip title
- Platform
- Real posted URL
- Current views if available
- Remaining time before the 30-minute deadline
- Actual saved campaign/requirements link
- Direct KlipFlow My Clips link

Requirements:

- Idempotent reminder records so retries do not duplicate messages
- Only send to the owner’s connected Telegram chat ID
- Do not send campaign marketplace alerts
- Do not send messages if the clip is already submitted or approved
- Send a final late warning only if appropriate and not duplicated

### E. In-app notifications

Add a notifications table and notification center for:

- Clip ready
- Successfully posted
- OAuth connection expired
- 10-minute submission reminder
- 25-minute submission reminder
- View milestones
- View-sync errors
- Submission status changes

Include unread/read state and a notification bell. Notifications must be scoped to the authenticated user.

## 9. Correct scheduling architecture

Do not use `setInterval`, `node-cron`, or browser-only timers for production reminders or syncing.

Use deployed scheduled HTTP handlers under:

- `/api/scheduled/...`

Handlers must:

- Authenticate scheduled requests
- Be idempotent
- Look up durable job ownership by task UID where required
- Return JSON errors
- Be safe under retries
- Run against the production deployment, not localhost

Before creating production schedules:

1. Implement and test handlers.
2. Save a WebDev checkpoint.
3. Deploy the project.
4. Create the scheduled jobs against the deployed URL.

For high-frequency syncing, prefer the platform’s deployed periodic/heartbeat mechanism rather than a Manus AI session per check.

## 10. Testing requirements

Before delivery, run:

```bash
cd /home/ubuntu/klipflow
pnpm check
pnpm test
pnpm build
```

Add tests for:

- OAuth state validation
- User ownership of tokens and submissions
- Token refresh failure handling
- Provider adapter response normalization
- No duplicate reminders
- 10-minute reminder timing
- 25-minute reminder timing
- No reminder after submission
- View milestone deduplication
- In-app notification read/unread behavior
- No secrets in response payloads

Do not mark real integrations complete if credentials or provider approval are missing. Use explicit “needs configuration” states rather than fake production success.

## 11. Safety and product rules

- Preserve all existing Supabase data.
- Preserve `/api/sync` if present for n8n compatibility.
- Reuse the current WebDev project and deployment.
- Do not create a new Whop app or regenerate existing Whop credentials.
- Never expose secrets.
- Never use fake post URLs once real OAuth is enabled.
- Keep simulated posting only as a clearly labeled fallback when a provider is not configured.
- Keep the app simple for non-technical TikTok/Instagram clippers.
- Keep Whop campaign links user-supplied and user-owned.
- KlipFlow estimates earnings; it does not guarantee or pay rewards.
- Do not reintroduce marketplace/admin features unless the user explicitly requests a separate feature.

## 12. First actions for the next agent

1. Check whether the required secrets have been added.
2. If any are missing, do not fake implementation; report exactly which provider is blocked.
3. Inspect the current provider APIs and scopes from official documentation.
4. Add additive Supabase migrations for provider IDs, token metadata, sync timestamps, reminder records, and in-app notifications.
5. Implement one provider end-to-end first, preferably Instagram or YouTube depending on available approval, then add the others through the adapter pattern.
6. Implement Telegram reminders and in-app notifications.
7. Run the full test/build suite.
8. Save a checkpoint and provide the updated live website link.

Continue from the existing project state. Do not ask the user to explain the project again.
