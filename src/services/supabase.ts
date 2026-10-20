// src/services/supabase.ts

import { createClient } from "@supabase/supabase-js";

// ============================================================
// API CONFIGURATION
// ============================================================
//
// URL publique du backend déployé sur Railway.
// Aucune variable d'environnement frontend n'est utilisée.

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

  /** Provider principal du compte : "email", "google", "github"… */
  provider?: "email" | "google" | "github" | (string & {});

  /**
   * true si le compte possède une identité "email" avec un mot de passe.
   * false pour un compte 100 % OAuth (Google / GitHub) : dans ce cas
   * l'utilisateur peut DÉFINIR un mot de passe sans donner l'actuel.
   */
  hasPassword?: boolean;
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
}

/** Jetons de récupération lus dans l'URL du lien « mot de passe oublié ». */
export interface RecoveryParams {
  /** Flux « implicit » : #access_token=... (défaut de Supabase). */
  accessToken?: string;
  /** Flux « token_hash » : ?token_hash=... (si le template d'email l'utilise). */
  tokenHash?: string;
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

/** true si une session est stockée (sans vérifier qu'elle est encore valide). */
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

/** Lit la date d'expiration (en secondes) d'un JWT, ou null si illisible. */
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

/** true si le token expire dans moins de `marginSeconds` secondes. */
function isTokenExpiring(token: string, marginSeconds = 60): boolean {
  const exp = readTokenExpiry(token);

  if (exp === null) return false;

  return exp * 1000 - Date.now() < marginSeconds * 1000;
}

// ============================================================
// TOKEN REFRESH
// ============================================================

let refreshPromise: Promise<boolean> | null = null;

/**
 * Renouvelle l'access token avec le refresh token.
 *
 * - Refresh refusé par le serveur (400 / 401 / 403) : la session est
 *   vraiment invalide → on la supprime.
 * - Erreur réseau ou serveur (5xx) : on GARDE les tokens, pour que
 *   l'utilisateur reste connecté dès que le serveur répond à nouveau.
 */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return false;
  }

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
        // Réseau coupé, serveur injoignable… on ne déconnecte pas.
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

/**
 * Endpoints publics : pas de refresh proactif, et un 401 ne déclenche pas
 * de refresh. (forgot / reset-password n'utilisent pas la session stockée :
 * un 401 « lien invalide » ne doit surtout pas toucher à la session.)
 */
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

  // Refresh proactif : évite une requête vouée à l'échec
  // quand l'access token est déjà expiré (retour après plusieurs heures).
  if (canRefresh && !isRetry) {
    const current = getAccessToken();

    if (!current || isTokenExpiring(current)) {
      await refreshAccessToken();
    }
  }

  const token = getAccessToken();

  const headers = new Headers(options.headers || {});

  // Ne jamais définir Content-Type manuellement pour FormData :
  // le navigateur ajoute lui-même le boundary multipart.
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
    // Tout 401 sur un endpoint protégé : on tente un refresh, une seule fois.
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
// SIGN IN
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

// ============================================================
// SIGN UP
// ============================================================

export async function signUp(
  email: string,
  password: string,
  firstName = "",
  lastName = ""
): Promise<AuthResponse> {
  const result = await apiRequest<AuthResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      firstName,
      lastName,
    }),
  });

  saveSession(result.session);

  return result;
}

// ============================================================
// FORGOT PASSWORD (étape 1 : demande du lien par email)
// ============================================================
//
// POST /api/auth/forgot-password
// Le serveur répond toujours « succès » (que le compte existe ou non) :
// l'interface doit afficher un message neutre du type « Si un compte existe
// pour cette adresse, un lien a été envoyé ».
//
// Lève une Error (message lisible) pour : email invalide, trop de demandes.

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
// RESET PASSWORD (étape 2 : nouveau mot de passe)
// ============================================================
//
// Le lien de l'email renvoie vers  <APP_URL>/reset-password  et Supabase
// ajoute les jetons de récupération à l'URL (dans le hash).
//
//   readRecoveryParams()            → lit les jetons dans l'URL
//   readRecoveryError()             → lit l'erreur Supabase (lien expiré...)
//   resetPassword(pwd, params)      → POST /api/auth/reset-password
//   clearRecoveryParamsFromUrl()    → retire les jetons de la barre d'adresse
//
// ⚠️ App.tsx : le code qui intercepte « #access_token=... » au démarrage pour
// les connexions Google / GitHub doit IGNORER les liens de récupération
// (voir isRecoveryUrl), sinon le lien connecterait l'utilisateur au lieu de
// lui laisser choisir un nouveau mot de passe.

