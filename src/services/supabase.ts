// src/services/supabase.ts

// ============================================================
// IMPORTS
// ============================================================

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";

// ============================================================
// API CONFIGURATION
// ============================================================

export const API_BASE_URL = "https://stone-serv.onrender.com";

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

export type MfaStatus = {
  aal: string;
  next_aal: string;
  mfa_enabled: boolean;
  requires_challenge: boolean;
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

export type RecoveryStatus = {
  remaining: number;
  generatedAt: string | null;
};

/** Passkey enregistrée côté backend (métadonnées uniquement). */
export type Passkey = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
};

/** Options WebAuthn renvoyées par le backend (JSON sérialisable). */
type WebAuthnOptions = Record<string, unknown>;

/**
 * Tag côté front : `label` + classe Tailwind ("bg-[#6366f1]").
 * Le backend utilise `name` + couleur hex ("#6366f1") : la conversion
 * est faite dans la section TAGS plus bas.
 */
export type Tag = { id: string; label: string; color: string };

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
// d'appeler /api/mfa/verify.

export function isMfaPending(): boolean {
  try {
    return sessionStorage.getItem(MFA_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

function setMfaPending(value: boolean): void {
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
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function hasStoredSession(): boolean {
  if (isMfaPending()) return false;
  return Boolean(getAccessToken() || getRefreshToken());
}

function saveSession(session: AuthSession | null): void {
  if (!session) return;

  if (session.access_token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
  }

  if (session.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
  }
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  setMfaPending(false);
  try {
    sessionStorage.removeItem(MFA_VERIFIED_KEY);
  } catch {
    /* ignore */
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

// ============================================================
// MFA SESSION GRACE
// ============================================================
//
// Après une vérification MFA réussie (TOTP ou passkey), on conserve la
// session AAL2 pendant une courte fenêtre. Sans ça, si le token est proche
// de l'expiration (< 60s), apiRequest déclenche un /api/auth/refresh
// qui rétrograde la session en AAL1 et fait échouer les endpoints
// requireAal2.

const MFA_GRACE_MS = 5 * 60_000;

function markMfaVerified(): void {
  try {
    sessionStorage.setItem(MFA_VERIFIED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function inMfaGrace(): boolean {
  try {
    const raw = sessionStorage.getItem(MFA_VERIFIED_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < MFA_GRACE_MS;
  } catch {
    return false;
  }
}

// ============================================================
// TOKEN REFRESH
// ============================================================

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          if (
            response.status === 400 ||
            response.status === 401 ||
            response.status === 403
          ) {
            clearSession();
          }
          return false;
        }

        const data = await response.json().catch(() => null);

        if (data?.session?.access_token) {
          saveSession(data.session);
          return true;
        }

        clearSession();
        return false;
      } catch (error) {
        console.error("Error refreshing session:", error);
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

// ============================================================
// API REQUEST
// ============================================================

const NO_REFRESH_ENDPOINTS = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const canRefresh =
    !NO_REFRESH_ENDPOINTS.some((path) => endpoint.startsWith(path)) &&
    Boolean(getRefreshToken());

  // Ne PAS rafraîchir pendant la grâce MFA, sinon retour en AAL1.
  if (canRefresh && !isRetry && !inMfaGrace()) {
    const current = getAccessToken();
    if (!current || isTokenExpiring(current)) {
      await refreshAccessToken();
    }
  }

  const token = getAccessToken();
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const bodyError =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : undefined;

    if (
      response.status === 403 &&
      typeof data === "object" &&
      data !== null &&
      "code" in data &&
      (data as { code?: unknown }).code === "MFA_REQUIRED"
    ) {
      throw new MfaRequiredError(bodyError);
    }

    if (response.status === 429) {
      const header = Number(response.headers.get("Retry-After"));
      const bodyRetry =
        typeof data === "object" && data !== null
          ? (data as { retryAfter?: unknown }).retryAfter
          : undefined;

      const seconds =
        Number.isFinite(header) && header > 0
          ? header
          : typeof bodyRetry === "number" && bodyRetry > 0
          ? bodyRetry
          : 60;

      throw new RateLimitError(Math.ceil(seconds), bodyError);
    }

    if (response.status === 401 && canRefresh && !isRetry) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return apiRequest<T>(endpoint, options, true);
    }

    // Erreur enrichie : conserve `code` (ex : TAG_DUPLICATE), `status` et `data`
    // pour permettre aux callers (cf. isDuplicateError) de discriminer.
    const err: ApiErrorWithMeta = new Error(
      bodyError ?? `Request failed with status ${response.status}`
    );
    err.status = response.status;
    err.data = data;
    if (
      typeof data === "object" &&
      data !== null &&
      "code" in data &&
      typeof (data as { code?: unknown }).code === "string"
    ) {
      err.code = (data as { code: string }).code;
    }
    throw err;
  }

  return data as T;
}

// ============================================================
// SIGN IN / SIGN UP
// ============================================================

/**
 * Si le compte a le 2FA, la session renvoyée est AAL1 : on la stocke
 * mais on marque "MFA en attente". L'appelant doit alors afficher l'écran
 * de code (voir LoginMfaChallenge) tant que `isMfaPending()` est vrai.
 */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  const result = await apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  saveSession(result.session);

  const needsChallenge =
    Boolean(result.mfa_required) ||
    (Boolean(result.mfa_enabled) && Boolean(result.aal) && result.aal !== "aal2");

  setMfaPending(needsChallenge);
  return result;
}

export async function signUp(
  email: string,
  password: string,
  firstName = "",
  lastName = ""
): Promise<AuthResponse> {
  const result = await apiRequest<AuthResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, firstName, lastName }),
  });
  saveSession(result.session);
  return result;
}

// ============================================================
// MFA STATUS (lecture AAL + facteurs vérifiés)
// ============================================================

export async function getMfaStatus(): Promise<MfaStatus | null> {
  try {
    const data = await apiRequest<{ success: boolean } & MfaStatus>(
      "/api/auth/mfa/status",
      { method: "GET" }
    );

    if (!data || !data.success) return null;

    return {
      aal: data.aal,
      next_aal: data.next_aal,
      mfa_enabled: data.mfa_enabled,
      requires_challenge: data.requires_challenge,
      factors: data.factors,
    };
  } catch (error) {
    console.error("Error fetching MFA status:", error);
    return null;
  }
}

/**
 * Resynchronise le flag "MFA en attente" avec le backend.
 * À appeler au démarrage de l'app et après un retour OAuth
 * (Google / GitHub ne passent pas par signIn).
 */
export async function refreshMfaPending(): Promise<boolean> {
  if (!getAccessToken() && !getRefreshToken()) {
    setMfaPending(false);
    return false;
  }

  const status = await getMfaStatus();
  if (!status) return isMfaPending();

  setMfaPending(status.requires_challenge);
  return status.requires_challenge;
}

/** true si la MFA est activée mais que la session courante est en AAL1. */
export async function needsMfaChallenge(): Promise<boolean> {
  return refreshMfaPending();
}

// ============================================================
// FORGOT / RESET PASSWORD
// ============================================================

export async function requestPasswordReset(email: string): Promise<string> {
  const result = await apiRequest<{ success: boolean; message?: string }>(
    "/api/auth/forgot-password",
    {
      method: "POST",
      body: JSON.stringify({ email: email.trim() }),
    }
  );

  return (
    result?.message ||
    "If an account exists for this email, a password reset link has been sent."
  );
}

function readUrlParam(key: string): string | null {
  if (typeof window === "undefined") return null;

  const raw = `${window.location.hash}&${window.location.search}`;
  const match = new RegExp(`[#?&]${key}=([^&#]*)`).exec(raw);
  if (!match) return null;

  try {
    return decodeURIComponent(match[1].replace(/\+/g, " "));
  } catch {
    return match[1];
  }
}

export function isRecoveryUrl(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.pathname.replace(/\/+$/, "") === "/reset-password") return true;
  if (window.location.hash.includes("reset-password")) return true;

  return (
    readUrlParam("type") === "recovery" &&
    Boolean(readUrlParam("access_token") || readUrlParam("token_hash"))
  );
}

