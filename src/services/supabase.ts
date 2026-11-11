// src/services/supabase.ts

// ============================================================
// API CONFIGURATION
// ============================================================

export const API_BASE_URL = "https://stone-serv.onrender.com";

const API_REQUEST_TIMEOUT_MS = 30_000;

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
  if (storage) {
    try {
      const value = storage.getItem(key);
      if (value !== null) return value;
    } catch {
      // ignore
    }
  }

  try {
    const legacy = window.localStorage.getItem(key);
    if (legacy !== null) {
      // Migrate legacy tokens to session storage to reduce the blast radius of XSS.
      const session = getSafeStorage();
      if (session) {
        try {
          session.setItem(key, legacy);
        } catch {
          // ignore
        }
      }
      return legacy;
    }
  } catch {
    // ignore
  }

  return null;
}

function writeStoredValue(key: string, value: string): void {
  const storage = getSafeStorage();
  if (storage) {
    try {
      storage.setItem(key, value);
      return;
    } catch {
      // fall through to legacy storage if sessionStorage is unavailable
    }
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore if browser storage is unavailable
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
  operation: (signal: AbortSignal) => Promise<T>,
  externalSignal?: AbortSignal,
  timeoutMs = API_REQUEST_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(externalSignal?.reason);

  if (externalSignal?.aborted) {
    abortFromCaller();
  } else {
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const createTimeoutError = () => {
    const error = new Error("The server request timed out. Please try again.");
    error.name = "TimeoutError";
    return error;
  };

  try {
    const result = await operation(controller.signal);
    if (timedOut) throw createTimeoutError();
    return result;
  } catch (error) {
    if (timedOut) throw createTimeoutError();
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

// ============================================================
// STORAGE KEYS
// ============================================================

const ACCESS_TOKEN_KEY = "crossflow_access_token";
const REFRESH_TOKEN_KEY = "crossflow_refresh_token";
// sessionStorage : "connecté en AAL1, code 2FA pas encore saisi"
const MFA_PENDING_KEY = "crossflow_mfa_pending";
// sessionStorage : horodatage de la dernière vérification MFA réussie
const MFA_VERIFIED_KEY = "crossflow_mfa_verified_at";

// ============================================================
// TYPES
// ============================================================

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  bio?: string;
  email_confirmed_at?: string;
  created_at?: string;
  provider?: "email" | "google" | "github" | (string & {});
  identities?: { id?: string }[] | null;
  hasPassword?: boolean;
  mfa_enabled?: boolean;
}

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
}

export interface AuthResponse {
  user: UserProfile | null;
  session: AuthSession | null;
  mfa_enabled?: boolean;
  mfa_required?: boolean;
  aal?: string | null;
}

/** Méthode 2FA choisie par l'utilisateur : app d'authentification ou email. */
export type MfaMethod = "totp" | "email";

export type MfaStatus = {
  aal: string;
  next_aal: string;
  mfa_enabled: boolean;
  requires_challenge: boolean;
  /** Méthode active (null si la 2FA est désactivée). */
  method: MfaMethod | null;
  /** Email masqué (ex : j***@gmail.com), utile pour la méthode email. */
  email_hint: string | null;
  factors: Array<{
    id: string;
    type: string;
    friendly_name: string | null;
    created_at: string | null;
  }>;
};

export interface RecoveryParams {
  accessToken?: string;
  tokenHash?: string;
}

export type MfaFactor = {
  id: string;
  friendlyName?: string;
  status?: "verified" | "unverified";
  createdAt?: string | null;
};

/** Résultat de l'envoi d'un code par email. */
export type EmailCodeSent = { sentTo: string | null; resendIn: number };

type EmailPurpose = "login" | "enroll" | "challenge";

/**
 * Tag côté front : étiquette libre créée par l'utilisateur (aucun par défaut).
 * `label` + classe Tailwind ("bg-[#6366f1]").
 * Le backend utilise `name` + couleur hex ("#6366f1") : la conversion
 * est faite dans la section TAGS plus bas.
 */
export type Tag = { id: string; label: string; color: string };

/**
 * Groupe côté front : colonne du board (To Do, In Progress…).
 * Mêmes champs qu'un Tag, mais table et endpoints séparés (/api/groups).
 */
export type Group = { id: string; label: string; color: string };

/** Résultat de la consommation d'un retour OAuth (Google / GitHub). */
export type OAuthRedirectResult = "none" | "ready" | "mfa" | "error";

// ============================================================
// ERRORS
// ============================================================

export class MfaRequiredError extends Error {
  readonly code = "MFA_REQUIRED" as const;
  readonly status = 403 as const;

  constructor(message = "Two-factor verification required") {
    super(message);
    this.name = "MfaRequiredError";
  }
}

export function isMfaRequiredError(error: unknown): error is MfaRequiredError {
  return (
    error instanceof MfaRequiredError ||
    (error instanceof Error &&
      (error as { code?: string }).code === "MFA_REQUIRED")
  );
}

/** 429 : trop de tentatives. `retryAfterSeconds` vient du header Retry-After ou du body. */
export class RateLimitError extends Error {
  readonly code = "RATE_LIMITED" as const;
  readonly status = 429 as const;
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = "Too many attempts") {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/** Erreur générique enrichie (code backend + status HTTP + payload). */
type ApiErrorWithMeta = Error & {
  code?: string;
  status?: number;
  data?: unknown;
};

// ============================================================
// MFA PENDING (login en AAL1, challenge pas encore passé)
// ============================================================
//
// Tant que ce flag est actif, l'utilisateur n'est PAS considéré comme
// connecté : hasStoredSession() renvoie false et getCurrentUser() renvoie
// null. Les tokens AAL1 restent stockés uniquement pour permettre
// d'appeler les endpoints de vérification MFA.

/**
 * Mémoïsation de l'envoi d'email au login : évite deux emails quand React
 * StrictMode monte le composant deux fois. Remis à zéro dès que le flag
 * "MFA en attente" change.
 */
let loginEmailPromise: Promise<EmailCodeSent> | null = null;

export function isMfaPending(): boolean {
  try {
    return sessionStorage.getItem(MFA_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

function setMfaPending(value: boolean): void {
  loginEmailPromise = null;
  try {
    if (value) sessionStorage.setItem(MFA_PENDING_KEY, "1");
    else sessionStorage.removeItem(MFA_PENDING_KEY);
  } catch {
    /* stockage indisponible */
  }
}

// ============================================================
// TOKEN HELPERS
// ============================================================

export function getAccessToken(): string | null {
  return readStoredValue(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return readStoredValue(REFRESH_TOKEN_KEY);
}

export function hasStoredSession(): boolean {
  if (isMfaPending()) return false;
  return Boolean(getAccessToken() || getRefreshToken());
}

function saveSession(session: AuthSession | null): void {
  if (!session) return;

  if (session.access_token) {
    writeStoredValue(ACCESS_TOKEN_KEY, session.access_token);
  }

  if (session.refresh_token) {
    writeStoredValue(REFRESH_TOKEN_KEY, session.refresh_token);
  }
}

export function clearSession(): void {
  removeStoredValue(ACCESS_TOKEN_KEY);
  removeStoredValue(REFRESH_TOKEN_KEY);
  setMfaPending(false);
  try {
    sessionStorage.removeItem(MFA_VERIFIED_KEY);
  } catch {
    /* ignore if browser storage is unavailable */
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("stone:auth-expired"));
  }
}

function readTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const { exp } = JSON.parse(json) as { exp?: unknown };

    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

function isTokenExpiring(token: string, marginSeconds = 60): boolean {
  const exp = readTokenExpiry(token);
  if (exp === null) return false;
  return exp * 1000 - Date.now() < marginSeconds * 1000;
}

// ... rest of file unchanged