function readUrlParam(key: string): string | null {
  if (typeof window === "undefined") return null;

  // Hash ET query : les paramètres peuvent arriver dans le fragment OAuth
  // ou directement dans la query string.
  const raw = `${window.location.hash}&${window.location.search}`;
  const match = new RegExp(`[#?&]${key}=([^&#]*)`).exec(raw);

  if (!match) return null;

  try {
    return decodeURIComponent(match[1].replace(/\+/g, " "));
  } catch {
    return match[1];
  }
}

/**
 * true si l'URL courante est un lien de récupération de mot de passe.
 * À utiliser dans App.tsx avant de traiter un « #access_token=... ».
 */
export function isRecoveryUrl(): boolean {
  if (typeof window === "undefined") return false;

  if (window.location.pathname.replace(/\/+$/, "") === "/reset-password") {
    return true;
  }
  if (window.location.hash.includes("reset-password")) return true;

  return (
    readUrlParam("type") === "recovery" &&
    Boolean(readUrlParam("access_token") || readUrlParam("token_hash"))
  );
}

/** Jetons de récupération présents dans l'URL, ou null s'il n'y en a pas. */
export function readRecoveryParams(): RecoveryParams | null {
  const type = readUrlParam("type");

  // Un access_token sans type=recovery vient d'une autre connexion (OAuth) :
  // on ne le traite pas comme un lien de récupération.
  if (type && type !== "recovery") return null;

  const accessToken = readUrlParam("access_token");
  const tokenHash = readUrlParam("token_hash");

  if (!accessToken && !tokenHash) return null;

  return {
    ...(accessToken ? { accessToken } : {}),
    ...(tokenHash ? { tokenHash } : {}),
  };
}

/**
 * Erreur renvoyée par Supabase dans l'URL (lien expiré ou déjà utilisé),
 * ou null.
 */
export function readRecoveryError(): string | null {
  const description = readUrlParam("error_description");
  const code = readUrlParam("error_code");

  if (!description && !code) return null;

  if (code === "otp_expired") {
    return "This reset link has expired or was already used. Request a new one.";
  }

  return description || "This reset link is invalid. Request a new one.";
}

/** Retire les jetons de la barre d'adresse (historique, captures d'écran...). */
export function clearRecoveryParamsFromUrl(): void {
  if (typeof window === "undefined") return;

  window.history.replaceState(null, "", "/reset-password");
}

/**
 * Définit le nouveau mot de passe. Le serveur révoque ensuite TOUTES les
 * sessions de l'utilisateur : la session locale est donc supprimée, et
 * l'utilisateur doit se reconnecter avec son nouveau mot de passe.
 */
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
// GOOGLE OAUTH
// ============================================================
//
// 1) On demande au serveur l'URL d'autorisation Google.
// 2) On redirige le navigateur.
// 3) Google → Supabase → revient sur redirectTo avec le hash
//    #access_token=...&refresh_token=... que App.tsx intercepte
//    au démarrage pour stocker la session.
//
// Le redirectTo est l'URL du FRONTEND (window.location.origin),
// jamais l'URL Railway du backend.

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

// ============================================================
// GITHUB OAUTH
// ============================================================

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

// Stocke la session renvoyée par le hash OAuth.
export function saveOAuthSession(
  accessToken: string,
  refreshToken: string
): void {
  saveSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}

// ============================================================
// RESEND VERIFICATION EMAIL
// ============================================================

export async function resendVerificationEmail(): Promise<boolean> {
  try {
    await apiRequest("/api/auth/resend-verification", {
      method: "POST",
    });
    return true;
  } catch (error) {
    console.error("Error resending verification email:", error);
    return false;
  }
}

