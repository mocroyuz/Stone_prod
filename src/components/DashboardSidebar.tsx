// src/components/DashboardSidebar.tsx
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { useTheme, type Theme } from "../hooks/useTheme";
import { navigate, useHashRoute } from "../hooks/useHashRoute";
import { useSubscription } from "../hooks/useSubscription";
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
  type MonoTone,
} from "./IntegrationIcons";
import ConnectChannelModal, {
  type ConnectChannelModalProps,
} from "./ConnectChannelModal";

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
import { requestNewPost } from "../services/Newpostbus";

/* ============================================================================ 
   Types 
============================================================================ */

type IconProps = { className?: string; mono?: MonoTone };
type IconComponent = (props: IconProps) => React.ReactElement;

type NavItem = {
  label: string;
  icon: IconComponent;
  route: string;
  badge?: string;
};

type MenuItem = {
  label: string;
  icon: IconComponent;
  badge?: string;
  route?: string;
  action?: "logout";
  disabled?: boolean;
};

type ThemeTokens = {
  aside: string;
  divider: string;
  navActive: string;
  navIdle: string;
  count: string;
  dotRing: string;
  rail: string;
  sub: string;
  subActive: string;
  row: string;
  rowOpen: string;
  avatar: string;
  title: string;
  muted: string;
  menu: string;
  menuDivider: string;
  menuItem: string;
  menuIcon: string;
  upgrade: string;
  badge: string;
  ring: string;
  accent: string;
  accentSolid: string;
};

type StatusResponse = {
  connected: boolean;
  account:
    | {
        display_name?: string | null;
        avatar_url?: string | null;
        avatarUrl?: string | null;
      }
    | null
    | undefined;
};

/* ============================================================================ 
   Dimensions 
============================================================================ */

export const SIDEBAR_COLLAPSED_OFFSET = 56;
export const SIDEBAR_EXPANDED_OFFSET = 240;

/* ============================================================================ 
   Keyframes 
============================================================================ */

const SIDEBAR_KEYFRAMES = `
@keyframes sbMenuIn {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
@keyframes sbTipIn {
  from { opacity: 0; transform: translate(-4px, -50%); }
  to { opacity: 1; transform: translate(0, -50%); }
}
@keyframes sbFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes sbLabelIn {
  from { opacity: 0; transform: translateX(-4px); }
  to { opacity: 1; transform: none; }
}
.sb-menu { animation: sbMenuIn 160ms cubic-bezier(0.32, 0.72, 0, 1) both; }
.sb-tip { animation: sbTipIn 140ms cubic-bezier(0.32, 0.72, 0, 1) both; }
.sb-fade { animation: sbFadeIn 220ms ease-out both; }
.sb-label { animation: sbLabelIn 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.sb-label-1 { animation-delay: 40ms; }
.sb-label-2 { animation-delay: 70ms; }
.sb-label-3 { animation-delay: 100ms; }
.sb-backdrop { animation: sbFadeIn 200ms ease-out both; }

#app-sidebar button,
#app-sidebar svg,
#app-sidebar img {
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

@media (prefers-reduced-motion: reduce) {
  .sb-menu, .sb-tip, .sb-fade, .sb-label, .sb-backdrop { animation: none; }
}
`;

/* ============================================================================ 
   Raccourcis clavier 
============================================================================ */

const IS_MAC =
  typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform);

const TOGGLE_SHORTCUT_LABEL = IS_MAC ? "⌘B" : "Ctrl B";

const SHORTCUT_ROUTES: Record<string, string> = {
  h: "home",
  d: "schedule",
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

function shortcutKeyForRoute(route?: string): string | undefined {
  if (!route) return undefined;
  return Object.entries(SHORTCUT_ROUTES).find(([, r]) => r === route)?.[0];
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
   Responsive : sous 768 px la sidebar devient un tiroir 
============================================================================ */

const MOBILE_QUERY = "(max-width: 767px)";

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
   Icons 
============================================================================ */

function Svg({
  className = "h-4 w-4",
  children,
}: IconProps & { children: ReactNode }) {
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

const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12.5 12 5l8 7.5" />
    <path d="M6 10.5V18h12v-7.5" />
  </Svg>
);

const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
    <path d="M8 3.5v4M16 3.5v4M3.5 9.5h17" />
  </Svg>
);

const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);

const ChannelsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="7.5" cy="7.5" r="2.5" />
    <circle cx="16.5" cy="7.5" r="2.5" />
    <circle cx="7.5" cy="16.5" r="2.5" />
    <circle cx="16.5" cy="16.5" r="2.5" />
  </Svg>
);

const BillingIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M14.5 9.5c-.4-.9-1.4-1.5-2.5-1.5-1.4 0-2.5.8-2.5 1.9 0 2.6 5 1.2 5 4 0 1.1-1.1 1.9-2.5 1.9-1.2 0-2.2-.6-2.6-1.6M12 6.5V8M12 16v1.5" />
  </Svg>
);

const HelpIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.5a2.5 2.5 0 0 1 4.8.9c0 1.6-2.4 2.1-2.4 3.6M12 16.8v.1" />
  </Svg>
);

const LightbulbIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.3V16h6v-.2c0-.9.4-1.7 1-2.3A6 6 0 0 0 12 3Z" />
  </Svg>
);

const AppsIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Svg>
);

const BetaIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 4h5M10.5 4v5.2L5.6 17.6A2 2 0 0 0 7.3 20.5h9.4a2 2 0 0 0 1.7-2.9l-4.9-8.4V4" />
    <path d="M8 15h8" />
  </Svg>
);

const LogoutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
    <path d="M14 8.5 18 12l-4 3.5M18 12H9.5" />
  </Svg>
);

const BoltIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 3.5 5.5 13.2h5.6L10 20.5l7.5-9.7h-5.6L13 3.5Z" />
  </Svg>
);

const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

const PublishIcon = CalendarIcon;

const CommunityIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.5h10a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H8.5L5.5 16v-2.5H4A1.5 1.5 0 0 1 2.5 12V7A1.5 1.5 0 0 1 4 5.5Z" />
    <path d="M18.5 9.5H20a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-1.5V20l-3-2.5H11" />
  </Svg>
);

const InsightsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 18V9M12 18V5M19 18v-7M3 20h18" />
  </Svg>
);

/** Poignée de glisser-déposer : 2 colonnes × 3 points (6 points). */
function GripIcon({ className = "h-4 w-2.5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 10 16"
      className={["select-none", className].join(" ")}
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="2.5" cy="3" r="1.15" />
      <circle cx="7.5" cy="3" r="1.15" />
      <circle cx="2.5" cy="8" r="1.15" />
      <circle cx="7.5" cy="8" r="1.15" />
      <circle cx="2.5" cy="13" r="1.15" />
      <circle cx="7.5" cy="13" r="1.15" />
    </svg>
  );
}

function SidebarToggleIcon({ className, open }: IconProps & { open: boolean }) {
  return (
    <Svg className={className}>
      <rect
        x="3.5"
        y="4.5"
        width="6"
        height="15"
        rx="2"
        fill="currentColor"
        stroke="none"
        className={[
          "transition-opacity duration-300 motion-reduce:transition-none",
          open ? "opacity-30" : "opacity-0",
        ].join(" ")}
      />
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <path d="M9.5 4.5v15" />
    </Svg>
  );
}

/* ============================================================================ 
   Tooltip flottant (portal) 
============================================================================ */

const TIP_DELAY_MS = 280;

