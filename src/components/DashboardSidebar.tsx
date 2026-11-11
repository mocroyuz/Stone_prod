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
import { PLAN } from "../data/channelConfig";
import { requestNewPost } from "../services/NewPostBus";
import { fetchYouTubeComments } from "../services/youtube";
import { useMfaNudge } from "../hooks/useMfaNudge";

/* ============================================================================
Language / i18n
============================================================================ */
type Lang = "fr" | "en";
const LANGUAGE_STORAGE_KEY = "stone:language";

function detectLanguage(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  return "en";
}

function useLanguage(): Lang {
  const [lang, setLang] = useState<Lang>(() => detectLanguage());
  useEffect(() => {
    const refresh = () => setLang(detectLanguage());
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    window.addEventListener("hashchange", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("hashchange", refresh);
    };
  }, []);
  return lang;
}

type Copy = {
  nav: {
    home: string;
    publish: string;
    create: string;
    community: string;
    channels: string;
    insights: string;
    integrations: string;
  };
  badges: { new: string; soon: string };
  sections: {
    favorites: string;
    channels: string;
    connectChannels: string;
  };
  menu: {
    settings: string;
    channels: string;
    plansBilling: string;
    helpSupport: string;
    integrations: string;
    betaFeatures: string;
    logout: string;
    loggingOut: string;
  };
  actions: {
    rename: string;
    removeFromFavorite: string;
    newPost: string;
    newPostOn: (channel: string) => string;
    upgradePlan: string;
    upgradeAddMore: string;
    connectChannel: string;
    connectChannelAria: string;
    channelsSettingsAria: string;
    openNav: string;
    closeNav: string;
    expand: string;
    collapse: string;
    expandSidebar: string;
    collapseSidebar: string;
    stoneHome: string;
    openAccountMenu: string;
    accountMenuAria: string;
    channelsUsed: string;
    unreadAria: (channel: string, count: number) => string;
    optionsFor: (name: string) => string;
    renameAria: (name: string) => string;
    nOfMaxChannels: (n: number, max: number) => string;
    nOfMaxChannelsAria: (n: number, max: number) => string;
    nChannels: (n: number) => string;
  };
  plans: {
    starter: string;
    professional: string;
    enterprise: string;
    free: string;
    paid: string;
  };
  aria: { mainNav: string };
};

const COPY: Record<Lang, Copy> = {
  en: {
    nav: {
      home: "Home",
      publish: "Publish",
      create: "Create",
      community: "Community",
      channels: "Channels",
      insights: "Insights",
      integrations: "Integrations",
    },
    badges: { new: "New", soon: "Soon" },
    sections: {
      favorites: "Favorite",
      channels: "Channels",
      connectChannels: "Connect channels",
    },
    menu: {
      settings: "Settings",
      channels: "Channels",
      plansBilling: "Plans and Billing",
      helpSupport: "Help & Support",
      integrations: "Integrations",
      betaFeatures: "Beta Features",
      logout: "Log out",
      loggingOut: "Logging out…",
    },
    actions: {
      rename: "Rename",
      removeFromFavorite: "Remove from Favorite",
      newPost: "New post",
      newPostOn: (channel) => `New post on ${channel}`,
      upgradePlan: "Upgrade Plan",
      upgradeAddMore: "Upgrade to add more channels",
      connectChannel: "Connect a channel",
      connectChannelAria: "Connect a channel",
      channelsSettingsAria: "Channels",
      openNav: "Open navigation",
      closeNav: "Close navigation",
      expand: "Expand",
      collapse: "Collapse",
      expandSidebar: "Expand sidebar",
      collapseSidebar: "Collapse sidebar",
      stoneHome: "Stone, go to Home",
      openAccountMenu: "Open account menu",
      accountMenuAria: "Account menu",
      channelsUsed: "Channels used",
      unreadAria: (channel, count) =>
        `${channel}, ${count} unread ${count === 1 ? "comment" : "comments"}`,
      optionsFor: (name) => `Options for ${name}`,
      renameAria: (name) => `Rename ${name}`,
      nOfMaxChannels: (n, max) => `${n}/${max} channels`,
      nOfMaxChannelsAria: (n, max) => `${n} of ${max} channels`,
      nChannels: (n) => `${n} ${n === 1 ? "channel" : "channels"}`,
    },
    plans: {
      starter: "Starter",
      professional: "Professional",
      enterprise: "Enterprise",
      free: "Free plan",
      paid: "Paid plan",
    },
    aria: { mainNav: "Main" },
  },
  fr: {
    nav: {
      home: "Accueil",
      publish: "Calendar",
      create: "Créer",
      community: "Communauté",
      channels: "Canaux",
      insights: "Insights",
      integrations: "Intégrations",
    },
    badges: { new: "Nouveau", soon: "Bientôt" },
    sections: {
      favorites: "Favoris",
      channels: "Canaux",
      connectChannels: "Connecter des canaux",
    },
    menu: {
      settings: "Paramètres",
      channels: "Canaux",
      plansBilling: "Offres et facturation",
      helpSupport: "Aide et support",
      integrations: "Intégrations",
      betaFeatures: "Fonctionnalités bêta",
      logout: "Déconnexion",
      loggingOut: "Déconnexion…",
    },
    actions: {
      rename: "Renommer",
      removeFromFavorite: "Retirer des favoris",
      newPost: "Nouvelle publication",
      newPostOn: (channel) => `Nouvelle publication sur ${channel}`,
      upgradePlan: "Changez de plan",
      upgradeAddMore: "Changez de plan pour ajouter des canaux",
      connectChannel: "Connecter un canal",
      connectChannelAria: "Connecter un canal",
      channelsSettingsAria: "Canaux",
      openNav: "Ouvrir la navigation",
      closeNav: "Fermer la navigation",
      expand: "Développer",
      collapse: "Réduire",
      expandSidebar: "Développer la barre latérale",
      collapseSidebar: "Réduire la barre latérale",
      stoneHome: "Stone, aller à l'accueil",
      openAccountMenu: "Ouvrir le menu du compte",
      accountMenuAria: "Menu du compte",
      channelsUsed: "Canaux utilisés",
      unreadAria: (channel, count) =>
        `${channel}, ${count} commentaire${count === 1 ? "" : "s"} non lu${
          count === 1 ? "" : "s"
        }`,
      optionsFor: (name) => `Options pour ${name}`,
      renameAria: (name) => `Renommer ${name}`,
      nOfMaxChannels: (n, max) => `${n}/${max} canaux`,
      nOfMaxChannelsAria: (n, max) => `${n} sur ${max} canaux`,
      nChannels: (n) => `${n} ${n <= 1 ? "canal" : "canaux"}`,
    },
    plans: {
      starter: "Débutant",
      professional: "Professionnel",
      enterprise: "Entreprise",
      free: "Plan gratuit",
      paid: "Plan payant",
    },
    aria: { mainNav: "Navigation principale" },
  },
};

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

/* ============================================================================
Dimensions
============================================================================ */
export const SIDEBAR_COLLAPSED_OFFSET = 64;
export const SIDEBAR_EXPANDED_OFFSET = 240;

/* ============================================================================
Notifications : commentaires non lus par canal
============================================================================ */
type UnreadCounts = Record<string, number>;
const EMPTY_UNREAD: UnreadCounts = Object.freeze({}) as UnreadCounts;
const LEGACY_UNREAD_KEY = "stone.unread-counts";

let unreadStore: UnreadCounts = EMPTY_UNREAD;
const unreadListeners = new Set<() => void>();

try {
  if (typeof window !== "undefined")
    window.localStorage.removeItem(LEGACY_UNREAD_KEY);
} catch {}

function emitUnread() {
  unreadListeners.forEach((listener) => listener());
}

export function setChannelUnreadCount(channelKey: string, count: number) {
  const next = Math.max(0, Math.floor(count) || 0);
  if ((unreadStore[channelKey] ?? 0) === next) return;
  const updated = { ...unreadStore };
  if (next > 0) updated[channelKey] = next;
  else delete updated[channelKey];
  unreadStore = updated;
  emitUnread();
}

export function setChannelUnread(channelKey: string, hasUnread: boolean) {
  const existing = unreadStore[channelKey] ?? 0;
  setChannelUnreadCount(channelKey, hasUnread ? Math.max(existing, 1) : 0);
}

function readUnreadSnapshot(): UnreadCounts {
  return unreadStore;
}

function subscribeUnread(listener: () => void) {
  unreadListeners.add(listener);
  return () => {
    unreadListeners.delete(listener);
  };
}

const UNREAD_SETTLE_MS = 350;

