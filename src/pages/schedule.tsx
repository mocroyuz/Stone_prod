// src/pages/Schedule.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
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
import ChannelMenu from "../components/ChannelMenu";
import { useConnectedChannels } from "../hooks/useConnectedChannels";
import HelpChatButton from "../components/Helpchatbutton";

import {
  createPosts,
  listPosts,
  tagHex,
  isPostPosted,
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
/* Shell (identique à Home)                                            */
/* ------------------------------------------------------------------ */

const pageBgClass = (isDark: boolean) =>
  isDark ? "bg-[#09090a]" : "bg-[#f5f3ef]";

const mainPanelClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#0f0f11]"
    : "border-black/[0.06] bg-white";

const mutedClass = (isDark: boolean) =>
  isDark ? "text-neutral-500" : "text-neutral-400";

const strongClass = (isDark: boolean) =>
  isDark ? "text-white" : "text-neutral-900";

const focusRingClass = (isDark: boolean) =>
  isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

/** Route de cette page dans la sidebar (section Favorite). */
const PAGE_ROUTE = "schedule";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function useHashChannel(): string | null {
  useHashRoute();
  return new URLSearchParams(window.location.search).get("channel");
}

/* ------------------------------------------------------------------ */
/* Tags (mêmes tags Supabase que Create.tsx)                           */
/* ------------------------------------------------------------------ */

const UNASSIGNED = "unassigned";

const UNASSIGNED_TAG: ApiTag = {
  id: UNASSIGNED,
  label: "Unassigned",
  color: "bg-neutral-400",
};

const UNASSIGNED_HEX = "#a3a3a3";

const DEFAULT_ORDER = ["to do", "in progress"];

/** Couleur hexadécimale d'un tag (gère le tag « Unassigned »). */
const hexOf = (t: ApiTag) => (t.id === UNASSIGNED ? UNASSIGNED_HEX : tagHex(t.color));

/** Un élément sans tag est traité comme « Unassigned ». */
const passesTagFilter = (ids: string[], hidden: string[]) => {
  const list = ids.length ? ids : [UNASSIGNED];
  return list.some((id) => !hidden.includes(id));
};

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="currentColor">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 7.5 3 3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M9 7V4.5h6V7" />
      <path d="M6.5 7 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

function CheckIcon({ className = "h-[11px] w-[11px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 12 6 6L20 6" />
    </svg>
  );
}

function ArrowUpIcon({ className = "h-[14px] w-[14px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function ArrowDownIcon({ className = "h-[14px] w-[14px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10.5h17" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[16px] w-[16px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function PostsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="13" height="13" rx="2" />
      <path d="M8 20h11a2 2 0 0 0 2-2V8" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1" fill="currentColor" />
    </svg>
  );
}

function NoDateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="m16 10-2 2 2 2" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </svg>
  );
}

function MoreVerticalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="currentColor">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

