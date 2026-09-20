import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const candidates = [
    path.resolve(import.meta.dirname, "public"),
    path.resolve(process.cwd(), "dist", "public"),
  ];
  const distPath = candidates.find(candidate => fs.existsSync(candidate)) ?? candidates[0];
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // Fall through to index.html if the file doesn't exist.
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
