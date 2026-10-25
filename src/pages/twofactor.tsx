import { useEffect, useRef, useState, type ReactNode } from "react";



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



const CODE_LENGTH = 6;

const TOTP_RE = /^\d{6}$/;

const RECOVERY_RE = /^[A-Z0-9-]{8,16}$/;



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

        tabsWrap: "bg-white/[0.04] border-white/10",

        tabActive: "bg-white text-neutral-900 shadow-sm",

        tabIdle: "text-neutral-400 hover:text-white",

        primary:

          "bg-white text-neutral-900 hover:bg-neutral-200 focus-visible:outline-white",

        ghost: "text-neutral-500 hover:text-neutral-200",

        focusRing: "focus-visible:outline-white",

        passkeyBox: "border-white/10 bg-white/[0.03]",

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

        tabsWrap: "bg-black/[0.04] border-black/10",

        tabActive: "bg-white text-neutral-900 shadow-sm",

        tabIdle: "text-neutral-500 hover:text-neutral-900",

        primary:

          "bg-neutral-900 text-white hover:bg-neutral-700 focus-visible:outline-neutral-900",

        ghost: "text-neutral-500 hover:text-neutral-900",

        focusRing: "focus-visible:outline-neutral-900",

        passkeyBox: "border-black/10 bg-neutral-50",

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



const ShieldIcon = () => (

  <Icon>

    <path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z" />

    <path d="m9 12 2 2 4-4" />

  </Icon>

);



const PhoneIcon = ({ className }: { className?: string }) => (

  <Icon className={className}>

    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />

    <path d="M11 18.5h2" />

  </Icon>

);



const KeyIcon = ({ className }: { className?: string }) => (

  <Icon className={className}>

    <circle cx="8" cy="15" r="4" />

    <path d="m10.8 12.2 8.2-8.2" />

    <path d="m16 7 3 3" />

  </Icon>

);



const LifebuoyIcon = ({ className }: { className?: string }) => (

  <Icon className={className}>

    <circle cx="12" cy="12" r="9" />

    <circle cx="12" cy="12" r="3.5" />

    <path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" />

  </Icon>

);



