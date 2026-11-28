// src/hooks/useNewPostShortcut.ts
import { useEffect, useRef } from "react";

/** Délai max entre les deux touches (couvre « ensemble » et « l'une après l'autre »). */
const CHORD_WINDOW_MS = 600;

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;

  return Boolean(
    el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
  );
}

/**
 * N + P (sans modificateur) → appelle `onOpen`.
 * Les deux touches peuvent être pressées ensemble ou à la suite, dans
 * n'importe quel ordre, à moins de 600 ms d'écart.
 * Ignoré pendant la saisie de texte ou quand `enabled` vaut false
 * (passe `!isOpen` pour désactiver le raccourci quand la modale est déjà ouverte).
 */
export function useNewPostShortcut(onOpen: () => void, enabled = true) {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    if (!enabled) return;

    const last = { n: 0, p: 0 };

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key !== "n" && key !== "p") return;

      const now = Date.now();
      const other = key === "n" ? "p" : "n";

      last[key] = now;

      if (now - last[other] <= CHORD_WINDOW_MS) {
        event.preventDefault();
        last.n = 0;
        last.p = 0;
        onOpenRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
  
}
