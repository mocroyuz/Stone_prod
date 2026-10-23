import { useEffect, useRef, useState } from "react";

import { navigate } from "../hooks/useHashRoute";
import { supabase } from "../services/supabase";

/* ──────────────────────────────────────────────────────────────
   GOOGLE PHOTOS OAUTH CALLBACK
   ────────────────────────────────────────────────────────────── */

const STORAGE_KEY = "google_photos_oauth_params";
const RETURN_ROUTE = "integrations";

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL || "").replace(
  /\/+$/,
  ""
);

type OAuthParams = {
  code?: string | null;
  state?: string | null;
  error?: string | null;
  error_description?: string | null;
};

type Status = "loading" | "success" | "error";

function readOAuthParams(): OAuthParams | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OAuthParams;
  } catch {
    return null;
  }
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export default function GooglePhotosCallback() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Connexion à Google Photos…");
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    (async () => {
      const params = readOAuthParams();

      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // sessionStorage indisponible
      }

      if (!params) {
        setStatus("error");
        setMessage(
          "Paramètres OAuth manquants. Veuillez relancer la connexion Google Photos."
        );
        return;
      }

      if (params.error) {
        setStatus("error");
        setMessage(
          params.error_description ||
            `Google a refusé la connexion (${params.error}).`
        );
        return;
      }

      if (!params.code || !params.state) {
        setStatus("error");
        setMessage("Code d'autorisation ou state manquant.");
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        setStatus("error");
        setMessage(
          "Votre session a expiré. Reconnectez-vous puis réessayez la connexion Google Photos."
        );
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/api/googlephotos/auth/callback`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ code: params.code, state: params.state }),
          }
        );

        const data: { success?: boolean; error?: string } = await res
          .json()
          .catch(() => ({}));

        if (!res.ok || !data.success) {
          throw new Error(data.error || `Erreur HTTP ${res.status}`);
        }

        setStatus("success");
        setMessage("Google Photos est connecté.");

        window.setTimeout(() => {
          navigate(RETURN_ROUTE, { replace: true });
        }, 900);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus("error");
        setMessage(msg);
      }
    })();
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050505] p-6 font-sans">
      <div className="w-full max-w-md rounded-2xl bg-neutral-900 p-8 text-center shadow-2xl ring-1 ring-neutral-800">
        {status === "loading" && (
          <>
            <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
            <h1 className="text-lg font-semibold text-white">
              Connexion à Google Photos
            </h1>
            <p className="mt-2 text-sm text-neutral-400">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-2xl text-green-400">
              ✓
            </div>
            <h1 className="text-lg font-semibold text-white">
              Google Photos connecté
            </h1>
            <p className="mt-2 text-sm text-neutral-400">{message}</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-2xl text-red-400">
              !
            </div>
            <h1 className="text-lg font-semibold text-white">
              Connexion impossible
            </h1>
            <p className="mt-2 text-sm text-neutral-400">{message}</p>
            <button
              type="button"
              className="mt-6 rounded-full bg-white px-6 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200"
              onClick={() => navigate(RETURN_ROUTE, { replace: true })}
            >
              Retour aux intégrations
            </button>
          </>
        )}
      </div>
    </div>
  );
}