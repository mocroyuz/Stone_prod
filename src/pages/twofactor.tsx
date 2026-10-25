import { useEffect, useRef, useState } from "react";

import { navigate } from "../hooks/useHashRoute";
import { useTheme } from "../hooks/useTheme";
import { useUser } from "../contexts/UserContext";
import {
  isMfaPending,
  isRateLimitError,
  isWebAuthnSupported,
  listMfaFactors,
  signOut,
  verifyMfaLogin,
  verifyRecoveryCode,
  verifyWithPasskey,
  type MfaFactor,
} from "../services/supabase";
import { navigateAfterSignin } from "../utils/authNavigation";

type MfaMode = "totp" | "recovery" | "passkey";

const TOTP_RE = /^\d{6}$/;
const RECOVERY_RE = /^[A-Z0-9-]{8,16}$/;

const formatWait = (seconds: number) =>
  seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} s`;

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z" />
    </svg>
  );
}

function MfaChallenge({
  isDark,
  onVerified,
  onCancel,
}: {
  isDark: boolean;
  onVerified: () => Promise<void>;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<MfaMode>("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const passkeyAvailable = isWebAuthnSupported();
  const busyRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const list = await listMfaFactors();
        if (!mounted) return;
        setFactors(list);
        setFactorId(list[0]?.id ?? "");
      } catch (loadError) {
        console.error("Could not load MFA factors:", loadError);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (lockedUntil <= Date.now()) return;

    const timer = window.setInterval(() => {
      const timestamp = Date.now();
      setNow(timestamp);
      if (timestamp >= lockedUntil) window.clearInterval(timer);
    }, 500);

    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const waitLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const valid =
    mode === "totp"
      ? TOTP_RE.test(code)
      : mode === "recovery"
        ? RECOVERY_RE.test(code)
        : true;

  const submit = async (overrideMode?: MfaMode) => {
    const activeMode = overrideMode ?? mode;
    if (busyRef.current || waitLeft > 0) return;

    if (activeMode === "totp" && !TOTP_RE.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    if (activeMode === "recovery" && !RECOVERY_RE.test(code)) {
      setError("Enter a valid recovery code.");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError(null);

    try {
      if (activeMode === "totp") {
        await verifyMfaLogin(code, factorId || undefined);
      } else if (activeMode === "recovery") {
        await verifyRecoveryCode(code);
      } else {
        await verifyWithPasskey();
      }

      await onVerified();
    } catch (verificationError) {
      if (isRateLimitError(verificationError)) {
        setLockedUntil(Date.now() + verificationError.retryAfterSeconds * 1000);
        setNow(Date.now());
      } else if (
        verificationError instanceof DOMException &&
        ["NotAllowedError", "AbortError"].includes(verificationError.name)
      ) {
        setError("Passkey verification cancelled.");
      } else {
        const message =
          verificationError instanceof Error
            ? verificationError.message
            : "Verification failed.";
        setError(
          /invalid|code/i.test(message)
            ? activeMode === "recovery"
              ? "Invalid or already used recovery code."
              : "Invalid code. Try again."
            : message,
        );
      }
      setCode("");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (mode === "totp" && code.length === 6) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, mode]);

  const switchTo = (next: MfaMode) => {
    setMode(next);
    setCode("");
    setError(null);
  };

  const title =
    mode === "passkey"
      ? "Use your passkey"
      : mode === "recovery"
        ? "Enter a recovery code"
        : "Two-factor authentication";
  const description =
    mode === "passkey"
      ? "Verify with Windows Hello, Touch ID or your security key."
      : mode === "recovery"
        ? "Use one of the recovery codes you saved. Each code works once."
        : "Enter the 6-digit code from your authenticator app.";
  const linkClass =
    "cursor-pointer text-[12px] font-medium text-neutral-300 underline underline-offset-2 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <div>
      <div
        className={[
          "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
          isDark ? "bg-white text-neutral-900" : "bg-neutral-900 text-white",
        ].join(" ")}
      >
        <ShieldIcon />
      </div>

      <h1
        className={[
          "mt-5 text-center font-display text-[clamp(20px,1.7vw,26px)] font-semibold tracking-[-0.01em]",
          isDark ? "text-white" : "text-neutral-900",
        ].join(" ")}
      >
        {title}
      </h1>
      <p
        className={[
          "mt-2 text-center text-[clamp(11.5px,0.95vw,13.5px)]",
          isDark ? "text-neutral-400" : "text-neutral-600",
        ].join(" ")}
      >
        {description}
      </p>

      <form
        className="mt-6 space-y-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        {mode === "totp" && factors.length > 1 && (
          <label className="block">
            <span className="mb-1.5 block text-[clamp(11.5px,0.95vw,13px)] font-medium text-neutral-300">
              Authenticator
            </span>
            <select
              value={factorId}
              onChange={(event) => setFactorId(event.target.value)}
              className="w-full rounded-[9px] border border-white/10 bg-[#1c1c1e] px-3.5 py-[clamp(9px,0.9vw,12px)] text-[clamp(12.5px,1vw,14px)] text-white outline-none focus:border-neutral-500"
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

        {mode === "totp" && (
          <label className="block">
            <span className="mb-1.5 block text-[clamp(11.5px,0.95vw,13px)] font-medium text-neutral-300">
              Verification code
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setError(null);
              }}
              placeholder="000000"
              aria-invalid={Boolean(error)}
              className={`w-full rounded-[9px] border bg-[#1c1c1e] px-3.5 py-[clamp(9px,0.9vw,12px)] text-center font-mono text-[18px] tracking-[0.4em] text-white outline-none placeholder:text-neutral-600 transition focus:border-neutral-500 ${
                error ? "border-red-500/70" : "border-white/10"
              }`}
            />
          </label>
        )}

        {mode === "recovery" && (
          <label className="block">
            <span className="mb-1.5 block text-[clamp(11.5px,0.95vw,13px)] font-medium text-neutral-300">
              Recovery code
            </span>
            <input
              type="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              value={code}
              onChange={(event) => {
                setCode(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9-]/g, "")
                    .slice(0, 16),
                );
                setError(null);
              }}
              placeholder="XXXXX-XXXXX"
              aria-invalid={Boolean(error)}
              className={`w-full rounded-[9px] border bg-[#1c1c1e] px-3.5 py-[clamp(9px,0.9vw,12px)] text-center font-mono text-[15px] tracking-[0.2em] text-white outline-none placeholder:text-neutral-600 transition focus:border-neutral-500 ${
                error ? "border-red-500/70" : "border-white/10"
              }`}
            />
          </label>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-[9px] border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[12.5px] text-red-300"
          >
            {error}
          </div>
        )}
        {waitLeft > 0 && (
          <div
            role="alert"
            className="rounded-[9px] border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[12.5px] text-amber-300"
          >
            Too many attempts. Try again in {formatWait(waitLeft)}.
          </div>
        )}

        <button
          type={mode === "passkey" ? "button" : "submit"}
          onClick={mode === "passkey" ? () => void submit("passkey") : undefined}
          disabled={busy || waitLeft > 0 || (mode !== "passkey" && !valid)}
          className="mt-1 w-full cursor-pointer rounded-[10px] bg-white py-[clamp(10px,0.95vw,13px)] text-[clamp(12.5px,1vw,14.5px)] font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {busy
            ? mode === "passkey"
              ? "Waiting for passkey..."
              : "Verifying..."
            : mode === "passkey"
              ? "Continue with passkey"
              : "Verify & continue"}
        </button>
      </form>

      <div className="mt-5 flex flex-col items-center gap-2.5">
        {mode !== "totp" && (
          <button
            type="button"
            onClick={() => switchTo("totp")}
            className={linkClass}
          >
            Use your authenticator app instead
          </button>
        )}
        {mode !== "recovery" && (
          <button
            type="button"
            onClick={() => switchTo("recovery")}
            className={linkClass}
          >
            Use a recovery code instead
          </button>
        )}
        {mode !== "passkey" && passkeyAvailable && (
          <button
            type="button"
            onClick={() => switchTo("passkey")}
            className={linkClass}
          >
            Use a passkey instead
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="mt-2 cursor-pointer text-[12px] text-neutral-500 transition hover:text-neutral-300 disabled:opacity-60"
        >
          Back to log in
        </button>
      </div>
    </div>
  );
}

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
        "auth-page relative flex min-h-screen w-full items-center justify-center px-5 py-16 transition-colors duration-500",
        isDark ? "auth-dark bg-[#09090a]" : "auth-light bg-[#f3f1ed]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => navigate("")}
        aria-label="Back to home"
        title="Back to home"
        className="back-button absolute top-[clamp(16px,2vw,30px)] right-[clamp(16px,2vw,30px)] flex h-[clamp(36px,3.4vw,44px)] w-[clamp(36px,3.4vw,44px)] cursor-pointer items-center justify-center rounded-full border backdrop-blur-md transition-colors duration-200"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M19 12H5" />
          <path d="m11 6-6 6 6 6" />
        </svg>
      </button>

      <div
        className={[
          "w-full max-w-[420px] rounded-[20px] border p-[clamp(24px,4vw,44px)] shadow-[0_24px_80px_-36px_rgba(0,0,0,0.65)]",
          isDark
            ? "border-white/10 bg-[#111113]"
            : "border-black/10 bg-white",
        ].join(" ")}
      >
        {done ? (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-neutral-900">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
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
    </main>
  );
}