export function readRecoveryParams(): RecoveryParams | null {
  const type = readUrlParam("type");
  if (type && type !== "recovery") return null;

  const accessToken = readUrlParam("access_token");
  const tokenHash = readUrlParam("token_hash");
  if (!accessToken && !tokenHash) return null;

  return {
    ...(accessToken ? { accessToken } : {}),
    ...(tokenHash ? { tokenHash } : {}),
  };
}

export function readRecoveryError(): string | null {
  const description = readUrlParam("error_description");
  const code = readUrlParam("error_code");

  if (!description && !code) return null;
  if (code === "otp_expired") {
    return "This reset link has expired or was already used. Request a new one.";
  }
  return description || "This reset link is invalid. Request a new one.";
}

export function clearRecoveryParamsFromUrl(): void {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", "/reset-password");
}

export async function resetPassword(
  newPassword: string,
  params: RecoveryParams
): Promise<string> {
  if (!params.accessToken && !params.tokenHash) {
    throw new Error("This reset link is invalid. Request a new one.");
  }

  const result = await apiRequest<{ success: boolean; message?: string }>(
    "/api/auth/reset-password",
    {
      method: "POST",
      body: JSON.stringify({
        password: newPassword,
        ...(params.tokenHash
          ? { token_hash: params.tokenHash }
          : { access_token: params.accessToken }),
      }),
    }
  );

  clearSession();

  return result?.message || "Password updated successfully. You can now sign in.";
}

