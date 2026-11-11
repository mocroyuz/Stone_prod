import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

/**
 * Recover from stale HTML that points to a hashed Vite chunk no longer
 * present in the active deployment. Reload once per failed asset to avoid
 * an infinite reload loop if the deployment itself is incomplete.
 */
function installChunkLoadRecovery() {
  if (typeof window === "undefined") return;

  const recover = (reason: unknown) => {
    const message =
      reason instanceof Error ? reason.message : String(reason ?? "");
    if (
      !/failed to fetch dynamically imported module|loading chunk|failed to load module script|error loading dynamically imported module/i.test(
        message
      )
    ) {
      return;
    }

    const assetUrl =
      message.match(/https?:\/\/[^\s"'<>]+|\/assets\/[^\s"'<>]+/)?.[0] ??
      window.location.pathname;
    const key = `stone:chunk-reload:${assetUrl}`;

    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch {
      // If storage is unavailable, avoid an uncontrolled reload loop.
      return;
    }

    window.location.reload();
  };

  window.addEventListener("vite:preloadError", ((event: Event) => {
    event.preventDefault();
    const viteEvent = event as CustomEvent<{ payload?: unknown; detail?: unknown }>;
    recover(viteEvent.payload ?? viteEvent.detail);
  }) as EventListener);

  window.addEventListener("unhandledrejection", (event) => {
    recover(event.reason);
  });
}

installChunkLoadRecovery();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
