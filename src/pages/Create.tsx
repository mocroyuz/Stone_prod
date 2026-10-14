// src/pages/Create.tsx
// Page Create (route "create") : tableau d'idées (Board / Gallery) + modale « Create Idea ».
// Noir et blanc, même thème et même structure que Community.tsx / Insights.tsx.
//
// Concept : les colonnes du board SONT des tags (Unassigned, To Do, In Progress…).
//  - on peut créer / renommer / supprimer des tags,
//  - on peut réordonner les colonnes (drag par l'en-tête, fantôme flottant + décalage fluide),
//  - on peut déplacer les idées entre colonnes et les réordonner (drag natif de la carte).
// Les données vivent dans `useBoard` (state local) : branche-le sur ton backend.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DragEvent, PointerEvent as RPointerEvent, ReactNode } from "react";
import { useTheme } from "../hooks/useTheme";
import DashboardSidebar, {
  useSidebarOffset,
} from "../components/DashboardSidebar";

/* ───────── Types ───────── */

type Tab = "ideas" | "templates" | "feeds";
type View = "board" | "gallery";

type Tag = { id: string; label: string };

type Idea = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  tagId: string;
};

type DragState = { type: "idea"; id: string } | null;

type IconProps = { className?: string };

const UNASSIGNED = "unassigned";

const DEFAULT_TAGS: Tag[] = [
  { id: UNASSIGNED, label: "Unassigned" },
  { id: "todo", label: "To Do" },
  { id: "inprogress", label: "In Progress" },
];

const TABS: { key: Tab; label: string }[] = [
  { key: "ideas", label: "Ideas" },
  { key: "templates", label: "Templates" },
  { key: "feeds", label: "Feeds" },
];

/* ───────── Données (à remplacer par ton API) ───────── */

