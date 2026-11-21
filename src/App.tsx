import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import Navbar from "./components/Navbar";
import StoneBoot from "./components/StoneBoot";
import StoneLoading from "./components/StoneLoading";
import CheckoutReturnModal from "./components/CheckoutReturnModal";
import { sectionFromSlug } from "./utils/settingsRoute";

const Signup = lazy(() => import("./pages/signup"));
const Signin = lazy(() => import("./pages/signin"));
const TwoFactor = lazy(() => import("./pages/twofactor"));
const ForgotPassword = lazy(() => import("./pages/forgotpassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const DashboardHome = lazy(() => import("./pages/home"));
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
const InstagramCallback = lazy(() => import("./pages/InstagramCallback"));
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
const INSTAGRAM_OAUTH_STORAGE_KEY = "instagram_oauth_params";
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
  "instagram-callback",
]);

type OAuthProvider =
  | "tiktok"
  | "pinterest"
  | "youtube"
  | "dropbox"
  | "googledrive"
  | "googlephotos"
  | "instagram";

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
interceptOAuthCallback("instagram", INSTAGRAM_OAUTH_STORAGE_KEY);

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
  "instagram-callback",
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
      <Suspense fallback={<StoneLoading />}>
        <AppContentInner {...props} />
      </Suspense>
      {showBoot && <StoneBoot onComplete={handleBootComplete} />}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
   APP CONTENT (routing)
   ────────────────────────────────────────────────────────────── */


