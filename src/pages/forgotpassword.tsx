import { useState, type FormEvent } from "react";

import { navigate } from "../hooks/useHashRoute";
import { useTheme } from "../hooks/useTheme";

export default function ForgotPassword() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [requestError, setRequestError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setEmailError("Enter a valid email address.");
      return;
    }

    setEmailError("");
    setRequestError(
      "No reset email was sent. Password recovery is not configured on the authentication server yet. Please contact support for help signing in.",
    );
  }

  const panelText = isDark ? "text-white" : "text-neutral-900";

  return (
    <main
      className={[
        "auth-page relative min-h-screen w-full transition-colors duration-500",
        isDark ? "auth-dark bg-[#09090a]" : "auth-light bg-[#f3f1ed]",
      ].join(" ")}
    >
      <div
        className={[
          "grid min-h-screen w-full md:grid-cols-2",
          isDark ? "bg-[#09090a]" : "bg-[#f3f1ed]",
        ].join(" ")}
      >
        <aside className="auth-panel hidden p-[clamp(12px,1.4vw,22px)] md:block">
          <div
            className="relative flex h-full min-h-[620px] flex-col justify-end overflow-hidden rounded-[clamp(18px,2vw,28px)] p-[clamp(22px,3vw,48px)]"
            style={{
              background:
                "radial-gradient(120% 95% at 18% 42%, #9a9a9e 0%, #5d5d62 34%, #2a2a2d 64%, #131315 100%)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(85% 68% at 12% 34%, rgba(255,255,255,0.92) 0%, rgba(214,214,218,0.55) 22%, rgba(90,90,95,0.45) 48%, rgba(16,16,18,0.92) 78%, #0b0b0c 100%)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                background:
                  "linear-gradient(158deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 28%, rgba(0,0,0,0) 52%)",
              }}
            />

            <div className="relative max-w-[520px]">
              <div className="mb-7 flex items-center gap-3">
                <img
                  src="/images/icon.png"
                  alt=""
                  aria-hidden="true"
                  className="h-8 w-auto object-contain dark:invert"
                />
                <span className={`font-display text-lg font-bold tracking-[-0.03em] ${panelText}`}>
                  Stone
                  <sup className="ml-0.5 align-super text-[9px] font-medium tracking-normal">
                    ®
                  </sup>
                </span>
              </div>

              <h1
                className={[
                  "font-display text-[clamp(28px,3vw,44px)] leading-[1.15] font-medium tracking-[-0.02em]",
                  panelText,
                ].join(" ")}
              >
                A fresh start,
                <br />
                just one step away.
              </h1>

              <div className="mt-[clamp(24px,3.2vw,44px)] max-w-[340px] rounded-[clamp(12px,1.2vw,16px)] bg-white p-[clamp(16px,1.6vw,22px)] shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)]">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-white">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="4.5" y="10" width="15" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    <path d="M12 14v2" />
                  </svg>
                </span>
                <p className="mt-6 text-sm leading-relaxed font-medium text-neutral-900">
                  Keep your account secure. We’ll help you get back in.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section
          className={[
            "flex items-center justify-center px-[clamp(20px,4vw,56px)] py-[clamp(48px,5vw,72px)]",
            isDark ? "bg-[#09090a]" : "bg-[#f3f1ed]",
          ].join(" ")}
        >
          <div className="w-full max-w-[400px]">
            <div className="mb-10 flex items-center justify-center gap-2.5 md:hidden">
              <img
                src="/images/icon.png"
                alt=""
                aria-hidden="true"
                className="h-7 w-auto object-contain dark:invert"
              />
              <span className={`font-display text-lg font-bold tracking-[-0.03em] ${panelText}`}>
                Stone
                <sup className="ml-0.5 align-super text-[9px] font-medium tracking-normal">
                  ®
                </sup>
              </span>
            </div>

            <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.06] text-white">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3.5 7.5 12 13l8.5-5.5" />
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
              </svg>
            </div>

            <h2
              className={[
                "font-display text-[clamp(22px,2vw,28px)] font-semibold tracking-[-0.02em]",
                panelText,
              ].join(" ")}
            >
              Forgot your password?
            </h2>
            <p
              className={[
                "mt-2 text-[clamp(12px,1vw,14px)] leading-relaxed",
                isDark ? "text-neutral-400" : "text-neutral-600",
              ].join(" ")}
            >
              Enter the email address associated with your account to request a password reset link.
            </p>

            <form onSubmit={submit} noValidate className="mt-8 space-y-4">
              <label htmlFor="recovery-email" className="block">
                <span
                  className={[
                    "mb-1.5 block text-[clamp(11.5px,0.95vw,13px)] font-medium",
                    isDark ? "text-neutral-300" : "text-neutral-700",
                  ].join(" ")}
                >
                  Email
                </span>
                <input
                  id="recovery-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setEmailError("");
                    setRequestError("");
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? "recovery-email-error" : undefined}
                  className={[
                    "w-full rounded-[9px] border bg-[#1c1c1e] px-3.5 py-[clamp(10px,0.9vw,12px)] text-[clamp(12.5px,1vw,14px)] text-white outline-none placeholder:text-neutral-500 transition focus:border-neutral-500 focus-visible:ring-2 focus-visible:ring-white/60",
                    emailError ? "border-red-500/70" : "border-white/10",
                  ].join(" ")}
                />
                {emailError && (
                  <span
                    id="recovery-email-error"
                    className="mt-1 block text-[11px] text-red-400"
                  >
                    {emailError}
                  </span>
                )}
              </label>

              {requestError && (
                <div
                  role="alert"
                  className="rounded-[9px] border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-[12px] leading-relaxed text-red-700 dark:text-red-300"
                >
                  {requestError}{" "}
                  <button
                    type="button"
                    onClick={() => navigate("faq")}
                    className="font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                  >
                    Visit the support FAQs
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="w-full cursor-pointer rounded-[10px] bg-white py-[clamp(11px,0.95vw,13px)] text-[clamp(12.5px,1vw,14.5px)] font-semibold text-neutral-900 transition hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Send reset link
              </button>
            </form>

            <button
              type="button"
              onClick={() => navigate("signin")}
              className={[
                "mt-6 flex w-full cursor-pointer items-center justify-center gap-2 py-2 text-[12px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
                isDark ? "text-neutral-400 hover:text-white" : "text-neutral-600 hover:text-neutral-900",
              ].join(" ")}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5" />
                <path d="m11 6-6 6 6 6" />
              </svg>
              Back to sign in
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
