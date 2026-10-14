// src/pages/Create.tsx
// Page Create (route "create") : tableau d'idées (Board / Gallery) + modale « Create Idea ».
// Noir et blanc, même thème et même structure que Community.tsx / Insights.tsx.
// Les données sont fournies par `useIdeas` (state local pour l'instant) : branche-le sur ton backend.

import { useEffect, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { useTheme } from "../hooks/useTheme";
import DashboardSidebar, {
  useSidebarOffset,
} from "../components/DashboardSidebar";

/* ───────── Types ───────── */

type Tab = "ideas" | "templates" | "feeds";
type View = "board" | "gallery";
type Status = "unassigned" | "todo" | "inprogress";

type Idea = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  status: Status;
  tags: string[];
};

type IconProps = { className?: string };

const TABS: { key: Tab; label: string }[] = [
  { key: "ideas", label: "Ideas" },
  { key: "templates", label: "Templates" },
  { key: "feeds", label: "Feeds" },
];

const COLUMNS: { key: Status; label: string }[] = [
  { key: "unassigned", label: "Unassigned" },
  { key: "todo", label: "To Do" },
  { key: "inprogress", label: "In Progress" },
];

const TAGS = ["Promo", "Behind the scenes", "Tutorial", "Product", "Event"];

/* ───────── Données (à remplacer par ton API) ───────── */

function useIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);

  const addIdea = (idea: Omit<Idea, "id">) =>
    setIdeas((prev) => [{ ...idea, id: crypto.randomUUID() }, ...prev]);

  const moveIdea = (id: string, status: Status) =>
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));

  const moveAll = (from: Status, to: Status) =>
    setIdeas((prev) => prev.map((i) => (i.status === from ? { ...i, status: to } : i)));

  return { ideas, addIdea, moveIdea, moveAll };
}

/* ───────── Icônes ───────── */

function Svg({
  className = "h-4 w-4",
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
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

const BulbIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
  </Svg>
);
const BookmarkIcon = (p: IconProps & { filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={p.className ?? "h-4 w-4"}
    fill={p.filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.8L6 20V5.5a1 1 0 0 1 1-1Z" />
  </svg>
);
const ChatHeartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20.5a8.5 8.5 0 1 0-7.4-4.3L3.5 20.5l4.5-1.1a8.4 8.4 0 0 0 4 1.1Z" />
    <path d="M12 14.6s-2.8-1.6-2.8-3.4a1.6 1.6 0 0 1 2.8-1 1.6 1.6 0 0 1 2.8 1c0 1.8-2.8 3.4-2.8 3.4Z" />
  </Svg>
);
const WandIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 20 11-11" />
    <path d="m13.5 6.5 4 4" />
    <path d="M18 3v3M16.5 4.5h3M7 4v2M6 5h2M20 14v2M19 15h2" />
  </Svg>
);
const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
const DotsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="2.6" />
  </Svg>
);
const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
const TagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7a1 1 0 0 1 .7.3l7.6 7.6a1 1 0 0 1 0 1.4l-7.7 7.7a1 1 0 0 1-1.4 0l-7.6-7.6a1 1 0 0 1-.3-.7Z" />
    <path d="M8 8h.01" strokeWidth="2.4" />
  </Svg>
);
const BoardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M8.5 8v7M12 8v4M15.5 8v6" />
  </Svg>
);
const GalleryIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Svg>
);
const ColumnsIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M9.2 4.5v15M14.8 4.5v15" />
  </Svg>
);
const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
const ImagePlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 4.5H7a2.5 2.5 0 0 0-2.5 2.5v10A2.5 2.5 0 0 0 7 19.5h10a2.5 2.5 0 0 0 2.5-2.5v-5" />
    <path d="M17 3v6M14 6h6" />
    <circle cx="9" cy="10" r="1.4" />
    <path d="m5 17 4.5-4.5L13 16l2-2 4.5 4" />
  </Svg>
);
const SmileIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.8 14a4 4 0 0 0 6.4 0M9 9.6h.01M15 9.6h.01" />
  </Svg>
);

