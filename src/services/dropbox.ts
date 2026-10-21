import { apiRequest } from "./supabase";

export type DropboxStatus = {
  connected: boolean;
  account?: {
    display_name?: string | null;
    email?: string | null;
  } | null;
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

export const disconnectDropbox = () =>
  apiRequest<{ connected: boolean }>("/api/dropbox/disconnect", {
    method: "DELETE",
  });