// src/pages/DropboxCallback.tsx
//
// Flux :
//   /dropbox/callback?code=XXX&state=XXX
//     ↓ App.tsx intercepte (avant React), range les params dans sessionStorage
//   /dropbox-callback
//     ↓ useHashRoute()
//   DropboxCallback.tsx → backend → /integrations

import { useEffect } from "react";

import { useTheme } from "../hooks/useTheme";
import { completeDropboxLogin } from "../services/dropbox";

// Doit être identique à la clé définie dans App.tsx
const DROPBOX_OAUTH_STORAGE_KEY = "dropbox_oauth_params";

type StoredDropboxParams = {
  code: string | null;
  state: string | null;
  error: string | null;
  error_description: string | null;
};

// Le code Dropbox est à usage unique. En dev, React StrictMode exécute les
// effets deux fois : on mémorise la requête par code pour ne l'envoyer qu'une fois.
const inflight = new Map<string, Promise<unknown>>();

function readStoredParams(): StoredDropboxParams | null {
  try {
    const raw = sessionStorage.getItem(DROPBOX_OAUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredDropboxParams) : null;
  } catch {
    return null;
  }
}

function clearStoredParams() {
  try {
    sessionStorage.removeItem(DROPBOX_OAUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function goToIntegrations(query = "") {
  clearStoredParams();
  // replace : le callback ne reste pas dans l'historique.
  window.location.replace(`/integrations${query}`);
}

export default function DropboxCallback() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const params = readStoredParams();

    if (!params) {
      goToIntegrations(
        `?dropbox_error=${encodeURIComponent(
          "Dropbox authorization data not found. Please try again."
        )}`
      );
      return;
    }

    const { code, state, error, error_description: errorDescription } = params;

    // L'utilisateur a refusé (access_denied), ou Dropbox a renvoyé une erreur.
    if (error) {
      goToIntegrations(
        `?dropbox_error=${encodeURIComponent(errorDescription || error)}`
      );
      return;
    }

    if (!code || !state) {
      goToIntegrations(
        `?dropbox_error=${encodeURIComponent(
          "Missing authorization code from Dropbox."
        )}`
      );
      return;
    }

    let request = inflight.get(code);
    if (!request) {
      request = completeDropboxLogin(code, state);
      inflight.set(code, request);
    }

    request
      .then(() => goToIntegrations("?dropbox=connected"))
      .catch((err: unknown) => {
        console.error("[Stone] Dropbox callback error:", err);
        goToIntegrations(
          `?dropbox_error=${encodeURIComponent(
            err instanceof Error ? err.message : "Something went wrong."
          )}`
        );
      });
  }, []);

  return (
    <div
      className={[
        "flex h-full min-h-screen w-full flex-col items-center justify-center gap-4",
        isDark ? "bg-[#050506] text-[#f3f3ef]" : "bg-[#faf9f7] text-[#151515]",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "h-8 w-8 animate-spin rounded-full border-2",
          isDark
            ? "border-white/20 border-t-white"
            : "border-black/15 border-t-black",
        ].join(" ")}
      />
      <p className="text-[14px] font-medium">Connecting your Dropbox account...</p>
    </div>
  );
}