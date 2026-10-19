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
   THEME TOKENS (noir & blanc, identiques à la page Home)
============================================================ */

const panelClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#0f0f11]"
    : "border-black/[0.06] bg-white";

const surfaceClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-white/[0.03]"
    : "border-black/[0.06] bg-[#f6f4f0]";

const dividerClass = (isDark: boolean) =>
  isDark ? "divide-white/[0.07]" : "divide-black/[0.06]";

const mutedClass = (isDark: boolean) =>
  isDark ? "text-neutral-600" : "text-neutral-400";

const bodyClass = (isDark: boolean) =>
  isDark ? "text-neutral-400" : "text-neutral-500";

const strongClass = (isDark: boolean) =>
  isDark ? "text-white" : "text-neutral-900";

/* Élément « actif » : inversion noir/blanc */
const invertClass = (isDark: boolean) =>
  isDark ? "bg-white text-black" : "bg-neutral-900 text-white";

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
    description: "Write once, post to all your connected channels at once.",
    cta: "Create a post",
    route: "home",
    icon: <Send className="h-4 w-4" />,
  },
  {
    key: "schedule",
    title: "Schedule ahead",
    description: "Plan content on the calendar and let Stone publish it.",
    cta: "Open calendar",
    route: "calendar",
    icon: <CalendarDays className="h-4 w-4" />,
  },
  {
    key: "community",
    title: "One inbox for comments",
    description: "Read and answer comments from every channel in one place.",
    cta: "Open community",
    route: "community",
    icon: <MessageCircle className="h-4 w-4" />,
  },
  {
    key: "channels",
    title: "More connected channels",
    description: "Link more accounts and manage them all together.",
    cta: "Manage channels",
    route: "channels",
    icon: <Users className="h-4 w-4" />,
  },
  {
    key: "analytics",
    title: "Performance at a glance",
    description: "Followers, likes and comments with trends over time.",
    cta: "See overview",
    route: "home",
    icon: <TrendingUp className="h-4 w-4" />,
  },
];

