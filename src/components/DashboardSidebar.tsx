// src/components/DashboardSidebar.tsx
//
// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR v2 — nouvelle UX
//
// Ancien modèle : un panneau qui s'élargit/rétrécit (68px ↔ 200px) et pousse
// le contenu des pages à chaque bascule.
//
// Nouveau modèle :
//   • Un RAIL d'icônes permanent, collé au bord gauche de l'écran, pleine
//     hauteur, 72 px. Il ne bouge jamais : c'est un repère spatial stable.
//   • Un PANNEAU flyout (240 px) qui s'ouvre PAR-DESSUS le contenu quand on
//     le demande. Les pages ne bougent pas : leur offset est constant.
//   • Ouverture : clic sur le toggle, Ctrl/⌘+B (épinglé), ou survol du rail
//     (ouverture temporaire, refermée dès que la souris sort).
//   • Fermeture : clic extérieur, Échap, ou sortie du survol (si temporaire).
//   • Mobile : même rail, mais le flyout devient un tiroir plein écran avec
//     fond cliquable (le comportement précédent est conservé).
//
// Le rail collé à gauche = bord gauche et bord droit nets (pas d'arrondi),
// une seule séparatrice verticale côté contenu.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { useTheme, type Theme } from "../hooks/useTheme";
import { navigate, useHashRoute } from "../hooks/useHashRoute";
import {
  useConnectedChannels,
  type ConnectedChannel,
} from "../hooks/useConnectedChannels";
import {
  getCurrentUser,
  signOut,
  type UserProfile,
} from "../services/supabase";
import { useUser } from "../contexts/UserContext";
import {
  XIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
  YouTubeIcon,
  PinterestIcon,
  ThreadsIcon,
} from "./IntegrationIcons";
import ConnectChannelModal, {
  type ConnectChannelModalProps,
} from "./ConnectChannelModal";

/* Config + services des réseaux : la sidebar reste autonome et gère
   elle-même l'état des connexions (comme la page Channels). */
import {
  CHANNELS,
  PLAN,
  REAL_OAUTH,
  type ChannelKey,
  type ConnectionState,
} from "../pages/channels";
import {
  getTikTokStatus,
  startTikTokLogin,
  disconnectTikTok,
} from "../services/tiktok";
import {
  getPinterestStatus,
  startPinterestLogin,
  disconnectPinterest,
  connectPinterestWithToken,
} from "../services/pinterest";
import {
  getYouTubeStatus,
  startYouTubeLogin,
  disconnectYouTube,
} from "../services/youtube";
import {
  CACHE_MAX_AGE_MS,
  clearCache,
  readCache,
  writeCache,
  type CacheProvider,
  type Connection,
} from "../services/channelsCache";

/* ============================================================================
   Constantes de layout
   Le rail est FIXE : les pages ont toujours le même décalage, que le panneau
   flyout soit ouvert ou non (il recouvre le contenu, il ne le pousse pas).
============================================================================ */

const RAIL_WIDTH_PX = 72;
const PANEL_WIDTH_PX = 240;

export const SIDEBAR_COLLAPSED_OFFSET = RAIL_WIDTH_PX + 16;
export const SIDEBAR_EXPANDED_OFFSET = SIDEBAR_COLLAPSED_OFFSET;

const MOBILE_QUERY = "(max-width: 767px)";
const PANEL_TRANSITION_MS = 260;
const HOVER_OPEN_DELAY_MS = 220;
const HOVER_CLOSE_DELAY_MS = 160;

/* ============================================================================
   Types
============================================================================ */

type IconProps = { className?: string };
type IconComponent = (props: IconProps) => React.ReactElement;

type NavItem = {
  label: string;
  icon: IconComponent;
  route: string;
  badge?: string;
  disabled?: boolean;
};

type NetworkKey =
  | "x"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "threads";

type MenuItem = {
  label: string;
  icon: IconComponent;
  badge?: string;
  route?: string;
  action?: "logout" | "toggleTheme";
  disabled?: boolean;
};

type StatusResponse = {
  connected: boolean;
  account:
    | { display_name?: string | null; avatar_url?: string | null; avatarUrl?: string | null }
    | null
    | undefined;
};

type ThemeTokens = {
  rail: string;
  panel: string;
  divider: string;
  railItem: string;
  railItemActive: string;
  railIcon: string;
  label: string;
  labelActive: string;
  railBg: string;
  dotRing: string;
  title: string;
  muted: string;
  menu: string;
  menuDivider: string;
  menuItem: string;
  menuIcon: string;
  badge: string;
  accent: string;
  accentSolid: string;
  upgrade: string;
  avatarRing: string;
  avatar: string;
  ring: string;
  hoverBorder: string;
};

type ToggleOrigin = { x: number; y: number };
type ToggleThemeFn = (origin?: ToggleOrigin) => void;

/* ============================================================================
   Raccourcis clavier (identiques à la v1 : Alt/⌥ + lettre, Ctrl/⌘+B)
============================================================================ */

const IS_MAC =
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad/i.test((navigator as { platform?: string }).platform ?? "");

const TOGGLE_SHORTCUT_LABEL = IS_MAC ? "⌘B" : "Ctrl B";

/** lettre → route */
const SHORTCUT_ROUTES: Record<string, string> = {
  h: "home",
  d: "schedule",
  t: "template",
  s: "settings",
  l: "channels",
  u: "pricing",
  f: "faq",
  k: "create",
  i: "integrations",
};

function shortcutLabel(key: string): string {
  return IS_MAC ? `⌥${key.toUpperCase()}` : `Alt ${key.toUpperCase()}`;
}

function ariaShortcut(key: string): string {
  return `Alt+${key.toUpperCase()}`;
}

function shortcutForRoute(route: string): string | undefined {
  const key = Object.entries(SHORTCUT_ROUTES).find(([, r]) => r === route)?.[0];
  return key ? shortcutLabel(key) : undefined;
}

function shortcutKey(event: KeyboardEvent): string {
  return /^Key[A-Z]$/.test(event.code) ? event.code.slice(3).toLowerCase() : "";
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(
    el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
  );
}

function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={[
        "select-none rounded-md px-1.5 py-0.5 font-sans text-[10px] font-semibold",
        className,
      ].join(" ")}
    >
      {children}
    </kbd>
  );
}

/* ============================================================================
   Responsive : sous 768 px le flyout devient un tiroir plein écran
============================================================================ */

function subscribeMobile(listener: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}

function getMobileSnapshot(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia)
    ? window.matchMedia(MOBILE_QUERY).matches
    : false;
}

function useIsMobile(): boolean {
  return useSyncExternalStore(subscribeMobile, getMobileSnapshot, () => false);
}

/* ============================================================================
   Icônes
============================================================================ */

function Svg({ className = "h-4 w-4", children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={["select-none", className].join(" ")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function HomeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 12.5 12 5l8 7.5" />
      <path d="M6 10.5V18h12v-7.5" />
    </Svg>
  );
}

function CalendarIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M3.5 9.5h17" />
    </Svg>
  );
}

function TemplatesIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 5.5h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z" />
      <path d="M8 10h8M8 14h8" />
    </Svg>
  );
}

function SettingsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

function ChannelsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="7.5" r="2.5" />
      <circle cx="7.5" cy="16.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </Svg>
  );
}

function BillingIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.5 9.5c-.4-.9-1.4-1.5-2.5-1.5-1.4 0-2.5.8-2.5 1.9 0 2.6 5 1.2 5 4 0 1.1-1.1 1.9-2.5 1.9-1.2 0-2.2-.6-2.6-1.6M12 6.5V8M12 16v1.5" />
    </Svg>
  );
}

function HelpIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.5a2.5 2.5 0 0 1 4.8.9c0 1.6-2.4 2.1-2.4 3.6M12 16.8v.1" />
    </Svg>
  );
}

function LightbulbIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.3V16h6v-.2c0-.9.4-1.7 1-2.3A6 6 0 0 0 12 3Z" />
    </Svg>
  );
}

function AppsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </Svg>
  );
}

function LogoutIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
      <path d="M14 8.5 18 12l-4 3.5M18 12H9.5" />
    </Svg>
  );
}

function BoltIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13 3.5 5.5 13.2h5.6L10 20.5l7.5-9.7h-5.6L13 3.5Z" />
    </Svg>
  );
}

/** Panneau latéral : la tranche gauche se remplit quand le flyout est épinglé. */
function PanelIcon({ className, open }: IconProps & { open: boolean }) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <path
        d="M9.5 4.5v15"
        strokeWidth={open ? 2.4 : 1.8}
        className="transition-[stroke-width] duration-200"
      />
    </Svg>
  );
}

function PlusIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

function PublishIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M3.5 9.5h17" />
    </Svg>
  );
}

function CommunityIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 5.5h10a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H8.5L5.5 16v-2.5H4A1.5 1.5 0 0 1 2.5 12V7A1.5 1.5 0 0 1 4 5.5Z" />
      <path d="M18.5 9.5H20a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-1.5V20l-3-2.5H11" />
    </Svg>
  );
}

function InsightsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 18V9M12 18V5M19 18v-7M3 20h18" />
    </Svg>
  );
}

function MenuIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

/* ============================================================================
   Keyframes + garde-fous UI
============================================================================ */

const SIDEBAR_KEYFRAMES = `
@keyframes sbMenuIn {
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
  to   { opacity: 1; transform: none; }
}

@keyframes sbPanelIn {
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: none; }
}

.sb-menu  { animation: sbMenuIn 180ms cubic-bezier(0.32,0.72,0,1) both; }
.sb-panel { animation: sbPanelIn ${PANEL_TRANSITION_MS}ms cubic-bezier(0.32,0.72,0,1) both; }

#app-sidebar button,
#app-sidebar [role="menuitem"],
#app-sidebar svg,
#app-sidebar img {
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

#app-sidebar button::selection,
#app-sidebar svg *::selection {
  background: transparent;
  color: inherit;
}

@media (prefers-reduced-motion: reduce) {
  .sb-menu,
  .sb-panel { animation: none; }
}
`;

/* ============================================================================
   Données de navigation
   UX v2 : navigation à plat (plus de groupes dépliables dans le flyout —
   tout tient dans 240 px). Les destinations secondaires sont dans le menu
   du compte. Moins de profondeur = moins de clics.
============================================================================ */

const navItems: NavItem[] = [
  { label: "Home", icon: HomeIcon, route: "home" },
  { label: "Calendar", icon: CalendarIcon, route: "schedule" },
  { label: "Templates", icon: TemplatesIcon, route: "template" },
  { label: "Create", icon: LightbulbIcon, route: "create", badge: "New" },
];

const accountMenuGroups: MenuItem[][] = [
  [
    { label: "Channels", icon: ChannelsIcon, route: "channels" },
    { label: "Integrations", icon: AppsIcon, route: "integrations" },
    { label: "Settings", icon: SettingsIcon, route: "settings" },
    { label: "Plans and Billing", icon: BillingIcon, route: "pricing" },
    { label: "Help & Support", icon: HelpIcon, route: "faq" },
  ],
  [{ label: "Log out", icon: LogoutIcon, action: "logout" }],
];

const CHANNEL_LINKS: {
  label: string;
  route: string;
  icon: IconComponent;
  badge?: string;
  perChannel?: boolean;
}[] = [
  { label: "Publish", route: "schedule", icon: PublishIcon },
  { label: "Community", route: "community", icon: CommunityIcon, perChannel: true },
  { label: "Insights", route: "insights", icon: InsightsIcon, badge: "New", perChannel: true },
];

/** Routes dont le canal ouvert est porté par le hash (?channel=<key>). */
const CHANNEL_ROUTES = new Set(["insights", "community"]);

function getHashChannel(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  const i = hash.indexOf("?");
  if (i === -1) return null;
  return new URLSearchParams(hash.slice(i + 1)).get("channel");
}

const NETWORK_ICONS: Record<NetworkKey, IconComponent> = {
  x: XIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  pinterest: PinterestIcon,
  threads: ThreadsIcon as IconComponent,
};

function getNetworkId(channel: ConnectedChannel): NetworkKey | null {
  const c = channel as unknown as Record<string, unknown>;
  const raw = String(c.platform ?? c.network ?? c.provider ?? channel.key)
    .toLowerCase()
    .trim();

  if (raw.includes("tiktok")) return "tiktok";
  if (raw.includes("insta")) return "instagram";
  if (raw.includes("youtube") || raw === "yt") return "youtube";
  if (raw.includes("facebook") || raw === "fb") return "facebook";
  if (raw.includes("linkedin")) return "linkedin";
  if (raw.includes("pinterest")) return "pinterest";
  if (raw.includes("threads")) return "threads";
  if (raw === "x" || raw.includes("twitter")) return "x";
  return null;
}

/* ============================================================================
   Tooltip flottant (portal) — rail réduit uniquement
============================================================================ */

function Tip({
  label,
  shortcut,
  enabled,
  side = "right",
  menuClass,
  countClass,
  children,
}: {
  label: string;
  shortcut?: string;
  enabled: boolean;
  side?: "right" | "top";
  menuClass: string;
  countClass: string;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const hide = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setPos(null);
  }, []);

  const show = useCallback(() => {
    if (!enabled) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) {
        setPos(
          side === "right"
            ? { top: rect.top + rect.height / 2, left: rect.right + 12 }
            : { top: rect.top - 10, left: rect.left + rect.width / 2 }
        );
      }
    }, 240);
  }, [enabled, side]);

  useEffect(() => {
    if (!enabled) hide();
  }, [enabled, hide]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return (
    <div
      ref={anchorRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onPointerDown={hide}
    >
      {children}
      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className={[
              "sb-tip pointer-events-none fixed z-[70] -translate-y-1/2",
              "flex items-center gap-2 whitespace-nowrap rounded-lg border px-2.5 py-1.5",
              "text-[11.5px] font-medium",
              menuClass,
            ].join(" ")}
          >
            {label}
            {shortcut && <Kbd className={countClass}>{shortcut}</Kbd>}
          </span>,
          document.body
        )}
    </div>
  );
}

/* ============================================================================
   Avatar de canal (image avec repli sur initiale) + badge réseau
============================================================================ */