// ============================================================
// OAUTH (Google / GitHub)
// ============================================================

export async function getGoogleAuthUrl(redirectTo?: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/auth/google/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirectTo: redirectTo || `${window.location.origin}/`,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success || !data?.url) {
    throw new Error(data?.error || "Could not start Google sign-in");
  }
  return data.url as string;
}

export async function signInWithGoogle(redirectTo?: string): Promise<void> {
  const url = await getGoogleAuthUrl(redirectTo);
  window.location.href = url;
}

export async function getGithubAuthUrl(redirectTo?: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/auth/github/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirectTo: redirectTo || `${window.location.origin}/`,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success || !data?.url) {
    throw new Error(data?.error || "Could not start GitHub sign-in");
  }
  return data.url as string;
}

export async function signInWithGithub(redirectTo?: string): Promise<void> {
  const url = await getGithubAuthUrl(redirectTo);
  window.location.href = url;
}

/**
 * Stocke la session OAuth, puis vérifie côté backend si un code 2FA
 * est requis. Renvoie true si l'écran de challenge doit s'afficher.
 */
export async function saveOAuthSession(
  accessToken: string,
  refreshToken: string
): Promise<boolean> {
  saveSession({ access_token: accessToken, refresh_token: refreshToken });
  // On bloque l'accès le temps de la vérification.
  setMfaPending(true);
  const pending = await refreshMfaPending();
  return pending;
}

// ============================================================
// EMAIL VERIFICATION
// ============================================================

export async function resendVerificationEmail(): Promise<boolean> {
  try {
    await apiRequest("/api/auth/resend-verification", { method: "POST" });
    return true;
  } catch (error) {
    console.error("Error resending verification email:", error);
    return false;
  }
}

// ============================================================
// UPDATE / SET PASSWORD (protégé par MFA_REQUIRED)
// ============================================================

export async function updatePassword(
  currentPassword: string | null,
  newPassword: string
): Promise<void> {
  const body: { currentPassword?: string; newPassword: string } = {
    newPassword,
  };
  if (currentPassword) body.currentPassword = currentPassword;

  await apiRequest("/api/user/password", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// ============================================================
// USER
// ============================================================

export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    if (!hasStoredSession()) return null;

    const response = await apiRequest<{
      success: boolean;
      user: Record<string, unknown>;
    }>("/api/user/profile", { method: "GET" });

    const u = response?.user;
    if (!response?.success || !u) return null;

    // Le backend renvoie parfois camelCase, parfois snake_case.
    const normalized: UserProfile = {
      id: String(u.id ?? ""),
      email: String(u.email ?? ""),
      first_name: (u.first_name as string) ?? (u.firstName as string) ?? "",
      last_name: (u.last_name as string) ?? (u.lastName as string) ?? "",
      avatar_url: (u.avatar_url as string) ?? (u.avatarUrl as string) ?? undefined,
      bio: (u.bio as string) ?? undefined,
      email_confirmed_at:
        (u.email_confirmed_at as string) ??
        (u.emailConfirmedAt as string) ??
        undefined,
      created_at:
        (u.created_at as string) ?? (u.createdAt as string) ?? undefined,
      provider: (u.provider as UserProfile["provider"]) ?? "email",
      hasPassword:
        (u.hasPassword as boolean) ??
        (u.has_password as boolean) ??
        true,
      mfa_enabled:
        (u.mfa_enabled as boolean) ??
        (u.mfaEnabled as boolean) ??
        false,
    };

    return normalized;
  } catch (error) {
    console.error("Error fetching current user:", error);
    return null;
  }
}