function Tip({
  label,
  shortcut,
  enabled,
  menuClass,
  countClass,
  children,
}: {
  label: string;
  shortcut?: string;
  enabled: boolean;
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
      if (rect) setPos({ top: rect.top + rect.height / 2, left: rect.right + 10 });
    }, TIP_DELAY_MS);
  }, [enabled]);

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
      className="flex w-full justify-center"
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
   Navigation data 
============================================================================ */

const navItems: NavItem[] = [
  { label: "Home", icon: HomeIcon, route: "home" },
  { label: "Publish", icon: CalendarIcon, route: "schedule" },
  { label: "Create", icon: LightbulbIcon, route: "create", badge: "New" },
];

const defaultAccount = {
  name: "Ronan",
  initials: "RN",
  email: "workspace@crew.io",
  organization: "My Organization",
  plan: "Free plan",
  channels: 0,
  avatarUrl: undefined as string | undefined,
};

/**
 * ✨ MODIFICATION ICI : On aligne les labels sur la page de tarification.
 * "pro" et "professional" deviennent "Professional".
 */
function formatPlanLabel(name: string | null | undefined): string | null {
  const normalized = name?.trim().toLowerCase();
  if (!normalized) return null;

  const labels: Record<string, string> = {
    starter: "Starter",
    pro: "Professional",
    professional: "Professional",
    enterprise: "Enterprise",
    free: "Free plan",
  };

  return labels[normalized] ?? name?.trim() ?? null;
}

const menuGroups: MenuItem[][] = [
  [
    { label: "Settings", icon: SettingsIcon, route: "settings" },
    { label: "Channels", icon: ChannelsIcon, route: "channels" },
    { label: "Plans and Billing", icon: BillingIcon, route: "pricing" },
    { label: "Help & Support", icon: HelpIcon, route: "faq" },
  ],
  [
    { label: "Integrations", icon: AppsIcon, route: "integrations" },
    { label: "Beta Features", icon: BetaIcon, badge: "Soon", disabled: true },
  ],
  [{ label: "Log out", icon: LogoutIcon, action: "logout" }],
];

/* ============================================================================ 
   Navigation item 
============================================================================ */

function NavItemViewImpl({
  item,
  currentRoute,
  compact,
  focus,
  t,
  onNavigate,
}: {
  item: NavItem;
  currentRoute: string;
  compact: boolean;
  focus: string;
  t: ThemeTokens;
  onNavigate: (route: string) => void;
}) {
  const Icon = item.icon;
  const isActive = item.route === currentRoute;
  const letter = shortcutKeyForRoute(item.route);
  const shortcut = letter ? shortcutLabel(letter) : undefined;

  return (
    <Tip
      label={item.label}
      shortcut={shortcut}
      enabled={compact}
      menuClass={t.menu}
      countClass={t.count}
    >
      <button
        type="button"
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
        aria-keyshortcuts={letter ? ariaShortcut(letter) : undefined}
        onClick={() => onNavigate(item.route)}
        className={[
          "group relative flex items-center rounded-xl text-[13px] font-medium",
          "transition-[background-color,color,transform] duration-200",
          "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
          compact ? "h-10 w-10 justify-center" : "h-9 w-full gap-2.5 px-2.5",
          focus,
          isActive ? t.navActive : t.navIdle,
        ].join(" ")}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />

        {!compact && (
          <>
            <span
              className={[
                "sb-fade flex-1 truncate text-left",
                !isActive ? "sb-label sb-label-1" : "",
              ].join(" ")}
            >
              {item.label}
            </span>
            {item.badge && (
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  t.badge,
                ].join(" ")}
              >
                {item.badge}
              </span>
            )}
          </>
        )}

        {compact && item.badge && (
          <span
            aria-hidden="true"
            className={[
              "absolute right-1 top-1 h-2 w-2 rounded-full ring-2",
              t.accent,
              t.dotRing,
            ].join(" ")}
          />
        )}
      </button>
    </Tip>
  );
}

const NavItemView = memo(NavItemViewImpl);

/* ============================================================================ 
   Channels (réseaux connectés) 
============================================================================ */

type NetworkKey =
  | "x"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "threads";

const channelsMemory = { open: [] as string[] };

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

function getHashChannel(): string | null {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash;
  const queryIndex = hash.indexOf("?");
  if (queryIndex === -1) return null;

  return new URLSearchParams(hash.slice(queryIndex + 1)).get("channel");
}

const CHANNEL_LINKS: {
  label: string;
  route: string;
  icon: IconComponent;
  badge?: string;
  perChannel?: boolean;
}[] = [
  { label: "Publish", route: "schedule", icon: PublishIcon, perChannel: true },
  { label: "Community", route: "community", icon: CommunityIcon, perChannel: true },
  {
    label: "Insights",
    route: "insights",
    icon: InsightsIcon,
    badge: "New",
    perChannel: true,
  },
];

const STANDALONE_LINKS = [
  { label: "Insights", route: "insights", icon: InsightsIcon, badge: "New" },
  { label: "Community", route: "community", icon: CommunityIcon },
];

const CHANNEL_ROUTES = new Set(["insights", "community"]);

/* ----------------------------------------------------------------------------
   Ordre des canaux (glisser-déposer) — mémorisé par utilisateur
---------------------------------------------------------------------------- */

const ORDER_STORAGE_PREFIX = "stone.channels.order";

function orderStorageKey(userId: string | null): string {
  return `${ORDER_STORAGE_PREFIX}.${userId ?? "anon"}`;
}

