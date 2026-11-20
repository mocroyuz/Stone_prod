import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, Check, Sparkles } from "lucide-react";

import Navbar from "./components/Navbar";
import LandingNav from "./components/landing/LandingNav";
import NetworkLogo, { NETWORK_LABELS, type LandingNetwork } from "./components/landing/NetworkLogo";
import { ComposerPreview, MonthPreview, InsightsPreview, CommentsPreview, MediaPreview } from "./components/landing/FeaturePreviews";
import Reveal from "./components/landing/Reveal";
import "./components/landing/landing.css";
import "./components/landing/stone-reference.css";
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


/* ──────────────────────────────────────────────────────────────
   PUBLIC HOME — landing page rendered directly by the root route
   ────────────────────────────────────────────────────────────── */

const HOME_NETWORKS: {
  id: LandingNetwork;
  status: string;
  state: "available" | "sandbox" | "unavailable";
}[] = [
  { id: "instagram", status: "Connexion disponible", state: "available" },
  { id: "threads", status: "Connexion disponible", state: "available" },
  { id: "youtube", status: "Connexion disponible", state: "available" },
  { id: "tiktok", status: "Sandbox", state: "sandbox" },
  { id: "pinterest", status: "Sandbox", state: "sandbox" },
  { id: "facebook", status: "Non disponible pour le moment", state: "unavailable" },
];

const HOME_STATS = [
  { value: "1", label: "espace de travail", note: "Vos contenus et vos comptes réunis" },
  { value: "6", label: "réseaux répertoriés", note: "Disponibilité indiquée pour chaque plateforme" },
  { value: "3", label: "connexions disponibles", note: "Instagram, Threads et YouTube" },
  { value: "1", label: "calendrier centralisé", note: "Une vue claire de vos publications" },
];

const HOME_PLANS = [
  {
    name: "Starter",
    price: "19",
    description: "Tout ce qu'il faut pour bien démarrer.",
    features: [
      "Jusqu'à 3 canaux",
      "10 publications par canal",
      "Statistiques de base",
      "Calendrier de contenu",
      "Jusqu'à 100 idées",
      "Jusqu'à 50 tags",
      "Extension web incluse",
    ],
  },
  {
    name: "Pro",
    price: "49",
    description: "Plus de liberté pour créer et grandir.",
    features: [
      "Tous les canaux",
      "Publications illimitées",
      "Statistiques avancées",
      "Calendrier de contenu",
      "Idées illimitées",
      "Jusqu'à 250 tags",
      "Extension web incluse",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "99",
    description: "Des solutions avancées pour les grandes organisations.",
    features: [
      "Tout ce qui est inclus dans Pro",
      "Limites de canaux personnalisées",
      "Publications illimitées",
      "Statistiques avancées",
      "Calendrier de contenu",
      "Idées et tags illimités",
      "Support prioritaire",
      "Accompagnement dédié",
    ],
  },
];

const HOME_FAQ = [
  {
    q: "Qu’est-ce que Stone ?",
    a: "Stone centralise la création, la programmation et le suivi de vos contenus sociaux dans un seul espace.",
  },
  {
    q: "Quels réseaux sont pris en charge ?",
    a: "Instagram, Threads et YouTube disposent de connexions disponibles. TikTok et Pinterest sont actuellement en mode sandbox. La connexion des Pages Facebook n'est pas encore disponible.",
  },
  {
    q: "Puis-je adapter un post à chaque plateforme ?",
    a: "Le composer permet de préparer un contenu et de l'adapter aux réseaux sélectionnés.",
  },
  {
    q: "Quelles données sont disponibles ?",
    a: "Les indicateurs et commentaires accessibles dépendent des plateformes et autorisations. Les Insights et commentaires sont actuellement principalement disponibles pour YouTube.",
  },
];

const HOME_SPOTLIGHT_POSTS: {
  network: LandingNetwork;
  title: string;
  schedule: string;
  state: string;
}[] = [
  { network: "instagram", title: "Nouvelle collection", schedule: "Aujourd’hui · 10:30", state: "Prêt" },
  { network: "youtube", title: "Short du mercredi", schedule: "Demain · 12:00", state: "Programmé" },
  { network: "threads", title: "Question à la communauté", schedule: "Jeudi · 17:45", state: "Brouillon" },
];

const HOME_STEPS = [
  { number: "01", title: "Connect", description: "Reliez vos comptes sociaux à votre espace Stone." },
  { number: "02", title: "Create & Schedule", description: "Préparez vos contenus et organisez leur publication." },
  { number: "03", title: "Analyze & Grow", description: "Consultez les résultats disponibles et ajustez votre rythme." },
];

function scrollHomeToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}

function HomeSectionTitle({
  tag,
  title,
  description,
}: {
  tag: string;
  title: ReactNode;
  description?: string;
}) {
  return (
    <Reveal className="stone-ref-heading">
      <span className="stone-ref-tag">{tag}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </Reveal>
  );
}