export async function updateUserProfile(
  profile: Partial<UserProfile>
): Promise<boolean> {
  try {
    const updateData: Record<string, string | null> = {};

    if (profile.first_name !== undefined) updateData.firstName = profile.first_name;
    if (profile.last_name !== undefined) updateData.lastName = profile.last_name;

    // "" → null pour vraiment effacer côté DB.
    if (profile.avatar_url !== undefined) {
      updateData.avatarUrl =
        profile.avatar_url === "" ? null : profile.avatar_url;
    }

    if (profile.bio !== undefined) updateData.bio = profile.bio;

    await apiRequest("/api/user/profile", {
      method: "PUT",
      body: JSON.stringify(updateData),
    });

    return true;
  } catch (error) {
    console.error("Error updating user profile:", error);
    return false;
  }
}

// ============================================================
// AVATAR
// ============================================================

export async function uploadAvatar(
  file: File,
  userId?: string
): Promise<string | null> {
  try {
    if (!file) {
      console.error("No avatar file provided.");
      return null;
    }

    if (!file.type.startsWith("image/")) {
      console.error("The selected file is not an image.");
      return null;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      console.error("Avatar is too large. Maximum size is 2 MB.");
      return null;
    }

    const formData = new FormData();
    formData.append("avatar", file);
    if (userId) formData.append("userId", userId);

    const data = await apiRequest<{
      success: boolean;
      avatar_url?: string;
      avatarUrl?: string;
      url?: string;
    }>("/api/user/avatar", { method: "POST", body: formData });

    const avatarUrl = data?.avatar_url || data?.avatarUrl || data?.url;
    if (typeof avatarUrl !== "string" || !avatarUrl) {
      console.error("Server did not return an avatar URL.");
      return null;
    }
    return avatarUrl;
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return null;
  }
}

export async function deleteAvatar(filePathOrUrl: string): Promise<boolean> {
  if (!filePathOrUrl) return false;

  try {
    await apiRequest("/api/user/avatar", {
      method: "DELETE",
      body: JSON.stringify({ filePathOrUrl }),
    });
    return true;
  } catch (error) {
    console.error("Error deleting avatar:", error);
    throw error instanceof Error
      ? error
      : new Error("Avatar deletion failed");
  }
}

// ============================================================
// SESSIONS
// ============================================================

/**
 * Déconnecte tous les autres appareils (la session courante est conservée).
 * Best-effort : à appeler après activation / désactivation du 2FA.
 */
export async function revokeOtherSessions(): Promise<boolean> {
  try {
    await apiRequest("/api/auth/sessions/revoke-others", { method: "POST" });
    return true;
  } catch (error) {
    console.warn("Could not revoke other sessions:", error);
    return false;
  }
}

// ============================================================
// SIGN OUT
// ============================================================

export async function signOut(): Promise<void> {
  try {
    if (getAccessToken()) {
      try {
        await apiRequest("/api/auth/logout", { method: "POST" });
      } catch {
        // ignore
      }
    }
  } finally {
    clearSession();
  }
}

// ============================================================
// API HEALTH
// ============================================================

export async function checkApiHealth(): Promise<boolean> {
  try {
    await apiRequest("/api/health", { method: "GET" });
    return true;
  } catch (error) {
    console.error("API health check failed:", error);
    return false;
  }
}

// ============================================================
// MFA (tout passe par le backend, aucune clé Supabase côté front)
// ============================================================

type RawFactor = {
  id: string;
  friendlyName?: string | null;
  friendly_name?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  status?: string;
};

/**
 * Liste les facteurs TOTP. Par défaut : vérifiés uniquement.
 * `includeUnverified` demande aussi les enrôlements abandonnés
 * (GET /api/mfa/factors?status=all).
 */