function useUnreadCounts(): UnreadCounts {
  const live = useSyncExternalStore(
    subscribeUnread,
    readUnreadSnapshot,
    () => EMPTY_UNREAD
  );
  const [shown, setShown] = useState<UnreadCounts>(live);
  const shownRef = useRef<UnreadCounts>(live);

  useEffect(() => {
    const previous = shownRef.current;
    const apply = () => {
      shownRef.current = live;
      setShown(live);
    };
    const decreased = Object.keys(previous).some(
      (key) => (live[key] ?? 0) < previous[key]
    );
    if (!decreased) {
      apply();
      return;
    }
    const id = window.setTimeout(apply, UNREAD_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [live]);

  return shown;
}

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
@keyframes sbSheetIn {
  from { transform: translateY(100%); opacity: 0.5; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes sbDotPop {
  from { opacity: 0; transform: scale(0.4); }
  to { opacity: 1; transform: scale(1); }
}
.sb-menu { animation: sbMenuIn 160ms cubic-bezier(0.32, 0.72, 0, 1) both; }
.sb-tip { animation: sbTipIn 140ms cubic-bezier(0.32, 0.72, 0, 1) both; }
.sb-fade { animation: sbFadeIn 220ms ease-out both; }
.sb-label { animation: sbLabelIn 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.sb-label-1 { animation-delay: 40ms; }
.sb-label-2 { animation-delay: 70ms; }
.sb-label-3 { animation-delay: 100ms; }
.sb-backdrop { animation: sbFadeIn 200ms ease-out both; }
.sb-sheet { animation: sbSheetIn 340ms cubic-bezier(0.32, 0.72, 0, 1) backwards; }
.sb-dot { animation: sbDotPop 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
#app-sidebar button,
#app-sidebar svg,
#app-sidebar img {
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
@media (prefers-reduced-motion: reduce) {
  .sb-menu, .sb-tip, .sb-fade, .sb-label, .sb-backdrop, .sb-sheet, .sb-dot { animation: none; }
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
Responsive
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
const BookmarkIcon = ({
  className,
  filled = false,
}: IconProps & { filled?: boolean }) => (
  <Svg className={className}>
    <path
      d="M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75V21l-5.75-3.75L6 21V4.75Z"
      fill={filled ? "currentColor" : "none"}
    />
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
const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
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
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </Svg>
);

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
Tooltip
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
const PER_CHANNEL_NAV_ROUTES = new Set(["schedule", "community"]);
const FAVORITABLE_ROUTES = [
  "home",
  "schedule",
  "create",
  "community",
  "channels",
  "insights",
  "integrations",
] as const;

function isValidFavoriteRoute(route: string): boolean {
  return (FAVORITABLE_ROUTES as readonly string[]).includes(route);
}

function buildNavItems(c: Copy): NavItem[] {
  return [
    { label: c.nav.home, icon: HomeIcon, route: "home" },
    { label: c.nav.publish, icon: CalendarIcon, route: "schedule" },
    {
      label: c.nav.create,
      icon: LightbulbIcon,
      route: "create",
      badge: c.badges.new,
    },
    { label: c.nav.community, icon: CommunityIcon, route: "community" },
  ];
}

function buildExtraFavoritable(c: Copy): NavItem[] {
  return [
    { label: c.nav.channels, icon: ChannelsIcon, route: "channels" },
    { label: c.nav.insights, icon: InsightsIcon, route: "insights" },
    { label: c.nav.integrations, icon: AppsIcon, route: "integrations" },
  ];
}

function buildMenuGroups(c: Copy): MenuItem[][] {
  return [
    [
      { label: c.menu.settings, icon: SettingsIcon, route: "settings" },
      { label: c.menu.channels, icon: ChannelsIcon, route: "channels" },
      { label: c.menu.plansBilling, icon: BillingIcon, route: "pricing" },
      { label: c.menu.helpSupport, icon: HelpIcon, route: "faq" },
    ],
    [
      { label: c.menu.integrations, icon: AppsIcon, route: "integrations" },
      {
        label: c.menu.betaFeatures,
        icon: BetaIcon,
        badge: c.badges.soon,
        disabled: true,
      },
    ],
    [{ label: c.menu.logout, icon: LogoutIcon, action: "logout" }],
  ];
}

/* ============================================================================
Favorites storage
============================================================================ */
const FAVORITES_STORAGE_PREFIX = "stone.sidebar.favorites";

function favoritesStorageKey(userId: string | null): string {
  return `${FAVORITES_STORAGE_PREFIX}.${userId ?? "anon"}`;
}

function readStoredFavorites(userId: string | null): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(favoritesStorageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (route): route is string =>
            typeof route === "string" && isValidFavoriteRoute(route)
        )
      : [];
  } catch {
    return [];
  }
}

function writeStoredFavorites(userId: string | null, routes: string[]) {
  try {
    window.localStorage.setItem(favoritesStorageKey(userId), JSON.stringify(routes));
  } catch {}
}

const FAVORITE_NAMES_STORAGE_PREFIX = "stone.sidebar.favorites.names";
const FAVORITE_NAME_MAX = 30;

function favoriteNamesStorageKey(userId: string | null): string {
  return `${FAVORITE_NAMES_STORAGE_PREFIX}.${userId ?? "anon"}`;
}

function readStoredFavoriteNames(userId: string | null): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(favoriteNamesStorageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, string> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([route, name]) => {
      if (
        typeof name === "string" &&
        name.trim() &&
        isValidFavoriteRoute(route)
      ) {
        result[route] = name.trim().slice(0, FAVORITE_NAME_MAX);
      }
    });
    return result;
  } catch {
    return {};
  }
}

function writeStoredFavoriteNames(
  userId: string | null,
  names: Record<string, string>
) {
  try {
    window.localStorage.setItem(
      favoriteNamesStorageKey(userId),
      JSON.stringify(names)
    );
  } catch {}
}

const FAVORITES_OPEN_KEY = "stone.sidebar.favorites.open";

function readFavoritesOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(FAVORITES_OPEN_KEY) !== "false";
  } catch {
    return true;
  }
}

function writeFavoritesOpen(open: boolean) {
  try {
    window.localStorage.setItem(FAVORITES_OPEN_KEY, String(open));
  } catch {}
}

const FAVORITES_EVENT = "stone:favorites-changed";

export function useFavorites() {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const [routes, setRoutes] = useState<string[]>(() => readStoredFavorites(userId));
  const [names, setNames] = useState<Record<string, string>>(() =>
    readStoredFavoriteNames(userId)
  );

  useEffect(() => {
    const sync = () => {
      setRoutes(readStoredFavorites(userId));
      setNames(readStoredFavoriteNames(userId));
    };
    sync();
    window.addEventListener(FAVORITES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [userId]);

  const toggle = useCallback(
    (route: string) => {
      const current = readStoredFavorites(userId);
      const removing = current.includes(route);
      const next = removing
        ? current.filter((r) => r !== route)
        : [...current, route];
      writeStoredFavorites(userId, next);
      setRoutes(next);
      if (removing) {
        const currentNames = readStoredFavoriteNames(userId);
        if (route in currentNames) {
          const { [route]: _removed, ...rest } = currentNames;
          writeStoredFavoriteNames(userId, rest);
          setNames(rest);
        }
      }
      window.dispatchEvent(new Event(FAVORITES_EVENT));
    },
    [userId]
  );

  const rename = useCallback(
    (route: string, name: string) => {
      const trimmed = name.trim().slice(0, FAVORITE_NAME_MAX);
      const next = { ...readStoredFavoriteNames(userId) };
      if (trimmed) next[route] = trimmed;
      else delete next[route];
      writeStoredFavoriteNames(userId, next);
      setNames(next);
      window.dispatchEvent(new Event(FAVORITES_EVENT));
    },
    [userId]
  );

  const isFavorite = useCallback(
    (route: string) => routes.includes(route),
    [routes]
  );

  return { routes, names, isFavorite, toggle, rename };
}

const defaultAccount = {
  name: "Ronan",
  initials: "RN",
  email: "workspace@crew.io",
  organization: "My Organization",
  plan: "Free plan",
  channels: 0,
  avatarUrl: undefined as string | undefined,
};

function formatPlanLabel(
  name: string | null | undefined,
  c: Copy
): string | null {
  const normalized = name?.trim().toLowerCase();
  if (!normalized) return null;
  const labels: Record<string, string> = {
    starter: c.plans.starter,
    pro: c.plans.professional,
    professional: c.plans.professional,
    enterprise: c.plans.enterprise,
    free: c.plans.free,
  };
  return labels[normalized] ?? name?.trim() ?? null;
}

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
      <div className="relative w-full">
        <button
          type="button"
          aria-label={item.label}
          aria-current={isActive ? "page" : undefined}
          aria-keyshortcuts={letter ? ariaShortcut(letter) : undefined}
          onClick={() => onNavigate(item.route)}
          className={[
            "group relative flex items-center rounded-xl text-[13px] max-md:text-[14.5px] font-medium",
            "transition-[background-color,color,transform] duration-200",
            "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
            compact
              ? "h-10 w-10 justify-center"
              : "h-9 max-md:h-11 w-full gap-2.5 max-md:gap-3 px-2.5 max-md:px-3",
            focus,
            isActive ? t.navActive : t.navIdle,
          ].join(" ")}
        >
          <Icon className="h-[18px] w-[18px] max-md:h-5 max-md:w-5 shrink-0" />
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
                    "flex h-[18px] min-w-[18px] max-md:h-5 max-md:min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] max-md:text-[11px] font-semibold leading-none opacity-80",
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
      </div>
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

/**
 * Logos dont la couleur est fixée en noir : ils restent sur un badge blanc,
 * même en dark mode (sinon ils seraient invisibles).
 */
const FIXED_BLACK_ICONS = new Set<IconComponent>([XIcon as IconComponent]);

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
  const qIndex = hash.indexOf("?");
  if (qIndex !== -1) {
    const fromHash = new URLSearchParams(hash.slice(qIndex + 1)).get("channel");
    if (fromHash) return fromHash;
  }
  return new URLSearchParams(window.location.search).get("channel");
}

type ChannelLink = {
  label: string;
  route: string;
  icon: IconComponent;
  badge?: string;
  perChannel?: boolean;
};

function buildChannelLinks(c: Copy): ChannelLink[] {
  return [
    { label: c.nav.publish, route: "schedule", icon: PublishIcon, perChannel: true },
    { label: c.nav.community, route: "community", icon: CommunityIcon, perChannel: true },
    {
      label: c.nav.insights,
      route: "insights",
      icon: InsightsIcon,
      badge: c.badges.new,
      perChannel: true,
    },
  ];
}

function buildStandaloneLinks(c: Copy): ChannelLink[] {
  return [
    {
      label: c.nav.insights,
      route: "insights",
      icon: InsightsIcon,
      badge: c.badges.new,
    },
  ];
}

const CHANNEL_ROUTES = new Set(["insights", "community", "schedule"]);
const formatUnread = (count: number) => (count > 9 ? "9+" : String(count));

function withUnreadBadge<T extends { route: string; badge?: string }>(
  link: T,
  unread: number
): T {
  if (link.route !== "community") return link;
  return { ...link, badge: unread > 0 ? formatUnread(unread) : undefined };
}

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
  } catch {}
}

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

