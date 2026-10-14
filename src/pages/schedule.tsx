import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import DashboardSidebar, {
  useSidebarOffset,
} from "../components/DashboardSidebar";
import PageTransition from "../components/PageTransition";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import NewPostModal, { type NewPostPayload } from "../components/Newpostmodal";
import { DateTimePicker } from "../components/DateTimePicker";

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

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M7 12h10M10 18h4" />
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

function formatWeekRange(start: Date, end: Date) {
  const month = (d: Date, style: "long" | "short") => d.toLocaleDateString(LOCALE, { month: style });

  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.getDate()} ${month(start, "short")} ${start.getFullYear()} - ${end.getDate()} ${month(end, "short")} ${end.getFullYear()}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${start.getDate()} ${month(start, "short")} - ${end.getDate()} ${month(end, "short")} ${end.getFullYear()}`;
  }
  return `${start.getDate()}-${end.getDate()} ${month(end, "long")} ${end.getFullYear()}`;
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

type Tone = "purple" | "sky" | "indigo" | "amber" | "green" | "rose";

type Category = {
  id: string;
  name: string;
  tone: Tone;
};

type CalendarEvent = {
  id: string;
  day: number;
  start: number;
  end: number;
  title: string;
  categoryId?: string;
  confirmed?: boolean;
  published?: boolean;
};

const START_HOUR = 0;
const END_HOUR = 24;
const SPAN = END_HOUR - START_HOUR;
const HOUR_HEIGHT = 72;
const TOTAL_HEIGHT = SPAN * HOUR_HEIGHT;

/* Heure de départ du scroll quand on n'est pas sur la semaine en cours. */
const DEFAULT_SCROLL_HOUR = 8;
/* Nombre d'heures de contexte affichées avant « maintenant ». */
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

const RANGE_OPTIONS = ["Last week", "This week", "Next week"];
const RANGE_OFFSET: Record<string, number> = { "Last week": -1, "This week": 0, "Next week": 1 };
const SCOPE_OPTIONS = ["All", "Publié", "À publier"];

/* ------------------------------------------------------------------ */
/* Tone styling                                                        */
/* ------------------------------------------------------------------ */

type ToneStyle = {
  bgLight: string;
  bgDark: string;
  textLight: string;
  textDark: string;
  borderLight: string;
  borderDark: string;
};

const TONE_STYLES: Record<Tone, ToneStyle> = {
  purple: { bgLight: "bg-[#ECE6FB]", bgDark: "bg-[#2a2440]", textLight: "text-[#5B3FC4]", textDark: "text-[#C9B8FA]", borderLight: "border-[#DED2F7]", borderDark: "border-[#3c3457]" },
  sky: { bgLight: "bg-[#E3F1FC]", bgDark: "bg-[#1f2f3e]", textLight: "text-[#1E76B8]", textDark: "text-[#8FC7F0]", borderLight: "border-[#CFE6F8]", borderDark: "border-[#2c4356]" },
  indigo: { bgLight: "bg-[#E6E9FC]", bgDark: "bg-[#222642]", textLight: "text-[#4C55C9]", textDark: "text-[#B2B9F5]", borderLight: "border-[#D5D9F8]", borderDark: "border-[#31365a]" },
  amber: { bgLight: "bg-[#FBEFD8]", bgDark: "bg-[#332a1a]", textLight: "text-[#9A6B15]", textDark: "text-[#E9C77C]", borderLight: "border-[#F3E1B8]", borderDark: "border-[#4a3c24]" },
  green: { bgLight: "bg-[#E1F4E6]", bgDark: "bg-[#1c2e21]", textLight: "text-[#2E8A4C]", textDark: "text-[#8FD6A5]", borderLight: "border-[#CBEBD3]", borderDark: "border-[#2a4530]" },
  rose: { bgLight: "bg-[#FBE3E1]", bgDark: "bg-[#332021]", textLight: "text-[#C24B41]", textDark: "text-[#F0A79E]", borderLight: "border-[#F5CFCB]", borderDark: "border-[#4a2c2c]" },
};

const TONE_KEYS: Tone[] = ["purple", "sky", "indigo", "amber", "green", "rose"];

const NEUTRAL_STYLE: ToneStyle = {
  bgLight: "bg-neutral-100",
  bgDark: "bg-neutral-800",
  textLight: "text-neutral-700",
  textDark: "text-neutral-200",
  borderLight: "border-neutral-200",
  borderDark: "border-neutral-700",
};

/* ------------------------------------------------------------------ */
/* Layout                                                              */
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
/* Shared input styling                                                */
/* ------------------------------------------------------------------ */

function fieldClass(isDark: boolean) {
  return [
    "w-full rounded-[10px] border px-3 py-2 text-[13px] outline-none transition",
    isDark
      ? "border-white/10 bg-[#242427] text-white placeholder:text-neutral-500 focus:border-white/25"
      : "border-black/[0.08] bg-neutral-50 text-neutral-900 placeholder:text-neutral-400 focus:border-black/20",
  ].join(" ");
}

/* ------------------------------------------------------------------ */
/* Category editor popover                                             */
/* ------------------------------------------------------------------ */

function CategoryEditorPopover({
  isDark,
  title,
  initial,
  submitLabel,
  onCancel,
  onSave,
}: {
  isDark: boolean;
  title: string;
  initial: { name: string; tone: Tone } | null;
  submitLabel: string;
  onCancel: () => void;
  onSave: (data: { name: string; tone: Tone }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [tone, setTone] = useState<Tone>(initial?.tone ?? "purple");
  const canSave = name.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    onSave({ name: name.trim(), tone });
  };

  return (
    <div
      className={[
        "absolute left-0 top-full z-30 mt-2 w-60 rounded-[12px] border p-3 shadow-lg",
        isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/[0.06] bg-white",
      ].join(" ")}
    >
      <p className={["mb-2 text-[11px] font-medium", isDark ? "text-neutral-500" : "text-neutral-400"].join(" ")}>
        {title}
      </p>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Nom de la catégorie"
        className={fieldClass(isDark)}
      />

      <div className="mt-2.5 flex items-center gap-1.5">
        {TONE_KEYS.map((t) => {
          const ts = TONE_STYLES[t];
          const selected = tone === t;
          return (
            <button
              key={t}
              type="button"
              aria-label={t}
              onClick={() => setTone(t)}
              className={[
                "flex h-6 w-6 items-center justify-center rounded-full border-2 transition",
                isDark ? ts.bgDark : ts.bgLight,
                selected
                  ? isDark
                    ? "border-white"
                    : "border-neutral-900"
                  : "border-transparent",
                isDark ? ts.textDark : ts.textLight,
              ].join(" ")}
            >
              {selected && <CheckIcon className="h-[10px] w-[10px]" />}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={[
            "rounded-full px-3 py-1.5 text-[12px] font-medium transition",
            isDark ? "text-neutral-300 hover:bg-white/5" : "text-neutral-600 hover:bg-black/5",
          ].join(" ")}
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSave}
          className={[
            "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
            isDark
              ? "bg-neutral-900 text-white hover:bg-neutral-800"
              : "bg-white text-neutral-900 hover:bg-neutral-100",
          ].join(" ")}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Event card                                                          */
/* ------------------------------------------------------------------ */

type EventCardProps = {
  event: CalendarEvent;
  category?: Category;
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
  category,
  depth,
  isDark,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onEdit,
  onDelete,
}: EventCardProps) {
  const tone = category ? TONE_STYLES[category.tone] : NEUTRAL_STYLE;
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
        "absolute inset-x-1 flex flex-col gap-2 rounded-[12px] border px-3 py-2.5 transition-[box-shadow]",
        isFront ? "shadow-lg" : "",
        isDark ? tone.bgDark : tone.bgLight,
        isDark ? tone.borderDark : tone.borderLight,
      ].join(" ")}
      style={{ top, height, minHeight: 44, zIndex }}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p className={["truncate text-[12.5px] font-semibold", isDark ? tone.textDark : tone.textLight].join(" ")}>
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
              menuOpen ? (isDark ? "bg-white/10" : "bg-black/5") : "",
              isDark ? "text-neutral-400 hover:bg-white/10" : "text-neutral-400 hover:bg-black/5",
            ].join(" ")}
          >
            <MoreIcon />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className={[
                "absolute right-0 top-full z-40 mt-1.5 w-36 overflow-hidden rounded-[12px] border py-1 shadow-lg",
                isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/[0.06] bg-white",
              ].join(" ")}
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleEdit}
                className={[
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] transition",
                  isDark ? "text-neutral-200 hover:bg-white/5" : "text-neutral-700 hover:bg-black/[0.03]",
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
                  isDark ? "text-[#F0A79E] hover:bg-white/5" : "text-[#C24B41] hover:bg-black/[0.03]",
                ].join(" ")}
              >
                <TrashIcon />
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

      {event.confirmed && (
        <span
          className={[
            "flex w-fit items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-medium",
            isDark ? "bg-white/10 text-white" : "bg-white text-neutral-700 shadow-sm",
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
  categoryId?: string;
};

function EventFormModal({
  isDark,
  categories,
  weekStart,
  initial,
  onCancel,
  onSave,
}: {
  isDark: boolean;
  categories: Category[];
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
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? "");

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
      categoryId: categoryId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        className={[
          "relative z-10 w-full max-w-md rounded-[18px] border p-5 shadow-2xl",
          isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/[0.06] bg-white",
        ].join(" ")}
      >
        <h2
          className={[
            "mb-4 font-display text-[17px] font-semibold",
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
              Catégorie
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={{ colorScheme: isDark ? "dark" : "light" }}
              className={fieldClass(isDark)}
            >
              <option value="">Aucune catégorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {!canSave && (
            <p className={["text-[11px]", isDark ? "text-[#F0A79E]" : "text-[#C24B41]"].join(" ")}>
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
              isDark ? "text-neutral-300 hover:bg-white/5" : "text-neutral-600 hover:bg-black/5",
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

  /* Marge gauche : suit l'état réduit / ouvert de la sidebar. */
  const sidebarOffset = useSidebarOffset();

  /* ---------------- State ---------------- */
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [activeCategory, setActiveCategory] = useState<string | "All">("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [range, setRange] = useState("This week");
  const [scope, setScope] = useState("All");

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [catCreatorOpen, setCatCreatorOpen] = useState(false);
  const [catMenuOpenId, setCatMenuOpenId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  /* ---------------- BottomBar state ---------------- */
  const [bottomQuery, setBottomQuery] = useState("");
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  /* Date/heure préremplies quand le modal est ouvert depuis une case du calendrier. */
  const [newPostDate, setNewPostDate] = useState<Date | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  /* ---------------- Menu close on outside click / Escape ---------------- */
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

  /* ---------------- Category UI close on outside click / Escape ---------------- */
  useEffect(() => {
    if (!catCreatorOpen && !catMenuOpenId && !editingCategoryId) return;

    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (catCreatorOpen && !t.closest("[data-cat-creator]")) {
        setCatCreatorOpen(false);
      }
      if ((catMenuOpenId || editingCategoryId) && !t.closest("[data-cat-pill]")) {
        setCatMenuOpenId(null);
        setEditingCategoryId(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCatCreatorOpen(false);
        setCatMenuOpenId(null);
        setEditingCategoryId(null);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [catCreatorOpen, catMenuOpenId, editingCategoryId]);

  /* ---------------- Real clock ---------------- */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  /* ---------------- Initial scroll : heure actuelle ---------------- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const n = new Date();
    const hour = n.getHours() + n.getMinutes() / 60;
    const target =
      range === "This week"
        ? Math.max(0, (hour - NOW_CONTEXT_HOURS - START_HOUR) * HOUR_HEIGHT)
        : (DEFAULT_SCROLL_HOUR - START_HOUR) * HOUR_HEIGHT;

    el.scrollTop = target;
    setScrollTop(el.scrollTop);
  }, [range]);

  /* ---------------- Viewport measure ---------------- */
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

  /* ---------------- Week days ---------------- */
  const weekStart = useMemo(
    () => addDays(startOfWeek(now), RANGE_OFFSET[range] * 7),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now.toDateString(), range],
  );

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

  const weekLabel = formatWeekRange(days[0].date, days[6].date);

  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowLabel = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  const showNowLine = nowHour >= START_HOUR && nowHour <= END_HOUR;

  /* Minuit d'aujourd'hui : les jours >= cette date reçoivent le « + ». */
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  /* ---------------- Derived data ---------------- */
  const categoryById = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const visibleEvents = useMemo(
    () =>
      events.filter((e) => {
        const matchCategory = activeCategory === "All" || e.categoryId === activeCategory;
        const matchScope =
          scope === "All" ||
          (scope === "Publié" && e.published) ||
          (scope === "À publier" && !e.published);
        return matchCategory && matchScope;
      }),
    [events, activeCategory, scope],
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

  const hiddenAbove = useMemo(() => {
    if (viewportHeight === 0) return false;
    return visibleEvents.some((e) => {
      const bottom = (e.end - START_HOUR) * HOUR_HEIGHT;
      return bottom <= scrollTop;
    });
  }, [visibleEvents, scrollTop, viewportHeight]);

  const hiddenBelow = useMemo(() => {
    if (viewportHeight === 0) return false;
    const viewportBottom = scrollTop + viewportHeight;
    return visibleEvents.some((e) => {
      const top = (e.start - START_HOUR) * HOUR_HEIGHT;
      return top >= viewportBottom;
    });
  }, [visibleEvents, scrollTop, viewportHeight]);

  const scrollToNextHidden = (direction: "up" | "down") => {
    const el = scrollRef.current;
    if (!el) return;

    const tops = visibleEvents.map((e) => (e.start - START_HOUR) * HOUR_HEIGHT);
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

  /* ---------------- Handlers ---------------- */

  const handleCreateCategory = (data: { name: string; tone: Tone }) => {
    const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setCategories((prev) => [...prev, { id, name: data.name, tone: data.tone }]);
    setCatCreatorOpen(false);
  };

  const handleUpdateCategory = (id: string, data: { name: string; tone: Tone }) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: data.name, tone: data.tone } : c)),
    );
    setEditingCategoryId(null);
  };

  const handleDeleteCategory = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setActiveCategory((cur) => (cur === id ? "All" : cur));
    setEvents((prev) =>
      prev.map((e) => (e.categoryId === id ? { ...e, categoryId: undefined } : e)),
    );
    if (editingCategoryId === id) setEditingCategoryId(null);
    if (catMenuOpenId === id) setCatMenuOpenId(null);
  };

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
      setEvents((prev) => [...prev, { id, ...data, published: false }]);
    }
    setEventFormOpen(false);
    setEditingEventId(null);
  };

  const editingEvent = editingEventId ? events.find((e) => e.id === editingEventId) ?? null : null;

  /* ---------------- BottomBar handlers ---------------- */
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

  /* Ouvre le New Post modal avec la date/heure de la case cliquée. */
  const openNewPostAt = (day: Date, hour: number) => {
    const slot = new Date(day);
    slot.setHours(hour, 0, 0, 0);

    if (slot.getTime() <= Date.now()) {
      // Heure en cours (déjà commencée) : prochain multiple de 5 min.
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
    console.log("Nouveau post :", payload);
  };

  /* ---------------- Render ---------------- */
  return (
    <main
      className={[
        "relative h-[100dvh] w-full overflow-hidden transition-colors duration-500",
        isDark ? "bg-[#09090a]" : "bg-[#f3f1ed]",
      ].join(" ")}
    >
      <DashboardSidebar theme={theme} />

      <div
        className="h-full transition-[padding-left] duration-[380ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
        style={{ paddingLeft: sidebarOffset }}
      >
        <PageTransition>
          {/* Pleine largeur (plus de max-w) ; pb-[96px] réserve la place de la BottomBar. */}
          <div className="flex h-[100dvh] w-full max-w-none flex-col px-[clamp(12px,1.5vw,24px)] pt-[clamp(14px,1.8vw,24px)] pb-[96px]">
            {/* Heading row */}
            <div className="grid shrink-0 items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
              {/* Categories */}
              <div className="order-2 flex flex-col gap-1.5 lg:order-none lg:justify-start">
                <span className={["text-[11px] font-medium", isDark ? "text-neutral-500" : "text-neutral-400"].join(" ")}>
                  Catégorie
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCategory("All")}
                    className={[
                      "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition",
                      activeCategory === "All"
                        ? isDark
                          ? "bg-neutral-900 text-white"
                          : "bg-white text-neutral-900"
                        : isDark
                          ? "bg-[#1c1c1e] text-neutral-300 hover:bg-[#242427]"
                          : "bg-white text-neutral-600 hover:bg-neutral-50",
                    ].join(" ")}
                  >
                    {activeCategory === "All" && <CheckIcon />}
                    All
                  </button>

                  {categories.map((cat) => {
                    const tone = TONE_STYLES[cat.tone];
                    const isActive = activeCategory === cat.id;
                    const isMenuOpen = catMenuOpenId === cat.id;
                    const isEditing = editingCategoryId === cat.id;

                    return (
                      <div key={cat.id} className="relative" data-cat-pill>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCategory(cat.id);
                            setEditingCategoryId(null);
                            setCatMenuOpenId(null);
                          }}
                          className={[
                            "flex items-center gap-1.5 rounded-full border py-1.5 pl-3.5 pr-8 text-[12.5px] font-medium transition",
                            isActive
                              ? [
                                  isDark ? tone.bgDark : tone.bgLight,
                                  isDark ? tone.borderDark : tone.borderLight,
                                  isDark ? tone.textDark : tone.textLight,
                                ].join(" ")
                              : [
                                  isDark
                                    ? "border-transparent bg-[#1c1c1e] text-neutral-300 hover:bg-[#242427]"
                                    : "border-transparent bg-white text-neutral-600 hover:bg-neutral-50",
                                ].join(" "),
                          ].join(" ")}
                        >
                          {isActive && <CheckIcon />}
                          {cat.name}
                        </button>

                        <button
                          type="button"
                          aria-label={`Options ${cat.name}`}
                          aria-haspopup="menu"
                          aria-expanded={isMenuOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCatCreatorOpen(false);
                            setEditingCategoryId(null);
                            setCatMenuOpenId((cur) => (cur === cat.id ? null : cat.id));
                          }}
                          className={[
                            "absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full transition",
                            isMenuOpen
                              ? isDark
                                ? "bg-white/10 text-white"
                                : "bg-black/10 text-neutral-900"
                              : isDark
                                ? "text-neutral-400 hover:bg-white/10 hover:text-white"
                                : "text-neutral-400 hover:bg-black/10 hover:text-neutral-900",
                          ].join(" ")}
                        >
                          <MoreIcon />
                        </button>

                        {isMenuOpen && (
                          <div
                            role="menu"
                            className={[
                              "absolute left-0 top-full z-40 mt-1 w-36 overflow-hidden rounded-[12px] border py-1 shadow-lg",
                              isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/[0.06] bg-white",
                            ].join(" ")}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setCatMenuOpenId(null);
                                setEditingCategoryId(cat.id);
                              }}
                              className={[
                                "flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] transition",
                                isDark ? "text-neutral-200 hover:bg-white/5" : "text-neutral-700 hover:bg-black/[0.03]",
                              ].join(" ")}
                            >
                              <PencilIcon />
                              Modifier
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setCatMenuOpenId(null);
                                handleDeleteCategory(cat.id);
                              }}
                              className={[
                                "flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] transition",
                                isDark ? "text-[#F0A79E] hover:bg-white/5" : "text-[#C24B41] hover:bg-black/[0.03]",
                              ].join(" ")}
                            >
                              <TrashIcon />
                              Supprimer
                            </button>
                          </div>
                        )}

                        {isEditing && (
                          <CategoryEditorPopover
                            isDark={isDark}
                            title="Modifier la catégorie"
                            initial={{ name: cat.name, tone: cat.tone }}
                            submitLabel="Enregistrer"
                            onCancel={() => setEditingCategoryId(null)}
                            onSave={(data) => handleUpdateCategory(cat.id, data)}
                          />
                        )}
                      </div>
                    );
                  })}

                  <div className="relative" data-cat-creator>
                    <button
                      type="button"
                      aria-label="Ajouter une catégorie"
                      aria-expanded={catCreatorOpen}
                      onClick={() => {
                        setCatMenuOpenId(null);
                        setEditingCategoryId(null);
                        setCatCreatorOpen((v) => !v);
                      }}
                      className={[
                        "flex h-7 w-7 items-center justify-center rounded-full border transition",
                        isDark
                          ? "border-white/10 bg-[#1c1c1e] text-neutral-300 hover:bg-[#242427]"
                          : "border-black/[0.06] bg-white text-neutral-500 hover:bg-neutral-50",
                      ].join(" ")}
                    >
                      <PlusIcon />
                    </button>

                    {catCreatorOpen && (
                      <CategoryEditorPopover
                        isDark={isDark}
                        title="Nouvelle catégorie"
                        initial={null}
                        submitLabel="Créer"
                        onCancel={() => setCatCreatorOpen(false)}
                        onSave={handleCreateCategory}
                      />
                    )}
                  </div>
                </div>
              </div>

              <h1
                className={[
                  "order-1 text-center font-display text-[clamp(20px,2vw,26px)] font-semibold tracking-[-0.01em] lg:order-none",
                  isDark ? "text-white" : "text-neutral-900",
                ].join(" ")}
              >
                {weekLabel}
              </h1>

              <div className="order-3 flex flex-wrap items-center gap-2 lg:order-none lg:justify-end">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setFilterOpen((v) => !v)}
                    aria-expanded={filterOpen}
                    className={[
                      "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition",
                      isDark ? "border-white/10 bg-[#1c1c1e] text-neutral-200 hover:bg-[#242427]" : "border-black/[0.06] bg-white text-neutral-700 hover:bg-neutral-50",
                    ].join(" ")}
                  >
                    <FilterIcon />
                    Filter
                    <span className={["flex transition-transform duration-200", filterOpen ? "rotate-180" : ""].join(" ")}>
                      <ChevronDownIcon />
                    </span>
                  </button>

                  {filterOpen && (
                    <div
                      className={[
                        "absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-[12px] border py-1.5 shadow-lg",
                        isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/[0.06] bg-white",
                      ].join(" ")}
                    >
                      {[
                        { title: "Period", options: RANGE_OPTIONS, value: range, set: setRange },
                        { title: "Type", options: SCOPE_OPTIONS, value: scope, set: setScope },
                      ].map((group, gi) => (
                        <div
                          key={group.title}
                          className={gi > 0 ? ["mt-1.5 border-t pt-1.5", isDark ? "border-white/10" : "border-black/[0.06]"].join(" ") : ""}
                        >
                          <p className={["px-4 pb-1 pt-1 text-[11px] font-medium", isDark ? "text-neutral-500" : "text-neutral-400"].join(" ")}>
                            {group.title}
                          </p>
                          {group.options.map((option) => {
                            const selected = group.value === option;
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => group.set(option)}
                                className={[
                                  "flex w-full items-center justify-between px-4 py-2 text-left text-[12.5px] transition",
                                  selected
                                    ? isDark
                                      ? "font-semibold text-white"
                                      : "font-semibold text-neutral-900"
                                    : isDark
                                      ? "text-neutral-300 hover:bg-white/5"
                                      : "text-neutral-600 hover:bg-black/[0.03]",
                                ].join(" ")}
                              >
                                {option}
                                {selected && <CheckIcon />}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddEvent}
                  className={[
                    "flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold transition",
                    isDark
                      ? "bg-neutral-900 text-white hover:bg-neutral-800"
                      : "bg-white text-neutral-900 hover:bg-neutral-100",
                  ].join(" ")}
                >
                  <PlusIcon />
                  Add Event
                </button>
              </div>
            </div>

            {/* Calendar grid */}
            <div
              className={[
                "mt-[clamp(12px,1.6vw,18px)] flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border",
                isDark ? "border-white/10 bg-[#111113]" : "border-black/[0.06] bg-white",
              ].join(" ")}
            >
              {/* Day headers */}
              <div className="grid shrink-0 grid-cols-[56px_repeat(7,minmax(0,1fr))]">
                <div className={["border-b", isDark ? "border-white/10" : "border-black/[0.06]"].join(" ")} />
                {days.map((day) => (
                  <div
                    key={day.date.toISOString()}
                    className={[
                      "flex items-center justify-center gap-2 border-b border-l py-3 text-[12.5px]",
                      isDark ? "border-white/10" : "border-black/[0.06]",
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
                {/* Scrollbar masquée : l'en-tête reste parfaitement aligné avec la grille. */}
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
                            isDark ? "text-neutral-500" : "text-neutral-400",
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
                          isDark ? "border-white/10" : "border-black/[0.06]",
                          day.isToday ? (isDark ? "bg-white/[0.02]" : "bg-black/[0.015]") : "",
                        ].join(" ")}
                      >
                        {HOURS.slice(0, -1).map((h, i) => (
                          <div
                            key={h}
                            className={["absolute inset-x-0 border-b", isDark ? "border-white/[0.06]" : "border-black/[0.04]"].join(" ")}
                            style={{ top: (i + 1) * HOUR_HEIGHT }}
                          />
                        ))}

                        {/* « + » au survol des cases d'aujourd'hui et des jours suivants */}
                        {day.date.getTime() >= todayStart.getTime() &&
                          HOURS.slice(0, -1).map((h) => {
                            const slotEnd = new Date(day.date);
                            slotEnd.setHours(h + 1, 0, 0, 0);
                            // Heures entièrement passées : pas de « + ».
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
                                      ? "border-white/10 bg-[#242427] text-neutral-300 hover:bg-[#2e2e31] hover:text-white"
                                      : "border-black/10 bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900",
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

                        {layoutByDay.get(dayIndex)?.map(({ event, depth }) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            category={event.categoryId ? categoryById.get(event.categoryId) : undefined}
                            depth={depth}
                            isDark={isDark}
                            menuOpen={openMenuId === event.id}
                            onToggleMenu={() => setOpenMenuId((current) => (current === event.id ? null : event.id))}
                            onCloseMenu={() => setOpenMenuId(null)}
                            onEdit={() => handleEditEvent(event.id)}
                            onDelete={() => handleDeleteEvent(event.id)}
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
                      isDark
                        ? "border-white/15 bg-[#1c1c1e] text-white"
                        : "border-black/10 bg-white text-neutral-800",
                    ].join(" ")}
                  >
                    <ArrowUpIcon />
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#EF4444] ring-2 ring-white dark:ring-[#1c1c1e]" />
                  </button>
                )}

                {hiddenBelow && (
                  <button
                    type="button"
                    onClick={() => scrollToNextHidden("down")}
                    aria-label="Événements en-dessous"
                    className={[
                      "absolute bottom-3 left-1/2 z-30 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border shadow-lg transition hover:scale-105",
                      isDark
                        ? "border-white/15 bg-[#1c1c1e] text-white"
                        : "border-black/10 bg-white text-neutral-800",
                    ].join(" ")}
                  >
                    <ArrowDownIcon />
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#EF4444] ring-2 ring-white dark:ring-[#1c1c1e]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </PageTransition>
      </div>

      {/* Event form modal */}
      {eventFormOpen && (
        <EventFormModal
          isDark={isDark}
          categories={categories}
          weekStart={weekStart}
          initial={
            editingEvent
              ? {
                  title: editingEvent.title,
                  day: editingEvent.day,
                  start: editingEvent.start,
                  end: editingEvent.end,
                  categoryId: editingEvent.categoryId,
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

      {/* Barre d'actions rapides. */}
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
      />
    </main>
  );
}