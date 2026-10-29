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
   THEME HELPERS — noir & blanc légèrement grisé
   ============================================================ */

const pageBgClass = (isDark: boolean) =>
  isDark ? "bg-[#0e0e0f]" : "bg-[#ebebeb]";

const starterBgClass = (isDark: boolean) =>
  isDark ? "bg-[#161617] border-white/[0.07]" : "bg-[#dcdcdc] border-black/[0.07]";

const innerCardClass = (isDark: boolean) =>
  isDark ? "bg-[#1f1f21] border-white/[0.09]" : "bg-[#f6f6f6] border-black/[0.07]";

const strongClass = (isDark: boolean) =>
  isDark ? "text-neutral-100" : "text-neutral-900";

const softClass = (isDark: boolean) =>
  isDark ? "text-neutral-400" : "text-neutral-500";

const mutedClass = (isDark: boolean) =>
  isDark ? "text-neutral-600" : "text-neutral-400";

const focusRingClass = (isDark: boolean) =>
  isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

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
   ICONS
   ============================================================ */

const CheckIcon = ({ isDark }: { isDark: boolean }) => (
  <div
    className={[
      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
      isDark ? "bg-white/[0.12] text-neutral-200" : "bg-black/[0.08] text-neutral-700",
    ].join(" ")}
  >
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  </div>
);

