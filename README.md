# KlipFlow — AI Short-Form Clip Workflow

KlipFlow is a mobile-first creator workflow for turning long-form video into short-form clips, reviewing them, publishing them to supported social platforms, and tracking submissions, views, and earnings.

## Product goal

KlipFlow is designed to help creators upload or link a long video, generate short clips, review the results, and distribute approved clips across TikTok, YouTube Shorts, and Instagram Reels as platform integrations become fully configured.

## Current workflow

1. Create a clipping project from an uploaded video or source link.
2. Process the source into short-form clip candidates.
3. Review clips in the dashboard.
4. Track posting status, platform information, views, and earnings.
5. Configure supported social accounts and notification preferences.

## Platform integrations

- **TikTok:** OAuth, account verification, and Content Posting API groundwork are implemented. Production publishing depends on valid credentials, TikTok app approval, and environment configuration.
- **YouTube Shorts:** OAuth and provider integration routes are present. Production use requires configured YouTube credentials and validated publishing behavior.
- **Instagram Reels:** Instagram provider/OAuth architecture is present. Production Reels publishing remains dependent on Meta Business account configuration, permissions, credentials, and app review.
- **Telegram:** Reminder and notification workflows are implemented with configurable delivery behavior.
- **Whop:** Submission and status-tracking data structures are retained for the existing content-rewards workflow.

## Media processing

The repository includes FFmpeg-based clip-processing work and upload/storage flows. Some generation and publishing paths remain simulated or require production-service validation. Advanced capabilities such as large-scale 30-clip generation, face tracking, smart cropping, and fully automated caption styling should be treated as roadmap or validation items until confirmed in production.

## Technology

- Vite
- React
- TypeScript
- Express
- tRPC
- Drizzle metadata and native persistence
- FFmpeg-based media processing
- TikTok, YouTube, and Instagram provider integrations
- Telegram reminders
- Umami analytics hooks

## Current status

- GitHub repository: `godsonomichael/KlipFlow`
- Live demo: <https://klipflow-g6pmn7fa.manus.space>
- TikTok integration: implementation and verification groundwork present; credentials and provider approval required for production validation
- YouTube integration: OAuth/provider groundwork present; credentials required
- Instagram integration: architecture and OAuth/provider groundwork present; Meta Business configuration and review required
- Production media processing, posting, analytics synchronization, and reminders: validate per environment before describing them as fully operational

## Configuration categories

The deployment may require environment variables for:

- Application authentication and runtime configuration
- TikTok OAuth and publishing
- YouTube OAuth
- Meta/Facebook and Instagram integration
- Telegram notifications
- Optional analytics

Never commit actual credentials or secrets. Configure them through the deployment secret manager.

## Development

Requirements: Node.js 22+ and pnpm 10+.

```bash
pnpm install
cp .env.example .env
pnpm check
pnpm test
pnpm build
pnpm dev
```

The development server starts on port 3000 by default and serves the Vite frontend with the Express/tRPC backend.

## Repository maintenance

Every app update or upgrade must be reviewed, validated, committed, and pushed to GitHub on the `master` branch. Before pushing, run the relevant checks, review the diff, and ensure that credentials, generated secrets, and local environment files are not included. Commit messages should briefly describe the change.

The project preserves the existing Supabase project, Whop app reference, n8n webhook contracts, and legacy webhook paths. Do not create replacement infrastructure or delete legacy data without an explicit migration plan.