export async function listMfaFactors(
  options: { includeUnverified?: boolean } = {}
): Promise<MfaFactor[]> {
  const query = options.includeUnverified ? "?status=all" : "";

  const data = await apiRequest<{ success: boolean; factors: RawFactor[] }>(
    `/api/mfa/factors${query}`,
    { method: "GET" }
  );

  return (data.factors || []).map((f) => ({
    id: f.id,
    friendlyName: f.friendlyName ?? f.friendly_name ?? undefined,
    createdAt: f.createdAt ?? f.created_at ?? null,
    status: f.status === "unverified" ? "unverified" : "verified",
  }));
}

/** Supprime les enrôlements TOTP abandonnés (best-effort). */
export async function cleanupUnverifiedFactors(): Promise<void> {
  try {
    const all = await listMfaFactors({ includeUnverified: true });
    await Promise.allSettled(
      all
        .filter((f) => f.status === "unverified")
        .map((f) => cancelMfaEnrollment(f.id))
    );
  } catch (error) {
    console.warn("Could not clean up unverified factors:", error);
  }
}

/** Étape 1 : démarre un enrôlement TOTP (QR + secret). */
export async function startMfaEnrollment(): Promise<{
  factorId: string;
  qrCode: string;
  secret: string;
}> {
  // Évite les erreurs "nom déjà pris" / limite de facteurs après un abandon.
  await cleanupUnverifiedFactors();

  const raw = await apiRequest<Record<string, unknown>>("/api/mfa/enroll", {
    method: "POST",
  });

  // Parsing défensif : accepte plusieurs formes de réponse.
  const data = (raw as { data?: Record<string, unknown> }).data ?? raw;
  const totp = (data as { totp?: Record<string, unknown> }).totp ?? {};
  const factor = (data as { factor?: Record<string, unknown> }).factor ?? {};

  const factorId =
    (raw as any).factorId ??
    (raw as any).factor_id ??
    (raw as any).id ??
    (factor as any).id ??
    (data as any).factorId ??
    (data as any).factor_id;

  const qrCode =
    (raw as any).qrCode ??
    (raw as any).qr_code ??
    (raw as any).qr ??
    (data as any).qrCode ??
    (data as any).qr_code ??
    (data as any).qr;

  const secret =
    (raw as any).secret ??
    (totp as any).secret ??
    (data as any).secret;

  if (!factorId || !qrCode || !secret) {
    throw new Error("Invalid MFA enrollment response from server.");
  }

  return { factorId: String(factorId), qrCode: String(qrCode), secret: String(secret) };
}

/**
 * Étape 2 : vérifie le premier code. La session renvoyée (AAL2) est
 * stockée localement, ce qui permet ensuite de générer les codes de secours.
 */
export async function confirmMfaEnrollment(
  factorId: string,
  code: string
): Promise<void> {
  const data = await apiRequest<{
    success: boolean;
    session: AuthSession | null;
  }>("/api/mfa/enroll/verify", {
    method: "POST",
    body: JSON.stringify({ factorId, code }),
  });

  if (!data?.session?.access_token) {
    throw new Error(
      "MFA enrollment succeeded but the backend did not return an AAL2 session."
    );
  }

  saveSession(data.session);
  markMfaVerified();
}

/** Annule un enrôlement non vérifié (aucune AAL2 requise). */
export async function cancelMfaEnrollment(factorId: string): Promise<void> {
  await apiRequest(
    `/api/mfa/factors?factorId=${encodeURIComponent(factorId)}`,
    { method: "DELETE" }
  );
}

/**
 * Désactive un facteur vérifié. Requiert une session AAL2 : appeler
 * verifyMfaFactorCode / verifyRecoveryCode / verifyWithPasskey avant,
 * ou passer par le garde MFA de l'UI (MfaRequiredError → modale).
 */
export async function disableMfa(factorId: string): Promise<void> {
  await apiRequest(
    `/api/mfa/factors?factorId=${encodeURIComponent(factorId)}`,
    { method: "DELETE" }
  );
}

/**
 * Vérifie un code TOTP pour un facteur précis et élève la session en
 * AAL2 (stockage local + grâce). Lève RateLimitError sur 429.
 * Sert au login, au challenge avant action sensible et à la désactivation.
 */
