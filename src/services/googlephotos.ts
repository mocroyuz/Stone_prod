import { apiRequest } from "./supabase";
// ⚠️ à adapter : la fonction qui renvoie le token d'accès dans ton supabase.ts
import { getAccessToken } from "./supabase";

export type GooglePhotosStatus = {
  connected: boolean;
  account?: { display_name?: string | null } | null;
};

export type PickerSession = {
  session_id: string;
  picker_uri: string;
  poll_interval_ms: number;
  timeout_ms: number;
};

export type PickedItem = {
  id: string;
  type: "PHOTO" | "VIDEO";
  name: string;
  mime_type: string | null;
  base_url: string | null;
  width: number | null;
  height: number | null;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export const getGooglePhotosAuthUrl = () =>
  apiRequest<{ url: string }>("/api/googlephotos/auth/url", { method: "POST" });

export const completeGooglePhotosAuth = (code: string, state: string) =>
  apiRequest<{ connected: boolean }>("/api/googlephotos/auth/callback", {
    method: "POST",
    body: JSON.stringify({ code, state }),
  });

export const getGooglePhotosStatus = () =>
  apiRequest<GooglePhotosStatus>("/api/googlephotos/status");

export const disconnectGooglePhotos = () =>
  apiRequest<{ success: boolean }>("/api/googlephotos/disconnect", { method: "DELETE" });

export const createPickerSession = () =>
  apiRequest<PickerSession>("/api/googlephotos/picker/session", { method: "POST" });

export const pollPickerSession = (sessionId: string) =>
  apiRequest<{ media_items_set: boolean }>(
    `/api/googlephotos/picker/session?sessionId=${encodeURIComponent(sessionId)}`
  );

export const listPickedItems = (sessionId: string, pageToken?: string) => {
  const params = new URLSearchParams({ sessionId });
  if (pageToken) params.set("pageToken", pageToken);
  return apiRequest<{ items: PickedItem[]; next_page_token: string | null }>(
    `/api/googlephotos/picker/items?${params.toString()}`
  );
};

export const deletePickerSession = (sessionId: string) =>
  apiRequest<{ success: boolean }>(
    `/api/googlephotos/picker/session?sessionId=${encodeURIComponent(sessionId)}`,
    { method: "DELETE" }
  );

/** Ouvre le Picker, attend la sélection, renvoie les médias choisis. */
export async function pickFromGooglePhotos(popup: Window): Promise<PickedItem[]> {
  const session = await createPickerSession();
  popup.location.href = session.picker_uri;

  const deadline = Date.now() + session.timeout_ms;
  try {
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, session.poll_interval_ms));
      if (popup.closed) throw new Error("La sélection a été annulée.");
      const { media_items_set } = await pollPickerSession(session.session_id);
      if (media_items_set) break;
      if (Date.now() >= deadline) throw new Error("Délai dépassé.");
    }

    const all: PickedItem[] = [];
    let pageToken: string | undefined;
    do {
      const page = await listPickedItems(session.session_id, pageToken);
      all.push(...page.items);
      pageToken = page.next_page_token ?? undefined;
    } while (pageToken);

    return all;
  } finally {
    if (!popup.closed) popup.close();
    void deletePickerSession(session.session_id).catch(() => {});
  }
}

export async function downloadGooglePhotosItem(item: PickedItem): Promise<File> {
  if (!item.base_url) throw new Error("Média indisponible.");

  const token = await getAccessToken();
  const response = await fetch(`${API_BASE}/api/googlephotos/picker/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ baseUrl: item.base_url, type: item.type }),
  });
  if (!response.ok) throw new Error(`Téléchargement Google Photos impossible (${response.status}).`);

  const blob = await response.blob();
  return new File([blob], item.name, { type: blob.type || item.mime_type || "application/octet-stream" });
}