function ChannelAvatar({
  channel,
  NetworkIcon,
  dotRing,
  ringClass = "",
}: {
  channel: ConnectedChannel;
  NetworkIcon?: IconComponent;
  dotRing: string;
  ringClass?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [channel.avatarUrl]);

  const label = channel.handle || channel.name;
  const initial = label.replace(/^@/, "").charAt(0).toUpperCase() || "?";

  return (
    <span className="relative h-7 w-7 shrink-0">
      {channel.avatarUrl && !failed ? (
        <img
          src={channel.avatarUrl}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={[
            "h-full w-full select-none rounded-full object-cover",
            "ring-2 ring-transparent transition-shadow duration-200",
            ringClass,
          ].join(" ")}
        />
      ) : (
        <span
          className={[
            "flex h-full w-full items-center justify-center rounded-full bg-neutral-700",
            "text-[10px] font-semibold text-white",
            "ring-2 ring-transparent transition-shadow duration-200",
            ringClass,
          ].join(" ")}
        >
          {initial}
        </span>
      )}

      {NetworkIcon && (
        <span
          className={[
            "absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center",
            "rounded-[5px] bg-white text-black ring-2",
            dotRing,
          ].join(" ")}
        >
          <NetworkIcon className="h-2 w-2" />
        </span>
      )}
    </span>
  );
}

/* ============================================================================
   Popover canal (rail réduit) : nom du compte + liens rapides.
   Rendu en portal, navigation clavier complète (→ pour ouvrir, ↑/↓, Échap).
============================================================================ */