function readStoredOrder(userId: string | null): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(orderStorageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStoredOrder(userId: string | null, order: string[]) {
  try {
    window.localStorage.setItem(orderStorageKey(userId), JSON.stringify(order));
  } catch {
    /* stockage indisponible : l'ordre reste en mémoire pour la session */
  }
}

/** Trie les canaux selon l'ordre mémorisé ; les nouveaux canaux vont à la fin. */
function applyOrder(
  channels: ConnectedChannel[],
  order: string[]
): ConnectedChannel[] {
  if (order.length === 0) return channels;

  const rank = new Map(order.map((key, index) => [key, index]));

  return channels
    .map((channel, index) => ({ channel, index }))
    .sort((a, b) => {
      const ra = rank.get(a.channel.key) ?? order.length;
      const rb = rank.get(b.channel.key) ?? order.length;
      return ra - rb || a.index - b.index;
    })
    .map(({ channel }) => channel);
}

/**
 * Avatar d'un canal connecté.
 * Taille : lg = 32px (h-8 w-8), md = 24px (h-6 w-6).
 * Style carré arrondi (rounded-lg).
 */
function ChannelAvatar({
  channel,
  NetworkIcon,
  dotRing,
  size = "md",
}: {
  channel: ConnectedChannel;
  NetworkIcon?: IconComponent;
  dotRing: string;
  size?: "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [channel.avatarUrl]);

  const label = channel.handle || channel.name;
  const initial = label.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const box = size === "lg" ? "h-8 w-8" : "h-6 w-6";
  const radius = "rounded-lg";

  return (
    <span className={["relative shrink-0", box].join(" ")}>
      {channel.avatarUrl && !failed ? (
        <img
          src={channel.avatarUrl}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={[
            "h-full w-full select-none object-cover",
            radius,
          ].join(" ")}
        />
      ) : (
        <span
          className={[
            "flex h-full w-full items-center justify-center bg-neutral-700",
            radius,
            "text-[10px] font-semibold text-white",
          ].join(" ")}
        >
          {initial}
        </span>
      )}

      {/* Badge réseau : 14px (h-3.5 w-3.5), icône 10px */}
      {NetworkIcon && (
        <span
          className={[
            "absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center",
            "rounded-[4px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)] ring-2",
            dotRing,
          ].join(" ")}
        >
          <NetworkIcon className="h-2.5 w-2.5" />
        </span>
      )}
    </span>
  );
}

/* ============================================================================ 
   Popover d'une ligne de canal (sidebar réduite uniquement) 
============================================================================ */

const HOVER_CARD_SHOW_MS = 200;
const HOVER_CARD_HIDE_MS = 120;

function ChannelHoverCard({
  channel,
  label,
  NetworkIcon,
  currentRoute,
  hashChannel,
  firstChannelKey,
  focus,
  t,
  enabled,
  onNavigate,
  onNewPost,
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
  enabled: boolean;
  onNavigate: (route: string) => void;
  onNewPost: (channelKey: string) => void;
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
    if (!enabled) return;
    cancelHide();
    window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(openNow, HOVER_CARD_SHOW_MS);
  }, [cancelHide, enabled, openNow]);

  const hide = useCallback(() => {
    window.clearTimeout(showTimer.current);
    hideTimer.current = window.setTimeout(() => setPos(null), HOVER_CARD_HIDE_MS);
  }, []);

  const closeAndRefocus = useCallback(() => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
    setPos(null);
    anchorRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);

  const focusFirstItem = useCallback(() => {
    requestAnimationFrame(() => {
      popRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      window.clearTimeout(showTimer.current);
      setPos(null);
    }
  }, [enabled]);

  useEffect(
    () => () => {
      window.clearTimeout(showTimer.current);
      window.clearTimeout(hideTimer.current);
    },
    []
  );

  const onAnchorBlur = (event: React.FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (
      next &&
      (anchorRef.current?.contains(next) || popRef.current?.contains(next))
    ) {
      return;
    }
    hide();
  };

  const onAnchorKeyDown = (event: React.KeyboardEvent) => {
    if (!anchorRef.current?.contains(event.target as Node)) return;

    if (event.key === "Escape" && pos) {
      event.preventDefault();
      setPos(null);
      return;
    }

    if (event.key === "ArrowRight" && enabled) {
      event.preventDefault();
      if (!pos) openNow();
      focusFirstItem();
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
    else if (event.key === "ArrowUp")
      next = (current - 1 + items.length) % items.length;
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
      onBlur={onAnchorBlur}
      onKeyDown={onAnchorKeyDown}
      className="relative flex w-full justify-center"
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
            onClick={(event) => event.stopPropagation()}
            className={[
              "sb-menu fixed z-[70] w-[196px] overflow-hidden rounded-2xl border p-2",
              t.menu,
            ].join(" ")}
          >
            <div className="flex items-center gap-2.5 px-1 pb-2 pt-1">
              <ChannelAvatar
                channel={channel}
                NetworkIcon={NetworkIcon}
                dotRing={t.dotRing}
              />
              <span
                className={[
                  "min-w-0 flex-1 truncate text-[12.5px] font-semibold",
                  t.title,
                ].join(" ")}
              >
                {label.replace(/^@/, "")}
              </span>
            </div>

            <div className={["border-t pt-1", t.menuDivider].join(" ")} />

            <div className="flex flex-col gap-0.5">
              {/* Poster directement avec ce compte */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPos(null);
                  onNewPost(channel.key);
                }}
                className={[
                  "group flex h-8 w-full items-center gap-2.5 whitespace-nowrap",
                  "rounded-lg px-2 text-left text-[12.5px] font-semibold",
                  "transition-colors duration-150 motion-reduce:transition-none",
                  focus,
                  t.sub,
                ].join(" ")}
              >
                <PlusIcon className="h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100" />
                <span className="flex-1">New post</span>
              </button>

              {CHANNEL_LINKS.map((link) => {
                const Icon = link.icon;

                const target = link.perChannel
                  ? `${link.route}?channel=${encodeURIComponent(channel.key)}`
                  : link.route;

                const active = link.perChannel
                  ? link.route === currentRoute &&
                    (hashChannel === null
                      ? firstChannelKey === channel.key
                      : hashChannel === channel.key)
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
                      "group flex h-8 w-full items-center gap-2.5 whitespace-nowrap",
                      "rounded-lg px-2 text-left text-[12.5px] font-medium",
                      "transition-colors duration-150 motion-reduce:transition-none",
                      focus,
                      active ? t.subActive : t.sub,
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100" />
                    <span className="flex-1">{link.label}</span>
                    {link.badge && (
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                          t.badge,
                        ].join(" ")}
                      >
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

function SidebarChannelsImpl({
  channels: rawChannels,
  userId,
  isDark,
  compact,
  currentRoute,
  focus,
  t,
  onNavigate,
  onExpand,
  onConnect,
  onNewPost,
}: {
  channels: ConnectedChannel[];
  userId: string | null;
  isDark: boolean;
  compact: boolean;
  currentRoute: string;
  focus: string;
  t: ThemeTokens;
  onNavigate: (route: string) => void;
  onExpand: () => void;
  onConnect: () => void;
  onNewPost: (channelKey: string) => void;
}) {
  const [openKeys, setOpenKeys] = useState<string[]>(channelsMemory.open);

  useEffect(() => {
    channelsMemory.open = openKeys;
  }, [openKeys]);

  /* ---------------------------- Ordre + drag & drop --------------------------- */

  const [order, setOrder] = useState<string[]>(() => readStoredOrder(userId));
  const [dragKey, setDragKey] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const focusKeyRef = useRef<string | null>(null);
  // Refs synchrones : évitent les états périmés pendant le drag
  const dragKeyRef = useRef<string | null>(null);
  const liveOrderRef = useRef<string[] | null>(null);

  useEffect(() => {
    setOrder(readStoredOrder(userId));
  }, [userId]);

  const channels = useMemo(
    () => applyOrder(rawChannels, order),
    [rawChannels, order]
  );

  const channelsRef = useRef(channels);
  channelsRef.current = channels;

  // Réordonner n'a de sens qu'avec au moins 2 canaux et la barre développée.
  const canReorder = !compact && channels.length > 1;

  const commitOrder = useCallback(
    (keys: string[]) => {
      setOrder(keys);
      writeStoredOrder(userId, keys);
    },
    [userId]
  );

  const shiftChannel = useCallback(
    (key: string, delta: -1 | 1) => {
      const keys = channels.map((channel) => channel.key);
      const from = keys.indexOf(key);
      const to = from + delta;

      if (from === -1 || to < 0 || to >= keys.length) return;

      [keys[from], keys[to]] = [keys[to], keys[from]];
      focusKeyRef.current = key;
      commitOrder(keys);
    },
    [channels, commitOrder]
  );

  // Redonne le focus au canal déplacé au clavier (le DOM a été réordonné).
  useEffect(() => {
    const key = focusKeyRef.current;
    if (!key) return;

    focusKeyRef.current = null;

    listRef.current
      ?.querySelector<HTMLElement>(
        `[data-channel-key="${CSS.escape(key)}"] button[aria-expanded]`
      )
      ?.focus({ preventScroll: true });
  }, [order]);

  /* ── Drag façon Create.tsx : fantôme flottant + emplacement vide + décalage fluide ── */

  const dragCleanupRef = useRef<((cancel?: boolean) => void) | null>(null);

  // Réordonne EN DIRECT : dès que le curseur passe la moitié d'une autre ligne.
  const moveLive = useCallback((clientY: number) => {
    const fromKey = dragKeyRef.current;
    const list = listRef.current;
    if (!fromKey || !list) return;

    const currentKeys = channelsRef.current.map((channel) => channel.key);
    const others = currentKeys.filter((key) => key !== fromKey);

    // La liste est `relative` : offsetTop des lignes est relatif à elle,
    // indépendamment des animations (transform) et du scroll.
    const y = clientY - list.getBoundingClientRect().top;

    let insertAt = others.length;

    for (let i = 0; i < others.length; i++) {
      const el = list.querySelector<HTMLElement>(
        `[data-channel-key="${CSS.escape(others[i])}"]`
      );
      const row = el?.firstElementChild as HTMLElement | null;
      if (!row) continue;

      if (y < row.offsetTop + row.offsetHeight / 2) {
        insertAt = i;
        break;
      }
    }

    const next = [...others];
    next.splice(insertAt, 0, fromKey);

    if (next.every((key, index) => key === currentKeys[index])) return;

    liveOrderRef.current = next;
    setOrder(next);
  }, []);

  const onHandlePointerDown = (event: React.PointerEvent, key: string) => {
    if (!canReorder) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const wrapper = (event.currentTarget as HTMLElement).closest<HTMLElement>(
      "[data-channel-key]"
    );
    const row = wrapper?.firstElementChild as HTMLElement | null;
    if (!row) return;

    event.preventDefault();
    dragCleanupRef.current?.(true);

    const rect = row.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const offY = event.clientY - rect.top;
    const originalOrder = channelsRef.current.map((channel) => channel.key);

    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    let ghost: HTMLElement | null = null;

    const onMove = (ev: PointerEvent) => {
      if (!ghost) {
        // Seuil de 5 px : un simple clic ne déclenche pas de drag
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;

        ghost = row.cloneNode(true) as HTMLElement;
        ghost.setAttribute("aria-hidden", "true");

        Object.assign(ghost.style, {
          position: "fixed",
          margin: "0",
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          zIndex: "200",
          pointerEvents: "none",
          transition: "none",
          transform: "rotate(2deg)",
          transformOrigin: "50% 0",
          opacity: "1",
          borderRadius: "12px",
          background: isDark ? "#17171a" : "#e8e8e4",
          color: getComputedStyle(row).color,
          boxShadow: isDark
            ? "0 18px 40px rgba(0,0,0,0.7)"
            : "0 18px 40px rgba(0,0,0,0.18)",
        } as Partial<CSSStyleDeclaration>);

        const grip = ghost.querySelector<HTMLElement>("[data-grip]");
        if (grip) {
          grip.style.opacity = "1";
          grip.style.transform = "none";
          grip.style.transition = "none";
        }

        // Le bouton « + » n'a pas à apparaître sur le fantôme
        const plus = ghost.querySelector<HTMLElement>("[data-new-post]");
        if (plus) plus.style.display = "none";

        document.body.appendChild(ghost);
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";

        dragKeyRef.current = key;
        liveOrderRef.current = null;
        setDragKey(key);
      }

      // Le fantôme suit le curseur verticalement
      ghost.style.top = `${ev.clientY - offY}px`;

      // Auto-scroll de la navigation près des bords
      const nav = listRef.current?.closest("nav");
      if (nav) {
        const nr = nav.getBoundingClientRect();
        if (ev.clientY > nr.bottom - 40) nav.scrollTop += 10;
        else if (ev.clientY < nr.top + 40) nav.scrollTop -= 10;
      }

      moveLive(ev.clientY);
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") finish(true);
    };

    const finish = (cancel = false) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);

      ghost?.remove();
      ghost = null;
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      dragCleanupRef.current = null;

      if (dragKeyRef.current) {
        if (cancel) {
          setOrder(originalOrder);
        } else if (liveOrderRef.current) {
          writeStoredOrder(userId, liveOrderRef.current);
        }
      }

      liveOrderRef.current = null;
      dragKeyRef.current = null;
      setDragKey(null);
    };

    const onUp = () => finish(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    dragCleanupRef.current = finish;
  };

  // Annule le drag si la barre est réduite ou démontée
  useEffect(() => {
    if (!canReorder) dragCleanupRef.current?.(true);
  }, [canReorder]);

  useEffect(() => () => dragCleanupRef.current?.(true), []);

  /** FLIP : les réseaux qui changent de place glissent au lieu de sauter. */
  const prevTops = useRef(new Map<string, number>());
  const prevOrderKey = useRef("");

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const orderKey = channels.map((channel) => channel.key).join("|");
    const orderChanged = orderKey !== prevOrderKey.current;
    const next = new Map<string, number>();

    list.querySelectorAll<HTMLElement>("[data-channel-key]").forEach((el) => {
      const key = el.dataset.channelKey as string;
      const top = el.offsetTop;
      next.set(key, top);

      const prev = prevTops.current.get(key);

      // On n'anime que si l'ordre a changé (pas à l'ouverture d'un sous-menu)
      if (!reduce && orderChanged && prev !== undefined && prev !== top) {
        el.style.transition = "none";
        el.style.transform = `translateY(${prev - top}px)`;
        el.getBoundingClientRect(); // force le reflow
        el.style.transition = "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)";
        el.style.transform = "";
        el.addEventListener("transitionend", () => (el.style.transition = ""), {
          once: true,
        });
      }
    });

    prevTops.current = next;
    prevOrderKey.current = orderKey;
  });

  /* ------------------------------------------------------------------------- */

  const hashChannel = CHANNEL_ROUTES.has(currentRoute) ? getHashChannel() : null;

  const toggleKey = (key: string) =>
    setOpenKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const openKey = (key: string) =>
    setOpenKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));

  return (
    <div
      ref={listRef}
      className="relative flex flex-col gap-1"
    >
      {channels.length === 0 &&
        STANDALONE_LINKS.map((link) => {
          const Icon = link.icon;
          const isActive = link.route === currentRoute;

          return (
            <Tip
              key={link.route}
              label={link.label}
              enabled={compact}
              menuClass={t.menu}
              countClass={t.count}
            >
              <button
                type="button"
                aria-label={link.label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onNavigate(link.route)}
                className={[
                  "group relative flex items-center rounded-xl text-[13px] font-medium",
                  "transition-[background-color,color,transform] duration-200",
                  "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
                  compact ? "h-10 w-10 justify-center" : "h-9 w-full gap-2.5 px-2.5",
                  focus,
                  isActive ? t.navActive : t.navIdle,
                ].join(" ")}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />

                {!compact && (
                  <>
                    <span className="sb-fade flex-1 truncate text-left">
                      {link.label}
                    </span>
                    {link.badge && (
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          t.badge,
                        ].join(" ")}
                      >
                        {link.badge}
                      </span>
                    )}
                  </>
                )}

                {compact && link.badge && (
                  <span
                    aria-hidden="true"
                    className={[
                      "absolute right-1 top-1 h-2 w-2 rounded-full ring-2",
                      t.accent,
                      t.dotRing,
                    ].join(" ")}
                  />
                )}
              </button>
            </Tip>
          );
        })}

      {/* Séparateur horizontal (mode réduit uniquement) */}
      {compact && (
        <div className={["my-2 h-px w-8 mx-auto", t.divider].join(" ")} />
      )}

      {!compact && (
        <div className="sb-fade group/channels mt-3 flex h-6 items-center justify-between px-2.5">
          <span className={["text-[12px] font-medium", t.muted].join(" ")}>
            {channels.length === 0 ? "Connect channels" : "Channels"}
          </span>

          <span
            className={[
              "flex items-center gap-0.5",
              "opacity-0 transition-opacity duration-200",
              "group-hover/channels:opacity-100",
              "group-focus-within/channels:opacity-100",
              "focus-within:opacity-100",
              "motion-reduce:transition-none",
            ].join(" ")}
          >
            <button
              type="button"
              aria-label="Channels"
              onClick={() => onNavigate("channels")}
              className={[
                "flex h-6 w-6 items-center justify-center rounded-lg",
                "transition-colors duration-150 motion-reduce:transition-none",
                focus,
                t.menuIcon,
                t.row,
              ].join(" ")}
            >
              <SettingsIcon className="h-[15px] w-[15px]" />
            </button>

            <button
              type="button"
              aria-label="Connect a channel"
              onClick={onConnect}
              className={[
                "flex h-6 w-6 items-center justify-center rounded-lg",
                "transition-colors duration-150 motion-reduce:transition-none",
                focus,
                t.menuIcon,
                t.row,
              ].join(" ")}
            >
              <PlusIcon className="h-[15px] w-[15px]" />
            </button>
          </span>
        </div>
      )}

      {channels.map((channel) => {
        const id = getNetworkId(channel);
        const NetworkIcon = id ? NETWORK_ICONS[id] : undefined;
        const label = channel.handle || channel.name;
        const cleanLabel = label.replace(/^@/, "");
        const groupKey = `channel:${channel.key}`;
        const isOpen = openKeys.includes(groupKey) && !compact;

        const isActiveChannel =
          CHANNEL_ROUTES.has(currentRoute) &&
          (hashChannel === null
            ? channels[0]?.key === channel.key
            : hashChannel === channel.key);

        const isDragging = dragKey === channel.key;

        return (
          <div
            key={channel.key}
            data-channel-key={channel.key}
            className="flex flex-col"
          >
            {/* Ligne du canal = zone de survol + zone de dépôt */}
            <div
              className={[
                "group/row relative rounded-xl",
                "transition-[opacity,background-color] duration-150 motion-reduce:transition-none",
                canReorder ? t.row : "",
                isDragging ? `${t.rowOpen} [&>*]:invisible` : "",
              ].join(" ")}
            >
              {/* Poignée de glisser-déposer (6 points) — DANS la zone de survol */}
              {canReorder && (
                <span
                  aria-hidden="true"
                  data-grip
                  onPointerDown={(event) => onHandlePointerDown(event, channel.key)}
                  className={[
                    // À l'intérieur de la ligne (plus de décalage négatif)
                    "absolute left-[1px] top-1/2 z-10 flex h-7 w-3 -translate-y-1/2",
                    "touch-none cursor-grab items-center justify-center rounded active:cursor-grabbing",
                    // Animation : glisse depuis la gauche + léger zoom
                    "transition-[opacity,transform,color] duration-200 ease-out motion-reduce:transition-none",
                    "hover:scale-125 active:scale-110",
                    isDragging
                      ? "translate-x-0 scale-100 opacity-100"
                      : [
                          "-translate-x-1 scale-90 opacity-0",
                          "group-hover/row:translate-x-0 group-hover/row:scale-100 group-hover/row:opacity-100",
                          "group-focus-within/row:translate-x-0 group-focus-within/row:scale-100 group-focus-within/row:opacity-100",
                        ].join(" "),
                    t.menuIcon,
                  ].join(" ")}
                >
                  <GripIcon className="h-4 w-2" />
                </span>
              )}

              {/* Bouton « + » : poster directement avec ce compte.
                  Frère du bouton principal (pas imbriqué : un <button> dans un <button> est invalide).
                  Visible au survol / focus, toujours visible sur écran tactile. */}
              {!compact && (
                <button
                  type="button"
                  data-new-post
                  title={`New post on ${cleanLabel}`}
                  aria-label={`New post on ${cleanLabel}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onNewPost(channel.key);
                  }}
                  className={[
                    "absolute right-8 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg",
                    "opacity-0 transition-[opacity,background-color,color,transform] duration-150",
                    "active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100",
                    "group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100",
                    "[@media(hover:none)]:opacity-100",
                    focus,
                    t.rowOpen,
                    t.menuIcon,
                  ].join(" ")}
                >
                  <PlusIcon className="h-[15px] w-[15px]" />
                </button>
              )}

              <ChannelHoverCard
                channel={channel}
                label={label}
                NetworkIcon={NetworkIcon}
                currentRoute={currentRoute}
                hashChannel={hashChannel}
                firstChannelKey={channels[0]?.key}
                focus={focus}
                t={t}
                enabled={compact}
                onNavigate={onNavigate}
                onNewPost={onNewPost}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup={compact ? "menu" : undefined}
                  aria-label={cleanLabel}
                  aria-keyshortcuts={canReorder ? "Alt+ArrowUp Alt+ArrowDown" : undefined}
                  onKeyDown={(event) => {
                    // Alt + ↑ / ↓ : déplacer le canal au clavier
                    if (!canReorder || !event.altKey) return;
                    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

                    event.preventDefault();
                    shiftChannel(channel.key, event.key === "ArrowUp" ? -1 : 1);
                  }}
                  onClick={() => {
                    if (compact) {
                      onExpand();
                      openKey(groupKey);
                    } else {
                      toggleKey(groupKey);
                    }
                  }}
                  className={[
                    "group relative flex items-center rounded-xl text-[13px] font-medium",
                    "transition-[background-color,color,transform,padding] duration-200",
                    "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
                    compact ? "h-10 w-10 justify-center" : "h-9 w-full gap-2.5 px-2.5",
                    // L'avatar se décale légèrement pour laisser place à la poignée
                    canReorder
                      ? isDragging
                        ? "pl-3.5"
                        : "group-hover/row:pl-3.5 group-focus-within/row:pl-3.5"
                      : "",
                    focus,
                    isOpen || isActiveChannel ? t.rowOpen : "",
                    t.navIdle,
                  ].join(" ")}
                >
                  <ChannelAvatar
                    channel={channel}
                    NetworkIcon={NetworkIcon}
                    dotRing={t.dotRing}
                    size={compact ? "lg" : "md"}
                  />

                  {!compact && (
                    <>
                      {/* pr-7 au survol : le texte s'arrête avant le bouton « + » */}
                      <span className="sb-fade min-w-0 flex-1 truncate pr-0 text-left group-hover/row:pr-7 group-focus-within/row:pr-7">
                        {cleanLabel}
                      </span>
                      <ChevronDownIcon
                        className={[
                          "h-3.5 w-3.5 shrink-0 opacity-60",
                          "transition-transform duration-300 motion-reduce:transition-none",
                          isOpen ? "rotate-0" : "-rotate-90",
                        ].join(" ")}
                      />
                    </>
                  )}
                </button>
              </ChannelHoverCard>
            </div>

            {!compact && (
              <div
                className={[
                  "grid transition-[grid-template-rows] duration-300",
                  "ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                ].join(" ")}
              >
                <div className="overflow-hidden">
                  <div
                    className={[
                      "ml-[20px] mt-1 flex flex-col gap-0.5 border-l pl-2.5",
                      t.rail,
                    ].join(" ")}
                  >
                    {CHANNEL_LINKS.map((link) => {
                      const Icon = link.icon;

                      const target = link.perChannel
                        ? `${link.route}?channel=${encodeURIComponent(channel.key)}`
                        : link.route;

                      const active = link.perChannel
                        ? link.route === currentRoute &&
                          (hashChannel === null
                            ? channels[0]?.key === channel.key
                            : hashChannel === channel.key)
                        : link.route === currentRoute;

                      return (
                        <button
                          key={link.route}
                          type="button"
                          tabIndex={isOpen ? 0 : -1}
                          aria-current={active ? "page" : undefined}
                          onClick={() => onNavigate(target)}
                          className={[
                            "group flex h-8 w-full items-center gap-2.5 whitespace-nowrap",
                            "rounded-lg px-2 text-left text-[12.5px] font-medium",
                            "transition-colors duration-150 motion-reduce:transition-none",
                            focus,
                            active ? t.subActive : t.sub,
                          ].join(" ")}
                        >
                          <Icon className="h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100" />
                          <span className="flex-1">{link.label}</span>
                          {link.badge && (
                            <span
                              className={[
                                "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                                t.badge,
                              ].join(" ")}
                            >
                              {link.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const SidebarChannels = memo(SidebarChannelsImpl);

/* ============================================================================ 
   Sidebar memory 
============================================================================ */

const SIDEBAR_STORAGE_KEY = "stone.sidebar.collapsed";

function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return true;

  try {
    const value = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return value === null ? true : value === "true";
  } catch {
    return true;
  }
}

const sidebarMemory = {
  collapsed: readStoredCollapsed(),
};

const userProfileCache = {
  profile: null as UserProfile | null,
};

const sidebarListeners = new Set<() => void>();

function setSidebarCollapsed(value: boolean) {
  if (sidebarMemory.collapsed === value) return;

  sidebarMemory.collapsed = value;

  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
  } catch {
    /* stockage indisponible : état en mémoire uniquement */
  }

  sidebarListeners.forEach((listener) => listener());
}

function subscribeSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  return () => {
    sidebarListeners.delete(listener);
  };
}

function resetSidebarModuleState() {
  userProfileCache.profile = null;
  setSidebarCollapsed(true);
  channelsMemory.open = [];
}

export function useSidebarOffset(): number {
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    () => sidebarMemory.collapsed,
    () => true
  );
  const isMobile = useIsMobile();

  if (isMobile) return 0;

  return collapsed ? SIDEBAR_COLLAPSED_OFFSET : SIDEBAR_EXPANDED_OFFSET;
}

/* ============================================================================ 
   Channel-connections helpers 
============================================================================ */

type OAuthProvider = "tiktok" | "pinterest" | "youtube";

const OAUTH_LABELS: Record<OAuthProvider, string> = {
  tiktok: "TikTok",
  pinterest: "Pinterest",
  youtube: "YouTube Shorts",
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

  return raw
    ? `Unable to connect to ${provider}. ${raw}`
    : `Unable to connect to ${provider}.`;
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
  onToggleTheme?: (origin?: { x: number; y: number }) => void;
};

export default function DashboardSidebar({
  theme: themeProp,
}: DashboardSidebarProps) {
  const themeContext = useTheme();
  const theme = themeProp ?? themeContext.theme;
  const isDark = theme === "dark";

  const currentRoute = useHashRoute();
  const connectedChannels = useConnectedChannels();
  const isMobile = useIsMobile();

  const hasChannels = connectedChannels.length > 0;
  const visibleNavItems = useMemo(
    () => (hasChannels ? navItems.filter((item) => item.route !== "schedule") : navItems),
    [hasChannels]
  );

  const { user } = useUser();
  const { subscription, hasActive: hasActiveSubscription } = useSubscription();
  const userId = user?.id ?? null;

  const [isCollapsed, setIsCollapsed] = useState(sidebarMemory.collapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(
    userProfileCache.profile
  );
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const compact = isMobile ? false : isCollapsed;
  const drawerHidden = isMobile && !mobileOpen;

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

  const oauthBusy = useRef<Record<OAuthProvider, boolean>>({
    tiktok: false,
    pinterest: false,
    youtube: false,
  });

  const placeholderTimer = useRef<number | undefined>(undefined);

  const profileRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    const loadUserProfile = async () => {
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
    };

    loadUserProfile();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const hash = window.location.hash;
    const queryIndex = hash.indexOf("?");
    const basePath = queryIndex === -1 ? hash : hash.slice(0, queryIndex);
    const params = new URLSearchParams(
      queryIndex === -1 ? "" : hash.slice(queryIndex + 1)
    );

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

      if (message) {
        setConnectError(
          `Unable to connect to ${OAUTH_LABELS[provider]}. ${message}`
        );
      }

      if (returned[provider]) clearCache(userId, provider);
    });

    if (
      (returned.tiktok || returned.pinterest || returned.youtube) &&
      basePath.includes("channels")
    ) {
      [
        "tiktok",
        "tiktok_error",
        "pinterest",
        "pinterest_error",
        "youtube",
        "youtube_error",
      ].forEach((k) => params.delete(k));
      const query = params.toString();

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${basePath}${
          query ? `?${query}` : ""
        }`
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
        setConnections((current) => ({
          ...current,
          [provider]: cached.connection,
        }));

        if (Date.now() - cached.savedAt < CACHE_MAX_AGE_MS) return;
      }

      void (async () => {
        try {
          const status = await fetchStatus();
          if (cancelled) return;

          const connection = toConnection(status);

          if (connection.connected) {
            writeCache(userId, connection, provider);
          } else {
            clearCache(userId, provider);
          }

          setConnections((current) => ({
            ...current,
            [provider]: connection,
          }));
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

  useEffect(() => {
    setSidebarCollapsed(isCollapsed);
  }, [isCollapsed]);

  useEffect(() => () => window.clearTimeout(placeholderTimer.current), []);

  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, [currentRoute]);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !menuOpen && !connectOpen) {
        setMobileOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen, menuOpen, connectOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
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

  const onMenuKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const items = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([disabled])'
        )
      );

      if (items.length === 0) return;

      const current = items.indexOf(document.activeElement as HTMLElement);
      let next = -1;

      if (event.key === "ArrowDown") next = (current + 1) % items.length;
      else if (event.key === "ArrowUp")
        next = (current - 1 + items.length) % items.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = items.length - 1;

      if (next >= 0) {
        event.preventDefault();
        items[next].focus();
      }
    },
    []
  );

  /* --------------------------------------------------------------------------
     Thème.
     La sidebar a EXACTEMENT le même fond que la page (Home → pageBgClass) :
       sombre  #09090a
       clair   #f5f3ef
     Le panneau de contenu arrondi (blanc / #0f0f11) se détache dessus.
  -------------------------------------------------------------------------- */
  const t = useMemo<ThemeTokens>(
    () =>
      isDark
        ? {
            aside: "bg-[#09090a]",
            divider: "bg-white/[0.07]",
            navActive: "bg-[#17171a] text-white",
            navIdle: "text-white/60 hover:bg-[#141416] hover:text-white",
            count: "bg-white/[0.08] text-[#c9c9c4]",
            dotRing: "ring-[#09090a]",
            rail: "border-white/[0.07]",
            sub: "text-[#8a8f8f] hover:bg-[#141416] hover:text-white",
            subActive: "bg-[#17171a] text-white",
            row: "hover:bg-[#141416]",
            rowOpen: "bg-[#17171a]",
            avatar: "bg-[#e8e8e4] text-[#0a0a0a]",
            title: "text-[#e9e9e5]",
            muted: "text-[#828686]",
            menu: "border-white/[0.08] bg-[#101011] text-[#e9e9e5] shadow-[0_18px_40px_rgba(0,0,0,0.7)]",
            menuDivider: "border-white/[0.07]",
            menuItem: "text-[#dcdcd8] hover:bg-[#1c1c1f] focus-visible:bg-[#1c1c1f]",
            menuIcon: "text-[#969a9a] hover:text-white",
            upgrade:
              "border-white/[0.08] bg-white/[0.03] text-[#e9e9e5] hover:border-white/15 hover:bg-[#1c1c1f]",
            badge: "bg-white text-black",
            accent: "bg-white",
            accentSolid: "border-transparent bg-white text-black hover:bg-white/90",
            ring: "focus-visible:ring-white/25",
          }
        : {
            aside: "bg-[#f5f3ef]",
            divider: "bg-black/[0.07]",
            navActive: "bg-[#e8e8e4] text-[#151515]",
            navIdle: "text-[#55544f] hover:bg-[#e8e8e4] hover:text-[#151515]",
            count: "bg-black/[0.06] text-[#3f3f3d]",
            dotRing: "ring-[#f5f3ef]",
            rail: "border-black/[0.08]",
            sub: "text-[#71706d] hover:bg-[#e8e8e4] hover:text-[#151515]",
            subActive: "bg-[#e8e8e4] text-[#151515]",
            row: "hover:bg-[#e8e8e4]",
            rowOpen: "bg-[#e8e8e4]",
            avatar: "bg-[#1d1d1d] text-white",
            title: "text-[#1b1b1a]",
            muted: "text-[#71706d]",
            menu: "border-black/10 bg-white text-[#1a1a1a] shadow-[0_18px_40px_rgba(0,0,0,0.12)]",
            menuDivider: "border-black/[0.07]",
            menuItem: "text-[#1f1f1e] hover:bg-[#e8e8e4] focus-visible:bg-[#e8e8e4]",
            menuIcon: "text-[#6b6a67] hover:text-[#151515]",
            upgrade:
              "border-black/10 bg-[#f6f5f3] text-[#1a1a1a] hover:border-black/20 hover:bg-[#e8e8e4]",
            badge: "bg-black text-white",
            accent: "bg-black",
            accentSolid: "border-transparent bg-black text-white hover:bg-black/85",
            ring: "focus-visible:ring-black/20",
          },
    [isDark]
  );

  const focus = [
    "cursor-pointer",
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    t.ring,
  ].join(" ");

  const toggleCollapsed = useCallback(() => {
    setMenuOpen(false);

    if (isMobile) {
      setMobileOpen((previous) => !previous);
      return;
    }

    setIsCollapsed((previous) => !previous);
  }, [isMobile]);

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
      toggleCollapsed();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCollapsed]);

  const handleNavigate = useCallback((route: string) => {
    navigate(route);
  }, []);

  /**
   * Poster directement avec un canal : on demande au modal de s'ouvrir avec ce
   * canal présélectionné. Si aucun modal n'est monté sur la page courante,
   * on va sur « schedule » : le modal s'y monte et reprend la demande en attente.
   */
  const handleNewPost = useCallback((channelKey: string) => {
    // Le focus ne doit pas rester dans le tiroir au moment où il se cache
    (document.activeElement as HTMLElement | null)?.blur();

    setMenuOpen(false);
    setMobileOpen(false);

    const handled = requestNewPost(channelKey);
    if (!handled) navigate("schedule");
  }, []);

  const openConnect = useCallback(() => {
    setMenuOpen(false);
    setConnectError(null);
    setConnectOpen(true);
  }, []);

  const closeConnect = useCallback(() => setConnectOpen(false), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      if (connectOpen || isTypingTarget(event.target)) return;

      const key = shortcutKey(event);
      if (!key) return;

      if (key === "p") {
        event.preventDefault();
        setMenuOpen((value) => !value);
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
  }, [connectOpen]);

  const handleExpand = useCallback(() => setIsCollapsed(false), []);

  const limitReached =
    Object.values(connections).filter((c) => c.connected).length >=
    PLAN.maxChannels;

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
        setConnections((current) => ({
          ...current,
          [provider]: { connected: false },
        }));
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
    const token = window.prompt(
      "Pinterest access token (generated in the developer portal):"
    );

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
        void toggleOAuth("tiktok", {
          login: startTikTokLogin,
          disconnect: disconnectTikTok,
        });
        return;

      case "pinterest":
        void toggleOAuth("pinterest", {
          login: startPinterestLogin,
          disconnect: disconnectPinterest,
          manual:
            import.meta.env.VITE_PINTEREST_MANUAL_TOKEN === "true"
              ? pinterestManualToken
              : undefined,
        });
        return;

      case "youtube":
        void toggleOAuth("youtube", {
          login: startYouTubeLogin,
          disconnect: disconnectYouTube,
        });
        return;

      default:
        handlePlaceholderToggle(key);
    }
  };

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

  let menuItemIndex = 0;

  // ✨ Logique mise à jour pour afficher le bon plan
  const accountPlan =
    formatPlanLabel(
      subscription?.plan_name ?? subscription?.plan ?? subscription?.plan_key,
    ) ?? (hasActiveSubscription ? "Paid plan" : "Free plan");

  const account = userProfile
    ? {
        name:
          `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() ||
          "User",
        initials:
          `${(userProfile.first_name || "")[0] || ""}${
            (userProfile.last_name || "")[0] || ""
          }`.toUpperCase() || "U",
        email: userProfile.email,
        organization: "My Organization",
        plan: accountPlan,
        channels: connectedChannels.length,
        avatarUrl: userProfile.avatar_url || undefined,
      }
    : {
        ...defaultAccount,
        plan: accountPlan,
        channels: connectedChannels.length,
      };

  const showAvatarImage = Boolean(account.avatarUrl) && !avatarLoadFailed;

  const planMax = Number.isFinite(PLAN.maxChannels) ? PLAN.maxChannels : 0;
  const planPct =
    planMax > 0
      ? Math.min(100, Math.round((account.channels / planMax) * 100))
      : 0;
  const planFull = planMax > 0 && account.channels >= planMax;

  const channelConnectProps: Omit<
    ConnectChannelModalProps,
    "isDark" | "onClose"
  > = {
    channels: CHANNELS,
    connections,
    pendingKey,
    limitReached,
    planName: PLAN.name,
    realOAuthKeys: REAL_OAUTH,
    errorMessage: connectError,
    onToggle: handleToggle,
  };

  const inertProps = drawerHidden
    ? ({ inert: "" } as Record<string, unknown>)
    : {};

  return (
    <>
      <style>{SIDEBAR_KEYFRAMES}</style>

      {/* Bouton menu mobile : bordure visible car la sidebar se fond dans le fond de page */}
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
            t.aside,
            t.rail,
            t.menuIcon,
          ].join(" ")}
        >
          <MenuIcon className="h-[18px] w-[18px]" />
        </button>
      )}

      {isMobile && mobileOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
          className="sb-backdrop fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
        />
      )}

      <aside
        id="app-sidebar"
        {...inertProps}
        className={[
          "fixed inset-y-0 left-0 flex flex-col border-r",
          isMobile ? "z-40" : "z-20",
          "transition-[width,transform] duration-[380ms]",
          "ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          t.aside,
          // Desktop : aucune séparation visible (fond identique à la page).
          // Mobile (tiroir) : bordure visible pour détacher le tiroir du fond assombri.
          isMobile ? t.rail : "border-transparent",
          drawerHidden ? "pointer-events-none -translate-x-full" : "translate-x-0",
          compact
            ? "w-[56px]"
            : isMobile
              ? "w-[260px] max-w-[85vw]"
              : "w-[240px]",
        ].join(" ")}
      >
       {/* Logo → Home */}
<button
  type="button"
  aria-label="Stone, go to Home"
  aria-current={currentRoute === "home" ? "page" : undefined}
  aria-keyshortcuts={ariaShortcut("h")}
  onClick={() => handleNavigate("home")}
  className={[
    "flex h-14 w-full shrink-0 items-center text-left",
    compact ? "justify-center" : "gap-2 px-4",
    "transition-transform duration-200 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
    focus,
    "focus-visible:ring-inset",
    t.title,
  ].join(" ")}
>
  <img
    src={isDark ? "/images/icon_nav.png" : "/images/icon.png"}
    alt=""
    draggable={false}
    className="h-8 w-7 shrink-0 select-none object-contain"
  />

  {!compact && (
    <span className="sb-fade select-none text-[18px] font-semibold leading-none tracking-tight">
      Stone
    </span>
  )}
</button>

        {/* Navigation */}
        <nav
          aria-label="Main"
          className={[
            "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden pb-3 pt-4",
            compact ? "items-center px-0" : "px-2",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          ].join(" ")}
        >
          {visibleNavItems.map((item) => (
            <NavItemView
              key={item.route}
              item={item}
              currentRoute={currentRoute}
              compact={compact}
              focus={focus}
              t={t}
              onNavigate={handleNavigate}
            />
          ))}

          <SidebarChannels
            channels={connectedChannels}
            userId={userId}
            isDark={isDark}
            compact={compact}
            currentRoute={currentRoute}
            focus={focus}
            t={t}
            onNavigate={handleNavigate}
            onExpand={handleExpand}
            onConnect={openConnect}
            onNewPost={handleNewPost}
          />
        </nav>

        {/* Bas : toggle + profil
            (plus de border-t / t.rail : aucune barre au-dessus du profil) */}
        <div
          ref={profileRef}
          className={[
            "relative shrink-0 py-2.5",
            compact ? "flex flex-col items-center gap-2" : "flex items-center gap-1.5 px-2",
          ].join(" ")}
        >
          <button
            type="button"
            aria-expanded={!compact}
            aria-controls="app-sidebar"
            aria-keyshortcuts="Control+B Meta+B"
            aria-label={
              isMobile
                ? "Close navigation"
                : isCollapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
            }
            title={`${compact ? "Expand" : "Collapse"} sidebar (${TOGGLE_SHORTCUT_LABEL})`}
            onClick={toggleCollapsed}
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              "transition-[background-color,color,transform] duration-200",
              "active:scale-[0.94] motion-reduce:transition-none motion-reduce:active:scale-100",
              compact ? "" : "order-last",
              focus,
              t.menuIcon,
              t.row,
            ].join(" ")}
          >
            <SidebarToggleIcon className="h-[18px] w-[18px]" open={!compact} />
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              id="account-menu"
              role="menu"
              aria-label="Account menu"
              onKeyDown={onMenuKeyDown}
              className={[
                "sb-menu absolute z-50 w-[264px] max-w-[calc(100vw-24px)]",
                "origin-bottom-left overflow-hidden rounded-2xl border",
                "left-[16px] bottom-[60px]",
                t.menu,
              ].join(" ")}
            >
              <div className="px-3.5 pb-3 pt-3.5">
                <div className={["truncate text-[11px]", t.muted].join(" ")}>
                  {account.email}
                </div>

                <div className="mt-2.5 truncate text-[14px] font-semibold">
                  {account.name}
                </div>

                <div className="mt-2">
                  <div
                    className={[
                      "flex items-center justify-between text-[11px]",
                      t.muted,
                    ].join(" ")}
                  >
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
                      className={[
                        "mt-1.5 h-1 overflow-hidden rounded-full",
                        t.divider,
                      ].join(" ")}
                    >
                      <div
                        className={[
                          "h-full rounded-full",
                          "transition-[width] duration-500 motion-reduce:transition-none",
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
                    "group mt-3 flex w-full items-center justify-center gap-2",
                    "rounded-[10px] border px-3 py-2 text-[12px] font-semibold",
                    "transition-[background-color,border-color,transform] duration-150",
                    "active:scale-[0.98] motion-reduce:transition-none",
                    focus,
                    planFull ? t.accentSolid : t.upgrade,
                  ].join(" ")}
                >
                  <BoltIcon className="h-4 w-4" />
                  {planFull ? "Upgrade to add more channels" : "Upgrade Plan"}
                </button>
              </div>

              {menuGroups.map((group, groupIndex) => (
                <div
                  key={group[0]?.label ?? groupIndex}
                  role="none"
                  className="px-1.5 py-1.5"
                >
                  {group.map((item) => {
                    const Icon = item.icon;
                    menuItemIndex++;
                    const isLogout = item.action === "logout";
                    const isDisabled =
                      Boolean(item.disabled) || (isLogout && loggingOut);

                    return (
                      <button
                        key={item.label}
                        type="button"
                        role="menuitem"
                        disabled={isDisabled}
                        aria-disabled={isDisabled || undefined}
                        onClick={(event) => {
                          if (isLogout) {
                            void handleLogout();
                            return;
                          }

                          setMenuOpen(false);

                          if (event.detail === 0) {
                            triggerRef.current?.focus();
                          }

                          if (item.route) navigate(item.route);
                        }}
                        className={[
                          "group flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2",
                          "text-left text-[12.5px] font-medium",
                          "transition-[background-color,transform] duration-150",
                          "active:scale-[0.98] motion-reduce:transition-none",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          "disabled:hover:bg-transparent disabled:active:scale-100",
                          focus,
                          t.menuItem,
                        ].join(" ")}
                      >
                        <Icon
                          className={[
                            "h-4 w-4 shrink-0 opacity-70 transition-opacity duration-150",
                            "group-hover:opacity-100",
                            t.menuIcon,
                          ].join(" ")}
                        />

                        <span className="flex-1 truncate">
                          {isLogout && loggingOut ? "Logging out..." : item.label}
                        </span>

                        {item.badge && (
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              t.badge,
                            ].join(" ")}
                          >
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

          {/* Profil */}
          <div className={compact ? "" : "min-w-0 flex-1"}>
            <Tip
              label={account.name}
              shortcut={shortcutLabel("p")}
              enabled={compact && !menuOpen}
              menuClass={t.menu}
              countClass={t.count}
            >
              <button
                ref={triggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuOpen ? "account-menu" : undefined}
                aria-keyshortcuts={ariaShortcut("p")}
                aria-label="Open account menu"
                onClick={() => setMenuOpen((value) => !value)}
                className={[
                  "group flex items-center rounded-xl",
                  "transition-[background-color,transform] duration-200",
                  "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
                  compact ? "h-10 w-10 justify-center" : "h-10 w-full gap-2.5 px-1.5",
                  focus,
                  menuOpen ? t.rowOpen : t.row,
                ].join(" ")}
              >
                {showAvatarImage ? (
                  <img
                    key={account.avatarUrl}
                    src={account.avatarUrl}
                    alt="Profile"
                    draggable={false}
                    // Photo de profil : h-8 w-8 (32px), rounded-lg
                    className="h-8 w-8 shrink-0 select-none rounded-lg object-cover"
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : (
                  <span
                    className={[
                      "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg",
                      "text-[11px] font-semibold",
                      t.avatar,
                    ].join(" ")}
                  >
                    {account.initials}
                  </span>
                )}

                {!compact && (
                  <span
                    className={[
                      "sb-fade min-w-0 flex-1 truncate text-left text-[13px] font-medium",
                      t.title,
                    ].join(" ")}
                  >
                    {account.name}
                  </span>
                )}
              </button>
            </Tip>
          </div>
        </div>
      </aside>

      {connectOpen && (
        <ConnectChannelModal
          {...channelConnectProps}
          isDark={isDark}
          onClose={closeConnect}
        />
      )}
    </>
  );
}