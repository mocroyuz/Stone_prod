// src/services/supabase.ts

import { createClient } from "@supabase/supabase-js";

// ============================================================
// API CONFIGURATION
// ============================================================

const API_BASE_URL = "https://stoneserv-production.up.railway.app";

// ============================================================
// STORAGE KEYS
// ============================================================

const ACCESS_TOKEN_KEY = "crossflow_access_token";
const REFRESH_TOKEN_KEY = "crossflow_refresh_token";

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

// ============================================================
// MFA REQUIRED ERROR
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

  if (canRefresh && !isRetry) {
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
    if (
      response.status === 403 &&
      typeof data === "object" &&
      data !== null &&
      "code" in data &&
      (data as { code?: unknown }).code === "MFA_REQUIRED"
    ) {
      const msg =
        "error" in data &&
        typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : undefined;

      throw new MfaRequiredError(msg);
    }

    if (response.status === 401 && canRefresh && !isRetry) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiRequest<T>(endpoint, options, true);
      }
    }

    const errorMessage =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed with status ${response.status}`;

    throw new Error(errorMessage);
  }

  return data as T;
}

// ============================================================
// SIGN IN / SIGN UP
// ============================================================

export async function signIn(
  email: string,
  password: string
): Promise<AuthResponse> {
  const result = await apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  saveSession(result.session);
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
// MFA STATUS (backend)
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

// ============================================================
// FORGOT PASSWORD
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

// ============================================================
// RESET PASSWORD
// ============================================================

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

  return (
    result?.message || "Password updated successfully. You can now sign in."
  );
}

// ============================================================
// GOOGLE / GITHUB OAUTH
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

export function saveOAuthSession(accessToken: string, refreshToken: string): void {
  saveSession({ access_token: accessToken, refresh_token: refreshToken });
}

// ============================================================
// RESEND VERIFICATION EMAIL
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
// UPDATE / SET PASSWORD
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
// GET CURRENT USER
// ============================================================

export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    if (!hasStoredSession()) return null;

    const response = await apiRequest<{
      success: boolean;
      user: UserProfile;
    }>("/api/user/profile", { method: "GET" });

    if (response && response.success && response.user) return response.user;
    return null;
  } catch (error) {
    console.error("Error fetching current user:", error);
    return null;
  }
}

// ============================================================
// UPDATE USER PROFILE
// ============================================================

export async function updateUserProfile(
  profile: Partial<UserProfile>
): Promise<boolean> {
  try {
    const updateData: Record<string, string> = {};

    if (profile.first_name !== undefined) updateData.firstName = profile.first_name;
    if (profile.last_name !== undefined) updateData.lastName = profile.last_name;
    if (profile.avatar_url !== undefined) updateData.avatarUrl = profile.avatar_url;
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
// UPLOAD / DELETE AVATAR
// ============================================================

export async function uploadAvatar(
  file: File,
  _userId?: string
): Promise<string | null> {
  try {
    if (!file) { console.error("No avatar file provided."); return null; }
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

    const data = await apiRequest<{
      success: boolean;
      avatar_url?: string;
      avatarUrl?: string;
    }>("/api/user/avatar", { method: "POST", body: formData });

    const avatarUrl = data?.avatar_url || data?.avatarUrl;
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
  try {
    if (!filePathOrUrl) return false;
    await apiRequest("/api/user/avatar", {
      method: "DELETE",
      body: JSON.stringify({ filePathOrUrl }),
    });
    return true;
  } catch (error) {
    console.error("Error deleting avatar:", error);
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
// SUPABASE AUTH CLIENT (MFA + passkeys uniquement)
// ============================================================
//
// URL + clé publishable : publiques par conception (Supabase Dashboard →
// Settings → API). ⚠️ Ne JAMAIS mettre la clé service_role ici.
//
// Lu depuis les variables d'environnement Vite (inlinées au build) :
//   VITE_SUPABASE_URL           (obligatoire)
//   VITE_SUPABASE_ANON_KEY      (obligatoire — nom historique)
//   VITE_SUPABASE_PUBLISHABLE_KEY (alternative, nouveau nom Supabase)
//
// Sur Vercel : Settings → Environment Variables, puis REDÉPLOYER.
// Les valeurs doivent être les mêmes que côté backend (SUPABASE_URL /
// SUPABASE_ANON_KEY sur Railway).

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || "";

const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
  "";

const SUPABASE_CONFIGURED = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
);

if (!SUPABASE_CONFIGURED) {
  // Message visible dans la console du navigateur ET dans les logs de build.
  console.warn(
    "[supabase] VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY ne sont pas définis — " +
      "la MFA (TOTP) et les passkeys sont désactivés sur ce déploiement. " +
      "Configure ces variables sur Vercel (Settings → Environment Variables) puis redéploie."
  );
}

const authClient = SUPABASE_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        experimental: { passkey: true },
      },
    })
  : null;

/** true si VITE_SUPABASE_URL et la clé publishable sont définis au build. */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_CONFIGURED;
}

/**
 * Retourne le client Supabase ou throw une erreur lisible.
 * Évite les `fetch` vers un domaine placeholder (ERR_NAME_NOT_RESOLVED).
 */
function requireAuthClient() {
  if (!authClient) {
    throw new Error(
      "Supabase n'est pas configuré sur ce déploiement " +
        "(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants). " +
        "Contacte l'administrateur ou configure ces variables d'environnement."
    );
  }
  return authClient;
}

async function syncAuthClient(): Promise<void> {
  const client = requireAuthClient();

  let access = getAccessToken();

  if (!access || isTokenExpiring(access)) {
    await refreshAccessToken();
    access = getAccessToken();
  }

  const refresh = getRefreshToken();

  if (!access || !refresh) {
    throw new Error("You are signed out. Sign in again.");
  }

  const { error } = await client.auth.setSession({
    access_token: access,
    refresh_token: refresh,
  });

  if (error) throw error;
}

async function persistAuthClientSession(): Promise<void> {
  const client = requireAuthClient();
  const { data } = await client.auth.getSession();

  if (data.session) {
    saveSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }
}

// ============================================================
// MFA : APPLICATION D'AUTHENTIFICATION (TOTP)
// ============================================================

export type MfaFactor = {
  id: string;
  friendlyName?: string;
  createdAt: string;
};

export async function listMfaFactors(): Promise<MfaFactor[]> {
  await syncAuthClient();
  const client = requireAuthClient();

  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw error;

  return (data.totp ?? []).map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? undefined,
    createdAt: f.created_at,
  }));
}

export async function startMfaEnrollment(): Promise<{
  factorId: string;
  qrCode: string;
  secret: string;
}> {
  await syncAuthClient();
  const client = requireAuthClient();

  // Purge les inscriptions abandonnées (non vérifiées).
  const { data: list } = await client.auth.mfa.listFactors();
  const stale = (list?.all ?? []).filter(
    (f) => f.factor_type === "totp" && f.status === "unverified"
  );
  for (const f of stale) {
    await client.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${Date.now()}`,
  });
  if (error) throw error;

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function confirmMfaEnrollment(factorId: string, code: string) {
  await syncAuthClient();
  const client = requireAuthClient();

  const { error } = await client.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  if (error) throw error;

  await persistAuthClientSession();
}

