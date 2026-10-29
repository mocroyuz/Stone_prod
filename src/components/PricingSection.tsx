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
import { useTheme } from "../hooks/useTheme";
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
      className={`pricing-reveal ${visible ? "pricing-reveal-visible" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/* ============================================================
   ICONS (monochrome, currentColor)
   ============================================================ */

const svgProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const StarterIcon = () => (
  <svg {...svgProps}>
    <rect x="4" y="4" width="6" height="6" rx="1.5" />
    <rect x="14" y="4" width="6" height="6" rx="1.5" />
    <rect x="4" y="14" width="6" height="6" rx="1.5" />
    <rect x="14" y="14" width="6" height="6" rx="1.5" />
  </svg>
);

const ProfessionalIcon = () => (
  <svg {...svgProps}>
    <path d="M12 3L21 12L12 21L3 12L12 3Z" />
    <path d="M12 8L16 12L12 16L8 12L12 8Z" />
  </svg>
);

const EnterpriseIcon = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3V9M12 15V21M3 12H9M15 12H21" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="mt-[1px] shrink-0"
    aria-hidden
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ============================================================
   PLANS DATA
   ============================================================ */

const plans = [
  {
    key: "starter",
    name: "Starter",
    icon: <StarterIcon />,
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
    name: "Pro",
    icon: <ProfessionalIcon />,
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
    name: "Enterprise",
    icon: <EnterpriseIcon />,
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

const ENTERPRISE_MAILTO = "mailto:sales@stone.app?subject=Enterprise%20plan";

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
  if (qIdx !== -1) sources.push(new URLSearchParams(hash.slice(qIdx + 1)));

  for (const params of sources) {
    const value = params.get("period");
    if (value === "annual" || value === "monthly") return value;
  }
  return null;
}

/* ============================================================
   PLAN CARD
   ============================================================ */

function PlanCard({
  plan,
  period,
  isDark,
  buttonText,
  loading,
  disabled,
  onClick,
}: {
  plan: Plan;
  period: BillingPeriod;
  isDark: boolean;
  buttonText: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const featured = "featured" in plan && plan.featured;
  const price = period === "monthly" ? plan.monthly : plan.annual;
  const yearlySaving = (plan.monthly - plan.annual) * 12;

  // Featured card = inverted colors (the only "loud" element on the page)
  const tone = featured
    ? isDark
      ? {
          card: "bg-white text-neutral-950 border-white",
          soft: "text-neutral-600",
          rule: "border-black/10",
          badge: "bg-neutral-950 text-white",
          btn: "bg-neutral-950 text-white hover:bg-neutral-800 focus-visible:ring-black/40",
          icon: "border-black/15 text-neutral-950",
        }
      : {
          card: "bg-neutral-950 text-white border-neutral-950",
          soft: "text-neutral-400",
          rule: "border-white/15",
          badge: "bg-white text-neutral-950",
          btn: "bg-white text-neutral-950 hover:bg-neutral-200 focus-visible:ring-white/50",
          icon: "border-white/20 text-white",
        }
    : isDark
      ? {
          card: "bg-black text-white border-white/15 hover:border-white/40",
          soft: "text-neutral-400",
          rule: "border-white/10",
          badge: "",
          btn: "border border-white/25 text-white hover:bg-white hover:text-black focus-visible:ring-white/40",
          icon: "border-white/15 text-white",
        }
      : {
          card: "bg-white text-neutral-950 border-black/15 hover:border-black/60",
          soft: "text-neutral-500",
          rule: "border-black/10",
          badge: "",
          btn: "border border-black/25 text-neutral-950 hover:bg-neutral-950 hover:text-white focus-visible:ring-black/30",
          icon: "border-black/15 text-neutral-950",
        };

  return (
    <article
      aria-label={`${plan.name} plan`}
      className={[
        "relative flex h-full flex-col rounded-3xl border p-7 transition-colors duration-200 sm:p-8",
        tone.card,
      ].join(" ")}
    >
      {featured && (
        <span
          className={[
            "absolute right-6 top-6 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
            tone.badge,
          ].join(" ")}
        >
          Most popular
        </span>
      )}

      <div
        className={[
          "mb-6 flex h-11 w-11 items-center justify-center rounded-xl border",
          tone.icon,
        ].join(" ")}
      >
        {plan.icon}
      </div>

      <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
      <p className={["mt-1 text-sm", tone.soft].join(" ")}>{plan.description}</p>

      {/* Price */}
      <div className="mt-6" aria-live="polite">
        <div className="flex items-baseline gap-1.5">
          <span className="text-5xl font-semibold tracking-[-0.04em] tabular-nums">
            ${price}
          </span>
          <span className={["text-sm", tone.soft].join(" ")}>/ month</span>
        </div>
        <p className={["mt-2 h-4 text-xs", tone.soft].join(" ")}>
          {period === "annual"
            ? `$${plan.annual * 12} billed yearly · save $${yearlySaving}`
            : "Billed monthly"}
        </p>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-busy={loading}
        className={[
          "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium",
          "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          isDark ? "focus-visible:ring-offset-black" : "focus-visible:ring-offset-white",
          "disabled:cursor-not-allowed disabled:opacity-60",
          tone.btn,
        ].join(" ")}
      >
        {loading ? (
          <>
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden
            />
            Redirecting…
          </>
        ) : (
          <>
            {buttonText}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </>
        )}
      </button>

      {/* Features */}
      <div className={["mt-7 border-t pt-6", tone.rule].join(" ")}>
        <ul className="space-y-3">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-[13.5px] leading-snug">
              <CheckIcon />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/* ============================================================
   PRICING SECTION
   ============================================================ */

export default function PricingSection() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { user, loading: userLoading } = useUser();
  const { hasActive: hasActiveSubscription, refresh: refreshSubscription } =
    useSubscription();

  const isLoggedIn = Boolean(user);

  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [returnBanner, setReturnBanner] = useState<"success" | "cancel" | null>(null);

  useEffect(() => {
    const urlPeriod = readPeriodFromUrl();
    if (urlPeriod) setPeriod(urlPeriod);
  }, []);

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
            if (sub && (sub.status === "active" || sub.status === "trialing")) return;
          } catch (error) {
            console.error("[pricing] Subscription refresh failed:", error);
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

  const handlePlanClick = useCallback(
    async (plan: Plan) => {
      setCheckoutError(null);
      setReturnBanner(null);

      if ("salesOnly" in plan && plan.salesOnly) {
        window.location.href = ENTERPRISE_MAILTO;
        return;
      }

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
    if ("salesOnly" in plan && plan.salesOnly) return plan.cta;
    if (isLoggedIn && hasActiveSubscription) return "Manage subscription";
    return plan.cta;
  };

  const strong = isDark ? "text-white" : "text-neutral-950";
  const soft = isDark ? "text-neutral-400" : "text-neutral-500";
  const noticeClass = isDark
    ? "border-white/20 bg-white/[0.04] text-neutral-200"
    : "border-black/15 bg-neutral-50 text-neutral-800";

  return (
    <section
      id="pricing"
      className={[
        "relative z-10 w-full overflow-hidden py-24 transition-colors duration-300",
        isDark ? "bg-black" : "bg-white",
        strong,
      ].join(" ")}
    >
      <style>{`
        .pricing-reveal {
          opacity: 0;
          transform: translate3d(0, 18px, 0);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .pricing-reveal-visible { opacity: 1; transform: translate3d(0, 0, 0); }
        @media (prefers-reduced-motion: reduce) {
          .pricing-reveal { opacity: 1; transform: none; transition: none; }
        }
      `}</style>

      <div className="mx-auto max-w-[1160px] px-4 sm:px-6 lg:px-8">
        <Reveal>
          {/* Header */}
          <div className="mb-10 text-center">
            <p className={["mb-3 text-xs font-semibold uppercase tracking-[0.2em]", soft].join(" ")}>
              Pricing
            </p>
            <h2 className="font-display text-[clamp(32px,4vw,48px)] font-semibold leading-[1.05] tracking-[-0.045em]">
              Choose your plan
            </h2>
            <p className={["mx-auto mt-4 max-w-md text-[15px]", soft].join(" ")}>
              Everything you need to plan, organize and publish your content.
            </p>
          </div>

          {/* Billing toggle */}
          <div className="mb-12 flex justify-center">
            <div
              role="group"
              aria-label="Billing period"
              className={[
                "inline-flex rounded-full border p-1",
                isDark ? "border-white/20" : "border-black/15",
              ].join(" ")}
            >
              {(["monthly", "annual"] as const).map((value) => {
                const active = period === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPeriod(value)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2",
                      isDark ? "focus-visible:ring-white/40" : "focus-visible:ring-black/30",
                      active
                        ? isDark
                          ? "bg-white text-black"
                          : "bg-neutral-950 text-white"
                        : isDark
                          ? "text-neutral-400 hover:text-white"
                          : "text-neutral-500 hover:text-neutral-950",
                    ].join(" ")}
                  >
                    {value === "monthly" ? "Monthly" : "Yearly"}
                    {value === "annual" && (
                      <span
                        className={[
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
                          active
                            ? isDark
                              ? "border-black/30"
                              : "border-white/40"
                            : isDark
                              ? "border-white/30"
                              : "border-black/25",
                        ].join(" ")}
                      >
                        −20%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notices */}
          <div role="status" aria-live="polite">
            {returnBanner === "success" && (
              <p className={["mx-auto mb-8 max-w-xl rounded-2xl border px-4 py-3 text-center text-sm", noticeClass].join(" ")}>
                Payment confirmed — your subscription is being activated.
              </p>
            )}
            {returnBanner === "cancel" && (
              <p className={["mx-auto mb-8 max-w-xl rounded-2xl border px-4 py-3 text-center text-sm", noticeClass].join(" ")}>
                Checkout canceled. You have not been charged.
              </p>
            )}
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:items-stretch">
            {plans.map((plan, index) => (
              <Reveal key={plan.key} delay={index * 80} className="h-full">
                <PlanCard
                  plan={plan}
                  period={period}
                  isDark={isDark}
                  buttonText={getButtonText(plan)}
                  loading={loadingPlan === plan.key}
                  disabled={loadingPlan !== null || userLoading}
                  onClick={() => handlePlanClick(plan)}
                />
              </Reveal>
            ))}
          </div>

          {checkoutError && (
            <p
              role="alert"
              className={[
                "mx-auto mt-8 max-w-xl rounded-2xl border px-4 py-3 text-center text-sm font-medium",
                isDark ? "border-white/40 text-white" : "border-black/60 text-neutral-950",
              ].join(" ")}
            >
              {checkoutError}
            </p>
          )}

          <p className={["mt-8 text-center text-xs", soft].join(" ")}>
            Upgrade, downgrade or cancel anytime.
          </p>
        </Reveal>
      </div>
    </section>
  );
}