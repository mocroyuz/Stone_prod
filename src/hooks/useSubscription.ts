/* ============================================================
   hooks/useSubscription.ts
   ------------------------------------------------------------
   État React de l'abonnement Stripe de l'utilisateur connecté.

   - fetch initial au montage (et quand `user` change)
   - `refresh()` exposé pour le polling post-checkout
   - `hasActive` recalcule automatiquement (active | trialing)
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";

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

export function useSubscription(): SubscriptionState {
  const { user, loading: userLoading } = useUser();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Empêche une race : le résultat d'un appel obsolète (user changé)
  // est ignoré.
  const userIdRef = useRef<string | null>(null);

  const refresh = useCallback(async (): Promise<Subscription | null> => {
    if (!user) {
      setSubscription(null);
      setError(null);
      return null;
    }

    const currentUserId = user.id;
    setLoading(true);
    setError(null);

    try {
      const sub = await fetchSubscription();

      if (userIdRef.current !== currentUserId) return null;

      setSubscription(sub);
      return sub;
    } catch (err) {
      if (userIdRef.current !== currentUserId) return null;

      setError(err instanceof Error ? err.message : "Erreur inconnue");
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;

    if (userLoading) return;

    if (!user) {
      setSubscription(null);
      setError(null);
      setLoading(false);
      return;
    }

    void refresh();
  }, [user, userLoading, refresh]);

  return {
    subscription,
    loading: loading || userLoading,
    error,
    hasActive: hasActiveSubscription(subscription),
    refresh,
  };
}