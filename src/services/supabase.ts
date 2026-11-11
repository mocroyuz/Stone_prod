// src/services/supabase.ts

// ============================================================
// API CONFIGURATION
// ============================================================

// Même origine en production (réécriture Vercel) et en développement (proxy Vite).
export const API_BASE_URL = "";

const API_REQUEST_TIMEOUT_MS = 60_000;

function getSafeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readStoredValue(key: string): string | null {
  const storage = getSafeStorage();

  // Les jetons ne doivent jamais être lus depuis localStorage : si le
  // stockage de session est indisponible, on échoue fermé plutôt que de
  // réactiver une session persistante exposée aux attaques XSS.
  if (!storage) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore unavailable browser storage
    }
    return null;
  }

  try {
    const value = storage.getItem(key);
    if (value !== null) return value;
  } catch {
    return null;
  }

  // Migration unique des anciennes sessions. La copie persistante n'est
  // supprimée qu'après confirmation de l'écriture dans sessionStorage.
  try {
    const legacy = window.localStorage.getItem(key);
    if (legacy === null) return null;

    storage.setItem(key, legacy);
    window.localStorage.removeItem(key);
    return legacy;
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: string): void {
  const storage = getSafeStorage();
  if (!storage) {
    throw new Error("Le stockage de session est indisponible. Réessayez dans un navigateur autorisant les sessions.");
  }

  try {
    storage.setItem(key, value);
  } catch {
    throw new Error("Impossible d'enregistrer la session de façon sécurisée. Vérifiez les paramètres de stockage du navigateur.");
  }
}

function removeStoredValue(key: string): void {
  const storage = getSafeStorage();
  if (storage) {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

async function withRequestTimeout<T>(
