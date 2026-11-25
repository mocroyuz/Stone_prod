import { useState, type FormEvent } from "react";

import { navigate } from "../hooks/useHashRoute";
import { useTheme } from "../hooks/useTheme";
import { requestPasswordReset } from "../services/supabase";

/* ============================================================
   FORGOT PASSWORD
   ============================================================ */

export default function ForgotPassword() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* ----------------------------------------------------------
     SUBMIT
     ---------------------------------------------------------- */

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setSentMessage(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setEmailError("Enter a valid email address.");
      return;
    }

    setEmailError("");
    setLoading(true);

    try {
      const message = await requestPasswordReset(email);
      setSentMessage(message);
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "Could not send the reset link. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------------------------------------------
     RENDER
     ---------------------------------------------------------- */

  return (
    <main
      className={[
        "auth-page relative min-h-screen w-full transition-colors duration-500",
        isDark ? "auth-dark bg-[#09090a]" : "auth-light bg-[#f3f1ed]",
      ].join(" ")}
    >
      <div className="absolute top-[clamp(16px,2vw,30px)] right-[clamp(16px,2vw,30px)] z-20 flex gap-2">
        <button
          type="button"
          onClick={() => navigate("")}
          aria-label="Back to home"
          title="Back to home"
          className="back-button flex h-[clamp(36px,3.4vw,44px)] w-[clamp(36px,3.4vw,44px)] cursor-pointer items-center justify-center rounded-full border backdrop-blur-md transition-colors duration-200"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5" />
            <path d="m11 6-6 6 6 6" />
          </svg>
        </button>
      </div>

      <div
        className={[
          "grid min-h-screen w-full md:grid-cols-2",
          isDark ? "bg-[#09090a]" : "bg-[#f3f1ed]",
        ].join(" ")}
      >
        {/* ---------------- LEFT PANEL ---------------- */}

        <div className="auth-panel hidden p-[clamp(12px,1.4vw,22px)] md:block">
          <div
            className="relative flex h-full flex-col justify-end overflow-hidden rounded-[clamp(18px,2vw,28px)] p-[clamp(22px,3vw,48px)]"
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

            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <h1
                  className={[
                    "font-display text-[clamp(28px,3vw,44px)] leading-[1.15] font-medium tracking-[-0.02em]",
                    isDark ? "text-white" : "text-neutral-900",
                  ].join(" ")}
                >
                  Forgot
                  <br />
                  password?
                </h1>
              </div>

              <div className="mt-[clamp(24px,3.2vw,44px)] rounded-[clamp(12px,1.2vw,16px)] bg-white p-[clamp(12px,1.2vw,18px)] shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)]">
                <span className="flex h-[clamp(22px,2vw,28px)] w-[clamp(22px,2vw,28px)] items-center justify-center rounded-full bg-neutral-900 text-[clamp(11px,0.95vw,13px)] font-semibold text-white">
                  1
                </span>

                <p className="mt-[clamp(24px,2.6vw,38px)] text-[clamp(11.5px,1vw,14px)] leading-[1.35] font-medium text-neutral-900">
                  Recover access
                  <br />
                  to your account
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- RIGHT PANEL ---------------- */}

        <div
          className={[
            "flex items-center justify-center px-[clamp(20px,4vw,56px)] py-[clamp(36px,5vw,64px)]",
            isDark ? "bg-[#09090a]" : "bg-[#f3f1ed]",
          ].join(" ")}
        >
          <div className="w-full max-w-[380px]">
            <h2
              className={[
                "text-center font-display text-[clamp(20px,1.7vw,26px)] font-semibold tracking-[-0.01em]",
                isDark ? "text-white" : "text-neutral-900",
              ].join(" ")}
            >
              Reset Password
            </h2>

            <p
              className={[
                "mt-2 text-center text-[clamp(11.5px,0.95vw,13.5px)]",
                isDark ? "text-neutral-400" : "text-neutral-600",
              ].join(" ")}
            >
              Enter the email associated with your account to request a reset link.
            </p>

            <div className="mt-5">
              {serverError && (
                <div
                  role="alert"
                  className="mb-3.5 rounded-[9px] border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-red-300"
                >
                  {serverError}{" "}
                  <button
                    type="button"
                    onClick={() => navigate("faq")}
                    className="cursor-pointer font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                  >
                    Visit the support FAQs
                  </button>
                </div>
              )}

              {sentMessage && (
                <div
                  role="status"
                  className="mb-3.5 rounded-[9px] border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-emerald-300"
                >
                  {sentMessage} Check your inbox (and your spam folder).
                </div>
              )}

              <form onSubmit={submit} noValidate className="space-y-3.5">
                <label className="block">
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
                      setServerError(null);
                      setSentMessage(null);
                    }}
                    placeholder="eg. johnfrans@gmail.com"
                    autoComplete="email"
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? "recovery-email-error" : undefined}
                    className={`w-full rounded-[9px] border bg-[#1c1c1e] px-3.5 py-[clamp(9px,0.9vw,12px)] text-[clamp(12.5px,1vw,14px)] text-white outline-none placeholder:text-neutral-500 transition focus:border-neutral-500 ${
                      emailError ? "border-red-500/70" : "border-white/10"
                    } focus-visible:ring-2 focus-visible:ring-white/60`}
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

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 w-full cursor-pointer rounded-[10px] bg-white py-[clamp(10px,0.95vw,13px)] text-[clamp(12.5px,1vw,14.5px)] font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {loading ? "Sending..." : sentMessage ? "Resend reset link" : "Send reset link"}
                </button>
              </form>
            </div>

            <p
              className={[
                "mt-5 text-center text-[clamp(11.5px,0.95vw,13.5px)]",
                isDark ? "text-neutral-400" : "text-neutral-600",
              ].join(" ")}
            >
              Remember your password?{" "}
              <button
                type="button"
                onClick={() => navigate("signin")}
                className={[
                  "cursor-pointer font-semibold",
                  isDark ? "text-white" : "text-neutral-900",
                ].join(" ")}
              >
                Log in
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}