/** Icône marque-page (ajout / retrait des favoris). */
function BookmarkIcon({
  className,
  filled = false,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-4 w-4"}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.8L6 20V5.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar building blocks                                             */
/* ------------------------------------------------------------------ */

type ToolbarPanel = "view" | "posts" | "tags" | "timezone" | "more";

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
        <span className={["flex transition-transform duration-200", open ? "rotate-180" : ""].join(" ")}>
          <ChevronDownIcon />
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
        "flex h-8 w-8 items-center justify-center rounded-lg transition",
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
        "absolute top-full z-40 mt-2 overflow-hidden rounded-xl border py-1.5 shadow-lg",
        align === "right" ? "right-0" : "left-0",
        width,
        isDark ? "border-white/[0.08] bg-[#16161a]" : "border-black/[0.06] bg-white",
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
        "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[12.5px] transition",
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
      {selected && <CheckIcon />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

const LOCALE = "en-US";

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/* ------------------------------------------------------------------ */
/* Time <-> decimal hour helpers                                       */
/* ------------------------------------------------------------------ */

const TIME_ANCHOR = new Date(2024, 0, 1);

function hourToDate(h: number): Date {
  const d = new Date(TIME_ANCHOR);
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  d.setHours(hh, mm, 0, 0);
  return d;
}

function dateToHour(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

type CalendarEvent = {
  id: string;
  day: number;
  start: number;
  end: number;
  title: string;
  /** Id d'un tag Supabase (absent = Unassigned). */
  tagId?: string;
  /** Channel auquel l'événement appartient (absent = visible sur tous). */
  channelKey?: string;
  confirmed?: boolean;
  published?: boolean;
};

const START_HOUR = 0;
const END_HOUR = 24;
const SPAN = END_HOUR - START_HOUR;

/** Les cartes de post font ~1 h de haut. */
const HOUR_HEIGHT = 128;
const POST_SPAN = 1; // une carte de post occupe 1 h dans la grille

const TOTAL_HEIGHT = SPAN * HOUR_HEIGHT;

const DEFAULT_SCROLL_HOUR = 8;
const NOW_CONTEXT_HOURS = 2;

const HOURS = Array.from({ length: SPAN + 1 }, (_, i) => START_HOUR + i);

function formatTime(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${String(mm).padStart(2, "0")}`;
}

function formatEventTime(start: number, end: number) {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

const VIEW_OPTIONS = ["Week"];
const TIMEZONES = ["Paris", "London", "New York", "Tokyo"];
const SCOPE_OPTIONS = ["All", "Publié", "À publier"];

/* ------------------------------------------------------------------ */
/* Style neutre (événement sans tag)                                   */
/* ------------------------------------------------------------------ */

const NEUTRAL_STYLE = {
  bgLight: "bg-neutral-100",
  bgDark: "bg-neutral-800",
  borderLight: "border-neutral-200",
  borderDark: "border-neutral-700",
};

/* ------------------------------------------------------------------ */
/* Layout des événements (calendrier)                                  */
/* ------------------------------------------------------------------ */

type PositionedEvent = {
  event: CalendarEvent;
  depth: number;
};

function layoutDayEvents(events: CalendarEvent[]): PositionedEvent[] {
  if (events.length === 0) return [];

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
    for (let k = i; k < j; k++) {
      result.push({ event: sorted[k], depth: k - i });
    }
    i = j;
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Posts : icônes, layout côte-à-côte, carte                           */
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

type PositionedPost = { post: CalendarPost; start: number; col: number; cols: number };

/** Place côte à côte les posts qui se chevauchent (même heure ou à moins d'1 h). */
function layoutPosts(list: { post: CalendarPost; start: number }[]): PositionedPost[] {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const out: PositionedPost[] = [];
  let cluster: PositionedPost[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    cluster.forEach((c) => (c.cols = colEnds.length));
    out.push(...cluster);
    cluster = [];
    colEnds = [];
    clusterEnd = -1;
  };

  for (const item of sorted) {
    if (cluster.length && item.start >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= item.start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(0);
    }
    colEnds[col] = item.start + POST_SPAN;
    cluster.push({ ...item, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, item.start + POST_SPAN);
  }
  flush();
  return out;
}

function PostCard({
  item, tagsById, isDark, posted,
}: {
  item: PositionedPost;
  tagsById: Map<string, ApiTag>;
  isDark: boolean;
  posted: boolean;
}) {
  const { post, start, col, cols } = item;
  const [expanded, setExpanded] = useState(false);

  const Icon = NETWORK_ICONS[post.network];
  const cover = post.media[0];
  const tags = post.tagIds.map((id) => tagsById.get(id)).filter(Boolean) as ApiTag[];
  const time = new Date(post.scheduledAt).toLocaleTimeString(LOCALE, {
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  const height = HOUR_HEIGHT * POST_SPAN - 6;
  const width = 100 / cols;

  return (
    <div
      tabIndex={0}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={() => setExpanded(false)}
      className={[
        "absolute flex flex-col justify-between gap-2 rounded-2xl border p-3.5 outline-none transition-[box-shadow,opacity,filter]",
        isDark ? "border-white/[0.08] bg-[#1c1c1e]" : "border-black/[0.08] bg-white",
        expanded ? "shadow-xl" : "overflow-hidden",
        posted ? "opacity-60 grayscale" : "",
      ].join(" ")}
      style={{
        top: start * HOUR_HEIGHT,
        left: `calc(${col * width}% + 4px)`,
        width: `calc(${width}% - 8px)`,
        zIndex: expanded ? 50 : 2,
        ...(expanded ? { minHeight: height } : { height }),
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]",
            isDark ? "bg-[#e4e4e7] text-[#111]" : "bg-neutral-900 text-white",
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className={["truncate text-[17px] font-bold tracking-[-0.02em]", isDark ? "text-neutral-100" : "text-neutral-800"].join(" ")}>
          {time}
        </span>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap content-end gap-1">
          {posted && (
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                isDark ? "bg-white/10 text-neutral-200" : "bg-black/[0.06] text-neutral-700",
              ].join(" ")}
            >
              <CheckIcon className="h-[9px] w-[9px]" />
              Posted
            </span>
          )}
          {tags.map((tag) => {
            const hex = tagHex(tag.color);
            return (
              <span
                key={tag.id}
                className={[
                  "inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  isDark ? "text-neutral-200" : "text-neutral-700",
                ].join(" ")}
                style={{ backgroundColor: `${hex}26` }}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: hex }} />
                <span className="truncate">{tag.label}</span>
              </span>
            );
          })}
        </div>

        {cover && (
          <div className="relative h-[56px] w-[56px] shrink-0 overflow-hidden rounded-xl shadow-sm">
            {cover.kind === "image" ? (
              <img src={cover.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <video src={`${cover.url}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
            )}
            {post.media.length > 1 && (
              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] font-semibold text-white">
                +{post.media.length - 1}
              </span>
            )}
          </div>
        )}
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
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onEdit,
  onDelete,
}: EventCardProps) {
  const hex = tag ? hexOf(tag) : null;
  const top = (event.start - START_HOUR) * HOUR_HEIGHT;
  const height = (event.end - event.start) * HOUR_HEIGHT - 6;

  const [hovered, setHovered] = useState(false);
  const isFront = hovered || menuOpen;
  const zIndex = isFront ? 50 : depth + 1;

  const handleEdit = () => {
    onCloseMenu();
    onEdit();
  };
  const handleDelete = () => {
    onCloseMenu();
    onDelete();
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        "absolute inset-x-1 flex flex-col gap-2 rounded-xl border px-3 py-2.5 transition-[box-shadow]",
        isFront ? "shadow-lg" : "",
        !tag && (isDark ? NEUTRAL_STYLE.bgDark : NEUTRAL_STYLE.bgLight),
        !tag && (isDark ? NEUTRAL_STYLE.borderDark : NEUTRAL_STYLE.borderLight),
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        top,
        height,
        minHeight: 44,
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
          <p className={["truncate text-[12.5px] font-semibold", isDark ? "text-neutral-100" : "text-neutral-800"].join(" ")}>
            {event.title}
          </p>
          <p className={["mt-0.5 truncate text-[10.5px]", isDark ? "text-neutral-400" : "text-neutral-500"].join(" ")}>
            {formatEventTime(event.start, event.end)}
          </p>
        </div>

        <div className="relative shrink-0" data-event-menu>
          <button
            type="button"
            aria-label={`Options ${event.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={onToggleMenu}
            className={[
              "rounded-full p-0.5 transition",
              menuOpen ? (isDark ? "bg-white/[0.08]" : "bg-black/[0.05]") : "",
              isDark ? "text-neutral-400 hover:bg-white/[0.08]" : "text-neutral-400 hover:bg-black/[0.05]",
            ].join(" ")}
          >
            <MoreIcon />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className={[
                "absolute right-0 top-full z-40 mt-1.5 w-36 overflow-hidden rounded-xl border py-1 shadow-lg",
                isDark ? "border-white/[0.08] bg-[#16161a]" : "border-black/[0.06] bg-white",
              ].join(" ")}
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleEdit}
                className={[
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] transition",
                  isDark ? "text-neutral-200 hover:bg-white/[0.05]" : "text-neutral-700 hover:bg-black/[0.03]",
                ].join(" ")}
              >
                <PencilIcon />
                Modifier
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleDelete}
                className={[
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] transition",
                  isDark ? "text-rose-300 hover:bg-white/[0.05]" : "text-rose-600 hover:bg-black/[0.03]",
                ].join(" ")}
              >
                <TrashIcon />
                Supprimer
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
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: hex ?? undefined }} />
          <span className="truncate">{tag.label}</span>
        </span>
      )}

      {event.confirmed && (
        <span
          className={[
            "flex w-fit items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-medium",
            isDark ? "bg-white/[0.08] text-white" : "bg-white text-neutral-700 shadow-sm",
          ].join(" ")}
        >
          <CheckIcon className="h-[9px] w-[9px]" />
          Confirmed
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
  start: number;
  end: number;
  tagId?: string;
};

function EventFormModal({
  isDark,
  tags,
  weekStart,
  initial,
  onCancel,
  onSave,
}: {
  isDark: boolean;
  tags: ApiTag[];
  weekStart: Date;
  initial: EventFormData | null;
  onCancel: () => void;
  onSave: (data: EventFormData) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");

  const [date, setDate] = useState<Date>(() =>
    initial ? addDays(weekStart, initial.day) : new Date(),
  );
  const [startDate, setStartDate] = useState<Date>(() => hourToDate(initial?.start ?? 9));
  const [endDate, setEndDate] = useState<Date>(() => hourToDate(initial?.end ?? 10));
  const [tagId, setTagId] = useState<string>(initial?.tagId ?? "");

  const start = dateToHour(startDate);
  const end = dateToHour(endDate);
  const canSave = title.trim().length > 0 && end > start;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const submit = () => {
    if (!canSave) return;
    const day = (date.getDay() + 6) % 7;
    onSave({
      title: title.trim(),
      day,
      start,
      end,
      tagId: tagId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        className={[
          "relative z-10 w-full max-w-md rounded-2xl border p-5 shadow-2xl",
          isDark ? "border-white/[0.08] bg-[#16161a]" : "border-black/[0.06] bg-white",
        ].join(" ")}
      >
        <h2
          className={[
            "mb-4 text-[17px] font-semibold tracking-[-0.02em]",
            isDark ? "text-white" : "text-neutral-900",
          ].join(" ")}
        >
          {initial ? "Modifier l'événement" : "Nouvel événement"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className={["mb-1 block text-[11px] font-medium", isDark ? "text-neutral-500" : "text-neutral-400"].join(" ")}>
              Titre
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Titre de l'événement"
              className={fieldClass(isDark)}
            />
          </div>

          <div>
            <label className={["mb-1.5 block text-[11px] font-medium", isDark ? "text-neutral-500" : "text-neutral-400"].join(" ")}>
              Date et heure
            </label>
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
            <label className={["mb-1 block text-[11px] font-medium", isDark ? "text-neutral-500" : "text-neutral-400"].join(" ")}>
              Tag
            </label>
            <select
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
              style={{ colorScheme: isDark ? "dark" : "light" }}
              className={fieldClass(isDark)}
            >
              <option value="">Unassigned</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {!canSave && (
            <p className={["text-[11px]", isDark ? "text-rose-300" : "text-rose-600"].join(" ")}>
              Renseigne un titre et une heure de fin postérieure à l'heure de début.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={[
              "rounded-full px-3.5 py-2 text-[12.5px] font-medium transition",
              isDark ? "text-neutral-300 hover:bg-white/[0.05]" : "text-neutral-600 hover:bg-black/[0.05]",
            ].join(" ")}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className={[
              "rounded-full px-4 py-2 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
              isDark ? "bg-white text-neutral-900 hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-neutral-800",
            ].join(" ")}
          >
            {initial ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Schedule() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const sidebarOffset = useSidebarOffset();
  const channels = useConnectedChannels();

  // Favoris partagés avec la sidebar : le marque-page du header ajoute /
  // retire cette page de la section « Favorite ».
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const saved = isFavorite(PAGE_ROUTE);

  const hashChannel = useHashChannel();
  const [selectedKey, setSelectedKey] = useState<string | null>(hashChannel);

  useEffect(() => {
    if (hashChannel) setSelectedKey(hashChannel);
  }, [hashChannel]);

  const channel = channels.find((c) => c.key === selectedKey) ?? channels[0];
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

  // État lié aux posts et aux tags (chargés depuis Supabase)
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [apiTags, setApiTags] = useState<ApiTag[]>([]);
  const [postsTick, setPostsTick] = useState(0);

  const allTags = useMemo(() => [UNASSIGNED_TAG, ...apiTags], [apiTags]);
  const tagsById = useMemo(() => new Map(apiTags.map((t) => [t.id, t])), [apiTags]);

  // Tags masqués (filtre du menu Tags, comme Create)
  const [hiddenTags, setHiddenTags] = useState<string[]>([]);

  const [weekOffset, setWeekOffset] = useState(0);
  const [openPanel, setOpenPanel] = useState<ToolbarPanel | null>(null);
  const [view, setView] = useState("Week");
  const [timezone, setTimezone] = useState("Paris");
  const [showNoDate, setShowNoDate] = useState(false);
  const [scope, setScope] = useState("All");

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

  useEffect(() => {
    if (openMenuId === null) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-event-menu]")) setOpenMenuId(null);
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

    const closeAll = () => {
      setOpenPanel(null);
    };
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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const n = new Date();
    const hour = n.getHours() + n.getMinutes() / 60;
    const target =
      weekOffset === 0
        ? Math.max(0, (hour - NOW_CONTEXT_HOURS - START_HOUR) * HOUR_HEIGHT)
        : (DEFAULT_SCROLL_HOUR - START_HOUR) * HOUR_HEIGHT;

    el.scrollTop = target;
    setScrollTop(el.scrollTop);
  }, [weekOffset]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      setViewportHeight(el.clientHeight);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const weekStart = useMemo(
    () => addDays(startOfWeek(now), weekOffset * 7),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now.toDateString(), weekOffset],
  );

  // Chargement des posts pour la semaine courante
  useEffect(() => {
    let cancelled = false;
    listPosts(weekStart, addDays(weekStart, 7))
      .then((p) => {
        if (!cancelled) setPosts(p);
      })
      .catch((e) => console.error("Could not load posts:", e));
    return () => {
      cancelled = true;
    };
  }, [weekStart, postsTick]);

  // Chargement des tags (mêmes tags par défaut et même ordre que Create)
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

  // Resynchronise quand on revient sur l'onglet
  useEffect(() => {
    const onFocus = () => setPostsTick((n) => n + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        return {
          date,
          n: date.getDate(),
          label: date.toLocaleDateString(LOCALE, { weekday: "short" }),
          isToday: date.toDateString() === now.toDateString(),
        };
      }),
    [weekStart, now],
  );

  const monthLabel = days[3].date.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });

  const togglePanel = (panel: ToolbarPanel) => {
    setOpenPanel((cur) => (cur === panel ? null : panel));
  };

  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowLabel = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  const showNowLine = nowHour >= START_HOUR && nowHour <= END_HOUR;

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const visibleEvents = useMemo(
    () =>
      events.filter((e) => {
        const matchChannel = !e.channelKey || !channelKey || e.channelKey === channelKey;
        const matchTag = passesTagFilter(e.tagId ? [e.tagId] : [], hiddenTags);
        const matchScope =
          scope === "All" ||
          (scope === "Publié" && e.published) ||
          (scope === "À publier" && !e.published);
        return matchChannel && matchTag && matchScope;
      }),
    [events, hiddenTags, scope, channelKey],
  );

  const layoutByDay = useMemo(() => {
    const map = new Map<number, PositionedEvent[]>();
    const raw = new Map<number, CalendarEvent[]>();
    for (let i = 0; i < 7; i++) raw.set(i, []);
    visibleEvents.forEach((e) => raw.get(e.day)?.push(e));
    for (const [day, list] of raw) {
      map.set(day, layoutDayEvents(list));
    }
    return map;
  }, [visibleEvents]);

  // Regroupement des posts par jour (avec layout côte-à-côte)
  const postsByDay = useMemo(() => {
    const raw = new Map<number, { post: CalendarPost; start: number }[]>();
    for (let i = 0; i < 7; i++) raw.set(i, []);

    for (const post of posts) {
      if (post.channelKey && channelKey && post.channelKey !== channelKey) continue;
      const posted = isPostPosted(post, now);
      if (scope === "Publié" && !posted) continue;
      if (scope === "À publier" && posted) continue;
      if (!passesTagFilter(post.tagIds, hiddenTags)) continue;

      const d = new Date(post.scheduledAt);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const idx = Math.round((dayStart.getTime() - weekStart.getTime()) / 86_400_000);
      if (idx < 0 || idx > 6) continue;
      raw.get(idx)!.push({ post, start: d.getHours() + d.getMinutes() / 60 });
    }

    const map = new Map<number, PositionedPost[]>();
    for (const [day, list] of raw) map.set(day, layoutPosts(list));
    return map;
  }, [posts, channelKey, scope, now, weekStart, hiddenTags]);

  // Items "scroll" unifiés (événements + posts) pour les flèches haut/bas
  const scrollItems = useMemo(
    () => [
      ...visibleEvents.map((e) => ({ start: e.start, end: e.end })),
      ...[...postsByDay.values()]
        .flat()
        .map((p) => ({ start: p.start, end: p.start + POST_SPAN })),
    ],
    [visibleEvents, postsByDay],
  );

  const hiddenAbove = useMemo(() => {
    if (viewportHeight === 0) return false;
    return scrollItems.some((item) => {
      const bottom = (item.end - START_HOUR) * HOUR_HEIGHT;
      return bottom <= scrollTop;
    });
  }, [scrollItems, scrollTop, viewportHeight]);

  const hiddenBelow = useMemo(() => {
    if (viewportHeight === 0) return false;
    const viewportBottom = scrollTop + viewportHeight;
    return scrollItems.some((item) => {
      const top = (item.start - START_HOUR) * HOUR_HEIGHT;
      return top >= viewportBottom;
    });
  }, [scrollItems, scrollTop, viewportHeight]);

  const scrollToNextHidden = (direction: "up" | "down") => {
    const el = scrollRef.current;
    if (!el) return;

    const tops = scrollItems.map((item) => (item.start - START_HOUR) * HOUR_HEIGHT);
    if (tops.length === 0) return;

    if (direction === "up") {
      const candidates = tops.filter((t) => t < scrollTop);
      const target = candidates.length ? Math.max(...candidates) : 0;
      el.scrollTo({ top: Math.max(0, target - HOUR_HEIGHT / 2), behavior: "smooth" });
    } else {
      const viewportBottom = scrollTop + viewportHeight;
      const candidates = tops.filter((t) => t >= viewportBottom);
      const target = candidates.length ? Math.min(...candidates) : 0;
      el.scrollTo({ top: Math.max(0, target - HOUR_HEIGHT / 2), behavior: "smooth" });
    }
  };

  /* ---------------- Tags (Supabase) ---------------- */

  const toggleHiddenTag = (id: string) =>
    setHiddenTags((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  /* ---------------- Événements ---------------- */

  const handleDeleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (editingEventId === id) {
      setEventFormOpen(false);
      setEditingEventId(null);
    }
  };

  const handleEditEvent = (id: string) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
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
        prev.map((e) => (e.id === editingEventId ? { ...e, ...data } : e)),
      );
    } else {
      const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setEvents((prev) => [...prev, { id, ...data, channelKey, published: false }]);
    }
    setEventFormOpen(false);
    setEditingEventId(null);
  };

  const editingEvent = editingEventId ? events.find((e) => e.id === editingEventId) ?? null : null;

  const handleBottomBarChange = (id: BottomBarTab) => {
    switch (id) {
      case "add":
        setIsFolderOpen(false);
        setNewPostDate(null);
        setIsNewPostOpen(true);
        break;
      case "files":
        setIsFolderOpen((open) => !open);
        break;
    }
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

  // Création réelle d'un post via le service
  const handleCreatePost = async (payload: NewPostPayload) => {
    await createPosts(payload);
    setPostsTick((n) => n + 1);
  };

  const calendarBorder = isDark ? "border-white/[0.07]" : "border-black/[0.06]";
  const calendarHead = isDark ? "border-white/[0.07]" : "border-black/[0.06]";

  return (
    <main
      className={[
        "relative h-screen w-full overflow-hidden",
        "transition-colors duration-300",
        pageBgClass(isDark),
      ].join(" ")}
    >
      <DashboardSidebar theme={theme} />

      <div
        className={[
          "h-full py-3 pr-3",
          "transition-[padding-left] duration-[380ms]",
          "ease-[cubic-bezier(0.4,0,0.2,1)]",
          "motion-reduce:transition-none",
        ].join(" ")}
        style={{ paddingLeft: sidebarOffset }}
      >
        {/* PANNEAU ARRONDI (flex column car le calendrier doit remplir la hauteur) */}
        <div
          className={[
            "flex h-full flex-col overflow-hidden",
            "rounded-[28px] border",
            "transition-colors duration-300",
            mainPanelClass(isDark),
          ].join(" ")}
        >
          <div
            className={[
              "flex min-h-0 w-full flex-1 flex-col",
              "px-[clamp(18px,3vw,48px)]",
              "pb-4 pt-[clamp(18px,3vw,30px)]",
            ].join(" ")}
          >
            {/* HEADER COMPACT */}
            <div className="relative z-40 mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                    isDark
                      ? "border-white/[0.07] bg-white/[0.04] text-neutral-400"
                      : "border-black/[0.06] bg-white text-neutral-500",
                  ].join(" ")}
                >
                  <CalendarIcon />
                </span>
                <h1
                  className={[
                    "truncate text-[20px] font-semibold tracking-[-0.03em]",
                    strongClass(isDark),
                  ].join(" ")}
                >
                  Publish
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 print:hidden">
                <ChannelMenu
                  channels={channels}
                  current={channel}
                  isDark={isDark}
                  onSelect={goChannel}
                />

                {/* Marque-page : ajoute / retire cette page des favoris de la sidebar */}
                <button
                  type="button"
                  aria-label={saved ? "Remove from favorites" : "Add to favorites"}
                  aria-pressed={saved}
                  title={saved ? "Remove from favorites" : "Add to favorites"}
                  onClick={() => toggleFavorite(PAGE_ROUTE)}
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors motion-reduce:transition-none",
                    focusRingClass(isDark),
                    isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]",
                  ].join(" ")}
                >
                  <BookmarkIcon className="h-5 w-5" filled={saved} />
                </button>
              </div>
            </div>

            {/* TOOLBAR */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex items-center gap-1">
                <ToolbarIconButton isDark={isDark} label="Previous week" onClick={() => setWeekOffset((o) => o - 1)}>
                  <ChevronLeftIcon />
                </ToolbarIconButton>
                <ToolbarIconButton isDark={isDark} label="Next week" onClick={() => setWeekOffset((o) => o + 1)}>
                  <ChevronRightIcon />
                </ToolbarIconButton>

                <h2
                  className={[
                    "mx-3 text-[19px] font-semibold tracking-[-0.03em]",
                    strongClass(isDark),
                  ].join(" ")}
                >
                  {monthLabel}
                </h2>

                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className={[
                    "rounded-lg border px-4 py-1.5 text-[13px] font-medium transition",
                    focusRingClass(isDark),
                    isDark
                      ? "border-white/[0.08] bg-white/[0.03] text-white hover:bg-white/[0.08]"
                      : "border-black/[0.06] bg-white text-neutral-900 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  Today
                </button>

                <div className="relative ml-3" data-toolbar-menu>
                  <ToolbarButton isDark={isDark} open={openPanel === "view"} onClick={() => togglePanel("view")}>
                    {view}
                  </ToolbarButton>
                  {openPanel === "view" && (
                    <MenuPanel isDark={isDark} width="w-40">
                      {VIEW_OPTIONS.map((option) => (
                        <MenuItem
                          key={option}
                          isDark={isDark}
                          selected={view === option}
                          onClick={() => {
                            setView(option);
                            setOpenPanel(null);
                          }}
                        >
                          {option}
                        </MenuItem>
                      ))}
                    </MenuPanel>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {/* All Posts */}
                <div className="relative" data-toolbar-menu>
                  <ToolbarButton
                    isDark={isDark}
                    icon={<PostsIcon />}
                    open={openPanel === "posts"}
                    onClick={() => togglePanel("posts")}
                  >
                    {scope === "All" ? "All Posts" : scope}
                  </ToolbarButton>
                  {openPanel === "posts" && (
                    <MenuPanel isDark={isDark} align="right" width="w-44">
                      {SCOPE_OPTIONS.map((option) => (
                        <MenuItem
                          key={option}
                          isDark={isDark}
                          selected={scope === option}
                          onClick={() => {
                            setScope(option);
                            setOpenPanel(null);
                          }}
                        >
                          {option === "All" ? "All Posts" : option}
                        </MenuItem>
                      ))}
                    </MenuPanel>
                  )}
                </div>

                {/* Tags (Supabase, comme Create) */}
                <div className="relative" data-toolbar-menu>
                  <ToolbarButton
                    isDark={isDark}
                    icon={<TagIcon />}
                    open={openPanel === "tags"}
                    onClick={() => togglePanel("tags")}
                  >
                    Tags
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
                                className={`flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-2 text-left text-[12.5px] transition ${
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
                    </MenuPanel>
                  )}
                </div>

                {/* No Date */}
                <ToolbarButton
                  isDark={isDark}
                  icon={<NoDateIcon />}
                  chevron={false}
                  active={showNoDate}
                  onClick={() => setShowNoDate((v) => !v)}
                >
                  No Date
                </ToolbarButton>

                <span className={["mx-1 h-5 w-px", isDark ? "bg-white/[0.08]" : "bg-black/[0.08]"].join(" ")} />

                {/* Fuseau horaire */}
                <div className="relative" data-toolbar-menu>
                  <ToolbarButton
                    isDark={isDark}
                    icon={<GlobeIcon />}
                    open={openPanel === "timezone"}
                    onClick={() => togglePanel("timezone")}
                  >
                    {timezone}
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
                          {tz}
                        </MenuItem>
                      ))}
                    </MenuPanel>
                  )}
                </div>

                {/* Plus */}
                <div className="relative" data-toolbar-menu>
                  <ToolbarIconButton
                    isDark={isDark}
                    label="Plus d'options"
                    open={openPanel === "more"}
                    onClick={() => togglePanel("more")}
                  >
                    <MoreVerticalIcon />
                  </ToolbarIconButton>
                  {openPanel === "more" && (
                    <MenuPanel isDark={isDark} align="right" width="w-44">
                      <MenuItem
                        isDark={isDark}
                        icon={<PlusIcon />}
                        onClick={() => {
                          setOpenPanel(null);
                          handleAddEvent();
                        }}
                      >
                        Add event
                      </MenuItem>
                    </MenuPanel>
                  )}
                </div>
              </div>
            </div>

            {/* CALENDAR */}
            <div
              className={[
                "mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border",
                calendarBorder,
                isDark ? "bg-white/[0.02]" : "bg-white",
              ].join(" ")}
            >
              <div className="grid shrink-0 grid-cols-[56px_repeat(7,minmax(0,1fr))]">
                <div className={["border-b", calendarHead].join(" ")} />
                {days.map((day) => (
                  <div
                    key={day.date.toISOString()}
                    className={[
                      "flex items-center justify-center gap-2 border-b border-l py-3 text-[12.5px]",
                      calendarHead,
                      day.isToday
                        ? isDark
                          ? "font-semibold text-white"
                          : "font-semibold text-neutral-900"
                        : isDark
                          ? "font-medium text-neutral-400"
                          : "font-medium text-neutral-500",
                    ].join(" ")}
                  >
                    <span>{day.label}</span>
                    <span
                      className={[
                        "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12px]",
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
                ))}
              </div>

              <div className="relative min-h-0 flex-1">
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="h-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  <div
                    className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]"
                    style={{ height: TOTAL_HEIGHT }}
                  >
                    <div className="relative">
                      {HOURS.map((h, i) => (
                        <div
                          key={h}
                          className={[
                            "absolute inset-x-0 px-2 text-right text-[11px] leading-none",
                            mutedClass(isDark),
                          ].join(" ")}
                          style={{
                            top: i * HOUR_HEIGHT,
                            transform: i === 0 ? "translateY(6px)" : "translateY(-50%)",
                          }}
                        >
                          {String(h).padStart(2, "0")}:00
                        </div>
                      ))}
                    </div>

                    {days.map((day, dayIndex) => (
                      <div
                        key={day.date.toISOString()}
                        className={[
                          "relative border-l",
                          calendarBorder,
                          day.isToday ? (isDark ? "bg-white/[0.02]" : "bg-black/[0.015]") : "",
                        ].join(" ")}
                      >
                        {HOURS.slice(0, -1).map((h, i) => (
                          <div
                            key={h}
                            className={["absolute inset-x-0 border-b", isDark ? "border-white/[0.05]" : "border-black/[0.04]"].join(" ")}
                            style={{ top: (i + 1) * HOUR_HEIGHT }}
                          />
                        ))}

                        {day.date.getTime() >= todayStart.getTime() &&
                          HOURS.slice(0, -1).map((h) => {
                            const slotEnd = new Date(day.date);
                            slotEnd.setHours(h + 1, 0, 0, 0);
                            if (slotEnd.getTime() <= now.getTime()) return null;

                            return (
                              <div
                                key={`add-${h}`}
                                className="group absolute inset-x-0"
                                style={{ top: (h - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                              >
                                <button
                                  type="button"
                                  aria-label="Add a post"
                                  onClick={() => openNewPostAt(day.date, h)}
                                  className={[
                                    "absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100",
                                    isDark
                                      ? "border-white/[0.08] bg-white/[0.06] text-neutral-300 hover:bg-white/[0.10] hover:text-white"
                                      : "border-black/[0.06] bg-white text-neutral-500 shadow-sm hover:bg-neutral-50 hover:text-neutral-900",
                                  ].join(" ")}
                                >
                                  <PlusIcon />
                                  <span
                                    className={[
                                      "pointer-events-none absolute bottom-full mb-2 hidden whitespace-nowrap rounded-lg px-2.5 py-1 text-[12px] font-medium shadow-lg group-hover:block",
                                      isDark ? "bg-[#2e2e31] text-white" : "bg-neutral-900 text-white",
                                    ].join(" ")}
                                  >
                                    Add a post
                                  </span>
                                </button>
                              </div>
                            );
                          })}

                        {/* Événements du calendrier */}
                        {layoutByDay.get(dayIndex)?.map(({ event, depth }) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            tag={event.tagId ? tagsById.get(event.tagId) : undefined}
                            depth={depth}
                            isDark={isDark}
                            menuOpen={openMenuId === event.id}
                            onToggleMenu={() => setOpenMenuId((current) => (current === event.id ? null : event.id))}
                            onCloseMenu={() => setOpenMenuId(null)}
                            onEdit={() => handleEditEvent(event.id)}
                            onDelete={() => handleDeleteEvent(event.id)}
                          />
                        ))}

                        {/* Posts planifiés */}
                        {postsByDay.get(dayIndex)?.map((item) => (
                          <PostCard
                            key={item.post.id}
                            item={item}
                            tagsById={tagsById}
                            isDark={isDark}
                            posted={isPostPosted(item.post, now)}
                          />
                        ))}

                        {day.isToday && showNowLine && (
                          <div
                            className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                            style={{ top: (nowHour - START_HOUR) * HOUR_HEIGHT }}
                          >
                            <span
                              className={[
                                "-ml-[38px] rounded-full px-2 py-1 text-[10px] font-semibold",
                                isDark ? "bg-white text-neutral-900" : "bg-neutral-900 text-white",
                              ].join(" ")}
                            >
                              {nowLabel}
                            </span>
                            <span className={["h-px flex-1", isDark ? "bg-white/40" : "bg-neutral-900/70"].join(" ")} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {hiddenAbove && (
                  <button
                    type="button"
                    onClick={() => scrollToNextHidden("up")}
                    aria-label="Événements au-dessus"
                    className={[
                      "absolute left-1/2 top-3 z-30 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border shadow-lg transition hover:scale-105",
                      focusRingClass(isDark),
                      isDark
                        ? "border-white/[0.10] bg-[#16161a] text-white"
                        : "border-black/[0.06] bg-white text-neutral-800",
                    ].join(" ")}
                  >
                    <ArrowUpIcon />
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#EF4444] ring-2 ring-white dark:ring-[#16161a]" />
                  </button>
                )}

                {hiddenBelow && (
                  <button
                    type="button"
                    onClick={() => scrollToNextHidden("down")}
                    aria-label="Événements en-dessous"
                    className={[
                      "absolute bottom-3 left-1/2 z-30 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border shadow-lg transition hover:scale-105",
                      focusRingClass(isDark),
                      isDark
                        ? "border-white/[0.10] bg-[#16161a] text-white"
                        : "border-black/[0.06] bg-white text-neutral-800",
                    ].join(" ")}
                  >
                    <ArrowDownIcon />
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#EF4444] ring-2 ring-white dark:ring-[#16161a]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {eventFormOpen && (
        <EventFormModal
          isDark={isDark}
          tags={apiTags}
          weekStart={weekStart}
          initial={
            editingEvent
              ? {
                  title: editingEvent.title,
                  day: editingEvent.day,
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
        onCreatePost={() => {
          setIsFolderOpen(false);
          setNewPostDate(null);
          setIsNewPostOpen(true);
        }}
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
      />

      {/* HELP — même bouton que sur Home */}
      <HelpChatButton isDark={isDark} />
    </main>
  );
}