# KlipFlow — Updated Handover Prompt

You are taking over the KlipFlow project from a previous Manus account. Continue from the existing project and checkpoint. Do not restart, create replacement infrastructure, or ask for credentials that are already configured securely.

## Product

KlipFlow is a simple creator platform for Whop. Non-technical TikTok and Instagram clippers choose campaigns, create short clips, submit links and view evidence, and earn money from approved views.

Canonical brand: **KlipFlow**. Never use Clipper OS or ClipFlow in user-facing copy.

Whop App Store title: **KlipFlow - Content Rewards Automation**.

## Current project

Project path: `/home/ubuntu/klipflow`

Architecture: React, Vite, TypeScript, Express, tRPC, Manus OAuth, Supabase, managed WebDev storage.

Current checkpoint: `89021daa`

Open it with:

[Open website](manus-webdev://89021daa)

Preview URL:

`https://3000-i5kj9fr90a5j6sobgt111-cfe16c2b.us1.manus.computer`

## Existing infrastructure

Reuse the existing Whop company and application:

- Company: Clipper OS
- Whop app: `app_S4RGogwKdyb2hT`
- Old failed app — never use: `app_x4tj5wrcDqiaVr`
- Supabase project: `olybogkdlygghegvsmkc`
- Supabase URL: `https://olybogkdlygghegvsmkc.supabase.co`

Do not create a new Supabase project or Whop app. Preserve existing data, n8n workflows, `/api/sync`, and legacy webhook paths.

## Current UI

The user experience is mobile-first, white, rounded, and creator-friendly. Main bottom tabs are:

- Home
- My Clips
- Earnings

Technical terms such as Bounties, Flows, Drops, Workspace, Production Automation, Queue Approved, and Access Status must stay out of the clipper UI.

Current user-facing workflows:

1. First-run onboarding asks the user to connect TikTok, Instagram, YouTube, or X, or skip with a warning that manual posting and link pasting will be required.
2. Connected Accounts is available in the menu.
3. New Project accepts a source link, optional requirements link, and file selection.
4. The user chooses Auto-create 5 viral clips or Let me cut manually.
5. Generated clips appear in My Clips.
6. Each clip supports download, real provider posting when configured, or manual post-link submission. Do not create synthetic post URLs or simulated success states.
7. Admin review is available at `/admin`.

## Supabase tables already created

The preserved Supabase project now contains additive workflow tables:

- `projects`
- `generated_clips`
- `connected_accounts`
- `submissions`

Current intended columns:

`projects`: `id`, `user_id`, `title`, `source_link`, `file_url`, `requirements_link`, `status`, timestamps.

`generated_clips`: `id`, `project_id`, `clip_url`, `title`, `status`, `created_at`.

`connected_accounts`: `id`, `user_id`, `platform`, `handle`, `access_token`, `status`, timestamps.

`submissions`: `id`, `user_id`, `clip_id`, `post_url`, `views`, `status`, `earnings`, timestamps.

Do not store tokens in browser storage. The current onboarding stores placeholder handles server-side until real OAuth is configured. Keep `access_token` server-only and never select it into client responses.

## Immediate requested work

### A. Real file upload

Enhance `/new-project` so file uploads are real, not only selected filenames.

Use the existing managed storage helper in:

`server/storage.ts`

It supports `storagePut()` and managed `/manus-storage/...` URLs.

Required behavior:

- Accept video files such as MP4, MOV, and WEBM.
- Accept optional requirements files such as PDF and DOCX.
- Validate file type and reasonable size before upload.
- Upload through a server-side authenticated route or a safe upload procedure.
- Do not put large media in `client/public`.
- Store the resulting managed-storage URL in `projects.file_url`.
- Show a visible progress bar from 0% to 100%.
- Show upload states such as `Preparing`, `Uploading`, `Uploaded`, `Processing`, `Ready`, and `Failed`.
- Disable duplicate submissions while uploading.
- Allow retry after failure.
- Preserve the source-link flow.

Important runtime constraint: do not run `yt-dlp` or other custom system CLIs inside WebDev. For YouTube, initially store the source URL and show a clear processing state. Add server-side media processing only through a supported service or a separate persistent environment after confirming the architecture.

### B. Processing state animation

After upload or project creation, show a simple creator-friendly processing card:

- “Getting your video ready”
- Animated progress indicator
- “Finding the best moments”
- “Adding captions”
- “Your clips are almost ready”

The UI may show measured progress stages, but the project status must be stored in the database and the UI must clearly distinguish queued, running, completed, failed, and cancelled processing. Do not present simulated processing as completed real media.

Use short, friendly wording. Do not show API, queue, worker, or infrastructure terminology.

### C. Real My Clips data

Update My Clips to read from Supabase using the authenticated user ID.

Show actual:

- Original project/source
- Generated clip URL or processing status
- Post URL
- Platform posted to
- View count from `submissions.views`
- Submission status
- Calculated earnings from `submissions.earnings`
- Created/submitted date

Never show fabricated clips, views, statuses, or earnings.

If there are no rows, show a truthful empty state.

### D. Real Earnings data

Update Earnings to aggregate real Supabase submission data for the authenticated user.

Calculate:

- Total earned: sum of approved submission earnings
- Pending earnings: sum for pending submissions if applicable
- Approved clips: count of approved submissions
- Total views: sum of submission views
- Payout history: real approved submission rows grouped or listed by date

Do not hard-code `$0.00` as a fake result. Showing `$0.00` is acceptable only when the real query returns no earnings.

Use server-side aggregation or bounded reads. Protect every query with `user_id = ctx.user.openId`.

### E. Payout calculation

Use the campaign or admin-configured rate per 1,000 views when available. Otherwise leave earnings pending rather than inventing a rate.

Recommended calculation:

`earnings = floor(views / 1000) * rate_per_thousand`

Only calculate or expose earnings when the submission is approved or the business rules explicitly allow pending estimates.

Store the final calculated amount in `submissions.earnings` and preserve the rate used for auditability. If needed, add `rate_per_thousand` to `submissions` additively.

## Existing server files

Workflow router:

`server/routers.ts`

Supabase workflow helper:

`server/integrations/supabaseWorkflow.ts`

Managed storage:

`server/storage.ts`

Client routes:

`client/src/App.tsx`

New project page:

`client/src/pages/NewProject.tsx`

My Clips page:

`client/src/pages/Clips.tsx`

Earnings page:

`client/src/pages/Earnings.tsx`

Onboarding:

`client/src/components/Onboarding.tsx`

Connected Accounts:

`client/src/pages/Accounts.tsx`

## Security requirements

- Never expose `SUPABASE_KEY`, Whop API keys, OAuth secrets, or access tokens to the browser.
- Never store OAuth tokens in `localStorage`.
- Never accept a client-supplied `userId` for ownership checks.
- Never allow one user to read another user’s projects, clips, accounts, submissions, or earnings.
- Never trust a client-provided earnings amount.
- Validate ownership before generating, submitting, posting, deleting, or downloading a clip.
- Do not claim that placeholder OAuth accounts are actually connected.

## Whop access

The existing Whop membership gate remains required. Use the current Whop app:

`app_S4RGogwKdyb2hT`

Users without valid membership must be redirected to `WHOP_CHECKOUT_URL`.

Do not treat Manus OAuth alone as proof of Whop membership.

## Data and integration rules

- Use the preserved Supabase project.
- Preserve `clipper_os_campaigns` if it exists.
- Preserve `/api/sync` and n8n webhook contracts.
- Use additive migrations only.
- Do not invent campaign rows.
- Do not invent creator images, post URLs, view counts, payout totals, or account status.
- Simulated clip generation and simulated auto-posting must be visibly marked as simulated until real integrations exist.

## Testing requirements

Run:

```bash
pnpm check
pnpm test
pnpm build
```

Add or update tests for:

- File type and size validation.
- Upload failure and retry state.
- Project file URL persistence.
- Processing status transitions.
- Per-user project and clip ownership.
- Per-user My Clips query.
- View aggregation.
- Approved earnings aggregation.
- Payout calculation.
- Pending versus approved earnings.
- Submission creation.
- Auto-post simulation.
- No client-side secrets.

Before delivery:

- Verify all intended files exist.
- Verify the preview on mobile width.
- Verify the progress bar and processing state visually.
- Verify My Clips and Earnings show real empty states when Supabase has no rows.
- Save a new checkpoint.

## Known limitations to report honestly

- OAuth buttons currently store placeholder handles until real platform OAuth credentials are configured.
- Auto-clipping is currently a five-clip workflow simulation unless real media processing is added.
- Auto-posting currently generates a simulated post URL and writes a submission record; it does not publish to live social platforms.
- Source-link processing should not claim that a YouTube video was downloaded unless a supported server-side processor is actually configured.

## Final delivery report

Include:

- New checkpoint link.
- Live preview URL.
- Tables added or modified.
- Upload behavior and supported file types.
- Whether managed storage upload was validated.
- Processing states implemented.
- My Clips query result behavior.
- Earnings aggregation behavior.
- Payout calculation rule.
- Tests and build result.
- Remaining simulated or blocked integrations.
```
