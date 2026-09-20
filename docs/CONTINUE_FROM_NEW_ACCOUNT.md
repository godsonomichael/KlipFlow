# KlipFlow — Continuation Handover for a New Manus Account

**Updated:** 20 September 2026  
**Repository:** `godsonomichael/KlipFlow`  
**Working branch:** `fix/real-posting-integrity`  
**Latest pushed commit:** `e3b8e53c8c7577dc10c1edcbf713872b2cae601e`

## Executive summary

KlipFlow is a mobile-first clipper workflow application. It is not a campaign marketplace. Clippers use it to bring in long-form source material, prepare short-form clips, publish them through supported social providers, submit verified public post links to external campaign platforms, and track performance and estimated earnings.

The canonical source is the public GitHub repository. The Manus-hosted application and the separate Whop-hosted application are not the same source tree and cannot be merged by combining deployment URLs. The production strategy is to keep the Manus codebase as the canonical processing and workflow engine, then port the Whop campaign/account capabilities into this codebase through real server-side provider adapters.

The Whop source was **not available** in GitHub or in the current sandbox. The public Whop app is at <https://klipflow.whop.site>, but its hosted behavior is not an exportable source tree. Do not claim that the two applications have been code-merged until the Whop builder supplies a repository, ZIP export, or attached source project.

## What has been completed in this session

### Commit `3b4a27a`

- Removed the simulated auto-post endpoint and stale frontend calls.
- Auto-post is only offered when a real YouTube, Instagram, or TikTok account is connected.
- Added platform-aware validation for manually recorded post URLs.
- Made repeated recording of the same clip/post URL idempotent.
- Added URL validation tests.

### Commit `e3b8e53`

- Added streamed source-size enforcement so a response cannot exceed the processing limit while downloading.
- Added production SSRF protection against localhost, loopback, link-local, private-network, carrier-grade NAT, and IPv6 private hosts.
- Preserved signed Manus storage URLs.
- Added regression tests for source-host safety and HTTP(S) validation.

### Validation result

The latest local validation passed:

- `pnpm check` — passed.
- `pnpm test` — **18 tests passed; 2 credential-dependent tests skipped**.
- `pnpm build` — passed.