export async function verifyMfaFactorCode(
  factorId: string,
  code: string
): Promise<void> {
  const data = await apiRequest<{
    success: boolean;
    session: AuthSession | null;
  }>("/api/mfa/verify", {
    method: "POST",
    body: JSON.stringify({ factorId, code }),
  });

  if (!data?.session?.access_token) {
    throw new Error(
      "MFA verification succeeded but the backend did not return an AAL2 session."
    );
  }

  saveSession(data.session);
  markMfaVerified();
  setMfaPending(false);
}

/** Vérifie un code TOTP juste après le login (facteur = premier vérifié par défaut). */
export async function verifyMfaLogin(
  code: string,
  factorId?: string
): Promise<void> {
  let id = factorId;

  if (!id) {
    const factors = await listMfaFactors();
    id = factors[0]?.id;
  }

  if (!id) throw new Error("No authenticator found for this account.");

  await verifyMfaFactorCode(id, code);
}

// ============================================================
// RECOVERY CODES (codes de secours)
// ============================================================
//
// Contrat backend attendu :
//
//   GET  /api/mfa/recovery-codes          → { success, remaining, generatedAt }
//   POST /api/mfa/recovery-codes          → { success, codes: string[] }   (requireAal2)
//   POST /api/mfa/recovery-codes/verify   → { success, session, remaining } (rate-limité, élève en AAL2)

/** Nombre de codes restants + date de génération. null si indisponible. */
export async function getRecoveryCodesStatus(): Promise<RecoveryStatus | null> {
  try {
    const data = await apiRequest<{
      success: boolean;
      remaining?: number;
      generatedAt?: string | null;
      generated_at?: string | null;
    }>("/api/mfa/recovery-codes", { method: "GET" });

    if (!data?.success) return null;

    return {
      remaining: data.remaining ?? 0,
      generatedAt: data.generatedAt ?? data.generated_at ?? null,
    };
  } catch (error) {
    console.error("Error fetching recovery codes status:", error);
    return null;
  }
}

/**
 * Génère (ou régénère) les codes de secours. Les anciens deviennent
 * invalides. Requiert AAL2 : peut lever MfaRequiredError.
 * Les codes ne sont renvoyés qu'une seule fois.
 */
export async function generateRecoveryCodes(): Promise<string[]> {
  const data = await apiRequest<{ success: boolean; codes?: string[] }>(
    "/api/mfa/recovery-codes",
    { method: "POST" }
  );

  if (!data?.codes?.length) {
    throw new Error("The server did not return any recovery codes.");
  }

  return data.codes;
}

/**
 * Utilise un code de secours à la place d'un code TOTP.
 * Le backend consomme le code et renvoie une session AAL2.
 */
