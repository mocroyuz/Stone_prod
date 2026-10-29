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
   ICONS
   ============================================================ */

const StarterIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.5 8.5H7.5C6.94772 8.5 6.5 8.94772 6.5 9.5V10.5C6.5 11.0523 6.94772 11.5 7.5 11.5H8.5C9.05228 11.5 9.5 11.0523 9.5 10.5V9.5C9.5 8.94772 9.05228 8.5 8.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.5 8.5H15.5C14.9477 8.5 14.5 8.94772 14.5 9.5V10.5C14.5 11.0523 14.9477 11.5 15.5 11.5H16.5C17.0523 11.5 17.5 11.0523 17.5 10.5V9.5C17.5 8.94772 17.0523 8.5 16.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8.5 16.5H7.5C6.94772 16.5 6.5 16.9477 6.5 17.5V18.5C6.5 19.0523 6.94772 19.5 7.5 19.5H8.5C9.05228 19.5 9.5 19.0523 9.5 18.5V17.5C9.5 16.9477 9.05228 16.5 8.5 16.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.5 16.5H15.5C14.9477 16.5 14.5 16.9477 14.5 17.5V18.5C14.5 19.0523 14.9477 19.5 15.5 19.5H16.5C17.0523 19.5 17.5 19.0523 17.5 18.5V17.5C17.5 16.9477 17.0523 16.5 16.5 16.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ProfessionalIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3L21 12L12 21L3 12L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 8L16 12L12 16L8 12L12 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const GeniusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 3V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 15V21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 12H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckIcon = () => (
  <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#dce4f5] text-[#4a6c9e]">
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
    name: "Starter",
    icon: <StarterIcon />,
    monthly: 0,
    annual: 0,
    description: "Ideal for new investors or those with smaller portfolios. Offers essential features and tools to get started.",
    cta: "Register For Free!",
    features: [
      "Market data and news",
      "Basic portfolio tracking",
      "Access to educational resources",
      "Limited customer support",
    ],
  },
  {
    key: "pro",
    name: "Professional",
    icon: <ProfessionalIcon />,
    monthly: 59,
    annual: 49,
    description: "A comprehensive plan for investors seeking more advanced features and Ollier AI Assistant.",
    cta: "Get Started",
    features: [
      "All features from the Starter plan",
      "Advanced portfolio analysis",
      "Personalized investment recommendations",
      "Priority customer support",
      "Access to a community of investors",
      "Ollier AI Assistant",
    ],
  },
  {
    key: "enterprise",
    name: "Genius",
    icon: <GeniusIcon />,
    monthly: 299,
    annual: 249,
    description: "Tailored for experienced investors and companies with complex portfolios and high-level needs.",
    cta: "Get Started",
    features: [
      "All features from the Professional plan",
      "Exclusive access to investment research & analysis",
      "Private personal letter news",
      "Personalized wealth management services",
      "Dedicated account manager",
      "Access to exclusive investment opportunities",
      "Exclusive company investing Account",
    ],
  },
] as const;

type Plan = (typeof plans)[number];

/* ============================================================
   HELPERS
   ============================================================ */