// ============================================================
// UPDATE / SET PASSWORD
// ============================================================
//
// - Compte avec mot de passe : currentPassword est obligatoire.
// - Compte OAuth sans mot de passe : passer `null` (ou omettre)
//   → le backend définit le mot de passe sans vérification de
//   l'ancien (route à adapter : voir updateUserById côté serveur).

export async function updatePassword(
  currentPassword: string | null,
  newPassword: string
): Promise<void> {
  const body: { currentPassword?: string; newPassword: string } = {
    newPassword,
  };

  if (currentPassword) {
    body.currentPassword = currentPassword;
  }

  await apiRequest("/api/user/password", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// ============================================================
// GET CURRENT USER
// ============================================================
//
// Retourne null si aucune session n'est stockée ou si elle est invalide.
// Le refresh de l'access token est géré automatiquement par apiRequest.

export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    // Pas d'access token mais un refresh token : apiRequest renouvellera
    // la session avant l'appel.
    if (!hasStoredSession()) {
      return null;
    }

    const response = await apiRequest<{
      success: boolean;
      user: UserProfile;
    }>("/api/user/profile", {
      method: "GET",
    });

    if (response && response.success && response.user) {
      return response.user;
    }

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

    if (profile.first_name !== undefined) {
      updateData.firstName = profile.first_name;
    }

    if (profile.last_name !== undefined) {
      updateData.lastName = profile.last_name;
    }

    if (profile.avatar_url !== undefined) {
      updateData.avatarUrl = profile.avatar_url;
    }

    if (profile.bio !== undefined) {
      updateData.bio = profile.bio;
    }

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
// UPLOAD AVATAR
// ============================================================

export async function uploadAvatar(
  file: File,
  _userId?: string
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

    const data = await apiRequest<{
      success: boolean;
      avatar_url?: string;
      avatarUrl?: string;
    }>("/api/user/avatar", {
      method: "POST",
      body: formData,
    });

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

// ============================================================
// DELETE AVATAR
// ============================================================

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
        // ignore : on supprime la session locale quoi qu'il arrive
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
// Pourquoi un client supabase-js ici ? Les cérémonies WebAuthn (passkey)
// et l'enrôlement TOTP doivent parler directement à Supabase Auth depuis le
// navigateur. Ce client est utilisé UNIQUEMENT pour ça : le reste de l'app
// continue de passer par ton backend Railway.
//
// URL du projet + clé "publishable" (anon) : ces deux valeurs sont
// publiques par conception (Supabase Dashboard → Settings → API Keys).
// ⚠️ N'y mets JAMAIS la clé service_role.

const SUPABASE_URL = "https://VOTRE-PROJET.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xxxxxxxxxxxxxxxx";

// Ce client ne gère PAS la session lui-même (sinon il roterait le refresh
// token en parallèle de ton apiRequest et l'un des deux se ferait
// déconnecter) : on lui injecte les jetons juste avant chaque opération
// (syncAuthClient) et on récupère les nouveaux jetons juste après
// (persistAuthClientSession).
const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    experimental: { passkey: true }, // API passkeys en bêta
  },
});

/** Injecte la session stockée dans le client (après un refresh si besoin). */
async function syncAuthClient(): Promise<void> {
  let access = getAccessToken();

  if (!access || isTokenExpiring(access)) {
    await refreshAccessToken();
    access = getAccessToken();
  }

  const refresh = getRefreshToken();

  if (!access || !refresh) {
    throw new Error("You are signed out. Sign in again.");
  }

  const { error } = await authClient.auth.setSession({
    access_token: access,
    refresh_token: refresh,
  });

  if (error) throw error;
}

/** Récupère les nouveaux jetons du client (ex. session AAL2) et les stocke. */
async function persistAuthClientSession(): Promise<void> {
  const { data } = await authClient.auth.getSession();

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

/** Facteurs TOTP vérifiés (liste non vide = MFA active). */
export async function listMfaFactors(): Promise<MfaFactor[]> {
  await syncAuthClient();

  const { data, error } = await authClient.auth.mfa.listFactors();
  if (error) throw error;

  return (data.totp ?? []).map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? undefined,
    createdAt: f.created_at,
  }));
}

