// src/pages/CanvaCallback.tsx
//
// Page ouverte dans la fenêtre d'autorisation Canva : https://<frontend>/canva/callback
// (même principe que TikTokCallback : l'URL de retour ne peut PAS contenir de "#").
// Elle finalise OAuth, ou ferme la popup quand Canva renvoie l'utilisateur vers Stone.

import { useEffect, useRef, useState } from "react";
import { completeCanvaAuth } from "../services/canva";

const CANVA_OAUTH_STORAGE_KEY = "canva_oauth_params";

type StoredCanvaParams = {
  code: string | null;
  state: string | null;
  error: string | null;
  error_description: string | null;
};

export function CanvaReturnConfirmation() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("correlation_jwt")) {
      window.history.replaceState(null, "", "/#/canva-return");
    }
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090a] p-6 font-sans text-center text-white">
      <section
        aria-labelledby="canva-return-title"
        className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.035] px-7 py-10 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)] sm:px-12 sm:py-12"
        role="status"
      >
        <div
          aria-label="Stone"
          className="mx-auto mb-8 flex w-fit items-center gap-2 text-neutral-300"
        >
          <img
            src="/images/icon.png"
            alt=""
            className="size-5 object-contain invert opacity-80"
          />
          <span className="font-display text-sm font-semibold tracking-[-0.02em]">
            Stone
          </span>
        </div>
        <div
          aria-hidden="true"
          className="mx-auto mb-7 flex size-[68px] items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-emerald-300"
        >
          <svg
            className="size-8"
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="m6.5 12.5 3.7 3.7 7.3-8"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </div>
        <h1
          className="text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-[2.15rem]"
          id="canva-return-title"
        >
          Vous pouvez fermer cette page
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-neutral-400 sm:text-base">
          Le retour depuis Canva a bien été pris en compte.
        </p>
      </section>
    </main>
  );
}

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

    if (!error && !code && !oauthState && window.opener) {
      setState("done");
      setMessage("Returning to your post…");
      window.opener.focus();
      window.setTimeout(() => window.close(), 300);
      return;
    }

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
        setMessage("Canva connected. Returning to your design…");
        window.opener?.focus();
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