function HomeSpotlightPreview() {
  return (
    <div
      className="stone-ref-main-preview stone-ref-device"
      role="img"
      aria-label="Aperçu de Stone : calendrier des publications, comptes sociaux et statuts"
    >
      <div className="stone-ref-device-topbar">
        <div className="stone-ref-device-brand">
          <img src="/images/icon.png" alt="" />
          <span>STONE WORKSPACE</span>
        </div>
        <span className="stone-ref-device-live"><i />LIVE</span>
      </div>
      <div className="stone-ref-device-content">
        <span className="stone-ref-device-eyebrow">VOTRE ESPACE SOCIAL</span>
        <h3>Cette semaine</h3>
        <p className="stone-ref-device-date">18 — 24 novembre</p>
        <div className="stone-ref-device-days">
          {[
            { day: "LUN", date: "18" },
            { day: "MAR", date: "19", active: true },
            { day: "MER", date: "20" },
            { day: "JEU", date: "21" },
          ].map((item) => (
            <div key={item.day} className={item.active ? "is-active" : undefined}>
              <span>{item.day}</span>
              <b>{item.date}</b>
            </div>
          ))}
        </div>
        <div className="stone-ref-device-posts">
          {HOME_SPOTLIGHT_POSTS.map((post) => (
            <div className="stone-ref-device-post" key={post.title}>
              <NetworkLogo network={post.network} size={27} />
              <div className="stone-ref-device-post-copy">
                <strong>{post.title}</strong>
                <span>{post.schedule}</span>
              </div>
              <span className="stone-ref-device-post-state">{post.state}</span>
            </div>
          ))}
        </div>
        <div className="stone-ref-device-footer">
          <span><CalendarDays size={13} />Votre calendrier, au même endroit</span>
          <Check size={15} />
        </div>
      </div>
    </div>
  );
}

