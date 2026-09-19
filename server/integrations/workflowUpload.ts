import type { Express } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { createContext } from "../_core/context";
import { storagePut } from "../storage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 750 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, callback) => {
    const allowed = file.fieldname === "video" ? ["video/mp4", "video/quicktime", "video/webm"] : ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    callback(null, allowed.includes(file.mimetype));
  },
});

export function registerWorkflowUploadRoutes(app: Express) {
  app.post("/api/workflow/upload", upload.fields([{ name: "video", maxCount: 1 }, { name: "requirements", maxCount: 1 }]), async (req, res) => {
    try {
      const context = await createContext({ req: req as never, res: res as never, info: {} as never });
      if (!context.user) return res.status(401).json({ message: "Please sign in before uploading." });
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const video = files?.video?.[0];
      const requirements = files?.requirements?.[0];
      if (!video && !requirements) return res.status(400).json({ message: "Choose a video or requirements file first." });
      const result: { fileUrl?: string; requirementsUrl?: string } = {};
      if (video) {
        const extension = video.originalname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ".mp4";
        result.fileUrl = (await storagePut(`klipflow/${context.user.openId}/videos/${randomUUID()}${extension}`, video.buffer, video.mimetype)).url;
      }
      if (requirements) {
        const extension = requirements.originalname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ".txt";
        result.requirementsUrl = (await storagePut(`klipflow/${context.user.openId}/requirements/${randomUUID()}${extension}`, requirements.buffer, requirements.mimetype)).url;
      }
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      return res.status(500).json({ message });
    }
  });
}
