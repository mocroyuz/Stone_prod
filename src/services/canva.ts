// src/services/canva.ts
//
// Client front pour l'intégration Canva (Canva Connect API, via le serveur Stone).
// Flux : choisir une taille → le serveur crée un design vide chez Canva →
// on ouvre l'éditeur Canva → l'utilisateur termine → on exporte le design
// et on l'ajoute aux médias du post.

import { apiRequest } from "./supabase";

// ── Tailles Canva ────────────────────────────────────────────

export type CanvaSize = {
  id: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
  isDefault?: boolean;
};

export const CANVA_SIZES: CanvaSize[] = [
  {
    id: "story",
    label: "Story",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    isDefault: true,
  },
  {
    id: "square",
    label: "Square",
    ratio: "1:1",
    width: 1080,
    height: 1080,
  },
  {
    id: "portrait-4-5",
    label: "Portrait",
    ratio: "4:5",
    width: 1080,
    height: 1350,
  },
  {
    id: "portrait-3-4",
    label: "Portrait",
    ratio: "3:4",
    width: 1080,
    height: 1440,
  },
  {
    id: "landscape",
    label: "Landscape",
    ratio: "1.91:1",
    width: 1200,
    height: 627,
  },
];

// ── Accès à l'API Stone ──────────────────────────────────────

// VITE_API_BASE_URL peut finir par "/api" : on le retire,
// car les routes ajoutent elles-mêmes ce préfixe.
const rawBase = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""
).trim();

const API_ROOT = rawBase.replace(/\/+$/, "").replace(/\/api$/i, "");

// ── Erreurs Canva ────────────────────────────────────────────

export class CanvaError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "CanvaError";
    this.status = status;
    this.code = code;
  }

  /**
   * Le compte Canva n'est pas relié ou la session Canva a expiré.
   */
  get needsConnection(): boolean {
    return (
      this.code === "CANVA_NOT_CONNECTED" ||
      this.code === "CANVA_REFRESH_EXPIRED"
    );
  }
}

// ── Requête API ──────────────────────────────────────────────

/**
 * Utilise le même client API que TikTok pour l'authentification.
 *
 * apiRequest gère la requête HTTP et l'authentification Stone.
 * On conserve les erreurs Canva avec leur code et leur statut.
 */
async function request<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  try {
    const data = await apiRequest<T>(path, {
      method,
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    });

    // Certaines API renvoient success: false sans lever d'erreur HTTP.
    const result = data as {
      success?: boolean;
      error?: string;
      code?: string;
    };

    if (result?.success === false) {
      throw new CanvaError(
        result.error || "Canva request failed",
        400,
        result.code
      );
    }

    return data;
  } catch (error) {
    if (error instanceof CanvaError) {
      throw error;
    }

    // Préserve les erreurs HTTP et réseau du client partagé.
    throw error;
  }
}

// ── Compte Canva ─────────────────────────────────────────────

export type CanvaStatus = {
  connected: boolean;
  account: {
    display_name: string | null;
  } | null;
};

/**
 * Récupère l'état de la connexion Canva.
 */
export function getCanvaStatus(): Promise<CanvaStatus> {
  return request<CanvaStatus>("GET", "/api/canva/status");
}