/** The root URL keeps rendering Home() from App.tsx, as in the original app. */
function Home() {
  return (
    <main className="stone-ref-page">
      <div className="stone-ref-frame">
        <LandingNav />

        <section className="stone-ref-hero" id="accueil">
          <Reveal className="stone-ref-hero-copy">
            <span className="stone-ref-pill"><Sparkles size={12} />Social media workspace</span>
            <h1>Your social presence.<br /><em>Beautifully organised.</em></h1>
            <p>
              Planifiez, créez et suivez vos contenus sur les réseaux connectés,
              depuis un espace pensé pour simplifier votre quotidien.
            </p>
            <div className="stone-ref-actions">
              <a className="stone-ref-primary" href="/signup">
                Commencer gratuitement <ArrowRight size={16} />
              </a>
              <button className="stone-ref-secondary" type="button" onClick={() => scrollHomeToSection("produit")}>
                Découvrir Stone <ArrowUpRight size={15} />
              </button>
            </div>
          </Reveal>

          <div className="stone-ref-mockup" role="group" aria-label="Aperçus visuels du workspace Stone">
            <div className="stone-ref-collage stone-ref-collage-left" aria-hidden="true"><ComposerPreview /></div>
            <div className="stone-ref-collage stone-ref-collage-right" aria-hidden="true"><MonthPreview /></div>
            <HomeSpotlightPreview />
            <div className="stone-ref-floating stone-ref-floating-top">
              <CalendarDays size={16} />
              <span><b>Publication planifiée</b><small>Votre calendrier centralisé</small></span>
              <Check size={14} />
            </div>
            <div className="stone-ref-floating stone-ref-floating-bottom">
              <ChartNoAxesCombined size={17} />
              <span><b>Vos performances</b><small>Les résultats en un coup d’œil</small></span>
            </div>
          </div>

          <div className="stone-ref-slogan" aria-label="Créer, planifier, publier, analyser">
            <span>Créer</span><i>·</i><span>Planifier</span><i>·</i><span>Publier</span><i>·</i><span>Analyser</span>
          </div>
        </section>

        <section className="stone-ref-stats">
          <Reveal className="stone-ref-about">
            <span className="stone-ref-tag">Pourquoi Stone</span>
            <h2>Tout votre social.<br /><em>Au même endroit.</em></h2>
            <p>
              Un espace de travail qui vous laisse vous concentrer sur vos idées,
              plutôt que sur les outils et les allers-retours.
            </p>
            <a href="/signup">Découvrir Stone <ArrowUpRight size={15} /></a>
          </Reveal>
          <div className="stone-ref-stat-grid">
            {HOME_STATS.map((stat, index) => (
              <Reveal key={stat.label} delay={index * 65}>
                <article><strong>{stat.value}</strong><b>{stat.label}</b><p>{stat.note}</p></article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="stone-ref-projects" id="produit">
          <HomeSectionTitle
            tag="Le workspace"
            title={<>Everything you need.<br /><em>Nothing in the way.</em></>}
            description="Les outils essentiels réunis dans une interface lisible et calme."
          />
          <div className="stone-ref-project-grid">
            <Reveal className="stone-ref-project-card stone-ref-project-wide">
              <span className="stone-ref-tag">01 · Composer</span>
              <h3>Préparez votre contenu en un seul endroit.</h3>
              <p>Écrivez, ajoutez vos médias et adaptez vos posts aux réseaux sélectionnés.</p>
              <ComposerPreview />
            </Reveal>
            <Reveal className="stone-ref-project-card">
              <span className="stone-ref-tag">02 · Calendar</span>
              <h3>Gardez le cap.</h3>
              <p>Une vue claire de vos publications à venir.</p>
              <MonthPreview />
            </Reveal>
            <Reveal className="stone-ref-project-card">
              <span className="stone-ref-tag">03 · Insights</span>
              <h3>Comprenez ce qui fonctionne.</h3>
              <p>Suivez les indicateurs disponibles pour vos comptes.</p>
              <InsightsPreview />
            </Reveal>
            <Reveal className="stone-ref-project-card stone-ref-project-wide">
              <span className="stone-ref-tag">04 · Media library</span>
              <h3>Vos ressources, sans friction.</h3>
              <p>Importez et préparez vos médias pour vos prochaines publications.</p>
              <MediaPreview />
            </Reveal>
            <Reveal className="stone-ref-project-card stone-ref-project-wide">
              <span className="stone-ref-tag">05 · Community</span>
              <h3>Ne perdez pas le fil.</h3>
              <p>Retrouvez les conversations et commentaires accessibles depuis vos comptes.</p>
              <CommentsPreview />
            </Reveal>
          </div>
        </section>

        <section className="stone-ref-networks" id="reseaux">
          <HomeSectionTitle
            tag="Connect your channels"
            title={<>One calendar.<br /><em>Multiple platforms.</em></>}
            description="Connectez vos comptes et gérez votre contenu dans un même workflow."
          />
          <div className="stone-ref-network-grid">
            {HOME_NETWORKS.map((network, index) => (
              <Reveal key={network.id} delay={index * 45}>
                <article>
                  <NetworkLogo network={network.id} size={38} />
                  <strong>{NETWORK_LABELS[network.id]}</strong>
                  <span className={`stone-ref-network-status is-${network.state}`}>{network.status}</span>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="stone-ref-how" id="fonctionnalites">
          <HomeSectionTitle
            tag="Workflow"
            title={<>Three steps.<br /><em>More time to create.</em></>}
            description="Un parcours simple pour passer de l’idée à la publication."
          />
          <div className="stone-ref-how-grid">
            {HOME_STEPS.map((step, index) => (
              <Reveal key={step.number} delay={index * 80}>
                <article><span>{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="stone-ref-pricing" id="tarifs">
          <HomeSectionTitle
            tag="Pricing"
            title={<>A plan for your<br /><em>next chapter.</em></>}
            description="Choisissez l’espace qui correspond à votre rythme."
          />
          <div className="stone-ref-price-grid">
            {HOME_PLANS.map((plan, index) => (
              <Reveal key={plan.name} delay={index * 70}>
                <article className={plan.featured ? "is-featured" : ""}>
                  <span className="stone-ref-plan-name">{plan.name}</span>
                  <p>{plan.description}</p>
                  <div className="stone-ref-price"><strong>{plan.price}€</strong><small>/ mois</small></div>
                  <a href="/pricing">Voir l’offre <ArrowRight size={14} /></a>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}><Check size={14} />{feature}</li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="stone-ref-faq" id="faq">
          <Reveal>
            <span className="stone-ref-tag">FAQ</span>
            <h2>Questions,<br /><em>answered.</em></h2>
          </Reveal>
          <div className="stone-ref-faq-list">
            {HOME_FAQ.map((item, index) => (
              <Reveal key={item.q}>
                <details open={index === 0}>
                  <summary>{item.q}<span>+</span></summary>
                  <p>{item.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="stone-ref-cta">
          <span className="stone-ref-tag">STONE WORKSPACE</span>
          <h2>Less managing.<br /><em>More creating.</em></h2>
          <p>Commencez à organiser votre présence sociale.</p>
          <a className="stone-ref-primary" href="/signup">Commencer gratuitement <ArrowRight size={16} /></a>
        </section>

        <footer className="stone-ref-footer">
          <a href="/" className="stone-ref-logo"><img src="/images/icon.png" alt="" />stone.</a>
          <span>Votre présence sociale, simplifiée.</span>
          <nav aria-label="Navigation de pied de page">
            <a href="/pricing">Tarifs</a>
            <a href="/faq">FAQ</a>
            <a href="/privacy">Confidentialité</a>
            <a href="/tos">Conditions</a>
          </nav>
          <small>© Stone</small>
        </footer>
      </div>
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