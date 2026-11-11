import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import Carousel from "./components/Carousel";
import ExpertiseSection from "./components/ExpertiseSection";
import IntegrationSection from "./components/IntegrationSection";
import Navbar from "./components/Navbar";
import PricingSection from "./components/PricingSection";
import Footer from "./components/Footer";
import StoneBoot from "./components/StoneBoot";
import CheckoutReturnModal from "./components/CheckoutReturnModal";
import { sectionFromSlug } from "./utils/settingsRoute";

const Signup = lazy(() => import("./pages/signup"));
const Signin = lazy(() => import("./pages/signin"));
const TwoFactor = lazy(() => import("./pages/twofactor"));
const ForgotPassword = lazy(() => import("./pages/forgotpassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const DashboardHome = lazy(() => import("./pages/home"));
const IntegrationsPage = lazy(() => import("./pages/integration"));
const Settings = lazy(() => import("./pages/settings"));
const Schedule = lazy(() => import("./pages/schedule"));
const Pricing = lazy(() => import("./pages/pricing"));
const Insights = lazy(() => import("./pages/Insights"));
const Community = lazy(() => import("./pages/Community"));
const Create = lazy(() => import("./pages/Create"));
const Faq = lazy(() => import("./pages/Faq"));
const Tos = lazy(() => import("./pages/tos"));
const Privacy = lazy(() => import("./pages/Privacy"));
const TemplatesPage = lazy(() => import("./pages/template"));
const TikTokCallback = lazy(() => import("./pages/TikTokCallback"));
const PinterestCallback = lazy(() => import("./pages/PinterestCallback"));
const YouTubeCallback = lazy(() => import("./pages/Youtubecallback"));
const DropboxCallback = lazy(() => import("./pages/DropboxCallback"));
const GoogleDriveCallback = lazy(() => import("./pages/GoogleDriveCallback"));
const GooglePhotosCallback = lazy(() => import("./pages/GooglePhotosCallback"));
const CanvaCallback = lazy(() => import("./pages/Canvacallback"));
const CanvaReturnConfirmation = lazy(() =>
  import("./pages/Canvacallback").then((module) => ({
    default: module.CanvaReturnConfirmation,
  }))
);

import { useHashRoute, navigate } from "./hooks/useHashRoute";
import { useTheme, ThemeProvider, type Theme } from "./hooks/useTheme";
import { UserProvider, useUser } from "./contexts/UserContext";
import { isRecoveryUrl } from "./services/supabase";
import { readCheckoutReturn } from "./services/stripe";
import {
  clearCache,
  PROFILE_REFRESH_INTERVAL_MS,
  readCache,
  writeCache,
} from "./services/channelsCache";
import { getPinterestStatus } from "./services/pinterest";
import { refreshTikTokCache } from "./services/tiktok";
import { getYouTubeStatus } from "./services/youtube";
import { getInstagramStatus } from "./services/instagram";

/* ──────────────────────────────────────────────────────────────
   OAUTH CALLBACK INTERCEPTION
   ────────────────────────────────────────────────────────────── */

const TIKTOK_OAUTH_STORAGE_KEY = "tiktok_oauth_params";
const PINTEREST_OAUTH_STORAGE_KEY = "pinterest_oauth_params";
const YOUTUBE_OAUTH_STORAGE_KEY = "youtube_oauth_params";
const DROPBOX_OAUTH_STORAGE_KEY = "dropbox_oauth_params";
const GOOGLE_DRIVE_OAUTH_STORAGE_KEY = "google_drive_oauth_params";
const GOOGLE_PHOTOS_OAUTH_STORAGE_KEY = "google_photos_oauth_params";
const CANVA_OAUTH_STORAGE_KEY = "canva_oauth_params";

const POST_LOGIN_ROUTE_KEY = "post_login_route";

function hasCanvaReturnParameter(): boolean {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("correlation_jwt")
  );
}

function isCanvaReturnPage(): boolean {
  if (hasCanvaReturnParameter()) return true;
  if (typeof window === "undefined") return false;

  if (window.location.pathname.replace(/\/+$/, "") === "/canva-return") {
    return true;
  }

  if (/^#\/canva-return(?:[/?]|$)/i.test(window.location.hash)) {
    window.history.replaceState(null, "", "/canva-return");
    return true;
  }

  return false;
}

const OAUTH_CALLBACK_ROUTES = new Set([
  "tiktok-callback",
  "pinterest-callback",
  "youtube-callback",
  "canva-callback",
  "dropbox-callback",
  "googledrive-callback",
  "googlephotos-callback",
]);

type OAuthProvider =
  | "tiktok"
  | "pinterest"
  | "youtube"
  | "dropbox"
  | "googledrive"
  | "googlephotos";

function interceptOAuthCallback(
  provider: OAuthProvider,
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

  window.history.replaceState(null, "", `/${provider}-callback`);
}

interceptOAuthCallback("tiktok", TIKTOK_OAUTH_STORAGE_KEY);
interceptOAuthCallback("pinterest", PINTEREST_OAUTH_STORAGE_KEY);
interceptOAuthCallback("youtube", YOUTUBE_OAUTH_STORAGE_KEY);
interceptOAuthCallback("dropbox", DROPBOX_OAUTH_STORAGE_KEY);
interceptOAuthCallback("googledrive", GOOGLE_DRIVE_OAUTH_STORAGE_KEY);
interceptOAuthCallback("googlephotos", GOOGLE_PHOTOS_OAUTH_STORAGE_KEY);

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
    // Le composant affichera une erreur si les paramètres manquent.
  }

  window.history.replaceState(null, "", "/canva-callback");
}

