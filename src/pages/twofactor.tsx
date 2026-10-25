import { useEffect, useRef, useState, type ReactNode } from "react";

import { navigate } from "../hooks/useHashRoute";
import { useTheme } from "../hooks/useTheme";
import { useUser } from "../contexts/UserContext";
import {
  getMfaStatus,
  isMfaPending,
  isRateLimitError,
  listMfaFactors,
  sendEmailMfaCode,
  signOut,
  verifyEmailMfaCode,
  verifyMfaLogin,
  type MfaFactor,
  type MfaMethod,
} from "../services/supabase";
import { navigateAfterSignin } from "../utils/authNavigation";

const CODE_LENGTH = 6;
const TOTP_RE = /^\d{6}$/;

const formatWait = (seconds: number) =>
  seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} s`;

/* -------------------------------------------------------------------------- */
/*  Theme tokens                                                              */
/* -------------------------------------------------------------------------- */

const tokens = (isDark: boolean) =>
  isDark
    ? {
        card: "border-white/10 bg-[#111113]",
        title: "text-white",
        muted: "text-neutral-400",
        label: "text-neutral-300",
        iconWrap: "bg-white text-neutral-900",
        field:
          "border-white/10 bg-[#1c1c1e] text-white placeholder:text-neutral-600 focus:border-neutral-400 focus:ring-2 focus:ring-white/10",
        cellFilled: "border-white/30",
        primary:
          "bg-white text-neutral-900 hover:bg-neutral-200 focus-visible:outline-white",
        ghost: "text-neutral-500 hover:text-neutral-200",
        focusRing: "focus-visible:outline-white",
        track: "bg-white/10",
      }
    : {
        card: "border-black/10 bg-white",
        title: "text-neutral-900",
        muted: "text-neutral-600",
        label: "text-neutral-700",
        iconWrap: "bg-neutral-900 text-white",
        field:
          "border-black/10 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-black/5",
        cellFilled: "border-black/30",
        primary:
          "bg-neutral-900 text-white hover:bg-neutral-700 focus-visible:outline-neutral-900",
        ghost: "text-neutral-500 hover:text-neutral-900",
        focusRing: "focus-visible:outline-neutral-900",
        track: "bg-black/10",
      };

/* -------------------------------------------------------------------------- */
/*  Icons                                                                     */
/* -------------------------------------------------------------------------- */

function Icon({
  children,
  className = "h-5 w-5",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Trois points qui "chargent" (même animation que la page d'inscription). */
function LoadingDots() {
  return (
    <span
      className="inline-flex items-center gap-1"
      role="status"
      aria-label="Waiting for verification code"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="dot-wave h-1.5 w-1.5 rounded-full bg-current"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

/** Flèche de validation (coche) affichée quand le code est accepté. */
const CheckIcon = () => (
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
);

const Spinner = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={`${className} animate-spin`}
    fill="none"
    aria-hidden
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeOpacity="0.25"
      strokeWidth="3"
    />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

/* -------------------------------------------------------------------------- */
/*  OTP input (6 separate cells, paste / autofill / keyboard friendly)        */
/* -------------------------------------------------------------------------- */

function OtpInput({
  value,
  onChange,
  disabled,
  invalid,
  isDark,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  invalid: boolean;
  isDark: boolean;
}) {
  const ui = tokens(isDark);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const focusAt = (index: number) => {
    const el = refs.current[Math.min(Math.max(index, 0), CODE_LENGTH - 1)];
    el?.focus();
    el?.select();
  };

  // (Re)focus the first empty cell whenever the field is empty and usable.
  useEffect(() => {
    if (!disabled && value === "") focusAt(0);
  }, [disabled, value]);

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");

    if (!digits) {
      onChange(value.slice(0, index) + value.slice(index + 1));
      return;
    }

    // Single digit replaces the cell; several digits (autofill / paste) spread out.
    const next =
      digits.length === 1
        ? value.slice(0, index) + digits + value.slice(index + 1)
        : (value.slice(0, index) + digits).slice(0, CODE_LENGTH);

    onChange(next.slice(0, CODE_LENGTH));
    focusAt(Math.min(index + digits.length, CODE_LENGTH - 1));
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && !value[index] && index > 0) {
      event.preventDefault();
      onChange(value.slice(0, index - 1));
      focusAt(index - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const digits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, CODE_LENGTH);
    if (!digits) return;
    event.preventDefault();
    onChange(digits);
    focusAt(digits.length);
  };

  return (
    <div
      role="group"
      aria-label="6-digit verification code"
      className="flex justify-center gap-2 sm:gap-2.5"
    >
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
          aria-invalid={invalid}
          disabled={disabled}
          value={value[index] ?? ""}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => {
            // Never let the user skip ahead of the next empty cell.
            if (index > value.length) focusAt(value.length);
            else event.target.select();
          }}
          className={[
            "h-[52px] w-full max-w-[52px] min-w-0 rounded-xl border text-center font-mono text-[22px] font-semibold outline-none transition",
            "disabled:cursor-not-allowed disabled:opacity-60",
            ui.field,
            invalid
              ? "!border-red-500/70 !ring-2 !ring-red-500/15"
              : value[index]
                ? ui.cellFilled
                : "",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  MFA challenge : l'écran dépend de la méthode choisie (app ou email)       */
/* -------------------------------------------------------------------------- */

function MfaChallenge({
  isDark,
  onVerified,
  onCancel,
}: {
  isDark: boolean;
  onVerified: () => Promise<void>;
  onCancel: () => void;
}) {
  const ui = tokens(isDark);

  const [method, setMethod] = useState<MfaMethod | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [lockTotal, setLockTotal] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const busyRef = useRef(false);

  /* ----- charge la méthode choisie par l'utilisateur ------------------------ */
  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const status = await getMfaStatus();
        if (!mounted) return;

        const chosen: MfaMethod = status?.method ?? "totp";
        setMethod(chosen);

        if (chosen === "email") {
          setSentTo(status?.email_hint ?? null);
          // Envoi automatique (mémoïsé : un seul email même en StrictMode).
          const sent = await sendEmailMfaCode("login");
          if (!mounted) return;
          setSentTo(sent.sentTo ?? status?.email_hint ?? null);
          setResendAt(Date.now() + sent.resendIn * 1000);
          setNow(Date.now());
        } else {
          const list = await listMfaFactors();
          if (!mounted) return;
          setFactors(list);
          setFactorId(list[0]?.id ?? "");
        }
      } catch (e) {
        if (!mounted) return;
        if (isRateLimitError(e)) {
          setResendAt(Date.now() + e.retryAfterSeconds * 1000);
          setNow(Date.now());
        } else {
          setLoadError(
            e instanceof Error ? e.message : "Could not start verification.",
          );
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* ----- horloge (verrou rate-limit + délai de renvoi) ---------------------- */
  useEffect(() => {
    if (Math.max(lockedUntil, resendAt) <= Date.now()) return;

    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= Math.max(lockedUntil, resendAt)) window.clearInterval(timer);
    }, 250);

    return () => window.clearInterval(timer);
  }, [lockedUntil, resendAt]);

  const waitLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const resendLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const lockProgress =
    lockTotal > 0 ? Math.min(100, ((lockTotal - waitLeft) / lockTotal) * 100) : 0;
  const locked = waitLeft > 0;
  const valid = TOTP_RE.test(code);

  const fail = (message: string) => {
    setError(message);
    setShakeKey((key) => key + 1);
  };

  /* ----- vérification ------------------------------------------------------- */
  const submit = async () => {
    if (busyRef.current || locked || !method) return;

    if (!TOTP_RE.test(code)) {
      fail("Enter the 6-digit code.");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError(null);

    try {
      if (method === "email") await verifyEmailMfaCode(code);
      else await verifyMfaLogin(code, factorId || undefined);

      // Code valide : la coche remplace les points, puis on continue.
      setVerified(true);
      await new Promise((resolve) => window.setTimeout(resolve, 700));

      await onVerified();
    } catch (verificationError) {
      setVerified(false);
      if (isRateLimitError(verificationError)) {
        const seconds = verificationError.retryAfterSeconds;
        setLockTotal(seconds);
        setLockedUntil(Date.now() + seconds * 1000);
        setNow(Date.now());
      } else {
        const message =
          verificationError instanceof Error
            ? verificationError.message
            : "Verification failed.";
        fail(
          /invalid|code|expired/i.test(message)
            ? method === "email"
              ? "Invalid or expired code. Check your email or request a new one."
              : "Invalid code. Check your app and try again."
            : message,
        );
      }
      setCode("");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // Auto-submit as soon as the 6th digit is entered.
  useEffect(() => {
    if (code.length === CODE_LENGTH) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  /* ----- renvoyer le code email ---------------------------------------------- */
  const resend = async () => {
    if (resending || resendLeft > 0 || busy) return;
    setResending(true);
    setError(null);
    try {
      const sent = await sendEmailMfaCode("login", { force: true });
      setSentTo(sent.sentTo ?? sentTo);
      setResendAt(Date.now() + sent.resendIn * 1000);
      setNow(Date.now());
      setCode("");
    } catch (e) {
      if (isRateLimitError(e)) {
        setResendAt(Date.now() + e.retryAfterSeconds * 1000);
        setNow(Date.now());
      } else {
        fail(e instanceof Error ? e.message : "Could not send a new code.");
      }
    } finally {
      setResending(false);
    }
  };

  /* ----- textes --------------------------------------------------------------- */
  const isEmail = method === "email";

  const title = isEmail ? "Check your email" : "Two-factor authentication";
  const description = isEmail
    ? sentTo
      ? `We sent a 6-digit code to ${sentTo}. Enter it below.`
      : "We sent a 6-digit code to your email address. Enter it below."
    : "Open your authenticator app and enter the 6-digit code.";

  const primaryClass = [
    "flex w-full cursor-pointer items-center justify-center gap-2 rounded-[11px] py-[clamp(11px,1vw,13px)] text-[clamp(13px,1vw,14.5px)] font-semibold transition",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    ui.primary,
  ].join(" ");

  return (
    <div>
      <style>{`
        @keyframes mfa-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .mfa-shake { animation: mfa-shake 0.38s ease-in-out; }
        @keyframes mfa-fade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .mfa-fade { animation: mfa-fade 0.22s ease-out; }
        @keyframes dot-wave {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        .dot-wave { animation: dot-wave 1.2s ease-in-out infinite; }
        @keyframes cta-pop {
          0% { transform: scale(0.85); opacity: 0.5; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        .cta-pop { animation: cta-pop 0.45s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .mfa-shake, .mfa-fade, .cta-pop { animation: none; }
          .dot-wave { animation: none; opacity: 0.7; }
        }
      `}</style>

      {/* Header ---------------------------------------------------------------- */}
      <div
        className={[
          "mx-auto flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-300",
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
          <span className="cta-pop flex">
            <CheckIcon />
          </span>
        ) : (
          <LoadingDots />
        )}
      </div>

      <h1
        className={`mt-5 text-center font-display text-[clamp(20px,1.7vw,26px)] font-semibold tracking-[-0.01em] ${ui.title}`}
      >
        {method ? title : "Two-factor authentication"}
      </h1>
      <p
        className={`mx-auto mt-2 max-w-[320px] text-center text-[clamp(12px,0.95vw,13.5px)] leading-relaxed ${ui.muted}`}
      >
        {method ? description : "Loading your verification method…"}
      </p>

      {/* Form ------------------------------------------------------------------- */}
      {loadError ? (
        <div
          role="alert"
          className="mt-6 rounded-[10px] border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[12.5px] text-red-500"
        >
          {loadError}
        </div>
      ) : !method ? (
        <div className={`mt-8 flex justify-center ${ui.muted}`}>
          <Spinner className="h-5 w-5" />
        </div>
      ) : (
        <form
          className="mfa-fade mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          noValidate
        >
          {method === "totp" && factors.length > 1 && (
            <label className="block">
              <span
                className={`mb-1.5 block text-[12.5px] font-medium ${ui.label}`}
              >
                Authenticator
              </span>
              <select
                value={factorId}
                onChange={(event) => setFactorId(event.target.value)}
                disabled={busy}
                className={`w-full cursor-pointer rounded-[10px] border px-3.5 py-2.5 text-[13.5px] outline-none transition ${ui.field}`}
              >
                {factors.map((factor, index) => (
                  <option key={factor.id} value={factor.id}>
                    {factor.friendlyName &&
                    !/^Authenticator \d+$/.test(factor.friendlyName)
                      ? factor.friendlyName
                      : `Authenticator ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div key={shakeKey} className={error ? "mfa-shake" : undefined}>
            <OtpInput
              value={code}
              onChange={(next) => {
                setCode(next);
                setError(null);
              }}
              disabled={busy || locked || verified}
              invalid={Boolean(error)}
              isDark={isDark}
            />
            <p
              className={`mt-3 flex h-4 items-center justify-center gap-2 text-center text-[12px] ${ui.muted}`}
              aria-live="polite"
            >
              {verified ? (
                "Code verified"
              ) : busy ? (
                <>
                  <Spinner className="h-3.5 w-3.5" /> Verifying…
                </>
              ) : isEmail ? (
                "The code expires in 10 minutes."
              ) : (
                "The code refreshes every 30 seconds."
              )}
            </p>
          </div>

          {/* Feedback ------------------------------------------------------------ */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-[10px] border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[12.5px]"
            >
              <Icon className="mt-[1px] h-4 w-4 shrink-0 text-red-500">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4.5M12 16h.01" />
              </Icon>
              <span className={isDark ? "text-red-300" : "text-red-700"}>
                {error}
              </span>
            </div>
          )}

          {locked && (
            <div
              role="alert"
              className="rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-3.5 py-3"
            >
              <p
                className={`text-[12.5px] ${isDark ? "text-amber-300" : "text-amber-800"}`}
              >
                Too many attempts. Try again in{" "}
                <strong className="font-semibold tabular-nums">
                  {formatWait(waitLeft)}
                </strong>
                .
              </p>
              <div
                className={`mt-2.5 h-1 overflow-hidden rounded-full ${ui.track}`}
              >
                <div
                  className="h-full rounded-full bg-amber-500 transition-[width] duration-300 ease-linear"
                  style={{ width: `${lockProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Primary action ------------------------------------------------------ */}
          <button
            type="submit"
            disabled={busy || locked || !valid}
            className={primaryClass}
          >
            {busy ? (
              <>
                <Spinner /> Verifying…
              </>
            ) : (
              "Verify & continue"
            )}
          </button>
        </form>
      )}

      {/* Footer ------------------------------------------------------------------ */}
      <div className="mt-5 flex flex-col items-center gap-3">
        {isEmail && (
          <button
            type="button"
            onClick={() => void resend()}
            disabled={busy || resending || resendLeft > 0}
            className={`cursor-pointer text-[12px] font-medium underline underline-offset-2 transition disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60 ${ui.muted} hover:opacity-80`}
          >
            {resending
              ? "Sending…"
              : resendLeft > 0
                ? `Resend code in ${formatWait(resendLeft)}`
                : "Didn't get the email? Resend code"}
          </button>
        )}

        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className={`inline-flex cursor-pointer items-center gap-1.5 text-[12px] transition disabled:cursor-not-allowed disabled:opacity-60 ${ui.ghost}`}
        >
          <Icon className="h-3.5 w-3.5">
            <path d="M19 12H5" />
            <path d="m11 6-6 6 6 6" />
          </Icon>
          Back to log in
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function TwoFactor() {
  const { theme } = useTheme();
  const { refreshUser } = useUser();
  const isDark = theme === "dark";
  const [pending] = useState(isMfaPending);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!pending) navigate("signin", { replace: true });
  }, [pending]);

  const finishLogin = async () => {
    const user = await refreshUser();
    if (!user) {
      throw new Error(
        "You are signed in, but your account could not be loaded. Please try again.",
      );
    }

    if (!navigateAfterSignin()) setDone(true);
  };

  const cancelMfa = async () => {
    await signOut();
    navigate("signin", { replace: true });
  };

  if (!pending) return null;

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
              <h1
                className={[
                  "font-display text-[clamp(28px,3vw,44px)] leading-[1.15] font-medium tracking-[-0.02em]",
                  isDark ? "text-white" : "text-neutral-900",
                ].join(" ")}
              >
                Welcome
                <br />
                back
              </h1>

              <div className="mt-[clamp(24px,3.2vw,44px)] rounded-[clamp(12px,1.2vw,16px)] bg-white p-[clamp(12px,1.2vw,18px)] shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)]">
                <span className="flex h-[clamp(22px,2vw,28px)] w-[clamp(22px,2vw,28px)] items-center justify-center rounded-full bg-neutral-900 text-[clamp(11px,0.95vw,13px)] font-semibold text-white">
                  2
                </span>

                <p className="mt-[clamp(24px,2.6vw,38px)] text-[clamp(11.5px,1vw,14px)] leading-[1.35] font-medium text-neutral-900">
                  Verify your
                  <br />
                  identity
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          className={[
            "flex items-center justify-center px-[clamp(20px,4vw,56px)] py-[clamp(36px,5vw,64px)]",
            isDark ? "bg-[#09090a]" : "bg-[#f3f1ed]",
          ].join(" ")}
        >
          <div className="w-full max-w-[380px]">
            {done ? (
              <div className="text-center" role="status">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-neutral-900">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="m5 12.5 4.5 4.5L19 7.5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h1 className="mt-5 font-display text-[19px] font-semibold text-white">
                  Welcome back!
                </h1>
                <p className="mt-2 text-[12px] leading-relaxed text-neutral-400">
                  You are now signed in to your account.
                </p>
                <button
                  type="button"
                  autoFocus
                  onClick={() => navigate("home")}
                  className="mt-6 w-full cursor-pointer rounded-[10px] bg-white py-[clamp(10px,0.95vw,13px)] text-[clamp(12.5px,1vw,14.5px)] font-semibold text-neutral-900 transition hover:bg-neutral-200"
                >
                  Continue to Dashboard
                </button>
              </div>
            ) : (
              <MfaChallenge
                isDark={isDark}
                onVerified={finishLogin}
                onCancel={() => void cancelMfa()}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}