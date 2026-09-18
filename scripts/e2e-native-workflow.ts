import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { storagePut } from "../server/storage";
import { createProject, generateClips } from "../server/integrations/nativeWorkflow";

const userId = process.env.OWNER_OPEN_ID;
const sourcePath = process.argv[2];
if (!userId || !sourcePath) throw new Error("OWNER_OPEN_ID and a source video path are required");

const stored = await storagePut(`klipflow/e2e/${Date.now()}-source.mp4`, await readFile(sourcePath), "video/mp4");
const project = await createProject(userId, { title: "KlipFlow E2E verification", fileUrl: stored.url });
try {
  const clips = await generateClips(userId, project.id);
  if (clips.length !== 5) throw new Error(`Expected 5 clips, received ${clips.length}`);
  if (clips.some((clip) => !clip.clip_url)) throw new Error("At least one generated clip is missing a URL");
  console.log(JSON.stringify({ projectId: project.id, sourceUrlPresent: Boolean(stored.url), clipCount: clips.length, clipUrlsPresent: clips.every((clip) => Boolean(clip.clip_url)) }));
} finally {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  await connection.execute("DELETE FROM projects WHERE id=? AND user_id=?", [project.id, userId]);
  await connection.end();
}
