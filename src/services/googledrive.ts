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

export const getGoogleDriveAuthUrl = () =>
  apiRequest<{ url: string }>("/api/googledrive/auth/url", { method: "POST" });

export const completeGoogleDriveAuth = (code: string, state: string) =>
  apiRequest<{ connected: boolean }>("/api/googledrive/auth/callback", {
    method: "POST",
    body: JSON.stringify({ code, state }),
  });

export const getGoogleDriveStatus = () =>
  apiRequest<GoogleDriveStatus>("/api/googledrive/status");

export const disconnectGoogleDrive = () =>
  apiRequest<{ connected: boolean }>("/api/googledrive/disconnect", {
    method: "DELETE",
  });