export function openCanvaPopup(): Window | null {
  const width = 1000;
  const height = 760;
  const left = Math.max(0, Math.round((window.screen.width - width) / 2));
  const top = Math.max(0, Math.round((window.screen.height - height) / 2));

  return window.open(
    "about:blank",
    "_blank",
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`
  );
}

/**
 * Récupère l'URL d'autorisation Canva.
 */
export async function getCanvaAuthUrl(): Promise<string> {
  const data = await request<{ url: string }>(
    "POST",
    "/api/canva/auth/url"
  );

  if (!data?.url) {
    throw new CanvaError(
      "Le backend n'a pas renvoyé d'URL d'autorisation Canva.",
      502
    );
  }

  let authUrl: URL;
  try {
    authUrl = new URL(data.url);
  } catch {
    throw new CanvaError("Le backend a renvoyé une URL Canva invalide.", 502);
  }

  if (
    authUrl.protocol !== "https:" ||
    !(
      authUrl.hostname.toLowerCase() === "canva.com" ||
      authUrl.hostname.toLowerCase().endsWith(".canva.com")
    )
  ) {
    throw new CanvaError("Le backend a renvoyé une URL Canva inattendue.", 502);
  }

  return authUrl.toString();
}

/**
 * Appelé par la page /canva/callback avec les paramètres renvoyés par Canva.
 */
export function completeCanvaAuth(
  code: string,
  state: string
): Promise<{ connected: boolean }> {
  return request<{ connected: boolean }>(
    "POST",
    "/api/canva/auth/callback",
    {
      code,
      state,
    }
  );
}

/**
 * Déconnecte le compte Canva.
 */
export function disconnectCanva(): Promise<{ success: true }> {
  return request<{ success: true }>(
    "DELETE",
    "/api/canva/disconnect"
  );
}

/**
 * Attend que l'utilisateur termine l'autorisation dans la fenêtre popup.
 *
 * Renvoie true si le compte est connecté.
 * Renvoie false si la fenêtre est fermée sans connexion ou si le délai
 * est dépassé.
 */
export async function waitForCanvaConnection(
  popup: Window | null,
  timeoutMs = 3 * 60 * 1000
): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1500);
    });

    const closed = !popup || popup.closed;

    const status = await getCanvaStatus();

    if (status.connected) {
      return true;
    }

    if (closed) {
      return false;
    }
  }

  return false;
}

// ── Création de designs ─────────────────────────────────────

export type CanvaDesign = {
  designId: string;
  editUrl: string;
};

/**
 * Crée un design Canva avec les dimensions choisies.
 */
export async function createCanvaDesign(
  size: Pick<CanvaSize, "width" | "height" | "label" | "ratio">,
  title?: string
): Promise<CanvaDesign> {
  const data = await request<{
    design_id: string;
    edit_url: string;
  }>("POST", "/api/canva/designs", {
    width: size.width,
    height: size.height,
    title: title || `Stone ${size.label} ${size.ratio}`,
  });

  if (!data?.design_id || !data?.edit_url) {
    throw new CanvaError(
      "Le backend n'a pas renvoyé les informations du design Canva.",
      502
    );
  }

  return {
    designId: data.design_id,
    editUrl: data.edit_url,
  };
}

// ── Conversion Base64 → File ─────────────────────────────────

function base64ToFile(
  base64: string,
  mime: string,
  name: string
): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], name, { type: mime });
}

// ── Export Canva ─────────────────────────────────────────────

/**
 * Exporte le design Canva et renvoie les fichiers des pages exportées.
 */
export async function importCanvaDesign(
  designId: string,
  label = "canva-design"
): Promise<File[]> {
  const data = await request<{
    pages: {
      mime: string;
      data: string;
    }[];
  }>("POST", "/api/canva/export", {
    design_id: designId,
  });

  if (!Array.isArray(data?.pages)) {
    throw new CanvaError(
      "Le backend n'a pas renvoyé les pages exportées.",
      502
    );
  }

  const safe =
    label.replace(/[^\w.-]+/g, "-").slice(0, 60) || "canva-design";

  return data.pages.map((page, index) => {
    if (!page?.data || !page?.mime) {
      throw new CanvaError(
        `Données invalides pour la page Canva ${index + 1}.`,
        502
      );
    }

    const extension =
      page.mime === "image/jpeg"
        ? "jpg"
        : page.mime === "image/png"
          ? "png"
          : "bin";

    const suffix =
      data.pages.length > 1 ? `-${index + 1}` : "";

    return base64ToFile(
      page.data,
      page.mime,
      `${safe}${suffix}.${extension}`
    );
  });
}
