# TikTok integration notes

Implementation references consulted on 2026-09-18:

- TikTok Login Kit web: https://developers.tiktok.com/doc/login-kit-web/
- TikTok OAuth v2 token management: https://developers.tiktok.com/doc/oauth-user-access-token-management
- TikTok scopes overview: https://developers.tiktok.com/doc/scopes-overview
- TikTok Content Posting API overview: https://developers.tiktok.com/doc/content-posting-api-get-started
- TikTok direct post reference: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post?enter_method=left_navigation

KlipFlow uses the documented OAuth v2 authorization endpoint at https://www.tiktok.com/v2/auth/authorize/, token endpoint at https://open.tiktokapis.com/v2/oauth/token/, user profile endpoint at /v2/user/info/, and direct-post init/status endpoints at /v2/post/publish/video/init/ and /v2/post/publish/status/fetch/.

Required scopes requested by the app: user.info.basic, video.publish, and video.upload. TikTok must approve the app for Login Kit and Content Posting API access before direct publishing will work.
