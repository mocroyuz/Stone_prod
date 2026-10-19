import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  MessageCircle,
  Send,
  TrendingUp,
  Users,
} from "lucide-react";

import { useUser } from "../contexts/UserContext";
import { navigate } from "../hooks/useHashRoute";
import { useSubscription } from "../hooks/useSubscription";
import { useTheme } from "../hooks/useTheme";
import {
  clearCheckoutParams,
  openBillingPortal,
  readCheckoutReturn,
} from "../services/stripe";

/* ============================================================
   THEME TOKENS (identiques à la page Home)
============================================================ */

const panelClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#0f0f11]"
    : "border-black/[0.06] bg-white";

const surfaceClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-white/[0.03]"
    : "border-black/[0.06] bg-[#f6f4f0]";

const mutedClass = (isDark: boolean) =>
  isDark ? "text-neutral-600" : "text-neutral-400";

const bodyClass = (isDark: boolean) =>
  isDark ? "text-neutral-400" : "text-neutral-500";

const strongClass = (isDark: boolean) =>
  isDark ? "text-white" : "text-neutral-900";

const focusRingClass = (isDark: boolean) =>
  isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

/* ============================================================
   FONCTIONNALITÉS DÉBLOQUÉES PAR LE PAIEMENT
   → modifie cette liste pour refléter ton vrai plan
============================================================ */

type Feature = {
  key: string;
  title: string;
  description: string;
  cta: string;
  route: string;
  icon: ReactNode;
};

const FEATURES: Feature[] = [
  {
    key: "publish",
    title: "Publish everywhere",
    description:
      "Write once and send your post to all your connected channels at the same time.",
    cta: "Create a post",
    route: "home",
    icon: <Send className="h-[18px] w-[18px]" />,
  },
  {
    key: "schedule",
    title: "Schedule ahead",
    description:
      "Plan your content on the calendar and let Stone publish it for you.",
    cta: "Open calendar",
    route: "calendar",
    icon: <CalendarDays className="h-[18px] w-[18px]" />,
  },
  {
    key: "community",
    title: "One inbox for comments",
    description:
      "Read and answer comments from every channel without switching apps.",
    cta: "Open community",
    route: "community",
    icon: <MessageCircle className="h-[18px] w-[18px]" />,
  },
  {
    key: "channels",
    title: "More connected channels",
    description:
      "Link more accounts, from TikTok and YouTube to Pinterest, and manage them together.",
    cta: "Manage channels",
    route: "channels",
    icon: <Users className="h-[18px] w-[18px]" />,
  },
  {
    key: "analytics",
    title: "Performance at a glance",
    description:
      "Follow followers, likes and comments with trends against the previous period.",
    cta: "See overview",
    route: "home",
    icon: <TrendingUp className="h-[18px] w-[18px]" />,
  },
];

