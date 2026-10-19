import { useEffect, useState } from "react";

import { useUser } from "../contexts/UserContext";
import { navigate } from "../hooks/useHashRoute";
import { useSubscription } from "../hooks/useSubscription";
import {
  clearCheckoutParams,
  openBillingPortal,
  readCheckoutReturn,
} from "../services/stripe";

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
    new Date(timestamp * 1000),
  );
}

export default function Account() {
  const { user } = useUser();
  const { subscription, loading, error, hasActive, refresh } = useSubscription();
  const [checkoutStatus] = useState(() => readCheckoutReturn().status);
  const [checkingCheckout, setCheckingCheckout] = useState(
    () => readCheckoutReturn().status === "success",
  );
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    if (checkoutStatus !== "success") return;
    if (!user) {
      setCheckingCheckout(false);
      return;
    }

    let cancelled = false;
    const verifySubscription = async () => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (cancelled) return;
        const current = await refresh();

        if (current?.status === "active" || current?.status === "trialing") {
          if (!cancelled) setCheckingCheckout(false);
          return;
        }

        if (attempt < 7) {
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
        }
      }

      if (!cancelled) setCheckingCheckout(false);
    };

    void verifySubscription();
    return () => {
      cancelled = true;
    };
  }, [checkoutStatus, refresh, user]);

  const handleManageBilling = async () => {
    if (!user) {
      navigate("signin");
      return;
    }

    setPortalError(null);
    setPortalLoading(true);

    try {
      await openBillingPortal();
    } catch (cause) {
      setPortalError(
        cause instanceof Error
          ? cause.message
          : "Unable to open billing right now.",
      );
      setPortalLoading(false);
    }
  };

  const firstName = user?.first_name;
  const title =
    checkoutStatus === "success"
      ? hasActive
        ? "You're all set."
        : "Thanks for choosing Stone."
      : checkoutStatus === "cancel"
        ? "Checkout canceled."
        : "Your account.";

  return (
    <main className="tint min-h-screen bg-[#f5f5f2] px-5 py-8 text-neutral-950 dark:bg-[#0b0d0d] dark:text-white sm:px-8 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1040px] flex-col">
        <header className="flex items-center justify-between border-b border-black/10 pb-5 dark:border-white/10">
          <a
            href="#/home"
            onClick={(event) => {
              event.preventDefault();
              navigate("home");
            }}
            className="font-display text-lg font-bold tracking-tight"
          >
            stone<span className="text-[#637b52]">.</span>
          </a>
          <button
            type="button"
            onClick={() => navigate("home")}
            className="text-sm font-medium text-neutral-600 transition hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white"
          >
            Back to dashboard <span aria-hidden="true">-&gt;</span>
          </button>
        </header>

        <section className="grid flex-1 content-center gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div className="max-w-[600px] self-center">
            {checkoutStatus === "success" ? (
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-full bg-[#dce8d5] text-[#3d5c31] dark:bg-[#263323] dark:text-[#b8d6a9]">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
                  <path d="m5 12.5 4.5 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            ) : (
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#637b52]">
                Account overview
              </p>
            )}

            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {firstName ? `Welcome, ${firstName}` : user?.email}
            </p>
            <h1 className="mt-2 font-display text-[clamp(38px,6vw,68px)] font-semibold leading-[1.02]">
              {title}
            </h1>
            <p className="mt-5 max-w-[500px] text-base leading-7 text-neutral-600 dark:text-neutral-300">
              {checkoutStatus === "success"
                ? hasActive
                  ? "Your Stone subscription is active. Your workspace is ready to go."
                  : "Thanks for choosing Stone. We are syncing your subscription details now."
                : checkoutStatus === "cancel"
                  ? "No changes were made to your subscription. You can return to plans whenever you're ready."
                  : "Manage your subscription and account details from one place."}
            </p>

            {checkoutStatus === "success" && (checkingCheckout || loading) && !hasActive && (
              <p className="mt-5 inline-flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400" role="status">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#82966f]" />
                Confirming subscription status…
              </p>
            )}

            {checkoutStatus === "success" && !checkingCheckout && !hasActive && (
              <p className="mt-5 max-w-[480px] text-sm leading-6 text-neutral-500 dark:text-neutral-400" role="status">
                We haven't confirmed an active plan yet. Sign in or refresh your subscription status in a moment.
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("home")}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-neutral-950 px-5 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                {user ? "Open dashboard" : "Sign in to continue"}
              </button>
              {checkoutStatus !== "success" && (
                <button
                  type="button"
                  onClick={() => navigate("pricing")}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/15 px-5 text-sm font-medium transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
                >
                  View plans
                </button>
              )}
            </div>
          </div>

          <aside className="self-center border-t border-black/10 pt-7 dark:border-white/10 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                  Subscription
                </p>
                <h2 className="mt-3 text-2xl font-semibold">
                  {hasActive ? "Stone plan" : "Plan status"}
                </h2>
              </div>
              <span
                className={`mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                  hasActive
                    ? "bg-[#e2eadc] text-[#405b36] dark:bg-[#263323] dark:text-[#c1d7b5]"
                    : "bg-black/5 text-neutral-600 dark:bg-white/10 dark:text-neutral-300"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    hasActive ? "bg-[#66864f]" : "bg-neutral-400"
                  }`}
                />
                {loading ? "Loading" : hasActive ? "Active" : "No active plan"}
              </span>
            </div>

            <dl className="mt-8 divide-y divide-black/10 border-y border-black/10 dark:divide-white/10 dark:border-white/10">
              <div className="flex items-center justify-between gap-4 py-4 text-sm">
                <dt className="text-neutral-500 dark:text-neutral-400">Account email</dt>
                <dd className="max-w-[60%] truncate text-right font-medium">
                  {user?.email ?? "-"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-4 text-sm">
                <dt className="text-neutral-500 dark:text-neutral-400">Subscription status</dt>
                <dd className="text-right font-medium">
                  {subscription?.cancel_at_period_end
                    ? "Ending"
                    : subscription?.status ?? "Not subscribed"}
                </dd>
              </div>
              {subscription?.current_period_end ? (
                <div className="flex items-center justify-between gap-4 py-4 text-sm">
                  <dt className="text-neutral-500 dark:text-neutral-400">
                    {subscription.cancel_at_period_end ? "Access until" : "Next renewal"}
                  </dt>
                  <dd className="text-right font-medium">
                    {formatDate(subscription.current_period_end)}
                  </dd>
                </div>
              ) : null}
            </dl>

            {error && !checkingCheckout && (
              <p className="mt-4 text-sm text-amber-700 dark:text-amber-300" role="status">
                Subscription details are temporarily unavailable.
              </p>
            )}
            {portalError && (
              <p className="mt-4 text-sm text-red-700 dark:text-red-300" role="alert">
                {portalError}
              </p>
            )}

            <button
              type="button"
              disabled={portalLoading}
              onClick={() => void handleManageBilling()}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-black/15 px-5 text-sm font-medium transition hover:bg-black/5 disabled:cursor-wait disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/5"
            >
              {portalLoading
                ? "Opening billing…"
                : user
                  ? "Manage billing"
                  : "Sign in to manage billing"}
            </button>
          </aside>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-5 text-xs text-neutral-500 dark:border-white/10 dark:text-neutral-400">
          <span>Stone account</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="transition hover:text-neutral-900 dark:hover:text-white"
          >
            Refresh subscription
          </button>
        </footer>
      </div>
    </main>
  );
}

export function CheckoutReturnModal() {
  const { user } = useUser();
  const { subscription, loading, hasActive, refresh } = useSubscription();
  const [checkoutStatus] = useState(() => readCheckoutReturn().status);
  const [open, setOpen] = useState(checkoutStatus !== null);

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

  const close = () => {
    clearCheckoutParams();
    setOpen(false);
  };

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

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-return-title"
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-[720px] overflow-y-auto rounded-2xl border border-black/10 bg-[#f8f8f5] text-neutral-950 shadow-[0_30px_100px_-25px_rgba(0,0,0,0.55)] dark:border-white/10 dark:bg-[#151716] dark:text-white"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close confirmation"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-neutral-500 transition hover:bg-black/5 hover:text-neutral-950 dark:border-white/15 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="grid md:grid-cols-[1fr_0.8fr]">
          <div className="px-6 py-9 sm:px-9 sm:py-11">
            <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-full bg-[#dce8d5] text-[#3d5c31] dark:bg-[#263323] dark:text-[#b8d6a9]">
              {isSuccess ? (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                  <path d="m5 12.5 4.5 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                  <path d="M12 8v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.8 3h14.8a2 2 0 0 0 1.8-3l-7.5-13.1a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#637b52]">
              {isSuccess ? "Payment received" : "Checkout"}
            </p>
            <h2 id="checkout-return-title" className="mt-3 max-w-[440px] font-display text-[clamp(32px,5vw,48px)] font-semibold leading-[1.03]">
              {isSuccess
                ? hasActive
                  ? "You're all set."
                  : "Thanks for choosing Stone."
                : "Checkout canceled."}
            </h2>
            <p className="mt-4 max-w-[420px] text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              {isSuccess
                ? hasActive
                  ? "Your Stone subscription is active. Your workspace is ready to go."
                  : "Your checkout is complete. Sign in to confirm your subscription and get started."
                : "No changes were made to your subscription. You can return to plans whenever you're ready."}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  close();
                  if (!user) navigate("signin");
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-neutral-950 px-5 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                {user ? "Continue to dashboard" : "Sign in to continue"}
              </button>
              <button
                type="button"
                onClick={() => void handleManageBilling()}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/15 px-5 text-sm font-medium transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
              >
                {hasActive ? "Manage billing" : user ? "View plans" : "Sign in"}
              </button>
            </div>
          </div>

          <aside className="border-t border-black/10 bg-black/[0.025] px-6 py-7 dark:border-white/10 dark:bg-white/[0.025] sm:px-9 md:border-l md:border-t-0 md:py-11">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
              Subscription
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">Stone plan</h3>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${hasActive ? "bg-[#e2eadc] text-[#405b36] dark:bg-[#263323] dark:text-[#c1d7b5]" : "bg-black/5 text-neutral-600 dark:bg-white/10 dark:text-neutral-300"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${hasActive ? "bg-[#66864f]" : "bg-neutral-400"}`} />
                {loading ? "Checking" : hasActive ? "Active" : "Pending"}
              </span>
            </div>

            <dl className="mt-7 divide-y divide-black/10 border-y border-black/10 dark:divide-white/10 dark:border-white/10">
              <div className="flex items-center justify-between gap-4 py-4 text-sm">
                <dt className="text-neutral-500 dark:text-neutral-400">Email</dt>
                <dd className="max-w-[65%] truncate text-right font-medium">{user?.email ?? "Sign in required"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-4 text-sm">
                <dt className="text-neutral-500 dark:text-neutral-400">Status</dt>
                <dd className="text-right font-medium">{subscription?.status ?? "Awaiting confirmation"}</dd>
              </div>
            </dl>

            {isSuccess && !hasActive && (
              <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400" role="status">
                Subscription details may take a moment to sync. This page checks for updates automatically.
              </p>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}