/** Étape 1 : génère le QR code + la clé secrète. */
export async function startMfaEnrollment(): Promise<{
  factorId: string;
  qrCode: string; // data:image/svg+xml;...
  secret: string;
}> {
  await syncAuthClient();

  // Purge les inscriptions abandonnées (non vérifiées).
  const { data: list } = await authClient.auth.mfa.listFactors();
  const stale = (list?.all ?? []).filter(
    (f) => f.factor_type === "totp" && f.status === "unverified"
  );
  for (const f of stale) {
    await authClient.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await authClient.auth.mfa.enroll({
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

/** Étape 2 : code à 6 chiffres → le facteur devient actif. */
export async function confirmMfaEnrollment(factorId: string, code: string) {
  await syncAuthClient();

  const { error } = await authClient.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  if (error) throw error;

  await persistAuthClientSession(); // la session passe en AAL2
}

/** Annule une inscription en cours (facteur non vérifié). */
export async function cancelMfaEnrollment(factorId: string) {
  await syncAuthClient();
  await authClient.auth.mfa.unenroll({ factorId });
}

/** Désactive la MFA (Supabase exige une session déjà en AAL2). */
export async function disableMfa(factorId: string) {
  await syncAuthClient();

  const { error } = await authClient.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

/**
 * Vérifie un code TOTP pour un facteur PRÉCIS.
 * Utilisé pour élever la session à AAL2 avant de désactiver un facteur
 * donné (verifyMfaLogin() utilise toujours totp[0], peu fiable s'il y a
 * plusieurs facteurs).
 */
export async function verifyMfaFactorCode(
  factorId: string,
  code: string
): Promise<void> {
  await syncAuthClient();

  const { error } = await authClient.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  if (error) throw error;

  await persistAuthClientSession();
}

// ── Connexion (à brancher sur la page Sign in et sur App.tsx pour OAuth) ──

/** true si la MFA est activée mais le code n'a pas encore été saisi. */
export async function needsMfaChallenge(): Promise<boolean> {
  await syncAuthClient();

  const { data, error } =
    await authClient.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;

  return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

/** Vérifie le code à 6 chiffres saisi à la connexion. */
export async function verifyMfaLogin(code: string): Promise<void> {
  await syncAuthClient();

  const { data, error } = await authClient.auth.mfa.listFactors();
  if (error) throw error;

  const factor = data.totp[0];
  if (!factor) throw new Error("No authenticator found");

  const { error: verifyError } = await authClient.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  });
  if (verifyError) throw verifyError;

  await persistAuthClientSession();
}

// ============================================================
// PASSKEYS (empreinte, reconnaissance faciale, PIN, clé de sécurité)
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

  const { data, error } = await authClient.auth.passkey.list();
  if (error) throw error;

  return (data ?? []).map((p: any) => ({
    id: p.id,
    friendlyName: p.friendly_name ?? p.friendlyName ?? undefined,
    createdAt: p.created_at ?? p.createdAt,
  }));
}

/** Ouvre l'invite de l'appareil (Touch ID, Face ID, Windows Hello…). */
export async function registerPasskey(): Promise<void> {
  await syncAuthClient();

  const { error } = await authClient.auth.registerPasskey();
  if (error) throw error;
}

export async function renamePasskey(passkeyId: string, friendlyName: string) {
  await syncAuthClient();

  const { error } = await authClient.auth.passkey.update({
    passkeyId,
    friendlyName,
  });
  if (error) throw error;
}

export async function deletePasskey(passkeyId: string): Promise<void> {
  await syncAuthClient();

  const { error } = await authClient.auth.passkey.delete({ passkeyId });
  if (error) throw error;
}

/**
 * Connexion SANS mot de passe avec une passkey (page Sign in).
 * Pas besoin d'e-mail : l'appareil retrouve le compte tout seul.
 * Stocke la session dans le même localStorage que signIn().
 */
export async function signInWithPasskey(): Promise<void> {
  const { data, error } = await authClient.auth.signInWithPasskey();
  if (error) throw error;

  if (!data?.session) {
    throw new Error("Passkey sign-in failed");
  }

  saveSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}