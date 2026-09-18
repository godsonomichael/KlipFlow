import { TRPCError } from "@trpc/server";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

export function extractDriveId(url: string): string | null {
  const value = url.trim();
  if (!value) return null;
  const match = value.match(/\/d\/([a-zA-Z0-9_-]+)/) ?? value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

function getDriveToken() {
  const token = process.env.GOOGLE_DRIVE_TOKEN;
  if (!token) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Drive is not connected. Connect Google Drive before importing a file." });
  }
  return token;
}

export type DriveFileMetadata = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
};

export async function getDriveFileMetadata(fileId: string): Promise<DriveFileMetadata> {
  const token = getDriveToken();
  const response = await fetch(`${DRIVE_API}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,webViewLink`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401 || response.status === 403) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Google Drive access was denied. Reconnect Drive or ask the file owner to grant access." });
  }
  if (response.status === 404) {
    throw new TRPCError({ code: "NOT_FOUND", message: "That Drive file was not found or is not shared with the connected account." });
  }
  if (!response.ok) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: `Google Drive returned HTTP ${response.status}.` });
  }

  return (await response.json()) as DriveFileMetadata;
}

export async function inspectDriveUrl(url: string) {
  const fileId = extractDriveId(url);
  if (!fileId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid Google Drive file URL." });
  }
  const metadata = await getDriveFileMetadata(fileId);
  return { fileId, metadata, readyForProcessing: true };
}

export function isDriveConfigured() {
  return Boolean(process.env.GOOGLE_DRIVE_TOKEN);
}