/* ============================================================
   FEATURE CARD
============================================================ */

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2.2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function FeatureCard({
  isDark,
  feature,
  unlocked,
  onOpen,
}: {
  isDark: boolean;
  feature: Feature;
  unlocked: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={onOpen}
      className={[
        "group relative flex flex-col rounded-2xl border p-4 text-left",
        "transition-all duration-500 motion-reduce:transition-none",
        "disabled:cursor-default",
        focusRingClass(isDark),
        unlocked
          ? isDark
            ? "border-emerald-500/25 bg-emerald-500/[0.05] hover:bg-emerald-500/[0.09]"
            : "border-emerald-600/20 bg-white shadow-sm hover:bg-[#f6f4f0]"
          : surfaceClass(isDark),
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={[
            "flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-500",
            unlocked
              ? "bg-emerald-500/15 text-emerald-500"
              : isDark
                ? "bg-white/[0.06] text-neutral-500"
                : "bg-white text-neutral-400 shadow-sm ring-1 ring-black/[0.05]",
          ].join(" ")}
        >
          {feature.icon}
        </div>

        <span
          className={[
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            "transition-colors duration-500",
            unlocked
              ? "bg-emerald-500/10 text-emerald-500"
              : isDark
                ? "bg-white/[0.06] text-neutral-500"
                : "bg-black/[0.05] text-neutral-500",
          ].join(" ")}
        >
          {unlocked ? (
            <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
          ) : (
            <LockIcon className="h-2.5 w-2.5" />
          )}
          {unlocked ? "Unlocked" : "Locked"}
        </span>
      </div>

      <h3
        className={[
          "mt-4 text-[14px] font-semibold tracking-[-0.01em]",
          unlocked ? strongClass(isDark) : mutedClass(isDark),
          "transition-colors duration-500",
        ].join(" ")}
      >
        {feature.title}
      </h3>
      <p
        className={[
          "mt-1 text-[12px] leading-5",
          unlocked ? bodyClass(isDark) : mutedClass(isDark),
          "transition-colors duration-500",
        ].join(" ")}
      >
        {feature.description}
      </p>

      <span
        className={[
          "mt-4 flex items-center gap-1 text-[11px] font-semibold transition-opacity duration-500",
          unlocked
            ? isDark
              ? "text-white opacity-100"
              : "text-neutral-900 opacity-100"
            : "opacity-0",
        ].join(" ")}
        aria-hidden={!unlocked}
      >
        {feature.cta}
        <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

/* ============================================================
   BUTTONS
============================================================ */

function PrimaryButton({
  isDark,
  onClick,
  disabled,
  children,
}: {
  isDark: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      autoFocus
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex min-h-11 items-center justify-center rounded-xl px-6",
        "text-[13px] font-semibold transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        focusRingClass(isDark),
        isDark
          ? "bg-white text-black enabled:hover:bg-neutral-200"
          : "bg-neutral-900 text-white enabled:hover:bg-neutral-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function TextButton({
  isDark,
  onClick,
  children,
}: {
  isDark: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md px-2 py-1 text-[12px] font-semibold transition",
        focusRingClass(isDark),
        isDark
          ? "text-neutral-400 hover:text-white"
          : "text-neutral-500 hover:text-neutral-900",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ============================================================
   CHECKOUT RETURN MODAL
============================================================ */

type VerifyState = "idle" | "checking" | "timeout";

export default function CheckoutReturnModal() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { user } = useUser();
  const { hasActive, refresh } = useSubscription();
  const [checkoutStatus] = useState(() => readCheckoutReturn().status);
  const [open, setOpen] = useState(checkoutStatus !== null);
  const [verify, setVerify] = useState<VerifyState>("idle");
  const [retryKey, setRetryKey] = useState(0);
  const [unlockedCount, setUnlockedCount] = useState(0);

  const isSuccess = checkoutStatus === "success";
  const total = FEATURES.length;

  const close = () => {
    clearCheckoutParams();
    setOpen(false);
  };

  /* Vérifie l'abonnement (8 essais). Relançable via « Check again ». */
  useEffect(() => {
    if (checkoutStatus !== "success" || !user) return;

    let cancelled = false;

    const verifySubscription = async () => {
      setVerify("checking");

      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (cancelled) return;
        const current = await refresh();

        if (current?.status === "active" || current?.status === "trialing") {
          if (!cancelled) setVerify("idle");
          return;
        }

        if (attempt < 7) {
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
        }
      }

      if (!cancelled) setVerify("timeout");
    };

    void verifySubscription();
    return () => {
      cancelled = true;
    };
  }, [checkoutStatus, refresh, user, retryKey]);

  /* Déblocage progressif des fonctionnalités dès que l'abonnement est actif */
  useEffect(() => {
    if (!isSuccess || !hasActive) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) {
      setUnlockedCount(total);
      return;
    }

    setUnlockedCount(0);
    let count = 0;
    const interval = window.setInterval(() => {
      count += 1;
      setUnlockedCount(count);
      if (count >= total) window.clearInterval(interval);
    }, 220);

    return () => window.clearInterval(interval);
  }, [isSuccess, hasActive, total]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleManageBilling = async () => {
    if (!user) {
      close();
      navigate("signin");
      return;
    }

    if (hasActive) {
      try {
        await openBillingPortal();
      } catch {
        close();
        navigate("settings");
      }
      return;
    }

    close();
    navigate("pricing");
  };

  const openFeature = (route: string) => {
    close();
    navigate(route);
  };

  if (!open || !checkoutStatus) return null;

  const allUnlocked = isSuccess && hasActive && unlockedCount >= total;
  const checking = isSuccess && !!user && !hasActive && verify !== "timeout";

  /* ---------------- Textes d'en-tête ---------------- */

  const eyebrow = !isSuccess
    ? "Checkout canceled"
    : hasActive
      ? "Payment received"
      : "Payment received";

  const title = !isSuccess
    ? "Unlock everything Stone has to offer"
    : hasActive
      ? "Your plan is live. Here's what you unlocked."
      : !user
        ? "Sign in to unlock your features"
        : verify === "timeout"
          ? "Your features are almost ready"
          : "Unlocking your features…";

  const description = !isSuccess
    ? "You weren't charged and nothing changed on your account. This is what's included when you subscribe."
    : hasActive
      ? "Tap any feature to try it right away."
      : !user
        ? "Your payment went through. Sign in to attach it to your account and activate everything below."
        : verify === "timeout"
          ? "Your payment went through, but syncing is taking longer than usual. You can check again."
          : "Your payment went through. This only takes a few seconds.";

  return (
    <div
      className={[
        "fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-4",
        "backdrop-blur-sm",
        isDark ? "bg-black/70" : "bg-black/40",
      ].join(" ")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-return-title"
        aria-describedby="checkout-return-desc"
        className={[
          "relative flex w-full max-w-[820px] flex-col overflow-hidden",
          "max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]",
          "rounded-t-[28px] border sm:rounded-[28px]",
          "shadow-[0_30px_100px_-25px_rgba(0,0,0,0.55)]",
          panelClass(isDark),
        ].join(" ")}
      >
        {/* Lueur d'ambiance qui passe au vert quand tout est débloqué */}
        <div
          aria-hidden="true"
          className={[
            "pointer-events-none absolute inset-x-0 top-0 h-56",
            "transition-opacity duration-700",
            allUnlocked ? "opacity-100" : "opacity-0",
            isDark
              ? "bg-[radial-gradient(60%_100%_at_50%_0%,rgba(16,185,129,0.16),transparent)]"
              : "bg-[radial-gradient(60%_100%_at_50%_0%,rgba(16,185,129,0.14),transparent)]",
          ].join(" ")}
        />

        {/* Fermer */}
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className={[
            "absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center",
            "rounded-full transition",
            focusRingClass(isDark),
            isDark
              ? "text-neutral-500 hover:bg-white/[0.07] hover:text-white"
              : "text-neutral-400 hover:bg-black/[0.05] hover:text-neutral-900",
          ].join(" ")}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path
              d="m6 6 12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* CONTENU QUI SCROLLE */}
        <div className="relative flex-1 overflow-y-auto px-6 pb-4 pt-8 [scrollbar-width:none] sm:px-9 sm:pt-10 [&::-webkit-scrollbar]:hidden">
          {/* HERO */}
          <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-[500px]">
              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                  "text-[10px] font-semibold",
                  isSuccess
                    ? "bg-emerald-500/10 text-emerald-500"
                    : isDark
                      ? "bg-white/[0.07] text-neutral-300"
                      : "bg-black/[0.05] text-neutral-600",
                ].join(" ")}
              >
                {isSuccess && (
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                )}
                {eyebrow}
              </span>

              <h2
                id="checkout-return-title"
                className={[
                  "mt-4 text-[clamp(24px,3.6vw,32px)] font-semibold leading-[1.1]",
                  "tracking-[-0.035em]",
                  strongClass(isDark),
                ].join(" ")}
              >
                {title}
              </h2>
              <p
                id="checkout-return-desc"
                role="status"
                className={["mt-2 text-[13px] leading-6", bodyClass(isDark)].join(" ")}
              >
                {description}
              </p>
            </div>

            {/* Compteur de déblocage */}
            <div
              className={[
                "w-full shrink-0 rounded-2xl border p-3.5 sm:w-[180px]",
                surfaceClass(isDark),
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between">
                <p className={["text-[10px] font-medium", mutedClass(isDark)].join(" ")}>
                  Features unlocked
                </p>
                <p
                  className={[
                    "text-[15px] font-bold tabular-nums tracking-tight",
                    strongClass(isDark),
                  ].join(" ")}
                >
                  {unlockedCount}
                  <span className={["font-medium", mutedClass(isDark)].join(" ")}>
                    /{total}
                  </span>
                </p>
              </div>
              <div
                className={[
                  "mt-2.5 h-1.5 overflow-hidden rounded-full",
                  isDark ? "bg-white/[0.08]" : "bg-black/[0.07]",
                ].join(" ")}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={unlockedCount}
                aria-label="Features unlocked"
              >
                <div
                  className={[
                    "h-full rounded-full bg-emerald-500",
                    "transition-[width] duration-500 ease-out motion-reduce:transition-none",
                  ].join(" ")}
                  style={{ width: `${(unlockedCount / total) * 100}%` }}
                />
              </div>
              {checking && (
                <p className={["mt-2 flex items-center gap-1.5 text-[10px]", bodyClass(isDark)].join(" ")}>
                  <span
                    className={[
                      "h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] motion-reduce:animate-none",
                      isDark
                        ? "border-white/20 border-t-white"
                        : "border-black/15 border-t-neutral-900",
                    ].join(" ")}
                  />
                  Activating…
                </p>
              )}
            </div>
          </header>

          {/* GRILLE DES FONCTIONNALITÉS */}
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map((feature, index) => (
              <div
                key={feature.key}
                className={index === FEATURES.length - 1 && total % 2 === 1 ? "sm:col-span-2" : ""}
              >
                <FeatureCard
                  isDark={isDark}
                  feature={feature}
                  unlocked={isSuccess && hasActive && index < unlockedCount}
                  onOpen={() => openFeature(feature.route)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* PIED : actions */}
        <footer
          className={[
            "relative flex flex-col-reverse items-stretch gap-3 border-t px-6 py-4",
            "sm:flex-row sm:items-center sm:justify-between sm:px-9",
            isDark ? "border-white/[0.07]" : "border-black/[0.06]",
          ].join(" ")}
        >
          <div className="flex items-center justify-center gap-1 sm:justify-start">
            {isSuccess && hasActive ? (
              <TextButton isDark={isDark} onClick={() => void handleManageBilling()}>
                Manage billing
              </TextButton>
            ) : (
              <TextButton isDark={isDark} onClick={close}>
                {isSuccess ? "Close" : "Not now"}
              </TextButton>
            )}
          </div>

          {!isSuccess ? (
            <PrimaryButton
              isDark={isDark}
              onClick={() => {
                close();
                navigate("pricing");
              }}
            >
              Back to plans
            </PrimaryButton>
          ) : hasActive ? (
            <PrimaryButton
              isDark={isDark}
              onClick={() => {
                close();
                navigate("home");
              }}
            >
              Start using Stone
            </PrimaryButton>
          ) : !user ? (
            <PrimaryButton
              isDark={isDark}
              onClick={() => {
                close();
                navigate("signin");
              }}
            >
              Sign in to unlock
            </PrimaryButton>
          ) : verify === "timeout" ? (
            <PrimaryButton isDark={isDark} onClick={() => setRetryKey((key) => key + 1)}>
              Check again
            </PrimaryButton>
          ) : (
            <PrimaryButton isDark={isDark} onClick={() => undefined} disabled>
              Unlocking…
            </PrimaryButton>
          )}
        </footer>
      </section>
    </div>
  );
}