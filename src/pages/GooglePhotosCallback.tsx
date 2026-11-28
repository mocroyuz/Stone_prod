import { useEffect } from "react";

import { useTheme } from "../hooks/useTheme";
import { completeGooglePhotosAuth } from "../services/googlephotos";

const GOOGLE_PHOTOS_OAUTH_STORAGE_KEY = "google_photos_oauth_params";

type StoredGooglePhotosParams = {
  code: string | null;
  state: string | null;
  error: string | null;
  error_description: string | null;
};

const inflight = new Map<string, Promise<unknown>>();

function readStoredParams(): StoredGooglePhotosParams | null {
  try {
    const raw = sessionStorage.getItem(GOOGLE_PHOTOS_OAUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredGooglePhotosParams) : null;
  } catch {
    return null;
  }
}

function clearStoredParams() {
  try {
    sessionStorage.removeItem(GOOGLE_PHOTOS_OAUTH_STORAGE_KEY);
  } catch {
    // Navigation should still complete if sessionStorage is unavailable.
  }
}

function goToIntegrations(query = "") {
  clearStoredParams();
  window.location.replace(`/integrations${query}`);
}

export default function GooglePhotosCallback() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const params = readStoredParams();

    if (!params) {
      goToIntegrations(
        `?gphotos_error=${encodeURIComponent(
          "Google Photos authorization data not found. Please try again."
        )}`
      );
      return;
    }

    const { code, state, error, error_description: errorDescription } = params;

    if (error) {
      goToIntegrations(
        `?gphotos_error=${encodeURIComponent(errorDescription || error)}`
      );
      return;
    }

    if (!code || !state) {
      goToIntegrations(
        `?gphotos_error=${encodeURIComponent(
          "Missing authorization code from Google Photos."
        )}`
      );
      return;
    }

    let request = inflight.get(code);
    if (!request) {
      request = completeGooglePhotosAuth(code, state);
      inflight.set(code, request);
    }

    request
      .then(() => goToIntegrations("?gphotos=connected"))
      .catch((err: unknown) => {
        console.error("[Stone] Google Photos callback error:", err);
        goToIntegrations(
          `?gphotos_error=${encodeURIComponent(
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
      <p className="text-[14px] font-medium">
        Connecting your Google Photos account...
      </p>
    </div>
  );
}
