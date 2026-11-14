import { apiRequest } from "./supabase";

export interface ThreadsAccount {
  display_name: string | null;
  avatar_url: string | null;
  account_id?: string | null;
}

export async function getThreadsStatus(): Promise<{
  connected: boolean;
  account: ThreadsAccount | null;
}> {
  return apiRequest("/api/threads/status", { method: "GET" });
}

export async function startThreadsLogin(): Promise<void> {
  const data = await apiRequest<{ url?: string }>("/api/threads/auth/url", { method: "POST" });
  if (!data?.url) throw new Error("Le backend n'a pas renvoyé d'URL Threads.");
  let target: URL;
  try { target = new URL(data.url); }
  catch { throw new Error("URL Threads invalide."); }
  if (target.protocol !== "https:" || !["threads.com", "www.threads.com"].includes(target.hostname)) {
    throw new Error("Le backend a renvoyé une URL Threads inattendue.");
  }
  window.location.assign(target.toString());
}

export async function disconnectThreads(): Promise<void> {
  await apiRequest("/api/threads/disconnect", { method: "DELETE" });
}
