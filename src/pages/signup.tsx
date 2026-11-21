
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { navigate } from "../hooks/useHashRoute";
import { useTheme } from "../hooks/useTheme";
import { useUser } from "../contexts/UserContext";
import {
  signUp,
  signIn,
  clearSession,
  signInWithGoogle,
  signInWithGithub,
} from "../services/supabase";

/* ============================================================
   CONFIG
   ============================================================ */

const DASHBOARD_ROUTE = "home";
const POLL_INTERVAL = 4000;

/* ============================================================
   URL PARAMS
   ============================================================ */

function readUrlParams(): URLSearchParams {
  const params = new URLSearchParams();

  if (typeof window === "undefined") return params;

  new URLSearchParams(window.location.search).forEach((value, key) => {
    params.set(key, value);
  });

  const rawHash = window.location.hash || "";
  const qIdx = rawHash.indexOf("?");

  if (qIdx !== -1) {
    new URLSearchParams(rawHash.slice(qIdx + 1)).forEach((value, key) => {
      params.set(key, value);
    });
  }

  return params;
}

/* ============================================================
   NAVIGATION AFTER VERIFICATION
   ============================================================ */

function navigateAfterVerification(): void {
  const params = readUrlParams();
  const next = params.get("next");
  const plan = params.get("plan");
  const period = params.get("period");

  if (next) {
    if (next === "/pricing" || next === "pricing") {
      const query = new URLSearchParams();

      if (plan) query.set("plan", plan);
      if (period) query.set("period", period);

      const qs = query.toString();

      navigate(`/pricing${qs ? `?${qs}` : ""}`);

      return;
    }

    if (next.startsWith("/") && !next.startsWith("//")) {
      navigate(next);
      return;
    }
  }

  navigate(DASHBOARD_ROUTE);
}

/* ============================================================
   STEPS
   ============================================================ */

const STEPS = [
  { n: 1, label: "Sign up your\naccount" },
  { n: 2, label: "Complete the\nOnboarding" },
  { n: 3, label: "Enjoy your free\nweek Stone" },
];

/* ============================================================
   ICONS
   ============================================================ */

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px]"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.15c1.85-1.7 2.9-4.2 2.9-7.42Z"
      />
      <path
        fill="#34A853"
        d="M12 21.75c2.64 0 4.85-.87 6.46-2.36l-3.15-2.45c-.87.58-1.98.93-3.31.93-2.55 0-4.7-1.72-5.47-4.04H3.28v2.53A9.75 9.75 0 0 0 12 21.75Z"
      />
      <path
        fill="#FBBC05"
        d="M6.53 13.83A5.86 5.86 0 0 1 6.22 12c0-.64.11-1.26.31-1.83V7.64H3.28A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.06 1.03 4.36l3.25-2.53Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.13c1.44 0 2.73.5 3.75 1.48l2.81-2.81C16.84 3.23 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.72 5.39l3.25 2.53C7.3 7.85 9.45 6.13 12 6.13Z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85l-.01 2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="m4 20 16-16" />
    </svg>
  );
}

/* ============================================================
   LOADING
   ============================================================ */

function LoadingDots() {
  return (
    <span
      className="inline-flex items-center gap-1"
      role="status"
      aria-label="Waiting for verification"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="dot-wave h-1.5 w-1.5 rounded-full bg-neutral-400"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

/* ============================================================
   FIELD
   ============================================================ */

type FieldProps = {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  error?: string;
  trailing?: ReactNode;
};

function Field({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
  error,
  trailing,
}: FieldProps) {
  return (
    <div className="block">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[clamp(11.5px,0.95vw,13px)] font-medium text-neutral-300"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={[
            "w-full rounded-[9px] border bg-[#1c1c1e]",
            "px-3.5 py-[clamp(9px,0.9vw,12px)]",
            "text-[clamp(12.5px,1vw,14px)] text-white",
            "outline-none placeholder:text-neutral-500",
            "transition focus:border-neutral-500 focus-visible:ring-2 focus-visible:ring-white/60",
            trailing ? "pr-10" : "",
            error ? "border-red-500/70" : "border-white/10",
          ].join(" ")}
        />

        {trailing && (
          <span className="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-500">
            {trailing}
          </span>
        )}
      </div>

      {error && (
        <span
          id={`${id}-error`}
          className="mt-1 block text-[11px] text-red-400"
        >
          {error}
        </span>
      )}
    </div>
  );
}

