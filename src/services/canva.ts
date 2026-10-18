// src/services/canva.ts
//
// Client front pour l'intégration Canva (Canva Connect API, via le serveur Stone).
// Flux : choisir une taille → le serveur crée un design vide chez Canva → on ouvre
// l'éditeur Canva dans un nouvel onglet → l'utilisateur termine → on exporte le
// design en PNG et on l'ajoute aux médias du post.

export type CanvaSize = {
  id: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
  isDefault?: boolean;
};

export const CANVA_SIZES: CanvaSize[] = [
  { id: "story", label: "Story", ratio: "9:16", width: 1080, height: 1920, isDefault: true },
  { id: "square", label: "Square", ratio: "1:1", width: 1080, height: 1080 },
  { id: "portrait-4-5", label: "Portrait", ratio: "4:5", width: 1080, height: 1350 },
  { id: "portrait-3-4", label: "Portrait", ratio: "3:4", width: 1080, height: 1440 },
  { id: "landscape", label: "Landscape", ratio: "1.91:1", width: 1200, height: 627 },
];

/* ── Accès à l'API Stone ── */

// VITE_API_BASE_URL peut finir par "/api" : on le retire, les routes l'ajoutent.
const rawBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "").trim();
const API_ROOT = rawBase.replace(/\/+$/, "").replace(/\/api$/i, "");

// TODO : branche ici la MÊME logique que dans services/tiktok.ts pour récupérer
// le jeton de session Stone (Supabase). Ex. :
//   const { data } = await supabase.auth.getSession();
//   return data.session?.access_token ?? "";
async function getAccessToken(): Promise<string> {
  throw new Error("getAccessToken() n'est pas branché : copie celui de services/tiktok.ts");
}

export class CanvaError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "CanvaError";
    this.status = status;
    this.code = code;
  }

  /** Le compte Canva n'est pas relié (ou la session Canva a expiré). */
  get needsConnection(): boolean {
    return this.code === "CANVA_NOT_CONNECTED" || this.code === "CANVA_REFRESH_EXPIRED";
  }
}

async function request<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success === false) {
    throw new CanvaError(
      data?.error || `Canva request failed (HTTP ${response.status})`,
      response.status,
      data?.code
    );
  }

  return data as T;
}

/* ── Compte ── */

export type CanvaStatus = {
  connected: boolean;
  account: { display_name: string | null } | null;
};

export function getCanvaStatus(): Promise<CanvaStatus> {
  return request<CanvaStatus>("GET", "/api/canva/status");
}

export async function getCanvaAuthUrl(): Promise<string> {
  const data = await request<{ url: string }>("POST", "/api/canva/auth/url");
  return data.url;
}

/** Appelé par la page /canva/callback avec les paramètres renvoyés par Canva. */
export function completeCanvaAuth(code: string, state: string) {
  return request<{ connected: boolean }>("POST", "/api/canva/auth/callback", {
    code,
    state,
  });
}

export function disconnectCanva() {
  return request<{ success: true }>("DELETE", "/api/canva/disconnect");
}

/**
 * Attend que l'utilisateur ait terminé l'autorisation dans la fenêtre `popup`.
 * Renvoie true dès que le compte est relié, false si la fenêtre est fermée
 * sans connexion ou si le délai est dépassé.
 */
export async function waitForCanvaConnection(
  popup: Window | null,
  timeoutMs = 3 * 60 * 1000
): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const closed = !popup || popup.closed;

    try {
      const status = await getCanvaStatus();
      if (status.connected) return true;
    } catch {
      // erreur réseau passagère : on réessaie
    }

    if (closed) return false;
  }

  return false;
}

/* ── Designs ── */

export type CanvaDesign = {
  designId: string;
  editUrl: string;
};

export async function createCanvaDesign(
  size: Pick<CanvaSize, "width" | "height" | "label" | "ratio">,
  title?: string
): Promise<CanvaDesign> {
  const data = await request<{ design_id: string; edit_url: string }>(
    "POST",
    "/api/canva/designs",
    {
      width: size.width,
      height: size.height,
      title: title || `Stone ${size.label} ${size.ratio}`,
    }
  );

  return { designId: data.design_id, editUrl: data.edit_url };
}

function base64ToFile(base64: string, mime: string, name: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

/** Exporte le design en PNG (une image par page) et renvoie des File prêts à l'emploi. */
export async function importCanvaDesign(
  designId: string,
  label = "canva-design"
): Promise<File[]> {
  const data = await request<{ pages: { mime: string; data: string }[] }>(
    "POST",
    "/api/canva/export",
    { design_id: designId }
  );

  const safe = label.replace(/[^\w.-]+/g, "-").slice(0, 60) || "canva-design";

  return data.pages.map((page, index) =>
    base64ToFile(
      page.data,
      page.mime,
      `${safe}${data.pages.length > 1 ? `-${index + 1}` : ""}.${
        page.mime === "image/jpeg" ? "jpg" : "png"
      }`
    )
  );
}