export async function verifyRecoveryCode(
  code: string
): Promise<{ remaining: number }> {
  const data = await apiRequest<{
    success: boolean;
    session: AuthSession | null;
    remaining?: number;
  }>("/api/mfa/recovery-codes/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

  if (!data?.session?.access_token) {
    throw new Error(
      "Recovery code accepted but the backend did not return a session."
    );
  }

  saveSession(data.session);
  markMfaVerified();
  setMfaPending(false);

  return { remaining: data.remaining ?? 0 };
}

// ============================================================
// PASSKEYS (WebAuthn)
// ============================================================
//
// Contrat backend attendu :
//
//   GET    /api/mfa/passkeys                          → { passkeys: Passkey[] }
//   POST   /api/mfa/passkeys/register/options         → { options }
//   POST   /api/mfa/passkeys/register/verify          → { success, passkey? }       (requireAal2)
//   POST   /api/mfa/passkeys/authenticate/options     → { options }
//   POST   /api/mfa/passkeys/authenticate/verify      → { success, session }        (élève en AAL2)
//   DELETE /api/mfa/passkeys?id=...                   → { success }                 (requireAal2)
//
// Le navigateur exécute la cérémonie WebAuthn via @simplewebauthn/browser ;
// le backend fait office de Relying Party.

/** true si le navigateur supporte WebAuthn (à utiliser pour masquer l'option). */
export function isWebAuthnSupported(): boolean {
  try {
    return browserSupportsWebAuthn();
  } catch {
    return false;
  }
}

/**
 * Liste les passkeys enregistrées pour l'utilisateur courant.
 * Ne contient que les métadonnées (nom, dates) — jamais la clé publique.
 */
export async function listPasskeys(): Promise<Passkey[]> {
  const data = await apiRequest<{ success?: boolean; passkeys?: Passkey[] }>(
    "/api/mfa/passkeys",
    { method: "GET" }
  );
  return data?.passkeys ?? [];
}

/**
 * Enregistre une nouvelle passkey (authenticator biométrique, clé
 * matérielle, etc.). Requiert AAL2 : peut lever MfaRequiredError.
 *
 * `attachment` :
 *   - "platform"       → authenticator intégré (Touch ID, Windows Hello…)
 *   - "cross-platform" → clé externe (YubiKey…)
 *   - undefined        → laisser l'utilisateur / le navigateur choisir
 *
 * Renvoie la passkey créée si le backend la retourne, sinon null
 * (utiliser listPasskeys() pour rafraîchir).
 */
export async function registerPasskey(
  name: string,
  attachment?: "platform" | "cross-platform"
): Promise<Passkey | null> {
  if (!isWebAuthnSupported()) {
    throw new Error("WebAuthn is not supported by this browser.");
  }

  // 1. Options depuis le backend.
  const optRes = await apiRequest<{ success?: boolean; options: WebAuthnOptions }>(
    "/api/mfa/passkeys/register/options",
    {
      method: "POST",
      body: JSON.stringify(attachment ? { attachment } : {}),
    }
  );

  if (!optRes?.options) {
    throw new Error("The server did not return registration options.");
  }

  // 2. Cérémonie côté navigateur (peut throw si l'utilisateur annule).
  const attestation = await startRegistration({ optionsJSON: optRes.options });

  // 3. Vérification côté backend + enregistrement du credential.
  const verifyRes = await apiRequest<{
    success: boolean;
    passkey?: Passkey;
    error?: string;
  }>("/api/mfa/passkeys/register/verify", {
    method: "POST",
    body: JSON.stringify({ response: attestation, name }),
  });

  return verifyRes?.passkey ?? null;
}

/**
 * Authentifie via une passkey existante et élève la session en AAL2.
 *
 * Usages :
 *   - Login : après signIn() si mfa_pending est vrai, on peut proposer
 *     "Utiliser une passkey" — l'AAL2 est alors obtenu sans TOTP.
 *   - Challenge avant action sensible : au lieu de saisir un code TOTP.
 *
 * Peut throw MfaRequiredError (si le backend exige AAL2 avant même
 * de démarrer — peu probable ici), RateLimitError, ou une erreur
 * WebAuthn standard (NotAllowedError si l'utilisateur annule).
 */
export async function verifyWithPasskey(): Promise<void> {
  if (!isWebAuthnSupported()) {
    throw new Error("WebAuthn is not supported by this browser.");
  }

  // 1. Options depuis le backend.
  const optRes = await apiRequest<{ success?: boolean; options: WebAuthnOptions }>(
    "/api/mfa/passkeys/authenticate/options",
    { method: "POST", body: JSON.stringify({}) }
  );

  if (!optRes?.options) {
    throw new Error("The server did not return authentication options.");
  }

  // 2. Cérémonie côté navigateur.
  const assertion = await startAuthentication({ optionsJSON: optRes.options });

  // 3. Vérification côté backend + session AAL2.
  const verifyRes = await apiRequest<{
    success: boolean;
    session: AuthSession | null;
    error?: string;
  }>("/api/mfa/passkeys/authenticate/verify", {
    method: "POST",
    body: JSON.stringify({ response: assertion }),
  });

  if (!verifyRes?.session?.access_token) {
    throw new Error(
      "Passkey verification succeeded but the backend did not return an AAL2 session."
    );
  }

  saveSession(verifyRes.session);
  markMfaVerified();
  setMfaPending(false);
}

/**
 * Supprime une passkey. Requiert AAL2 : peut lever MfaRequiredError.
 * Penser à revokeOtherSessions() après une suppression si c'est la
 * dernière méthode MFA (pour forcer la reconnexion ailleurs).
 */
export async function deletePasskey(id: string): Promise<void> {
  if (!id) {
    throw new Error("Passkey id is required.");
  }
  await apiRequest(
    `/api/mfa/passkeys?id=${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

// ============================================================
// TAGS
// ============================================================
//
// `user_id` n'est JAMAIS envoyé : il est géré côté backend.
//
// Contrat backend (server.js) :
//
//   GET    /api/tags            → { success, tags: [{ id, name, color }] }
//   POST   /api/tags            → { success, tag }   body: { name, color }
//   PUT    /api/tags            → { success, tag }   body: { id, name, color }
//   DELETE /api/tags?id=<id>    → { success }
//
// Le front manipule `label` + une classe Tailwind ("bg-[#6366f1]") ;
// le backend manipule `name` + une couleur hex ("#6366f1").
// Les conversions sont faites ici, donc l'UI (Settings.tsx) ne change pas.
//
// Conflit d'unicité : le backend renvoie HTTP 409 + code "TAG_DUPLICATE"
// (cf. `isDuplicateError`).

const DEFAULT_TAG_CLASS = "bg-[#6366f1]";

/** Forme d'un tag telle que renvoyée par le backend. */
type ServerTag = {
  id: string;
  name: string;
  color?: string | null;
};

/** "bg-[#6366f1]" → "#6366f1" (null si aucune couleur hex trouvée). */
const tagColorToHex = (value: string): string | null =>
  value?.match(/#[0-9a-f]{6}/i)?.[0].toLowerCase() ?? null;

/** "#6366f1" → "bg-[#6366f1]" (classe par défaut si invalide). */
const tagColorToClass = (hex?: string | null): string =>
  hex && /^#[0-9a-f]{6}$/i.test(hex)
    ? `bg-[${hex.toLowerCase()}]`
    : DEFAULT_TAG_CLASS;

/** Tag backend → Tag front. */
const fromServerTag = (t: ServerTag): Tag => ({
  id: t.id,
  label: t.name,
  color: tagColorToClass(t.color),
});

/** Extrait un Tag d'une réponse `{ tag }` (ou d'un tag brut). */
function parseTagResponse(data: unknown): Tag {
  const raw = (data as { tag?: ServerTag })?.tag ?? (data as ServerTag);

  if (!raw || typeof raw.id !== "string" || typeof raw.name !== "string") {
    throw new Error("Invalid tag response from server.");
  }

  return fromServerTag(raw);
}

/** Liste les tags de l'utilisateur courant (triés par nom côté backend). */
export async function listTags(): Promise<Tag[]> {
  const data = await apiRequest<{ success?: boolean; tags?: ServerTag[] }>(
    "/api/tags",
    { method: "GET" }
  );

  return (data?.tags ?? []).map(fromServerTag);
}

/**
 * Crée un tag.
 * Peut throw une erreur reconnue par `isDuplicateError` si le nom existe déjà.
 */
export async function createTag(label: string, color: string): Promise<Tag> {
  const data = await apiRequest<unknown>("/api/tags", {
    method: "POST",
    body: JSON.stringify({ name: label, color: tagColorToHex(color) }),
  });

  return parseTagResponse(data);
}

/**
 * Met à jour un tag existant. Le backend lit `id` dans le BODY
 * (sans `id`, il créerait un nouveau tag).
 * Peut throw une erreur reconnue par `isDuplicateError`.
 */
export async function updateTag(
  id: string,
  patch: { label: string; color: string }
): Promise<Tag> {
  const data = await apiRequest<unknown>("/api/tags", {
    method: "PUT",
    body: JSON.stringify({
      id,
      name: patch.label,
      color: tagColorToHex(patch.color),
    }),
  });

  return parseTagResponse(data);
}

/** Supprime un tag. */
export async function deleteTag(id: string): Promise<void> {
  await apiRequest(`/api/tags?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/**
 * Détecte une violation d'unicité côté backend.
 * Reconnaît :
 *   - code "TAG_DUPLICATE" (backend) ou "23505" (unique_violation Postgres)
 *   - status HTTP 409 (Conflict)
 *   - message contenant duplicate / already exists / unique
 */
export const isDuplicateError = (e: unknown): boolean => {
  if (typeof e === "object" && e !== null) {
    const obj = e as { code?: unknown; status?: unknown };
    if (obj.code === "TAG_DUPLICATE" || obj.code === "23505") return true;
    if (obj.status === 409) return true;
  }

  return (
    e instanceof Error &&
    /duplicate|already exists|unique/i.test(e.message)
  );
};