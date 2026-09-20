import type { Express } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { createContext } from "../_core/context";
import { storagePutFile } from "../storage";

function uploadLimitBytes() {
  const megabytes = Number(process.env.KLIPFLOW_MAX_UPLOAD_MB || 0);
  return Number.isFinite(megabytes) && megabytes > 0 ? Math.floor(megabytes * 1024 * 1024) : undefined;
}

const upload = multer({
  storage: multer.diskStorage({ destination: "/tmp", filename: (_req, file, callback) => callback(null, `klipflow-upload-${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`) }),
  limits: { fileSize: uploadLimitBytes(), files: 2 },
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
      try {
        if (video) {
          const extension = video.originalname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ".mp4";
          result.fileUrl = (await storagePutFile(`klipflow/${context.user.openId}/videos/${randomUUID()}${extension}`, video.path, video.mimetype, video.size)).url;
        }
        if (requirements) {
          const extension = requirements.originalname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ".txt";
          result.requirementsUrl = (await storagePutFile(`klipflow/${context.user.openId}/requirements/${randomUUID()}${extension}`, requirements.path, requirements.mimetype, requirements.size)).url;
        }
        return res.json(result);
      } finally {
        await Promise.all([video, requirements].filter(Boolean).map(file => unlink((file as Express.Multer.File).path).catch(() => undefined)));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      return res.status(error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? 413 : 500).json({ message: error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? "The upload exceeds the configured file-size limit." : message });
    }
  });
}
