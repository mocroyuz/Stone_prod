/* ============================================================
   hooks/useSubscription.ts
   ------------------------------------------------------------
   État React de l'abonnement Stripe de l'utilisateur connecté.

   L'état est PARTAGÉ entre tous les composants (sidebar, pricing...)
   via un store de module : quand la page Pricing rafraîchit
   l'abonnement après un checkout, la sidebar se met à jour aussi.

   - fetch au montage (et quand l'utilisateur change)
   - appels concurrents dédupliqués (un seul GET en vol)
   - `refresh()` exposé pour le polling post-checkout
   - `hasActive` = active | trialing
   ============================================================ */

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { useUser } from "../contexts/UserContext";
import {
  fetchSubscription,
  hasActiveSubscription,
  type Subscription,
} from "../services/stripe";

export type SubscriptionState = {
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  hasActive: boolean;
  refresh: () => Promise<Subscription | null>;
};

/* ------------------------------------------------------------
   Store de module
   ------------------------------------------------------------ */

type StoreState = {
  userId: string | null;
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
};

let state: StoreState = {
  userId: null,
  subscription: null,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<StoreState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): StoreState {
  return state;
}

/** Un seul chargement à la fois par utilisateur. */
let inflight: { userId: string; promise: Promise<Subscription | null> } | null =
  null;

/** Associe le store à l'utilisateur courant (réinitialise s'il change). */
function bindUser(userId: string | null) {
  if (state.userId === userId) return;

  inflight = null;

  setState({
    userId,
    subscription: null,
    loading: false,
    error: null,
  });
}

function loadSubscription(userId: string): Promise<Subscription | null> {
  if (inflight && inflight.userId === userId) return inflight.promise;

  setState({ loading: true, error: null });

  const promise: Promise<Subscription | null> = (async () => {
    try {
      const sub = await fetchSubscription();

      // L'utilisateur a changé pendant l'appel : résultat ignoré.
      if (state.userId !== userId) return null;

      setState({ subscription: sub });
      return sub;
    } catch (err) {
      if (state.userId !== userId) return null;

      setState({
        error: err instanceof Error ? err.message : "Erreur inconnue",
      });
      return null;
    } finally {
      if (inflight && inflight.promise === promise) inflight = null;
      if (state.userId === userId) setState({ loading: false });
    }
  })();

  inflight = { userId, promise };

  return promise;
}

/* ------------------------------------------------------------
   Hook
   ------------------------------------------------------------ */

export function useSubscription(): SubscriptionState {
  const { user, loading: userLoading } = useUser();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const userId = user?.id ?? null;

  const refresh = useCallback(async (): Promise<Subscription | null> => {
    bindUser(userId);

    if (!userId) return null;

    return loadSubscription(userId);
  }, [userId]);

  useEffect(() => {
    if (userLoading) return;

    bindUser(userId);

    if (userId) void loadSubscription(userId);
  }, [userId, userLoading]);

  // Pendant un changement d'utilisateur, on n'expose jamais l'abonnement
  // du précédent.
  const matches = snapshot.userId === userId;
  const subscription = matches ? snapshot.subscription : null;

  return {
    subscription,
    loading: (matches && snapshot.loading) || userLoading,
    error: matches ? snapshot.error : null,
    hasActive: hasActiveSubscription(subscription),
    refresh,
  };
}