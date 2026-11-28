// src/hooks/useMfaNudge.ts
import { useCallback, useEffect, useState } from "react";
import { getCurrentUser } from "../services/supabase";

const EVENT = "stone:mfa-nudge-changed";
const skipKey = (userId: string) => `stone.mfa-nudge.skipped.${userId}`;

type State = { loaded: boolean; userId: string | null; enabled: boolean };

let state: State = { loaded: false, userId: null, enabled: false };

function readSkipped(userId: string | null): boolean {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(skipKey(userId)) === "1";
  } catch {
    return false;
  }
}

function writeSkipped(userId: string, value: boolean) {
  try {
    if (value) window.localStorage.setItem(skipKey(userId), "1");
    else window.localStorage.removeItem(skipKey(userId));
  } catch {
    /* stockage indisponible */
  }
}

function emit() {
  window.dispatchEvent(new Event(EVENT));
}

/** À appeler après activation / désactivation de la 2FA. */
export function notifyMfaStatusChanged(enabled: boolean) {
  state = { ...state, enabled };
  // Si la 2FA est activée, on oublie le "skip" : la notif reviendra
  // si elle est désactivée plus tard.
  if (enabled && state.userId) writeSkipped(state.userId, false);
  emit();
}

/**
 * true → afficher le rond jaune (2FA non activée et pas ignorée).
 * skip() → masque la notification (sans activer la 2FA).
 */
export function useMfaNudge() {
  const [, force] = useState(0);

  useEffect(() => {
    let mounted = true;
    const rerender = () => mounted && force((n) => n + 1);

    if (!state.loaded) {
      (async () => {
        try {
          const user = await getCurrentUser();
          if (!user) return;
          state = {
            loaded: true,
            userId: user.id,
            enabled: Boolean(user.mfa_enabled),
          };
          emit();
        } catch {
          /* silencieux */
        }
      })();
    }

    window.addEventListener(EVENT, rerender);
    window.addEventListener("storage", rerender);
    return () => {
      mounted = false;
      window.removeEventListener(EVENT, rerender);
      window.removeEventListener("storage", rerender);
    };
  }, []);

  const skip = useCallback(() => {
    if (!state.userId) return;
    writeSkipped(state.userId, true);
    emit();
  }, []);

  const show =
    state.loaded && !state.enabled && !readSkipped(state.userId);

  return { show, skip };
}