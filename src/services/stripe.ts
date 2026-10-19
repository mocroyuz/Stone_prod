
/* ============================================================
   services/stripe.ts
   ------------------------------------------------------------
   Client API Stripe côté frontend.

   Seul point d'entrée pour :
     - lire l'abonnement courant (GET /api/stripe/subscription)
     - démarrer un checkout (POST /api/stripe/checkout)
     - ouvrir le billing portal (POST /api/stripe/portal)
     - lire / nettoyer les params de retour Stripe
   ============================================================ */

const API_BASE =
  (import.meta.env.PUBLIC_API_URL as string | undefined) ??
  "http://localhost:3002";

/* ============================================================
   TOKENS — clés de stockage de l'app (Crossflow)
   ============================================================ */

const ACCESS_TOKEN_KEY = "crossflow_access_token";
const REFRESH_TOKEN_KEY = "crossflow_refresh_token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function clearStoredTokens() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);

  // Notifie UserContext que la session a expiré.
  window.dispatchEvent(new CustomEvent("stone:auth-expired"));
}

/* ============================================================
   TYPES
   ============================================================ */

export type BillingPeriod = "monthly" | "annual";

export type PlanKey = "starter" | "pro" | "enterprise";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export type Subscription = {
  id: string;
  status: SubscriptionStatus;
  price_id: string | null;
  current_period_end: number;
  cancel_at_period_end: boolean;
};

type CheckoutSessionResponse = {
  success: boolean;
  id: string;
  url: string;
};

type PortalSessionResponse = {
  success: boolean;
  url: string;
};

type SubscriptionResponse = {
  success: boolean;
  subscription: Subscription | null;
};

/* ============================================================
   ERREUR TYPÉE
   ============================================================ */

export class StripeServiceError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = "StripeServiceError";
    this.status = status;
    this.code = code;
  }
}

/* ============================================================
   REQUÊTE AUTHENTIFIÉE
   ============================================================ */

async function stripeRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken();

  if (!token) {
    throw new StripeServiceError(
      "Ta session a expiré. Reconnecte-toi.",
      401,
      "NO_TOKEN",
    );
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    console.error("[StripeService] Erreur réseau :", {
      apiBase: API_BASE,
      path,
      error,
    });

    throw new StripeServiceError(
      "Impossible de joindre le serveur. Vérifie ta connexion.",
      0,
      "NETWORK_ERROR",
    );
  }

  if (response.status === 401) {
    clearStoredTokens();

    throw new StripeServiceError(
      "Ta session a expiré. Reconnecte-toi.",
      401,
      "SESSION_EXPIRED",
    );
  }

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };

  if (!response.ok) {
    throw new StripeServiceError(
      data?.error || `Échec de la requête (HTTP ${response.status})`,
      response.status,
      data?.code,
    );
  }

  return data as T;
}

/* ============================================================
   HELPERS D'ÉTAT
   ============================================================ */

const ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "active",
  "trialing",
]);

export function hasActiveSubscription(
  subscription: Subscription | null,
): boolean {
  return Boolean(
    subscription && ACTIVE_STATUSES.has(subscription.status),
  );
}

export function isPastDue(
  subscription: Subscription | null,
): boolean {
  return subscription?.status === "past_due";
}

/* ============================================================
   APPELS API
   ============================================================ */

/**
 * Récupère l'abonnement Stripe courant.
 *
 * Le backend interroge Stripe et resynchronise
 * app_metadata.subscription.
 */
export async function fetchSubscription(): Promise<Subscription | null> {
  const data = await stripeRequest<SubscriptionResponse>(
    "/api/stripe/subscription",
    { method: "GET" },
  );

  return data.subscription;
}

/**
 * Crée une session Stripe Checkout.
 *
 * Le backend valide le plan et la période
 * par rapport à ses price IDs.
 */
export async function createCheckoutSession(
  plan: PlanKey,
  period: BillingPeriod,
): Promise<CheckoutSessionResponse> {
  return stripeRequest<CheckoutSessionResponse>(
    "/api/stripe/checkout",
    {
      method: "POST",
      body: JSON.stringify({ plan, period }),
    },
  );
}

/**
 * Crée une session Billing Portal.
 */
export async function createPortalSession(): Promise<PortalSessionResponse> {
  return stripeRequest<PortalSessionResponse>(
    "/api/stripe/portal",
    {
      method: "POST",
    },
  );
}

/* ============================================================
   REDIRECTIONS
   ============================================================ */

/**
 * Démarre le checkout et redirige vers Stripe.
 */
export async function startCheckout(
  plan: PlanKey,
  period: BillingPeriod,
): Promise<void> {
  const session = await createCheckoutSession(plan, period);

  if (!session.url) {
    throw new StripeServiceError(
      "Stripe n'a pas renvoyé d'URL de checkout",
    );
  }

  window.location.href = session.url;
}

/**
 * Ouvre le portail de facturation Stripe.
 */
export async function openBillingPortal(): Promise<void> {
  const session = await createPortalSession();

  if (!session.url) {
    throw new StripeServiceError(
      "Stripe n'a pas renvoyé d'URL de portail",
    );
  }

  window.location.href = session.url;
}

/* ============================================================
   RETOUR DE STRIPE
   ============================================================ */

export type CheckoutReturn = {
  status: "success" | "cancel" | null;
  sessionId: string | null;
};

/**
 * Lit le retour Stripe depuis l'URL :
 * - ?checkout=success
 * - #/account?checkout=success
 */
export function readCheckoutReturn(): CheckoutReturn {
  if (typeof window === "undefined") {
    return { status: null, sessionId: null };
  }

  const sources: URLSearchParams[] = [
    new URLSearchParams(window.location.search),
  ];

  const hash = window.location.hash || "";
  const qIdx = hash.indexOf("?");

  if (qIdx !== -1) {
    sources.push(
      new URLSearchParams(hash.slice(qIdx + 1)),
    );
  }

  for (const params of sources) {
    const status = params.get("checkout");

    if (status === "success" || status === "cancel") {
      return {
        status,
        sessionId: params.get("session_id"),
      };
    }
  }

  return { status: null, sessionId: null };
}

/**
 * Nettoie les paramètres checkout / session_id
 * sans recharger la page.
 */
export function clearCheckoutParams(): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);

  url.searchParams.delete("checkout");
  url.searchParams.delete("session_id");

  const hash = url.hash || "";
  const qIdx = hash.indexOf("?");

  if (qIdx !== -1) {
    const hashPath = hash.slice(0, qIdx);
    const hashParams = new URLSearchParams(
      hash.slice(qIdx + 1),
    );

    hashParams.delete("checkout");
    hashParams.delete("session_id");

    const remaining = hashParams.toString();

    url.hash = remaining
      ? `${hashPath}?${remaining}`
      : hashPath;
  }

  window.history.replaceState({}, "", url.toString());
}