interceptCanvaOAuthCallback();

/* ──────────────────────────────────────────────────────────────
   BOOTSTRAP : URL path-based → hash-based
   ──────────────────────────────────────────────────────────────
   L'app est hash-routée (#/settings/channels), mais OAuth et liens
   externes peuvent arriver en /settings/channels (sans #).
   Sans cette conversion, useHashRoute() renvoie "" → landing →
   reload loop → Vercel rate-limit (ERR_CONNECTION_RESET).

   IMPORTANT : les query params restent AVANT le # pour que
   window.location.search continue de fonctionner dans les
   handlers OAuth (ChannelsSection, checkout return, etc.).
*/

(function bootstrapPathToHash() {
  if (typeof window === "undefined") return;

  // Ne pas toucher les flux de récupération de mot de passe.
  if (isRecoveryUrl()) return;

  const { pathname, hash, search } = window.location;

  // Déjà hash-routé → rien à faire.
  if (hash) return;

  // Racine ou index → rien à faire.
  if (pathname === "/" || pathname === "/index.html") return;

  // Fichiers statiques et API proxy → ne pas toucher.
  if (pathname.startsWith("/assets/") || pathname.startsWith("/api/")) return;

  // Canva return est géré séparément (isCanvaReturnPage).
  if (pathname === "/canva-return") return;

  // /settings/channels?instagram=connected
  //   → /?instagram=connected#/settings/channels
  const cleanPath = pathname.replace(/\/+$/, "");
  window.history.replaceState(null, "", `/${search}#${cleanPath}`);
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
      if (!animationFrame) targetY = window.scrollY;
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
              href="/signup"
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
        href="/"
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
   NAVIGATE HELPER
   ────────────────────────────────────────────────────────────── */

function Navigate({ to }: { to: string }) {
  useEffect(() => {
    navigate(to, { replace: true });
  }, [to]);

  return null;
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
  "account",
  "schedule",
  "calendar",
  "channels",
  "tiktok-callback",
  "pinterest-callback",
  "youtube-callback",
  "canva-callback",
  "dropbox-callback",
  "googledrive-callback",
  "googlephotos-callback",
]);

const DASHBOARD_HOME_ROUTES = new Set([
  "home",
  "billing",
  "help",
  "api",
  "apps",
  "beta",
  "refer",
]);

const AUTH_ROUTES = new Set([
  "signin",
  "signup",
  "forgot-password",
  "two-factor",
]);

const PUBLIC_ROUTES = new Set([
  "",
  "pricing",
  "faq",
  "tos",
  "privacy",
  "reset-password",
]);

function normalizeRoute(route: string | null | undefined): string {
  const clean = (route ?? "").replace(/^\/+|\/+$/g, "").toLowerCase();
  return clean.startsWith("settings/") ? "settings" : clean;
}

function settingsSlug(route: string | null | undefined): string | undefined {
  const clean = (route ?? "").replace(/^\/+|\/+$/g, "").toLowerCase();
  return clean.startsWith("settings/")
    ? clean.slice("settings/".length)
    : undefined;
}

/* ──────────────────────────────────────────────────────────────
   APP BOOT
   ────────────────────────────────────────────────────────────── */

function AppBoot() {
  return <AppWithTheme skipInitialBoot={false} />;
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

function AppWithTheme({
  skipInitialBoot,
}: {
  skipInitialBoot: boolean;
}) {
  const { theme, toggle } = useTheme();
  const route = useHashRoute();

  return (
    <AppContent
      theme={theme}
      toggle={toggle}
      route={route}
      skipInitialBoot={skipInitialBoot}
    />
  );
}

type AppContentProps = {
  theme: Theme;
  toggle: ToggleThemeFn;
  route: string;
  skipInitialBoot: boolean;
};

/* ──────────────────────────────────────────────────────────────
   APP CONTENT (wrapper : écran de chargement Stone)
   ────────────────────────────────────────────────────────────── */

function AppContent(props: AppContentProps) {
  const { user } = useUser();
  const [bootShown, setBootShown] = useState(props.skipInitialBoot);
  const route = normalizeRoute(props.route);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    let active = true;
    let syncing = false;
    let lastRefreshAt = 0;
    let deferUntil = 0;
    let resumeRefreshTimeout: number | null = null;

    const refreshProfiles = async () => {
      if (
        !active ||
        syncing ||
        document.visibilityState === "hidden" ||
        Date.now() < deferUntil ||
        Date.now() - lastRefreshAt < PROFILE_REFRESH_INTERVAL_MS
      ) return;

      syncing = true;
      lastRefreshAt = Date.now();

      const refreshTikTok = async () => {
        if (!readCache(userId, "tiktok")?.connection.connected) return;

        try {
          await refreshTikTokCache(userId, { force: true });
        } catch (error) {
          console.warn("[Stone] Could not refresh TikTok profile:", error);
        }
      };

      const refreshPinterest = async () => {
        if (!readCache(userId, "pinterest")?.connection.connected) return;

        try {
          const status = await getPinterestStatus();
          if (!active) return;

          if (!status.connected) {
            clearCache(userId, "pinterest");
            return;
          }

          writeCache(
            userId,
            {
              connected: true,
              handle: status.account?.display_name ?? undefined,
              avatarUrl: status.account?.avatar_url ?? undefined,
            },
            "pinterest"
          );
        } catch (error) {
          console.warn("[Stone] Could not refresh Pinterest profile:", error);
        }
      };

      const refreshYouTube = async () => {
        if (!readCache(userId, "youtube")?.connection.connected) return;

        try {
          const status = await getYouTubeStatus();
          if (!active) return;

          if (!status.connected) {
            clearCache(userId, "youtube");
            return;
          }

          writeCache(
            userId,
            {
              connected: true,
              handle: status.account?.display_name ?? undefined,
              avatarUrl: status.account?.avatar_url ?? undefined,
            },
            "youtube"
          );
        } catch (error) {
          console.warn("[Stone] Could not refresh YouTube profile:", error);
        }
      };

      const refreshInstagram = async () => {
        if (!readCache(userId, "instagram")?.connection.connected) return;

        try {
          const status = await getInstagramStatus();
          if (!active) return;

          if (!status.connected) {
            clearCache(userId, "instagram");
            return;
          }

          writeCache(
            userId,
            {
              connected: true,
              handle: status.account?.display_name ?? undefined,
              avatarUrl: status.account?.avatar_url ?? undefined,
            },
            "instagram"
          );
        } catch (error) {
          console.warn("[Stone] Could not refresh Instagram profile:", error);
        }
      };

      try {
        await Promise.all([
          refreshTikTok(),
          refreshPinterest(),
          refreshYouTube(),
          refreshInstagram(),
        ]);
      } finally {
        syncing = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        if (resumeRefreshTimeout !== null) {
          window.clearTimeout(resumeRefreshTimeout);
          resumeRefreshTimeout = null;
        }
        return;
      }

      // Laisse le tableau de bord se réafficher avant de lancer les
      // vérifications réseau secondaires des profils sociaux.
      deferUntil = Date.now() + 1_500;
      if (resumeRefreshTimeout !== null) {
        window.clearTimeout(resumeRefreshTimeout);
      }
      resumeRefreshTimeout = window.setTimeout(() => {
        resumeRefreshTimeout = null;
        void refreshProfiles();
      }, 1_500);
    };

    void refreshProfiles();

    const intervalId = window.setInterval(
      () => void refreshProfiles(),
      PROFILE_REFRESH_INTERVAL_MS
    );

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      if (resumeRefreshTimeout !== null) {
        window.clearTimeout(resumeRefreshTimeout);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.id]);

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
      <Suspense
        fallback={
          <main className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#050505] text-white">
            <img
              src="/images/icon_nav.png"
              alt="Stone"
              className="h-16 w-16 animate-pulse object-contain"
            />
            <p className="mt-5 text-sm text-white/60">Loading your Stone workspace…</p>
          </main>
        }
      >
        <AppContentInner {...props} />
      </Suspense>
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
  const { user, loading, authError, refreshUser } = useUser();
  const route = normalizeRoute(rawRoute);

  const isAuth = AUTH_ROUTES.has(route);
  const checkoutReturn = readCheckoutReturn();
  const isAccountRoute = route === "account";
  const isCheckoutHome = route === "home" && checkoutReturn.status !== null;
  const isProtected =
    PROTECTED_ROUTES.has(route) && !isCheckoutHome && !isAccountRoute;
  const isTemplate = route === "template";
  const isPublic = PUBLIC_ROUTES.has(route);
  const isPricing = route === "pricing";
  const isFaq = route === "faq";
  const isTos = route === "tos";
  const isPrivacy = route === "privacy";
  const isLanding = route === "";

  const isUnknown = !isAuth && !PROTECTED_ROUTES.has(route) && !isPublic;

  useGentleWheelScroll(isLanding || isPricing);

  useEffect(() => {
    if (loading || (authError && !user && isProtected)) return;

    if (isAccountRoute) {
      const query = new URLSearchParams();

      if (checkoutReturn.status) {
        query.set("checkout", checkoutReturn.status);
      }

      if (checkoutReturn.sessionId) {
        query.set("session_id", checkoutReturn.sessionId);
      }

      navigate(
        query.size ? `home?${query.toString()}` : "home",
        { replace: true }
      );

      return;
    }

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

    if (user) {
      let pending: string | null = null;

      try {
        pending = sessionStorage.getItem(POST_LOGIN_ROUTE_KEY);
      } catch {
        // ignore
      }

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

      if (isAuth || isLanding) {
        navigate("home", { replace: true });
      }
    }
  }, [
    user,
    loading,
    authError,
    isProtected,
    isAuth,
    isLanding,
    isAccountRoute,
    route,
    checkoutReturn.status,
    checkoutReturn.sessionId,
  ]);

  if (authError && !user && isProtected) {
    return (
      <main
        role="alert"
        aria-live="assertive"
        className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#050505] px-6 text-center text-white"
      >
        <img
          src="/images/icon_nav.png"
          alt="Stone"
          className="mb-8 h-16 w-16 object-contain"
        />
        <h1 className="text-xl font-semibold">Your session could not be checked</h1>
        <p className="mt-2 max-w-sm text-sm text-white/60">
          The connection may be slow or temporarily unavailable. Your session has not been cleared.
        </p>
        <button
          type="button"
          onClick={() => void refreshUser()}
          className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-[#050505]"
        >
          Try again
        </button>
      </main>
    );
  }

  if (loading && !isPublic && !isAuth) {
    return (
      <main
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#050505] text-white"
      >
        <img
          src="/images/icon_nav.png"
          alt="Stone"
          className="h-16 w-16 animate-pulse object-contain"
        />
        <p className="mt-5 text-sm text-white/60">Loading your Stone workspace…</p>
      </main>
    );
  }

  if (isAccountRoute) return null;

  if (!user && isProtected) return null;

  if (user && (isAuth || isLanding)) return null;

  if (isAuth) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden font-sans">
        {route === "signin" ? (
          <Signin />
        ) : route === "two-factor" ? (
          <TwoFactor />
        ) : route === "forgot-password" ? (
          <ForgotPassword />
        ) : (
          <Signup />
        )}
      </div>
    );
  }

  if (route === "reset-password") {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden font-sans">
        <ResetPassword />
      </div>
    );
  }

  if (isFaq) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden font-sans">
        <Faq />
      </div>
    );
  }

  if (isTos) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden font-sans">
        <Tos />
      </div>
    );
  }

  if (isPrivacy) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden font-sans">
        <Privacy />
      </div>
    );
  }

  if (isPricing) {
    return (
      <div className="tint relative min-h-screen w-full overflow-x-hidden bg-white font-sans dark:bg-[#050505]">
        <Pricing />
      </div>
    );
  }

  if (route === "tiktok-callback") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <TikTokCallback />
      </div>
    );
  }

  if (route === "pinterest-callback") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <PinterestCallback />
      </div>
    );
  }

  if (route === "youtube-callback") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <YouTubeCallback />
      </div>
    );
  }

  if (route === "dropbox-callback") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <DropboxCallback />
      </div>
    );
  }

  if (route === "googledrive-callback") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <GoogleDriveCallback />
      </div>
    );
  }

  if (route === "googlephotos-callback") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <GooglePhotosCallback />
      </div>
    );
  }

  if (route === "canva-callback") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <CanvaCallback />
      </div>
    );
  }

  if (route === "integrations") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <IntegrationsPage />
      </div>
    );
  }

  if (route === "settings") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <Settings initialSection={sectionFromSlug(settingsSlug(rawRoute))} />
      </div>
    );
  }

  if (route === "channels") {
    // ancienne URL : redirige vers la nouvelle
    return <Navigate to="settings/channels" />;
  }

  if (route === "schedule" || route === "calendar") {
    return (
      <div className="relative h-screen w-screen overflow-y-auto overflow-x-hidden font-sans">
        <Schedule />
      </div>
    );
  }

  if (route === "insights") {
    return (
      <div className="relative h-screen w-screen overflow-y-auto overflow-x-hidden font-sans">
        <Insights />
      </div>
    );
  }

  if (route === "community") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <Community />
      </div>
    );
  }

  if (route === "create") {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <Create />
      </div>
    );
  }

  if (isTemplate) {
    return (
      <div className="relative min-h-screen w-screen overflow-y-auto overflow-x-hidden font-sans">
        <TemplatesPage />
      </div>
    );
  }

  if (DASHBOARD_HOME_ROUTES.has(route)) {
    return (
      <div className="relative h-screen w-screen overflow-hidden font-sans">
        <DashboardHome />
        {route === "home" && <CheckoutReturnModal />}
      </div>
    );
  }

  if (isUnknown) {
    return (
      <div className="tint relative min-h-screen w-full overflow-x-hidden bg-white font-sans dark:bg-[#050505]">
        <Navbar theme={theme} onToggleTheme={toggle} />
        <NotFound />
      </div>
    );
  }

  return (
    <div className="tint relative min-h-screen w-full overflow-x-hidden bg-white font-sans dark:bg-[#050505]">
      <Navbar theme={theme} onToggleTheme={toggle} />
      <Home />
    </div>
  );
}