import { useEffect, useState, type FormEvent } from "react";

import { navigate } from "../hooks/useHashRoute";
import { useTheme } from "../hooks/useTheme";
import {
  clearRecoveryParamsFromUrl,
  readRecoveryError,
  readRecoveryParams,
  resetPassword,
  type RecoveryParams,
} from "../services/supabase";

/* ============================================================
   JETONS DE RÉCUPÉRATION
   ============================================================

   Le lien de l'email arrive sur  /reset-password#access_token=...
   On lit les jetons UNE fois, on les garde en mémoire (hors composant, pour
   survivre à un remontage / StrictMode) puis on les retire de la barre
   d'adresse.
*/

let cachedRecovery: RecoveryParams | null = null;
let cachedLinkError: string | null = null;

function loadRecovery(): { params: RecoveryParams | null; linkError: string | null } {
  const fresh = readRecoveryParams();
  const freshError = readRecoveryError();

  if (fresh) cachedRecovery = fresh;
  if (freshError) cachedLinkError = freshError;

  return { params: cachedRecovery, linkError: cachedLinkError };
}

function forgetRecovery() {
  cachedRecovery = null;
  cachedLinkError = null;
}

/* ============================================================
   RESET PASSWORD
   ============================================================ */

export default function ResetPassword() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [{ params, linkError }] = useState(loadRecovery);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Retire les jetons de la barre d'adresse (historique, partage d'écran...).
  useEffect(() => {
    if (params) clearRecoveryParamsFromUrl();
  }, [params]);

  const linkUsable = Boolean(params) && !linkError;

  /* ----------------------------------------------------------
     SUBMIT
     ---------------------------------------------------------- */

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);

    const next: Record<string, string> = {};

    if (password.length < 8) {
      next.password = "Password must contain at least 8 characters.";
    } else if (password.length > 128) {
      next.password = "Password must contain at most 128 characters.";
    }

    if (!next.password && confirm !== password) {
      next.confirm = "Passwords do not match.";
    }

    setErrors(next);

    if (Object.keys(next).length > 0 || !params) return;

    setLoading(true);

    try {
      await resetPassword(password, params);
      forgetRecovery();
      setDone(true);
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "Could not update your password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------------------------------------------
     STYLES PARTAGÉS
     ---------------------------------------------------------- */

  const inputClass = (hasError: boolean) =>
    `w-full rounded-[9px] border bg-[#1c1c1e] px-3.5 py-[clamp(9px,0.9vw,12px)] text-[clamp(12.5px,1vw,14px)] text-white outline-none placeholder:text-neutral-500 transition focus:border-neutral-500 ${
      hasError ? "border-red-500/70" : "border-white/10"
    } focus-visible:ring-2 focus-visible:ring-white/60`;

  const labelClass = [
    "mb-1.5 block text-[clamp(11.5px,0.95vw,13px)] font-medium",
    isDark ? "text-neutral-300" : "text-neutral-700",
  ].join(" ");

  const primaryButton =
    "mt-1 w-full cursor-pointer rounded-[10px] bg-white py-[clamp(10px,0.95vw,13px)] text-[clamp(12.5px,1vw,14.5px)] font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  const titleClass = [
    "text-center font-display text-[clamp(20px,1.7vw,26px)] font-semibold tracking-[-0.01em]",
    isDark ? "text-white" : "text-neutral-900",
  ].join(" ");

  const subtitleClass = [
    "mt-2 text-center text-[clamp(11.5px,0.95vw,13.5px)]",
    isDark ? "text-neutral-400" : "text-neutral-600",
  ].join(" ");

  const eyeIcon = (visible: boolean) => (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!visible && <path d="m4 20 16-16" />}
    </svg>
  );

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
                  Choose a
                  <br />
                  new password
                </h1>
              </div>

              <div className="mt-[clamp(24px,3.2vw,44px)] rounded-[clamp(12px,1.2vw,16px)] bg-white p-[clamp(12px,1.2vw,18px)] shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)]">
                <span className="flex h-[clamp(22px,2vw,28px)] w-[clamp(22px,2vw,28px)] items-center justify-center rounded-full bg-neutral-900 text-[clamp(11px,0.95vw,13px)] font-semibold text-white">
                  2
                </span>

                <p className="mt-[clamp(24px,2.6vw,38px)] text-[clamp(11.5px,1vw,14px)] leading-[1.35] font-medium text-neutral-900">
                  Set your new
                  <br />
                  password
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
            {done ? (
              /* ---------- SUCCÈS ---------- */
              <div className="text-center">
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

                <h2
                  className={[
                    "mt-5 font-display text-[19px] font-semibold",
                    isDark ? "text-white" : "text-neutral-900",
                  ].join(" ")}
                >
                  Password updated
                </h2>

                <p
                  className={[
                    "mt-2 text-[12px] leading-relaxed",
                    isDark ? "text-neutral-400" : "text-neutral-600",
                  ].join(" ")}
                >
                  Your password has been changed. For your security you have been
                  signed out everywhere — sign in with your new password.
                </p>

                <button
                  type="button"
                  onClick={() => navigate("signin")}
                  className={primaryButton + " mt-6"}
                >
                  Continue to sign in
                </button>
              </div>
            ) : !linkUsable ? (
              /* ---------- LIEN INVALIDE / EXPIRÉ ---------- */
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 8v5" />
                    <path d="M12 16.5v.01" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </div>

                <h2
                  className={[
                    "mt-5 font-display text-[19px] font-semibold",
                    isDark ? "text-white" : "text-neutral-900",
                  ].join(" ")}
                >
                  Link invalid or expired
                </h2>

                <p
                  className={[
                    "mt-2 text-[12px] leading-relaxed",
                    isDark ? "text-neutral-400" : "text-neutral-600",
                  ].join(" ")}
                >
                  {linkError ||
                    "This password reset link is missing or no longer valid. Request a new one to continue."}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    forgetRecovery();
                    navigate("forgot-password");
                  }}
                  className={primaryButton + " mt-6"}
                >
                  Request a new link
                </button>
              </div>
            ) : (
              /* ---------- FORMULAIRE ---------- */
              <>
                <h2 className={titleClass}>Set New Password</h2>

                <p className={subtitleClass}>
                  Choose a strong password you don&apos;t use anywhere else.
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
                        onClick={() => {
                          forgetRecovery();
                          navigate("forgot-password");
                        }}
                        className="cursor-pointer font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                      >
                        Request a new link
                      </button>
                    </div>
                  )}

                  <form onSubmit={submit} noValidate className="space-y-3.5">
                    <div className="block">
                      <label htmlFor="reset-password" className={labelClass}>
                        New password
                      </label>

                      <div className="relative">
                        <input
                          id="reset-password"
                          type={show ? "text" : "password"}
                          value={password}
                          onChange={(event) => {
                            setPassword(event.target.value);
                            setErrors((prev) => ({ ...prev, password: "" }));
                          }}
                          placeholder="At least 8 characters"
                          autoComplete="new-password"
                          aria-invalid={Boolean(errors.password)}
                          aria-describedby={errors.password ? "reset-password-error" : undefined}
                          className={inputClass(Boolean(errors.password)) + " pr-9"}
                        />

                        <button
                          type="button"
                          onClick={() => setShow((value) => !value)}
                          aria-label={show ? "Hide password" : "Show password"}
                          className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-neutral-500 hover:text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                        >
                          {eyeIcon(show)}
                        </button>
                      </div>

                      {errors.password && (
                        <span id="reset-password-error" className="mt-1 block text-[11px] text-red-400">
                          {errors.password}
                        </span>
                      )}
                    </div>

                    <div className="block">
                      <label htmlFor="reset-confirm" className={labelClass}>
                        Confirm password
                      </label>

                      <div className="relative">
                        <input
                          id="reset-confirm"
                          type={showConfirm ? "text" : "password"}
                          value={confirm}
                          onChange={(event) => {
                            setConfirm(event.target.value);
                            setErrors((prev) => ({ ...prev, confirm: "" }));
                          }}
                          placeholder="Repeat your password"
                          autoComplete="new-password"
                          aria-invalid={Boolean(errors.confirm)}
                          aria-describedby={errors.confirm ? "reset-confirm-error" : undefined}
                          className={inputClass(Boolean(errors.confirm)) + " pr-9"}
                        />

                        <button
                          type="button"
                          onClick={() => setShowConfirm((value) => !value)}
                          aria-label={showConfirm ? "Hide password" : "Show password"}
                          className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-neutral-500 hover:text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                        >
                          {eyeIcon(showConfirm)}
                        </button>
                      </div>

                      {errors.confirm && (
                        <span id="reset-confirm-error" className="mt-1 block text-[11px] text-red-400">
                          {errors.confirm}
                        </span>
                      )}
                    </div>

                    <button type="submit" disabled={loading} className={primaryButton}>
                      {loading ? "Updating..." : "Update password"}
                    </button>
                  </form>
                </div>

                <p
                  className={[
                    "mt-5 text-center text-[clamp(11.5px,0.95vw,13.5px)]",
                    isDark ? "text-neutral-400" : "text-neutral-600",
                  ].join(" ")}
                >
                  Changed your mind?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      forgetRecovery();
                      navigate("signin");
                    }}
                    className={[
                      "cursor-pointer font-semibold",
                      isDark ? "text-white" : "text-neutral-900",
                    ].join(" ")}
                  >
                    Back to sign in
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