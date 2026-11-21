// services/googledrive.ts
// Miroir de services/dropbox.ts : même client apiRequest, mêmes conventions.
import { apiRequest } from "./supabase";

export type GoogleDriveStatus = {
  connected: boolean;
  account?: {
    display_name?: string | null;
    email?: string | null;
    profile_photo_url?: string | null;
  } | null;
};

export type GoogleDriveFileEntry = {
  id: string;
  name: string;
  mime_type?: string;
  mimeType?: string;
  size?: number;
};

export type GoogleDriveFilePage = {
  entries: GoogleDriveFileEntry[];
  cursor: string;
  has_more: boolean;
};

export const getGoogleDriveAuthUrl = () =>
  apiRequest<{ url: string }>("/api/googledrive/auth/url", { method: "POST" });

export const completeGoogleDriveAuth = (code: string, state: string) =>
  apiRequest<{ connected: boolean }>("/api/googledrive/auth/callback", {
    method: "POST",
    body: JSON.stringify({ code, state }),
  });

export const getGoogleDriveStatus = () =>
  apiRequest<GoogleDriveStatus>("/api/googledrive/status");

export function listGoogleDriveFiles(folderId = "", cursor?: string) {
  const params = new URLSearchParams({ folderId });
  if (cursor) params.set("cursor", cursor);
  return apiRequest<GoogleDriveFilePage>(
    `/api/googledrive/files?${params.toString()}`
  );
}

export async function downloadGoogleDriveFile(
  entry: GoogleDriveFileEntry
): Promise<File> {
  const { url } = await apiRequest<{ url: string }>(
    "/api/googledrive/files/download",
    {
      method: "POST",
      body: JSON.stringify({ fileId: entry.id }),
    }
  );

  const downloadUrl = new URL(url);
  const hostname = downloadUrl.hostname.toLowerCase();
  if (
    downloadUrl.protocol !== "https:" ||
    !(hostname === "googleapis.com" ||
      hostname.endsWith(".googleapis.com") ||
      hostname === "googleusercontent.com" ||
      hostname.endsWith(".googleusercontent.com"))
  ) {
    throw new Error("Google Drive returned an invalid download link.");
  }

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Google Drive file download failed (${response.status}).`);
  }

  const blob = await response.blob();
  const extension = entry.name.split(".").pop()?.toLowerCase() ?? "";
  const inferredTypes: Record<string, string> = {
    avif: "image/avif",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    m4v: "video/x-m4v",
    mov: "video/quicktime",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  const metadataType = entry.mime_type ?? entry.mimeType;
  const mimeType =
    (blob.type && blob.type !== "application/octet-stream" ? blob.type : null) ||
    (metadataType && metadataType !== "application/octet-stream"
      ? metadataType
      : null) ||
    inferredTypes[extension] ||
    "application/octet-stream";
  return new File([blob], entry.name, { type: mimeType });
}

export const disconnectGoogleDrive = () =>
  apiRequest<{ connected: boolean }>("/api/googledrive/disconnect", {
    method: "DELETE",
  });