/* ───────── Petits composants ───────── */

function Menu<T extends string>({
  value,
  options,
  onChange,
  icon,
  isDark,
  ghost,
  align = "right",
  bordered,
  line,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (k: T) => void;
  icon: ReactNode;
  isDark: boolean;
  ghost: string;
  align?: "left" | "right";
  bordered?: boolean;
  line?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${ghost} ${
          bordered ? `border ${line}` : ""
        } ${isDark ? "focus-visible:ring-white/40" : "focus-visible:ring-black/30"}`}
      >
        {icon}
        {current?.label}
        <ChevronDownIcon className="h-4 w-4 opacity-60" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            className={`absolute ${align === "right" ? "right-0" : "left-0"} z-40 mt-2 min-w-[180px] overflow-hidden rounded-xl border p-1 shadow-lg ${
              isDark ? "border-white/10 bg-[#0c0c0c]" : "border-black/10 bg-white"
            }`}
          >
            {options.map((o) => (
              <li key={o.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.key === value}
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                    o.key === value
                      ? isDark
                        ? "bg-white/10"
                        : "bg-black/[0.06]"
                      : isDark
                      ? "hover:bg-white/[0.06]"
                      : "hover:bg-black/[0.04]"
                  }`}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Sélecteur de tags (multi-sélection). `selected` vide = « Tags ». */
function TagMenu({
  selected,
  onToggle,
  isDark,
  ghost,
  bordered,
  line,
  align = "right",
}: {
  selected: string[];
  onToggle: (t: string) => void;
  isDark: boolean;
  ghost: string;
  bordered?: boolean;
  line?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${ghost} ${
          bordered ? `border ${line}` : ""
        } ${isDark ? "focus-visible:ring-white/40" : "focus-visible:ring-black/30"}`}
      >
        <TagIcon className="h-4 w-4" />
        Tags
        {selected.length > 0 && (
          <span
            className={`rounded-full px-1.5 text-[11px] tabular-nums ${
              isDark ? "bg-white text-black" : "bg-black text-white"
            }`}
          >
            {selected.length}
          </span>
        )}
        <ChevronDownIcon className="h-4 w-4 opacity-60" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            className="fixed inset-0 z-[60] cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            className={`absolute ${align === "right" ? "right-0" : "left-0"} z-[70] mt-2 min-w-[200px] overflow-hidden rounded-xl border p-1 shadow-lg ${
              isDark ? "border-white/10 bg-[#0c0c0c]" : "border-black/10 bg-white"
            }`}
          >
            {TAGS.map((t) => {
              const on = selected.includes(t);
              return (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() => onToggle(t)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                      isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]"
                    }`}
                  >
                    {t}
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
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
        </>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  ghost,
  isDark,
  className = "h-9 w-9",
  align = "center",
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  ghost: string;
  isDark: boolean;
  className?: string;
  align?: "center" | "end";
}) {
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={`flex items-center justify-center rounded-xl transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${ghost} ${
          isDark ? "focus-visible:ring-white/40" : "focus-visible:ring-black/30"
        } ${className}`}
      >
        {children}
      </button>

      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-50 mt-2 w-max max-w-[240px] rounded-lg px-3 py-2 text-[13px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 motion-reduce:transition-none group-hover:opacity-100 group-hover:delay-300 group-focus-within:opacity-100 ${
          isDark ? "bg-neutral-700" : "bg-neutral-900"
        } ${align === "end" ? "right-0" : "left-1/2 -translate-x-1/2"}`}
      >
        {label}
      </span>
    </span>
  );
}

/** Carte d'idée (utilisée dans le board et la galerie). */
function IdeaCard({
  idea,
  isDark,
  muted,
  draggable,
}: {
  idea: Idea;
  isDark: boolean;
  muted: string;
  draggable?: boolean;
}) {
  return (
    <article
      draggable={draggable}
      onDragStart={(e: DragEvent) => {
        e.dataTransfer.setData("text/plain", idea.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`overflow-hidden rounded-xl border ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      } ${
        isDark
          ? "border-white/10 bg-[#0c0c0c] hover:border-white/25"
          : "border-black/10 bg-white hover:border-black/25"
      } transition-colors`}
    >
      {idea.imageUrl && (
        <img
          src={idea.imageUrl}
          alt=""
          className="h-[150px] w-full object-cover"
          draggable={false}
        />
      )}
      <div className="flex flex-col gap-1 px-4 py-4">
        <h3 className="truncate text-[15px] font-semibold">{idea.title}</h3>
        {idea.description && (
          <p className={`line-clamp-2 text-[14px] ${muted}`}>{idea.description}</p>
        )}
        {idea.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {idea.tags.map((t) => (
              <span
                key={t}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                  isDark ? "bg-white/10" : "bg-black/[0.06]"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

/* ───────── Modale « Create Idea » ───────── */

function IdeaModal({
  initialStatus,
  isDark,
  ghost,
  line,
  muted,
  ring,
  onClose,
  onSave,
}: {
  initialStatus: Status;
  isDark: boolean;
  ghost: string;
  line: string;
  muted: string;
  ring: string;
  onClose: () => void;
  onSave: (idea: Omit<Idea, "id">) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>(initialStatus);
  const [tags, setTags] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSave = title.trim().length > 0;

  const setFile = (file?: File | null) => {
    if (file && file.type.startsWith("image/")) setImageUrl(URL.createObjectURL(file));
  };

  const save = (asPost: boolean) => {
    if (!canSave) return;
    // « Create Post » : branche ici la redirection vers ton éditeur de post si besoin.
    onSave({
      title: title.trim(),
      description: description.trim(),
      imageUrl,
      tags,
      status: asPost && status === "unassigned" ? "todo" : status,
    });
    onClose();
  };

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const primary = isDark
    ? "bg-white text-black hover:bg-neutral-200"
    : "bg-black text-white hover:bg-neutral-800";
  const disabled = isDark ? "bg-white/10 text-neutral-500" : "bg-black/[0.08] text-neutral-400";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create Idea"
        className={`relative flex max-h-[92vh] w-full max-w-[720px] flex-col rounded-2xl border shadow-2xl ${
          isDark ? "border-white/10 bg-[#0c0c0c] text-white" : "border-black/10 bg-white text-black"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border ${ring} focus-visible:outline-none focus-visible:ring-2 ${
            isDark ? "border-white/15 bg-black" : "border-black/15 bg-white"
          }`}
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 pt-6">
          <h2 className="text-[18px] font-semibold tracking-tight">Create Idea</h2>
          <div className="flex items-center gap-2">
            <Menu
              value={status}
              options={COLUMNS}
              onChange={setStatus}
              icon={<ColumnsIcon className="h-4 w-4" />}
              isDark={isDark}
              ghost={ghost}
              bordered
              line={line}
            />
            <TagMenu
              selected={tags}
              onToggle={toggleTag}
              isDark={isDark}
              ghost={ghost}
              bordered
              line={line}
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex min-h-[360px] flex-1 flex-col gap-3 overflow-y-auto px-6 pb-4 pt-5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your idea a title"
            className={`w-full bg-transparent text-[22px] font-semibold tracking-tight outline-none ${
              isDark ? "placeholder:text-neutral-600" : "placeholder:text-neutral-400"
            }`}
          />

          <div className="relative flex-1">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={description ? "" : "Everything begins with an idea…"}
              className={`h-full min-h-[200px] w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none ${
                isDark ? "placeholder:text-neutral-600" : "placeholder:text-neutral-400"
              }`}
            />
          </div>

          {/* Upload */}
          <div className="flex items-end gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
            {imageUrl ? (
              <div className="group relative h-[140px] w-[140px] overflow-hidden rounded-xl">
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => setImageUrl(undefined)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  setFile(e.dataTransfer.files?.[0]);
                }}
                className={`flex h-[140px] w-[140px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center text-[13px] transition-colors ${muted} ${
                  dragOver
                    ? isDark
                      ? "border-white/60 bg-white/10"
                      : "border-black/60 bg-black/[0.06]"
                    : isDark
                    ? "border-white/20"
                    : "border-black/20"
                }`}
              >
                <ImagePlusIcon className="h-7 w-7" />
                <span className="leading-snug">
                  Drag &amp; drop
                  <br />
                  or{" "}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className={`font-medium underline underline-offset-2 ${
                      isDark ? "text-white" : "text-black"
                    }`}
                  >
                    select a file
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* Mini toolbar */}
          <div className="flex items-center gap-1">
            <IconButton label="Add" ghost={ghost} isDark={isDark} className="h-9 w-9">
              <PlusIcon className="h-[18px] w-[18px]" />
            </IconButton>
            <span className={`mx-1 h-5 w-px ${isDark ? "bg-white/10" : "bg-black/10"}`} />
            <IconButton label="Emoji" ghost={ghost} isDark={isDark} className="h-9 w-9">
              <SmileIcon className="h-[18px] w-[18px]" />
            </IconButton>
            <span className={`mx-1 h-5 w-px ${isDark ? "bg-white/10" : "bg-black/10"}`} />
            <button
              type="button"
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${ghost} ${ring}`}
            >
              <WandIcon className="h-[18px] w-[18px]" />
              AI Assistant
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex justify-end gap-3 border-t px-6 py-4 ${line}`}>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => save(true)}
            className={`rounded-xl px-5 py-2.5 text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${ring} ${
              canSave ? primary : `cursor-not-allowed ${disabled}`
            }`}
          >
            Create Post
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => save(false)}
            className={`rounded-xl px-5 py-2.5 text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${ring} ${
              canSave ? primary : `cursor-not-allowed ${disabled}`
            }`}
          >
            Save Idea
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Page ───────── */

export default function Create() {
  const { theme, toggle: onToggleTheme } = useTheme();
  const isDark = theme === "dark";
  const sidebarOffset = useSidebarOffset();

  const { ideas, addIdea, moveIdea, moveAll } = useIdeas();

  const [tab, setTab] = useState<Tab>("ideas");
  const [view, setView] = useState<View>("board");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [modal, setModal] = useState<Status | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const [colMenu, setColMenu] = useState<Status | null>(null);

  const page = isDark ? "bg-black text-white" : "bg-white text-black";
  const line = isDark ? "border-white/10" : "border-black/10";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const ghost = isDark ? "hover:bg-neutral-700/70" : "hover:bg-neutral-200";
  const ring = isDark ? "focus-visible:ring-white/40" : "focus-visible:ring-black/30";
  const column = isDark ? "bg-white/[0.04]" : "bg-[#f5f5f5]";
  const outline = isDark ? "border-white/15 hover:bg-white/10" : "border-black/15 hover:bg-black/5";
  const chip = isDark ? "bg-white/10" : "bg-black/[0.07]";

  const visible = tagFilter.length
    ? ideas.filter((i) => i.tags.some((t) => tagFilter.includes(t)))
    : ideas;

  const toggleFilter = (t: string) =>
    setTagFilter((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const onDropColumn = (e: DragEvent, status: Status) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) moveIdea(id, status);
    setOverCol(null);
  };

  return (
    <main
      className={`relative h-screen w-full overflow-hidden transition-colors duration-300 ${page}`}
    >
      <DashboardSidebar theme={theme} onToggleTheme={onToggleTheme} />

      {/* Même structure que Community.tsx / Channels.tsx : le wrapper animé ne porte
          que le padding-left (block, pas flex) ; le layout flex vit dans l'enfant. */}
      <div
        className="h-full overflow-hidden transition-[padding-left] duration-[380ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
        style={{ paddingLeft: sidebarOffset }}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex min-h-0 w-full flex-1 flex-col px-[clamp(12px,1.5vw,24px)] pb-8 pt-[clamp(16px,2vw,28px)]">
            {/* Header */}
            <header className="flex items-center justify-between gap-4 pb-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                    isDark
                      ? "border-white/10 bg-white/[0.03] text-white"
                      : "border-black/[0.08] bg-white text-neutral-900 shadow-sm"
                  }`}
                >
                  <BulbIcon className="h-[17px] w-[17px]" />
                </div>
                <h1 className="font-display text-[clamp(17px,1.5vw,20px)] font-semibold tracking-[-0.01em]">
                  Create
                </h1>
                <IconButton
                  label={saved ? "Remove from favorites" : "Add to favorites"}
                  onClick={() => setSaved((v) => !v)}
                  ghost={ghost}
                  isDark={isDark}
                  className="h-8 w-8"
                >
                  <BookmarkIcon className="h-[18px] w-[18px]" filled={saved} />
                </IconButton>
              </div>

              <div className="flex items-center gap-2">
                <IconButton label="Auto-replies" ghost={ghost} isDark={isDark}>
                  <ChatHeartIcon className="h-5 w-5" />
                </IconButton>
                <button
                  type="button"
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[14px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                    isDark
                      ? "bg-white text-black hover:bg-neutral-200"
                      : "bg-black text-white hover:bg-neutral-800"
                  }`}
                >
                  <WandIcon className="h-[18px] w-[18px]" />
                  Generate Ideas
                </button>
                <button
                  type="button"
                  onClick={() => setModal("unassigned")}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-[14px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${outline} ${ring}`}
                >
                  <PlusIcon className="h-[18px] w-[18px]" />
                  New Idea
                </button>
              </div>
            </header>

            {/* Tabs + toolbar */}
            <div className={`flex items-center justify-between gap-4 border-b ${line}`}>
              <div role="tablist" aria-label="Create" className="flex gap-6">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className={`-mb-px border-b-2 px-1 pb-3 pt-2 text-[15px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                      tab === t.key
                        ? isDark
                          ? "border-white text-white"
                          : "border-black text-black"
                        : `border-transparent ${muted} ${isDark ? "hover:text-white" : "hover:text-black"}`
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === "ideas" && (
                <div className="flex items-center gap-2 pb-2">
                  <TagMenu
                    selected={tagFilter}
                    onToggle={toggleFilter}
                    isDark={isDark}
                    ghost={ghost}
                  />
                  <div
                    role="tablist"
                    aria-label="View"
                    className={`inline-flex gap-1 rounded-xl border p-1 ${line}`}
                  >
                    {(
                      [
                        { key: "board", label: "Board", icon: <BoardIcon className="h-4 w-4" /> },
                        { key: "gallery", label: "Gallery", icon: <GalleryIcon className="h-4 w-4" /> },
                      ] as { key: View; label: string; icon: ReactNode }[]
                    ).map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        role="tab"
                        aria-selected={view === o.key}
                        onClick={() => setView(o.key)}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                          view === o.key
                            ? isDark
                              ? "bg-white text-black"
                              : "bg-black text-white"
                            : isDark
                            ? "text-neutral-400 hover:text-white"
                            : "text-neutral-500 hover:text-black"
                        }`}
                      >
                        {o.icon}
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1 flex-col pt-5">
              {tab !== "ideas" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <h2 className="text-[20px] font-semibold tracking-tight">
                    {tab === "templates" ? "No templates yet" : "No feeds yet"}
                  </h2>
                  <p className={`max-w-[380px] text-[14px] leading-relaxed ${muted}`}>
                    {tab === "templates"
                      ? "Save a post as a template to reuse it later."
                      : "Follow sources to get fresh content ideas here."}
                  </p>
                </div>
              )}

              {tab === "ideas" && view === "board" && (
                <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
                  {COLUMNS.map((col) => {
                    const items = visible.filter((i) => i.status === col.key);
                    const isOver = overCol === col.key;
                    return (
                      <section
                        key={col.key}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setOverCol(col.key);
                        }}
                        onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                        onDrop={(e) => onDropColumn(e, col.key)}
                        className={`flex min-h-0 w-[min(420px,85vw)] shrink-0 flex-col rounded-2xl p-3 transition-colors motion-reduce:transition-none ${
                          isOver
                            ? isDark
                              ? "bg-white/[0.12]"
                              : "bg-black/[0.09]"
                            : column
                        }`}
                      >
                        <div className="flex items-center justify-between px-2 pb-3 pt-1">
                          <div className="flex items-center gap-2.5">
                            <h2 className="text-[15px] font-semibold">{col.label}</h2>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium tabular-nums ${chip} ${muted}`}
                            >
                              {items.length}
                            </span>
                          </div>
                          <div className="relative flex items-center">
                            <IconButton
                              label="New idea"
                              onClick={() => setModal(col.key)}
                              ghost={ghost}
                              isDark={isDark}
                              className="h-8 w-8"
                            >
                              <PlusIcon className="h-[18px] w-[18px]" />
                            </IconButton>
                            {col.key !== "unassigned" && (
                              <>
                                <IconButton
                                  label="Column options"
                                  onClick={() =>
                                    setColMenu((c) => (c === col.key ? null : col.key))
                                  }
                                  ghost={ghost}
                                  isDark={isDark}
                                  className="h-8 w-8"
                                >
                                  <DotsIcon className="h-[18px] w-[18px]" />
                                </IconButton>
                                {colMenu === col.key && (
                                  <>
                                    <button
                                      type="button"
                                      aria-label="Close menu"
                                      tabIndex={-1}
                                      className="fixed inset-0 z-30 cursor-default"
                                      onClick={() => setColMenu(null)}
                                    />
                                    <div
                                      className={`absolute right-0 top-full z-40 mt-1 min-w-[200px] rounded-xl border p-1 shadow-lg ${
                                        isDark
                                          ? "border-white/10 bg-[#0c0c0c]"
                                          : "border-black/10 bg-white"
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          moveAll(col.key, "unassigned");
                                          setColMenu(null);
                                        }}
                                        className={`w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                                          isDark
                                            ? "hover:bg-white/[0.06]"
                                            : "hover:bg-black/[0.04]"
                                        }`}
                                      >
                                        Move all to Unassigned
                                      </button>
                                    </div>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
                          {items.map((idea) => (
                            <IdeaCard
                              key={idea.id}
                              idea={idea}
                              isDark={isDark}
                              muted={muted}
                              draggable
                            />
                          ))}
                          <button
                            type="button"
                            onClick={() => setModal(col.key)}
                            className={`mt-1 flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${ghost} ${ring}`}
                          >
                            <PlusIcon className="h-[18px] w-[18px]" />
                            New Idea
                          </button>
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

              {tab === "ideas" && view === "gallery" && (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {visible.length === 0 ? (
                    <div className="mt-16 flex flex-col items-center gap-3 text-center">
                      <h2 className="text-[20px] font-semibold tracking-tight">No ideas yet</h2>
                      <p className={`max-w-[360px] text-[14px] leading-relaxed ${muted}`}>
                        Capture your next post idea before it gets away.
                      </p>
                      <button
                        type="button"
                        onClick={() => setModal("unassigned")}
                        className={`mt-2 flex items-center gap-2 rounded-xl border px-4 py-2 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${outline} ${ring}`}
                      >
                        <PlusIcon className="h-[18px] w-[18px]" />
                        New Idea
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 pb-4">
                      {visible.map((idea) => (
                        <IdeaCard key={idea.id} idea={idea} isDark={isDark} muted={muted} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <IdeaModal
          initialStatus={modal}
          isDark={isDark}
          ghost={ghost}
          line={line}
          muted={muted}
          ring={ring}
          onClose={() => setModal(null)}
          onSave={addIdea}
        />
      )}
    </main>
  );
}