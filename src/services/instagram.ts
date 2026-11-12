// src/services/instagram.ts
import { apiRequest } from "./supabase";

export interface InstagramAccount {
  display_name: string | null; // @username
  avatar_url: string | null;
}

export async function getInstagramStatus(): Promise<{
  connected: boolean;
  account: InstagramAccount | null;
}> {
  return apiRequest("/api/instagram/status", { method: "GET" });
}

/**
 * Demande l'URL d'autorisation au backend, vérifie qu'elle pointe vers
 * instagram.com (ou Facebook en mode historique), puis redirige le navigateur. Si tout va bien, la page
 * quitte l'application : la promesse sert seulement à remonter les erreurs.
 */
export async function startInstagramLogin(): Promise<void> {
  const data = await apiRequest<{ url?: string }>("/api/instagram/auth/url", {
    method: "POST",
  });

  if (!data || typeof data.url !== "string" || !data.url) {
    throw new Error("Le backend n'a pas renvoyé d'URL Instagram.");
  }

  let target: URL;
  try {
    target = new URL(data.url);
  } catch {
    throw new Error(`URL Instagram invalide : ${data.url}`);
  }

  const okHost =
    target.hostname === "www.facebook.com" ||
    target.hostname === "facebook.com" ||
    target.hostname === "www.instagram.com" ||
    target.hostname === "instagram.com";
  if (target.protocol !== "https:" || !okHost) {
    throw new Error(`URL inattendue (hôte ${target.hostname}).`);
  }

  window.location.assign(target.toString());
}

export async function completeInstagramLogin(
  code: string,
  state: string
): Promise<InstagramAccount | null> {
  const data = await apiRequest<{
    connected?: boolean;
    account?: InstagramAccount | null;
  }>("/api/instagram/auth/callback", {
    method: "POST",
    body: JSON.stringify({ code, state }),
  });

  return data?.account ?? null;
}

export async function disconnectInstagram(): Promise<void> {
  await apiRequest("/api/instagram/disconnect", { method: "DELETE" });
}