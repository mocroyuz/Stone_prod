import { apiRequest } from "./supabase";

export type DropboxStatus = {
  connected: boolean;
  account?: {
    display_name?: string | null;
    email?: string | null;
  } | null;
};

export type DropboxFileEntry = {
  ".tag": "file" | "folder";
  id?: string;
  name: string;
  path_lower: string;
  path_display: string;
  size?: number;
  server_modified?: string;
  mime_type?: string;
};

export type DropboxFilePage = {
  entries: DropboxFileEntry[];
  cursor: string;
  has_more: boolean;
};

export const getDropboxAuthUrl = () =>
  apiRequest<{ url: string }>("/api/dropbox/auth/url", { method: "POST" });

export const completeDropboxLogin = (code: string, state: string) =>
  apiRequest<{ connected: boolean }>("/api/dropbox/auth/callback", {
    method: "POST",
    body: JSON.stringify({ code, state }),
  });

export const getDropboxStatus = () =>
  apiRequest<DropboxStatus>("/api/dropbox/status");

export function listDropboxFiles(path = "", cursor?: string) {
  const params = new URLSearchParams({ path });
  if (cursor) params.set("cursor", cursor);
  return apiRequest<DropboxFilePage>(`/api/dropbox/files?${params.toString()}`);
}

export async function downloadDropboxFile(entry: DropboxFileEntry): Promise<File> {
  const { url } = await apiRequest<{ url: string }>(
    "/api/dropbox/files/download",
    {
      method: "POST",
      body: JSON.stringify({ path: entry.path_lower }),
    }
  );

  const downloadUrl = new URL(url);
  const hostname = downloadUrl.hostname.toLowerCase();
  if (
    downloadUrl.protocol !== "https:" ||
    (hostname !== "dropboxusercontent.com" &&
      !hostname.endsWith(".dropboxusercontent.com"))
  ) {
    throw new Error("Dropbox returned an invalid download link.");
  }

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Dropbox file download failed (${response.status}).`);
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
  const mimeType =
    (blob.type && blob.type !== "application/octet-stream" ? blob.type : null) ||
    entry.mime_type ||
    inferredTypes[extension] ||
    "application/octet-stream";
  return new File([blob], entry.name, { type: mimeType });
}

export const disconnectDropbox = () =>
  apiRequest<{ connected: boolean }>("/api/dropbox/disconnect", {
    method: "DELETE",
  });