/* ============================================================
   PLANS DATA
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
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { user, loading: userLoading } = useUser();
  const { hasActive: hasActiveSubscription, refresh: refreshSubscription } = useSubscription();

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
      return () => { cancelled = true; };
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
        const message = err instanceof StripeServiceError ? err.message : err instanceof Error ? err.message : "An unexpected error occurred.";
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

  const starterPlan = plans[0];
  const proPlan = plans[1];
  const enterprisePlan = plans[2];

  return (
    <section
      id="pricing"
      className={[
        "relative z-10 flex min-h-[100svh] w-full items-center justify-center overflow-hidden py-[clamp(12px,3vh,48px)] transition-colors duration-300",
        pageBgClass(isDark),
        strongClass(isDark),
      ].join(" ")}
    >
      <style>{`
        .pricing-reveal {
          opacity: 0;
          transform: translate3d(0, 18px, 0);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .pricing-reveal-visible {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
        @media (prefers-reduced-motion: reduce) {
          .pricing-reveal { opacity: 1; transform: none; transition: none; }
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <Reveal>

          {/* Header compact */}
          <div className="text-center mb-[clamp(8px,1.5vh,24px)]">
            <p className={["mb-[clamp(4px,1vh,12px)] text-[11px] font-semibold uppercase tracking-[0.18em]", softClass(isDark)].join(" ")}>
              Simple, transparent pricing
            </p>
            <h2 className={["font-display text-[clamp(24px,3.2vh,42px)] font-bold leading-tight tracking-[-0.045em]", strongClass(isDark)].join(" ")}>
              Choose your plan
            </h2>
            <p className={["mx-auto mt-[clamp(4px,1vh,12px)] max-w-md text-[clamp(12px,1.6vh,14px)]", softClass(isDark)].join(" ")}>
              Everything you need to plan, organize and publish your content.
            </p>
          </div>

          {/* Toggle compact */}
          <div className="flex justify-center mt-[clamp(4px,1vh,16px)] mb-[clamp(8px,2vh,32px)]">
            <div
              className={["inline-flex rounded-full p-1", isDark ? "bg-white/[0.07]" : "bg-black/[0.07]"].join(" ")}
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
                      "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                      focusRingClass(isDark),
                      isActive
                        ? isDark ? "bg-neutral-100 text-neutral-900" : "bg-neutral-900 text-neutral-100"
                        : isDark ? "text-neutral-400 hover:text-white" : "text-neutral-600 hover:text-neutral-900",
                    ].join(" ")}
                  >
                    {value === "monthly" ? "Monthly" : "Yearly"}

                    {value === "annual" && (
                      <span className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        isDark ? "bg-white/[0.14] text-neutral-200" : "bg-black/[0.1] text-neutral-800"
                      ].join(" ")}>
                        SAVE 20%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Messages */}
          {returnBanner === "success" && (
            <p className={[
              "mb-[clamp(8px,2vh,24px)] rounded-xl border px-4 py-2 text-center text-sm",
              isDark ? "border-white/15 bg-white/[0.07] text-neutral-200" : "border-black/10 bg-black/[0.05] text-neutral-800"
            ].join(" ")}>
              Payment confirmed — your subscription is being activated.
            </p>
          )}
          {returnBanner === "cancel" && (
            <p className={[
              "mb-[clamp(8px,2vh,24px)] rounded-xl border px-4 py-2 text-center text-sm",
              isDark ? "border-white/10 bg-white/[0.04] text-neutral-300" : "border-black/10 bg-[#f6f6f6] text-neutral-700"
            ].join(" ")}>
              Checkout canceled. You have not been charged.
            </p>
          )}

          {/* Wrapper global compact */}
          <div className={["w-full rounded-[32px] border p-[clamp(8px,1.2vh,16px)]", starterBgClass(isDark)].join(" ")}>
            <div className="flex w-full flex-col items-stretch justify-center gap-[clamp(12px,1.8vh,24px)] lg:flex-row">

              {/* STARTER CARD — icône supprimée */}
              <div className="flex flex-col justify-between p-[clamp(12px,2vh,24px)] lg:w-[30%]">
                <div>
                  <div className="mb-[clamp(8px,1.2vh,16px)] flex items-center">
                    <h3 className={["text-xl font-medium capitalize", strongClass(isDark)].join(" ")}>{starterPlan.key}</h3>
                  </div>

                  <div className="mb-[clamp(8px,1.2vh,16px)]">
                    <div className="flex items-baseline gap-1">
                      <span className={["text-[clamp(28px,4vh,40px)] font-medium tracking-tight", strongClass(isDark)].join(" ")}>
                        ${period === "monthly" ? starterPlan.monthly : starterPlan.annual}
                      </span>
                      <span className={["text-sm", softClass(isDark)].join(" ")}>/Month</span>
                    </div>
                    {period === "annual" && (
                      <p className={["mt-1 text-xs", softClass(isDark)].join(" ")}>
                        ${(period === "monthly" ? starterPlan.monthly : starterPlan.annual) * 12} billed annually
                      </p>
                    )}
                  </div>

                  <p className={["mb-[clamp(12px,2vh,24px)] text-[13px] leading-relaxed", isDark ? "text-neutral-300" : "text-neutral-600"].join(" ")}>
                    {starterPlan.description}
                  </p>

                  <ul className="mb-[clamp(12px,2vh,24px)] space-y-[clamp(4px,1vh,12px)]">
                    {starterPlan.features.map((feature) => (
                      <li key={feature} className={["flex items-center gap-3 text-[13px]", isDark ? "text-neutral-300" : "text-neutral-700"].join(" ")}>
                        <CheckIcon isDark={isDark} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => handlePlanClick(starterPlan)}
                  disabled={loadingPlan !== null || userLoading}
                  className={[
                    "w-full rounded-full py-[clamp(8px,1.4vh,14px)] text-sm font-medium transition-colors disabled:opacity-70 shadow-lg",
                    focusRingClass(isDark),
                    isDark
                      ? "bg-neutral-100 text-neutral-900 hover:bg-neutral-300 shadow-none"
                      : "bg-[#1a1a1a] text-neutral-100 hover:bg-[#333333] shadow-black/10"
                  ].join(" ")}
                >
                  {loadingPlan === starterPlan.key ? "Redirecting..." : getButtonText(starterPlan)}
                </button>
              </div>

              {/* PRO & ENTERPRISE CARDS — icônes supprimées */}
              <div className={[
                "flex flex-col gap-[clamp(16px,2.5vh,32px)] rounded-[28px] border p-[clamp(16px,2.5vh,36px)] shadow-sm md:flex-row lg:w-[70%]",
                innerCardClass(isDark)
              ].join(" ")}>

                {/* Pro Column */}
                <div className={[
                  "flex flex-1 flex-col justify-between border-b pb-[clamp(12px,2vh,24px)] md:border-b-0 md:border-r md:pb-0 md:pr-[clamp(16px,2.5vh,32px)]",
                  isDark ? "border-white/[0.08]" : "border-black/[0.08]"
                ].join(" ")}>
                  <div>
                    <div className="mb-[clamp(8px,1.2vh,16px)] flex items-center">
                      <h3 className={["text-2xl font-medium capitalize", strongClass(isDark)].join(" ")}>{proPlan.key}</h3>
                    </div>

                    <div className="mb-[clamp(8px,1.2vh,16px)]">
                      <div className="flex items-baseline gap-1">
                        <span className={["text-[clamp(32px,4.5vh,48px)] font-medium tracking-tight", strongClass(isDark)].join(" ")}>
                          ${period === "monthly" ? proPlan.monthly : proPlan.annual}
                        </span>
                        <span className={["text-sm", softClass(isDark)].join(" ")}>/Month</span>
                      </div>
                      {period === "annual" && (
                        <p className={["mt-1 text-xs", softClass(isDark)].join(" ")}>
                          ${(period === "monthly" ? proPlan.monthly : proPlan.annual) * 12} billed annually
                        </p>
                      )}
                    </div>

                    <p className={["mb-[clamp(12px,2vh,24px)] text-sm leading-relaxed", softClass(isDark)].join(" ")}>
                      {proPlan.description}
                    </p>

                    <ul className="mb-[clamp(12px,2vh,24px)] space-y-[clamp(6px,1.2vh,14px)]">
                      {proPlan.features.map((feature) => (
                        <li key={feature} className={["flex items-center gap-3 text-sm", isDark ? "text-neutral-300" : "text-neutral-700"].join(" ")}>
                          <CheckIcon isDark={isDark} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePlanClick(proPlan)}
                    disabled={loadingPlan !== null || userLoading}
                    className={[
                      "inline-flex w-fit items-center gap-2 rounded-full border px-7 py-[clamp(8px,1.4vh,12px)] text-sm font-medium transition-colors disabled:opacity-70",
                      focusRingClass(isDark),
                      isDark
                        ? "border-white/15 text-neutral-100 hover:bg-white/[0.08]"
                        : "border-black/15 text-neutral-900 hover:bg-black/[0.05]"
                    ].join(" ")}
                  >
                    {loadingPlan === proPlan.key ? "Redirecting..." : getButtonText(proPlan)}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>

                {/* Enterprise Column */}
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <div className="mb-[clamp(8px,1.2vh,16px)] flex items-center">
                      <h3 className={["text-2xl font-medium capitalize", strongClass(isDark)].join(" ")}>{enterprisePlan.key}</h3>
                    </div>

                    <div className="mb-[clamp(8px,1.2vh,16px)]">
                      <div className="flex items-baseline gap-1">
                        <span className={["text-[clamp(32px,4.5vh,48px)] font-medium tracking-tight", strongClass(isDark)].join(" ")}>
                          ${period === "monthly" ? enterprisePlan.monthly : enterprisePlan.annual}
                        </span>
                        <span className={["text-sm", softClass(isDark)].join(" ")}>/Month</span>
                      </div>
                      {period === "annual" && (
                        <p className={["mt-1 text-xs", softClass(isDark)].join(" ")}>
                          ${(period === "monthly" ? enterprisePlan.monthly : enterprisePlan.annual) * 12} billed annually
                        </p>
                      )}
                    </div>

                    <p className={["mb-[clamp(12px,2vh,24px)] text-sm leading-relaxed", softClass(isDark)].join(" ")}>
                      {enterprisePlan.description}
                    </p>

                    <ul className="mb-[clamp(12px,2vh,24px)] space-y-[clamp(6px,1.2vh,14px)]">
                      {enterprisePlan.features.map((feature) => (
                        <li key={feature} className={["flex items-start gap-3 text-sm", isDark ? "text-neutral-300" : "text-neutral-700"].join(" ")}>
                          <div className="mt-0.5"><CheckIcon isDark={isDark} /></div>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePlanClick(enterprisePlan)}
                    disabled={loadingPlan !== null || userLoading}
                    className={[
                      "inline-flex w-fit items-center gap-2 rounded-full border px-7 py-[clamp(8px,1.4vh,12px)] text-sm font-medium transition-colors disabled:opacity-70",
                      focusRingClass(isDark),
                      isDark
                        ? "border-white/15 text-neutral-100 hover:bg-white/[0.08]"
                        : "border-black/15 text-neutral-900 hover:bg-black/[0.05]"
                    ].join(" ")}
                  >
                    {loadingPlan === enterprisePlan.key ? "Redirecting..." : getButtonText(enterprisePlan)}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>

              </div>
            </div>
          </div>

          {checkoutError && (
            <p className={["mt-[clamp(6px,1.2vh,16px)] text-center text-sm", isDark ? "text-rose-400" : "text-red-600"].join(" ")}>{checkoutError}</p>
          )}

          <p className={["mt-[clamp(6px,1.2vh,16px)] text-center text-xs", mutedClass(isDark)].join(" ")}>
            Upgrade your plan whenever your needs grow.
          </p>
        </Reveal>
      </div>
    </section>
  );
}