// src/services/pinterest.ts
import { apiRequest } from "./supabase";

export interface PinterestAccount {
  display_name: string | null; // username Pinterest
  avatar_url: string | null;
  account_type?: string | null; // PERSONAL | BUSINESS
}

// ── Connexion ────────────────────────────────────────────────

export async function getPinterestStatus(): Promise<{
  connected: boolean;
  account: PinterestAccount | null;
}> {
  return apiRequest("/api/pinterest/status", { method: "GET" });
}

/**
 * Demande l'URL d'autorisation au backend (POST /api/pinterest/auth/url),
 * vérifie qu'elle pointe bien vers pinterest.com, puis redirige le navigateur.
 *
 * Si tout va bien, la page quitte l'application : la promesse ne sert
 * qu'à remonter les erreurs (réseau, 401, URL manquante...).
 */
export async function startPinterestLogin(): Promise<void> {
  console.log("[Stone] Pinterest : demande de l'URL d'autorisation");

  const data = await apiRequest<{ url?: string }>("/api/pinterest/auth/url", {
    method: "POST",
  });

  console.log("[Stone] Pinterest : réponse du backend", data);

  if (!data || typeof data.url !== "string" || !data.url) {
    throw new Error(
      `Le backend n'a pas renvoyé d'URL Pinterest (réponse : ${JSON.stringify(data)})`
    );
  }

  let target: URL;

  try {
    target = new URL(data.url);
  } catch {
    throw new Error(`URL Pinterest invalide : ${data.url}`);
  }

  // pinterest.com, www.pinterest.com, fr.pinterest.com...
  const host = target.hostname;
  const isPinterest = host === "pinterest.com" || host.endsWith(".pinterest.com");

  if (target.protocol !== "https:" || !isPinterest) {
    throw new Error(`URL inattendue (hôte ${host}).`);
  }

  console.log("[Stone] Pinterest : redirection vers", target.toString());

  window.location.assign(target.toString());
}

/**
 * Appelé par la page /pinterest/callback avec les paramètres de l'URL.
 * Envoie le `code` et le `state` au backend, qui échange le code
 * contre un access_token auprès de Pinterest.
 */
export async function completePinterestLogin(
  code: string,
  state: string
): Promise<PinterestAccount | null> {
  const data = await apiRequest<{
    connected?: boolean;
    account?: PinterestAccount | null;
  }>("/api/pinterest/auth/callback", {
    method: "POST",
    body: JSON.stringify({ code, state }),
  });

  return data?.account ?? null;
}

/** Dev / sandbox : connecte le compte avec un token collé à la main. */
export async function connectPinterestWithToken(
  accessToken: string
): Promise<PinterestAccount | null> {
  const data = await apiRequest<{
    connected?: boolean;
    account?: PinterestAccount | null;
  }>("/api/pinterest/auth/token", {
    method: "POST",
    body: JSON.stringify({ access_token: accessToken }),
  });

  return data?.account ?? null;
}

export async function disconnectPinterest(): Promise<void> {
  await apiRequest("/api/pinterest/disconnect", { method: "DELETE" });
}