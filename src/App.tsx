import { useCallback, useEffect, useState } from "react";

import Carousel from "./components/Carousel";
import ExpertiseSection from "./components/ExpertiseSection";
import IntegrationSection from "./components/IntegrationSection";
import Navbar from "./components/Navbar";
import PricingSection from "./components/PricingSection";
import Footer from "./components/Footer";
import StoneBoot from "./components/StoneBoot";

import Signup from "./pages/signup";
import Signin from "./pages/signin";
import DashboardHome from "./pages/home";
import IntegrationsPage from "./pages/integration";
import Settings from "./pages/settings";
import Schedule from "./pages/schedule";
import Pricing from "./pages/pricing";
import Insights from "./pages/Insights";
import Community from "./pages/Community";
import Create from "./pages/Create";
import Channels from "./pages/channels";
import Faq from "./pages/Faq";
import Tos from "./pages/tos";
import Privacy from "./pages/Privacy";
import TemplatesPage from "./pages/template";

import TikTokCallback from "./pages/TikTokCallback";
import PinterestCallback from "./pages/PinterestCallback";
import YouTubeCallback from "./pages/Youtubecallback";
import CanvaCallback, {
  CanvaReturnConfirmation,
} from "./pages/Canvacallback";

import { useHashRoute, navigate } from "./hooks/useHashRoute";
import { useTheme, ThemeProvider, type Theme } from "./hooks/useTheme";
import { UserProvider, useUser } from "./contexts/UserContext";
import { saveOAuthSession } from "./services/supabase";

/* ──────────────────────────────────────────────────────────────
   OAUTH CALLBACK INTERCEPTION
   ────────────────────────────────────────────────────────────── */

const TIKTOK_OAUTH_STORAGE_KEY = "tiktok_oauth_params";
const PINTEREST_OAUTH_STORAGE_KEY = "pinterest_oauth_params";
const YOUTUBE_OAUTH_STORAGE_KEY = "youtube_oauth_params";
const CANVA_OAUTH_STORAGE_KEY = "canva_oauth_params";

const POST_LOGIN_ROUTE_KEY = "post_login_route";

function hasCanvaReturnParameter(): boolean {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("correlation_jwt")
  );
}

function isCanvaReturnPage(): boolean {
  return (
    hasCanvaReturnParameter() ||
    (typeof window !== "undefined" &&
      /^#\/canva-return(?:[/?]|$)/i.test(window.location.hash))
  );
}

const OAUTH_CALLBACK_ROUTES = new Set([
  "tiktok-callback",
  "pinterest-callback",
  "youtube-callback",
  "canva-callback",
]);

function interceptOAuthCallback(
  provider: "tiktok" | "pinterest" | "youtube",
  storageKey: string
) {
  if (typeof window === "undefined") return;

  const { pathname, hash, search } = window.location;

  const isPathCallback =
    pathname.replace(/\/+$/, "") === `/${provider}/callback`;

  const isHashCallback = new RegExp(
    `^#/${provider}/?(#/)?callback`
  ).test(hash);

  if (!isPathCallback && !isHashCallback) return;

  const queryString = isPathCallback
    ? search
    : hash.includes("?")
      ? hash.slice(hash.indexOf("?"))
      : "";

  const params = new URLSearchParams(queryString);

  try {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        code: params.get("code"),
        state: params.get("state"),
        error: params.get("error"),
        error_description: params.get("error_description"),
      })
    );
  } catch {
    // sessionStorage indisponible
  }

  window.history.replaceState(null, "", `/#/${provider}-callback`);
}

interceptOAuthCallback("tiktok", TIKTOK_OAUTH_STORAGE_KEY);
interceptOAuthCallback("pinterest", PINTEREST_OAUTH_STORAGE_KEY);
interceptOAuthCallback("youtube", YOUTUBE_OAUTH_STORAGE_KEY);