/* PUBLIC HOME — editorial SaaS landing */
function Home() {
  const go = (to: string) => navigate(to);
  const platforms = ["Instagram", "TikTok", "YouTube", "Facebook", "Pinterest", "Threads"];
  const items = [
    { title: "Plan your content in one place", text: "A calm, visual workspace to organise every post and keep your publishing rhythm.", icon: "✳" },
    { title: "Publish across your channels", text: "Create once, adapt your content and schedule it for all your connected networks.", icon: "◷" },
    { title: "Understand what works", text: "See your performance at a glance and turn your insights into your next idea.", icon: "⌁" },
  ];
  return (
    <main className="stone-landing min-h-screen bg-[#fbfbfa] text-[#151515] font-sans">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <header className="flex h-[76px] items-center justify-between border-b border-black/[0.07]">
          <a href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight"><img src="/images/icon_nav.png" alt="" className="h-6 w-6 object-contain" />Stone</a>
          <nav className="hidden items-center gap-7 text-[12px] text-neutral-500 md:flex"><a href="#features" className="hover:text-black">Features</a><a href="#workflow" className="hover:text-black">Workflow</a><a href="#platforms" className="hover:text-black">Platforms</a><a href="#faq" className="hover:text-black">About</a></nav>
          <button onClick={() => go("signin")} className="rounded-full bg-black px-5 py-2.5 text-[11px] font-medium text-white transition hover:bg-neutral-700">SIGN IN ↗</button>
        </header>

        <section className="relative grid min-h-[620px] items-center gap-10 py-16 md:grid-cols-[1.02fr_.98fr] md:py-20">
          <div className="relative z-10 max-w-[570px]">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/[0.08] px-3 py-1.5 text-[11px] text-neutral-600"><span className="h-1.5 w-1.5 rounded-full bg-black"/> Social publishing workspace</p>
            <h1 className="text-[clamp(42px,6vw,76px)] leading-[.98] tracking-[-.065em] font-medium">Your social media.<br/>In <span className="text-neutral-400">perfect sync.</span></h1>
            <p className="mt-7 max-w-[430px] text-[15px] leading-7 text-neutral-500">Plan, create and publish content across your social channels — all from one thoughtful workspace.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3"><button onClick={() => go("signup")} className="rounded-full bg-black px-6 py-3.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-neutral-800">Get started free ↗</button><button onClick={() => go("signin")} className="rounded-full border border-black/10 px-6 py-3.5 text-sm transition hover:bg-white">Log in</button></div>
            <p className="mt-5 text-[11px] text-neutral-400">One workspace. All your channels. Less busywork.</p>
          </div>
          <div className="relative mx-auto w-full max-w-[520px]">
            <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,.06),transparent_65%)]"/>
            <div className="relative overflow-hidden rounded-[28px] border border-black/[0.07] bg-white p-4 shadow-[0_30px_100px_rgba(0,0,0,.08)]">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3"><div className="flex items-center gap-2 text-xs font-semibold"><span className="grid h-7 w-7 place-items-center rounded-lg bg-black text-white">S</span>Publishing calendar</div><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] text-neutral-500">November</span></div>
              <div className="grid grid-cols-7 gap-1 pt-3 text-center text-[10px] text-neutral-400">{["M","T","W","T","F","S","S"].map((d,i)=><div key={i} className="py-2">{d}</div>)}</div>
              <div className="grid grid-cols-7 gap-1">{Array.from({length:35},(_,i)=><div key={i} className={`min-h-[54px] rounded-lg border border-black/[0.035] p-1.5 ${[4,9,15,19,23,27].includes(i)?"bg-[#f7f7f5]":""}`}><span className="text-[9px] text-neutral-400">{i+1}</span>{[4,9,15,19,23,27].includes(i)&&<div className="mt-1 rounded-md bg-black px-1 py-1 text-left text-[8px] text-white"><span className="block truncate">{["Reel","Post","Short","Carousel","Story","Video"][([4,9,15,19,23,27].indexOf(i))]}</span></div>}</div>)}</div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f7f7f6] px-3 py-3"><div><p className="text-[10px] text-neutral-400">Next scheduled</p><p className="mt-1 text-xs font-medium">Today · 4:30 PM</p></div><div className="flex -space-x-2">{["I","T","Y"].map((x,i)=><span key={x} className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-neutral-900 text-[9px] text-white">{x}</span>)}</div></div>
            </div>
            <div className="absolute -bottom-6 -left-5 hidden rounded-2xl border border-black/[0.06] bg-white px-4 py-3 shadow-xl sm:block"><p className="text-[10px] text-neutral-400">Channels connected</p><p className="mt-1 text-lg font-medium">6 <span className="text-xs text-neutral-400">platforms</span></p></div>
          </div>
        </section>

        <section id="platforms" className="border-y border-black/[0.07] py-8"><div className="flex flex-col items-center gap-5 md:flex-row md:justify-between"><p className="max-w-[130px] text-[10px] leading-4 text-neutral-500">Bring all your social channels together</p><div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-xs font-medium text-neutral-500">{platforms.map(p=><span key={p} className="transition hover:text-black">{p}</span>)}</div></div></section>

        <section id="features" className="py-24 text-center"><p className="text-[10px] uppercase tracking-[.2em] text-neutral-400">The Stone workspace</p><h2 className="mx-auto mt-4 max-w-2xl text-3xl font-medium tracking-[-.045em] sm:text-4xl">Everything you need.<br/>Nothing in your way.</h2><p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-neutral-500">A simple toolkit for a more intentional social presence, from first idea to published post.</p><div className="mt-12 grid gap-0 border border-black/[0.07] sm:grid-cols-3">{items.map((item,i)=><article key={item.title} className="group border-b border-black/[0.07] p-8 text-left transition hover:bg-white sm:border-b-0 sm:border-r sm:last:border-r-0"><span className="grid h-10 w-10 place-items-center rounded-xl border border-black/[0.08] text-lg text-neutral-400 group-hover:text-black">{item.icon}</span><h3 className="mt-7 text-[15px] font-medium">{item.title}</h3><p className="mt-3 text-xs leading-5 text-neutral-500">{item.text}</p></article>)}</div></section>

        <section id="workflow" className="grid overflow-hidden border border-black/[0.07] md:grid-cols-2">
          <div className="flex min-h-[330px] items-center justify-center bg-[#f5f5f3] p-8"><div className="relative flex h-[260px] w-full max-w-[400px] items-center justify-center"><div className="absolute h-48 w-48 rounded-full border border-dashed border-black/10"/>{["✎","◷","↗","▦"].map((v,i)=><div key={i} className={`absolute grid h-11 w-11 place-items-center rounded-full border border-black/[0.06] bg-white text-sm shadow-sm ${["top-4 left-1/2 -translate-x-1/2","right-5 top-1/2 -translate-y-1/2","bottom-4 left-1/2 -translate-x-1/2","left-5 top-1/2 -translate-y-1/2"][i]}`}>{v}</div>)}<div className="grid h-12 w-12 place-items-center rounded-full bg-black text-white">S</div></div></div>
          <div className="flex flex-col justify-center p-10 md:p-14"><p className="text-[10px] uppercase tracking-[.18em] text-neutral-400">A connected workflow</p><h3 className="mt-4 text-2xl font-medium tracking-tight">From idea to published, without the friction.</h3><p className="mt-4 text-sm leading-6 text-neutral-500">Draft your content, choose your channels, preview the post and schedule it. Stone keeps your work organised while you focus on creating.</p><button onClick={() => go("signup")} className="mt-7 self-start text-xs font-medium underline underline-offset-4">Explore Stone ↗</button></div>
        </section>

        <section className="grid gap-8 py-20 md:grid-cols-2 md:items-center"><div className="rounded-2xl border border-black/[0.07] bg-white p-6"><div className="flex items-center justify-between text-xs"><span className="font-medium">Weekly overview</span><span className="text-neutral-400">Insights</span></div><div className="mt-8 flex h-44 items-end gap-3">{[35,58,45,76,55,91,66,82,49,70,100,65].map((h,i)=><div key={i} className="flex-1 rounded-t-md bg-neutral-200 transition hover:bg-black" style={{height:`${h}%`}} />)}</div><div className="mt-4 flex justify-between text-[10px] text-neutral-400"><span>Reach</span><span>Engagement</span><span>Growth</span></div></div><div><p className="text-[10px] uppercase tracking-[.18em] text-neutral-400">Insights</p><h3 className="mt-4 text-3xl font-medium tracking-[-.04em]">Make every post count.</h3><p className="mt-4 text-sm leading-6 text-neutral-500">Understand how your content performs with a clear overview of your social analytics, so you can spend more time on what resonates.</p><button onClick={() => go("signup")} className="mt-6 text-xs font-medium underline underline-offset-4">Start creating ↗</button></div></section>

        <section id="faq" className="border-t border-black/[0.07] py-20 text-center"><p className="text-[10px] uppercase tracking-[.2em] text-neutral-400">Ready when you are</p><h2 className="mt-4 text-3xl font-medium tracking-[-.04em] sm:text-4xl">A better way to show up.</h2><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-neutral-500">Make space for creativity. Let Stone take care of the planning.</p><button onClick={() => go("signup")} className="mt-8 rounded-full bg-black px-7 py-3.5 text-sm text-white transition hover:bg-neutral-800">Create your account ↗</button></section>
        <footer className="flex flex-col gap-6 border-t border-black/[0.07] py-8 text-[10px] text-neutral-400 sm:flex-row sm:items-center sm:justify-between"><a href="/" className="flex items-center gap-2 font-semibold text-neutral-800"><img src="/images/icon_nav.png" alt="" className="h-5 w-5"/>Stone</a><div className="flex flex-wrap gap-5"><a href="#features">Features</a><a href="#platforms">Platforms</a><button onClick={() => go("pricing")}>Pricing</button><button onClick={() => go("signin")}>Sign in</button><button onClick={() => go("signup")}>Get started</button></div><span>© {new Date().getFullYear()} Stone</span></footer>
      </div>
      <style>{`@keyframes stone-rise {from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}} .stone-landing section{animation:stone-rise .7s cubic-bezier(.2,.8,.2,1) both} .stone-landing section:nth-of-type(2){animation-delay:.08s} @media(prefers-reduced-motion:reduce){.stone-landing section{animation:none}}`}</style>
    </main>
  );
}

