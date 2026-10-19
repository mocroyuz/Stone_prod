import { useEffect, useState, type ReactNode } from "react";

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
   STEPS
============================================================ */

type StepState = "done" | "active" | "blocked" | "stalled" | "pending";

function StepIcon({ state, isDark }: { state: StepState; isDark: boolean }) {
  const base = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full";

  if (state === "done") {
    return (
      <span
        className={[
          base,
          "bg-emerald-500 text-white",
        ].join(" ")}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
          <path
            d="m5.5 12.5 4 4 9-9.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (state === "active") {
    return (
      <span
        className={[
          base,
          isDark ? "bg-white/[0.07]" : "bg-black/[0.05]",
        ].join(" ")}
      >
        <span
          className={[
            "h-3.5 w-3.5 animate-spin rounded-full border-2 motion-reduce:animate-none",
            isDark
              ? "border-white/20 border-t-white"
              : "border-black/15 border-t-neutral-900",
          ].join(" ")}
        />
      </span>
    );
  }

  if (state === "stalled") {
    return (
      <span
        className={[
          base,
          isDark ? "bg-amber-500/15 text-amber-400" : "bg-amber-500/15 text-amber-600",
        ].join(" ")}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
          <path
            d="M12 7v6m0 4h.01"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  /* blocked / pending : point vide */
  return (
    <span
      className={[
        base,
        "border",
        isDark ? "border-white/[0.12]" : "border-black/[0.12]",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          isDark ? "bg-white/25" : "bg-black/20",
        ].join(" ")}
      />
    </span>
  );
}

function Step({
  isDark,
  state,
  title,
  detail,
  last,
}: {
  isDark: boolean;
  state: StepState;
  title: string;
  detail?: string;
  last?: boolean;
}) {
  const dim = state === "pending" || state === "blocked";

  return (
    <li className="relative flex gap-3">
      {/* Trait de liaison entre les étapes */}
      {!last && (
        <span
          aria-hidden="true"
          className={[
            "absolute left-3 top-6 h-[calc(100%-12px)] w-px -translate-x-1/2",
            state === "done"
              ? "bg-emerald-500/50"
              : isDark
                ? "bg-white/[0.09]"
                : "bg-black/[0.09]",
          ].join(" ")}
        />
      )}

      <StepIcon state={state} isDark={isDark} />

      <div className={["min-w-0 pb-5", last ? "pb-0" : ""].join(" ")}>
        <p
          className={[
            "text-[13px] font-semibold leading-6",
            dim ? mutedClass(isDark) : strongClass(isDark),
          ].join(" ")}
        >
          {title}
        </p>
        {detail && (
          <p className={["-mt-0.5 text-[11px] leading-5", bodyClass(isDark)].join(" ")}>
            {detail}
          </p>
        )}
      </div>
    </li>
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
        "flex min-h-11 w-full items-center justify-center rounded-xl px-5",
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
        "rounded-md px-1 text-[12px] font-semibold transition",
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

  const isSuccess = checkoutStatus === "success";

  /* État de chaque étape du parcours « succès » */
  const activationState: StepState = hasActive
    ? "done"
    : !user
      ? "blocked"
      : verify === "timeout"
        ? "stalled"
        : "active";

  const readyState: StepState = hasActive ? "done" : "pending";

  /* Texte d'en-tête selon la situation */
  const title = !isSuccess
    ? "Checkout canceled"
    : hasActive
      ? "Welcome to Stone"
      : !user
        ? "One last step"
        : verify === "timeout"
          ? "Still confirming…"
          : "Confirming your plan";

  const description = !isSuccess
    ? "You weren't charged and nothing changed on your account. Come back to the plans whenever you're ready."
    : hasActive
      ? "Your subscription is active and your workspace is ready."
      : !user
        ? "Your payment went through. Sign in to link it to your account."
        : verify === "timeout"
          ? "Your payment went through, but syncing is taking longer than usual."
          : "Your payment went through. We're activating your subscription.";

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
          "relative w-full max-w-[440px] overflow-y-auto",
          "max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]",
          "rounded-t-[28px] border sm:rounded-[28px]",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "shadow-[0_30px_100px_-25px_rgba(0,0,0,0.55)]",
          panelClass(isDark),
        ].join(" ")}
      >
        <div className="px-6 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-8">
          {/* EN-TÊTE */}
          <div className="flex items-start justify-between gap-4">
            <div
              className={[
                "flex h-11 w-11 items-center justify-center rounded-xl ring-1",
                isSuccess
                  ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20"
                  : isDark
                    ? "bg-white/[0.06] text-neutral-300 ring-white/[0.07]"
                    : "bg-[#f6f4f0] text-neutral-600 ring-black/[0.06]",
              ].join(" ")}
            >
              {isSuccess ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path
                    d="M3 10h18M6 15h3M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path
                    d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>

            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full transition",
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
          </div>

          <h2
            id="checkout-return-title"
            className={[
              "mt-5 text-[24px] font-semibold tracking-[-0.035em]",
              strongClass(isDark),
            ].join(" ")}
          >
            {title}
          </h2>
          <p
            id="checkout-return-desc"
            role="status"
            className={["mt-1.5 text-[13px] leading-6", bodyClass(isDark)].join(" ")}
          >
            {description}
          </p>

          {/* PROGRESSION (succès uniquement) */}
          {isSuccess && (
            <div
              className={[
                "mt-6 rounded-2xl border p-4",
                surfaceClass(isDark),
              ].join(" ")}
            >
              <ol>
                <Step
                  isDark={isDark}
                  state="done"
                  title="Payment received"
                  detail={user?.email ? `Receipt sent to ${user.email}` : undefined}
                />
                <Step
                  isDark={isDark}
                  state={activationState}
                  title="Subscription activated"
                  detail={
                    activationState === "blocked"
                      ? "Sign in to confirm"
                      : activationState === "stalled"
                        ? "Taking longer than expected"
                        : activationState === "active"
                          ? "Usually takes a few seconds"
                          : undefined
                  }
                />
                <Step
                  isDark={isDark}
                  state={readyState}
                  title="Workspace ready"
                  last
                />
              </ol>
            </div>
          )}

          {/* ACTIONS : un seul bouton principal, le reste en liens discrets */}
          <div className="mt-6 flex flex-col items-center gap-3">
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
                  Go to dashboard
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
                  Sign in to finish
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
                  Confirming…
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