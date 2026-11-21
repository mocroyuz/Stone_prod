// src/pages/PinterestCallback.tsx
//
// Flux :
//   /pinterest/callback?code=XXX&state=XXX
//     ↓ App.tsx intercepte (avant React), range les params dans sessionStorage
//   /pinterest-callback
//     ↓ useHashRoute()
//   PinterestCallback.tsx → backend → settings/channels

import { useEffect } from "react";

import { useTheme } from "../hooks/useTheme";
import { completePinterestLogin } from "../services/pinterest";

// Doit être identique à la clé définie dans App.tsx
const PINTEREST_OAUTH_STORAGE_KEY = "pinterest_oauth_params";

type StoredPinterestParams = {
  code: string | null;
  state: string | null;
  error: string | null;
  error_description: string | null;
};

// Le code Pinterest est à usage unique. En dev, React StrictMode exécute les
// effets deux fois : on mémorise la requête par code pour ne l'envoyer qu'une fois.
const inflight = new Map<string, Promise<unknown>>();

function readStoredParams(): StoredPinterestParams | null {
  try {
    const raw = sessionStorage.getItem(PINTEREST_OAUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredPinterestParams) : null;
  } catch {
    return null;
  }
}

function clearStoredParams() {
  try {
    sessionStorage.removeItem(PINTEREST_OAUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function goToChannels(query = "") {
  clearStoredParams();
  // replace : le callback ne reste pas dans l'historique.
  window.location.replace(`/settings?section=channels${query}`);
}

export default function PinterestCallback() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const params = readStoredParams();

    if (!params) {
      goToChannels(
        `?pinterest_error=${encodeURIComponent(
          "Pinterest authorization data not found. Please try again."
        )}`
      );
      return;
    }

    const { code, state, error, error_description: errorDescription } = params;

    // L'utilisateur a refusé, ou Pinterest a renvoyé une erreur.
    if (error) {
      goToChannels(
        `?pinterest_error=${encodeURIComponent(errorDescription || error)}`
      );
      return;
    }

    if (!code || !state) {
      goToChannels(
        `?pinterest_error=${encodeURIComponent(
          "Missing authorization code from Pinterest."
        )}`
      );
      return;
    }

    let request = inflight.get(code);
    if (!request) {
      request = completePinterestLogin(code, state);
      inflight.set(code, request);
    }

    request
      .then(() => goToChannels("?pinterest=connected"))
      .catch((err: unknown) => {
        console.error("[Stone] Pinterest callback error:", err);
        goToChannels(
          `?pinterest_error=${encodeURIComponent(
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
      <p className="text-[14px] font-medium">Connecting your Pinterest account...</p>
    </div>
  );
}