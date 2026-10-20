import { useState } from "react";

import { navigate } from "../hooks/useHashRoute";

import { useTheme } from "../hooks/useTheme";
import { useUser } from "../contexts/UserContext";

import {

  signIn,

  signInWithGoogle,

  signInWithGithub,

} from "../services/supabase";



/* ============================================================

   LECTURE DES PARAMS D'URL

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

   NAVIGATION POST-SIGNIN

   ============================================================ */



function navigateAfterSignin(): boolean {

  const params = readUrlParams();

  const next = params.get("next");

  const plan = params.get("plan");

  const period = params.get("period");



  if (!next) return false;



  if (next === "/pricing" || next === "pricing") {

    const q = new URLSearchParams();

    if (plan) q.set("plan", plan);

    if (period) q.set("period", period);



    const qs = q.toString();

    navigate(`/pricing${qs ? `?${qs}` : ""}`);

    return true;

  }



  if (next.startsWith("/")) {

    navigate(next);

    return true;

  }



  return false;

}



/* ============================================================

   GOOGLE ICON

   ============================================================ */



function GoogleIcon() {

  return (

    <svg

      viewBox="0 0 24 24"

      className="h-[15px] w-[15px]"

      aria-hidden

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



/* ============================================================

   GITHUB ICON

   ============================================================ */



function GithubIcon() {

  return (

    <svg

      viewBox="0 0 24 24"

      className="h-[15px] w-[15px]"

      fill="currentColor"

      aria-hidden

    >

      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85l-.01 2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />

    </svg>

  );

}



/* ============================================================

   PASSWORD FIELD

   ============================================================ */



function PasswordField({

  value,

  onChange,

  show,

  onToggle,

  error,
  onForgot,
}: {
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  error?: string;
  onForgot: () => void;
}) {

  return (

    <div className="block">

      <div className="mb-1.5 flex items-center justify-between">

        <label

          htmlFor="signin-password"

          className="text-[clamp(11.5px,0.95vw,13px)] font-medium text-neutral-300"

        >

          Password

        </label>



        <button
          type="button"
          onClick={onForgot}
          className="cursor-pointer text-[11px] text-neutral-400 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Forgot password?

        </button>

      </div>



      <div className="relative">

        <input

          id="signin-password"

          type={show ? "text" : "password"}

          value={value}

          onChange={(event) => onChange(event.target.value)}

          placeholder="Enter your password"

          autoComplete="current-password"

          aria-invalid={Boolean(error)}

          aria-describedby={error ? "signin-password-error" : undefined}

          className={`w-full rounded-[9px] border bg-[#1c1c1e] px-3.5 py-[clamp(9px,0.9vw,12px)] pr-9 text-[clamp(12.5px,1vw,14px)] text-white outline-none placeholder:text-neutral-500 transition focus:border-neutral-500 ${

            error ? "border-red-500/70" : "border-white/10"

          } focus-visible:ring-2 focus-visible:ring-white/60`}

        />



        <button

          type="button"

          onClick={onToggle}

          aria-label={show ? "Hide password" : "Show password"}

          className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-neutral-500 hover:text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"

        >

          <svg

            viewBox="0 0 24 24"

            className="h-[15px] w-[15px]"

            fill="none"

            stroke="currentColor"

            strokeWidth="1.7"

            strokeLinecap="round"

          >

            <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />

            <circle cx="12" cy="12" r="3" />

            {!show && <path d="m4 20 16-16" />}

          </svg>

        </button>

      </div>



      {error && (

        <span id="signin-password-error" className="mt-1 block text-[11px] text-red-400">

          {error}

        </span>

      )}



    </div>
  );
}



/* ============================================================

   LECTURE DE L'ERREUR OAUTH

   ============================================================ */



function readOAuthErrorFromHash(): string | null {
  const queryError = new URLSearchParams(window.location.search).get("oauth_error");
  if (queryError) return queryError;

  const raw = window.location.hash;

  const idx = raw.indexOf("?");

  if (idx === -1) return null;



  const params = new URLSearchParams(raw.slice(idx + 1));

  const value = params.get("oauth_error");



  return value ? decodeURIComponent(value) : null;

}



/* ============================================================

   SIGN IN

   ============================================================ */



export default function Signin() {

  const { theme } = useTheme();
  const { refreshUser } = useUser();

  const isDark = theme === "dark";



  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [show, setShow] = useState(false);



  const [errors, setErrors] = useState<Record<string, string>>({});



  const [serverError, setServerError] = useState<string | null>(() => {

    return readOAuthErrorFromHash();

  });



  const [loading, setLoading] = useState(false);

  const [googleLoading, setGoogleLoading] = useState(false);

  const [githubLoading, setGithubLoading] = useState(false);

  const [done, setDone] = useState(false);



  /* ----------------------------------------------------------

     SUBMIT

     ---------------------------------------------------------- */



  const submit = async (event: React.FormEvent) => {

    event.preventDefault();

    setServerError(null);



    const next: Record<string, string> = {};



    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {

      next.email = "Enter a valid email address.";

    }



    if (!password) {

      next.password = "Enter your password.";

    }



    setErrors(next);



    if (Object.keys(next).length > 0) return;



    setLoading(true);



    try {

      const result = await signIn(email, password);



      if (result.session) {
        const user = await refreshUser();

        if (!user) {
          setServerError(
            "You are signed in, but your account could not be loaded. Please try again.",
          );
          return;
        }

        const navigated = navigateAfterSignin();
        if (!navigated) setDone(true);

      } else {

        setServerError("Login failed. No session was returned.");

      }

    } catch (error) {

      console.error("Login error:", error);

      setServerError(

        error instanceof Error

          ? error.message

          : "An error occurred during sign in. Please try again.",

      );

    } finally {

      setLoading(false);

    }

  };



  /* ----------------------------------------------------------

     GOOGLE

     ---------------------------------------------------------- */



  const handleGoogle = async () => {

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



  /* ----------------------------------------------------------

     GITHUB

     ---------------------------------------------------------- */



  const handleGithub = async () => {

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

              <div className="flex flex-wrap items-start justify-between gap-4">

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

              </div>



              <div className="mt-[clamp(24px,3.2vw,44px)] rounded-[clamp(12px,1.2vw,16px)] bg-white p-[clamp(12px,1.2vw,18px)] shadow-[0_12px_30px\_-12px_rgba(0,0,0,0.6)]">

                <span className="flex h-[clamp(22px,2vw,28px)] w-[clamp(22px,2vw,28px)] items-center justify-center rounded-full bg-neutral-900 text-[clamp(11px,0.95vw,13px)] font-semibold text-white">

                  1

                </span>



                <p className="mt-[clamp(24px,2.6vw,38px)] text-[clamp(11.5px,1vw,14px)] leading-[1.35] font-medium text-neutral-900">

                  Log in to your

                  <br />

                  account

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

              <div className="text-center">

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-neutral-900">

                  <svg

                    viewBox="0 0 24 24"

                    className="h-5 w-5"

                    fill="none"

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



                <h2 className="mt-5 font-display text-[19px] font-semibold text-white">

                  Welcome back!

                </h2>



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

              <>

                <h2

                  className={[

                    "text-center font-display text-[clamp(20px,1.7vw,26px)] font-semibold tracking-[-0.01em]",

                    isDark ? "text-white" : "text-neutral-900",

                  ].join(" ")}

                >

                  Log In Account

                </h2>



                <p

                  className={[

                    "mt-2 text-center text-[clamp(11.5px,0.95vw,13.5px)]",

                    isDark ? "text-neutral-400" : "text-neutral-600",

                  ].join(" ")}

                >

                  Enter your details to access your account.

                </p>



                <div className="mt-5 grid grid-cols-2 gap-3">

                  <button

                    type="button"

                    onClick={handleGoogle}

                    disabled={googleLoading || githubLoading || loading}

                    className={[

                      "flex cursor-pointer items-center justify-center gap-2 rounded-[9px] border py-[clamp(9px,0.85vw,12px)] text-[clamp(12.5px,1vw,14px)] font-medium transition disabled:cursor-not-allowed disabled:opacity-60",

                      isDark

                        ? "border-white/10 bg-[#1c1c1e] text-white hover:bg-[#242427]"

                        : "border-black/10 bg-white text-neutral-800 hover:bg-neutral-50",

                    ].join(" ")}

                  >

                    <GoogleIcon />

                    {googleLoading ? "Redirecting…" : "Google"}

                  </button>



                  <button

                    type="button"

                    onClick={handleGithub}

                    disabled={githubLoading || googleLoading || loading}

                    className={[

                      "flex cursor-pointer items-center justify-center gap-2 rounded-[9px] border py-[clamp(9px,0.85vw,12px)] text-[clamp(12.5px,1vw,14px)] font-medium transition disabled:cursor-not-allowed disabled:opacity-60",

                      isDark

                        ? "border-white/10 bg-[#1c1c1e] text-white hover:bg-[#242427]"

                        : "border-black/10 bg-white text-neutral-800 hover:bg-neutral-50",

                    ].join(" ")}

                  >

                    <GithubIcon />

                    {githubLoading ? "Redirecting…" : "Github"}

                  </button>

                </div>



                <div className="my-4 flex items-center gap-3">

                  <span className="h-px flex-1 bg-white/10" />

                  <span className="text-[11px] text-neutral-500">Or</span>

                  <span className="h-px flex-1 bg-white/10" />

                </div>



                {serverError && (

                  <div

                    role="alert"

                    className="mb-3.5 rounded-[9px] border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[12.5px] text-red-300"

                  >

                    {serverError}

                  </div>

                )}



                <form

                  onSubmit={submit}

                  noValidate

                  className="space-y-3.5"

                >

                  <label className="block">

                    <span className="mb-1.5 block text-[clamp(11.5px,0.95vw,13px)] font-medium text-neutral-300">

                      Email

                    </span>



                    <input

                      id="signin-email"

                      type="email"

                      value={email}

                      onChange={(event) => setEmail(event.target.value)}

                      placeholder="eg. johnfrans@gmail.com"

                      autoComplete="email"

                      aria-invalid={Boolean(errors.email)}

                      aria-describedby={errors.email ? "signin-email-error" : undefined}

                      className={`w-full rounded-[9px] border bg-[#1c1c1e] px-3.5 py-[clamp(9px,0.9vw,12px)] text-[clamp(12.5px,1vw,14px)] text-white outline-none placeholder:text-neutral-500 transition focus:border-neutral-500 ${

                        errors.email

                          ? "border-red-500/70"

                          : "border-white/10"

                      } focus-visible:ring-2 focus-visible:ring-white/60`}

                    />



                    {errors.email && (

                      <span id="signin-email-error" className="mt-1 block text-[11px] text-red-400">

                        {errors.email}

                      </span>

                    )}

                  </label>



                  <PasswordField

                    value={password}

                    onChange={setPassword}

                    show={show}

                    onToggle={() => setShow((value) => !value)}
                    error={errors.password}
                    onForgot={() => navigate("forgot-password")}
                  />



                  <button

                    type="submit"

                    disabled={loading || googleLoading || githubLoading}

                    className="mt-1 w-full cursor-pointer rounded-[10px] bg-white py-[clamp(10px,0.95vw,13px)] text-[clamp(12.5px,1vw,14.5px)] font-semibold text-neutral-900 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"

                  >

                    {loading ? "Signing in..." : "Log In"}

                  </button>

                </form>



                <p className="mt-5 text-center text-[clamp(11.5px,0.95vw,13.5px)] text-neutral-400">

                  Don&apos;t have an account?{" "}

                  <button

                    type="button"

                    onClick={() => navigate("signup")}

                    className={[
                      "cursor-pointer font-semibold",
                      isDark ? "text-white" : "text-neutral-900",
                    ].join(" ")}

                  >

                    Sign up

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