import { useEffect, useState } from "react";

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

/* Grand panneau arrondi du modal */
const mainPanelClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#0f0f11]"
    : "border-black/[0.06] bg-white";

/* Surface secondaire (colonne « Subscription ») */
const panelSurfaceClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-white/[0.03]"
    : "border-black/[0.06] bg-[#f6f4f0]";

const mutedClass = (isDark: boolean) =>
  isDark ? "text-neutral-600" : "text-neutral-400";

const strongClass = (isDark: boolean) =>
  isDark ? "text-white" : "text-neutral-900";

const bodyClass = (isDark: boolean) =>
  isDark ? "text-neutral-400" : "text-neutral-500";

const focusRingClass = (isDark: boolean) =>
  isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

/* ============================================================
   CHECKOUT RETURN MODAL
============================================================ */

export default function CheckoutReturnModal() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { user } = useUser();
  const { subscription, loading, hasActive, refresh } = useSubscription();
  const [checkoutStatus] = useState(() => readCheckoutReturn().status);
  const [open, setOpen] = useState(checkoutStatus !== null);

  const close = () => {
    clearCheckoutParams();
    setOpen(false);
  };

  useEffect(() => {
    if (checkoutStatus !== "success" || !user) return;

    let cancelled = false;
    const verifySubscription = async () => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (cancelled) return;
        const current = await refresh();

        if (current?.status === "active" || current?.status === "trialing") {
          return;
        }

        if (attempt < 7) {
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
        }
      }
    };

    void verifySubscription();
    return () => {
      cancelled = true;
    };
  }, [checkoutStatus, refresh, user]);

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
      navigate("signin");
      return;
    }

    if (hasActive) {
      try {
        await openBillingPortal();
      } catch {
        navigate("settings");
      }
      return;
    }

    navigate("pricing");
  };

  if (!open || !checkoutStatus) return null;

  const isSuccess = checkoutStatus === "success";

  const statusLabel = loading ? "Checking" : hasActive ? "Active" : "Pending";

  return (
    <div
      className={[
        "fixed inset-0 z-[1000] flex items-center justify-center p-4",
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
        className={[
          "relative max-h-[calc(100dvh-2rem)] w-full max-w-[720px]",
          "overflow-y-auto overflow-x-hidden rounded-[28px] border",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "shadow-[0_30px_100px_-25px_rgba(0,0,0,0.55)]",
          mainPanelClass(isDark),
          strongClass(isDark),
        ].join(" ")}
      >
        {/* CLOSE */}
        <button
          type="button"
          onClick={close}
          aria-label="Close confirmation"
          className={[
            "absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center",
            "rounded-full border transition",
            focusRingClass(isDark),
            isDark
              ? "border-white/[0.09] text-neutral-400 hover:bg-white/[0.06] hover:text-white"
              : "border-black/[0.08] text-neutral-500 hover:bg-black/[0.04] hover:text-neutral-900",
          ].join(" ")}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m6 6 12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="grid md:grid-cols-[1fr_0.8fr]">
          {/* ---------------- MAIN COLUMN ---------------- */}
          <div className="px-6 py-9 sm:px-9 sm:py-11">
            {/* Tuile d'icône (même style que les Stat de Home) */}
            <div
              className={[
                "mb-7 flex h-11 w-11 items-center justify-center rounded-xl",
                isSuccess
                  ? isDark
                    ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                    : "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20"
                  : isDark
                    ? "bg-white/[0.06] text-neutral-300 ring-1 ring-white/[0.07]"
                    : "bg-[#f6f4f0] text-neutral-600 ring-1 ring-black/[0.06]",
              ].join(" ")}
            >
              {isSuccess ? (
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="m5 12.5 4.5 4L19 7"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="m6 6 12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>

            <p
              className={[
                "text-[11px] font-semibold",
                isDark ? "text-neutral-500" : "text-neutral-400",
              ].join(" ")}
            >
              {isSuccess ? "Payment received" : "Checkout"}
            </p>

            <h2
              id="checkout-return-title"
              className={[
                "mt-2 max-w-[440px] text-[clamp(28px,4.4vw,40px)]",
                "font-semibold leading-[1.05] tracking-[-0.035em]",
                strongClass(isDark),
              ].join(" ")}
            >
              {isSuccess
                ? hasActive
                  ? "You're all set."
                  : "Thanks for choosing Stone."
                : "Checkout canceled."}
            </h2>

            <p
              className={[
                "mt-4 max-w-[420px] text-[13px] leading-6",
                bodyClass(isDark),
              ].join(" ")}
            >
              {isSuccess
                ? hasActive
                  ? "Your Stone subscription is active. Your workspace is ready to go."
                  : "Your checkout is complete. Sign in to confirm your subscription and get started."
                : "No changes were made to your subscription. You can return to plans whenever you're ready."}
            </p>

            <div className="mt-8 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => {
                  close();
                  if (!user) navigate("signin");
                }}
                className={[
                  "inline-flex min-h-10 items-center justify-center rounded-xl px-5",
                  "text-[12px] font-semibold transition",
                  focusRingClass(isDark),
                  isDark
                    ? "bg-white text-black hover:bg-neutral-200"
                    : "bg-neutral-900 text-white hover:bg-neutral-700",
                ].join(" ")}
              >
                {user ? "Continue to dashboard" : "Sign in to continue"}
              </button>

              <button
                type="button"
                onClick={() => void handleManageBilling()}
                className={[
                  "inline-flex min-h-10 items-center justify-center rounded-xl border px-5",
                  "text-[12px] font-semibold transition",
                  focusRingClass(isDark),
                  isDark
                    ? "border-white/10 text-white hover:bg-white/[0.07]"
                    : "border-black/10 text-neutral-900 hover:bg-black/[0.04]",
                ].join(" ")}
              >
                {hasActive ? "Manage billing" : user ? "View plans" : "Sign in"}
              </button>
            </div>
          </div>

          {/* ---------------- SUBSCRIPTION COLUMN ---------------- */}
          <aside
            className={[
              "border-t px-6 py-7 sm:px-9 md:border-l md:border-t-0 md:py-11",
              panelSurfaceClass(isDark),
            ].join(" ")}
          >
            <p
              className={[
                "text-[11px] font-semibold",
                isDark ? "text-neutral-500" : "text-neutral-400",
              ].join(" ")}
            >
              Subscription
            </p>

            <div className="mt-3 flex items-center justify-between gap-3">
              <h3
                className={[
                  "text-[18px] font-semibold tracking-[-0.02em]",
                  strongClass(isDark),
                ].join(" ")}
              >
                Stone plan
              </h3>

              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                  "text-[10px] font-semibold",
                  hasActive
                    ? isDark
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-emerald-500/10 text-emerald-600"
                    : isDark
                      ? "bg-white/[0.07] text-neutral-300"
                      : "bg-black/[0.05] text-neutral-600",
                ].join(" ")}
              >
                <span
                  className={[
                    "h-1.5 w-1.5 rounded-full",
                    hasActive
                      ? "bg-emerald-500"
                      : loading
                        ? "animate-pulse bg-neutral-400"
                        : "bg-neutral-400",
                  ].join(" ")}
                />
                {statusLabel}
              </span>
            </div>

            <dl
              className={[
                "mt-6 divide-y border-y",
                isDark
                  ? "divide-white/[0.07] border-white/[0.07]"
                  : "divide-black/[0.07] border-black/[0.07]",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-4 py-3.5 text-[12px]">
                <dt className={mutedClass(isDark)}>Email</dt>
                <dd
                  className={[
                    "max-w-[65%] truncate text-right font-semibold",
                    strongClass(isDark),
                  ].join(" ")}
                >
                  {user?.email ?? "Sign in required"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3.5 text-[12px]">
                <dt className={mutedClass(isDark)}>Status</dt>
                <dd
                  className={[
                    "text-right font-semibold capitalize",
                    strongClass(isDark),
                  ].join(" ")}
                >
                  {subscription?.status ?? "Awaiting confirmation"}
                </dd>
              </div>
            </dl>

            {isSuccess && !hasActive && (
              <p
                className={[
                  "mt-5 text-[11px] leading-5",
                  isDark ? "text-neutral-500" : "text-neutral-500",
                ].join(" ")}
                role="status"
              >
                Subscription details may take a moment to sync. This page
                checks for updates automatically.
              </p>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}