/* ============================================================
   SMALL PIECES
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

function FeatureRow({
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
    <li>
      <button
        type="button"
        disabled={!unlocked}
        onClick={onOpen}
        aria-label={`${feature.title}, ${unlocked ? "unlocked" : "locked"}`}
        className={[
          "group flex w-full items-center gap-3.5 px-4 py-3.5 text-left",
          "transition-colors duration-300 motion-reduce:transition-none",
          "disabled:cursor-default",
          focusRingClass(isDark),
          unlocked
            ? isDark
              ? "hover:bg-white/[0.04]"
              : "hover:bg-black/[0.03]"
            : "",
        ].join(" ")}
      >
        {/* Tuile d'icône : s'inverse noir/blanc quand c'est débloqué */}
        <span
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            "transition-all duration-500 motion-reduce:transition-none",
            unlocked
              ? invertClass(isDark)
              : isDark
                ? "bg-white/[0.06] text-neutral-600"
                : "bg-white text-neutral-400 shadow-sm ring-1 ring-black/[0.05]",
          ].join(" ")}
        >
          {feature.icon}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={[
              "block truncate text-[13px] font-semibold tracking-[-0.01em]",
              "transition-colors duration-500",
              unlocked ? strongClass(isDark) : mutedClass(isDark),
            ].join(" ")}
          >
            {feature.title}
          </span>
          <span
            className={[
              "mt-0.5 block text-[11px] leading-[1.45] transition-colors duration-500",
              unlocked ? bodyClass(isDark) : mutedClass(isDark),
            ].join(" ")}
          >
            {feature.description}
          </span>
        </span>

        {/* Statut à droite */}
        {unlocked ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <span
              className={[
                "hidden items-center gap-0.5 text-[10px] font-semibold sm:flex",
                "opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
                strongClass(isDark),
              ].join(" ")}
            >
              {feature.cta}
              <ArrowUpRight className="h-3 w-3" />
            </span>
            <span
              className={[
                "flex h-5 w-5 items-center justify-center rounded-full",
                invertClass(isDark),
              ].join(" ")}
            >
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
            </span>
          </span>
        ) : (
          <span
            className={[
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
              isDark
                ? "border-white/[0.12] text-neutral-600"
                : "border-black/[0.10] text-neutral-400",
            ].join(" ")}
          >
            <LockIcon className="h-2.5 w-2.5" />
          </span>
        )}
      </button>
    </li>
  );
}

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
        "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5",
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

  /* Déblocage progressif dès que l'abonnement est actif */
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

  if (!open || !checkoutStatus) return null;

  const checking = isSuccess && !!user && !hasActive && verify !== "timeout";

  /* ---------------- Textes ---------------- */

  const eyebrow = isSuccess ? "Payment received" : "Checkout canceled";

  const title = !isSuccess
    ? "Everything Stone can do for you"
    : hasActive
      ? "You're in. Here's what you unlocked."
      : !user
        ? "Sign in to unlock your plan"
        : verify === "timeout"
          ? "Your plan is almost ready"
          : "Unlocking your plan…";

  const description = !isSuccess
    ? "You weren't charged and nothing changed on your account. This is what's included when you subscribe."
    : hasActive
      ? "Tap any feature to try it right away."
      : !user
        ? "Your payment went through. Sign in to attach it to your account."
        : verify === "timeout"
          ? "Your payment went through, but syncing is taking longer than usual."
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
          "relative flex w-full max-w-[520px] flex-col overflow-hidden",
          "max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]",
          "rounded-t-[28px] border sm:rounded-[28px]",
          "shadow-[0_30px_100px_-25px_rgba(0,0,0,0.55)]",
          panelClass(isDark),
        ].join(" ")}
      >
        {/* Halo neutre en haut du panneau */}
        <div
          aria-hidden="true"
          className={[
            "pointer-events-none absolute inset-x-0 top-0 h-48",
            isDark
              ? "bg-[radial-gradient(70%_100%_at_50%_0%,rgba(255,255,255,0.07),transparent)]"
              : "bg-[radial-gradient(70%_100%_at_50%_0%,rgba(0,0,0,0.045),transparent)]",
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

        <div className="relative flex-1 overflow-y-auto px-6 pb-6 pt-9 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden">
          {/* HERO centré */}
          <header className="flex flex-col items-center text-center">
            <div
              className={[
                "flex h-12 w-12 items-center justify-center rounded-2xl",
                "transition-colors duration-500",
                isSuccess
                  ? invertClass(isDark)
                  : isDark
                    ? "bg-white/[0.06] text-neutral-300 ring-1 ring-white/[0.07]"
                    : "bg-[#f6f4f0] text-neutral-600 ring-1 ring-black/[0.06]",
              ].join(" ")}
            >
              {isSuccess ? (
                <Check className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
              ) : (
                <LockIcon className="h-5 w-5" />
              )}
            </div>

            <p
              className={[
                "mt-5 text-[11px] font-semibold",
                isDark ? "text-neutral-500" : "text-neutral-400",
              ].join(" ")}
            >
              {eyebrow}
            </p>

            <h2
              id="checkout-return-title"
              className={[
                "mt-1.5 max-w-[400px] text-[26px] font-semibold leading-[1.1]",
                "tracking-[-0.035em]",
                strongClass(isDark),
              ].join(" ")}
            >
              {title}
            </h2>
            <p
              id="checkout-return-desc"
              role="status"
              className={[
                "mt-2 max-w-[380px] text-[13px] leading-6",
                bodyClass(isDark),
              ].join(" ")}
            >
              {description}
            </p>
          </header>

          {/* PROGRESSION segmentée */}
          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between">
              <p className={["text-[11px] font-semibold", mutedClass(isDark)].join(" ")}>
                Features
              </p>
              <p
                className={[
                  "flex items-center gap-1.5 text-[11px] font-semibold tabular-nums",
                  bodyClass(isDark),
                ].join(" ")}
              >
                {checking && (
                  <span
                    className={[
                      "h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] motion-reduce:animate-none",
                      isDark
                        ? "border-white/20 border-t-white"
                        : "border-black/15 border-t-neutral-900",
                    ].join(" ")}
                  />
                )}
                {unlockedCount} of {total} unlocked
              </p>
            </div>

            <div
              className="flex gap-1"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={unlockedCount}
              aria-label="Features unlocked"
            >
              {FEATURES.map((feature, index) => (
                <span
                  key={feature.key}
                  className={[
                    "h-1 flex-1 rounded-full transition-colors duration-500 motion-reduce:transition-none",
                    index < unlockedCount
                      ? isDark
                        ? "bg-white"
                        : "bg-neutral-900"
                      : isDark
                        ? "bg-white/[0.09]"
                        : "bg-black/[0.08]",
                  ].join(" ")}
                />
              ))}
            </div>
          </div>

          {/* LISTE */}
          <ul
            className={[
              "mt-4 divide-y overflow-hidden rounded-2xl border",
              surfaceClass(isDark),
              dividerClass(isDark),
            ].join(" ")}
          >
            {FEATURES.map((feature, index) => (
              <FeatureRow
                key={feature.key}
                isDark={isDark}
                feature={feature}
                unlocked={isSuccess && hasActive && index < unlockedCount}
                onOpen={() => {
                  close();
                  navigate(feature.route);
                }}
              />
            ))}
          </ul>

          {/* ACTIONS */}
          <div className="mt-6 flex flex-col items-center gap-2.5">
            {!isSuccess ? (
              <>
                <PrimaryButton
                  isDark={isDark}
                  onClick={() => {
                    close();
                    navigate("pricing");
                  }}
                >
                  Back to plans
                </PrimaryButton>
                <TextButton isDark={isDark} onClick={close}>
                  Not now
                </TextButton>
              </>
            ) : hasActive ? (
              <>
                <PrimaryButton
                  isDark={isDark}
                  onClick={() => {
                    close();
                    navigate("home");
                  }}
                >
                  Start using Stone
                  <ArrowUpRight className="h-4 w-4" />
                </PrimaryButton>
                <TextButton
                  isDark={isDark}
                  onClick={() => void handleManageBilling()}
                >
                  Manage billing
                </TextButton>
              </>
            ) : !user ? (
              <>
                <PrimaryButton
                  isDark={isDark}
                  onClick={() => {
                    close();
                    navigate("signin");
                  }}
                >
                  Sign in to unlock
                </PrimaryButton>
                <TextButton isDark={isDark} onClick={close}>
                  I'll do it later
                </TextButton>
              </>
            ) : verify === "timeout" ? (
              <>
                <PrimaryButton
                  isDark={isDark}
                  onClick={() => setRetryKey((key) => key + 1)}
                >
                  Check again
                </PrimaryButton>
                <TextButton isDark={isDark} onClick={close}>
                  Close, I'll check later
                </TextButton>
              </>
            ) : (
              <>
                <PrimaryButton isDark={isDark} onClick={() => undefined} disabled>
                  Unlocking…
                </PrimaryButton>
                <TextButton isDark={isDark} onClick={close}>
                  Close
                </TextButton>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}