function ChannelAvatar({
  channel,
  NetworkIcon,
  dotRing,
  unreadDot,
  isDark,
  size = "md",
  hasUnread = false,
}: {
  channel: ConnectedChannel;
  NetworkIcon?: IconComponent;
  dotRing: string;
  unreadDot: string;
  isDark: boolean;
  size?: "md" | "lg";
  hasUnread?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [channel.avatarUrl]);

  const label = channel.handle || channel.name;
  const initial = label.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const box =
    size === "lg"
      ? "h-8 w-8 max-md:h-9 max-md:w-9"
      : "h-6 w-6 max-md:h-7 max-md:w-7";
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
          className={["h-full w-full select-none object-cover", radius].join(" ")}
        />
      ) : (
        <span
          className={[
            "flex h-full w-full items-center justify-center bg-neutral-700",
            radius,
            "text-[10px] max-md:text-[11px] font-semibold text-white",
          ].join(" ")}
        >
          {initial}
        </span>
      )}
      {hasUnread && (
        <span
          aria-hidden="true"
          className={[
            "absolute -left-0.5 -top-0.5 h-2.5 w-2.5 max-md:h-3 max-md:w-3 rounded-full ring-2",
            unreadDot,
            dotRing,
          ].join(" ")}
        />
      )}
      {NetworkIcon && (
        <span
          className={[
            "absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 max-md:h-4 max-md:w-4 items-center justify-center overflow-hidden",
            "rounded-[4px] ring-2",
            // Même logique que la section Channels des réglages :
            // badge sombre en dark mode, blanc en light mode.
            isDark && !FIXED_BLACK_ICONS.has(NetworkIcon)
              ? "bg-[#0f0f11] text-white"
              : "bg-white text-black shadow-[0_0_0_1px_rgba(0,0,0,0.12)]",
            dotRing,
          ].join(" ")}
        >
          <NetworkIcon
            mono={isDark ? "white" : "black"}
            className="h-2 w-2"
          />
        </span>
      )}
    </span>
  );
}

const HOVER_CARD_SHOW_MS = 200;
const HOVER_CARD_HIDE_MS = 120;

