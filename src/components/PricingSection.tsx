import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { navigate } from "../hooks/useHashRoute";
import { useUser } from "../contexts/UserContext";
import { useSubscription } from "../hooks/useSubscription";
import {
  clearCheckoutParams,
  openBillingPortal,
  readCheckoutReturn,
  startCheckout,
  StripeServiceError,
  type BillingPeriod,
  type PlanKey,
} from "../services/stripe";

/* ============================================================
   REVEAL
   ============================================================ */

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={visible ? { transitionDelay: `${delay}ms` } : undefined}
      className={`pricing-reveal ${
        visible ? "pricing-reveal-visible" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ============================================================
   PLANS
   ============================================================ */

const plans = [
  {
    key: "starter",
    badge: "STARTER",
    monthly: 19,
    annual: 15,
    description: "Everything you need to get started.",
    cta: "Get started",
    features: [
      "Up to 3 channels",
      "10 posts per channel",
      "Basic insights",
      "Content calendar",
      "Up to 100 ideas",
      "Up to 50 tags",
      "Web extension included",
    ],
  },
  {
    key: "pro",
    badge: "PRO",
    monthly: 49,
    annual: 39,
    description: "More freedom to create and grow.",
    cta: "Get started",
    featured: true,
    features: [
      "All channels",
      "Unlimited publications",
      "Advanced insights",
      "Content calendar",
      "Unlimited ideas",
      "Up to 250 tags",
      "Web extension included",
    ],
  },
  {
    key: "enterprise",
    badge: "ENTERPRISE",
    monthly: 99,
    annual: 79,
    description: "Advanced solutions for large organizations.",
    cta: "Contact sales",
    salesOnly: true,
    features: [
      "Everything in Pro",
      "Custom channel limits",
      "Unlimited publications",
      "Advanced insights",
      "Content calendar",
      "Unlimited ideas and tags",
      "Priority support",
      "Dedicated assistance",
    ],
  },
] as const;

type Plan = (typeof plans)[number];

const ENTERPRISE_MAILTO =
  "mailto:sales@stone.app?subject=Enterprise%20plan";

/* ============================================================
   HELPERS
   ============================================================ */

function readPeriodFromUrl(): BillingPeriod | null {
  if (typeof window === "undefined") return null;

  const sources: URLSearchParams[] = [
    new URLSearchParams(window.location.search),
  ];

  const hash = window.location.hash || "";
  const qIdx = hash.indexOf("?");

  if (qIdx !== -1) {
    sources.push(new URLSearchParams(hash.slice(qIdx + 1)));
  }

  for (const params of sources) {
    const value = params.get("period");

    if (value === "annual" || value === "monthly") {
      return value;
    }
  }

  return null;
}

/* ============================================================
   PRICING SECTION
   ============================================================ */

export default function PricingSection() {
  const { user, loading: userLoading } = useUser();

  const {
    hasActive: hasActiveSubscription,
    refresh: refreshSubscription,
  } = useSubscription();

  const isLoggedIn = Boolean(user);

  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [returnBanner, setReturnBanner] = useState<
    "success" | "cancel" | null
  >(null);

  /* Billing period from URL */

  useEffect(() => {
    const urlPeriod = readPeriodFromUrl();

    if (urlPeriod) {
      setPeriod(urlPeriod);
    }
  }, []);

  /* Stripe checkout return */

  useEffect(() => {
    const ret = readCheckoutReturn();

    if (!ret.status) return;

    setReturnBanner(ret.status);
    clearCheckoutParams();

    if (ret.status === "success" && isLoggedIn) {
      let cancelled = false;

      const poll = async () => {
        for (let i = 0; i < 8; i++) {
          if (cancelled) return;

          try {
            const sub = await refreshSubscription();

            if (
              sub &&
              (sub.status === "active" || sub.status === "trialing")
            ) {
              return;
            }
          } catch (error) {
            console.error(
              "[pricing] Subscription refresh failed:",
              error,
            );
          }

          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      };

      void poll();

      return () => {
        cancelled = true;
      };
    }
  }, [isLoggedIn, refreshSubscription]);

  /* Plan selection */

  const handlePlanClick = useCallback(
    async (plan: Plan) => {
      setCheckoutError(null);
      setReturnBanner(null);

      // Enterprise: contact the sales team.
      if ("salesOnly" in plan && plan.salesOnly) {
        window.location.href = ENTERPRISE_MAILTO;
        return;
      }

      // Redirect unauthenticated users to signup.
      if (!isLoggedIn) {
        navigate("signup");
        return;
      }

      setLoadingPlan(plan.key as PlanKey);

      try {
        if (hasActiveSubscription) {
          await openBillingPortal();
        } else {
          await startCheckout(plan.key as PlanKey, period);
        }
      } catch (err) {
        console.error("[pricing] Stripe error:", err);

        const message =
          err instanceof StripeServiceError
            ? err.message
            : err instanceof Error
              ? err.message
              : "An unexpected error occurred.";

        setCheckoutError(message);
        setLoadingPlan(null);
      }
    },
    [isLoggedIn, period, hasActiveSubscription],
  );

  const getButtonText = (plan: Plan): string => {
    if ("salesOnly" in plan && plan.salesOnly) {
      return plan.cta;
    }

    if (isLoggedIn && hasActiveSubscription) {
      return "Manage subscription";
    }

    return plan.cta;
  };

  return (
    <section
      id="pricing"
      className="relative z-10 w-full overflow-hidden bg-white py-16 text-neutral-950 dark:bg-[#050505] dark:text-white"
    >
      <style>{`
        .pricing-reveal {
          opacity: 0;
          transform: translate3d(0, 18px, 0);
          transition:
            opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .pricing-reveal-visible {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }

        .pricing-panel-pro {
          background: linear-gradient(
            120deg,
            #dcdaf0 0%,
            #d6dcee 50%,
            #cfe0f0 100%
          );
        }

        .dark .pricing-panel-pro {
          background: linear-gradient(
            120deg,
            #26244a 0%,
            #20284a 50%,
            #1a3048 100%
          );
        }

        .pricing-cta {
          background: linear-gradient(
            180deg,
            #2b2b2d 0%,
            #141414 100%
          );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.14),
            inset 0 -3px 6px rgba(0, 0, 0, 0.5),
            0 6px 14px -4px rgba(0, 0, 0, 0.35);
        }

        .pricing-cta:hover:not(:disabled) {
          background: linear-gradient(
            180deg,
            #38383b 0%,
            #1c1c1c 100%
          );
        }

        .pricing-cta:focus-visible {
          outline: 2px solid #6d7bd6;
          outline-offset: 3px;
        }

        .dark .pricing-cta {
          background: #ffffff;
          color: #0a0a0a;
          box-shadow: none;
        }

        .dark .pricing-cta:hover:not(:disabled) {
          background: #e5e5e5;
        }

        .price-change {
          animation: price-change 280ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        @keyframes price-change {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.96);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .price-change {
            animation: none;
          }

          .pricing-reveal {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }
      `}</style>

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <Reveal>
          {/* Header */}

          <div className="text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
              Simple, transparent pricing
            </p>

            <h2 className="font-display text-[clamp(30px,3.4vw,42px)] font-bold leading-tight tracking-[-0.045em]">
              Choose your plan
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm text-neutral-600 dark:text-neutral-300">
              Everything you need to plan, organize and publish your content.
            </p>
          </div>

          {/* Billing period */}

          <div className="mt-7 flex justify-center">
            <div
              className="inline-flex rounded-full bg-neutral-100 p-1 dark:bg-white/[0.06]"
              aria-label="Billing period"
            >
              {(["monthly", "annual"] as const).map((value) => {
                const isActive = period === value;

                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setPeriod(value)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6d7bd6]",
                      isActive
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                        : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white",
                    ].join(" ")}
                  >
                    {value === "monthly" ? "Monthly" : "Yearly"}

                    {value === "annual" && (
                      <span className="rounded-full bg-[#dcdaf0] px-2 py-0.5 text-[10px] font-bold text-neutral-800">
                        SAVE 20%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stripe return messages */}

          {returnBanner === "success" && (
            <p
              role="status"
              className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
            >
              Payment confirmed — your subscription is being activated.
            </p>
          )}

          {returnBanner === "cancel" && (
            <p
              role="status"
              className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-sm text-neutral-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300"
            >
              Checkout canceled. You have not been charged.
            </p>
          )}

          {/* Pricing cards */}

          <div className="mt-10 grid items-stretch gap-5 md:grid-cols-3">
            {plans.map((plan) => {
              const isFeatured =
                "featured" in plan && plan.featured;

              const isEnterprise =
                "salesOnly" in plan && plan.salesOnly;

              const price =
                period === "monthly" ? plan.monthly : plan.annual;

              const isLoading = loadingPlan === plan.key;

              return (
                <div
                  key={plan.key}
                  data-plan={plan.key}
                  className={[
                    "relative flex flex-col rounded-[28px] bg-white p-2.5 dark:bg-[#0b0b0d]",
                    isFeatured
                      ? "border border-neutral-200 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.22)] dark:border-white/[0.08] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]"
                      : "border border-neutral-200 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.2)] dark:border-white/[0.08]",
                  ].join(" ")}
                >
                  {/* Plan header */}

                  <div
                    className={[
                      "flex min-h-[150px] flex-col justify-between rounded-[20px] p-4",
                      isFeatured
                        ? "pricing-panel-pro"
                        : "bg-[#f1f1f1] dark:bg-white/[0.04]",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="w-fit rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-neutral-900 dark:bg-white/10 dark:text-white">
                        {plan.badge}
                      </span>

                      {isFeatured && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-200">
                          Recommended
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-baseline gap-1 text-neutral-950 dark:text-white">
                        <span
                          key={`${plan.key}-${period}`}
                          className="price-change font-display text-[38px] font-semibold leading-none tracking-[-0.05em]"
                        >
                          ${price}
                        </span>

                        <span className="text-sm text-neutral-600 dark:text-neutral-300">
                          / month
                        </span>
                      </div>

                      {period === "annual" && (
                        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                          ${price * 12} billed annually
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Description */}

                  <div className="px-3 pb-4 pt-5">
                    <h3 className="text-lg font-semibold tracking-tight">
                      {plan.key === "starter"
                        ? "Start creating"
                        : plan.key === "pro"
                          ? "Scale your content"
                          : "Grow without limits"}
                    </h3>

                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                      {plan.description}
                    </p>
                  </div>

                  {/* CTA */}

                  <div className="px-3">
                    <button
                      type="button"
                      onClick={() => handlePlanClick(plan)}
                      disabled={loadingPlan !== null || userLoading}
                      className={[
                        "inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                        isEnterprise
                          ? "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/10"
                          : "pricing-cta text-white",
                      ].join(" ")}
                    >
                      {isLoading
                        ? "Redirecting..."
                        : getButtonText(plan)}
                    </button>
                  </div>

                  {/* Features */}

                  <div className="px-3 pb-5 pt-6">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
                      What's included
                    </p>

                    <ul className="space-y-3.5">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2.5 text-sm text-neutral-800 dark:text-neutral-200"
                        >
                          <svg
                            viewBox="0 0 16 16"
                            className={[
                              "mt-0.5 h-4 w-4 shrink-0",
                              isFeatured
                                ? "text-indigo-500 dark:text-indigo-300"
                                : "text-neutral-400 dark:text-neutral-500",
                            ].join(" ")}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M3 8.5 6.3 11.8 13 4.5" />
                          </svg>

                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Checkout errors */}

          {checkoutError && (
            <p
              role="alert"
              className="mt-8 text-center text-sm text-red-600 dark:text-red-400"
            >
              {checkoutError}
            </p>
          )}

          <p className="mt-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
            Upgrade your plan whenever your needs grow.
          </p>
        </Reveal>
      </div>
    </section>
  );
}