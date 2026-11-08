import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  CalendarDays,
  CalendarOff,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Plus,
  SlidersHorizontal,
  Tag as TagLucide,
  Trash2,
  X,
} from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { useHashRoute } from "../hooks/useHashRoute";
import DashboardSidebar, {
  useSidebarOffset,
  useFavorites,
} from "../components/DashboardSidebar";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import NewPostModal, {
  type NewPostPayload,
  type SocialNetworkId,
} from "../components/Newpostmodal";
import { DateTimePicker } from "../components/DateTimePicker";
import { CalendarPicker } from "../components/CalendarPicker";
import ChannelMenu from "../components/ChannelMenu";
import { useConnectedChannels } from "../hooks/useConnectedChannels";
import HelpChatButton from "../components/Helpchatbutton";

import {
  createPosts,
  listPosts,
  tagHex,
  isPostPosted,
  updatePostSchedule,
  type CalendarPost,
} from "../services/posts";
import {
  ensureDefaultTags,
  listTags,
  type Tag as ApiTag,
} from "../services/supabase";
import {
  XIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
  YouTubeIcon,
  PinterestIcon,
  ThreadsIcon,
} from "../components/IntegrationIcons";

/* ------------------------------------------------------------------ */
/* Language / i18n                                                     */
/* ------------------------------------------------------------------ */

type Lang = "fr" | "en";

const LANGUAGE_STORAGE_KEY = "stone:language";
const LANGUAGE_CHANGED_EVENT = "stone:language-changed";

function detectLanguage(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* stockage indisponible */
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
    window.addEventListener(LANGUAGE_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("hashchange", refresh);
      window.removeEventListener(LANGUAGE_CHANGED_EVENT, refresh);
    };
  }, []);

  return lang;
}

const intlLocale = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-GB");

/* ------------------------------------------------------------------ */
/* Responsive                                                          */
/* ------------------------------------------------------------------ */

const MOBILE_QUERY = "(max-width: 767px)";

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

type Scope = "all" | "published" | "toPublish";
type View = "3days" | "week" | "month";

type Copy = {
  pageTitle: string;
  header: { addFavorite: string; removeFavorite: string; newPost: string };
  toolbar: {
    prev: string;
    next: string;
    today: string;
    threeDays: string;
    week: string;
    month: string;
    scopeLabels: Record<Scope, string>;
    tags: string;
    filters: string;
    noDate: string;
    moreOptions: string;
    addEvent: string;
    calendar: string;
    openCalendar: string;
  };
  weekdaysLong: string[];
  addPostTooltip: string;
  moreRow: (n: number) => string;
  eventCard: {
    untitled: string;
    options: (title: string) => string;
    edit: string;
    delete: string;
    confirmed: string;
  };
  eventForm: {
    editTitle: string;
    createTitle: string;
    titleLabel: string;
    titlePlaceholder: string;
    datetimeLabel: string;
    tagLabel: string;
    unassigned: string;
    cancel: string;
    save: string;
    create: string;
    validation: string;
  };
  dayModal: { close: string };
  offScreen: {
    above: (time: string) => string;
    below: (time: string) => string;
  };
  timezoneLabels: Record<string, string>;
};

const COPY: Record<Lang, Copy> = {
  en: {
    pageTitle: "Publish",
    header: {
      addFavorite: "Add to favorites",
      removeFavorite: "Remove from favorites",
      newPost: "New post",
    },
    toolbar: {
      prev: "Previous",
      next: "Next",
      today: "Today",
      threeDays: "3 Days",
      week: "Week",
      month: "Month",
      scopeLabels: {
        all: "All Posts",
        published: "Published",
        toPublish: "To publish",
      },
      tags: "Tags",
      filters: "Filters",
      noDate: "No Date",
      moreOptions: "More options",
      addEvent: "Add event",
      calendar: "Calendar",
      openCalendar: "Open calendar",
    },
    weekdaysLong: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
    addPostTooltip: "Add a post",
    moreRow: (n) => `${n} More`,
    eventCard: {
      untitled: "Untitled",
      options: (title) => `Options ${title}`,
      edit: "Edit",
      delete: "Delete",
      confirmed: "Confirmed",
    },
    eventForm: {
      editTitle: "Edit event",
      createTitle: "New event",
      titleLabel: "Title",
      titlePlaceholder: "Event title",
      datetimeLabel: "Date and time",
      tagLabel: "Tag",
      unassigned: "Unassigned",
      cancel: "Cancel",
      save: "Save",
      create: "Create",
      validation: "Enter a title and an end time later than the start time.",
    },
    dayModal: { close: "Close" },
    offScreen: {
      above: (time) => `Post above at ${time} — click to go there`,
      below: (time) => `Post below at ${time} — click to go there`,
    },
    timezoneLabels: {
      Paris: "Paris",
      London: "London",
      "New York": "New York",
      Tokyo: "Tokyo",
    },
  },
  fr: {
    pageTitle: "Publier",
    header: {
      addFavorite: "Ajouter aux favoris",
      removeFavorite: "Retirer des favoris",
      newPost: "Nouveau post",
    },
    toolbar: {
      prev: "Précédent",
      next: "Suivant",
      today: "Aujourd'hui",
      threeDays: "3 jours",
      week: "Semaine",
      month: "Mois",
      scopeLabels: {
        all: "Tous les posts",
        published: "Publié",
        toPublish: "À publier",
      },
      tags: "Tags",
      filters: "Filtres",
      noDate: "Sans date",
      moreOptions: "Plus d'options",
      addEvent: "Ajouter un événement",
      calendar: "Calendrier",
      openCalendar: "Ouvrir le calendrier",
    },
    weekdaysLong: [
      "Dimanche",
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
    ],
    addPostTooltip: "Ajouter un post",
    moreRow: (n) => `${n} de plus`,
    eventCard: {
      untitled: "Sans titre",
      options: (title) => `Options ${title}`,
      edit: "Modifier",
      delete: "Supprimer",
      confirmed: "Confirmé",
    },
    eventForm: {
      editTitle: "Modifier l'événement",
      createTitle: "Nouvel événement",
      titleLabel: "Titre",
      titlePlaceholder: "Titre de l'événement",
      datetimeLabel: "Date et heure",
      tagLabel: "Tag",
      unassigned: "Sans tag",
      cancel: "Annuler",
      save: "Enregistrer",
      create: "Créer",
      validation:
        "Renseigne un titre et une heure de fin postérieure à l'heure de début.",
    },
    dayModal: { close: "Fermer" },
    offScreen: {
      above: (time) => `Post au-dessus à ${time} — cliquer pour y aller`,
      below: (time) => `Post en-dessous à ${time} — cliquer pour y aller`,
    },
    timezoneLabels: {
      Paris: "Paris",
      London: "Londres",
      "New York": "New York",
      Tokyo: "Tokyo",
    },
  },
};

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

const pageBgClass = (isDark: boolean) =>
  isDark ? "bg-[#050505]" : "bg-[#f5f3ef]";

const mainPanelClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#0a0a0c]"
    : "border-black/[0.06] bg-white";

const mutedClass = (isDark: boolean) =>
  isDark ? "text-neutral-500" : "text-neutral-400";

const strongClass = (isDark: boolean) =>
  isDark ? "text-white" : "text-neutral-900";

const focusRingClass = (isDark: boolean) =>
  isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

const PAGE_ROUTE = "schedule";

function useHashChannel(): string | null {
  useHashRoute();
  return new URLSearchParams(window.location.search).get("channel");
}

/* ------------------------------------------------------------------ */
/* Tags                                                                */
/* ------------------------------------------------------------------ */

const UNASSIGNED = "unassigned";

const UNASSIGNED_TAG: ApiTag = {
  id: UNASSIGNED,
  label: "Unassigned",
  color: "bg-neutral-400",
};

const UNASSIGNED_HEX = "#a3a3a3";
const DEFAULT_ORDER = ["to do", "in progress"];

const hexOf = (t: ApiTag) =>
  t.id === UNASSIGNED ? UNASSIGNED_HEX : tagHex(t.color);

const passesTagFilter = (
  ids: string[] | undefined | null,
  hidden: string[]
) => {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return !hidden.includes(UNASSIGNED);
  }
  return ids.some((id) => !hidden.includes(id));
};

/* ------------------------------------------------------------------ */
/* Toolbar primitives                                                  */
/* ------------------------------------------------------------------ */

type ToolbarPanel = "view" | "posts" | "tags" | "timezone" | "more" | "filters";

