// src/pages/CanvaCallback.tsx
//
// Page ouverte dans la fenêtre d'autorisation Canva : https://<frontend>/canva/callback
// (même principe que TikTokCallback : l'URL de retour ne peut PAS contenir de "#").
// Elle envoie code + state au serveur, puis la fenêtre est réutilisée par le modal
// pour ouvrir l'éditeur Canva (ne la ferme pas toi-même).

import { useEffect, useRef, useState } from "react";
import { completeCanvaAuth } from "../services/canva";

const CANVA_OAUTH_STORAGE_KEY = "canva_oauth_params";

type StoredCanvaParams = {
  code: string | null;
  state: string | null;
  error: string | null;
  error_description: string | null;
};

function readCallbackParams(): StoredCanvaParams {
  try {
    const raw = sessionStorage.getItem(CANVA_OAUTH_STORAGE_KEY);
    if (raw) {
      sessionStorage.removeItem(CANVA_OAUTH_STORAGE_KEY);
      return JSON.parse(raw) as StoredCanvaParams;
    }
  } catch {
    // Fall back to the callback URL when session storage is unavailable.
  }

  const params = new URLSearchParams(window.location.search);
  return {
    code: params.get("code"),
    state: params.get("state"),
    error: params.get("error"),
    error_description: params.get("error_description"),
  };
}

export default function CanvaCallback() {
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("Connecting your Canva account…");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const {
      code,
      state: oauthState,
      error,
      error_description: errorDescription,
    } = readCallbackParams();

    if (error || !code || !oauthState) {
      setState("error");
      setMessage(
        error === "access_denied"
          ? "Canva access was refused. You can close this window."
          : errorDescription ||
              "Canva did not return the expected parameters. You can close this window."
      );
      return;
    }

    completeCanvaAuth(code, oauthState)
      .then(() => {
        setState("done");
        setMessage("Canva connected. Opening your design…");
      })
      .catch((e) => {
        setState("error");
        setMessage(
          e instanceof Error ? e.message : "Could not connect Canva. Please try again."
        );
      });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090a] p-6 text-center text-white">
      <p className={state === "error" ? "text-red-400" : "text-neutral-300"}>{message}</p>
    </main>
  );
}