export async function cancelMfaEnrollment(factorId: string) {
  await syncAuthClient();
  const client = requireAuthClient();
  await client.auth.mfa.unenroll({ factorId });
}

export async function disableMfa(factorId: string) {
  await syncAuthClient();
  const client = requireAuthClient();

  const { error } = await client.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

export async function verifyMfaFactorCode(
  factorId: string,
  code: string
): Promise<void> {
  await syncAuthClient();
  const client = requireAuthClient();

  const { error } = await client.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  if (error) throw error;

  await persistAuthClientSession();
}

export async function needsMfaChallenge(): Promise<boolean> {
  await syncAuthClient();
  const client = requireAuthClient();

  const { data, error } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;

  return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

export async function verifyMfaLogin(code: string): Promise<void> {
  await syncAuthClient();
  const client = requireAuthClient();

  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw error;

  const factor = data.totp[0];
  if (!factor) throw new Error("No authenticator found");

  const { error: verifyError } = await client.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  });
  if (verifyError) throw verifyError;

  await persistAuthClientSession();
}

// ============================================================
// PASSKEYS
// ============================================================

export type Passkey = {
  id: string;
  friendlyName?: string;
  createdAt: string;
};

export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}

export async function listPasskeys(): Promise<Passkey[]> {
  await syncAuthClient();
  const client = requireAuthClient();

  const { data, error } = await client.auth.passkey.list();
  if (error) throw error;

  return (data ?? []).map((p: any) => ({
    id: p.id,
    friendlyName: p.friendly_name ?? p.friendlyName ?? undefined,
    createdAt: p.created_at ?? p.createdAt,
  }));
}

export async function registerPasskey(): Promise<void> {
  await syncAuthClient();
  const client = requireAuthClient();

  const { error } = await client.auth.registerPasskey();
  if (error) throw error;
}

export async function renamePasskey(passkeyId: string, friendlyName: string) {
  await syncAuthClient();
  const client = requireAuthClient();

  const { error } = await client.auth.passkey.update({
    passkeyId,
    friendlyName,
  });
  if (error) throw error;
}

export async function deletePasskey(passkeyId: string): Promise<void> {
  await syncAuthClient();
  const client = requireAuthClient();

  const { error } = await client.auth.passkey.delete({ passkeyId });
  if (error) throw error;
}

export async function signInWithPasskey(): Promise<void> {
  const client = requireAuthClient();
  const { data, error } = await client.auth.signInWithPasskey();
  if (error) throw error;

  if (!data?.session) throw new Error("Passkey sign-in failed");

  saveSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}