function ToolbarButton({
  isDark,
  icon,
  open = false,
  active = false,
  chevron = true,
  onClick,
  children,
}: {
  isDark: boolean;
  icon?: ReactNode;
  open?: boolean;
  active?: boolean;
  chevron?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const highlighted = open || active;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={chevron ? open : undefined}
      aria-pressed={chevron ? undefined : active}
      className={[
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition",
        focusRingClass(isDark),
        highlighted
          ? isDark
            ? "bg-white/[0.08] text-white"
            : "bg-black/[0.05] text-neutral-900"
          : isDark
            ? "text-neutral-300 hover:bg-white/[0.05]"
            : "text-neutral-700 hover:bg-black/[0.04]",
      ].join(" ")}
    >
      {icon}
      {children}
      {chevron && (
        <span
          className={[
            "flex transition-transform duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
        >
          <ChevronDown className="h-[13px] w-[13px]" />
        </span>
      )}
    </button>
  );
}

function ToolbarIconButton({
  isDark,
  label,
  open,
  onClick,
  children,
}: {
  isDark: boolean;
  label: string;
  open?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      onClick={onClick}
      className={[
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition md:h-8 md:w-8",
        focusRingClass(isDark),
        open
          ? isDark
            ? "bg-white/[0.08] text-white"
            : "bg-black/[0.05] text-neutral-900"
          : isDark
            ? "text-neutral-300 hover:bg-white/[0.05] hover:text-white"
            : "text-neutral-500 hover:bg-black/[0.04] hover:text-neutral-900",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function MenuPanel({
  isDark,
  align = "left",
  width = "w-48",
  children,
}: {
  isDark: boolean;
  align?: "left" | "right";
  width?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="menu"
      className={[
        "absolute top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border py-1.5 shadow-lg",
        align === "right" ? "right-0" : "left-0",
        width,
        isDark
          ? "border-white/[0.08] bg-[#101012]"
          : "border-black/[0.06] bg-white",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function MenuItem({
  isDark,
  selected = false,
  icon,
  onClick,
  children,
}: {
  isDark: boolean;
  selected?: boolean;
  icon?: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={[
        "flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-[13px] transition md:py-2 md:text-[12.5px]",
        selected
          ? isDark
            ? "font-semibold text-white"
            : "font-semibold text-neutral-900"
          : isDark
            ? "text-neutral-300 hover:bg-white/[0.05]"
            : "text-neutral-600 hover:bg-black/[0.03]",
      ].join(" ")}
    >
      <span className="flex items-center gap-2">
        {icon}
        {children}
      </span>
      {selected && <Check className="h-[11px] w-[11px]" strokeWidth={2.6} />}
    </button>
  );
}

const Divider = ({ isDark }: { isDark: boolean }) => (
  <div
    className={[
      "my-1 h-px",
      isDark ? "bg-white/[0.07]" : "bg-black/[0.06]",
    ].join(" ")}
  />
);

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

const TIME_ANCHOR = new Date(2024, 0, 1);

function hourToDate(h: number): Date {
  const d = new Date(TIME_ANCHOR);
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  d.setHours(hh, mm, 0, 0);
  return d;
}

const dateToHour = (d: Date) => d.getHours() + d.getMinutes() / 60;

/* ------------------------------------------------------------------ */
/* Data + layout constants                                             */
/* ------------------------------------------------------------------ */

type CalendarEvent = {
  id: string;
  day: number;
  dateStr?: string;
  start: number;
  end: number;
  title: string;
  tagId?: string;
  channelKey?: string;
  confirmed?: boolean;
  published?: boolean;
};

const START_HOUR = 0;
const END_HOUR = 24;
const SPAN = END_HOUR - START_HOUR;

const HOUR_HEIGHT = 72;
const TOTAL_HEIGHT = SPAN * HOUR_HEIGHT;
const DEFAULT_SCROLL_HOUR = 8;
const NOW_CONTEXT_HOURS = 2;
const HOURS = Array.from({ length: SPAN + 1 }, (_, i) => START_HOUR + i);

const TIME_COL = 48;

const MONTH_ITEM_H = 22;
const MONTH_GAP = 2;
const MONTH_CELL_PAD = 4;
const MONTH_CELL_HEADER = 20;

const POST_CHIP_H = 30;
const POST_THUMB = 22;
const WEEK_CHIP_H = 30;
const WEEK_THUMB = 22;

function fitCount(heights: number[], avail: number) {
  const needed = (n: number) =>
    heights.slice(0, n).reduce((sum, h) => sum + h, 0) +
    MONTH_GAP * Math.max(0, n - 1);

  if (needed(heights.length) <= avail) return heights.length;

  let k = 0;
  while (
    k < heights.length &&
    needed(k + 1) + MONTH_GAP + MONTH_ITEM_H <= avail
  )
    k++;
  return k;
}

function slotVisibleCount(total: number) {
  return fitCount(
    Array.from({ length: total }, () => WEEK_CHIP_H),
    HOUR_HEIGHT - MONTH_CELL_PAD * 2
  );
}

function formatTime(h: number, lang: Lang) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return lang === "fr"
    ? `${hh}h${String(mm).padStart(2, "0")}`
    : `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

const formatEventTime = (start: number, end: number, lang: Lang) =>
  `${formatTime(start, lang)} - ${formatTime(end, lang)}`;

function formatPostTime(iso: string, lang: Lang) {
  try {
    return new Date(iso).toLocaleTimeString(intlLocale(lang), {
      hour: "numeric",
      minute: "2-digit",
      hour12: lang === "en",
    });
  } catch {
    return "--:--";
  }
}

const TIMEZONES = ["Paris", "London", "New York", "Tokyo"];

const NEUTRAL_STYLE = {
  bgLight: "bg-neutral-100",
  bgDark: "bg-neutral-800",
  borderLight: "border-neutral-200",
  borderDark: "border-neutral-700",
};

type PositionedEvent = { event: CalendarEvent; depth: number };

function layoutDayEvents(events: CalendarEvent[]): PositionedEvent[] {
  if (!events || events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: PositionedEvent[] = [];
  let i = 0;
  while (i < sorted.length) {
    let maxEnd = sorted[i].end;
    let j = i + 1;
    while (j < sorted.length && sorted[j].start < maxEnd) {
      maxEnd = Math.max(maxEnd, sorted[j].end);
      j++;
    }
    for (let k = i; k < j; k++) result.push({ event: sorted[k], depth: k - i });
    i = j;
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Posts                                                               */
/* ------------------------------------------------------------------ */

type NetIcon = (props: { className?: string }) => ReactNode;

const NETWORK_ICONS: Record<SocialNetworkId, NetIcon> = {
  x: XIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  pinterest: PinterestIcon,
  threads: ThreadsIcon as unknown as NetIcon,
};

function networkOf(post: CalendarPost): SocialNetworkId {
  const key = post.network as SocialNetworkId;
  return key && NETWORK_ICONS[key] ? key : "x";
}

const postChipBg = (isDark: boolean, posted: boolean, dragging = false) =>
  [
    isDark
      ? "bg-white/[0.09] hover:bg-white/[0.14]"
      : "bg-neutral-100 hover:bg-neutral-200/70",
    posted ? "opacity-60 grayscale" : "",
    dragging ? "opacity-40" : "",
  ].join(" ");

function NetworkBadge({
  network,
  isDark,
  size = 20,
}: {
  network: SocialNetworkId;
  isDark: boolean;
  size?: number;
}) {
  const Icon = NETWORK_ICONS[network] || XIcon;
  return (
    <span
      className={[
        "flex shrink-0 items-center justify-center rounded-md",
        isDark ? "bg-[#e4e4e7] text-[#111]" : "bg-neutral-900 text-white",
      ].join(" ")}
      style={{ width: size, height: size }}
    >
      <Icon
        className={
          size <= 16
            ? "h-[10px] w-[10px]"
            : size <= 20
              ? "h-[11px] w-[11px]"
              : size >= 26
                ? "h-[14px] w-[14px]"
                : "h-3 w-3"
        }
      />
    </span>
  );
}

function PostThumb({
  post,
  isDark,
  size = 12,
}: {
  post: CalendarPost;
  isDark: boolean;
  size?: number;
}) {
  const cover = post.media?.[0];
  if (!cover) return null;
  return (
    <div
      className={[
        "relative shrink-0 overflow-hidden rounded-md",
        isDark ? "bg-white/[0.14]" : "bg-neutral-300",
      ].join(" ")}
      style={{ width: size, height: size }}
    >
      {cover.kind === "image" ? (
        <img
          src={cover.url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <video
            src={`${cover.url}#t=0.1`}
            preload="metadata"
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <svg
              viewBox="0 0 24 24"
              className={
                size >= 40 ? "h-4 w-4 text-white" : "h-3 w-3 text-white"
              }
              fill="currentColor"
            >
              <path d="M7 4v16l13-8z" />
            </svg>
          </span>
        </>
      )}
    </div>
  );
}

const POST_TITLE_KEYS = [
  "title",
  "videoTitle",
  "caption",
  "content",
  "text",
  "description",
];

function postTitle(post: CalendarPost): string {
  const data = post as unknown as Record<string, unknown>;
  for (const key of POST_TITLE_KEYS) {
    const value = data[key];
    if (typeof value === "string" && value.trim())
      return value.trim().split("\n")[0];
  }
  return "";
}

function MoreRow({
  count,
  isDark,
  c,
  onClick,
}: {
  count: number;
  isDark: boolean;
  c: Copy;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex shrink-0 items-center justify-end gap-1 rounded-md px-1.5 text-[11px] font-semibold transition-colors",
        focusRingClass(isDark),
        isDark
          ? "text-neutral-300 hover:bg-white/[0.06] hover:text-white"
          : "text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-900",
      ].join(" ")}
      style={{ height: MONTH_ITEM_H }}
    >
      <ChevronDown className="h-[11px] w-[11px]" />
      {c.moreRow(count)}
    </button>
  );
}

function PostSlot({
  hour,
  posts,
  renderChip,
  isDark,
  c,
  onMore,
}: {
  hour: number;
  posts: CalendarPost[];
  renderChip: (post: CalendarPost) => ReactNode;
  isDark: boolean;
  c: Copy;
  onMore: () => void;
}) {
  const shown = slotVisibleCount(posts.length);
  const hidden = posts.length - shown;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 flex flex-col overflow-hidden"
      style={{
        top: (hour - START_HOUR) * HOUR_HEIGHT,
        height: HOUR_HEIGHT,
        padding: MONTH_CELL_PAD,
        gap: MONTH_GAP,
        zIndex: 2,
      }}
    >
      {posts.slice(0, shown).map((post) => (
        <div key={post.id} className="pointer-events-auto flex flex-col">
          {renderChip(post)}
        </div>
      ))}
      {hidden > 0 && (
        <div className="pointer-events-auto flex flex-col">
          <MoreRow count={hidden} isDark={isDark} c={c} onClick={onMore} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Off-screen posts                                                    */
/* ------------------------------------------------------------------ */

type OffScreenPost = { post: CalendarPost; dayIndex: number; top: number };

function OffScreenPostStack({
  items,
  direction,
  isDark,
  c,
  lang,
  onSelect,
  bottomOffset = "bottom-24",
}: {
  items: OffScreenPost[];
  direction: "up" | "down";
  isDark: boolean;
  c: Copy;
  lang: Lang;
  onSelect: (item: OffScreenPost) => void;
  bottomOffset?: string;
}) {
  if (items.length === 0) return null;

  const shown = items.slice(0, 2);
  const remaining = items.length - shown.length;

  return (
    <div
      className={[
        "pointer-events-none absolute left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5",
        direction === "up" ? "top-2" : bottomOffset,
      ].join(" ")}
    >
      {shown.map((item) => {
        const time = formatPostTime(item.post.scheduledAt, lang);
        const title = postTitle(item.post);
        const hasMedia = Boolean(item.post.media?.[0]);
        return (
          <button
            key={item.post.id}
            type="button"
            onClick={() => onSelect(item)}
            title={title ? `${time} · ${title}` : time}
            aria-label={
              direction === "up"
                ? c.offScreen.above(time)
                : c.offScreen.below(time)
            }
            className={[
              "pointer-events-auto flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 shadow-lg backdrop-blur-md transition hover:scale-[1.03] active:scale-100",
              focusRingClass(isDark),
              isDark
                ? "border-white/[0.10] bg-[#101012]/90 text-white"
                : "border-black/[0.06] bg-white/95 text-neutral-800",
            ].join(" ")}
          >
            {hasMedia ? (
              <PostThumb post={item.post} isDark={isDark} size={24} />
            ) : (
              <NetworkBadge
                network={networkOf(item.post)}
                isDark={isDark}
                size={24}
              />
            )}
            <span className="text-[11.5px] font-semibold tabular-nums">
              {time}
            </span>
            <span className={isDark ? "text-neutral-400" : "text-neutral-500"}>
              {direction === "up" ? (
                <ArrowUp className="h-3 w-3" strokeWidth={2.4} />
              ) : (
                <ArrowDown className="h-3 w-3" strokeWidth={2.4} />
              )}
            </span>
          </button>
        );
      })}
      {remaining > 0 && (
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
            isDark ? "bg-white/15 text-white" : "bg-black/10 text-neutral-700",
          ].join(" ")}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chips                                                               */
/* ------------------------------------------------------------------ */

function PostChip({
  post,
  isDark,
  posted,
  dragging,
  lang,
  large = false,
  onDragStart,
  onDragEnd,
}: {
  post: CalendarPost;
  isDark: boolean;
  posted: boolean;
  dragging: boolean;
  lang: Lang;
  large?: boolean;
  onDragStart: (e: React.DragEvent, postId: string) => void;
  onDragEnd: () => void;
}) {
  const time = formatPostTime(post.scheduledAt, lang);
  const title = postTitle(post);

  return (
    <div
      draggable={!posted}
      onDragStart={(e) => onDragStart(e, post.id)}
      onDragEnd={onDragEnd}
      title={title ? `${time} · ${title}` : time}
      className={[
        "flex shrink-0 items-center transition-colors",
        large ? "gap-1.5 rounded-lg px-1.5 md:gap-2 md:px-2" : "gap-1.5 rounded-md px-1.5",
        postChipBg(isDark, posted, dragging),
        posted ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
      ].join(" ")}
      style={{ height: large ? WEEK_CHIP_H : POST_CHIP_H }}
    >
      <NetworkBadge
        network={networkOf(post)}
        isDark={isDark}
        size={large ? 22 : 18}
      />
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 leading-none">
        <span
          className={[
            "truncate font-semibold tabular-nums",
            large ? "text-[11.5px]" : "text-[10.5px]",
            isDark ? "text-neutral-200" : "text-neutral-700",
          ].join(" ")}
        >
          {time}
        </span>
        {title && (
          <span
            className={[
              "truncate font-medium",
              large ? "text-[10.5px]" : "text-[10px]",
              isDark ? "text-neutral-400" : "text-neutral-500",
            ].join(" ")}
          >
            {title}
          </span>
        )}
      </span>
      <PostThumb
        post={post}
        isDark={isDark}
        size={large ? WEEK_THUMB : POST_THUMB}
      />
    </div>
  );
}

function MonthEventChip({
  event,
  tag,
  isDark,
  lang,
  c,
}: {
  event: CalendarEvent;
  tag?: ApiTag;
  isDark: boolean;
  lang: Lang;
  c: Copy;
}) {
  const hex = tag ? hexOf(tag) : isDark ? "#525252" : "#a3a3a3";
  return (
    <div
      className={[
        "flex shrink-0 flex-col justify-center overflow-hidden rounded-md border-l-[3px] px-1.5 leading-tight",
        !tag &&
          (isDark
            ? "bg-neutral-800 text-neutral-200"
            : "bg-neutral-100 text-neutral-700"),
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        height: MONTH_ITEM_H,
        borderColor: hex,
        ...(tag
          ? {
              backgroundColor: `${hex}${isDark ? "26" : "1f"}`,
              color: isDark ? "#fff" : "#171717",
            }
          : {}),
      }}
    >
      <span className="truncate text-[10px] font-semibold">
        {event.title || c.eventCard.untitled}
      </span>
      <span className="truncate text-[8.5px] tabular-nums opacity-70">
        {formatTime(event.start, lang)}
      </span>
    </div>
  );
}

type MonthItem =
  | { kind: "event"; id: string; start: number; event: CalendarEvent }
  | { kind: "post"; id: string; start: number; post: CalendarPost };

/* ------------------------------------------------------------------ */
/* Modals                                                              */
/* ------------------------------------------------------------------ */

function useEscape(onEscape: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onEscape]);
}

function DayDetailModal({
  isDark,
  title,
  items,
  renderItem,
  onClose,
  c,
}: {
  isDark: boolean;
  title: string;
  items: MonthItem[];
  renderItem: (item: MonthItem) => ReactNode;
  onClose: () => void;
  c: Copy;
}) {
  useEscape(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={[
          "relative z-10 flex max-h-[80vh] w-full max-w-sm flex-col rounded-2xl border p-4 shadow-2xl",
          isDark
            ? "border-white/[0.08] bg-[#101012]"
            : "border-black/[0.06] bg-white",
        ].join(" ")}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            className={[
              "text-[15px] font-semibold tracking-[-0.02em]",
              strongClass(isDark),
            ].join(" ")}
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label={c.dayModal.close}
            onClick={onClose}
            className={[
              "flex h-8 w-8 items-center justify-center rounded-lg transition",
              focusRingClass(isDark),
              isDark
                ? "text-neutral-400 hover:bg-white/[0.06] hover:text-white"
                : "text-neutral-500 hover:bg-black/[0.04] hover:text-neutral-900",
            ].join(" ")}
          >
            <X className="h-[15px] w-[15px]" />
          </button>
        </div>
        <div className="flex flex-col gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col">
              {renderItem(item)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Feuille de sélection de date : bottom sheet (mobile) / dialogue centré (desktop). */
function CalendarSheet({
  isDark,
  c,
  view,
  date,
  onViewChange,
  onPick,
  onToday,
  onClose,
}: {
  isDark: boolean;
  c: Copy;
  view: View;
  date: Date;
  onViewChange: (v: View) => void;
  onPick: (d: Date) => void;
  onToday: () => void;
  onClose: () => void;
}) {
  useEscape(onClose);

  const options: { key: View; label: string }[] = [
    { key: "3days", label: c.toolbar.threeDays },
    { key: "week", label: c.toolbar.week },
    { key: "month", label: c.toolbar.month },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={c.toolbar.calendar}
        className={[
          "relative z-10 flex max-h-[92dvh] w-full flex-col overflow-y-auto border p-4 shadow-2xl",
          "rounded-t-3xl pb-[calc(1rem+env(safe-area-inset-bottom))]",
          "md:max-w-sm md:rounded-2xl md:pb-4",
          isDark
            ? "border-white/[0.08] bg-[#101012]"
            : "border-black/[0.06] bg-[#f6f4f0]",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto mb-3 h-1 w-10 shrink-0 rounded-full md:hidden",
            isDark ? "bg-white/20" : "bg-black/15",
          ].join(" ")}
        />
        <h2
          className={[
            "mb-4 text-center text-[17px] font-semibold tracking-[-0.02em]",
            strongClass(isDark),
          ].join(" ")}
        >
          {c.toolbar.calendar}
        </h2>

        <div
          role="tablist"
          className={[
            "mb-3 grid grid-cols-3 gap-1 rounded-2xl border p-1",
            isDark
              ? "border-white/[0.08] bg-white/[0.03]"
              : "border-black/[0.08] bg-white",
          ].join(" ")}
        >
          {options.map((o) => {
            const active = view === o.key;
            return (
              <button
                key={o.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onViewChange(o.key)}
                className={[
                  "rounded-xl py-2.5 text-[14px] font-medium transition",
                  focusRingClass(isDark),
                  active
                    ? isDark
                      ? "bg-white text-neutral-900"
                      : "bg-neutral-900 text-white"
                    : isDark
                      ? "text-neutral-300 hover:bg-white/[0.06]"
                      : "text-neutral-700 hover:bg-black/[0.04]",
                ].join(" ")}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        <CalendarPicker
          value={date}
          onChange={onPick}
          onClose={onClose}
          isDark={isDark}
          disablePast={false}
        />

        <button
          type="button"
          onClick={() => {
            onToday();
            onClose();
          }}
          className={[
            "mt-3 flex items-center gap-2 rounded-xl px-3 py-3 text-[15px] font-medium transition",
            focusRingClass(isDark),
            isDark
              ? "text-white hover:bg-white/[0.06]"
              : "text-neutral-900 hover:bg-black/[0.04]",
          ].join(" ")}
        >
          <CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.8} />
          {c.toolbar.today}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared input styling                                                */
/* ------------------------------------------------------------------ */

function fieldClass(isDark: boolean) {
  return [
    "w-full rounded-[10px] border px-3 py-2 text-[13px] outline-none transition",
    isDark
      ? "border-white/[0.08] bg-white/[0.04] text-white placeholder:text-neutral-500 focus:border-white/25"
      : "border-black/[0.08] bg-neutral-50 text-neutral-900 placeholder:text-neutral-400 focus:border-black/20",
  ].join(" ");
}

/* ------------------------------------------------------------------ */
/* Event card                                                          */
/* ------------------------------------------------------------------ */

type EventCardProps = {
  event: CalendarEvent;
  tag?: ApiTag;
  depth: number;
  isDark: boolean;
  lang: Lang;
  c: Copy;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function EventCard({
  event,
  tag,
  depth,
  isDark,
  lang,
  c,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onEdit,
  onDelete,
}: EventCardProps) {
  const hex = tag ? hexOf(tag) : null;
  const top = (event.start - START_HOUR) * HOUR_HEIGHT;
  const height = Math.max(34, (event.end - event.start) * HOUR_HEIGHT - 4);

  const [hovered, setHovered] = useState(false);
  const isFront = hovered || menuOpen;
  const zIndex = isFront ? 50 : depth + 1;

  const menuBtn = (danger: boolean) =>
    [
      "flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] transition",
      danger
        ? isDark
          ? "text-rose-300 hover:bg-white/[0.05]"
          : "text-rose-600 hover:bg-black/[0.03]"
        : isDark
          ? "text-neutral-200 hover:bg-white/[0.05]"
          : "text-neutral-700 hover:bg-black/[0.03]",
    ].join(" ");

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        "absolute inset-x-1 flex flex-col gap-1 rounded-lg border px-2 py-1.5 transition-[box-shadow]",
        isFront ? "shadow-lg" : "",
        !tag && (isDark ? NEUTRAL_STYLE.bgDark : NEUTRAL_STYLE.bgLight),
        !tag && (isDark ? NEUTRAL_STYLE.borderDark : NEUTRAL_STYLE.borderLight),
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        top,
        height,
        minHeight: 34,
        zIndex,
        ...(hex
          ? {
              backgroundColor: `${hex}${isDark ? "33" : "26"}`,
              borderColor: `${hex}66`,
            }
          : {}),
      }}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p
            className={[
              "truncate text-[12px] font-semibold",
              isDark ? "text-neutral-100" : "text-neutral-800",
            ].join(" ")}
          >
            {event.title || c.eventCard.untitled}
          </p>
          <p
            className={[
              "mt-0.5 truncate text-[10px]",
              isDark ? "text-neutral-400" : "text-neutral-500",
            ].join(" ")}
          >
            {formatEventTime(event.start, event.end, lang)}
          </p>
        </div>

        <div className="relative shrink-0" data-event-menu>
          <button
            type="button"
            aria-label={c.eventCard.options(event.title || c.eventCard.untitled)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={onToggleMenu}
            className={[
              "rounded-full p-0.5 transition",
              menuOpen ? (isDark ? "bg-white/[0.08]" : "bg-black/[0.05]") : "",
              isDark
                ? "text-neutral-400 hover:bg-white/[0.08]"
                : "text-neutral-400 hover:bg-black/[0.05]",
            ].join(" ")}
          >
            <MoreHorizontal className="h-[13px] w-[13px]" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className={[
                "absolute right-0 top-full z-40 mt-1.5 w-36 overflow-hidden rounded-xl border py-1 shadow-lg",
                isDark
                  ? "border-white/[0.08] bg-[#101012]"
                  : "border-black/[0.06] bg-white",
              ].join(" ")}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onCloseMenu();
                  onEdit();
                }}
                className={menuBtn(false)}
              >
                <Pencil className="h-[14px] w-[14px]" strokeWidth={1.8} />
                {c.eventCard.edit}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onCloseMenu();
                  onDelete();
                }}
                className={menuBtn(true)}
              >
                <Trash2 className="h-[14px] w-[14px]" strokeWidth={1.8} />
                {c.eventCard.delete}
              </button>
            </div>
          )}
        </div>
      </div>

      {tag && (
        <span
          className={[
            "inline-flex w-fit max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            isDark ? "text-neutral-200" : "text-neutral-700",
          ].join(" ")}
          style={{ backgroundColor: `${hex}26` }}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: hex ?? undefined }}
          />
          <span className="truncate">{tag.label}</span>
        </span>
      )}

      {event.confirmed && (
        <span
          className={[
            "flex w-fit items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-medium",
            isDark
              ? "bg-white/[0.08] text-white"
              : "bg-white text-neutral-700 shadow-sm",
          ].join(" ")}
        >
          <Check className="h-[9px] w-[9px]" strokeWidth={2.6} />
          {c.eventCard.confirmed}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Event form                                                          */
/* ------------------------------------------------------------------ */

type EventFormData = {
  title: string;
  day: number;
  dateStr?: string;
  start: number;
  end: number;
  tagId?: string;
};

function EventFormModal({
  isDark,
  tags,
  weekStart,
  initial,
  c,
  onCancel,
  onSave,
}: {
  isDark: boolean;
  tags: ApiTag[];
  weekStart: Date;
  initial: EventFormData | null;
  c: Copy;
  onCancel: () => void;
  onSave: (data: EventFormData) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState<Date>(() => {
    if (initial?.dateStr) return new Date(initial.dateStr);
    return initial ? addDays(weekStart, initial.day) : new Date();
  });
  const [startDate, setStartDate] = useState<Date>(() =>
    hourToDate(initial?.start ?? 9)
  );
  const [endDate, setEndDate] = useState<Date>(() =>
    hourToDate(initial?.end ?? 10)
  );
  const [tagId, setTagId] = useState<string>(initial?.tagId ?? "");

  const start = dateToHour(startDate);
  const end = dateToHour(endDate);
  const canSave = title.trim().length > 0 && end > start;

  useEscape(onCancel);

  const submit = () => {
    if (!canSave) return;
    onSave({
      title: title.trim(),
      day: date.getDay(),
      dateStr: date.toDateString(),
      start,
      end,
      tagId: tagId || undefined,
    });
  };

  const labelCls = [
    "mb-1 block text-[11px] font-medium",
    isDark ? "text-neutral-500" : "text-neutral-400",
  ].join(" ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={[
          "relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border p-5 shadow-2xl",
          isDark
            ? "border-white/[0.08] bg-[#101012]"
            : "border-black/[0.06] bg-white",
        ].join(" ")}
      >
        <h2
          className={[
            "mb-4 text-[17px] font-semibold tracking-[-0.02em]",
            strongClass(isDark),
          ].join(" ")}
        >
          {initial ? c.eventForm.editTitle : c.eventForm.createTitle}
        </h2>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>{c.eventForm.titleLabel}</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder={c.eventForm.titlePlaceholder}
              className={fieldClass(isDark)}
            />
          </div>

          <div>
            <label className={labelCls}>{c.eventForm.datetimeLabel}</label>
            <DateTimePicker
              isDark={isDark}
              date={date}
              onDateChange={setDate}
              start={startDate}
              end={endDate}
              onStartChange={setStartDate}
              onEndChange={setEndDate}
            />
          </div>

          <div>
            <label className={labelCls}>{c.eventForm.tagLabel}</label>
            <select
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
              style={{ colorScheme: isDark ? "dark" : "light" }}
              className={fieldClass(isDark)}
            >
              <option value="">{c.eventForm.unassigned}</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {!canSave && (
            <p
              className={[
                "text-[11px]",
                isDark ? "text-rose-300" : "text-rose-600",
              ].join(" ")}
            >
              {c.eventForm.validation}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={[
              "rounded-full px-3.5 py-2 text-[12.5px] font-medium transition",
              isDark
                ? "text-neutral-300 hover:bg-white/[0.05]"
                : "text-neutral-600 hover:bg-black/[0.05]",
            ].join(" ")}
          >
            {c.eventForm.cancel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className={[
              "rounded-full px-4 py-2 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
              isDark
                ? "bg-white text-neutral-900 hover:bg-neutral-200"
                : "bg-neutral-900 text-white hover:bg-neutral-800",
            ].join(" ")}
          >
            {initial ? c.eventForm.save : c.eventForm.create}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type CalendarDay = {
  date: Date;
  n: number;
  label: string;
  isToday: boolean;
  isCurrentMonth: boolean;
};

const FOCUS_TOP_MARGIN = 100;
const DAY_MS = 86_400_000;

export default function Schedule() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const lang = useLanguage();
  const c = COPY[lang];
  const isMobile = useIsMobile();

  const sidebarOffset = useSidebarOffset();
  const channels = useConnectedChannels();

  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const saved = isFavorite(PAGE_ROUTE);

  const hashChannel = useHashChannel();
  const [selectedKey, setSelectedKey] = useState<string | null>(hashChannel);

  useEffect(() => {
    if (hashChannel) setSelectedKey(hashChannel);
  }, [hashChannel]);

  const channel = channels.find((ch) => ch.key === selectedKey) ?? channels[0];
  const channelKey = channel?.key;

  const goChannel = (key: string) => {
    setSelectedKey(key);
    window.history.replaceState(
      null,
      "",
      `/schedule?channel=${encodeURIComponent(key)}`
    );
  };

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [apiTags, setApiTags] = useState<ApiTag[]>([]);
  const [postsTick, setPostsTick] = useState(0);

  const allTags = useMemo(() => [UNASSIGNED_TAG, ...apiTags], [apiTags]);
  const tagsById = useMemo(
    () => new Map(apiTags.map((t) => [t.id, t])),
    [apiTags]
  );

  const [hiddenTags, setHiddenTags] = useState<string[]>([]);

  const [viewDate, setViewDate] = useState(() => new Date());
  const [openPanel, setOpenPanel] = useState<ToolbarPanel | null>(null);
  const [view, setView] = useState<View>(() =>
    typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
      ? "3days"
      : "week"
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timezone, setTimezone] = useState("Paris");
  const [showNoDate, setShowNoDate] = useState(false);
  const [scope, setScope] = useState<Scope>("all");

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [bottomQuery, setBottomQuery] = useState("");
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [newPostDate, setNewPostDate] = useState<Date | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const pendingFocusRef = useRef<number | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const monthGridRef = useRef<HTMLDivElement>(null);
  const [monthGridHeight, setMonthGridHeight] = useState(0);
  const [more, setMore] = useState<{ date: Date; hour: number | null } | null>(
    null
  );

  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);

  /* ---- fermeture des menus ---- */

  useEffect(() => {
    if (openMenuId === null) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-event-menu]"))
        setOpenMenuId(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!openPanel) return;
    const closeAll = () => setOpenPanel(null);
    const onPointerDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-toolbar-menu]")) closeAll();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openPanel]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  /* ---- plage affichée ---- */

  const isGrid = view !== "month";
  const dayCount = view === "3days" ? 3 : 7;

  const rangeStart = useMemo(() => {
    if (view === "3days") return startOfDay(viewDate);
    if (view === "week") return startOfWeek(viewDate);
    return new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  }, [view, viewDate]);

  const rangeEnd = useMemo(() => {
    if (view === "month")
      return new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    return addDays(rangeStart, dayCount);
  }, [view, viewDate, rangeStart, dayCount]);

  const gridCols = `${TIME_COL}px repeat(${dayCount}, minmax(0, 1fr))`;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isGrid) return;

    const inRange = now >= rangeStart && now < rangeEnd;
    const defaultTarget = inRange
      ? Math.max(
          0,
          (now.getHours() +
            now.getMinutes() / 60 -
            NOW_CONTEXT_HOURS -
            START_HOUR) *
            HOUR_HEIGHT
        )
      : (DEFAULT_SCROLL_HOUR - START_HOUR) * HOUR_HEIGHT;

    let target = defaultTarget;
    const pendingFocus = pendingFocusRef.current;
    if (pendingFocus !== null) {
      const d = new Date(pendingFocus);
      const hour = d.getHours() + d.getMinutes() / 60;
      target = Math.max(0, (hour - START_HOUR) * HOUR_HEIGHT - FOCUS_TOP_MARGIN);
      pendingFocusRef.current = null;
    }

    el.scrollTop = target;
    setScrollTop(el.scrollTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, view, focusNonce]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewportHeight(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [view]);

  useEffect(() => {
    if (view !== "month") return;
    const el = monthGridRef.current;
    if (!el) return;
    const update = () => setMonthGridHeight(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  /* ---- chargement ---- */

  useEffect(() => {
    let cancelled = false;
    listPosts(rangeStart, rangeEnd)
      .then((p) => {
        if (!cancelled) setPosts(p);
      })
      .catch((e) => console.error("Could not load posts:", e));
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, postsTick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureDefaultTags();
      const server = await listTags();
      const rank = (t: ApiTag) => {
        const i = DEFAULT_ORDER.indexOf(t.label.trim().toLowerCase());
        return i === -1 ? DEFAULT_ORDER.length : i;
      };
      if (!cancelled) setApiTags([...server].sort((a, b) => rank(a) - rank(b)));
    })().catch((e) => console.error("Could not load tags:", e));
    return () => {
      cancelled = true;
    };
  }, [postsTick]);

  useEffect(() => {
    const onFocus = () => setPostsTick((n) => n + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const gridViewFallback: View = isMobile ? "3days" : "week";

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("schedule:focusDate");
      if (!raw) return;
      sessionStorage.removeItem("schedule:focusDate");
      const d = new Date(Number(raw));
      if (!Number.isNaN(d.getTime())) {
        pendingFocusRef.current = d.getTime();
        setView((v) => (v === "month" ? gridViewFallback : v));
        setViewDate(d);
        setFocusNonce((n) => n + 1);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- jours ---- */

  const days = useMemo((): (CalendarDay | null)[] => {
    const make = (date: Date): CalendarDay => ({
      date,
      n: date.getDate(),
      label: date.toLocaleDateString(intlLocale(lang), { weekday: "short" }),
      isToday: date.toDateString() === now.toDateString(),
      isCurrentMonth: true,
    });

    if (view !== "month")
      return Array.from({ length: dayCount }, (_, i) =>
        make(addDays(rangeStart, i))
      );

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const startPad = new Date(year, month, 1).getDay();
    const numDays = new Date(year, month + 1, 0).getDate();

    const res: (CalendarDay | null)[] = [];
    for (let i = 0; i < startPad; i++) res.push(null);
    for (let i = 1; i <= numDays; i++) res.push(make(new Date(year, month, i)));
    const endPad = (7 - (res.length % 7)) % 7;
    for (let i = 0; i < endPad; i++) res.push(null);
    return res;
  }, [view, viewDate, now, lang, rangeStart, dayCount]);

  const monthLabel = viewDate.toLocaleDateString(intlLocale(lang), {
    month: "long",
    year: "numeric",
  });
  const dayLabel = viewDate.toLocaleDateString(intlLocale(lang), {
    month: "long",
    day: "numeric",
  });
  const dateButtonLabel =
    view === "month" || (!isMobile && view === "week") ? monthLabel : dayLabel;

  const togglePanel = (panel: ToolbarPanel) =>
    setOpenPanel((cur) => (cur === panel ? null : panel));

  const step = (dir: 1 | -1) =>
    setViewDate((d) =>
      view === "month"
        ? addMonths(d, dir)
        : addDays(d, dir * (view === "3days" ? 3 : 7))
    );

  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowLabel = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  const showNowLine = nowHour >= START_HOUR && nowHour <= END_HOUR;

  const todayStart = startOfDay(now);

  /* ---- événements ---- */

  const visibleEvents = useMemo(
    () =>
      (events || []).filter((e) => {
        const matchChannel =
          !e.channelKey || !channelKey || e.channelKey === channelKey;
        const matchTag = passesTagFilter(e.tagId ? [e.tagId] : [], hiddenTags);
        const matchScope =
          scope === "all" ||
          (scope === "published" && e.published) ||
          (scope === "toPublish" && !e.published);
        return matchChannel && matchTag && matchScope;
      }),
    [events, hiddenTags, scope, channelKey]
  );

  const layoutByDay = useMemo(() => {
    const map = new Map<number, PositionedEvent[]>();
    if (view === "month") return map;
    for (let i = 0; i < dayCount; i++) {
      const date = addDays(rangeStart, i);
      const key = date.toDateString();
      const list = visibleEvents.filter((e) =>
        e.dateStr ? e.dateStr === key : e.day === date.getDay()
      );
      map.set(i, layoutDayEvents(list));
    }
    return map;
  }, [visibleEvents, rangeStart, dayCount, view]);

  const monthEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    if (view !== "month") return map;
    days.forEach((day) => {
      if (!day) return;
      const key = day.date.toDateString();
      const dayEvents = visibleEvents.filter((e) =>
        e.dateStr ? e.dateStr === key : e.day === day.date.getDay()
      );
      if (dayEvents.length)
        map.set(key, dayEvents.sort((a, b) => a.start - b.start));
    });
    return map;
  }, [days, visibleEvents, view]);

  const postVisible = useCallback(
    (post: CalendarPost | null | undefined): boolean => {
      if (!post) return false;
      if (post.channelKey && channelKey && post.channelKey !== channelKey)
        return false;

      let posted = false;
      try {
        posted = isPostPosted(post, now);
      } catch {
        posted = false;
      }

      if (scope === "published" && !posted) return false;
      if (scope === "toPublish" && posted) return false;
      if (!passesTagFilter(post.tagIds, hiddenTags)) return false;
      return true;
    },
    [channelKey, scope, hiddenTags, now]
  );

  const dayIndexOf = useCallback(
    (d: Date) =>
      Math.round((startOfDay(d).getTime() - rangeStart.getTime()) / DAY_MS),
    [rangeStart]
  );

  const postSlotsByDay = useMemo(() => {
    const raw = new Map<number, Map<number, CalendarPost[]>>();
    for (let i = 0; i < dayCount; i++) raw.set(i, new Map());

    for (const post of posts || []) {
      if (!postVisible(post)) continue;
      const d = new Date(post.scheduledAt);
      if (isNaN(d.getTime())) continue;

      const idx = dayIndexOf(d);
      if (idx < 0 || idx > dayCount - 1) continue;

      const slots = raw.get(idx);
      if (!slots) continue;
      const hour = d.getHours();
      const list = slots.get(hour) ?? [];
      list.push(post);
      slots.set(hour, list);
    }

    const map = new Map<number, { hour: number; posts: CalendarPost[] }[]>();
    raw.forEach((slots, day) => {
      map.set(
        day,
        [...slots.entries()]
          .sort(([a], [b]) => a - b)
          .map(([hour, list]) => ({
            hour,
            posts: list.sort(
              (a, b) =>
                new Date(a.scheduledAt).getTime() -
                new Date(b.scheduledAt).getTime()
            ),
          }))
      );
    });
    return map;
  }, [posts, postVisible, dayIndexOf, dayCount]);

  const monthPostsByDate = useMemo(() => {
    const map = new Map<string, CalendarPost[]>();
    for (const post of posts || []) {
      if (!postVisible(post)) continue;
      const d = new Date(post.scheduledAt);
      if (isNaN(d.getTime())) continue;
      const key = d.toDateString();
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    }
    map.forEach((arr) =>
      arr.sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      )
    );
    return map;
  }, [posts, postVisible]);

  const monthItemsByDate = useMemo(() => {
    const map = new Map<string, MonthItem[]>();
    const keys = new Set([
      ...monthEventsByDate.keys(),
      ...monthPostsByDate.keys(),
    ]);

    keys.forEach((key) => {
      const items: MonthItem[] = [];
      (monthEventsByDate.get(key) ?? []).forEach((event) =>
        items.push({
          kind: "event",
          id: `e-${event.id}`,
          start: event.start,
          event,
        })
      );
      (monthPostsByDate.get(key) ?? []).forEach((post) => {
        const d = new Date(post.scheduledAt);
        items.push({
          kind: "post",
          id: `p-${post.id}`,
          start: d.getHours() + d.getMinutes() / 60,
          post,
        });
      });
      items.sort((a, b) => a.start - b.start);
      map.set(key, items);
    });
    return map;
  }, [monthEventsByDate, monthPostsByDate]);

  const monthRowCount = Math.max(1, Math.ceil(days.length / 7));
  const monthCellHeight = monthGridHeight / monthRowCount;

  const monthItemHeight = (item: MonthItem) =>
    item.kind === "post" ? POST_CHIP_H : MONTH_ITEM_H;

  const visibleCountFor = (items: MonthItem[]) => {
    if (monthGridHeight === 0) return items.length;
    const avail =
      monthCellHeight - MONTH_CELL_PAD * 2 - MONTH_CELL_HEADER - MONTH_GAP;
    return fitCount(items.map(monthItemHeight), avail);
  };

  /* ---- drag & drop (desktop) ---- */

  const dropDateFor = (post: CalendarPost, date: Date, hour?: number) => {
    const old = new Date(post.scheduledAt);
    const next = new Date(date);
    next.setHours(hour ?? old.getHours(), old.getMinutes(), 0, 0);
    return next;
  };

  const hourFromPointer = (e: React.DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const hour = START_HOUR + Math.floor((e.clientY - rect.top) / HOUR_HEIGHT);
    return Math.min(END_HOUR - 1, Math.max(START_HOUR, hour));
  };

  const clearDragOver = () => {
    setDragOverKey(null);
    setDragOverHour(null);
  };

  const handleDragStart = (e: React.DragEvent, postId: string) => {
    setDraggedPostId(postId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", postId);
  };

  const handleDragEnd = () => {
    setDraggedPostId(null);
    clearDragOver();
  };

  const handleDragOver = (e: React.DragEvent, date: Date, byPointer = false) => {
    const post = draggedPostId
      ? posts.find((p) => p.id === draggedPostId)
      : undefined;
    if (!post) return;

    const hour = byPointer ? hourFromPointer(e) : undefined;
    const target = dropDateFor(post, date, hour);

    if (target.getTime() <= Date.now()) {
      e.dataTransfer.dropEffect = "none";
      clearDragOver();
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverKey(date.toDateString());
    setDragOverHour(hour ?? null);
  };

  const handleDrop = async (e: React.DragEvent, date: Date, byPointer = false) => {
    e.preventDefault();
    const hour = byPointer ? hourFromPointer(e) : undefined;

    const postId = draggedPostId || e.dataTransfer.getData("text/plain");
    clearDragOver();
    setDraggedPostId(null);
    if (!postId) return;

    const post = posts.find((p) => p && p.id === postId);
    if (!post) return;

    const target = dropDateFor(post, date, hour);
    if (target.getTime() <= Date.now()) return;
    if (target.getTime() === new Date(post.scheduledAt).getTime()) return;

    const previous = post.scheduledAt;
    const next = target.toISOString();

    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, scheduledAt: next } : p))
    );

    try {
      await updatePostSchedule(postId, next);
      setPostsTick((n) => n + 1);
    } catch (error) {
      console.error("Erreur lors du déplacement du post:", error);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, scheduledAt: previous } : p))
      );
    }
  };

  /* ---- posts hors écran ---- */

  const offScreenPosts = useMemo(() => {
    const above: OffScreenPost[] = [];
    const below: OffScreenPost[] = [];
    if (viewportHeight === 0) return { above, below };

    const viewTop = scrollTop;
    const viewBottom = scrollTop + viewportHeight;

    postSlotsByDay.forEach((slots, dayIndex) => {
      for (const slot of slots) {
        const top = (slot.hour - START_HOUR) * HOUR_HEIGHT;
        const bottom = top + HOUR_HEIGHT;
        for (const post of slot.posts) {
          if (bottom <= viewTop) above.push({ post, dayIndex, top });
          else if (top >= viewBottom) below.push({ post, dayIndex, top });
        }
      }
    });

    above.sort((a, b) => a.top - b.top);
    below.sort((a, b) => a.top - b.top);
    return { above, below };
  }, [postSlotsByDay, scrollTop, viewportHeight]);

  const scrollToOffScreenPost = (item: OffScreenPost) => {
    scrollRef.current?.scrollTo({
      top: Math.max(0, item.top - HOUR_HEIGHT / 2),
      behavior: "smooth",
    });
  };

  /* ---- actions ---- */

  const toggleHiddenTag = (id: string) =>
    setHiddenTags((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleDeleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (editingEventId === id) {
      setEventFormOpen(false);
      setEditingEventId(null);
    }
  };

  const handleEditEvent = (id: string) => {
    if (!events.find((e) => e.id === id)) return;
    setEditingEventId(id);
    setEventFormOpen(true);
  };

  const handleAddEvent = () => {
    setEditingEventId(null);
    setEventFormOpen(true);
  };

  const handleSaveEvent = (data: EventFormData) => {
    if (editingEventId) {
      setEvents((prev) =>
        prev.map((e) => (e.id === editingEventId ? { ...e, ...data } : e))
      );
    } else {
      const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setEvents((prev) => [
        ...prev,
        { id, ...data, channelKey, published: false },
      ]);
    }
    setEventFormOpen(false);
    setEditingEventId(null);
  };

  const editingEvent = editingEventId
    ? (events.find((e) => e.id === editingEventId) ?? null)
    : null;

  const openNewPost = () => {
    setIsFolderOpen(false);
    setNewPostDate(null);
    setIsNewPostOpen(true);
  };

  const handleBottomBarChange = (id: BottomBarTab) => {
    if (id === "add") openNewPost();
    else if (id === "files") setIsFolderOpen((open) => !open);
  };

  const openNewPostAt = (day: Date, hour: number) => {
    const slot = new Date(day);
    slot.setHours(hour, 0, 0, 0);

    if (slot.getTime() <= Date.now()) {
      const d = new Date();
      d.setMinutes(Math.ceil((d.getMinutes() + 1) / 5) * 5, 0, 0);
      setNewPostDate(d);
    } else {
      setNewPostDate(slot);
    }
    setIsFolderOpen(false);
    setIsNewPostOpen(true);
  };

  const handleCreatePost = async (payload: NewPostPayload) => {
    await createPosts(payload);
    setPostsTick((n) => n + 1);
  };

  const renderPostChip = (post: CalendarPost, large = false): ReactNode => (
    <PostChip
      post={post}
      large={large}
      lang={lang}
      isDark={isDark}
      posted={isPostPosted(post, now)}
      dragging={draggedPostId === post.id}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    />
  );

  const renderMonthItem = (item: MonthItem): ReactNode => {
    if (item.kind === "event") {
      return (
        <MonthEventChip
          event={item.event}
          tag={item.event.tagId ? tagsById.get(item.event.tagId) : undefined}
          isDark={isDark}
          lang={lang}
          c={c}
        />
      );
    }
    return renderPostChip(item.post);
  };

  const calendarBorder = isDark ? "border-white/[0.07]" : "border-black/[0.06]";

  /* ---- modal "plus" ---- */

  let moreItems: MonthItem[] = [];
  let moreTitle = "";
  if (more) {
    const dateLabel = more.date.toLocaleDateString(intlLocale(lang), {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    if (more.hour === null) {
      moreItems = monthItemsByDate.get(more.date.toDateString()) ?? [];
      moreTitle = dateLabel;
    } else {
      const slotHour = more.hour;
      const slot = postSlotsByDay
        .get(dayIndexOf(more.date))
        ?.find((s) => s.hour === slotHour);
      moreItems = (slot?.posts ?? []).map((post) => {
        const d = new Date(post.scheduledAt);
        return {
          kind: "post" as const,
          id: `p-${post.id}`,
          start: d.getHours() + d.getMinutes() / 60,
          post,
        };
      });
      const slotDate = new Date(more.date);
      slotDate.setHours(slotHour, 0, 0, 0);
      moreTitle = `${dateLabel} · ${slotDate.toLocaleTimeString(
        intlLocale(lang),
        { hour: "numeric" }
      )}`;
    }
  }

  const viewOptions: { key: View; label: string }[] = [
    { key: "3days", label: c.toolbar.threeDays },
    { key: "week", label: c.toolbar.week },
    { key: "month", label: c.toolbar.month },
  ];

  const viewLabel = viewOptions.find((o) => o.key === view)?.label ?? "";

  const scopeOptions: { key: Scope; label: string }[] = [
    { key: "all", label: c.toolbar.scopeLabels.all },
    { key: "published", label: c.toolbar.scopeLabels.published },
    { key: "toPublish", label: c.toolbar.scopeLabels.toPublish },
  ];

  const scopeItems = scopeOptions.map((option) => (
    <MenuItem
      key={option.key}
      isDark={isDark}
      selected={scope === option.key}
      onClick={() => {
        setScope(option.key);
        setOpenPanel(null);
      }}
    >
      {option.label}
    </MenuItem>
  ));

  const tagList = (
    <ul className="max-h-[260px] overflow-y-auto">
      {allTags.map((t) => {
        const on = !hiddenTags.includes(t.id);
        return (
          <li key={t.id} className="flex items-center">
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={on}
              onClick={() => toggleHiddenTag(t.id)}
              className={`flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-2.5 text-left text-[13px] transition md:py-2 md:text-[12.5px] ${
                isDark
                  ? "text-neutral-300 hover:bg-white/[0.05]"
                  : "text-neutral-600 hover:bg-black/[0.03]"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: hexOf(t) }}
                />
                <span className="truncate">{t.label}</span>
              </span>
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                  on
                    ? isDark
                      ? "border-white bg-white text-black"
                      : "border-black bg-black text-white"
                    : isDark
                      ? "border-white/25"
                      : "border-black/25"
                }`}
              >
                {on ? "✓" : ""}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const filtersActive = scope !== "all" || hiddenTags.length > 0;

  /* ================================================================ */
  /* Render                                                           */
  /* ================================================================ */

  return (
    <main
      className={[
        "relative h-dvh min-h-dvh w-full overflow-hidden overscroll-none",
        "transition-colors duration-300",
        pageBgClass(isDark),
      ].join(" ")}
    >
      <DashboardSidebar theme={theme} />

      <div
        className={[
          "h-full min-h-0 px-2 py-2 md:py-3 md:pl-0 md:pr-3",
          "max-md:pt-[calc(3.5rem+env(safe-area-inset-top))]",
          "transition-[padding-left] duration-[380ms]",
          "ease-[cubic-bezier(0.4,0,0.2,1)]",
          "motion-reduce:transition-none",
        ].join(" ")}
        style={{ paddingLeft: sidebarOffset }}
      >
        <div
          className={[
            "flex h-full min-h-0 flex-col overflow-hidden",
            "rounded-2xl border md:rounded-[28px]",
            "transition-colors duration-300",
            mainPanelClass(isDark),
          ].join(" ")}
        >
          <div
            className={[
              "flex min-h-0 w-full flex-1 flex-col",
              "px-[clamp(14px,3vw,48px)]",
              "pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[clamp(16px,3vw,30px)] md:pb-4",
            ].join(" ")}
          >
            {/* HEADER — z-20 : sous le tiroir mobile (z-40) et la barre mobile (z-30) */}
            <div className="relative z-20 mb-3 flex shrink-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border md:h-9 md:w-9",
                    isDark
                      ? "border-white/[0.07] bg-white/[0.04] text-neutral-400"
                      : "border-black/[0.06] bg-white text-neutral-500",
                  ].join(" ")}
                >
                  <CalendarDays className="h-[17px] w-[17px]" strokeWidth={1.8} />
                </span>
                <h1
                  className={[
                    "truncate text-[22px] font-semibold tracking-[-0.03em] md:text-[20px]",
                    strongClass(isDark),
                  ].join(" ")}
                >
                  {c.pageTitle}
                </h1>
                <button
                  type="button"
                  aria-label={
                    saved ? c.header.removeFavorite : c.header.addFavorite
                  }
                  aria-pressed={saved}
                  title={saved ? c.header.removeFavorite : c.header.addFavorite}
                  onClick={() => toggleFavorite(PAGE_ROUTE)}
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors motion-reduce:transition-none md:hidden",
                    focusRingClass(isDark),
                    isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]",
                  ].join(" ")}
                >
                  <Bookmark
                    className="h-5 w-5"
                    strokeWidth={1.8}
                    fill={saved ? "currentColor" : "none"}
                  />
                </button>
              </div>

              <div className="flex items-center gap-2.5 print:hidden">
                <div className="max-md:hidden">
                  <ChannelMenu
                    channels={channels}
                    current={channel}
                    isDark={isDark}
                    onSelect={goChannel}
                  />
                </div>
                <button
                  type="button"
                  aria-label={
                    saved ? c.header.removeFavorite : c.header.addFavorite
                  }
                  aria-pressed={saved}
                  title={saved ? c.header.removeFavorite : c.header.addFavorite}
                  onClick={() => toggleFavorite(PAGE_ROUTE)}
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors motion-reduce:transition-none max-md:hidden",
                    focusRingClass(isDark),
                    isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]",
                  ].join(" ")}
                >
                  <Bookmark
                    className="h-5 w-5"
                    strokeWidth={1.8}
                    fill={saved ? "currentColor" : "none"}
                  />
                </button>
                <button
                  type="button"
                  aria-label={c.header.newPost}
                  title={c.header.newPost}
                  onClick={openNewPost}
                  className={[
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition md:hidden",
                    focusRingClass(isDark),
                    isDark
                      ? "bg-white text-neutral-900 hover:bg-neutral-200"
                      : "bg-neutral-900 text-white hover:bg-neutral-700",
                  ].join(" ")}
                >
                  <Plus className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Canal (mobile) */}
            <div className="mb-3 shrink-0 md:hidden">
              <ChannelMenu
                channels={channels}
                current={channel}
                isDark={isDark}
                onSelect={goChannel}
              />
            </div>

            {/* TOOLBAR */}
            <div className="flex shrink-0 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <ToolbarIconButton
                  isDark={isDark}
                  label={c.toolbar.prev}
                  onClick={() => step(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </ToolbarIconButton>

                <button
                  type="button"
                  aria-label={c.toolbar.openCalendar}
                  aria-haspopup="dialog"
                  onClick={() => setCalendarOpen(true)}
                  className={[
                    "flex min-h-10 min-w-0 items-center gap-1.5 rounded-xl px-3 text-[15px] font-semibold capitalize transition md:min-h-0 md:py-1.5 md:text-[17px]",
                    "tracking-[-0.02em]",
                    focusRingClass(isDark),
                    isDark
                      ? "bg-white/[0.06] text-white hover:bg-white/[0.10]"
                      : "bg-black/[0.04] text-neutral-900 hover:bg-black/[0.07]",
                  ].join(" ")}
                >
                  <span className="truncate">{dateButtonLabel}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                </button>

                <ToolbarIconButton
                  isDark={isDark}
                  label={c.toolbar.next}
                  onClick={() => step(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </ToolbarIconButton>

                <button
                  type="button"
                  onClick={() => setViewDate(new Date())}
                  className={[
                    "ml-1 rounded-lg border px-4 py-1.5 text-[13px] font-medium transition max-md:hidden",
                    focusRingClass(isDark),
                    isDark
                      ? "border-white/[0.08] bg-white/[0.03] text-white hover:bg-white/[0.08]"
                      : "border-black/[0.06] bg-white text-neutral-900 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  {c.toolbar.today}
                </button>

                <div className="relative ml-2 max-md:hidden" data-toolbar-menu>
                  <ToolbarButton
                    isDark={isDark}
                    open={openPanel === "view"}
                    onClick={() => togglePanel("view")}
                  >
                    {viewLabel}
                  </ToolbarButton>
                  {openPanel === "view" && (
                    <MenuPanel isDark={isDark} width="w-40">
                      {viewOptions.map((option) => (
                        <MenuItem
                          key={option.key}
                          isDark={isDark}
                          selected={view === option.key}
                          onClick={() => {
                            setView(option.key);
                            setOpenPanel(null);
                          }}
                        >
                          {option.label}
                        </MenuItem>
                      ))}
                    </MenuPanel>
                  )}
                </div>
              </div>

              {/* Mobile : un seul bouton Filtres */}
              <div className="relative md:hidden" data-toolbar-menu>
                <ToolbarIconButton
                  isDark={isDark}
                  label={c.toolbar.filters}
                  open={openPanel === "filters"}
                  onClick={() => togglePanel("filters")}
                >
                  <span className="relative flex">
                    <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    {filtersActive && (
                      <span
                        className={[
                          "absolute -right-1 -top-1 h-2 w-2 rounded-full",
                          isDark ? "bg-white" : "bg-neutral-900",
                        ].join(" ")}
                      />
                    )}
                  </span>
                </ToolbarIconButton>
                {openPanel === "filters" && (
                  <MenuPanel isDark={isDark} align="right" width="w-64">
                    {scopeItems}
                    <Divider isDark={isDark} />
                    {tagList}
                    <Divider isDark={isDark} />
                    <MenuItem
                      isDark={isDark}
                      icon={<Plus className="h-[13px] w-[13px]" strokeWidth={2.2} />}
                      onClick={() => {
                        setOpenPanel(null);
                        handleAddEvent();
                      }}
                    >
                      {c.toolbar.addEvent}
                    </MenuItem>
                  </MenuPanel>
                )}
              </div>

              {/* Desktop : barre complète */}
              <div className="flex items-center gap-1 max-md:hidden">
                <div className="relative" data-toolbar-menu>
                  <ToolbarButton
                    isDark={isDark}
                    icon={<FileText className="h-[15px] w-[15px]" strokeWidth={1.8} />}
                    open={openPanel === "posts"}
                    onClick={() => togglePanel("posts")}
                  >
                    {c.toolbar.scopeLabels[scope]}
                  </ToolbarButton>
                  {openPanel === "posts" && (
                    <MenuPanel isDark={isDark} align="right" width="w-44">
                      {scopeItems}
                    </MenuPanel>
                  )}
                </div>

                <div className="relative" data-toolbar-menu>
                  <ToolbarButton
                    isDark={isDark}
                    icon={<TagLucide className="h-[15px] w-[15px]" strokeWidth={1.8} />}
                    open={openPanel === "tags"}
                    onClick={() => togglePanel("tags")}
                  >
                    {c.toolbar.tags}
                    {hiddenTags.length > 0 && (
                      <span
                        className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                          isDark ? "bg-white text-black" : "bg-black text-white"
                        }`}
                      >
                        {allTags.length - hiddenTags.length}/{allTags.length}
                      </span>
                    )}
                  </ToolbarButton>
                  {openPanel === "tags" && (
                    <MenuPanel isDark={isDark} align="right" width="w-64">
                      {tagList}
                    </MenuPanel>
                  )}
                </div>

                <ToolbarButton
                  isDark={isDark}
                  icon={<CalendarOff className="h-[15px] w-[15px]" strokeWidth={1.8} />}
                  chevron={false}
                  active={showNoDate}
                  onClick={() => setShowNoDate((v) => !v)}
                >
                  {c.toolbar.noDate}
                </ToolbarButton>

                <span
                  className={[
                    "mx-1 h-5 w-px",
                    isDark ? "bg-white/[0.08]" : "bg-black/[0.08]",
                  ].join(" ")}
                />

                <div className="relative" data-toolbar-menu>
                  <ToolbarButton
                    isDark={isDark}
                    icon={<Globe className="h-[15px] w-[15px]" strokeWidth={1.8} />}
                    open={openPanel === "timezone"}
                    onClick={() => togglePanel("timezone")}
                  >
                    {c.timezoneLabels[timezone] ?? timezone}
                  </ToolbarButton>
                  {openPanel === "timezone" && (
                    <MenuPanel isDark={isDark} align="right" width="w-44">
                      {TIMEZONES.map((tz) => (
                        <MenuItem
                          key={tz}
                          isDark={isDark}
                          selected={timezone === tz}
                          onClick={() => {
                            setTimezone(tz);
                            setOpenPanel(null);
                          }}
                        >
                          {c.timezoneLabels[tz] ?? tz}
                        </MenuItem>
                      ))}
                    </MenuPanel>
                  )}
                </div>

                <div className="relative" data-toolbar-menu>
                  <ToolbarIconButton
                    isDark={isDark}
                    label={c.toolbar.moreOptions}
                    open={openPanel === "more"}
                    onClick={() => togglePanel("more")}
                  >
                    <MoreVertical className="h-[15px] w-[15px]" />
                  </ToolbarIconButton>
                  {openPanel === "more" && (
                    <MenuPanel isDark={isDark} align="right" width="w-44">
                      <MenuItem
                        isDark={isDark}
                        icon={<Plus className="h-[13px] w-[13px]" strokeWidth={2.2} />}
                        onClick={() => {
                          setOpenPanel(null);
                          handleAddEvent();
                        }}
                      >
                        {c.toolbar.addEvent}
                      </MenuItem>
                    </MenuPanel>
                  )}
                </div>
              </div>
            </div>

            {/* CALENDRIER */}
            <div
              className={[
                "mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border md:mt-4",
                calendarBorder,
                isDark ? "bg-white/[0.02]" : "bg-white",
              ].join(" ")}
            >
              {isGrid ? (
                <>
                  {/* En-têtes des jours */}
                  <div
                    className="grid shrink-0"
                    style={{ gridTemplateColumns: gridCols }}
                  >
                    <div className={["border-b", calendarBorder].join(" ")} />
                    {days.map((day) => {
                      if (!day) return null;
                      return (
                        <div
                          key={day.date.toISOString()}
                          className={[
                            "flex flex-col items-center justify-center gap-0.5 border-b border-l py-2 text-[12px] md:flex-row md:gap-2",
                            calendarBorder,
                            day.isToday
                              ? isDark
                                ? "font-semibold text-white"
                                : "font-semibold text-neutral-900"
                              : isDark
                                ? "font-medium text-neutral-400"
                                : "font-medium text-neutral-500",
                            dragOverKey === day.date.toDateString()
                              ? isDark
                                ? "bg-white/[0.08]"
                                : "bg-black/[0.04]"
                              : "",
                          ].join(" ")}
                          onDragOver={(e) => handleDragOver(e, day.date)}
                          onDragLeave={clearDragOver}
                          onDrop={(e) => handleDrop(e, day.date)}
                        >
                          <span>{day.label}</span>
                          <span
                            className={[
                              "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12.5px] md:h-5 md:min-w-5 md:text-[11.5px]",
                              day.isToday
                                ? isDark
                                  ? "bg-white text-neutral-900"
                                  : "bg-neutral-900 text-white"
                                : "",
                            ].join(" ")}
                          >
                            {day.n}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="relative min-h-0 flex-1">
                    <div
                      ref={scrollRef}
                      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                      className="h-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      <div
                        className="grid"
                        style={{
                          gridTemplateColumns: gridCols,
                          height: TOTAL_HEIGHT,
                        }}
                      >
                        <div className="relative">
                          {HOURS.map((h, i) => (
                            <div
                              key={h}
                              className={[
                                "absolute inset-x-0 px-1.5 text-right text-[10.5px] leading-none md:px-2",
                                mutedClass(isDark),
                              ].join(" ")}
                              style={{
                                top: i * HOUR_HEIGHT,
                                transform:
                                  i === 0
                                    ? "translateY(6px)"
                                    : "translateY(-50%)",
                              }}
                            >
                              {String(h).padStart(2, "0")}:00
                            </div>
                          ))}
                        </div>

                        {days.map((day, dayIndex) => {
                          if (!day) return null;
                          const dayKey = day.date.toDateString();
                          const daySlots = postSlotsByDay.get(dayIndex) ?? [];
                          const occupied = new Set(daySlots.map((s) => s.hour));
                          return (
                            <div
                              key={day.date.toISOString()}
                              className={[
                                "relative border-l",
                                calendarBorder,
                                day.isToday
                                  ? isDark
                                    ? "bg-white/[0.02]"
                                    : "bg-black/[0.015]"
                                  : "",
                              ].join(" ")}
                              onDragOver={(e) => handleDragOver(e, day.date, true)}
                              onDragLeave={clearDragOver}
                              onDrop={(e) => handleDrop(e, day.date, true)}
                            >
                              {HOURS.slice(0, -1).map((h, i) => (
                                <div
                                  key={h}
                                  className={[
                                    "pointer-events-none absolute inset-x-0 border-b",
                                    isDark
                                      ? "border-white/[0.05]"
                                      : "border-black/[0.04]",
                                  ].join(" ")}
                                  style={{ top: (i + 1) * HOUR_HEIGHT }}
                                />
                              ))}

                              {dragOverKey === dayKey && dragOverHour !== null && (
                                <div
                                  className={[
                                    "pointer-events-none absolute inset-x-0.5 rounded-xl border-2 border-dashed",
                                    isDark
                                      ? "border-white/30 bg-white/[0.05]"
                                      : "border-black/20 bg-black/[0.03]",
                                  ].join(" ")}
                                  style={{
                                    top:
                                      (dragOverHour - START_HOUR) * HOUR_HEIGHT + 2,
                                    height: HOUR_HEIGHT - 4,
                                    zIndex: 1,
                                  }}
                                />
                              )}

                              {/* Créneaux "ajouter un post" :
                                  desktop = bouton "+" au survol ;
                                  mobile  = tout le créneau est cliquable. */}
                              {day.date.getTime() >= todayStart.getTime() &&
                                HOURS.slice(0, -1).map((h) => {
                                  const slotEnd = new Date(day.date);
                                  slotEnd.setHours(h + 1, 0, 0, 0);
                                  if (slotEnd.getTime() <= now.getTime())
                                    return null;
                                  const busy = occupied.has(h);

                                  return (
                                    <div
                                      key={`add-${h}`}
                                      className="group absolute inset-x-0"
                                      style={{
                                        top: (h - START_HOUR) * HOUR_HEIGHT,
                                        height: HOUR_HEIGHT,
                                      }}
                                    >
                                      <button
                                        type="button"
                                        aria-label={c.addPostTooltip}
                                        onClick={() => openNewPostAt(day.date, h)}
                                        className={[
                                          "absolute flex items-center justify-center transition",
                                          "max-md:inset-0 max-md:active:bg-black/[0.05]",
                                          "md:h-7 md:w-7 md:rounded-lg md:border md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
                                          busy
                                            ? "md:bottom-1 md:right-1"
                                            : "md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
                                          isDark
                                            ? "md:border-white/[0.08] md:bg-white/[0.06] md:text-neutral-300 md:hover:bg-white/[0.10] md:hover:text-white"
                                            : "md:border-black/[0.06] md:bg-white md:text-neutral-500 md:shadow-sm md:hover:bg-neutral-50 md:hover:text-neutral-900",
                                        ].join(" ")}
                                      >
                                        <Plus
                                          className="h-[13px] w-[13px] max-md:hidden"
                                          strokeWidth={2.2}
                                        />
                                        <span
                                          className={[
                                            "pointer-events-none absolute bottom-full mb-2 hidden whitespace-nowrap rounded-lg px-2.5 py-1 text-[12px] font-medium shadow-lg md:group-hover:block",
                                            busy ? "right-0" : "",
                                            isDark
                                              ? "bg-[#2e2e31] text-white"
                                              : "bg-neutral-900 text-white",
                                          ].join(" ")}
                                        >
                                          {c.addPostTooltip}
                                        </span>
                                      </button>
                                    </div>
                                  );
                                })}

                              {layoutByDay.get(dayIndex)?.map(({ event, depth }) => (
                                <EventCard
                                  key={event.id}
                                  event={event}
                                  tag={
                                    event.tagId
                                      ? tagsById.get(event.tagId)
                                      : undefined
                                  }
                                  depth={depth}
                                  isDark={isDark}
                                  lang={lang}
                                  c={c}
                                  menuOpen={openMenuId === event.id}
                                  onToggleMenu={() =>
                                    setOpenMenuId((cur) =>
                                      cur === event.id ? null : event.id
                                    )
                                  }
                                  onCloseMenu={() => setOpenMenuId(null)}
                                  onEdit={() => handleEditEvent(event.id)}
                                  onDelete={() => handleDeleteEvent(event.id)}
                                />
                              ))}

                              {daySlots.map(({ hour, posts: slotPosts }) => (
                                <PostSlot
                                  key={hour}
                                  hour={hour}
                                  posts={slotPosts}
                                  renderChip={(p) => renderPostChip(p, true)}
                                  isDark={isDark}
                                  c={c}
                                  onMore={() => setMore({ date: day.date, hour })}
                                />
                              ))}

                              {day.isToday && showNowLine && (
                                <div
                                  className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                                  style={{
                                    top: (nowHour - START_HOUR) * HOUR_HEIGHT,
                                  }}
                                >
                                  <span
                                    className={[
                                      "-ml-[42px] rounded-full px-1.5 py-1 text-[10px] font-semibold md:-ml-[44px] md:px-2",
                                      isDark
                                        ? "bg-white text-neutral-900"
                                        : "bg-neutral-900 text-white",
                                    ].join(" ")}
                                  >
                                    {nowLabel}
                                  </span>
                                  <span
                                    className={[
                                      "h-px flex-1",
                                      isDark ? "bg-white/40" : "bg-neutral-900/70",
                                    ].join(" ")}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <OffScreenPostStack
                      items={offScreenPosts.above}
                      direction="up"
                      isDark={isDark}
                      c={c}
                      lang={lang}
                      onSelect={scrollToOffScreenPost}
                    />
                    <OffScreenPostStack
                      items={offScreenPosts.below}
                      direction="down"
                      isDark={isDark}
                      c={c}
                      lang={lang}
                      onSelect={scrollToOffScreenPost}
                      bottomOffset={isMobile ? "bottom-3" : "bottom-24"}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid shrink-0 grid-cols-7">
                    {c.weekdaysLong.map((d) => (
                      <div
                        key={d}
                        className={[
                          "truncate border-b px-0.5 py-2 text-center text-[11px] md:text-[12px]",
                          calendarBorder,
                          isDark
                            ? "font-medium text-neutral-400"
                            : "font-medium text-neutral-500",
                        ].join(" ")}
                      >
                        {isMobile ? d.slice(0, 3) : d}
                      </div>
                    ))}
                  </div>

                  <div
                    ref={monthGridRef}
                    className="min-h-0 flex-1 overflow-hidden"
                  >
                    <div
                      className="grid h-full grid-cols-7"
                      style={{
                        gridTemplateRows: `repeat(${monthRowCount}, minmax(0, 1fr))`,
                      }}
                    >
                      {days.map((day, i) => {
                        if (!day) {
                          return (
                            <div
                              key={`empty-${i}`}
                              className={[
                                "min-h-0 border-b border-r",
                                calendarBorder,
                                isDark ? "bg-white/[0.01]" : "bg-black/[0.01]",
                              ].join(" ")}
                            />
                          );
                        }

                        const key = day.date.toDateString();
                        const items = monthItemsByDate.get(key) ?? [];
                        const shown = visibleCountFor(items);
                        const hiddenCount = items.length - shown;

                        const dayNumber = (
                          <span
                            className={[
                              "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11.5px] font-semibold tabular-nums",
                              day.isToday
                                ? isDark
                                  ? "bg-white text-neutral-900"
                                  : "bg-neutral-900 text-white"
                                : isDark
                                  ? "text-neutral-400"
                                  : "text-neutral-500",
                            ].join(" ")}
                          >
                            {day.n}
                          </span>
                        );

                        /* Mobile : cellule compacte avec pastilles, tap → liste du jour */
                        if (isMobile) {
                          return (
                            <button
                              key={day.date.toISOString()}
                              type="button"
                              onClick={() =>
                                items.length > 0 &&
                                setMore({ date: day.date, hour: null })
                              }
                              className={[
                                "flex min-h-0 min-w-0 flex-col items-center gap-1.5 border-b border-r pt-1.5 transition-colors",
                                calendarBorder,
                                day.isToday
                                  ? isDark
                                    ? "bg-white/[0.04]"
                                    : "bg-black/[0.02]"
                                  : "",
                              ].join(" ")}
                            >
                              {dayNumber}
                              {items.length > 0 && (
                                <span className="flex flex-wrap items-center justify-center gap-[3px] px-1">
                                  {items.slice(0, 3).map((item) => (
                                    <span
                                      key={item.id}
                                      className={[
                                        "h-1.5 w-1.5 rounded-full",
                                        isDark ? "bg-white/70" : "bg-neutral-700",
                                      ].join(" ")}
                                    />
                                  ))}
                                  {items.length > 3 && (
                                    <span
                                      className={[
                                        "text-[9px] font-semibold leading-none",
                                        isDark
                                          ? "text-neutral-400"
                                          : "text-neutral-500",
                                      ].join(" ")}
                                    >
                                      +{items.length - 3}
                                    </span>
                                  )}
                                </span>
                              )}
                            </button>
                          );
                        }

                        return (
                          <div
                            key={day.date.toISOString()}
                            className={[
                              "flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-r transition-colors",
                              calendarBorder,
                              day.isToday
                                ? isDark
                                  ? "bg-white/[0.04]"
                                  : "bg-black/[0.02]"
                                : "",
                              dragOverKey === key
                                ? isDark
                                  ? "bg-white/[0.08]"
                                  : "bg-black/[0.04]"
                                : "",
                            ].join(" ")}
                            style={{ padding: MONTH_CELL_PAD, gap: MONTH_GAP }}
                            onDragOver={(e) => handleDragOver(e, day.date)}
                            onDragLeave={clearDragOver}
                            onDrop={(e) => handleDrop(e, day.date)}
                          >
                            <div
                              className="flex shrink-0 items-center"
                              style={{ height: MONTH_CELL_HEADER }}
                            >
                              {dayNumber}
                            </div>

                            {items.slice(0, shown).map((item) => (
                              <div key={item.id} className="flex flex-col">
                                {renderMonthItem(item)}
                              </div>
                            ))}

                            {hiddenCount > 0 && (
                              <MoreRow
                                count={hiddenCount}
                                isDark={isDark}
                                c={c}
                                onClick={() =>
                                  setMore({ date: day.date, hour: null })
                                }
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {calendarOpen && (
        <CalendarSheet
          isDark={isDark}
          c={c}
          view={view}
          date={viewDate}
          onViewChange={setView}
          onPick={setViewDate}
          onToday={() => setViewDate(new Date())}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      {more && (
        <DayDetailModal
          isDark={isDark}
          title={moreTitle}
          items={moreItems}
          renderItem={renderMonthItem}
          c={c}
          onClose={() => setMore(null)}
        />
      )}

      {eventFormOpen && (
        <EventFormModal
          isDark={isDark}
          tags={apiTags}
          weekStart={rangeStart}
          c={c}
          initial={
            editingEvent
              ? {
                  title: editingEvent.title,
                  day: editingEvent.day,
                  dateStr: editingEvent.dateStr,
                  start: editingEvent.start,
                  end: editingEvent.end,
                  tagId: editingEvent.tagId,
                }
              : null
          }
          onCancel={() => {
            setEventFormOpen(false);
            setEditingEventId(null);
          }}
          onSave={handleSaveEvent}
        />
      )}

      <Folder
        isOpen={isFolderOpen}
        onClose={() => setIsFolderOpen(false)}
        isDark={isDark}
        offsetLeft={sidebarOffset}
      />

      <BottomBar
        isDark={isDark}
        offsetLeft={sidebarOffset}
        active={isFolderOpen ? "files" : null}
        onChange={handleBottomBarChange}
        onCreatePost={openNewPost}
        query={bottomQuery}
        onQueryChange={setBottomQuery}
      />

      <NewPostModal
        isOpen={isNewPostOpen}
        onClose={() => {
          setIsNewPostOpen(false);
          setNewPostDate(null);
        }}
        isDark={isDark}
        onSubmit={handleCreatePost}
        initialScheduledAt={newPostDate}
        onRequestOpen={() => setIsNewPostOpen(true)}
        onViewInCalendar={(d) => {
          pendingFocusRef.current = d.getTime();
          setView((v) => (v === "month" ? gridViewFallback : v));
          setViewDate(d);
          setPostsTick((n) => n + 1);
          setFocusNonce((n) => n + 1);
        }}
      />

      <HelpChatButton isDark={isDark} />
    </main>
  );
}