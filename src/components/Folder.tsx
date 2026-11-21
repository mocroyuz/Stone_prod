import { useEffect, useRef, useState } from "react";

export type FolderItem = {
  id: string;
  name: string;
  count: number;
  /** Couleur du dossier (hex). */
  color: string;
};

type FolderProps = {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  /** Conservé pour compatibilité : la modale est centrée sur tout l'écran. */
  offsetLeft?: number;
  /** Dossiers initiaux. Par défaut : aucun. */
  initialFolders?: FolderItem[];
  onSelect?: (folder: FolderItem) => void;
  onCreate?: (folder: FolderItem) => void;
  /** Appelé quand le nom ou la couleur d'un dossier est modifié. */
  onUpdate?: (folder: FolderItem) => void;
};

const FOLDER_COLORS: { hex: string; label: string }[] = [
  { hex: "#ef4444", label: "Rouge" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#eab308", label: "Jaune" },
  { hex: "#22c55e", label: "Vert" },
  { hex: "#14b8a6", label: "Turquoise" },
  { hex: "#3b82f6", label: "Bleu" },
  { hex: "#8b5cf6", label: "Violet" },
  { hex: "#ec4899", label: "Rose" },
  { hex: "#737373", label: "Gris" },
];

const DEFAULT_COLOR = "#3b82f6";

function FolderIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

function PlusIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function PencilIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

export default function Folder({
  isOpen,
  onClose,
  isDark = false,
  initialFolders = [],
  onSelect,
  onCreate,
  onUpdate,
}: FolderProps) {
  const [folders, setFolders] = useState<FolderItem[]>(initialFolders);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState(DEFAULT_COLOR);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const editingFolder = folders.find((f) => f.id === editingId) ?? null;

  useEffect(() => {
    if (!isOpen) {
      setEditingId(null);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Échap ferme d'abord l'édition, puis la modale.
      if (editingId) setEditingId(null);
      else onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose, editingId]);

  // À l'ouverture de l'édition, le champ nom prend le focus.
  useEffect(() => {
    if (editingId) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingId]);

  if (!isOpen) return null;

  const startEditing = (folder: FolderItem) => {
    setDraftName(folder.name);
    setDraftColor(folder.color);
    setEditingId(folder.id);
  };

  const handleCreate = () => {
    const folder: FolderItem = {
      id: crypto.randomUUID(),
      name: `Nouveau dossier ${folders.length + 1}`,
      count: 0,
      color: DEFAULT_COLOR,
    };
    setFolders((prev) => [...prev, folder]);
    onCreate?.(folder);
    // On ouvre directement l'édition pour nommer et colorer le dossier.
    startEditing(folder);
  };

  const saveEditing = () => {
    if (!editingFolder) return;
    const updated: FolderItem = {
      ...editingFolder,
      name: draftName.trim() || editingFolder.name,
      color: draftColor,
    };
    setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    onUpdate?.(updated);
    setEditingId(null);
  };

  const border = isDark ? "border-white/10" : "border-black/[0.06]";
  const textPrimary = isDark ? "text-white" : "text-neutral-900";
  const textSecondary = isDark ? "text-neutral-400" : "text-neutral-500";
  const hoverIcon = isDark
    ? "hover:bg-white/10 hover:text-white"
    : "hover:bg-black/5 hover:text-neutral-900";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Dossiers"
        className={[
          "relative flex h-[90vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-[20px] border",
          isDark ? "bg-[#141416]" : "bg-white",
          border,
          isDark
            ? "shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
            : "shadow-[0_32px_80px_rgba(0,0,0,0.22)]",
        ].join(" ")}
      >
        {/* ── Header ── */}
        <div
          className={[
            "flex shrink-0 items-center justify-between border-b px-5 py-3",
            border,
          ].join(" ")}
        >
          <h2 className={["text-[18px] font-bold", textPrimary].join(" ")}>
            Dossiers
          </h2>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreate}
              className={[
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition",
                isDark
                  ? "bg-white text-neutral-900 hover:bg-neutral-200"
                  : "bg-neutral-900 text-white hover:bg-neutral-800",
              ].join(" ")}
            >
              <PlusIcon />
              Nouveau dossier
            </button>

            <div
              className={[
                "mx-1 h-5 w-px",
                isDark ? "bg-white/10" : "bg-black/10",
              ].join(" ")}
            />

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full transition",
                textSecondary,
                hoverIcon,
              ].join(" ")}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* ── Corps ── */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {folders.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div
                className={[
                  "flex h-16 w-16 items-center justify-center rounded-2xl",
                  isDark
                    ? "bg-white/5 text-neutral-500"
                    : "bg-neutral-100 text-neutral-400",
                ].join(" ")}
              >
                <FolderIcon className="h-7 w-7" />
              </div>
              <p className={["text-[14px] font-medium", textSecondary].join(" ")}>
                Aucun dossier pour l'instant
              </p>
              <button
                type="button"
                onClick={handleCreate}
                className={[
                  "mt-1 flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-semibold transition",
                  border,
                  textPrimary,
                  isDark ? "hover:bg-white/5" : "hover:bg-black/5",
                ].join(" ")}
              >
                <PlusIcon />
                Créer un dossier
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {folders.map((folder) => (
                <li key={folder.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelect?.(folder)}
                    className={[
                      "flex w-full items-center gap-3 rounded-2xl border p-3.5 pr-12 text-left transition",
                      border,
                      isDark
                        ? "bg-[#1c1c1e] hover:bg-white/5"
                        : "bg-neutral-50 hover:bg-neutral-100",
                    ].join(" ")}
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${folder.color}26`,
                        color: folder.color,
                      }}
                    >
                      <FolderIcon className="h-5 w-5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={[
                          "block truncate text-[14px] font-semibold",
                          textPrimary,
                        ].join(" ")}
                      >
                        {folder.name}
                      </span>
                      <span
                        className={[
                          "block text-[12.5px] font-medium",
                          isDark ? "text-neutral-500" : "text-neutral-400",
                        ].join(" ")}
                      >
                        {folder.count} élément{folder.count > 1 ? "s" : ""}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startEditing(folder)}
                    title="Modifier le dossier"
                    aria-label={`Modifier le dossier ${folder.name}`}
                    className={[
                      "absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition",
                      textSecondary,
                      hoverIcon,
                    ].join(" ")}
                  >
                    <PencilIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Dialogue : nom et couleur du dossier ── */}
        {editingFolder && (
          <div
            className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
            onClick={(event) => {
              if (event.target === event.currentTarget) setEditingId(null);
            }}
          >
            <div
              role="dialog"
              aria-label="Modifier le dossier"
              className={[
                "w-[380px] max-w-[92%] rounded-2xl border p-6 shadow-2xl",
                isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/10 bg-white",
              ].join(" ")}
            >
              <h3 className={["text-[16px] font-bold", textPrimary].join(" ")}>
                Modifier le dossier
              </h3>

              <div className="mt-4 flex items-center gap-3">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors"
                  style={{
                    backgroundColor: `${draftColor}26`,
                    color: draftColor,
                  }}
                >
                  <FolderIcon className="h-6 w-6" />
                </span>
                <input
                  ref={nameInputRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEditing();
                  }}
                  maxLength={40}
                  placeholder="Nom du dossier"
                  aria-label="Nom du dossier"
                  className={[
                    "h-11 min-w-0 flex-1 rounded-xl border px-3 text-[14px] outline-none transition",
                    "focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2",
                    isDark
                      ? "border-white/10 bg-[#141416] text-white placeholder:text-neutral-600"
                      : "border-black/10 bg-white text-neutral-900 placeholder:text-neutral-400",
                  ].join(" ")}
                />
              </div>

              <p className={["mb-2 mt-5 text-[13px] font-semibold", textPrimary].join(" ")}>
                Couleur
              </p>
              <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Couleur du dossier">
                {FOLDER_COLORS.map((c) => {
                  const selected = draftColor === c.hex;
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={c.label}
                      title={c.label}
                      onClick={() => setDraftColor(c.hex)}
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-full text-white transition active:scale-90",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2",
                        selected
                          ? isDark
                            ? "ring-2 ring-white ring-offset-2 ring-offset-[#1c1c1e]"
                            : "ring-2 ring-neutral-900 ring-offset-2"
                          : "",
                      ].join(" ")}
                      style={{ backgroundColor: c.hex }}
                    >
                      {selected && <CheckIcon className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className={[
                    "flex-1 rounded-xl border px-4 py-2.5 text-[13.5px] font-semibold transition",
                    border,
                    textPrimary,
                    isDark ? "hover:bg-white/5" : "hover:bg-black/5",
                  ].join(" ")}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={saveEditing}
                  className={[
                    "flex-1 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold transition",
                    isDark
                      ? "bg-white text-[#141416] hover:bg-neutral-200"
                      : "bg-neutral-900 text-white hover:bg-neutral-800",
                  ].join(" ")}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}