function useBoard() {
  const [tags, setTags] = useState<Tag[]>(DEFAULT_TAGS);
  const [ideas, setIdeas] = useState<Idea[]>([]);

  /** Crée un tag (ou renvoie l'id de celui qui existe déjà avec ce nom). */
  const addTag = (label: string): string | null => {
    const l = label.trim();
    if (!l) return null;
    const existing = tags.find((t) => t.label.toLowerCase() === l.toLowerCase());
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    setTags((prev) => [...prev, { id, label: l }]);
    return id;
  };

  const renameTag = (id: string, label: string) => {
    const l = label.trim();
    if (!l || id === UNASSIGNED) return;
    setTags((prev) => prev.map((t) => (t.id === id ? { ...t, label: l } : t)));
  };

  /** Supprime un tag : ses idées retournent dans Unassigned. */
  const deleteTag = (id: string) => {
    if (id === UNASSIGNED) return;
    setIdeas((prev) => prev.map((i) => (i.tagId === id ? { ...i, tagId: UNASSIGNED } : i)));
    setTags((prev) => prev.filter((t) => t.id !== id));
  };

  /** Place la colonne `id` à la position de la colonne `toId` (Unassigned reste en premier). */
  const moveTag = (id: string, toId: string) => {
    setTags((prev) => {
      const from = prev.findIndex((t) => t.id === id);
      const to = prev.findIndex((t) => t.id === toId);
      if (from < 1 || to < 1 || from === to) return prev;
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  };

  const addIdea = (idea: Omit<Idea, "id">) =>
    setIdeas((prev) => [{ ...idea, id: crypto.randomUUID() }, ...prev]);

  /** Déplace une idée dans un tag, avant `beforeId` (ou en fin de colonne). */
  const moveIdea = (id: string, tagId: string, beforeId?: string) =>
    setIdeas((prev) => {
      const idea = prev.find((i) => i.id === id);
      if (!idea) return prev;
      const rest = prev.filter((i) => i.id !== id);
      const moved = { ...idea, tagId };
      if (beforeId && beforeId !== id) {
        const at = rest.findIndex((i) => i.id === beforeId);
        if (at >= 0) {
          rest.splice(at, 0, moved);
          return rest;
        }
      }
      return [...rest, moved];
    });

  const moveAll = (from: string, to: string) =>
    setIdeas((prev) => prev.map((i) => (i.tagId === from ? { ...i, tagId: to } : i)));

  return { tags, ideas, addTag, renameTag, deleteTag, moveTag, addIdea, moveIdea, moveAll };
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
/** Les 6 points (2 × 3) affichés en haut au centre d'une colonne déplaçable. */
const DragDotsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M8.5 10h.01M12 10h.01M15.5 10h.01M8.5 14h.01M12 14h.01M15.5 14h.01"
      strokeWidth="2.6"
    />
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

/** Champ « créer un tag » : Entrée ou clic sur + pour valider. */
function CreateTagInput({
  onCreate,
  isDark,
  placeholder = "Create a tag…",
  autoFocus,
}: {
  onCreate: (label: string) => void;
  isDark: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) return;
    onCreate(value);
    setValue("");
  };

  return (
    <div
      className={`flex items-center gap-1 rounded-lg border px-2 ${
        isDark ? "border-white/15" : "border-black/15"
      }`}
    >
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        maxLength={30}
        className={`min-w-0 flex-1 bg-transparent py-2 text-[13px] outline-none ${
          isDark ? "placeholder:text-neutral-600" : "placeholder:text-neutral-400"
        }`}
      />
      <button
        type="button"
        aria-label="Create tag"
        onClick={submit}
        disabled={!value.trim()}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
          isDark ? "hover:bg-white/10" : "hover:bg-black/[0.06]"
        }`}
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Menu « Tags » de la barre d'outils : afficher / masquer les colonnes + créer un tag. */
function TagsMenu({
  tags,
  hidden,
  onToggle,
  onCreate,
  isDark,
  ghost,
}: {
  tags: Tag[];
  hidden: string[];
  onToggle: (id: string) => void;
  onCreate: (label: string) => void;
  isDark: boolean;
  ghost: string;
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
          isDark ? "focus-visible:ring-white/40" : "focus-visible:ring-black/30"
        }`}
      >
        <TagIcon className="h-4 w-4" />
        Tags
        {hidden.length > 0 && (
          <span
            className={`rounded-full px-1.5 text-[11px] tabular-nums ${
              isDark ? "bg-white text-black" : "bg-black text-white"
            }`}
          >
            {tags.length - hidden.length}/{tags.length}
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
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            className={`absolute right-0 z-40 mt-2 w-[240px] rounded-xl border p-1 shadow-lg ${
              isDark ? "border-white/10 bg-[#0c0c0c]" : "border-black/10 bg-white"
            }`}
          >
            <ul className="max-h-[260px] overflow-y-auto">
              {tags.map((t) => {
                const on = !hidden.includes(t.id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onToggle(t.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                        isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]"
                      }`}
                    >
                      <span className="truncate">{t.label}</span>
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
            <div className={`mt-1 border-t p-1 pt-2 ${isDark ? "border-white/10" : "border-black/10"}`}>
              <CreateTagInput onCreate={onCreate} isDark={isDark} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Sélecteur de tag (un seul) de la modale, avec création à la volée. */
function TagSelect({
  tags,
  value,
  onChange,
  onCreate,
  isDark,
  ghost,
  line,
}: {
  tags: Tag[];
  value: string;
  onChange: (id: string) => void;
  onCreate: (label: string) => string | null;
  isDark: boolean;
  ghost: string;
  line: string;
}) {
  const [open, setOpen] = useState(false);
  const current = tags.find((t) => t.id === value);
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${ghost} ${line} ${
          isDark ? "focus-visible:ring-white/40" : "focus-visible:ring-black/30"
        }`}
      >
        <TagIcon className="h-4 w-4" />
        {current?.label ?? "Tag"}
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
          <div
            className={`absolute right-0 z-[70] mt-2 w-[240px] rounded-xl border p-1 shadow-lg ${
              isDark ? "border-white/10 bg-[#0c0c0c]" : "border-black/10 bg-white"
            }`}
          >
            <ul role="listbox" className="max-h-[220px] overflow-y-auto">
              {tags.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={t.id === value}
                    onClick={() => {
                      onChange(t.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                      t.id === value
                        ? isDark
                          ? "bg-white/10"
                          : "bg-black/[0.06]"
                        : isDark
                        ? "hover:bg-white/[0.06]"
                        : "hover:bg-black/[0.04]"
                    }`}
                  >
                    <span className="truncate">{t.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className={`mt-1 border-t p-1 pt-2 ${isDark ? "border-white/10" : "border-black/10"}`}>
              <CreateTagInput
                isDark={isDark}
                onCreate={(label) => {
                  const id = onCreate(label);
                  if (id) {
                    onChange(id);
                    setOpen(false);
                  }
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Carte d'idée (board : draggable ; galerie : statique). */
function IdeaCard({
  idea,
  tagLabel,
  isDark,
  muted,
  draggable,
  dragging,
  dropBefore,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  idea: Idea;
  tagLabel?: string;
  isDark: boolean;
  muted: string;
  draggable?: boolean;
  dragging?: boolean;
  dropBefore?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
}) {
  return (
    <div className="relative" onDragOver={onDragOver} onDrop={onDrop}>
      {dropBefore && (
        <span
          className={`absolute -top-2 left-0 right-0 h-0.5 rounded-full ${
            isDark ? "bg-white" : "bg-black"
          }`}
        />
      )}
      <article
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`overflow-hidden rounded-xl border transition-colors ${
          draggable ? "cursor-grab active:cursor-grabbing" : ""
        } ${dragging ? "opacity-40" : ""} ${
          isDark
            ? "border-white/10 bg-[#0c0c0c] hover:border-white/25"
            : "border-black/10 bg-white hover:border-black/25"
        }`}
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
          {tagLabel && (
            <span
              className={`mt-2 w-fit rounded-md px-2 py-0.5 text-[11px] font-medium ${
                isDark ? "bg-white/10" : "bg-black/[0.06]"
              }`}
            >
              {tagLabel}
            </span>
          )}
        </div>
      </article>
    </div>
  );
}

/* ───────── Modale « Create Idea » ───────── */

function IdeaModal({
  tags,
  initialTagId,
  isDark,
  ghost,
  line,
  muted,
  ring,
  onClose,
  onSave,
  onCreateTag,
}: {
  tags: Tag[];
  initialTagId: string;
  isDark: boolean;
  ghost: string;
  line: string;
  muted: string;
  ring: string;
  onClose: () => void;
  onSave: (idea: Omit<Idea, "id">) => void;
  onCreateTag: (label: string) => string | null;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagId, setTagId] = useState(initialTagId);
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
      tagId: asPost && tagId === UNASSIGNED ? "todo" : tagId,
    });
    onClose();
  };

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
          <TagSelect
            tags={tags}
            value={tagId}
            onChange={setTagId}
            onCreate={onCreateTag}
            isDark={isDark}
            ghost={ghost}
            line={line}
          />
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
              placeholder="Everything begins with an idea…"
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

  const { tags, ideas, addTag, renameTag, deleteTag, moveTag, addIdea, moveIdea, moveAll } =
    useBoard();

  const [tab, setTab] = useState<Tab>("ideas");
  const [view, setView] = useState<View>("board");
  const [hidden, setHidden] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [modalTag, setModalTag] = useState<string | null>(null);

  // Drag & drop des idées (natif HTML5)
  const drag = useRef<DragState>(null);
  const [dragKind, setDragKind] = useState<"idea" | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [overCard, setOverCard] = useState<string | null>(null);

  // Drag des colonnes (pointer events : fantôme flottant + décalage fluide)
  const [colDrag, setColDrag] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef(new Map<string, HTMLElement>());
  const prevLefts = useRef(new Map<string, number>());
  const visibleRef = useRef<Tag[]>([]);

  // Menu « … » d'une colonne / renommage / ajout de colonne
  const [colMenu, setColMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [addingCol, setAddingCol] = useState(false);

  const page = isDark ? "bg-black text-white" : "bg-white text-black";
  const line = isDark ? "border-white/10" : "border-black/10";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const ghost = isDark ? "hover:bg-neutral-700/70" : "hover:bg-neutral-200";
  const ring = isDark ? "focus-visible:ring-white/40" : "focus-visible:ring-black/30";
  const column = isDark ? "bg-white/[0.04]" : "bg-[#f5f5f5]";
  const outline = isDark ? "border-white/15 hover:bg-white/10" : "border-black/15 hover:bg-black/5";
  const chip = isDark ? "bg-white/10" : "bg-black/[0.07]";

  const visibleTags = tags.filter((t) => !hidden.includes(t.id));
  visibleRef.current = visibleTags;
  const tagLabel = (id: string) => tags.find((t) => t.id === id)?.label;

  const toggleHidden = (id: string) =>
    setHidden((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const createTag = (label: string) => {
    const id = addTag(label);
    if (id) setHidden((prev) => prev.filter((x) => x !== id));
    return id;
  };

  /* ── Drag des idées (natif) ── */

  const endDrag = () => {
    drag.current = null;
    setDragKind(null);
    setDragId(null);
    setOverCol(null);
    setOverCard(null);
  };

  const startDrag = (e: DragEvent, id: string) => {
    drag.current = { type: "idea", id };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    setDragKind("idea");
    setDragId(id);
  };

  const onColumnDragOver = (e: DragEvent, tagId: string) => {
    if (!drag.current) return;
    e.preventDefault();
    setOverCol(tagId);
  };

  const onColumnDrop = (e: DragEvent, tagId: string) => {
    e.preventDefault();
    const d = drag.current;
    if (d?.type === "idea") moveIdea(d.id, tagId);
    endDrag();
  };

  const onCardDrop = (e: DragEvent, tagId: string, cardId: string) => {
    const d = drag.current;
    if (d?.type !== "idea") return;
    e.preventDefault();
    e.stopPropagation();
    moveIdea(d.id, tagId, cardId);
    endDrag();
  };

  /* ── Drag des colonnes : fantôme flottant + les autres colonnes se décalent en direct ── */

  const onHeaderPointerDown = (e: RPointerEvent, tagId: string) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button,input")) return;
    const section = colRefs.current.get(tagId);
    if (!section) return;

    const rect = section.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const offX = e.clientX - rect.left;
    const offY = e.clientY - rect.top;
    let ghostEl: HTMLElement | null = null;

    const onMove = (ev: PointerEvent) => {
      if (!ghostEl) {
        // seuil de 5px avant de démarrer (laisse passer les simples clics)
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;

        ghostEl = section.cloneNode(true) as HTMLElement;
        Object.assign(ghostEl.style, {
          position: "fixed",
          margin: "0",
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          zIndex: "200",
          pointerEvents: "none",
          transition: "none",
          transform: "rotate(2deg)",
          transformOrigin: "50% 0",
          background: isDark ? "#141414" : "#f5f5f5",
          color: getComputedStyle(section).color,
          opacity: "1",
          boxShadow: isDark
            ? "0 18px 40px rgba(0,0,0,0.7)"
            : "0 18px 40px rgba(0,0,0,0.18)",
        } as Partial<CSSStyleDeclaration>);
        const grip = ghostEl.querySelector<HTMLElement>("[data-grip]");
        if (grip) grip.style.opacity = "1";
        document.body.appendChild(ghostEl);
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        setColDrag(tagId);
      }

      ghostEl.style.left = `${ev.clientX - offX}px`;
      ghostEl.style.top = `${ev.clientY - offY}px`;

      const board = boardRef.current;
      if (!board) return;
      const b = board.getBoundingClientRect();

      // auto-scroll horizontal près des bords
      if (ev.clientX > b.right - 60) board.scrollLeft += 14;
      else if (ev.clientX < b.left + 60) board.scrollLeft -= 14;

      // réordonne en direct (positions de layout, indépendantes des animations)
      const x = ev.clientX - b.left + board.scrollLeft;
      const order = visibleRef.current;
      const from = order.findIndex((t) => t.id === tagId);
      let target: number | null = null;
      for (let i = 1; i < order.length; i++) {
        if (i === from) continue;
        const el = colRefs.current.get(order[i].id);
        if (!el) continue;
        const mid = el.offsetLeft + el.offsetWidth / 2;
        if (i > from && x > mid) target = i; // le plus loin vers la droite
        else if (i < from && x < mid && target === null) target = i; // le plus loin vers la gauche
      }
      if (target !== null) moveTag(tagId, order[target].id);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      ghostEl?.remove();
      ghostEl = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setColDrag(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  /** FLIP : anime les colonnes qui changent de place pour laisser sa place à celle qu'on déplace. */
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    colRefs.current.forEach((el, id) => {
      const left = el.offsetLeft;
      next.set(id, left);
      const prev = prevLefts.current.get(id);
      if (prev !== undefined && prev !== left && !reduce) {
        el.style.transition = "none";
        el.style.transform = `translateX(${prev - left}px)`;
        el.getBoundingClientRect(); // force le reflow
        el.style.transition = "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)";
        el.style.transform = "";
        el.addEventListener("transitionend", () => (el.style.transition = ""), { once: true });
      }
    });
    prevLefts.current = next;
  });

  const visibleIdeas = ideas.filter((i) => !hidden.includes(i.tagId));

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
                  onClick={() => setModalTag(UNASSIGNED)}
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
                  <TagsMenu
                    tags={tags}
                    hidden={hidden}
                    onToggle={toggleHidden}
                    onCreate={(l) => void createTag(l)}
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

              {/* ───── Board ───── */}
              {tab === "ideas" && view === "board" && (
                <div
                  ref={boardRef}
                  className="relative flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2"
                >
                  {visibleTags.map((tag) => {
                    const items = ideas.filter((i) => i.tagId === tag.id);
                    const fixed = tag.id === UNASSIGNED;
                    const isPlaceholder = colDrag === tag.id;
                    const isOver = overCol === tag.id && dragId !== tag.id;
                    const ideaTarget = isOver && dragKind === "idea";

                    return (
                      <section
                        key={tag.id}
                        ref={(el) => {
                          if (el) colRefs.current.set(tag.id, el);
                          else colRefs.current.delete(tag.id);
                        }}
                        onDragOver={(e) => onColumnDragOver(e, tag.id)}
                        onDragLeave={() => setOverCol((c) => (c === tag.id ? null : c))}
                        onDrop={(e) => onColumnDrop(e, tag.id)}
                        className={`group/col relative flex min-h-0 w-[min(300px,85vw)] shrink-0 flex-col rounded-2xl p-3 transition-colors motion-reduce:transition-none ${
                          isPlaceholder
                            ? `${isDark ? "bg-white/[0.08]" : "bg-black/[0.07]"} [&>*]:invisible`
                            : ideaTarget
                            ? isDark
                              ? "bg-white/[0.12]"
                              : "bg-black/[0.09]"
                            : column
                        }`}
                      >
                        {/* Les 6 points, centrés en haut (survol + fantôme) */}
                        {!fixed && (
                          <span
                            data-grip
                            aria-hidden="true"
                            className={`pointer-events-none absolute left-1/2 top-0.5 -translate-x-1/2 opacity-0 transition-opacity group-hover/col:opacity-100 ${muted}`}
                          >
                            <DragDotsIcon className="h-5 w-5" />
                          </span>
                        )}

                        {/* En-tête : on l'attrape ici pour déplacer la colonne */}
                        <div
                          onPointerDown={(e) =>
                            !fixed && editing !== tag.id && onHeaderPointerDown(e, tag.id)
                          }
                          className={`flex items-center justify-between px-2 pb-3 pt-3 ${
                            fixed ? "" : "cursor-grab touch-none select-none active:cursor-grabbing"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            {editing === tag.id ? (
                              <input
                                autoFocus
                                defaultValue={tag.label}
                                maxLength={30}
                                onBlur={(e) => {
                                  renameTag(tag.id, e.target.value);
                                  setEditing(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                  if (e.key === "Escape") setEditing(null);
                                }}
                                className={`w-[120px] rounded-md border bg-transparent px-2 py-0.5 text-[15px] font-semibold outline-none ${
                                  isDark ? "border-white/30" : "border-black/30"
                                }`}
                              />
                            ) : (
                              <h2 className="truncate text-[15px] font-semibold">{tag.label}</h2>
                            )}
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium tabular-nums ${chip} ${muted}`}
                            >
                              {items.length}
                            </span>
                          </div>

                          <div className="relative flex items-center">
                            <IconButton
                              label="New idea"
                              onClick={() => setModalTag(tag.id)}
                              ghost={ghost}
                              isDark={isDark}
                              className="h-8 w-8"
                            >
                              <PlusIcon className="h-[18px] w-[18px]" />
                            </IconButton>
                            {!fixed && (
                              <>
                                <IconButton
                                  label="Tag options"
                                  onClick={() => setColMenu((c) => (c === tag.id ? null : tag.id))}
                                  ghost={ghost}
                                  isDark={isDark}
                                  className="h-8 w-8"
                                >
                                  <DotsIcon className="h-[18px] w-[18px]" />
                                </IconButton>
                                {colMenu === tag.id && (
                                  <>
                                    <button
                                      type="button"
                                      aria-label="Close menu"
                                      tabIndex={-1}
                                      className="fixed inset-0 z-30 cursor-default"
                                      onClick={() => setColMenu(null)}
                                    />
                                    <div
                                      className={`absolute right-0 top-full z-40 mt-1 min-w-[210px] rounded-xl border p-1 shadow-lg ${
                                        isDark
                                          ? "border-white/10 bg-[#0c0c0c]"
                                          : "border-black/10 bg-white"
                                      }`}
                                    >
                                      {[
                                        {
                                          label: "Rename tag",
                                          run: () => setEditing(tag.id),
                                        },
                                        {
                                          label: "Move all to Unassigned",
                                          run: () => moveAll(tag.id, UNASSIGNED),
                                        },
                                        {
                                          label: "Delete tag",
                                          run: () => deleteTag(tag.id),
                                        },
                                      ].map((o) => (
                                        <button
                                          key={o.label}
                                          type="button"
                                          onClick={() => {
                                            o.run();
                                            setColMenu(null);
                                          }}
                                          className={`w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                                            isDark
                                              ? "hover:bg-white/[0.06]"
                                              : "hover:bg-black/[0.04]"
                                          }`}
                                        >
                                          {o.label}
                                        </button>
                                      ))}
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
                              dragging={dragKind === "idea" && dragId === idea.id}
                              dropBefore={
                                dragKind === "idea" && overCard === idea.id && dragId !== idea.id
                              }
                              onDragStart={(e) => startDrag(e, idea.id)}
                              onDragEnd={endDrag}
                              onDragOver={(e) => {
                                if (drag.current?.type !== "idea") return;
                                e.preventDefault();
                                e.stopPropagation();
                                setOverCard(idea.id);
                                setOverCol(tag.id);
                              }}
                              onDrop={(e) => onCardDrop(e, tag.id, idea.id)}
                            />
                          ))}
                          <button
                            type="button"
                            onClick={() => setModalTag(tag.id)}
                            className={`mt-1 flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${ghost} ${ring}`}
                          >
                            <PlusIcon className="h-[18px] w-[18px]" />
                            New Idea
                          </button>
                        </div>
                      </section>
                    );
                  })}

                  {/* Ajouter une colonne (= créer un tag) */}
                  <div className="w-[min(260px,80vw)] shrink-0">
                    {addingCol ? (
                      <div className={`rounded-2xl p-3 ${column}`}>
                        <CreateTagInput
                          autoFocus
                          isDark={isDark}
                          placeholder="Tag name…"
                          onCreate={(l) => {
                            createTag(l);
                            setAddingCol(false);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setAddingCol(false)}
                          className={`mt-2 w-full rounded-lg px-3 py-1.5 text-[13px] font-medium ${muted} ${ghost}`}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingCol(true)}
                        className={`flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-4 text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${ring} ${
                          isDark
                            ? "border-white/20 hover:bg-white/[0.06]"
                            : "border-black/20 hover:bg-black/[0.04]"
                        }`}
                      >
                        <PlusIcon className="h-[18px] w-[18px]" />
                        New tag
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ───── Gallery ───── */}
              {tab === "ideas" && view === "gallery" && (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {visibleIdeas.length === 0 ? (
                    <div className="mt-16 flex flex-col items-center gap-3 text-center">
                      <h2 className="text-[20px] font-semibold tracking-tight">No ideas yet</h2>
                      <p className={`max-w-[360px] text-[14px] leading-relaxed ${muted}`}>
                        Capture your next post idea before it gets away.
                      </p>
                      <button
                        type="button"
                        onClick={() => setModalTag(UNASSIGNED)}
                        className={`mt-2 flex items-center gap-2 rounded-xl border px-4 py-2 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${outline} ${ring}`}
                      >
                        <PlusIcon className="h-[18px] w-[18px]" />
                        New Idea
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 pb-4">
                      {visibleIdeas.map((idea) => (
                        <IdeaCard
                          key={idea.id}
                          idea={idea}
                          tagLabel={tagLabel(idea.tagId)}
                          isDark={isDark}
                          muted={muted}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {modalTag && (
        <IdeaModal
          tags={tags}
          initialTagId={modalTag}
          isDark={isDark}
          ghost={ghost}
          line={line}
          muted={muted}
          ring={ring}
          onClose={() => setModalTag(null)}
          onSave={addIdea}
          onCreateTag={createTag}
        />
      )}
    </main>
  );
}