function AppContentInner({
  theme,
  toggle,
  route: rawRoute,
}: AppContentProps) {
  const { user, loading, authError, refreshUser } = useUser();
  const route = normalizeRoute(rawRoute);

  // Précharge Create pendant que le dashboard Home est affiché :
  // évite que Suspense remplace toute l’application par l’écran de chargement
  // lors de la première navigation vers /create.
  useEffect(() => {
    if (route === "home") {
      void import("./pages/Create");
    }
  }, [route]);

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

  useGentleWheelScroll(isPricing);

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
    return <StoneLoading />;
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
      <div className="relative h-screen w-full overflow-hidden font-sans">
        <TikTokCallback />
      </div>
    );
  }

  if (route === "pinterest-callback") {
    return (
      <div className="relative h-screen w-full overflow-hidden font-sans">
        <PinterestCallback />
      </div>
    );
  }

  if (route === "youtube-callback") {
    return (
      <div className="relative h-screen w-full overflow-hidden font-sans">
        <YouTubeCallback />
      </div>
    );
  }

  if (route === "dropbox-callback") {
    return (
      <div className="relative h-screen w-full overflow-hidden font-sans">
        <DropboxCallback />
      </div>
    );
  }

  if (route === "instagram-callback") {
    return (
      <div className="relative h-screen w-full overflow-hidden font-sans">
        <InstagramCallback />
      </div>
    );
  }

  if (route === "googledrive-callback") {
    return (
      <div className="relative h-screen w-full overflow-hidden font-sans">
        <GoogleDriveCallback />
      </div>
    );
  }

  if (route === "googlephotos-callback") {
    return (
      <div className="relative h-screen w-full overflow-hidden font-sans">
        <GooglePhotosCallback />
      </div>
    );
  }

  if (route === "canva-callback") {
    return (
      <div className="relative h-screen w-full overflow-hidden font-sans">
        <CanvaCallback />
      </div>
    );
  }

  if (route === "integrations") {
    // Ancienne URL : Intégrations est désormais une section des Paramètres.
    return <Navigate to="settings/integrations" />;
  }

  if (route === "settings") {
    return (
      <div className="relative h-screen w-full overflow-hidden font-sans">
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
      <div className="relative h-screen w-full overflow-y-auto overflow-x-hidden font-sans">
        <Schedule />
      </div>
    );
  }

  if (route === "insights") {
    return (
      <div className="relative h-screen w-full overflow-y-auto overflow-x-hidden font-sans">
        <Insights />
      </div>
    );
  }

  if (route === "community") {
    return (
      <div className="relative h-screen w-full overflow-hidden font-sans">
        <Community />
      </div>
    );
  }

  if (route === "create") {
    return (
      <div className="relative h-screen w-full overflow-hidden font-sans">
        <Create />
      </div>
    );
  }

  if (isTemplate) {
    return (
      <div className="relative min-h-screen w-full overflow-y-auto overflow-x-hidden font-sans">
        <TemplatesPage />
      </div>
    );
  }

  if (DASHBOARD_HOME_ROUTES.has(route)) {
    return (
      <div className="relative h-screen w-full overflow-hidden font-sans">
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
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-sans dark:bg-[#050505]">
      <Home />
    </div>
  );
}