/* ============================================================
   OAUTH ERROR
   ============================================================ */

function readOAuthErrorFromHash(): string | null {
  if (typeof window === "undefined") return null;

  const queryError = new URLSearchParams(window.location.search).get("oauth_error");
  if (queryError) return queryError;

  const raw = window.location.hash;
  const idx = raw.indexOf("?");

  if (idx === -1) return null;

  const params = new URLSearchParams(raw.slice(idx + 1));
  return params.get("oauth_error");
}

/* ============================================================
   ERROR HELPERS
   ============================================================ */

function isExistingAccountError(error: unknown): boolean {
  const e = error as {
    message?: string;
    code?: string;
    status?: number;
  };

  const message = (e?.message ?? "").toLowerCase();
  const code = e?.code ?? "";

  return (
    code === "user_already_exists" ||
    code === "email_exists" ||
    code === "23505" ||
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("user already") ||
    message.includes("email address is already") ||
    message.includes("duplicate key") ||
    message.includes("unique constraint")
  );
}

/* ============================================================
   SIGNUP
   ============================================================ */

export default function Signup() {
  const { theme } = useTheme();
  const { refreshUser } = useUser();
  const isDark = theme === "dark";

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");

  const [email, setEmail] = useState(
    () => readUrlParams().get("email") ?? "",
  );

  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [serverError, setServerError] = useState<string | null>(
    () => readOAuthErrorFromHash(),
  );

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  const [pendingVerification, setPendingVerification] = useState(false);
  const [verified, setVerified] = useState(false);

  const proceededRef = useRef(false);

  const proceed = () => {
    if (proceededRef.current) return;

    proceededRef.current = true;
    navigateAfterVerification();
  };

  /* ============================================================
     CHECK EMAIL VERIFICATION
     ============================================================ */

  useEffect(() => {
    if (!pendingVerification || verified) return;

    let stopped = false;
    let running = false;

    const check = async () => {
      if (stopped || running) return;

      running = true;

      try {
        const result = await signIn(email.trim(), password);

        if (stopped) return;

        const user = await refreshUser();
        const confirmedAt =
          result.user?.email_confirmed_at ?? user?.email_confirmed_at;

        if (stopped) return;

        if (result.session && confirmedAt && user) {
          stopped = true;
          setVerified(true);
        } else {
          await Promise.resolve(clearSession());
        }
      } catch {
        // The email may not have been verified yet.
        // Retry on the next interval.
      } finally {
        running = false;
      }
    };

    // Check immediately instead of waiting four seconds.
    void check();

    const intervalId = window.setInterval(check, POLL_INTERVAL);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void check();
      }
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pendingVerification, verified, email, password]);

  /* ============================================================
     SUBMIT
     ============================================================ */

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading || googleLoading || githubLoading) return;

    setServerError(null);

    const next: Record<string, string> = {};
    const normalizedEmail = email.trim();

    if (first.trim().length < 2) {
      next.first = "Enter at least 2 characters.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail)) {
      next.email = "Enter a valid email address.";
    }

    if (password.length < 8) {
      next.password = "Must be at least 8 characters.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) return;

    setLoading(true);

    try {
      const result = await signUp(
        normalizedEmail,
        password,
        first.trim(),
        last.trim(),
      );

      /*
       * Some Supabase configurations return a user with
       * an empty identities array for an existing email.
       */
      const existingAccount =
        result.user?.identities != null &&
        result.user.identities.length === 0;

      if (existingAccount) {
        setServerError(
          "An account may already exist with this email. Please log in instead.",
        );
        return;
      }

      /*
       * The account is already confirmed and has a session.
       */
      if (result.session && result.user?.email_confirmed_at) {
        proceed();
        return;
      }

      /*
       * A new signup normally returns a user even when
       * email confirmation is required.
       */
      if (result.user) {
        await Promise.resolve(clearSession());
        setPendingVerification(true);
        return;
      }

      /*
       * Do not send the user to the verification screen
       * when Supabase returns no user.
       */
      setServerError(
        "We couldn't complete signup. Please try logging in or try again.",
      );
    } catch (error) {
      console.error("Signup error:", error);

      if (isExistingAccountError(error)) {
        setServerError(
          "An account already exists with this email. Please log in instead.",
        );
      } else {
        const message =
          error instanceof Error ? error.message : "";

        setServerError(
          message ||
            "Unable to create your account. Please check your connection and try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     GOOGLE
     ============================================================ */

  const handleGoogle = async () => {
    if (loading || googleLoading || githubLoading) return;

    setServerError(null);
    setGoogleLoading(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      setGoogleLoading(false);

      setServerError(
        error instanceof Error
          ? error.message
          : "Could not start Google sign-in.",
      );
    }
  };

  /* ============================================================
     GITHUB
     ============================================================ */

  const handleGithub = async () => {
    if (loading || googleLoading || githubLoading) return;

    setServerError(null);
    setGithubLoading(true);

    try {
      await signInWithGithub();
    } catch (error) {
      setGithubLoading(false);

      setServerError(
        error instanceof Error
          ? error.message
          : "Could not start GitHub sign-in.",
      );
    }
  };

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <main
      className={[
        "auth-page relative min-h-screen w-full transition-colors duration-500",
        isDark ? "auth-dark bg-[#09090a]" : "auth-light bg-[#f3f1ed]",
      ].join(" ")}
    >
      <style>{`
        @keyframes cta-pop {
          0% { transform: scale(0.85); opacity: 0.5; }
          60% { transform: scale(1.06); }
          100% { transform: scale(1); opacity: 1; }
        }

        .cta-pop {
          animation: cta-pop 0.45s ease-out;
        }

        @keyframes dot-wave {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.35;
          }
          40% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }

        .dot-wave {
          animation: dot-wave 1.2s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .cta-pop {
            animation: none;
          }
          .dot-wave {
            animation: none;
            opacity: 0.7;
          }
        }
      `}</style>

      {/* BACK BUTTON */}
      <div className="absolute top-[clamp(16px,2vw,30px)] right-[clamp(16px,2vw,30px)] z-20 flex gap-2">
        <button
          type="button"
          onClick={() => navigate("")}
          aria-label="Back to home"
          title="Back to home"
          className="back-button flex h-[clamp(36px,3.4vw,44px)] w-[clamp(36px,3.4vw,44px)] cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-white backdrop-blur-md transition-colors duration-200 hover:bg-white/10"
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
        {/* LEFT PANEL */}
        <div className="auth-panel hidden p-[clamp(12px,1.4vw,22px)] md:block">
          <div
            className="relative flex h-full flex-col justify-end overflow-hidden rounded-[clamp(18px,2vw,28px)] p-[clamp(22px,3vw,48px)]"
            style={{
              background: isDark
                ? "radial-gradient(120% 95% at 18% 42%, #9a9a9e 0%, #5d5d62 34%, #2a2a2d 64%, #131315 100%)"
                : "radial-gradient(120% 95% at 18% 42%, #e8e6e1 0%, #cfccc5 34%, #b3afa6 64%, #8f8b82 100%)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: isDark
                  ? "radial-gradient(85% 68% at 12% 34%, rgba(255,255,255,0.92) 0%, rgba(214,214,218,0.55) 22%, rgba(90,90,95,0.45) 48%, rgba(16,16,18,0.92) 78%, #0b0b0c 100%)"
                  : "radial-gradient(85% 68% at 12% 34%, rgba(255,255,255,0.98) 0%, rgba(240,238,233,0.7) 22%, rgba(200,196,188,0.5) 48%, rgba(150,146,138,0.85) 78%, #a5a29a 100%)",
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
              <h1
                className={[
                  "font-display text-[clamp(28px,3vw,44px)] leading-[1.15] font-medium tracking-[-0.02em]",
                  isDark ? "text-white" : "text-neutral-900",
                ].join(" ")}
              >
                Get Started
                <br />
                with Us
              </h1>

              <div className="mt-[clamp(24px,3.2vw,44px)] grid grid-cols-3 gap-[clamp(10px,1vw,14px)]">
                {STEPS.map((step, index) => {
                  const active = index === 0;

                  return (
                    <div
                      key={step.n}
                      className={[
                        "rounded-[clamp(12px,1.2vw,16px)]",
                        "p-[clamp(12px,1.2vw,18px)]",
                        "backdrop-blur-sm transition",
                        active
                          ? "bg-white shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)]"
                          : isDark
                            ? "bg-white/12 ring-1 ring-white/10"
                            : "bg-white/60 ring-1 ring-black/5",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-[clamp(22px,2vw,28px)] w-[clamp(22px,2vw,28px)]",
                          "items-center justify-center rounded-full",
                          "text-[clamp(11px,0.95vw,13px)] font-semibold",
                          active
                            ? "bg-neutral-900 text-white"
                            : isDark
                              ? "bg-white/25 text-white/90"
                              : "bg-white/80 text-black",
                        ].join(" ")}
                      >
                        {step.n}
                      </span>

                      <p
                        className={[
                          "mt-[clamp(24px,2.6vw,38px)] whitespace-pre-line",
                          "text-[clamp(11.5px,1vw,14px)] leading-[1.35] font-medium",
                          active
                            ? "text-neutral-900"
                            : isDark
                              ? "text-white/85"
                              : "text-neutral-800",
                        ].join(" ")}
                      >
                        {step.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div
          className={[
            "flex items-center justify-center",
            "px-[clamp(20px,4vw,56px)]",
            "py-[clamp(36px,5vw,64px)]",
            isDark ? "bg-[#09090a]" : "bg-[#f3f1ed]",
          ].join(" ")}
        >
          <div className="w-full max-w-[380px]">
            {pendingVerification ? (
              /* EMAIL VERIFICATION */
              <div className="text-center">
                <div
                  className={[
                    "mx-auto flex h-14 w-14 items-center justify-center rounded-full transition-colors",
                    verified && !isDark ? "email-verified-icon" : "",
                    verified
                      ? isDark
                        ? "bg-white text-neutral-900"
                        : "bg-black text-white"
                      : isDark
                        ? "bg-white/10 text-neutral-300"
                        : "bg-black/10 text-neutral-700",
                  ].join(" ")}
                >
                  {verified ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m5 12.5 4.2 4.2L19 7" />
                    </svg>
                  ) : (
                    <LoadingDots />
                  )}
                </div>

                <h2
                  className={[
                    "mt-5 font-display text-[19px] font-semibold",
                    isDark ? "text-white" : "text-neutral-900",
                  ].join(" ")}
                >
                  {verified ? "Email verified" : "Check your email"}
                </h2>

                <p
                  className={[
                    "mt-2 text-[12px] leading-relaxed",
                    isDark ? "text-neutral-400" : "text-neutral-600",
                  ].join(" ")}
                >
                  {verified ? (
                    "Your account is active. You can continue."
                  ) : (
                    <>
                      We sent a verification link to{" "}
                      <span
                        className={
                          isDark ? "text-white" : "text-neutral-900"
                        }
                      >
                        {email}
                      </span>
                      . Click it to activate your account.
                    </>
                  )}
                </p>

                <button
                  key={verified ? "on" : "off"}
                  type="button"
                  onClick={proceed}
                  disabled={!verified}
                  className={[
                    "mx-auto mt-6 block w-full max-w-[180px] rounded-lg py-2 text-[13px] font-semibold",
                    "transition-all duration-300 ease-out",
                    verified
                      ? [
                          "cta-pop cursor-pointer active:scale-95 hover:-translate-y-0.5",
                          isDark
                            ? "bg-white text-neutral-900 hover:bg-neutral-200"
                            : "bg-black text-white hover:bg-neutral-800",
                        ].join(" ")
                      : "cursor-not-allowed bg-neutral-700 text-neutral-400",
                  ].join(" ")}
                >
                  Continue
                </button>
              </div>
            ) : (
              /* SIGNUP FORM */
              <>
                <h2
                  className={[
                    "text-center font-display text-[clamp(20px,1.7vw,26px)] font-semibold tracking-[-0.01em]",
                    isDark ? "text-white" : "text-neutral-900",
                  ].join(" ")}
                >
                  Sign Up Account
                </h2>

                <p
                  className={[
                    "mt-2 text-center text-[clamp(11.5px,0.95vw,13.5px)]",
                    isDark ? "text-neutral-400" : "text-neutral-600",
                  ].join(" ")}
                >
                  Enter your personal data to create your account.
                </p>

                {/* OAUTH */}
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={googleLoading || githubLoading || loading}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-neutral-800 py-2 text-[13px] font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-neutral-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <GoogleIcon />
                    <span>
                      {googleLoading ? "Redirecting…" : "Google"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGithub}
                    disabled={githubLoading || googleLoading || loading}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-neutral-800 py-2 text-[13px] font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-neutral-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <GithubIcon />
                    <span>
                      {githubLoading ? "Redirecting…" : "Github"}
                    </span>
                  </button>
                </div>

                <div className="my-4 flex items-center gap-3">
                  <span
                    className={`h-px flex-1 ${isDark ? "bg-white/10" : "bg-black/10"}`}
                  />
                  <span className="text-[11px] text-neutral-500">Or</span>
                  <span
                    className={`h-px flex-1 ${isDark ? "bg-white/10" : "bg-black/10"}`}
                  />
                </div>

                {serverError && (
                  <div
                    role="alert"
                    className="mb-3.5 rounded-[9px] border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[12.5px] text-red-300"
                  >
                    {serverError}

                    <button
                      type="button"
                      onClick={() => navigate("signin")}
                      className="ml-1 font-semibold underline underline-offset-2 hover:text-white"
                    >
                      Log in
                    </button>
                  </div>
                )}

                <form
                  onSubmit={submit}
                  noValidate
                  className="space-y-3.5"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      id="signup-first-name"
                      label="First Name"
                      placeholder="eg. John"
                      value={first}
                      onChange={setFirst}
                      autoComplete="given-name"
                      error={errors.first}
                    />

                    <Field
                      id="signup-last-name"
                      label="Last Name"
                      placeholder="eg. Francisco"
                      value={last}
                      onChange={setLast}
                      autoComplete="family-name"
                      error={errors.last}
                    />
                  </div>

                  <Field
                    id="signup-email"
                    label="Email"
                    type="email"
                    placeholder="eg. johnfrans@gmail.com"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                    error={errors.email}
                  />

                  <Field
                    id="signup-password"
                    label="Password"
                    type={show ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                    error={errors.password}
                    trailing={
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setShow((value) => !value)}
                        aria-label={
                          show ? "Hide password" : "Show password"
                        }
                        title={
                          show ? "Hide password" : "Show password"
                        }
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition hover:bg-white/10 hover:text-neutral-200"
                      >
                        {show ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    }
                  />

                  {!errors.password && (
                    <p className="mt-1.5 text-xs text-neutral-500">
                      Must be at least 8 characters.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || googleLoading || githubLoading}
                    className={[
                      "mt-1 w-full cursor-pointer rounded-lg py-2.5 text-[13px] font-semibold",
                      "transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      isDark
                        ? "bg-white text-neutral-900 hover:bg-neutral-200"
                        : "bg-black text-white hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    {loading ? "Creating your account..." : "Sign Up"}
                  </button>
                </form>

                <p
                  className={[
                    "mt-5 text-center text-[clamp(11.5px,0.95vw,13.5px)]",
                    isDark ? "text-neutral-400" : "text-neutral-600",
                  ].join(" ")}
                >
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("signin")}
                    className={[
                      "cursor-pointer font-semibold",
                      isDark
                        ? "text-white hover:text-neutral-300"
                        : "text-neutral-900 hover:text-neutral-600",
                    ].join(" ")}
                  >
                    Log in
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
