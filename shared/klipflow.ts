export const KLIPFLOW_BRAND = {
  name: "KlipFlow",
  appStoreTitle: "KlipFlow - Content Rewards Automation",
  colors: { background: "#F7F7F5", card: "#FFFFFF", border: "#E8E8E5", accent: "#FF4D00" },
  legacyWebhookPaths: ["/webhook/campaign-intake", "/webhook/clipflow-telegram-alert"],
} as const;

export type IntegrationState = "connected" | "needs_configuration" | "not_verified";
export type KlipFlowIntegrationStatus = { n8n: IntegrationState; whop: IntegrationState; supabase: IntegrationState; firecrawl: IntegrationState; drive: IntegrationState; metricool: IntegrationState; telegram: IntegrationState };
export const recoveredIntegrationStatus: KlipFlowIntegrationStatus = { n8n: "connected", whop: "needs_configuration", supabase: "not_verified", firecrawl: "needs_configuration", drive: "connected", metricool: "connected", telegram: "connected" };

export type DriveImportStatus = { configured: boolean; provider: "google_drive" };

export function calculatePayout(views: number, ratePerThousand: number | null | undefined) {
  if (!ratePerThousand || ratePerThousand <= 0 || views <= 0) return 0;
  return Math.floor(views / 1000) * ratePerThousand;
}
