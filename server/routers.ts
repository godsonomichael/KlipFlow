import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { KLIPFLOW_BRAND, recoveredIntegrationStatus } from "@shared/klipflow";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { inspectDriveUrl, isDriveConfigured } from "./integrations/googleDrive";
import { addConnectedAccount, countUnreadNotifications, createProject, generateClips, getClipperSettings, getEarningsSummary, getProject, listClips, listConnectedAccounts, listNotifications, listProjects, markNotificationRead, markWhopSubmitted, removeConnectedAccount, saveClipperSettings, simulatePost, submitClip, updateClipMetadata, updateWhopStatus } from "./integrations/nativeWorkflow";
import { postClipToProvider, syncProviderViews } from "./integrations/socialProviders";

const platform = z.enum(["tiktok", "instagram", "youtube", "x"]);
const accountPlatform = z.enum(["tiktok", "instagram", "youtube", "x", "telegram"]);
const userId = (ctx: { user: { openId: string } }) => ctx.user.openId;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  klipflow: router({
    brand: publicProcedure.query(() => KLIPFLOW_BRAND),
    integrationStatus: publicProcedure.query(() => ({ ...recoveredIntegrationStatus, drive: isDriveConfigured() ? "connected" : "needs_configuration" })),
    accounts: router({
      list: protectedProcedure.query(({ ctx }) => listConnectedAccounts(userId(ctx))),
      connect: protectedProcedure.input(z.object({ platform: accountPlatform, handle: z.string().min(2).max(120) })).mutation(({ ctx, input }) => addConnectedAccount(userId(ctx), input.platform, input.handle)),
      remove: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(({ ctx, input }) => removeConnectedAccount(userId(ctx), input.id)),
    }),
    projects: router({
      list: protectedProcedure.query(({ ctx }) => listProjects(userId(ctx))),
      get: protectedProcedure.input(z.object({ projectId: z.string().uuid() })).query(({ ctx, input }) => getProject(userId(ctx), input.projectId)),
      create: protectedProcedure.input(z.object({ sourceLink: z.string().url().optional(), fileUrl: z.string().optional(), requirementsLink: z.string().url().optional(), requirementsFile: z.string().optional(), title: z.string().max(120).optional() })).mutation(({ ctx, input }) => createProject(userId(ctx), input)),
      generate: protectedProcedure.input(z.object({ projectId: z.string().uuid() })).mutation(({ ctx, input }) => generateClips(userId(ctx), input.projectId)),
    }),
    clips: router({
      list: protectedProcedure.query(({ ctx }) => listClips(userId(ctx))),
      submit: protectedProcedure.input(z.object({ clipId: z.string().uuid(), postUrl: z.string().url(), platform: platform.optional() })).mutation(({ ctx, input }) => submitClip(userId(ctx), input.clipId, input.postUrl, input.platform)),
      autoPost: protectedProcedure.input(z.object({ clipId: z.string().uuid(), platform, handle: z.string().min(1).max(80) })).mutation(({ ctx, input }) => simulatePost(userId(ctx), input.clipId, input.platform, input.handle)),
      realPost: protectedProcedure.input(z.object({ clipId: z.string().uuid(), platform: z.enum(["youtube", "instagram"]) })).mutation(({ ctx, input }) => postClipToProvider(userId(ctx), input.clipId, input.platform)),
      syncViews: protectedProcedure.input(z.object({ submissionId: z.string().uuid(), platform: z.enum(["youtube", "instagram"]) })).mutation(({ ctx, input }) => syncProviderViews(userId(ctx), input.submissionId, input.platform)),
      updateMetadata: protectedProcedure.input(z.object({ clipId: z.string().uuid(), title: z.string().min(1).max(120), caption: z.string().max(1000) })).mutation(({ ctx, input }) => updateClipMetadata(userId(ctx), input.clipId, input.title, input.caption)),
      markWhopSubmitted: protectedProcedure.input(z.object({ clipId: z.string().uuid() })).mutation(({ ctx, input }) => markWhopSubmitted(userId(ctx), input.clipId)),
      updateWhopStatus: protectedProcedure.input(z.object({ clipId: z.string().uuid(), status: z.enum(["not_submitted", "submitted", "approved"]) })).mutation(({ ctx, input }) => updateWhopStatus(userId(ctx), input.clipId, input.status)),
    }),
    earnings: protectedProcedure.query(({ ctx }) => getEarningsSummary(userId(ctx))),
    notifications: router({
      list: protectedProcedure.query(({ ctx }) => listNotifications(userId(ctx))),
      unreadCount: protectedProcedure.query(({ ctx }) => countUnreadNotifications(userId(ctx))),
      markRead: protectedProcedure.input(z.object({ notificationId: z.string().uuid() })).mutation(({ ctx, input }) => markNotificationRead(userId(ctx), input.notificationId)),
    }),
    settings: router({
      get: protectedProcedure.query(({ ctx }) => getClipperSettings(userId(ctx))),
      save: protectedProcedure.input(z.object({ tiktokRate: z.number().min(0).max(10000).nullable().optional(), instagramRate: z.number().min(0).max(10000).nullable().optional(), youtubeRate: z.number().min(0).max(10000).nullable().optional(), xRate: z.number().min(0).max(10000).nullable().optional(), telegramChatId: z.string().max(120).nullable().optional(), telegramEnabled: z.boolean().optional(), telegramMilestone: z.number().int().min(100).max(100000000).optional() })).mutation(({ ctx, input }) => saveClipperSettings(userId(ctx), input)),
    }),
    drive: router({
      status: protectedProcedure.query(() => ({ configured: isDriveConfigured(), provider: "google_drive" as const })),
      inspect: protectedProcedure.input(z.object({ url: z.string().url().max(2048) })).mutation(({ input }) => inspectDriveUrl(input.url)),
    }),
  }),
});

export type AppRouter = typeof appRouter;
