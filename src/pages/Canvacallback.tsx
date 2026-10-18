// src/pages/CanvaCallback.tsx
//
// Page ouverte dans la fenêtre d'autorisation Canva : https://<frontend>/canva/callback
// (même principe que TikTokCallback : l'URL de retour ne peut PAS contenir de "#").
// Elle envoie code + state au serveur, puis la fenêtre est réutilisée par le modal
// pour ouvrir l'éditeur Canva (ne la ferme pas toi-même).

import { useEffect, useRef, useState } from "react";
import { completeCanvaAuth } from "../services/canva";

export default function CanvaCallback() {
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("Connecting your Canva account…");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode : un seul appel
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const oauthState = params.get("state");
    const error = params.get("error");

    if (error || !code || !oauthState) {
      setState("error");
      setMessage(
        error === "access_denied"
          ? "Canva access was refused. You can close this window."
          : "Canva did not return the expected parameters. You can close this window."
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