function ChannelHoverCard({
  channel,
  label,
  NetworkIcon,
  currentRoute,
  hashChannel,
  firstChannelKey,
  focus,
  t,
  onNavigate,
  children,
}: {
  channel: ConnectedChannel;
  label: string;
  NetworkIcon?: IconComponent;
  currentRoute: string;
  hashChannel: string | null;
  firstChannelKey?: string;
  focus: string;
  t: ThemeTokens;
  onNavigate: (route: string) => void;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const cancelHide = useCallback(() => window.clearTimeout(hideTimer.current), []);

  const openNow = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.top, left: rect.right + 10 });
  }, []);

  const show = useCallback(() => {
    cancelHide();
    window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(openNow, 200);
  }, [cancelHide, openNow]);

  const hide = useCallback(() => {
    window.clearTimeout(showTimer.current);
    hideTimer.current = window.setTimeout(() => setPos(null), 120);
  }, []);

  const closeAndRefocus = useCallback(() => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
    setPos(null);
    anchorRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);

  const onAnchorKeyDown = (event: React.KeyboardEvent) => {
    if (!anchorRef.current?.contains(event.target as Node)) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      openNow();
      requestAnimationFrame(() => {
        popRef.current
          ?.querySelector<HTMLElement>('[role="menuitem"]')
          ?.focus({ preventScroll: true });
      });
    }
  };

  const onPopKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')
    );
    const current = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "Escape" || event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      closeAndRefocus();
      return;
    }

    let next = -1;
    if (event.key === "ArrowDown") next = (current + 1) % items.length;
    else if (event.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;

    if (next >= 0) {
      event.preventDefault();
      event.stopPropagation();
      items[next].focus();
    }
  };

  return (
    <span
      ref={anchorRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && (anchorRef.current?.contains(next) || popRef.current?.contains(next))) return;
        hide();
      }}
      onKeyDown={onAnchorKeyDown}
      className="relative block w-full"
    >
      {children}

      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            role="menu"
            aria-label={label}
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={cancelHide}
            onMouseLeave={hide}
            onKeyDown={onPopKeyDown}
            onClick={(e) => e.stopPropagation()}
            className={["sb-menu fixed z-[70] w-[196px] overflow-hidden rounded-2xl border p-2", t.menu].join(" ")}
          >
            <div className="flex items-center gap-2.5 px-1 pb-2 pt-1">
              <ChannelAvatar channel={channel} NetworkIcon={NetworkIcon} dotRing={t.dotRing} ringClass={t.avatarRing} />
              <span className={["min-w-0 flex-1 truncate text-[12.5px] font-semibold", t.title].join(" ")}>
                {label.replace(/^@/, "")}
              </span>
            </div>

            <div className={["border-t pt-1", t.menuDivider].join(" ")} />

            <div className="flex flex-col gap-0.5">
              {CHANNEL_LINKS.map((link) => {
                const Icon = link.icon;
                const target = link.perChannel
                  ? `${link.route}?channel=${encodeURIComponent(channel.key)}`
                  : link.route;

                const active = link.perChannel
                  ? link.route === currentRoute &&
                    (hashChannel === null ? firstChannelKey === channel.key : hashChannel === channel.key)
                  : link.route === currentRoute;

                return (
                  <button
                    key={link.route}
                    type="button"
                    role="menuitem"
                    aria-current={active ? "page" : undefined}
                    onClick={() => {
                      setPos(null);
                      onNavigate(target);
                    }}
                    className={[
                      "group flex h-8 w-full select-none items-center gap-2.5 whitespace-nowrap",
                      "rounded-lg px-2 text-left text-[12.5px] font-medium",
                      "transition-colors duration-150 motion-reduce:transition-none",
                      focus,
                      active ? t.labelActive : t.label,
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{link.label}</span>
                    {link.badge && (
                      <span className={["rounded-full px-2 py-0.5 text-[10.5px] font-semibold", t.badge].join(" ")}>
                        {link.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}

/* ============================================================================
   Ligne de navigation du flyout
============================================================================ */

function PanelNavItem({
  item,
  currentRoute,
  focus,
  t,
  onNavigate,
}: {
  item: NavItem;
  currentRoute: string;
  focus: string;
  t: ThemeTokens;
  onNavigate: (route: string) => void;
}) {
  const Icon = item.icon;
  const active = item.route === currentRoute;

  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      disabled={item.disabled}
      onClick={() => onNavigate(item.route)}
      className={[
        "group flex h-9 w-full select-none items-center gap-3 rounded-xl px-3",
        "text-[12.5px] font-medium transition-colors duration-150",
        "active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
        "disabled:cursor-not-allowed disabled:opacity-50",
        focus,
        active ? t.labelActive : t.label,
      ].join(" ")}
    >
      <Icon className="h-[17px] w-[17px] shrink-0" />
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge && (
        <span className={["rounded-full px-2 py-0.5 text-[10px] font-semibold", t.badge].join(" ")}>
          {item.badge}
        </span>
      )}
    </button>
  );
}

const PanelNavItemMemo = memo(PanelNavItem);

/* ============================================================================
   Section Channels (flyout ouvert)
============================================================================ */

function SidebarChannelsImpl({
  channels,
  currentRoute,
  focus,
  t,
  onNavigate,
  onConnect,
}: {
  channels: ConnectedChannel[];
  currentRoute: string;
  focus: string;
  t: ThemeTokens;
  onNavigate: (route: string) => void;
  onConnect: () => void;
}) {
  const hashChannel = CHANNEL_ROUTES.has(currentRoute) ? getHashChannel() : null;

  return (
    <div className="flex flex-col gap-0.5">
      <div className={["flex items-center justify-between px-3 pb-1 pt-2", "text-[12px] font-medium", t.muted].join(" ")}>
        <span className="select-none">Channels</span>
        <button
          type="button"
          aria-label="Connect a channel"
          onClick={onConnect}
          className={["flex h-6 w-6 items-center justify-center rounded-md transition-colors duration-150", focus, t.menuIcon].join(" ")}
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      {channels.length === 0 ? (
        <button
          type="button"
          onClick={onConnect}
          className={[
            "mt-0.5 flex w-full flex-col items-start gap-1 rounded-xl border border-dashed p-3 text-left",
            t.hoverBorder,
            "transition-colors duration-150",
            focus,
            t.label,
          ].join(" ")}
        >
          <span className={["text-[12.5px] font-semibold", t.title].join(" ")}>
            Connect your first channel
          </span>
          <span className={["text-[11px] leading-snug", t.muted].join(" ")}>
            Link Instagram, TikTok, YouTube… to start scheduling.
          </span>
        </button>
      ) : (
        channels.map((channel) => {
          const id = getNetworkId(channel);
          const NetworkIcon = id ? NETWORK_ICONS[id] : undefined;
          const label = channel.handle || channel.name;
          const isActiveChannel =
            CHANNEL_ROUTES.has(currentRoute) &&
            (hashChannel === null ? channels[0]?.key === channel.key : hashChannel === channel.key);

          return (
            <div key={channel.key} className="relative">
              {isActiveChannel && (
                <span
                  aria-hidden="true"
                  className={["absolute left-1 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full", t.accent].join(" ")}
                />
              )}

              <button
                type="button"
                aria-label={label.replace(/^@/, "")}
                onClick={() =>
                  onNavigate(`insights?channel=${encodeURIComponent(channel.key)}`)
                }
                className={[
                  "group flex h-9 w-full select-none items-center gap-2.5 rounded-xl px-2",
                  "text-[12.5px] font-medium transition-colors duration-150",
                  "active:scale-[0.98] motion-reduce:transition-none",
                  focus,
                  t.label,
                ].join(" ")}
              >
                <ChannelAvatar channel={channel} NetworkIcon={NetworkIcon} dotRing={t.dotRing} />
                <span className={["min-w-0 flex-1 truncate text-left", t.title].join(" ")}>
                  {label.replace(/^@/, "")}
                </span>
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

const SidebarChannels = memo(SidebarChannelsImpl);

/* ============================================================================
   État partagé de la sidebar (offset des pages + mémoire d'épinglage)
============================================================================ */

const SIDEBAR_STORAGE_KEY = "stone.sidebar.pinned";

function readStoredPinned(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

const sidebarMemory = {
  pinned: readStoredPinned(),
};

const sidebarListeners = new Set<() => void>();

function setSidebarPinned(value: boolean) {
  sidebarMemory.pinned = value;
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
  } catch {
    /* stockage indisponible : état mémoire uniquement */
  }
  sidebarListeners.forEach((l) => l());
}

function subscribeSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  return () => {
    sidebarListeners.delete(listener);
  };
}

/**
 * Marge gauche des pages : CONSTANTE. Le flyout recouvre le contenu, il ne
 * le repousse pas — plus aucun "saut" de layout à l'ouverture/fermeture.
 * Sur mobile le rail reste, le tiroir recouvre : aucun décalage.
 */
export function useSidebarOffset(): number {
  const isMobile = useIsMobile();
  useSyncExternalStore(subscribeSidebar, () => sidebarMemory.pinned, () => false);
  return isMobile ? 0 : SIDEBAR_COLLAPSED_OFFSET;
}

const userProfileCache = { profile: null as UserProfile | null };

function resetSidebarModuleState() {
  userProfileCache.profile = null;
  setSidebarPinned(false);
}

/* ============================================================================
   Helpers connexions OAuth (modal autonome, identique à la v1)
============================================================================ */

type OAuthProvider = "tiktok" | "pinterest" | "youtube";

const OAUTH_LABELS: Record<OAuthProvider, string> = {
  tiktok: "TikTok",
  pinterest: "Pinterest",
  youtube: "YouTube",
};

const initialConnections: ConnectionState = {
  instagram: { connected: false },
  tiktok: { connected: false },
  youtube: { connected: false },
  facebook: { connected: false },
  pinterest: { connected: false },
  threads: { connected: false },
};

function formatOAuthError(provider: string, error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return "Unable to reach the server (network or CORS error). Check that the backend is running and that VITE_API_URL is correct.";
  }
  return raw ? `Unable to connect to ${provider}. ${raw}` : `Unable to connect to ${provider}.`;
}

function mockHandleFor(key: ChannelKey): string {
  const handles: Record<ChannelKey, string> = {
    instagram: "@ronan.studio",
    tiktok: "",
    youtube: "",
    facebook: "Ronan Studio Page",
    pinterest: "",
    threads: "@ronan.studio",
  };
  return handles[key];
}

function toConnection(status: StatusResponse): Connection {
  if (!status.connected) return { connected: false };
  const account = status.account;
  return {
    connected: true,
    handle: account?.display_name ?? undefined,
    avatarUrl: account?.avatar_url ?? account?.avatarUrl ?? undefined,
  };
}

function pluralizeChannels(count: number): string {
  return `${count} channel${count === 1 ? "" : "s"}`;
}

/* ============================================================================
   Sidebar
============================================================================ */

type DashboardSidebarProps = {
  theme?: Theme;
  onToggleTheme?: ToggleThemeFn;
};

export default function DashboardSidebar({ theme: themeProp }: DashboardSidebarProps) {
  const themeContext = useTheme();
  const theme = themeProp ?? themeContext.theme;
  const isDark = theme === "dark";

  const currentRoute = useHashRoute();
  const connectedChannels = useConnectedChannels();
  const isMobile = useIsMobile();

  const { user } = useUser();
  const userId = user?.id ?? null;

  /* Ouvert = épinglé (persistant) OU hover temporaire du rail. */
  const [pinned, setPinned] = useState(sidebarMemory.pinned);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(userProfileCache.profile);
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  /* ── Connexions (modal autonome) ── */
  const [connections, setConnections] = useState<ConnectionState>(() => {
    if (!userId) return initialConnections;
    const tiktok = readCache(userId, "tiktok");
    const pinterest = readCache(userId, "pinterest");
    const youtube = readCache(userId, "youtube");
    return {
      ...initialConnections,
      ...(tiktok ? { tiktok: tiktok.connection } : {}),
      ...(pinterest ? { pinterest: pinterest.connection } : {}),
      ...(youtube ? { youtube: youtube.connection } : {}),
    };
  });
  const [pendingKey, setPendingKey] = useState<ChannelKey | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const oauthBusy = useRef<Record<OAuthProvider, boolean>>({ tiktok: false, pinterest: false, youtube: false });
  const placeholderTimer = useRef<number | undefined>(undefined);

  const profileRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const hoverCloseTimer = useRef<number | undefined>(undefined);
  const hoverOpenTimer = useRef<number | undefined>(undefined);

  const panelOpen = pinned || hoverOpen;

  /* ── Profil utilisateur ── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const userData = await getCurrentUser();
        if (mounted && userData) {
          userProfileCache.profile = userData;
          setUserProfile(userData);
          setAvatarLoadFailed(false);
        }
      } catch (error) {
        console.error("Error loading user profile in sidebar:", error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* ── Statuts des canaux (cache + backend + retour OAuth) ── */
  useEffect(() => {
    if (!userId) return;

    const hash = window.location.hash;
    const qi = hash.indexOf("?");
    const basePath = qi === -1 ? hash : hash.slice(0, qi);
    const params = new URLSearchParams(qi === -1 ? "" : hash.slice(qi + 1));

    const errors: Record<CacheProvider, string | null> = {
      tiktok: params.get("tiktok_error"),
      pinterest: params.get("pinterest_error"),
      youtube: params.get("youtube_error"),
    };
    const returned: Record<CacheProvider, boolean> = {
      tiktok: params.has("tiktok") || Boolean(errors.tiktok),
      pinterest: params.has("pinterest") || Boolean(errors.pinterest),
      youtube: params.has("youtube") || Boolean(errors.youtube),
    };

    (Object.keys(errors) as CacheProvider[]).forEach((provider) => {
      const message = errors[provider];
      if (message) setConnectError(`Unable to connect to ${OAUTH_LABELS[provider]}. ${message}`);
      if (returned[provider]) clearCache(userId, provider);
    });

    if ((returned.tiktok || returned.pinterest || returned.youtube) && basePath.includes("channels")) {
      ["tiktok", "tiktok_error", "pinterest", "pinterest_error", "youtube", "youtube_error"].forEach((k) =>
        params.delete(k)
      );
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${basePath}${query ? `?${query}` : ""}`
      );
    }

    let cancelled = false;

    const sync = (
      provider: CacheProvider,
      justReturned: boolean,
      fetchStatus: () => Promise<StatusResponse>
    ) => {
      const cached = justReturned ? null : readCache(userId, provider);

      if (cached) {
        setConnections((current) => ({ ...current, [provider]: cached.connection }));
        if (Date.now() - cached.savedAt < CACHE_MAX_AGE_MS) return;
      }

      void (async () => {
        try {
          const status = await fetchStatus();
          if (cancelled) return;
          const connection = toConnection(status);
          if (connection.connected) writeCache(userId, connection, provider);
          else clearCache(userId, provider);
          setConnections((current) => ({ ...current, [provider]: connection }));
        } catch (error) {
          console.warn(`[Stone] Could not load ${provider} status:`, error);
        }
      })();
    };

    sync("tiktok", returned.tiktok, getTikTokStatus);
    sync("pinterest", returned.pinterest, getPinterestStatus);
    sync("youtube", returned.youtube, getYouTubeStatus);

    return () => {
      cancelled = true;
    };
  }, [userId]);

  /* ── Persistance de l'épinglage ── */
  useEffect(() => {
    setSidebarPinned(pinned);
  }, [pinned]);

  /* ── Navigation : referme menu + tiroir mobile ── */
  useEffect(() => {
    setMenuOpen(false);
    if (isMobile) setMobileOpen(false);
  }, [currentRoute, isMobile]);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  useEffect(() => () => window.clearTimeout(placeholderTimer.current), []);

  /* ── Tiroir mobile : Échap + blocage du scroll ── */
  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !menuOpen && !connectOpen) setMobileOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen, menuOpen, connectOpen]);

  /* ── Flyout non épinglé : Échap / clic extérieur referment ── */
  useEffect(() => {
    if (!panelOpen || pinned) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !menuOpen && !connectOpen) {
        setHoverOpen(false);
        railRef.current?.focus();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        railRef.current?.contains(target) ||
        menuRef.current?.contains(target) ||
        profileRef.current?.contains(target)
      ) {
        return;
      }
      // Le flyout et tout ce qui n'est pas le rail ferment le panneau.
      if (!isMobile) setHoverOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [panelOpen, pinned, menuOpen, connectOpen, isMobile]);

  /* ── Menu compte : clic extérieur, Échap, focus initial ── */
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    const id = requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')
        ?.focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const onMenuKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')
    );
    if (items.length === 0) return;

    const current = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;

    if (event.key === "ArrowDown") next = (current + 1) % items.length;
    else if (event.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;

    if (next >= 0) {
      event.preventDefault();
      items[next].focus();
    }
  }, []);

  /* ── Tokens de thème ── */
  const t = useMemo<ThemeTokens>(
    () =>
      isDark
        ? {
            rail: "border-r border-white/10 bg-[#0a0a0c]/95 backdrop-blur-xl",
            panel: "bg-[#0f0f11]/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)]",
            divider: "bg-white/10",
            railItem: "text-white/60 hover:bg-white/[0.06] hover:text-white",
            railItemActive: "bg-[#34343a] text-white",
            railIcon: "text-[#a9aeae] hover:text-white",
            label: "text-white/70 hover:bg-[#34343a] hover:text-white",
            labelActive: "bg-[#34343a] text-white",
            railBg: "bg-white",
            dotRing: "ring-[#0a0a0c]",
            title: "text-[#f3f3ef]",
            muted: "text-[#99a2a2]",
            menu: "border-white/10 bg-[#1c1d1d] text-[#f3f3ef] shadow-[0_18px_40px_rgba(0,0,0,0.55)]",
            menuDivider: "border-white/10",
            menuItem: "text-[#ecece8] hover:bg-[#34343a] focus-visible:bg-[#34343a]",
            menuIcon: "text-[#a9aeae] hover:text-white",
            badge: "bg-white text-black",
            accent: "bg-white",
            accentSolid: "border-transparent bg-white text-black hover:bg-white/90",
            upgrade: "border-white/10 bg-white/[0.04] text-[#f3f3ef] hover:border-white/20 hover:bg-[#34343a]",
            avatarRing: "group-hover:ring-white/60",
            avatar: "bg-[#f0f0ed] text-[#111111]",
            ring: "focus-visible:ring-white/30",
            hoverBorder: "hover:border-white/40 border-white/10",
          }
        : {
            rail: "border-r border-black/10 bg-white/95 backdrop-blur-xl",
            panel: "bg-white/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(20,20,40,0.14)]",
            divider: "bg-black/[0.07]",
            railItem: "text-[#55544f] hover:bg-[#e0e0dc] hover:text-[#151515]",
            railItemActive: "bg-[#e0e0dc] text-[#151515]",
            railIcon: "text-[#6b6a67] hover:text-[#151515]",
            label: "text-[#55544f] hover:bg-[#e0e0dc] hover:text-[#151515]",
            labelActive: "bg-[#e0e0dc] text-[#151515]",
            railBg: "bg-black",
            dotRing: "ring-white",
            title: "text-[#1b1b1a]",
            muted: "text-[#71706d]",
            menu: "border-black/10 bg-white text-[#1a1a1a] shadow-[0_18px_40px_rgba(0,0,0,0.12)]",
            menuDivider: "border-black/[0.07]",
            menuItem: "text-[#1f1f1e] hover:bg-[#e0e0dc] focus-visible:bg-[#e0e0dc]",
            menuIcon: "text-[#6b6a67] hover:text-[#151515]",
            badge: "bg-black text-white",
            accent: "bg-black",
            accentSolid: "border-transparent bg-black text-white hover:bg-black/85",
            upgrade: "border-black/10 bg-[#f6f5f3] text-[#1a1a1a] hover:border-black/20 hover:bg-[#e0e0dc]",
            avatarRing: "group-hover:ring-black/40",
            avatar: "bg-[#1d1d1d] text-white",
            ring: "focus-visible:ring-black/20",
            hoverBorder: "hover:border-black/30 border-black/10",
          },
    [isDark]
  );

  const focus = [
    "cursor-pointer",
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    t.ring,
  ].join(" ");

  /* ── Hover du rail : ouverture temporaires avec délais doux ── */
  const openHoverPanel = useCallback(() => {
    if (isMobile || pinned) return;
    window.clearTimeout(hoverCloseTimer.current);
    window.clearTimeout(hoverOpenTimer.current);
    hoverOpenTimer.current = window.setTimeout(() => setHoverOpen(true), HOVER_OPEN_DELAY_MS);
  }, [isMobile, pinned]);

  const closeHoverPanel = useCallback(() => {
    window.clearTimeout(hoverOpenTimer.current);
    if (isMobile || pinned) return;
    hoverCloseTimer.current = window.setTimeout(() => setHoverOpen(false), HOVER_CLOSE_DELAY_MS);
  }, [isMobile, pinned]);

  useEffect(
    () => () => {
      window.clearTimeout(hoverOpenTimer.current);
      window.clearTimeout(hoverCloseTimer.current);
    },
    []
  );

  const togglePinned = useCallback(() => {
    setMenuOpen(false);
    if (isMobile) {
      setMobileOpen((p) => !p);
      return;
    }
    setPinned((p) => {
      if (p) setHoverOpen(false);
      return !p;
    });
  }, [isMobile]);

  /* ── Ctrl/⌘ + B : épingler / désépingler ── */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "b" ||
        !(event.metaKey || event.ctrlKey) ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      togglePinned();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePinned]);

  const handleNavigate = useCallback((route: string) => {
    navigate(route);
  }, []);

  const openConnect = useCallback(() => {
    setMenuOpen(false);
    setConnectError(null);
    setConnectOpen(true);
  }, []);

  const closeConnect = useCallback(() => setConnectOpen(false), []);

  /* ── Alt/⌥ + touche (pages + menu + modal) ── */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (connectOpen || isTypingTarget(event.target)) return;

      const key = shortcutKey(event);
      if (!key) return;

      if (key === "p") {
        event.preventDefault();
        setMenuOpen((v) => !v);
        return;
      }

      if (key === "n") {
        event.preventDefault();
        openConnect();
        return;
      }

      const route = SHORTCUT_ROUTES[key];
      if (route) {
        event.preventDefault();
        setMenuOpen(false);
        navigate(route);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [connectOpen, openConnect]);

  /* ── Connexion OAuth ── */
  const limitReached =
    Object.values(connections).filter((c) => c.connected).length >= PLAN.maxChannels;

  const toggleOAuth = async (
    provider: OAuthProvider,
    api: {
      login: () => Promise<unknown>;
      disconnect: () => Promise<unknown>;
      manual?: () => Promise<Connection | null>;
    }
  ) => {
    if (oauthBusy.current[provider]) return;
    oauthBusy.current[provider] = true;

    setPendingKey(provider);
    let redirecting = false;

    try {
      if (connections[provider].connected) {
        await api.disconnect();
        if (userId) clearCache(userId, provider);
        setConnections((current) => ({ ...current, [provider]: { connected: false } }));
      } else if (api.manual) {
        const connection = await api.manual();
        if (!connection) return;
        if (userId) writeCache(userId, connection, provider);
        setConnections((current) => ({ ...current, [provider]: connection }));
      } else {
        await api.login();
        redirecting = true;
      }
    } catch (error) {
      console.error(`[Stone] ${OAUTH_LABELS[provider]} OAuth error:`, error);
      setConnectError(formatOAuthError(OAUTH_LABELS[provider], error));
    } finally {
      if (!redirecting) {
        setPendingKey(null);
        oauthBusy.current[provider] = false;
      }
    }
  };

  const pinterestManualToken = async (): Promise<Connection | null> => {
    const token = window.prompt("Pinterest access token (generated in the developer portal):");
    if (!token?.trim()) return null;
    const account = await connectPinterestWithToken(token.trim());
    return {
      connected: true,
      handle: account?.display_name ?? undefined,
      avatarUrl: account?.avatar_url ?? undefined,
    };
  };

  const handlePlaceholderToggle = (key: ChannelKey) => {
    setPendingKey(key);
    window.clearTimeout(placeholderTimer.current);
    placeholderTimer.current = window.setTimeout(() => {
      setConnections((current) => ({
        ...current,
        [key]: current[key].connected
          ? { connected: false }
          : { connected: true, handle: mockHandleFor(key) },
      }));
      setPendingKey(null);
    }, 500);
  };

  const handleToggle = (key: ChannelKey) => {
    setConnectError(null);

    if (!connections[key].connected && limitReached) {
      setConnectError(
        `Your ${PLAN.name} plan allows up to ${PLAN.maxChannels} channels. Upgrade to connect more.`
      );
      return;
    }

    switch (key) {
      case "tiktok":
        void toggleOAuth("tiktok", { login: startTikTokLogin, disconnect: disconnectTikTok });
        return;
      case "pinterest":
        void toggleOAuth("pinterest", {
          login: startPinterestLogin,
          disconnect: disconnectPinterest,
          manual: import.meta.env.VITE_PINTEREST_MANUAL_TOKEN === "true" ? pinterestManualToken : undefined,
        });
        return;
      case "youtube":
        void toggleOAuth("youtube", { login: startYouTubeLogin, disconnect: disconnectYouTube });
        return;
      default:
        handlePlaceholderToggle(key);
    }
  };

  /* ── Logout ── */
  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setMenuOpen(false);
    setLoggingOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      resetSidebarModuleState();
      window.location.replace("/");
    }
  }, [loggingOut]);

  /* ── Données du compte ── */
  const account = useMemo(
    () =>
      userProfile
        ? {
            name: `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || "User",
            initials:
              (
                `${(userProfile.first_name || "")[0] || ""}${(userProfile.last_name || "")[0] || ""}`
              ).toUpperCase() || "U",
            email: userProfile.email,
            plan: "Free plan",
            channels: connectedChannels.length,
            avatarUrl: userProfile.avatar_url || undefined,
          }
        : { name: "User", initials: "U", email: "workspace@crew.io", plan: "Free plan", channels: connectedChannels.length, avatarUrl: undefined },
    [userProfile, connectedChannels.length]
  );

  const showAvatarImage = Boolean(account.avatarUrl) && !avatarLoadFailed;

  const planMax = Number.isFinite(PLAN.maxChannels) ? PLAN.maxChannels : 0;
  const planPct =
    planMax > 0 ? Math.min(100, Math.round((account.channels / planMax) * 100)) : 0;
  const planFull = planMax > 0 && account.channels >= planMax;

  const channelConnectProps: Omit<ConnectChannelModalProps, "isDark" | "onClose"> = {
    channels: CHANNELS,
    connections,
    pendingKey,
    limitReached,
    planName: PLAN.name,
    realOAuthKeys: REAL_OAUTH,
    errorMessage: connectError,
    onToggle: handleToggle,
  };

  const hashChannel = CHANNEL_ROUTES.has(currentRoute) ? getHashChannel() : null;

  /* ==========================================================================
     Render
     Le rail : fixed, left-0, inset-y-0 — collé au bord gauche, pleine hauteur,
     sans arrondi. Le flyout : positionné juste à droite du rail, au-dessus du
     contenu (z supérieur).
  ========================================================================== */

  return (
    <>
      {/* Mobile : bouton flottant quand le tiroir est fermé. */}
      {isMobile && !mobileOpen && (
        <button
          type="button"
          aria-label="Open navigation"
          aria-controls="app-sidebar"
          onClick={() => setMobileOpen(true)}
          className={[
            "fixed left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-xl border",
            "transition-transform duration-200 active:scale-[0.94] motion-reduce:transition-none",
            focus,
            t.rail,
            t.menuIcon,
          ].join(" ")}
        >
          <MenuIcon className="h-[18px] w-[18px]" />
        </button>
      )}

      {/* Mobile : fond cliquable derrière le tiroir. */}
      {isMobile && mobileOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
        />
      )}

      {/* ── RAIL : toujours visible, collé à gauche ── */}
      <aside
        id="app-sidebar"
        ref={railRef as React.RefObject<HTMLDivElement> as React.Ref<HTMLElement>}
        tabIndex={-1}
        onMouseEnter={openHoverPanel}
        onMouseLeave={closeHoverPanel}
        className={[
          "fixed inset-y-0 left-0 z-20 flex flex-col items-center gap-1",
          "border-y-0 border-l-0 py-4",
          "outline-none",
          t.rail,
        ].join(" ")}
        style={{ width: RAIL_WIDTH_PX }}
      >
        <style>{SIDEBAR_KEYFRAMES}</style>

        {/* Logo */}
        <div className="mb-3 flex h-10 w-10 items-center justify-center">
          <img
            src={isDark ? "/images/icon_nav.png" : "/images/icon.png"}
            alt="Stone logo"
            draggable={false}
            className="h-8 w-7 select-none object-contain"
          />
        </div>

        {/* Navigation (icônes) */}
        <nav
          className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Main"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.route === currentRoute;

            return (
              <Tip
                key={item.route}
                label={item.label}
                shortcut={shortcutForRoute(item.route)}
                enabled={!panelOpen}
                menuClass={t.menu}
                countClass={t.muted}
              >
                <button
                  type="button"
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => handleNavigate(item.route)}
                  className={[
                    "group relative flex h-11 w-11 items-center justify-center rounded-2xl",
                    "transition-colors duration-150 active:scale-[0.94]",
                    "motion-reduce:transition-none motion-reduce:active:scale-100",
                    focus,
                    active ? t.railItemActive : t.railItem,
                  ].join(" ")}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className={["absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 -translate-x-1 rounded-full", t.accent].join(" ")}
                    />
                  )}
                  <Icon className="h-[19px] w-[19px]" />
                  {item.badge && (
                    <span className={["absolute right-2 top-2 h-1.5 w-1.5 rounded-full", t.accent].join(" ")} />
                  )}
                </button>
              </Tip>
            );
          })}

          {/* Séparateur */}
          <div className={["my-2 h-px w-8", t.divider].join(" ")} />

          {/* Canaux (avatars) */}
          {connectedChannels.slice(0, 6).map((channel) => {
            const id = getNetworkId(channel);
            const NetworkIcon = id ? NETWORK_ICONS[id] : undefined;
            const label = channel.handle || channel.name;
            const isActiveChannel =
              CHANNEL_ROUTES.has(currentRoute) &&
              (hashChannel === null ? connectedChannels[0]?.key === channel.key : hashChannel === channel.key);

            return (
              <ChannelHoverCard
                key={channel.key}
                channel={channel}
                label={label}
                NetworkIcon={NetworkIcon}
                currentRoute={currentRoute}
                hashChannel={hashChannel}
                firstChannelKey={connectedChannels[0]?.key}
                focus={focus}
                t={t}
                onNavigate={handleNavigate}
              >
                <button
                  type="button"
                  aria-label={label.replace(/^@/, "")}
                  aria-current={isActiveChannel ? "page" : undefined}
                  onClick={() =>
                    handleNavigate(`insights?channel=${encodeURIComponent(channel.key)}`)
                  }
                  className={[
                    "group relative flex h-11 w-11 items-center justify-center rounded-2xl",
                    "transition-colors duration-150 active:scale-[0.94]",
                    "motion-reduce:transition-none motion-reduce:active:scale-100",
                    focus,
                    isActiveChannel ? t.railItemActive : t.railItem,
                  ].join(" ")}
                >
                  <ChannelAvatar channel={channel} NetworkIcon={NetworkIcon} dotRing={t.dotRing} ringClass={t.avatarRing} />
                </button>
              </ChannelHoverCard>
            );
          })}

          {/* Ajouter un canal */}
          <Tip label="Connect a channel" shortcut={shortcutLabel("n")} enabled={!panelOpen} menuClass={t.menu} countClass={t.muted}>
            <button
              type="button"
              aria-label="Connect a channel"
              aria-keyshortcuts={ariaShortcut("n")}
              onClick={openConnect}
              className={[
                "group flex h-11 w-11 items-center justify-center rounded-2xl",
                "border border-dashed transition-colors duration-150 active:scale-[0.94]",
                "motion-reduce:transition-none motion-reduce:active:scale-100",
                focus,
                t.hoverBorder,
                t.railItem,
              ].join(" ")}
            >
              <PlusIcon className="h-[18px] w-[18px]" />
            </button>
          </Tip>
        </nav>

        {/* Compte : avatar en bas du rail */}
        <div ref={profileRef} className="relative">
          {menuOpen && (
            <div
              ref={menuRef}
              id="account-menu"
              role="menu"
              aria-label="Account menu"
              onKeyDown={onMenuKeyDown}
              className={[
                "sb-menu absolute bottom-0 left-full z-50 ml-3",
                "w-[264px] max-w-[calc(100vw-96px)] origin-bottom-left",
                "overflow-hidden rounded-2xl border",
                t.menu,
              ].join(" ")}
            >
              <div className="sb-item px-3.5 pb-3 pt-3.5" style={{ animationDelay: "30ms" }}>
                <div className={["truncate text-[11px]", t.muted].join(" ")}>{account.email}</div>
                <div className="mt-2.5 truncate text-[14px] font-semibold">{account.name}</div>

                <div className="mt-2">
                  <div className={["flex items-center justify-between text-[11px]", t.muted].join(" ")}>
                    <span>{account.plan}</span>
                    <span>
                      {planMax > 0
                        ? `${account.channels}/${planMax} channels`
                        : pluralizeChannels(account.channels)}
                    </span>
                  </div>

                  {planMax > 0 && (
                    <div
                      role="progressbar"
                      aria-label="Channels used"
                      aria-valuemin={0}
                      aria-valuemax={planMax}
                      aria-valuenow={Math.min(account.channels, planMax)}
                      aria-valuetext={`${pluralizeChannels(account.channels)} of ${planMax}`}
                      className={["mt-1.5 h-1 overflow-hidden rounded-full", t.divider].join(" ")}
                    >
                      <div
                        className={[
                          "h-full rounded-full transition-[width] duration-500",
                          "motion-reduce:transition-none",
                          planFull ? t.accent : "bg-current opacity-60",
                        ].join(" ")}
                        style={{ width: `${planPct}%` }}
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("pricing");
                  }}
                  className={[
                    "group mt-3 flex w-full select-none items-center justify-center gap-2",
                    "rounded-[10px] border px-3 py-2 text-[12px] font-semibold",
                    "transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none",
                    focus,
                    planFull ? t.accentSolid : t.upgrade,
                  ].join(" ")}
                >
                  <BoltIcon className="h-4 w-4" />
                  {planFull ? "Upgrade to add more channels" : "Upgrade Plan"}
                </button>
              </div>

              {accountMenuGroups.map((group, gi) => (
                <div key={gi} role="none" className={["border-t px-1.5 py-1.5", t.menuDivider].join(" ")}>
                  {group.map((item) => {
                    const Icon = item.icon;
                    const isLogout = item.action === "logout";
                    const isDisabled = Boolean(item.disabled) || (isLogout && loggingOut);

                    return (
                      <button
                        key={item.label}
                        type="button"
                        role="menuitem"
                        disabled={isDisabled}
                        aria-disabled={isDisabled || undefined}
                        style={{ animationDelay: `${60 + gi * 60}ms` }}
                        onClick={(event) => {
                          if (isLogout) {
                            void handleLogout();
                            return;
                          }
                          setMenuOpen(false);
                          if (event.detail === 0) triggerRef.current?.focus();
                          if (item.route) navigate(item.route);
                        }}
                        className={[
                          "sb-item group flex w-full select-none items-center gap-3 rounded-[10px]",
                          "px-2.5 py-2 text-left text-[12.5px] font-medium",
                          "transition-colors duration-150 active:scale-[0.98] motion-reduce:transition-none",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          focus,
                          t.menuItem,
                        ].join(" ")}
                      >
                        <Icon className={["h-4 w-4 shrink-0 opacity-70 transition-opacity duration-150 group-hover:opacity-100", t.menuIcon].join(" ")} />
                        <span className="flex-1 truncate">
                          {isLogout && loggingOut ? "Logging out..." : item.label}
                        </span>
                        {item.badge && (
                          <span className={["rounded-full px-2 py-0.5 text-[10px] font-semibold", t.badge].join(" ")}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          <Tip label={account.name} shortcut={shortcutLabel("p")} enabled={!panelOpen && !menuOpen} menuClass={t.menu} countClass={t.muted}>
            <button
              ref={triggerRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? "account-menu" : undefined}
              aria-keyshortcuts={ariaShortcut("p")}
              aria-label="Open account menu"
              onClick={() => setMenuOpen((v) => !v)}
              className={[
                "group flex h-11 w-11 items-center justify-center rounded-2xl",
                "transition-colors duration-150 active:scale-[0.94]",
                "motion-reduce:transition-none motion-reduce:active:scale-100",
                focus,
                menuOpen ? t.railItemActive : t.railItem,
              ].join(" ")}
            >
              {showAvatarImage ? (
                <img
                  key={account.avatarUrl}
                  src={account.avatarUrl}
                  alt="Profile"
                  draggable={false}
                  onError={() => setAvatarLoadFailed(true)}
                  className="h-8 w-8 select-none rounded-full object-cover"
                />
              ) : (
                <span className={["flex h-8 w-8 select-none items-center justify-center rounded-full text-[10px] font-semibold", t.avatar].join(" ")}>
                  {account.initials}
                </span>
              )}
            </button>
          </Tip>

          {/* Toggle épinglage, sous l'avatar */}
          <button
            type="button"
            aria-expanded={pinned}
            aria-controls="app-sidebar"
            aria-keyshortcuts="Control+B Meta+B"
            aria-label={isMobile ? (mobileOpen ? "Close navigation" : "Open navigation") : pinned ? "Unpin panel" : "Pin panel"}
            onClick={togglePinned}
            className={[
              "group mt-1 flex h-9 w-11 items-center justify-center rounded-2xl",
              "transition-colors duration-150 active:scale-[0.94]",
              "motion-reduce:transition-none motion-reduce:active:scale-100",
              focus,
              t.railItem,
            ].join(" ")}
          >
            <PanelIcon className="h-[17px] w-[17px]" open={panelOpen} />
          </button>
        </div>
      </aside>

      {/* ── FLYOUT : panneau de labels, PAR-DESSUS le contenu ── */}
      <div
        {...((!panelOpen && !isMobile)
          ? ({ inert: "", "aria-hidden": true } as Record<string, unknown>)
          : {})}
        className={[
          "fixed inset-y-0 z-20 flex flex-col",
          "border-r py-4",
          "transition-[opacity,transform]",
          "duration-[260ms]",
          "ease-[cubic-bezier(0.32,0.72,0,1)]",
          "motion-reduce:transition-none",
          panelOpen
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-3 opacity-0",
          isMobile && mobileOpen ? "left-0 w-[min(300px,calc(100vw-72px))]" : "",
          t.panel,
          isMobile ? (t.menuDivider || t.divider) : t.divider,
        ].join(" ")}
        style={{ left: RAIL_WIDTH_PX, width: PANEL_WIDTH_PX }}
      >
        {/* En-tête : marque + toggle (desktop) / fermer (mobile) */}
        <div className="mb-3 flex h-10 items-center justify-between px-4">
          <span className={["select-none text-[20px] font-semibold leading-none tracking-tight", t.title].join(" ")}>
            Stone
          </span>
          <button
            type="button"
            aria-label={isMobile ? "Close navigation" : "Close panel"}
            onClick={() => {
              if (isMobile) setMobileOpen(false);
              else setPinned(false);
            }}
            className={["flex h-7 w-7 items-center justify-center rounded-lg transition-colors duration-150", focus, t.menuIcon].join(" ")}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>

        {/* Navigation détaillée */}
        <nav
          className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Main expanded"
        >
          {navItems.map((item) => (
            <PanelNavItemMemo
              key={item.route}
              item={item}
              currentRoute={currentRoute}
              focus={focus}
              t={t}
              onNavigate={handleNavigate}
            />
          ))}

          <div className={["mx-3 my-2 h-px", t.divider].join(" ")} />

          <SidebarChannels
            channels={connectedChannels}
            currentRoute={currentRoute}
            focus={focus}
            t={t}
            onNavigate={handleNavigate}
            onConnect={openConnect}
          />
        </nav>

        {/* Pied : rappel des raccourcis */}
        <div className={["mt-2 border-t px-4 pt-2 text-[10.5px]", t.divider, t.muted].join(" ")}>
          <span className="select-none">
            {TOGGLE_SHORTCUT_LABEL} to {pinned ? "unpin" : "pin"} · {shortcutLabel("n")} to connect
          </span>
        </div>
      </div>

      {/* Modal ConnectChannelModal (fait son propre createPortal). */}
      {connectOpen && (
        <ConnectChannelModal {...channelConnectProps} isDark={isDark} onClose={closeConnect} />
      )}
    </>
  );
}