function readPeriodFromUrl(): BillingPeriod | null {
  if (typeof window === "undefined") return null;
  const sources: URLSearchParams[] = [new URLSearchParams(window.location.search)];
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
    if (isLoggedIn && hasActiveSubscription) return "Manage subscription";
    return plan.cta;
  };

  const starterPlan = plans.find(p => p.key === "starter")!;
  const proPlan = plans.find(p => p.key === "pro")!;
  const geniusPlan = plans.find(p => p.key === "enterprise")!;

  return (
    <section
      id="pricing"
      className="relative z-10 w-full overflow-hidden bg-[#F8F9FC] py-20 text-neutral-950"
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

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <Reveal>
          {/* Header */}
          <div className="text-center mb-10">
            <h2 className="font-sans text-[clamp(28px,4vw,42px)] font-normal leading-tight tracking-tight text-[#111827]">
              Choose <span className="font-bold">The Plan</span> That's Right For<br className="hidden sm:block"/> Your Investment Goals!
            </h2>
          </div>

          {/* Toggle */}
          <div className="mb-12 flex justify-center">
            <div className="inline-flex items-center rounded-full bg-white p-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
              <button
                type="button"
                onClick={() => setPeriod("monthly")}
                className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition-all ${
                  period === "monthly" ? "text-[#111827]" : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                Monthly
                <div className={`h-4 w-7 rounded-full p-0.5 transition-colors ${period === "monthly" ? "bg-[#0a1128]" : "bg-neutral-200"}`}>
                  <div className={`h-3 w-3 rounded-full bg-white transition-transform ${period === "monthly" ? "translate-x-3" : "translate-x-0"}`} />
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPeriod("annual")}
                className={`rounded-full px-6 py-2.5 text-sm font-medium transition-all ${
                  period === "annual" ? "text-[#111827]" : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                Annually
              </button>
            </div>
          </div>

          {/* Messages */}
          {returnBanner === "success" && (
            <p className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
              Payment confirmed — your subscription is being activated.
            </p>
          )}
          {returnBanner === "cancel" && (
            <p className="mb-8 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center text-sm text-neutral-700">
              Checkout canceled. You have not been charged.
            </p>
          )}

          {/* Wrapper global avec la couleur de fond */}
          <div className="rounded-[40px] bg-[#E8ECF5] p-3 md:p-4 lg:p-6">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-stretch">
              
              {/* STARTER CARD (Left) - No background, transparent to show the wrapper color */}
              <div className="lg:w-[32%] flex flex-col justify-between p-5 md:p-6 lg:p-8">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-neutral-900 shadow-sm">
                      {starterPlan.icon}
                    </div>
                    <h3 className="text-xl font-medium text-[#111827]">{starterPlan.name}</h3>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-medium tracking-tight text-[#111827]">
                        ${period === "monthly" ? starterPlan.monthly : starterPlan.annual}
                      </span>
                      <span className="text-sm text-neutral-500">/Month</span>
                    </div>
                  </div>

                  <p className="text-[13px] leading-relaxed text-neutral-600 mb-8">
                    {starterPlan.description}
                  </p>

                  <ul className="space-y-3.5 mb-8">
                    {starterPlan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-[13px] text-neutral-700">
                        <CheckIcon />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => handlePlanClick(starterPlan)}
                  disabled={loadingPlan !== null || userLoading}
                  className="w-full rounded-full bg-[#0a1128] py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#1a2542] disabled:opacity-70 shadow-lg shadow-black/10"
                >
                  {loadingPlan === starterPlan.key ? "Redirecting..." : getButtonText(starterPlan)}
                </button>
              </div>

              {/* PROFESSIONAL & GENIUS CARD (Right) - White card over the background */}
              <div className="lg:w-[68%] rounded-[32px] bg-white p-6 md:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.03)] flex flex-col md:flex-row gap-8">
                
                {/* Professional Column */}
                <div className="flex-1 flex flex-col justify-between border-b md:border-b-0 md:border-r border-neutral-100 pb-8 md:pb-0 md:pr-8">
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-neutral-200 text-neutral-900">
                        {proPlan.icon}
                      </div>
                      <h3 className="text-xl font-medium text-[#111827]">{proPlan.name}</h3>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-medium tracking-tight text-[#111827]">
                          ${period === "monthly" ? proPlan.monthly : proPlan.annual}
                        </span>
                        <span className="text-sm text-neutral-500">/Month</span>
                      </div>
                    </div>

                    <p className="text-[13px] leading-relaxed text-neutral-500 mb-8">
                      {proPlan.description}
                    </p>

                    <ul className="space-y-3.5 mb-8">
                      {proPlan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-3 text-[13px] text-neutral-700">
                          <CheckIcon />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePlanClick(proPlan)}
                    disabled={loadingPlan !== null || userLoading}
                    className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-white px-6 py-2.5 text-sm font-medium text-[#111827] transition-colors hover:bg-neutral-50 disabled:opacity-70"
                  >
                    {loadingPlan === proPlan.key ? "Redirecting..." : getButtonText(proPlan)}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>

                {/* Genius Column */}
                <div className="flex-1 flex flex-col justify-between pt-8 md:pt-0 md:pl-0">
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-neutral-200 text-neutral-900">
                        {geniusPlan.icon}
                      </div>
                      <h3 className="text-xl font-medium text-[#111827]">{geniusPlan.name}</h3>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-medium tracking-tight text-[#111827]">
                          ${period === "monthly" ? geniusPlan.monthly : geniusPlan.annual}
                        </span>
                        <span className="text-sm text-neutral-500">/Month</span>
                      </div>
                    </div>

                    <p className="text-[13px] leading-relaxed text-neutral-500 mb-8">
                      {geniusPlan.description}
                    </p>

                    <ul className="space-y-3.5 mb-8">
                      {geniusPlan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-[13px] text-neutral-700">
                          <div className="mt-0.5"><CheckIcon /></div>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePlanClick(geniusPlan)}
                    disabled={loadingPlan !== null || userLoading}
                    className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-white px-6 py-2.5 text-sm font-medium text-[#111827] transition-colors hover:bg-neutral-50 disabled:opacity-70"
                  >
                    {loadingPlan === geniusPlan.key ? "Redirecting..." : getButtonText(geniusPlan)}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>

              </div>
            </div>
          </div>

          {checkoutError && (
            <p className="mt-8 text-center text-sm text-red-600">{checkoutError}</p>
          )}
        </Reveal>
      </div>
    </section>
  );
}