function interceptCanvaOAuthCallback() {
  if (typeof window === "undefined") return;

  const { pathname, search } = window.location;
  if (new URLSearchParams(search).has("correlation_jwt")) return;
  if (pathname.replace(/\/+$/, "") !== "/canva/callback") return;

  const params = new URLSearchParams(search);
  try {
    sessionStorage.setItem(
      CANVA_OAUTH_STORAGE_KEY,
      JSON.stringify({
        code: params.get("code"),
        state: params.get("state"),
        error: params.get("error"),
        error_description: params.get("error_description"),
      })
    );
  } catch {
    // The callback component will show a missing-parameters error.
  }

  window.history.replaceState(null, "", "/#/canva-callback");
}

interceptCanvaOAuthCallback();

/* ──────────────────────────────────────────────────────────────
   GOOGLE / SUPABASE OAUTH REDIRECT
   ────────────────────────────────────────────────────────────── */

(function handleOAuthRedirect() {
  if (typeof window === "undefined") return;

  const rawHash = window.location.hash || "";
  const rawSearch = window.location.search || "";
  if (new URLSearchParams(rawSearch).has("correlation_jwt")) return;

  const hashParams =
    rawHash.length > 1
      ? new URLSearchParams(rawHash.replace(/^#\/?/, ""))
      : new URLSearchParams();

  const searchParams =
    rawSearch.length > 1
      ? new URLSearchParams(rawSearch)
      : new URLSearchParams();

  const readParam = (key: string): string | null =>
    hashParams.get(key) ?? searchParams.get(key);

  const oauthError = readParam("error");

  const accessToken = readParam("access_token");
  const refreshToken = readParam("refresh_token");

  const code = readParam("code");

  if (oauthError) {
    const description = readParam("error_description") || oauthError;

    window.history.replaceState(
      null,
      "",
      `/#/signin?oauth_error=${encodeURIComponent(description)}`
    );

    return;
  }

  if (code && !accessToken) {
    window.history.replaceState(
      null,
      "",
      `/#/signin?oauth_error=${encodeURIComponent(
        "PKCE flow returned instead of implicit flow"
      )}`
    );

    return;
  }

  if (!accessToken || !refreshToken) {
    return;
  }

  saveOAuthSession(accessToken, refreshToken);

  setTimeout(async () => {
    try {
      const baseUrl =
        (import.meta as any).env?.VITE_API_BASE_URL ||
        "http://localhost:3002";

      const res = await fetch(`${baseUrl}/api/user/profile`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log("OAuth profile data:", await res.json());
    } catch {
      // Erreur silencieuse
    }
  }, 300);

  window.history.replaceState(null, "", "/#/home");
})();

/* ──────────────────────────────────────────────────────────────
   TYPES
   ────────────────────────────────────────────────────────────── */

type ToggleOrigin = {
  x: number;
  y: number;
};

type ToggleThemeFn = (origin?: ToggleOrigin) => void;

/* ──────────────────────────────────────────────────────────────
   SMOOTH WHEEL
   ────────────────────────────────────────────────────────────── */

function useGentleWheelScroll(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    if (reduceMotion.matches) return;

    let targetY = window.scrollY;
    let animationFrame = 0;

    const animate = () => {
      const currentY = window.scrollY;
      const distance = targetY - currentY;

      if (Math.abs(distance) < 0.5) {
        window.scrollTo(0, targetY);
        animationFrame = 0;
        return;
      }

      window.scrollTo(0, currentY + distance * 0.12);

      animationFrame = window.requestAnimationFrame(animate);
    };

    const onWheel = (event: WheelEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.shiftKey ||
        event.deltaX !== 0
      ) {
        return;
      }

      const multiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;

      const delta = event.deltaY * multiplier * 0.55;

      const maxY =
        document.documentElement.scrollHeight - window.innerHeight;

      targetY = Math.max(0, Math.min(maxY, targetY + delta));

      event.preventDefault();

      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(animate);
      }
    };

    const syncTarget = () => {
      if (!animationFrame) {
        targetY = window.scrollY;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", syncTarget, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", syncTarget);

      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [enabled]);
}

/* ──────────────────────────────────────────────────────────────
   LANDING
   ────────────────────────────────────────────────────────────── */

function Home() {
  return (
    <main className="relative z-10 w-full">
      <section
        id="our-work"
        className="scroll-mt-20 flex min-h-screen w-full items-center justify-center px-[clamp(12px,3vw,48px)] pt-[clamp(78px,9vw,130px)] pb-[clamp(30px,6vw,90px)]"
      >
        <div className="relative w-full max-w-[1280px]">
          <h2 className="text-center font-display text-[clamp(38px,6.6vw,86px)] leading-[1.02] font-bold tracking-[-0.035em] tint text-neutral-900 dark:text-white">
            What We&rsquo;ve Built
          </h2>

          <Carousel />

          <div className="mt-[clamp(22px,2.8vw,38px)] flex justify-center">
            <a
              href="#/signup"
              onClick={(event) => {
                event.preventDefault();
                navigate("signup");
              }}
              className="group inline-flex items-center gap-2 rounded-full bg-neutral-900 px-[clamp(20px,2.1vw,32px)] py-[clamp(11px,1.15vw,16px)] text-[clamp(12px,1.05vw,15px)] font-medium text-white shadow-[0_18px_30px_-18px_rgba(0,0,0,0.8)] transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Start your 7-day free trial

              <svg
                viewBox="0 0 12 12"
                className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-[2px]"
                fill="none"
              >
                <path
                  d="M2.5 6h7M6.6 2.8 9.8 6l-3.2 3.2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>
      </section>

      <ExpertiseSection />

      <IntegrationSection />

      <PricingSection />

      <div className="pt-32 sm:pt-52 lg:pt-64">
        <Footer />
      </div>
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────
   404
   ────────────────────────────────────────────────────────────── */

function NotFound() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
        Error 404
      </p>

      <h1 className="font-display text-[clamp(36px,6vw,72px)] font-bold leading-[1.05] tracking-[-0.03em] text-neutral-900 dark:text-white">
        Page not found
      </h1>

      <p className="max-w-md text-neutral-600 dark:text-neutral-400">
        The page you are looking for doesn&rsquo;t exist or has been moved.
      </p>

      <a
        href="#/"
        onClick={(event) => {
          event.preventDefault();
          navigate("");
        }}
        className="inline-flex items-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        Back to home
      </a>
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────
   ROUTES
   ────────────────────────────────────────────────────────────── */

const PROTECTED_ROUTES = new Set([
  "home",
  "template",
  "billing",
  "help",
  "api",
  "apps",
  "beta",
  "refer",
  "create",
  "insights",
  "community",
  "integrations",
  "settings",
  "schedule",
  "calendar",
  "channels",
  "tiktok-callback",
  "pinterest-callback",
  "youtube-callback",
  "canva-callback",
]);

// "create" a sa propre page (pages/Create.tsx) : il n'est plus rendu par DashboardHome.
const DASHBOARD_HOME_ROUTES = new Set([
  "home",
  "billing",
  "help",
  "api",
  "apps",
  "beta",
  "refer",
]);

const AUTH_ROUTES = new Set(["signin", "signup"]);

const PUBLIC_ROUTES = new Set(["", "pricing", "faq", "tos", "privacy"]);

function normalizeRoute(route: string | null | undefined): string {
  return (route ?? "").replace(/^\/+|\/+$/g, "").toLowerCase();
}

/* ──────────────────────────────────────────────────────────────
   APP BOOT
   ────────────────────────────────────────────────────────────── */

/**
 * Attend simplement que la session Supabase soit connue.
 * Écran noir pendant ce temps, jamais la landing.
 * L'animation Stone est gérée dans AppContent (à l'arrivée
 * sur une page privée après connexion).
 */
function AppBoot() {
  const { loading } = useUser();

  if (loading) {
    return <div className="fixed inset-0 z-[999999] bg-[#050505]" />;
  }

  return <AppWithTheme />;
}

/* ──────────────────────────────────────────────────────────────
   APP
   ────────────────────────────────────────────────────────────── */

export default function App() {
  if (isCanvaReturnPage()) {
    return <CanvaReturnConfirmation />;
  }

  return (
    <ThemeProvider>
      <UserProvider>
        <AppBoot />
      </UserProvider>
    </ThemeProvider>
  );
}

/* ──────────────────────────────────────────────────────────────
   THEME + ROUTE
   ────────────────────────────────────────────────────────────── */

function AppWithTheme() {
  const { theme, toggle } = useTheme();

  const route = useHashRoute();

  return <AppContent theme={theme} toggle={toggle} route={route} />;
}

type AppContentProps = {
  theme: Theme;
  toggle: ToggleThemeFn;
  route: string;
};

/* ──────────────────────────────────────────────────────────────
   APP CONTENT (wrapper : écran de chargement Stone)
   ────────────────────────────────────────────────────────────── */

/**
 * Affiche l'animation Stone par-dessus la page quand un utilisateur
 * connecté arrive sur une page privée. La page se charge derrière
 * pendant l'animation.
 *
 * - Navigation entre pages privées : rien ne se rejoue.
 * - Déconnexion : l'animation rejouera à la prochaine connexion.
 * - Pages de callback OAuth : pas d'animation.
 */
function AppContent(props: AppContentProps) {
  const { user } = useUser();

  const [bootShown, setBootShown] = useState(false);

  const route = normalizeRoute(props.route);

  const showBoot =
    !!user &&
    PROTECTED_ROUTES.has(route) &&
    !OAUTH_CALLBACK_ROUTES.has(route) &&
    !bootShown;

  const handleBootComplete = useCallback(() => {
    setBootShown(true);
  }, []);

  useEffect(() => {
    if (!user) setBootShown(false);
  }, [user]);

  return (
    <>
      <AppContentInner {...props} />

      {showBoot && <StoneBoot onComplete={handleBootComplete} />}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
   APP CONTENT (routing)
   ────────────────────────────────────────────────────────────── */

function AppContentInner({
  theme,
  toggle,
  route: rawRoute,
}: AppContentProps) {
  const { user, loading } = useUser();

  const route = normalizeRoute(rawRoute);

  const isAuth = AUTH_ROUTES.has(route);
  const isProtected = PROTECTED_ROUTES.has(route);
  const isTemplate = route === "template";
  const isPublic = PUBLIC_ROUTES.has(route);
  const isPricing = route === "pricing";
  const isFaq = route === "faq";
  const isTos = route === "tos";
  const isPrivacy = route === "privacy";
  const isLanding = route === "";

  const isUnknown = !isAuth && !isProtected && !isPublic;

  useGentleWheelScroll(isLanding || isPricing);

  /* ─────────────────────────────────────────────
     ROUTE GUARD
     ───────────────────────────────────────────── */

  useEffect(() => {
    if (loading) return;

    /*
     * Utilisateur déconnecté + route privée → signin
     */
    if (!user && isProtected) {
      if (OAUTH_CALLBACK_ROUTES.has(route)) {
        try {
          sessionStorage.setItem(POST_LOGIN_ROUTE_KEY, route);
        } catch {
          // ignore
        }
      }

      navigate("signin", { replace: true });

      return;
    }

    /*
     * Utilisateur connecté
     */
    if (user) {
      let pending: string | null = null;

      try {
        pending = sessionStorage.getItem(POST_LOGIN_ROUTE_KEY);
      } catch {
        // ignore
      }

      /*
       * Retour vers la route demandée avant authentification.
       */
      if (pending) {
        try {
          sessionStorage.removeItem(POST_LOGIN_ROUTE_KEY);
        } catch {
          // ignore
        }

        if (route !== pending) {
          navigate(pending, { replace: true });

          return;
        }
      }

      /*
       * Un utilisateur connecté ne doit jamais revoir
       * /signin, /signup, /
       */
      if (isAuth || isLanding) {
        navigate("home", { replace: true });
      }
    }
  }, [user, loading, isProtected, isAuth, isLanding, route]);

  /*
   * Sécurité : AppBoot empêche normalement déjà ce rendu
   * avant que loading soit terminé.
   */
  if (loading) {
    return <div className="fixed inset-0 z-[999999] bg-[#050505]" />;
  }

  /*
   * Empêche une frame d'une page privée avant la redirection
   * vers signin.
   */
  if (!user && isProtected) {
    return null;
  }

  /*
   * Empêche une frame de landing/signin/signup lorsqu'un
   * utilisateur est déjà connecté.
   */
  if (user && (isAuth || isLanding)) {
    return null;
  }

  /* ─────────────────────────────────────────────
     AUTH
     ───────────────────────────────────────────── */

  if (isAuth) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden font-sans">
        {route === "signin" ? <Signin /> : <Signup />}
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     FAQ
     ───────────────────────────────────────────── */

  if (isFaq) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden font-sans">
        <Faq />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     TOS
     ───────────────────────────────────────────── */

  if (isTos) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden font-sans">
        <Tos />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     PRIVACY
     ───────────────────────────────────────────── */

  if (isPrivacy) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden font-sans">
        <Privacy />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     PRICING
     ───────────────────────────────────────────── */

  if (isPricing) {
    return (
      <div className="tint relative min-h-screen w-full overflow-x-hidden bg-white font-sans dark:bg-[#050505]">
        <Pricing />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     TIKTOK CALLBACK
     ───────────────────────────────────────────── */

  if (route === "tiktok-callback") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <TikTokCallback />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     PINTEREST CALLBACK
     ───────────────────────────────────────────── */

  if (route === "pinterest-callback") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <PinterestCallback />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     YOUTUBE CALLBACK
     ───────────────────────────────────────────── */

  if (route === "youtube-callback") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <YouTubeCallback />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     CANVA CALLBACK
     ───────────────────────────────────────────── */

  if (route === "canva-callback") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <CanvaCallback />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     INTEGRATIONS
     ───────────────────────────────────────────── */

  if (route === "integrations") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <IntegrationsPage />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     SETTINGS
     ───────────────────────────────────────────── */

  if (route === "settings") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <Settings />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     SCHEDULE / CALENDAR
     ───────────────────────────────────────────── */

  if (route === "schedule" || route === "calendar") {
    return (
      <div className="relative h-screen w-screen overflow-y-auto overflow-x-hidden font-sans">
        <Schedule />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     INSIGHTS
     ───────────────────────────────────────────── */

  if (route === "insights") {
    return (
      <div className="relative h-screen w-screen overflow-y-auto overflow-x-hidden font-sans">
        <Insights />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     COMMUNITY
     ───────────────────────────────────────────── */

  if (route === "community") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <Community />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     CREATE
     ───────────────────────────────────────────── */

  if (route === "create") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <Create />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     CHANNELS
     ───────────────────────────────────────────── */

  if (route === "channels") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <Channels />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     TEMPLATES
     ───────────────────────────────────────────── */

  if (isTemplate) {
    return (
      <div className="relative min-h-screen w-screen overflow-y-auto overflow-x-hidden font-sans">
        <TemplatesPage />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     DASHBOARD HOME
     ───────────────────────────────────────────── */

  if (DASHBOARD_HOME_ROUTES.has(route)) {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <DashboardHome />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     404
     ───────────────────────────────────────────── */

  if (isUnknown) {
    return (
      <div className="tint relative min-h-screen w-full overflow-x-hidden bg-white font-sans dark:bg-[#050505]">
        <Navbar theme={theme} onToggleTheme={toggle} />

        <NotFound />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     LANDING
     ───────────────────────────────────────────── */

  return (
    <div className="tint relative min-h-screen w-full overflow-x-hidden bg-white font-sans dark:bg-[#050505]">
      <Navbar theme={theme} onToggleTheme={toggle} />

      <Home />
    </div>
  );
}