The pull request is [GitHub PR #4](https://github.com/godsonomichael/KlipFlow/pull/4). It is open against `master` and has passed CI. Do not merge it until the project owner reviews the changes and confirms the intended deployment target.

## Repository access and exact resume commands

The public repository is:

```text
https://github.com/godsonomichael/KlipFlow
```

A new Manus account or engineer can resume with:

```bash
git clone https://github.com/godsonomichael/KlipFlow.git
cd KlipFlow
git fetch origin
git checkout master
git pull --ff-only
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

To continue the current unmerged work:

```bash
git fetch origin
git checkout -B fix/real-posting-integrity origin/fix/real-posting-integrity
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Never copy `.project-config.json`, internal artifact remotes, database URLs, Forge keys, OAuth secrets, or access tokens into GitHub, tickets, chat, or this document.

## Current architecture

| Layer | Current implementation | Important limitation |
|---|---|---|
| Frontend | React, Vite, TypeScript, Tailwind, tRPC | Existing orange/white/black UI must be preserved |
| API | Express and tRPC | Protected procedures use Manus session identity |
| Database | MySQL/TiDB through native workflow code and Drizzle migrations | Backup/restore and migration ownership still need to be formalized |
| Storage | Manus Forge storage and `/manus-storage/{key}` paths | Replace with independently owned object storage for a full Manus-free migration |
| Media | Bundled FFmpeg/FFprobe, five evenly distributed clips, 9:16 scale/pad | No transcription, animated captions, smart crop, face tracking, or campaign-aware rendering yet |
| Social | TikTok, YouTube, and Instagram provider code | Provider credentials, approvals, public media URL, and live tests are still required |
| Campaigns | Manual Whop status and submission tracking | Whop account OAuth, campaign sync, requirement parsing, and API submission are incomplete |
| Notifications | In-app notification records, unread count, Telegram reminder logic | Recurring scheduler and provider-specific campaign alerts need production setup |
| Earnings | Estimated earnings from views and configured rates | Confirmed platform earnings are unavailable without provider APIs |
| CI | GitHub Actions check, test, and build workflow | Required check is configured for protected `master` |

## Known current behavior

The current Manus application can create projects, accept uploaded files, generate five clips, store clip records, show progress/history, review and edit metadata, capture manual post URLs, track Whop submission status, calculate estimated earnings, and display notifications.

The current generation path is still a web-process-oriented worker. The source-size guard is 750 MB because the application downloads the source to temporary storage and the worker loads each rendered clip into memory before uploading. This is a safety limit, not a product requirement. Supporting larger files requires multipart storage uploads and an asynchronous external render worker, not simply changing the constant.

A generic HTTP URL is currently treated as a direct video source. A YouTube watch page is not a downloadable media file and therefore requires a separate approved ingestion implementation, such as a compliant provider/downloader service. Do not label YouTube-page ingestion as working until it has been implemented and tested.

The current worker does not generate captions or tags. It cuts and reformats source material. Caption/tag generation and campaign validation must be added before campaign auto-posting is enabled.

## Remaining production work, in order

### 1. Finish source ingestion and large-file processing

- Add direct-to-object-storage multipart/resumable upload.
- Store source keys and metadata rather than copying large files through the web request.
- Add asynchronous generation queues and external FFmpeg worker execution.
- Stream source and output handling where possible.
- Add separate configurable limits for file size, duration, concurrency, and plan tier.
- Add retry, cancellation, timeout, cleanup, and worker health handling.
- Add a real long-video load test.
- Add a compliant YouTube/source-link ingestion adapter or clearly label unsupported URLs.

### 2. Add transcription, captions, and tags

- Transcribe source audio.
- Detect candidate hooks/moments.
- Generate title, description, caption, hashtags, tags, mentions, and required campaign phrases.
- Render captions into final assets using a selectable style.
- Store the applied metadata and render version for auditability.
- Show the user exactly what will be posted before provider submission.

### 3. Add campaign-platform data model and Whop adapter

Create real server-side models for campaign providers, connected campaign accounts, campaigns, requirements, campaign-linked clips, submissions, and submission events.

The Whop adapter must use official OAuth/API capabilities where available. It must store provider campaign IDs, requirements, platform rules, deadlines, payout rules, sync status, and error state. It must never invent campaigns, earnings, account identities, submission IDs, or post URLs.

If Whop does not expose a required capability, preserve a clearly labelled manual workflow and show the last successful sync/error state.

### 4. Add requirement validation and campaign-aware workflow

Before posting, validate platform, duration, aspect ratio, required phrase/hashtag, caption, visibility, public URL, deadline, duplicate state, and any campaign-specific metadata.

A clip that fails a requirement must be marked `Needs review`. Only a fully validated rendered clip may enter auto-posting.

### 5. Complete social provider production validation

Configure and test:

- TikTok client key/secret, scopes, Content Posting API approval, and callback URL.
- YouTube client ID/secret, consent screen, OAuth callback, quota, and upload behavior.
- Meta/Facebook app ID/secret, Instagram professional account, permissions, callback URL, and app review.

Tokens must remain server-side. Health checks must distinguish `Connected`, `Needs attention`, `Manual`, and `Not connected`.

### 6. Implement automatic campaign submission

After a real provider returns a completed public post:

1. store provider post ID and URL;
2. verify the URL is public;
3. submit it to the linked campaign API;
4. store the real campaign submission ID/response;
5. update status and create an in-app notification;
6. retry failures idempotently;
7. retain manual URL submission as a fallback.

Never create a synthetic success state.

### 7. Production operations

- Choose independently owned hosting, database, and object storage if Manus is being removed.
- Set `PUBLIC_APP_URL` before validating provider URLs.
- Configure recurring jobs for view sync, account health, campaign sync, deadline alerts, and Telegram reminders.
- Configure backups and restore drills.
- Rotate credentials after migration.
- Add monitoring for failed generation jobs, provider failures, storage failures, and queue depth.

## Environment variable names

Use `.env.example` in the repository as the non-secret template. Values must be supplied through the new account’s project secret manager or the chosen hosting provider.

Core values include `DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL`, `VITE_APP_ID`, `OWNER_OPEN_ID`, and `PUBLIC_APP_URL`.

Media values include `FFMPEG_PATH`, `FFPROBE_PATH`, `FFMPEG_PRESET`, and `FFMPEG_CRF`. `KLIPFLOW_MAX_SOURCE_MB` and `KLIPFLOW_MAX_UPLOAD_MB` are optional deployment limits; when unset, the application does not impose the former 750 MB ceiling, but the host’s available disk, memory, timeout, and object-storage limits still apply. Set explicit values for a multi-tenant production deployment rather than promising literally unlimited processing.

`MEDIA_INGEST_WORKER_URL` and optional `MEDIA_INGEST_WORKER_TOKEN` configure the external worker contract for YouTube watch URLs. The worker must accept `POST /v1/ingest` with `{ "source": "https://..." }` and return `{ "mediaUrl": "https://..." }` or a Manus storage path. The application rejects YouTube watch URLs when this worker is not configured; it never treats a web page as a video file.

Social values include `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, and `META_GRAPH_VERSION`.

Optional notification values include `TELEGRAM_BOT_TOKEN` and the user’s Telegram settings.

Manus-only values include the Forge and Manus OAuth variables. These must be replaced if the runtime is migrated away from Manus.

## Manus/WebDev ownership boundary

GitHub provides the source code only. It does not transfer:

- the existing WebDev project;
- the `manus.space` domain;
- the WebDev database;
- storage objects;
- managed secrets;
- deployment checkpoints;
- Manus OAuth ownership.

The previously referenced WebDev project is `g6pMN7FApnJhzqQERtdnRz` at <https://klipflow-g6pmn7fa.manus.space>. A new Manus account cannot assume full ownership merely by cloning GitHub. For full project migration, contact <https://help.manus.im> and request ownership migration, or create a new WebDev project and migrate the database, storage, secrets, and domain deliberately.

The local WebDev project currently present in the sandbox has a different project ID and must not be confused with the production project.

## Resume prompt for a new Manus account

> Continue KlipFlow from the public repository `godsonomichael/KlipFlow`. First read `docs/CONTINUE_FROM_NEW_ACCOUNT.md`, `KLIPFLOW_ENGINEER_HANDOVER.md`, and `KLIPFLOW_CAMPAIGN_PLATFORM_INTEGRATION_REQUEST.md`. Use `origin/fix/real-posting-integrity` as the current review branch and preserve the orange/white/black UI. Do not create fake users, campaigns, post URLs, provider success states, or earnings. Run `pnpm check`, `pnpm test`, and `pnpm build` before every update, commit every validated change, and push it to a feature branch. Continue in this order: large-file asynchronous rendering, transcription/captions/tags, campaign data model and official Whop adapter, campaign requirement validation, real provider configuration/testing, and automatic campaign submission with manual fallback. Do not claim Whop source has been merged unless a source export is supplied.

## Transfer checklist

- [ ] New account can clone the public repository.
- [ ] New account has GitHub write access if private branch work is required.
- [ ] New account has access to the chosen hosting provider.
- [ ] Database has been backed up and restore-tested.
- [ ] Object storage has been backed up and migrated if required.
- [ ] OAuth apps and callback URLs are owned by the new operator.
- [ ] Social credentials are stored in a secret manager.
- [ ] Whop source export or official API contract is available.
- [ ] `PUBLIC_APP_URL` is configured.
- [ ] CI passes on the continuation branch.
- [ ] Production smoke tests pass with a real account.
- [ ] Old credentials are rotated or revoked after cutover.