function ChannelHoverCard({
  channel,
  label,
  NetworkIcon,
  links,
  currentRoute,
  hashChannel,
  firstChannelKey,
  focus,
  t,
  c,
  enabled,
  onNavigate,
  onNewPost,
  children,
  hasUnread,
  isDark,
}: {
  channel: ConnectedChannel;
  label: string;
  NetworkIcon?: IconComponent;
  links: ChannelLink[];
  currentRoute: string;
  hashChannel: string | null;
  firstChannelKey?: string;
  focus: string;
  t: ThemeTokens;
  c: Copy;
  enabled: boolean;
  onNavigate: (route: string) => void;
  onNewPost: (channelKey: string) => void;
  children: ReactNode;
  hasUnread?: boolean;
  isDark: boolean;
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
                unreadDot={t.accent}
                isDark={isDark}
                hasUnread={hasUnread}
              />
              <span
                className={[
                  "min-w-0 flex-1 truncate text-[12.5px] font-semibold",
                  t.title,
                ].join(" ")}
              >
                {label.replace(/^@/, "")}
              </span>
              <button
                type="button"
                role="menuitem"
                title={c.actions.newPost}
                onClick={(e) => {
                  e.stopPropagation();
                  setPos(null);
                  onNewPost(channel.key);
                }}
                className={[
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
                  "hover:bg-black/5 dark:hover:bg-white/10",
                  focus,
                  t.menuIcon,
                ].join(" ")}
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
            <div className={["border-t pt-1", t.menuDivider].join(" ")} />
            <div className="flex flex-col gap-0.5">
              {links.map((link) => {
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
                          "flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-none opacity-80",
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

/* ============================================================================
Favoris
============================================================================ */
const MoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
);
const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m14.5 7.5 3 3" />
  </Svg>
);
const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 7h15M10 11v6M14 11v6" />
    <path d="M6.5 7l.8 11.2A1.8 1.8 0 0 0 9.1 20h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" />
    <path d="M9.5 7V4.8c0-.4.3-.8.8-.8h3.4c.5 0 .8.4.8.8V7" />
  </Svg>
);

const FAVORITE_MENU_WIDTH = 184;

function FavoriteRowImpl({
  item,
  label,
  isActive,
  focus,
  t,
  c,
  onNavigate,
  onRename,
  onRemove,
  badge,
}: {
  item: NavItem;
  label: string;
  isActive: boolean;
  focus: string;
  t: ThemeTokens;
  c: Copy;
  onNavigate: (route: string) => void;
  onRename: (route: string, name: string) => void;
  onRemove: (route: string) => void;
  badge?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const [editing, setEditing] = useState(false);
  const menuOpen = menuPos !== null;

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(
      8,
      Math.min(
        rect.right - FAVORITE_MENU_WIDTH,
        window.innerWidth - FAVORITE_MENU_WIDTH - 8
      )
    );
    setMenuPos({ top: rect.bottom + 6, left });
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      )
        return;
      setMenuPos(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setMenuPos(null);
        triggerRef.current?.focus();
      }
    };
    const dismiss = () => setMenuPos(null);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    const id = requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [menuOpen]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')
    );
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
  };

  const startRename = () => {
    setMenuPos(null);
    cancelRef.current = false;
    setEditing(true);
  };

  const commitRename = (value: string) => {
    setEditing(false);
    const next = value.trim();
    onRename(item.route, next === item.label ? "" : next);
  };

  return (
    <div className="group/fav relative rounded-xl">
      {editing ? (
        <div
          className={[
            "flex h-9 max-md:h-11 w-full items-center gap-2.5 rounded-xl px-2.5 max-md:px-3",
            t.navActive,
          ].join(" ")}
        >
          <BookmarkIcon className="h-[18px] w-[18px] max-md:h-5 max-md:w-5 shrink-0" filled />
          <input
            autoFocus
            defaultValue={label}
            maxLength={FAVORITE_NAME_MAX}
            aria-label={c.actions.renameAria(item.label)}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={(event) => {
              if (cancelRef.current) {
                cancelRef.current = false;
                return;
              }
              commitRename(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cancelRef.current = true;
                setEditing(false);
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-[13px] max-md:text-[14.5px] font-medium outline-none"
          />
        </div>
      ) : (
        <>
          <button
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => onNavigate(item.route)}
            className={[
              "flex h-9 max-md:h-11 w-full items-center gap-2.5 max-md:gap-3 rounded-xl pl-2.5 max-md:pl-3 pr-9 max-md:pr-11 text-[13px] max-md:text-[14.5px] font-medium",
              "transition-[background-color,color,transform] duration-200",
              "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
              focus,
              isActive ? t.navActive : t.navIdle,
            ].join(" ")}
          >
            <BookmarkIcon className="h-[18px] w-[18px] max-md:h-5 max-md:w-5 shrink-0" filled />
            <span className="sb-fade min-w-0 flex-1 truncate text-left">
              {label}
            </span>
            {badge && (
              <span
                className={[
                  "flex h-[18px] min-w-[18px] max-md:h-5 max-md:min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] max-md:text-[11px] font-semibold leading-none opacity-80",
                  t.badge,
                ].join(" ")}
              >
                {badge}
              </span>
            )}
          </button>
          <button
            ref={triggerRef}
            type="button"
            aria-label={c.actions.optionsFor(label)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => (menuOpen ? setMenuPos(null) : openMenu())}
            className={[
              "absolute right-1 top-1/2 z-10 flex h-7 max-md:h-8 w-7 max-md:w-8 -translate-y-1/2 items-center justify-center rounded-lg",
              "transition-[opacity,background-color,color] duration-150 motion-reduce:transition-none",
              "focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
              menuOpen
                ? `opacity-100 ${t.rowOpen}`
                : "opacity-0 group-hover/fav:opacity-100 group-focus-within/fav:opacity-100",
              focus,
              t.menuIcon,
              t.row,
            ].join(" ")}
          >
            <MoreIcon className="h-4 w-4 max-md:h-[18px] max-md:w-[18px]" />
          </button>
        </>
      )}
      {menuPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={c.actions.optionsFor(label)}
            style={{ top: menuPos.top, left: menuPos.left, width: FAVORITE_MENU_WIDTH }}
            onKeyDown={onMenuKeyDown}
            className={["sb-menu fixed z-[70] rounded-2xl border p-1.5", t.menu].join(
              " "
            )}
          >
            <button
              type="button"
              role="menuitem"
              onClick={startRename}
              className={[
                "group flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2",
                "text-left text-[12.5px] font-medium",
                "transition-[background-color,transform] duration-150",
                "active:scale-[0.98] motion-reduce:transition-none",
                focus,
                t.menuItem,
              ].join(" ")}
            >
              <PencilIcon
                className={[
                  "h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100",
                  t.menuIcon,
                ].join(" ")}
              />
              <span className="flex-1 truncate">{c.actions.rename}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuPos(null);
                onRemove(item.route);
              }}
              className={[
                "group flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2",
                "text-left text-[12.5px] font-medium text-rose-500",
                "transition-[background-color,transform] duration-150",
                "active:scale-[0.98] motion-reduce:transition-none",
                focus,
                t.menuItem,
              ].join(" ")}
            >
              <TrashIcon className="h-4 w-4 shrink-0 opacity-80 group-hover:opacity-100" />
              <span className="flex-1 truncate">{c.actions.removeFromFavorite}</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}

const FavoriteRow = memo(FavoriteRowImpl);

function CompactFavoriteImpl({
  item,
  label,
  isActive,
  focus,
  t,
  onNavigate,
  badge,
}: {
  item: NavItem;
  label: string;
  isActive: boolean;
  focus: string;
  t: ThemeTokens;
  onNavigate: (route: string) => void;
  badge?: string;
}) {
  return (
    <Tip label={label} enabled menuClass={t.menu} countClass={t.count}>
      <button
        type="button"
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        onClick={() => onNavigate(item.route)}
        className={[
          "relative flex h-10 w-10 items-center justify-center rounded-xl",
          "transition-[background-color,color,transform] duration-200",
          "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
          focus,
          isActive ? t.navActive : t.navIdle,
        ].join(" ")}
      >
        <BookmarkIcon className="h-[18px] w-[18px] shrink-0" filled />
        {badge && (
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

const CompactFavorite = memo(CompactFavoriteImpl);

function SidebarChannelsImpl({
  channels: rawChannels,
  favorites,
  favoriteNames,
  onRenameFavorite,
  onRemoveFavorite,
  userId,
  isDark,
  compact,
  isMobile,
  currentRoute,
  focus,
  t,
  c,
  onNavigate,
  onExpand,
  onConnect,
  onNewPost,
}: {
  channels: ConnectedChannel[];
  favorites: NavItem[];
  favoriteNames: Record<string, string>;
  onRenameFavorite: (route: string, name: string) => void;
  onRemoveFavorite: (route: string) => void;
  userId: string | null;
  isDark: boolean;
  compact: boolean;
  isMobile: boolean;
  currentRoute: string;
  focus: string;
  t: ThemeTokens;
  c: Copy;
  onNavigate: (route: string) => void;
  onExpand: () => void;
  onConnect: () => void;
  onNewPost: (channelKey: string) => void;
}) {
  const [openKeys, setOpenKeys] = useState<string[]>(channelsMemory.open);

  const LONG_PRESS_MS = 380;
  const suppressClickRef = useRef(false);
  const longPressRef = useRef<{
    timer: number;
    x: number;
    y: number;
  } | null>(null);

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) {
      window.clearTimeout(longPressRef.current.timer);
      longPressRef.current = null;
    }
  }, []);

  useEffect(() => cancelLongPress, [cancelLongPress]);
  useEffect(() => {
    channelsMemory.open = openKeys;
  }, [openKeys]);

  const [favOpen, setFavOpen] = useState<boolean>(readFavoritesOpen);
  const toggleFav = useCallback(() => {
    setFavOpen((previous) => {
      writeFavoritesOpen(!previous);
      return !previous;
    });
  }, []);

  const unreadCounts = useUnreadCounts();
  const totalUnread = Object.values(unreadCounts).reduce(
    (sum, count) => sum + count,
    0
  );
  const favCommunityBadge =
    totalUnread > 0 ? formatUnread(totalUnread) : undefined;

  const [order, setOrder] = useState<string[]>(() => readStoredOrder(userId));
  const [dragKey, setDragKey] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const focusKeyRef = useRef<string | null>(null);
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

  const canReorder = !compact && !isMobile && channels.length > 1;

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

  const dragCleanupRef = useRef<((cancel?: boolean) => void) | null>(null);

  const moveLive = useCallback((clientY: number) => {
    const fromKey = dragKeyRef.current;
    const list = listRef.current;
    if (!fromKey || !list) return;
    const currentKeys = channelsRef.current.map((channel) => channel.key);
    const others = currentKeys.filter((key) => key !== fromKey);
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

  const startDrag = (
    wrapper: HTMLElement,
    key: string,
    startX: number,
    startY: number,
    immediate: boolean
  ) => {
    const row = wrapper.firstElementChild as HTMLElement | null;
    if (!row) return;
    dragCleanupRef.current?.(true);
    const rect = row.getBoundingClientRect();
    const offY = startY - rect.top;
    const originalOrder = channelsRef.current.map((channel) => channel.key);
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    const g = { el: null as HTMLElement | null };

    const createGhost = () => {
      const ghost = row.cloneNode(true) as HTMLElement;
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
      const plus = ghost.querySelector<HTMLElement>("[data-new-post]");
      if (plus) plus.style.display = "none";
      document.body.appendChild(ghost);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      g.el = ghost;
      dragKeyRef.current = key;
      liveOrderRef.current = null;
      setDragKey(key);
    };

    const onMove = (ev: PointerEvent) => {
      if (!g.el) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        createGhost();
      }
      if (!g.el) return;
      g.el.style.top = `${ev.clientY - offY}px`;
      const nav = listRef.current?.closest("nav");
      if (nav) {
        const nr = nav.getBoundingClientRect();
        if (ev.clientY > nr.bottom - 40) nav.scrollTop += 10;
        else if (ev.clientY < nr.top + 40) nav.scrollTop -= 10;
      }
      moveLive(ev.clientY);
    };

    const onTouchMove = (ev: TouchEvent) => {
      if (g.el) ev.preventDefault();
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") finish(true);
    };

    const finish = (cancel = false) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchmove", onTouchMove);
      g.el?.remove();
      g.el = null;
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
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 120);
    };

    const onUp = () => finish(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    dragCleanupRef.current = finish;
    if (immediate) createGhost();
  };

  const onHandlePointerDown = (event: React.PointerEvent, key: string) => {
    if (!canReorder) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const wrapper = (event.currentTarget as HTMLElement).closest<HTMLElement>(
      "[data-channel-key]"
    );
    if (!wrapper) return;
    event.preventDefault();
    startDrag(wrapper, key, event.clientX, event.clientY, false);
  };

  const onRowPointerDown = (event: React.PointerEvent, key: string) => {
    if (!canReorder || event.pointerType === "mouse") return;
    const target = event.currentTarget as HTMLElement;
    const wrapper = target.closest<HTMLElement>("[data-channel-key]");
    if (!wrapper) return;
    cancelLongPress();
    const x = event.clientX;
    const y = event.clientY;
    const pointerId = event.pointerId;
    const timer = window.setTimeout(() => {
      longPressRef.current = null;
      suppressClickRef.current = true;
      try {
        target.releasePointerCapture?.(pointerId);
      } catch {
        /* ignore */
      }
      navigator.vibrate?.(12);
      startDrag(wrapper, key, x, y, true);
    }, LONG_PRESS_MS);
    longPressRef.current = { timer, x, y };
  };

  const onRowPointerMove = (event: React.PointerEvent) => {
    const lp = longPressRef.current;
    if (!lp) return;
    if (Math.hypot(event.clientX - lp.x, event.clientY - lp.y) > 8) {
      cancelLongPress();
    }
  };

  useEffect(() => {
    if (!canReorder) dragCleanupRef.current?.(true);
  }, [canReorder]);
  useEffect(() => () => dragCleanupRef.current?.(true), []);

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
      if (!reduce && orderChanged && prev !== undefined && prev !== top) {
        el.style.transition = "none";
        el.style.transform = `translateY(${prev - top}px)`;
        el.getBoundingClientRect();
        el.style.transition =
          "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)";
        el.style.transform = "";
        el.addEventListener("transitionend", () => (el.style.transition = ""), {
          once: true,
        });
      }
    });
    prevTops.current = next;
    prevOrderKey.current = orderKey;
  });

  const hashChannel = CHANNEL_ROUTES.has(currentRoute) ? getHashChannel() : null;

  const toggleKey = (key: string) =>
    setOpenKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  const openKey = (key: string) =>
    setOpenKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));

  const standaloneLinks = useMemo(() => buildStandaloneLinks(c), [c]);
  const channelLinksBase = useMemo(() => buildChannelLinks(c), [c]);

  return (
    <div
      ref={listRef}
      className={[
        "relative flex flex-col gap-1",
        compact ? "w-full items-center" : "",
      ].join(" ")}
    >
      {favorites.length > 0 && (
        <>
          {compact ? (
            <>
              <div
                className={["mx-auto mb-1 mt-2 h-px w-8", t.divider].join(" ")}
              />
              {favorites.map((item) => (
                <CompactFavorite
                  key={item.route}
                  item={item}
                  label={favoriteNames[item.route] ?? item.label}
                  isActive={item.route === currentRoute}
                  focus={focus}
                  t={t}
                  onNavigate={onNavigate}
                  badge={
                    item.route === "community" ? favCommunityBadge : undefined
                  }
                />
              ))}
            </>
          ) : (
            <>
              <button
                type="button"
                aria-expanded={favOpen}
                aria-controls="sidebar-favorites"
                onClick={toggleFav}
                className={[
                  "sb-fade group/fav-head mt-3 flex h-6 max-md:h-7 w-full items-center gap-1 rounded-lg px-2.5 max-md:px-3",
                  "text-left text-[12px] max-md:text-[13px] font-medium transition-colors duration-150 motion-reduce:transition-none",
                  focus,
                  t.muted,
                  "hover:opacity-80",
                ].join(" ")}
              >
                <span>{c.sections.favorites}</span>
                <ChevronDownIcon
                  className={[
                    "h-3 w-3 max-md:h-3.5 max-md:w-3.5 shrink-0",
                    "transition-transform duration-300 motion-reduce:transition-none",
                    favOpen ? "rotate-0" : "-rotate-90",
                  ].join(" ")}
                />
              </button>
              <div
                id="sidebar-favorites"
                {...(favOpen ? {} : ({ inert: "" } as Record<string, unknown>))}
                className={[
                  "grid transition-[grid-template-rows] duration-300",
                  "ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
                  favOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                ].join(" ")}
              >
                <div className="overflow-hidden">
                  <div className="flex flex-col gap-1">
                    {favorites.map((item) => (
                      <FavoriteRow
                        key={item.route}
                        item={item}
                        label={favoriteNames[item.route] ?? item.label}
                        isActive={item.route === currentRoute}
                        focus={focus}
                        t={t}
                        c={c}
                        onNavigate={onNavigate}
                        onRename={onRenameFavorite}
                        onRemove={onRemoveFavorite}
                        badge={
                          item.route === "community"
                            ? favCommunityBadge
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {channels.length === 0 &&
        standaloneLinks.map((rawLink) => {
          const link = withUnreadBadge(rawLink, totalUnread);
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
                  "group relative flex items-center rounded-xl text-[13px] max-md:text-[14.5px] font-medium",
                  "transition-[background-color,color,transform] duration-200",
                  "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
                  compact
                    ? "h-10 w-10 justify-center"
                    : "h-9 max-md:h-11 w-full gap-2.5 max-md:gap-3 px-2.5 max-md:px-3",
                  focus,
                  isActive ? t.navActive : t.navIdle,
                ].join(" ")}
              >
                <Icon className="h-[18px] w-[18px] max-md:h-5 max-md:w-5 shrink-0" />
                {!compact && (
                  <>
                    <span className="sb-fade flex-1 truncate text-left">
                      {link.label}
                    </span>
                    {link.badge && (
                      <span
                        className={[
                          "flex h-[18px] min-w-[18px] max-md:h-5 max-md:min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] max-md:text-[11px] font-semibold leading-none opacity-80",
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

      {compact && (
        <div className={["my-2 h-px w-8 mx-auto", t.divider].join(" ")} />
      )}

      {!compact && (
        <div className="sb-fade group/channels mt-3 flex h-6 max-md:h-7 items-center justify-between px-2.5 max-md:px-3">
          <span className={["text-[12px] max-md:text-[13px] font-medium", t.muted].join(" ")}>
            {channels.length === 0
              ? c.sections.connectChannels
              : c.sections.channels}
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
              aria-label={c.actions.channelsSettingsAria}
              onClick={() => onNavigate("channels")}
              className={[
                "flex h-6 max-md:h-7 w-6 max-md:w-7 items-center justify-center rounded-lg",
                "transition-colors duration-150 motion-reduce:transition-none",
                focus,
                t.menuIcon,
                t.row,
              ].join(" ")}
            >
              <SettingsIcon className="h-[15px] w-[15px] max-md:h-4 max-md:w-4" />
            </button>
            <button
              type="button"
              aria-label={c.actions.connectChannelAria}
              onClick={onConnect}
              className={[
                "flex h-6 max-md:h-7 w-6 max-md:w-7 items-center justify-center rounded-lg",
                "transition-colors duration-150 motion-reduce:transition-none",
                focus,
                t.menuIcon,
                t.row,
              ].join(" ")}
            >
              <PlusIcon className="h-[15px] w-[15px] max-md:h-4 max-md:w-4" />
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
        const unreadCount = unreadCounts[channel.key] ?? 0;
        const hasUnread = unreadCount > 0;
        const channelLinks = channelLinksBase.map((link) =>
          withUnreadBadge(link, unreadCount)
        );

        return (
          <div
            key={channel.key}
            data-channel-key={channel.key}
            className="flex w-full flex-col"
          >
            <div
              className={[
                "group/row relative rounded-xl",
                "transition-[opacity,background-color] duration-150 motion-reduce:transition-none",
                canReorder ? t.row : "",
                isDragging ? `${t.rowOpen} [&>*]:invisible` : "",
              ].join(" ")}
            >
              {canReorder && (
                <span
                  aria-hidden="true"
                  data-grip
                  onPointerDown={(event) =>
                    onHandlePointerDown(event, channel.key)
                  }
                  className={[
                    "absolute left-[1px] top-1/2 z-10 flex h-7 w-3 -translate-y-1/2",
                    "touch-none cursor-grab items-center justify-center rounded active:cursor-grabbing",
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
              {!compact && (
                <button
                  type="button"
                  data-new-post
                  title={c.actions.newPostOn(cleanLabel)}
                  aria-label={c.actions.newPostOn(cleanLabel)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onNewPost(channel.key);
                  }}
                  className={[
                    "absolute right-2 max-md:right-2.5 top-1/2 z-10 flex h-6 max-md:h-7 w-6 max-md:w-7 -translate-y-1/2 items-center justify-center rounded-lg",
                    "opacity-0 transition-[opacity,background-color,color,transform] duration-150",
                    "active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100",
                    "group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100",
                    "[@media(hover:none)]:opacity-100",
                    focus,
                    t.rowOpen,
                    t.menuIcon,
                  ].join(" ")}
                >
                  <PlusIcon className="h-[15px] w-[15px] max-md:h-4 max-md:w-4" />
                </button>
              )}
              <ChannelHoverCard
                channel={channel}
                label={label}
                NetworkIcon={NetworkIcon}
                links={channelLinks}
                currentRoute={currentRoute}
                hashChannel={hashChannel}
                firstChannelKey={channels[0]?.key}
                focus={focus}
                t={t}
                c={c}
                enabled={compact}
                onNavigate={onNavigate}
                onNewPost={onNewPost}
                hasUnread={hasUnread}
                isDark={isDark}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup={compact ? "menu" : undefined}
                  aria-label={
                    hasUnread
                      ? c.actions.unreadAria(cleanLabel, unreadCount)
                      : cleanLabel
                  }
                  aria-keyshortcuts={
                    canReorder ? "Alt+ArrowUp Alt+ArrowDown" : undefined
                  }
                  onKeyDown={(event) => {
                    if (!canReorder || !event.altKey) return;
                    if (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                      return;
                    event.preventDefault();
                    shiftChannel(
                      channel.key,
                      event.key === "ArrowUp" ? -1 : 1
                    );
                  }}
                  onPointerDown={(event) =>
                    onRowPointerDown(event, channel.key)
                  }
                  onPointerMove={onRowPointerMove}
                  onPointerUp={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  onContextMenu={(event) => {
                    if (canReorder) event.preventDefault();
                  }}
                  onClick={() => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      return;
                    }
                    if (compact) {
                      onExpand();
                      openKey(groupKey);
                    } else {
                      toggleKey(groupKey);
                    }
                  }}
                  className={[
                    "select-none [-webkit-touch-callout:none]",
                    "group relative flex items-center rounded-xl text-[13px] max-md:text-[14.5px] font-medium",
                    "transition-[background-color,color,transform,padding] duration-200",
                    "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
                    compact
                      ? "h-10 w-10 justify-center"
                      : "h-9 max-md:h-11 w-full gap-2.5 max-md:gap-3 px-2.5 max-md:px-3",
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
                    unreadDot={t.accent}
                    isDark={isDark}
                    size={compact ? "lg" : "md"}
                    hasUnread={hasUnread}
                  />
                  {!compact && (
                    <>
                      <span
                        className={[
                          "sb-fade min-w-0 flex-1 truncate text-left",
                          isMobile
                            ? "pr-9"
                            : "pr-0 group-hover/row:pr-8 group-focus-within/row:pr-8",
                        ].join(" ")}
                      >
                        {cleanLabel}
                      </span>
                      {!isMobile && (
                        <ChevronDownIcon
                          className={[
                            "h-3.5 w-3.5 shrink-0 opacity-60",
                            "transition-transform duration-300 motion-reduce:transition-none",
                            isOpen ? "rotate-0" : "-rotate-90",
                          ].join(" ")}
                        />
                      )}
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
                      "ml-[20px] max-md:ml-[24px] mt-1 flex flex-col gap-0.5 max-md:gap-1 border-l pl-2.5 max-md:pl-3",
                      t.rail,
                    ].join(" ")}
                  >
                    {channelLinks.map((link) => {
                      const Icon = link.icon;
                      const target = link.perChannel
                        ? `${link.route}?channel=${encodeURIComponent(
                            channel.key
                          )}`
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
                            "group flex h-8 max-md:h-10 w-full items-center gap-2.5 max-md:gap-3 whitespace-nowrap",
                            "rounded-lg px-2 max-md:px-2.5 text-left text-[12.5px] max-md:text-[14px] font-medium",
                            "transition-colors duration-150 motion-reduce:transition-none",
                            focus,
                            active ? t.subActive : t.sub,
                          ].join(" ")}
                        >
                          <Icon className="h-4 w-4 max-md:h-[18px] max-md:w-[18px] shrink-0 opacity-70 group-hover:opacity-100" />
                          <span className="flex-1">{link.label}</span>
                          {link.badge && (
                            <span
                              className={[
                                "flex h-[18px] min-w-[18px] max-md:h-5 max-md:min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] max-md:text-[11px] font-semibold leading-none opacity-80",
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

const sidebarMemory = { collapsed: readStoredCollapsed() };
const userProfileCache = { profile: null as UserProfile | null };
const sidebarListeners = new Set<() => void>();

function setSidebarCollapsed(value: boolean) {
  if (sidebarMemory.collapsed === value) return;
  sidebarMemory.collapsed = value;
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
  } catch {}
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
  unreadStore = EMPTY_UNREAD;
  emitUnread();
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
Recalcul des non-lus à l'ouverture
============================================================================ */
const UNREAD_POLL_MS = 60_000;
const UNREAD_MAX_PAGES = 3;

function useUnreadSync(channels: ConnectedChannel[]) {
  const youtubeKey = useMemo(
    () =>
      channels.find((c) => c.key.toLowerCase().startsWith("youtube"))?.key ??
      null,
    [channels]
  );

  useEffect(() => {
    if (!youtubeKey) return;
    let cancelled = false;
    let busy = false;
    let lastRefreshAt = 0;

    const refresh = async () => {
      if (busy || document.hidden) return;
      busy = true;
      lastRefreshAt = Date.now();
      try {
        let total = 0;
        let pageToken: string | null = null;
        for (let page = 0; page < UNREAD_MAX_PAGES; page++) {
          const r = await fetchYouTubeComments({
            filter: "unread",
            videoId: null,
            ...(pageToken ? { pageToken } : {}),
          });
          if (cancelled) return;
          const list = Array.isArray(r?.comments) ? r.comments : [];
          total += list.filter((c) => !c.is_read && !c.is_own).length;
          pageToken = r?.next_page_token ?? null;
          if (!pageToken) break;
        }
        setChannelUnreadCount(youtubeKey, total);
      } catch {
        /* silencieux */
      } finally {
        busy = false;
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, UNREAD_POLL_MS);
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastRefreshAt >= 30_000) {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [youtubeKey]);
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
  const lang = useLanguage();
  const c = COPY[lang];
  const currentRoute = useHashRoute();
  const connectedChannels = useConnectedChannels();
  useUnreadSync(connectedChannels);
  const isMobile = useIsMobile();
  const { show: showMfaNudge } = useMfaNudge();

  const unreadCounts = useUnreadCounts();
  const totalUnread = Object.values(unreadCounts).reduce(
    (sum, count) => sum + count,
    0
  );
  const communityNavBadge =
    totalUnread > 0 ? formatUnread(totalUnread) : undefined;

  const hasChannels = connectedChannels.length > 0;
  const navItems = useMemo(() => buildNavItems(c), [c]);
  const extraFavoritable = useMemo(() => buildExtraFavoritable(c), [c]);
  const favoritableItems = useMemo(
    () => [...navItems, ...extraFavoritable],
    [navItems, extraFavoritable]
  );
  const menuGroups = useMemo(() => buildMenuGroups(c), [c]);

  const visibleNavItems = useMemo(() => {
    const base = hasChannels
      ? navItems.filter((item) => !PER_CHANNEL_NAV_ROUTES.has(item.route))
      : navItems;
    return base.map((item) =>
      item.route === "community"
        ? { ...item, badge: communityNavBadge }
        : item
    );
  }, [hasChannels, navItems, communityNavBadge]);

  const { user } = useUser();
  const { subscription, hasActive: hasActiveSubscription } = useSubscription();
  const userId = user?.id ?? null;

  const {
    routes: favoriteRoutes,
    names: favoriteNames,
    toggle: toggleFavoriteRoute,
    rename: renameFavorite,
  } = useFavorites();

  const favoriteItems = useMemo(
    () => favoritableItems.filter((item) => favoriteRoutes.includes(item.route)),
    [favoritableItems, favoriteRoutes]
  );

  const [isCollapsed, setIsCollapsed] = useState(sidebarMemory.collapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(
    userProfileCache.profile
  );
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const compact = isMobile ? false : isCollapsed;
  const drawerHidden = isMobile && !mobileOpen;

  const profileRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetDragRef = useRef<{
    startY: number;
    pointerId: number;
    active: boolean;
    height: number;
    samples: Array<{ y: number; t: number }>;
    velocity: number;
  } | null>(null);
  const sheetOffsetRef = useRef(0);
  const sheetClosingRef = useRef(false);
  const [sheetOffset, setSheetOffset] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);

  const updateSheetOffset = (value: number) => {
    sheetOffsetRef.current = value;
    setSheetOffset(value);
  };

  useEffect(() => {
    if (menuOpen) {
      sheetClosingRef.current = false;
      updateSheetOffset(0);
    }
  }, [menuOpen]);

  const closeSheetAnimated = useCallback(() => {
    sheetClosingRef.current = true;
    const height = sheetRef.current?.offsetHeight ?? 400;
    updateSheetOffset(height);
    window.setTimeout(() => {
      setMenuOpen(false);
      updateSheetOffset(0);
      sheetClosingRef.current = false;
    }, 240);
  }, []);

  const onSheetPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const height = sheetRef.current?.offsetHeight ?? 400;
    sheetDragRef.current = {
      startY: event.clientY,
      pointerId: event.pointerId,
      active: false,
      height,
      samples: [],
      velocity: 0,
    };
  };

  const onSheetPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = sheetDragRef.current;
    if (!drag) return;
    const dy = event.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dy) < 6) return;
      drag.active = true;
      event.currentTarget.setPointerCapture(drag.pointerId);
      setSheetDragging(true);
    }
    const now = performance.now();
    drag.samples.push({ y: event.clientY, t: now });
    if (drag.samples.length > 6) drag.samples.shift();
    if (drag.samples.length >= 2) {
      const oldest = drag.samples[0];
      const newest = drag.samples[drag.samples.length - 1];
      drag.velocity = (newest.y - oldest.y) / Math.max(1, newest.t - oldest.t);
    }
    updateSheetOffset(Math.max(0, dy));
  };

  const endSheetDrag = () => {
    const drag = sheetDragRef.current;
    sheetDragRef.current = null;
    if (!drag?.active) return;
    setSheetDragging(false);
    const shouldClose =
      sheetOffsetRef.current > drag.height * 0.3 || drag.velocity > 0.8;
    if (shouldClose) closeSheetAnimated();
    else updateSheetOffset(0);
  };

  const backdropOpacity =
    sheetOffset > 0
      ? Math.max(0.08, 1 - sheetOffset / (sheetRef.current?.offsetHeight ?? 400))
      : undefined;

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
    setSidebarCollapsed(isCollapsed);
  }, [isCollapsed]);

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
      if (event.key === "Escape" && !menuOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, menuOpen]);

  useEffect(() => {
    if (!isMobile || !menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSheetAnimated();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobile, menuOpen, closeSheetAnimated]);

  useEffect(() => {
    if (!menuOpen || isMobile) return;
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
  }, [menuOpen, isMobile]);

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
            menu:
              "border-white/[0.08] bg-[#101011] text-[#e9e9e5] shadow-[0_18px_40px_rgba(0,0,0,0.7)]",
            menuDivider: "border-white/[0.07]",
            menuItem:
              "text-[#dcdcd8] hover:bg-[#1c1c1f] focus-visible:bg-[#1c1c1f]",
            menuIcon: "text-[#969a9a] hover:text-white",
            upgrade:
              "border-white/[0.08] bg-white/[0.03] text-[#e9e9e5] hover:border-white/15 hover:bg-[#1c1c1f]",
            badge: "bg-white text-black",
            accent: "bg-white",
            accentSolid:
              "border-transparent bg-white text-black hover:bg-white/90",
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
            menu:
              "border-black/10 bg-white text-[#1a1a1a] shadow-[0_18px_40px_rgba(0,0,0,0.12)]",
            menuDivider: "border-black/[0.07]",
            menuItem:
              "text-[#1f1f1e] hover:bg-[#e8e8e4] focus-visible:bg-[#e8e8e4]",
            menuIcon: "text-[#6b6a67] hover:text-[#151515]",
            upgrade:
              "border-black/10 bg-[#f6f5f3] text-[#1a1a1a] hover:border-black/20 hover:bg-[#e8e8e4]",
            badge: "bg-black text-white",
            accent: "bg-black",
            accentSolid:
              "border-transparent bg-black text-white hover:bg-black/85",
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
    setMenuOpen(false);
    setMobileOpen(false);
    if (route === "channels") {
      navigate("settings/channels");
      return;
    }
    navigate(route);
  }, []);

  const handleNewPost = useCallback((channelKey: string) => {
    (document.activeElement as HTMLElement | null)?.blur();
    setMenuOpen(false);
    setMobileOpen(false);
    const handled = requestNewPost(channelKey);
    if (!handled) navigate("schedule");
  }, []);

  const openSettingsChannels = useCallback(
    () => handleNavigate("channels"),
    [handleNavigate]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (isTypingTarget(event.target)) return;
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
        handleNavigate(route);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNavigate]);

  const handleExpand = useCallback(() => setIsCollapsed(false), []);

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
  const hasLivePlan =
    hasActiveSubscription || subscription?.status === "past_due";
  const accountPlan = hasLivePlan
    ? formatPlanLabel(
        subscription?.plan_name ?? subscription?.plan ?? subscription?.plan_key,
        c
      ) ?? c.plans.paid
    : c.plans.free;

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

  const inertProps = drawerHidden
    ? ({ inert: "" } as Record<string, unknown>)
    : {};

  return (
    <>
      <style>{SIDEBAR_KEYFRAMES}</style>

      {/* ------------------------------------------------------------------
      MOBILE : barre du haut (hamburger / croix + logo Stone + point 2FA)
      ------------------------------------------------------------------ */}
      {isMobile && (
        <header
          className={[
            "fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 px-3",
            t.aside,
          ].join(" ")}
        >
          <button
            type="button"
            aria-label={
              mobileOpen
                ? c.actions.closeNav
                : showMfaNudge
                  ? `${c.actions.openNav} · 2FA`
                  : c.actions.openNav
            }
            aria-controls="app-sidebar"
            aria-expanded={mobileOpen}
            onClick={() => {
              setMenuOpen(false);
              setMobileOpen((value) => !value);
            }}
            className={[
              "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              "transition-[background-color,transform] duration-200 active:scale-[0.94] motion-reduce:transition-none",
              focus,
              t.menuIcon,
              mobileOpen ? t.rowOpen : t.row,
            ].join(" ")}
          >
            {mobileOpen ? (
              <CloseIcon className="h-6 w-6" />
            ) : (
              <MenuIcon className="h-6 w-6" />
            )}
            {!mobileOpen && showMfaNudge && (
              <span
                aria-hidden="true"
                title="2FA"
                className={[
                  "sb-dot pointer-events-none absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2",
                  t.dotRing,
                ].join(" ")}
              />
            )}
          </button>
          <button
            type="button"
            aria-label={c.actions.stoneHome}
            onClick={() => handleNavigate("home")}
            className={[
              "flex h-11 items-center gap-2 rounded-xl px-1.5",
              "transition-transform duration-200 active:scale-[0.97] motion-reduce:transition-none",
              focus,
              t.title,
            ].join(" ")}
          >
            <img
              src={isDark ? "/images/icon_nav.png" : "/images/icon.png"}
              alt=""
              draggable={false}
              className="h-9 w-8 shrink-0 select-none object-contain"
            />
            <span className="select-none text-[19px] font-semibold leading-none tracking-tight">
              Stone
            </span>
          </button>
        </header>
      )}

      {/* ------------------------------------------------------------------
      MOBILE : bottom sheet du compte — drag-to-dismiss smooth
      ------------------------------------------------------------------ */}
      {isMobile && menuOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={() => closeSheetAnimated()}
            className="sb-backdrop fixed inset-0 z-[55] bg-black/50"
            style={{
              opacity: backdropOpacity,
              transition: sheetDragging ? "none" : "opacity 220ms ease-out",
            }}
          />
          <div
            ref={sheetRef}
            id="mobile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={c.actions.accountMenuAria}
            style={{
              transform:
                sheetOffset > 0 ? `translateY(${sheetOffset}px)` : undefined,
              transition: sheetDragging
                ? "none"
                : sheetClosingRef.current
                  ? "transform 240ms cubic-bezier(0.4, 0, 1, 1)"
                  : "transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              willChange: sheetDragging ? "transform" : undefined,
            }}
            className={[
              "sb-sheet fixed inset-x-0 bottom-0 z-[60] max-h-[88dvh] overflow-y-auto",
              "rounded-t-3xl border-t pb-[max(12px,env(safe-area-inset-bottom))]",
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "overscroll-contain",
              t.menu,
            ].join(" ")}
          >
            <div
              onPointerDown={onSheetPointerDown}
              onPointerMove={onSheetPointerMove}
              onPointerUp={endSheetDrag}
              onPointerCancel={endSheetDrag}
              className="touch-none"
            >
              <div className="flex justify-center pb-2 pt-3">
                <span
                  className={["h-1.5 w-10 rounded-full", t.divider].join(" ")}
                />
              </div>
              <div className="px-5 pb-4 pt-1">
                <div className={["truncate text-[13.5px]", t.muted].join(" ")}>
                  {account.email}
                </div>
                <div className="mt-3 truncate text-[17px] font-semibold">
                  {account.organization}
                </div>
                <div className={["mt-0.5 text-[13.5px]", t.muted].join(" ")}>
                  {account.plan} · {c.actions.nChannels(account.channels)}
                </div>
                <button
                  type="button"
                  onClick={() => handleNavigate("pricing")}
                  className={[
                    "mt-4 flex h-12 w-full items-center justify-center gap-2",
                    "rounded-xl border text-[15px] font-semibold",
                    "transition-[background-color,transform] duration-150 active:scale-[0.98]",
                    focus,
                    planFull ? t.accentSolid : t.upgrade,
                  ].join(" ")}
                >
                  <BoltIcon className="h-[18px] w-[18px]" />
                  {planFull
                    ? c.actions.upgradeAddMore
                    : c.actions.upgradePlan}
                </button>
              </div>
            </div>
            {menuGroups.map((group, groupIndex) => (
              <div
                key={group[0]?.label ?? groupIndex}
                className={["border-t px-2.5 py-2.5", t.menuDivider].join(" ")}
              >
                {group.map((item) => {
                  const Icon = item.icon;
                  const isLogout = item.action === "logout";
                  const isDisabled =
                    Boolean(item.disabled) || (isLogout && loggingOut);
                  const isActive = item.route === currentRoute;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isLogout) {
                          void handleLogout();
                          return;
                        }
                        if (item.route) handleNavigate(item.route);
                      }}
                      className={[
                        "flex h-12 w-full items-center gap-3.5 rounded-xl px-3.5",
                        "text-left text-[15px] font-medium",
                        "transition-[background-color,transform] duration-150 active:scale-[0.98]",
                        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
                        focus,
                        isActive ? t.rowOpen : t.menuItem,
                      ].join(" ")}
                    >
                      <Icon
                        className={[
                          "h-5 w-5 shrink-0 opacity-80",
                          t.menuIcon,
                        ].join(" ")}
                      />
                      <span className="flex-1 truncate">
                        {isLogout && loggingOut
                          ? c.menu.loggingOut
                          : item.label}
                      </span>
                      {item.badge && (
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[12px] font-semibold opacity-80",
                            t.badge,
                          ].join(" ")}
                        >
                          {item.badge}
                        </span>
                      )}
                      {item.route === "settings" && showMfaNudge && (
                        <span
                          aria-label="2FA"
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ------------------------------------------------------------------
      SIDEBAR : desktop = colonne fixe, mobile = panneau plein écran
      ------------------------------------------------------------------ */}
      <aside
        id="app-sidebar"
        {...inertProps}
        className={[
          "fixed flex flex-col",
          isMobile
            ? "inset-x-0 bottom-0 top-14 z-40 border-t"
            : "inset-y-0 left-0 z-20 border-r border-transparent",
          "transition-[width,transform,opacity] duration-[380ms]",
          "ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          t.aside,
          isMobile ? t.rail : "",
          isMobile
            ? drawerHidden
              ? "pointer-events-none translate-y-2 opacity-0"
              : "translate-y-0 opacity-100"
            : "translate-x-0",
          isMobile ? "" : compact ? "w-[64px]" : "w-[240px]",
        ].join(" ")}
      >
        {!isMobile && (
          <button
            type="button"
            aria-label={c.actions.stoneHome}
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
        )}

        <nav
          aria-label={c.aria.mainNav}
          className={[
            "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden pb-3",
            isMobile ? "pt-3" : "pt-4",
            compact ? "items-center px-3" : "px-2 max-md:px-2.5",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-contain",
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
            favorites={favoriteItems}
            favoriteNames={favoriteNames}
            onRenameFavorite={renameFavorite}
            onRemoveFavorite={toggleFavoriteRoute}
            userId={userId}
            isDark={isDark}
            compact={compact}
            isMobile={isMobile}
            currentRoute={currentRoute}
            focus={focus}
            t={t}
            c={c}
            onNavigate={handleNavigate}
            onExpand={handleExpand}
            onConnect={openSettingsChannels}
            onNewPost={handleNewPost}
          />
        </nav>

        <div
          ref={profileRef}
          className={[
            "relative shrink-0 py-2.5",
            compact
              ? "flex flex-col items-center gap-2"
              : "flex items-center gap-1.5 max-md:gap-2 px-2 max-md:px-2.5",
            isMobile ? "pb-[max(10px,env(safe-area-inset-bottom))]" : "",
          ].join(" ")}
        >
          {!isMobile && (
            <button
              type="button"
              aria-expanded={!compact}
              aria-controls="app-sidebar"
              aria-keyshortcuts="Control+B Meta+B"
              aria-label={
                isCollapsed
                  ? c.actions.expandSidebar
                  : c.actions.collapseSidebar
              }
              title={`${
                compact ? c.actions.expand : c.actions.collapse
              } (${TOGGLE_SHORTCUT_LABEL})`}
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
              <SidebarToggleIcon
                className="h-[18px] w-[18px]"
                open={!compact}
              />
            </button>
          )}

          {menuOpen && !isMobile && (
            <div
              ref={menuRef}
              id="account-menu"
              role="menu"
              aria-label={c.actions.accountMenuAria}
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
                        ? c.actions.nOfMaxChannels(account.channels, planMax)
                        : c.actions.nChannels(account.channels)}
                    </span>
                  </div>
                  {planMax > 0 && (
                    <div
                      role="progressbar"
                      aria-label={c.actions.channelsUsed}
                      aria-valuemin={0}
                      aria-valuemax={planMax}
                      aria-valuenow={Math.min(account.channels, planMax)}
                      aria-valuetext={c.actions.nOfMaxChannelsAria(
                        account.channels,
                        planMax
                      )}
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
                  {planFull ? c.actions.upgradeAddMore : c.actions.upgradePlan}
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
                          {isLogout && loggingOut
                            ? c.menu.loggingOut
                            : item.label}
                        </span>
                        {item.badge && (
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold opacity-80",
                              t.badge,
                            ].join(" ")}
                          >
                            {item.badge}
                          </span>
                        )}
                        {item.route === "settings" && showMfaNudge && (
                          <span
                            aria-label="2FA"
                            className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

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
                aria-haspopup={isMobile ? "dialog" : "menu"}
                aria-expanded={menuOpen}
                aria-controls={
                  menuOpen
                    ? isMobile
                      ? "mobile-sheet"
                      : "account-menu"
                    : undefined
                }
                aria-keyshortcuts={ariaShortcut("p")}
                aria-label={c.actions.openAccountMenu}
                onClick={() => setMenuOpen((value) => !value)}
                className={[
                  "group flex items-center rounded-xl",
                  "transition-[background-color,transform] duration-200",
                  "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
                  compact
                    ? "h-10 w-10 justify-center"
                    : "h-10 max-md:h-12 w-full gap-2.5 max-md:gap-3 px-1.5 max-md:px-2",
                  focus,
                  menuOpen ? t.rowOpen : t.row,
                ].join(" ")}
              >
                <span className="relative flex shrink-0">
                  {showAvatarImage ? (
                    <img
                      key={account.avatarUrl}
                      src={account.avatarUrl}
                      alt="Profile"
                      draggable={false}
                      className="h-8 w-8 max-md:h-10 max-md:w-10 shrink-0 select-none rounded-lg max-md:rounded-xl object-cover"
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : (
                    <span
                      className={[
                        "flex h-8 w-8 max-md:h-10 max-md:w-10 shrink-0 select-none items-center justify-center rounded-lg max-md:rounded-xl",
                        "text-[11px] max-md:text-[13px] font-semibold",
                        t.avatar,
                      ].join(" ")}
                    >
                      {account.initials}
                    </span>
                  )}
                  {showMfaNudge && (
                    <span
                      aria-hidden="true"
                      className={[
                        "absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2",
                        t.dotRing,
                      ].join(" ")}
                    />
                  )}
                </span>
                {!compact && (
                  <span
                    className={[
                      "sb-fade min-w-0 flex-1 truncate text-left text-[13px] max-md:text-[14.5px] font-medium",
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
    </>
  );
}