const FingerprintIcon = () => (

  <Icon className="h-7 w-7">

    <path d="M12 11v3.5c0 2 .5 3.8 1.5 5.5" />

    <path d="M8.5 14.5c0-2.5 1.5-3.5 3.5-3.5s3.5 1 3.5 3.5c0 1.5.3 3 .9 4.3" />

    <path d="M5.5 14.5C5.5 10.4 8 8 12 8s6.5 2.4 6.5 6.5c0 .9.1 1.8.3 2.7" />

    <path d="M3 12.5C3 7.5 6.5 4.5 12 4.5s9 3 9 8c0 .6 0 1.2-.1 1.8" />

  </Icon>

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

/*  MFA challenge                                                             */

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



  const [mode, setMode] = useState<MfaMode>("totp");

  const [code, setCode] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [shakeKey, setShakeKey] = useState(0);

  const [busy, setBusy] = useState(false);

  const [factors, setFactors] = useState<MfaFactor[]>([]);

  const [factorId, setFactorId] = useState("");

  const [lockedUntil, setLockedUntil] = useState(0);

  const [lockTotal, setLockTotal] = useState(0);

  const [now, setNow] = useState(() => Date.now());



  const passkeyAvailable = isWebAuthnSupported();

  const busyRef = useRef(false);



  /* ----- load authenticators ------------------------------------------------ */

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



  /* ----- rate-limit countdown ---------------------------------------------- */

  useEffect(() => {

    if (lockedUntil <= Date.now()) return;



    const timer = window.setInterval(() => {

      const timestamp = Date.now();

      setNow(timestamp);

      if (timestamp >= lockedUntil) window.clearInterval(timer);

    }, 250);



    return () => window.clearInterval(timer);

  }, [lockedUntil]);



  const waitLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  const lockProgress =

    lockTotal > 0 ? Math.min(100, ((lockTotal - waitLeft) / lockTotal) * 100) : 0;

  const locked = waitLeft > 0;



  const valid =

    mode === "totp"

      ? TOTP_RE.test(code)

      : mode === "recovery"

        ? RECOVERY_RE.test(code)

        : true;



  /* ----- submit ------------------------------------------------------------- */

  const fail = (message: string) => {

    setError(message);

    setShakeKey((key) => key + 1);

  };



  const submit = async (overrideMode?: MfaMode) => {

    const activeMode = overrideMode ?? mode;

    if (busyRef.current || locked) return;



    if (activeMode === "totp" && !TOTP_RE.test(code)) {

      fail("Enter the 6-digit code.");

      return;

    }

    if (activeMode === "recovery" && !RECOVERY_RE.test(code)) {

      fail("Enter a valid recovery code.");

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

        const seconds = verificationError.retryAfterSeconds;

        setLockTotal(seconds);

        setLockedUntil(Date.now() + seconds * 1000);

        setNow(Date.now());

      } else if (

        verificationError instanceof DOMException &&

        ["NotAllowedError", "AbortError"].includes(verificationError.name)

      ) {

        fail("Passkey verification was cancelled. You can try again.");

      } else {

        const message =

          verificationError instanceof Error

            ? verificationError.message

            : "Verification failed.";

        fail(

          /invalid|code/i.test(message)

            ? activeMode === "recovery"

              ? "Invalid or already used recovery code."

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

    if (mode === "totp" && code.length === CODE_LENGTH) void submit();

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [code, mode]);



  const switchTo = (next: MfaMode) => {

    if (busy || next === mode) return;

    setMode(next);

    setCode("");

    setError(null);

  };



  /* ----- copy ---------------------------------------------------------------- */

  const title =

    mode === "passkey"

      ? "Use your passkey"

      : mode === "recovery"

        ? "Use a recovery code"

        : "Two-factor authentication";

  const description =

    mode === "passkey"

      ? "Confirm it's you with Windows Hello, Touch ID, Face ID or your security key."

      : mode === "recovery"

        ? "Enter one of the recovery codes you saved. Each code can only be used once."

        : "Open your authenticator app and enter the 6-digit code.";



  const tabs: Array<{

    id: MfaMode;

    label: string;

    icon: (props: { className?: string }) => ReactNode;

  }> = [

    { id: "totp", label: "App", icon: PhoneIcon },

    ...(passkeyAvailable

      ? [{ id: "passkey" as const, label: "Passkey", icon: KeyIcon }]

      : []),

    { id: "recovery", label: "Recovery", icon: LifebuoyIcon },

  ];



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

        @media (prefers-reduced-motion: reduce) {

          .mfa-shake, .mfa-fade { animation: none; }

        }

      `}</style>



      {/* Header ---------------------------------------------------------------- */}

      <div

        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${ui.iconWrap}`}

      >

        <ShieldIcon />

      </div>



      <h1

        className={`mt-5 text-center font-display text-[clamp(20px,1.7vw,26px)] font-semibold tracking-[-0.01em] ${ui.title}`}

      >

        {title}

      </h1>

      <p

        className={`mx-auto mt-2 max-w-[320px] text-center text-[clamp(12px,0.95vw,13.5px)] leading-relaxed ${ui.muted}`}

      >

        {description}

      </p>



      {/* Method switcher -------------------------------------------------------- */}

      <div

        role="tablist"

        aria-label="Verification method"

        className={`mt-6 grid gap-1 rounded-xl border p-1 ${ui.tabsWrap}`}

        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}

      >

        {tabs.map(({ id, label, icon: TabIcon }) => (

          <button

            key={id}

            type="button"

            role="tab"

            aria-selected={mode === id}

            disabled={busy}

            onClick={() => switchTo(id)}

            className={[

              "flex cursor-pointer items-center justify-center gap-1.5 rounded-[9px] px-2 py-2 text-[12.5px] font-medium transition",

              "disabled:cursor-not-allowed",

              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1",

              ui.focusRing,

              mode === id ? ui.tabActive : ui.tabIdle,

            ].join(" ")}

          >

            <TabIcon className="h-4 w-4" />

            {label}

          </button>

        ))}

      </div>



      {/* Form ------------------------------------------------------------------- */}

      <form

        key={mode}

        className="mfa-fade mt-6 space-y-4"

        onSubmit={(event) => {

          event.preventDefault();

          void submit();

        }}

        noValidate

      >

        {mode === "totp" && factors.length > 1 && (

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



        {mode === "totp" && (

          <div key={shakeKey} className={error ? "mfa-shake" : undefined}>

            <OtpInput

              value={code}

              onChange={(next) => {

                setCode(next);

                setError(null);

              }}

              disabled={busy || locked}

              invalid={Boolean(error)}

              isDark={isDark}

            />

            <p

              className={`mt-3 flex h-4 items-center justify-center gap-2 text-center text-[12px] ${ui.muted}`}

              aria-live="polite"

            >

              {busy ? (

                <>

                  <Spinner className="h-3.5 w-3.5" /> Verifying…

                </>

              ) : (

                "The code refreshes every 30 seconds."

              )}

            </p>

          </div>

        )}



        {mode === "recovery" && (

          <label

            key={shakeKey}

            className={`block ${error ? "mfa-shake" : ""}`}

          >

            <span

              className={`mb-1.5 block text-[12.5px] font-medium ${ui.label}`}

            >

              Recovery code

            </span>

            <input

              type="text"

              autoCapitalize="characters"

              autoComplete="off"

              autoCorrect="off"

              spellCheck={false}

              autoFocus

              disabled={busy || locked}

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

              className={[

                "w-full rounded-[11px] border px-3.5 py-3 text-center font-mono text-[16px] tracking-[0.18em] outline-none transition disabled:opacity-60",

                ui.field,

                error ? "!border-red-500/70 !ring-2 !ring-red-500/15" : "",

              ].join(" ")}

            />

            <span className={`mt-2 block text-[11.5px] ${ui.muted}`}>

              Using a recovery code is a one-time action — generate new ones in

              your security settings afterwards.

            </span>

          </label>

        )}



        {mode === "passkey" && (

          <div

            className={`flex flex-col items-center gap-3 rounded-[14px] border px-4 py-6 text-center ${ui.passkeyBox}`}

          >

            <div

              className={`flex h-14 w-14 items-center justify-center rounded-full ${ui.iconWrap} ${

                busy ? "animate-pulse" : ""

              }`}

            >

              <FingerprintIcon />

            </div>

            <p className={`text-[12.5px] leading-relaxed ${ui.muted}`}>

              {busy

                ? "Follow the prompt on your device to continue…"

                : "Your browser will ask you to verify with your device."}

            </p>

          </div>

        )}



        {/* Feedback -------------------------------------------------------------- */}

        {error && (

          <div

            role="alert"

            className="flex items-start gap-2.5 rounded-[10px] border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[12.5px] text-red-500"

          >

            <Icon className="mt-[1px] h-4 w-4 shrink-0">

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



        {/* Primary action ----------------------------------------------------------- */}

        {mode === "passkey" ? (

          <button

            type="button"

            onClick={() => void submit("passkey")}

            disabled={busy || locked}

            className={primaryClass}

          >

            {busy ? (

              <>

                <Spinner /> Waiting for passkey…

              </>

            ) : (

              "Continue with passkey"

            )}

          </button>

        ) : (

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

        )}

      </form>



      {/* Footer ------------------------------------------------------------------ */}

      <div className="mt-5 flex flex-col items-center gap-3">

        {mode === "totp" && (

          <button

            type="button"

            onClick={() => switchTo("recovery")}

            disabled={busy}

            className={`cursor-pointer text-[12px] font-medium underline underline-offset-2 transition disabled:opacity-60 ${ui.muted} hover:opacity-80`}

          >

            Lost access to your authenticator?

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
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
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
                <MfaChallenge isDark={isDark} onVerified={finishLogin} onCancel={() => void cancelMfa()} />
              )}
          </div>
        </div>
      </div>
    </main>
  );
}
