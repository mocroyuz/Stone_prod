
// src/services/stripe.ts

/* ============================================================
   CONFIGURATION API
   ------------------------------------------------------------
   Même backend Railway que services/supabase.ts.
   Aucune variable d'environnement frontend n'est utilisée.
   ============================================================ */

const API_BASE_URL = "https://stoneserv-production.up.railway.app";

/* ============================================================
   TOKENS — mêmes clés que supabase.ts
   ============================================================ */

const ACCESS_TOKEN_KEY = "crossflow_access_token";
const REFRESH_TOKEN_KEY = "crossflow_refresh_token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function clearStoredTokens(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);

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
  plan?: PlanKey | null;
  plan_key?: PlanKey | null;
  plan_name?: string | null;
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
   REQUÊTE API AUTHENTIFIÉE
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

  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Authorization", `Bearer ${token}`);

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    console.error("[StripeService] Erreur réseau :", {
      url: `${API_BASE_URL}${path}`,
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

  const data = (await response.json().catch(() => null)) as {
    error?: string;
    code?: string;
  } | null;

  if (!response.ok) {
    throw new StripeServiceError(
      data?.error ||
        `Échec de la requête (HTTP ${response.status})`,
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
   LECTURE DE L'ABONNEMENT
   ============================================================ */

export async function fetchSubscription(): Promise<Subscription | null> {
  const data = await stripeRequest<SubscriptionResponse>(
    "/api/stripe/subscription",
    {
      method: "GET",
    },
  );

  return data.subscription;
}

/* ============================================================
   STRIPE CHECKOUT
   ============================================================ */

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

/* ============================================================
   STRIPE BILLING PORTAL
   ============================================================ */

export async function createPortalSession(): Promise<PortalSessionResponse> {
  return stripeRequest<PortalSessionResponse>(
    "/api/stripe/portal",
    {
      method: "POST",
    },
  );
}

/* ============================================================
   REDIRECTION CHECKOUT
   ============================================================ */

export async function startCheckout(
  plan: PlanKey,
  period: BillingPeriod,
): Promise<void> {
  const session = await createCheckoutSession(plan, period);

  if (!session.url) {
    throw new StripeServiceError(
      "Stripe n'a pas renvoyé d'URL de checkout.",
    );
  }

  window.location.href = session.url;
}

/* ============================================================
   REDIRECTION BILLING PORTAL
   ============================================================ */

export async function openBillingPortal(): Promise<void> {
  const session = await createPortalSession();

  if (!session.url) {
    throw new StripeServiceError(
      "Stripe n'a pas renvoyé d'URL de portail.",
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

export function readCheckoutReturn(): CheckoutReturn {
  if (typeof window === "undefined") {
    return {
      status: null,
      sessionId: null,
    };
  }

  const sources: URLSearchParams[] = [
    new URLSearchParams(window.location.search),
  ];

  const hash = window.location.hash || "";
  const queryIndex = hash.indexOf("?");

  if (queryIndex !== -1) {
    sources.push(
      new URLSearchParams(hash.slice(queryIndex + 1)),
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

  return {
    status: null,
    sessionId: null,
  };
}

/* ============================================================
   NETTOYAGE DES PARAMÈTRES DE RETOUR
   ============================================================ */

export function clearCheckoutParams(): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);

  url.searchParams.delete("checkout");
  url.searchParams.delete("session_id");

  const hash = url.hash || "";
  const queryIndex = hash.indexOf("?");

  if (queryIndex !== -1) {
    const hashPath = hash.slice(0, queryIndex);
    const hashParams = new URLSearchParams(
      hash.slice(queryIndex + 1),
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
