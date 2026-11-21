import { useEffect } from "react";

import { useTheme } from "../hooks/useTheme";
import { completeGoogleDriveAuth } from "../services/googledrive";

const GOOGLE_DRIVE_OAUTH_STORAGE_KEY = "google_drive_oauth_params";

type StoredGoogleDriveParams = {
  code: string | null;
  state: string | null;
  error: string | null;
  error_description: string | null;
};

const inflight = new Map<string, Promise<unknown>>();

function readStoredParams(): StoredGoogleDriveParams | null {
  try {
    const raw = sessionStorage.getItem(GOOGLE_DRIVE_OAUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredGoogleDriveParams) : null;
  } catch {
    return null;
  }
}

function clearStoredParams() {
  try {
    sessionStorage.removeItem(GOOGLE_DRIVE_OAUTH_STORAGE_KEY);
  } catch {
    // Ignore storage errors; navigation should still complete.
  }
}

function goToIntegrations(query = "") {
  clearStoredParams();
  window.location.replace(`/integrations${query}`);
}

export default function GoogleDriveCallback() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const params = readStoredParams();

    if (!params) {
      goToIntegrations(
        `?gdrive_error=${encodeURIComponent(
          "Google Drive authorization data not found. Please try again."
        )}`
      );
      return;
    }

    const { code, state, error, error_description: errorDescription } = params;

    if (error) {
      goToIntegrations(
        `?gdrive_error=${encodeURIComponent(errorDescription || error)}`
      );
      return;
    }

    if (!code || !state) {
      goToIntegrations(
        `?gdrive_error=${encodeURIComponent(
          "Missing authorization code from Google."
        )}`
      );
      return;
    }

    let request = inflight.get(code);
    if (!request) {
      request = completeGoogleDriveAuth(code, state);
      inflight.set(code, request);
    }

    request
      .then(() => goToIntegrations("?gdrive=connected"))
      .catch((err: unknown) => {
        console.error("[Stone] Google Drive callback error:", err);
        goToIntegrations(
          `?gdrive_error=${encodeURIComponent(
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
        Connecting your Google Drive account...
      </p>
    </div>
  );
}
