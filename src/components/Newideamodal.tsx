import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  X,
  ImagePlus,
  ChevronDown,
  ListTodo,
  Tag as TagIcon,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Play,
  Check,
  Info,
} from "lucide-react";

export type NewIdeaValues = {
  title: string;
  notes: string;
  files: File[];
  groupId?: string;
  tagIds?: string[];
};

type NewIdeaModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: NewIdeaValues) => void | Promise<void>;
  isDark?: boolean;
  availableTags?: { id: string; name: string; color: string }[];
  availableGroups?: { id: string; name: string }[];
};

type MediaItem = {
  id: string;
  file: File;
  url: string;
  kind: "image" | "video";
};

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function NewIdeaModal({
  isOpen,
  onClose,
  onSubmit,
  isDark = true,
  availableTags = [],
  availableGroups = [],
}: NewIdeaModalProps) {
  const [title, setTitle] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>("Unassigned");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const mediaRef = useRef<MediaItem[]>(media);
  mediaRef.current = media;

  const canSubmit = title.trim() !== "" && !isSubmitting;

  /* Reset à l'ouverture / fermeture */
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => titleRef.current?.focus(), 40);
    return () => {
      window.clearTimeout(timer);
      previouslyFocused.current?.focus();
      mediaRef.current.forEach((m) => URL.revokeObjectURL(m.url));
      setTitle("");
      setMedia([]);
      setIsSubmitting(false);
      setIsFullscreen(false);
      setSelectedGroup("Unassigned");
      setSelectedTags([]);
      setIsGroupMenuOpen(false);
      setIsTagMenuOpen(false);
      setIsDragging(false);
    };
  }, [isOpen]);

  /* Cleanup des URLs à l'unmount */
  useEffect(
    () => () => {
      mediaRef.current.forEach((m) => URL.revokeObjectURL(m.url));
    },
    []
  );

  /* Échap + piège de focus + blocage du scroll */
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (isGroupMenuOpen || isTagMenuOpen) {
          setIsGroupMenuOpen(false);
          setIsTagMenuOpen(false);
        } else {
          onClose();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, isGroupMenuOpen, isTagMenuOpen]);

  /* Auto-resize du titre */
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [title]);

  /* Clic extérieur pour fermer les menus */
  useEffect(() => {
    if (!isGroupMenuOpen && !isTagMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-group-menu]") && !t.closest("[data-tag-menu]")) {
        setIsGroupMenuOpen(false);
        setIsTagMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isGroupMenuOpen, isTagMenuOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    try {
      setIsSubmitting(true);
      await onSubmit({
        title: title.trim(),
        notes: "",
        files: media.map((m) => m.file),
        groupId: selectedGroup !== "Unassigned" ? selectedGroup : undefined,
        tagIds: selectedTags,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  /* Gestion des fichiers */
  const addFiles = (incomingFiles: FileList | File[]) => {
    const incoming = Array.from(incomingFiles).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (incoming.length === 0) return;
    const newItems: MediaItem[] = incoming.map((file) => ({
      id: makeId(),
      file,
      url: URL.createObjectURL(file),
      kind: file.type.startsWith("video/") ? "video" : "image",
    }));
    setMedia((prev) => [...prev, ...newItems]);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    const item = media.find((m) => m.id === id);
    if (item) URL.revokeObjectURL(item.url);
    setMedia((prev) => prev.filter((m) => m.id !== id));
  };

  /* Styles conditionnels */
  const bgModal = isDark ? "bg-[#141416]" : "bg-white";
  const bgPanel = isDark ? "bg-[#1c1c1e]" : "bg-neutral-50";
  const bgCard = isDark ? "bg-[#1c1c1e]" : "bg-neutral-50";
  const border = isDark ? "border-white/10" : "border-black/[0.06]";
  const textPrimary = isDark ? "text-white" : "text-neutral-900";
  const textSecondary = isDark ? "text-neutral-400" : "text-neutral-500";
  const hoverSoft = isDark
    ? "hover:bg-white/10 hover:text-white"
    : "hover:bg-black/5 hover:text-neutral-900";
  const accentBg = isDark ? "bg-white/10" : "bg-neutral-200";
  const accentText = isDark ? "text-white" : "text-neutral-900";

  const selectedGroupName = availableGroups.find((g) => g.id === selectedGroup)?.name;
  const hasPreview = title.trim().length > 0 || media.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create Idea"
        className={[
          "relative flex flex-col overflow-hidden border",
          isFullscreen
            ? "h-[96vh] w-[96vw] rounded-[28px]"
            : "h-[88vh] w-full max-w-[1100px] rounded-[28px]",
          bgModal,
          border,
          isDark
            ? "shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
            : "shadow-[0_32px_80px_rgba(0,0,0,0.22)]",
        ].join(" ")}
      >
        {/* Header */}
        <div
          className={[
            "flex shrink-0 items-center justify-between border-b px-6 py-4",
            border,
          ].join(" ")}
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className={[
                "flex items-center gap-2 rounded-lg text-[17px] font-bold tracking-tight transition hover:opacity-70",
                textPrimary,
              ].join(" ")}
            >
              <ArrowLeft className="h-4 w-4" />
              Create Idea
            </button>

            {/* Group dropdown */}
            <div className="relative" data-group-menu>
              <button
                type="button"
                aria-expanded={isGroupMenuOpen}
                onClick={() => {
                  setIsGroupMenuOpen(!isGroupMenuOpen);
                  setIsTagMenuOpen(false);
                }}
                className={[
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition",
                  border,
                  textSecondary,
                  hoverSoft,
                ].join(" ")}
              >
                <ListTodo className="h-3.5 w-3.5" />
                {selectedGroupName || "Unassigned"}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {isGroupMenuOpen && (
                <div
                  role="menu"
                  className={[
                    "absolute left-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border p-1.5 shadow-2xl",
                    isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/10 bg-white",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={selectedGroup === "Unassigned"}
                    onClick={() => {
                      setSelectedGroup("Unassigned");
                      setIsGroupMenuOpen(false);
                    }}
                    className={[
                      "flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition",
                      textPrimary,
                      hoverSoft,
                    ].join(" ")}
                  >
                    Unassigned
                  </button>
                  {availableGroups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selectedGroup === g.id}
                      onClick={() => {
                        setSelectedGroup(g.id);
                        setIsGroupMenuOpen(false);
                      }}
                      className={[
                        "flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition",
                        textPrimary,
                        hoverSoft,
                      ].join(" ")}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tag dropdown */}
            <div className="relative" data-tag-menu>
              <button
                type="button"
                aria-expanded={isTagMenuOpen}
                onClick={() => {
                  setIsTagMenuOpen(!isTagMenuOpen);
                  setIsGroupMenuOpen(false);
                }}
                className={[
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition",
                  border,
                  textSecondary,
                  hoverSoft,
                ].join(" ")}
              >
                <TagIcon className="h-3.5 w-3.5" />
                Tags
                {selectedTags.length > 0 && (
                  <span
                    className={[
                      "rounded-full px-1.5 text-[11px] font-semibold",
                      accentBg,
                      accentText,
                    ].join(" ")}
                  >
                    {selectedTags.length}
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {isTagMenuOpen && (
                <div
                  role="menu"
                  className={[
                    "absolute left-0 top-full z-50 mt-2 max-h-72 w-60 overflow-y-auto rounded-xl border p-1.5 shadow-2xl",
                    isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/10 bg-white",
                  ].join(" ")}
                >
                  {availableTags.length === 0 ? (
                    <p className={["px-3 py-2 text-[12.5px]", textSecondary].join(" ")}>
                      No tags yet.
                    </p>
                  ) : (
                    availableTags.map((tag) => {
                      const on = selectedTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={on}
                          onClick={() =>
                            setSelectedTags((prev) =>
                              on ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                            )
                          }
                          className={[
                            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition",
                            textPrimary,
                            hoverSoft,
                          ].join(" ")}
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                          {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
              onClick={() => setIsFullscreen((v) => !v)}
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full transition",
                textSecondary,
                hoverSoft,
              ].join(" ")}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full transition",
                textSecondary,
                hoverSoft,
              ].join(" ")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
            <form id="idea-form" onSubmit={handleSubmit} className="flex min-h-full flex-col">
              <section
                aria-label="Idea content"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={[
                  "relative flex flex-1 flex-col rounded-2xl border p-5 transition-colors",
                  isDragging
                    ? isDark
                      ? "border-white/40 bg-white/5"
                      : "border-neutral-400 bg-neutral-100"
                    : [border, bgCard].join(" "),
                ].join(" ")}
              >
                <textarea
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your idea a title…"
                  rows={1}
                  className={[
                    "w-full resize-none bg-transparent text-[22px] font-semibold leading-snug outline-none",
                    textPrimary,
                    isDark ? "placeholder:text-neutral-600" : "placeholder:text-neutral-400",
                  ].join(" ")}
                  style={{ minHeight: 44 }}
                />

                <div className="mt-4 flex flex-wrap items-end gap-3">
                  {media.map((item) => (
                    <div
                      key={item.id}
                      className="group relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-xl border border-black/5"
                    >
                      {item.kind === "image" ? (
                        <img
                          src={item.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="relative h-full w-full">
                          <video
                            src={item.url}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                            <Play className="h-5 w-5 fill-current" />
                          </div>
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                      <button
                        type="button"
                        onClick={() => removeFile(item.id)}
                        aria-label="Remove media"
                        className="absolute right-1.5 top-1.5 z-30 flex h-6 w-6 items-center justify-center rounded-lg bg-black/70 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/90 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={[
                      "flex h-[104px] w-[104px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-2 text-center text-[12px] leading-tight transition-colors",
                      isDark
                        ? "border-white/20 text-neutral-400 hover:border-white/40 hover:bg-white/5"
                        : "border-black/20 text-neutral-500 hover:border-black/40 hover:bg-white",
                    ].join(" ")}
                  >
                    <ImagePlus className="h-6 w-6" strokeWidth={1.75} />
                    <span>
                      Drag & drop
                      <br />
                      <span
                        className={[
                          "font-semibold",
                          isDark ? "text-white" : "text-neutral-900",
                        ].join(" ")}
                      >
                        or select a file
                      </span>
                    </span>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {isDragging && (
                  <div
                    className={[
                      "pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl text-[14px] font-semibold backdrop-blur-[1px]",
                      isDark ? "bg-black/50 text-white" : "bg-white/70 text-neutral-900",
                    ].join(" ")}
                  >
                    Drop to add to your idea
                  </div>
                )}
              </section>
            </form>
          </div>

          {/* Preview panel */}
          <aside
            aria-label="Preview"
            className={[
              "hidden w-[360px] shrink-0 flex-col border-l lg:flex",
              border,
              bgPanel,
            ].join(" ")}
          >
            <div className={["border-b px-5 py-4", border].join(" ")}>
              <h3 className={["text-[15px] font-semibold", textPrimary].join(" ")}>
                Preview
              </h3>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
              {hasPreview ? (
                <div
                  className={[
                    "w-full max-w-[280px] rounded-2xl border p-4 shadow-sm",
                    isDark
                      ? "border-white/10 bg-[#242427]"
                      : "border-black/[0.06] bg-white",
                  ].join(" ")}
                >
                  {media[0] && (
                    <div className="mb-3 overflow-hidden rounded-xl">
                      {media[0].kind === "image" ? (
                        <img
                          src={media[0].url}
                          alt=""
                          className="max-h-[180px] w-full object-cover"
                        />
                      ) : (
                        <video
                          src={media[0].url}
                          className="max-h-[180px] w-full object-cover"
                          muted
                          playsInline
                        />
                      )}
                    </div>
                  )}
                  <p
                    className={[
                      "whitespace-pre-wrap break-words text-[14px] font-semibold leading-snug",
                      textPrimary,
                    ].join(" ")}
                  >
                    {title || "Untitled idea"}
                  </p>
                  {(selectedGroupName || selectedTags.length > 0) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {selectedGroupName && (
                        <span
                          className={[
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            accentBg,
                            accentText,
                          ].join(" ")}
                        >
                          <ListTodo className="h-3 w-3" />
                          {selectedGroupName}
                        </span>
                      )}
                      {selectedTags.map((id) => {
                        const t = availableTags.find((x) => x.id === id);
                        if (!t) return null;
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              backgroundColor: `${t.color}22`,
                              color: t.color,
                            }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: t.color }}
                            />
                            {t.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div
                    className={[
                      "mb-4 flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed",
                      isDark ? "border-neutral-600/30" : "border-neutral-300",
                    ].join(" ")}
                  >
                    <ImagePlus
                      className={["h-6 w-6", textSecondary].join(" ")}
                    />
                  </div>
                  <p
                    className={[
                      "max-w-[200px] text-[13px]",
                      textSecondary,
                    ].join(" ")}
                  >
                    Start writing or add media to see how your idea will look.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Footer */}
        <div
          className={[
            "relative flex shrink-0 items-center justify-end gap-4 border-t px-6 py-4",
            border,
          ].join(" ")}
        >
          <div className="mr-auto flex min-w-0 flex-1 flex-col gap-1">
            {title.trim() === "" && (
              <p
                className={[
                  "flex items-center gap-1.5 text-[12.5px]",
                  textSecondary,
                ].join(" ")}
              >
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>Add a title to save your idea.</span>
              </p>
            )}
          </div>
          <button
            type="submit"
            form="idea-form"
            disabled={!canSubmit}
            className={[
              "flex h-10 items-center rounded-xl px-5 text-[14px] font-semibold transition",
              "disabled:cursor-not-allowed disabled:opacity-40",
              isDark
                ? "bg-white text-[#141416] hover:bg-neutral-200"
                : "bg-neutral-900 text-white hover:bg-neutral-800",
            ].join(" ")}
          >
            {isSubmitting ? "Saving…" : "Save Idea"}
          </button>
        </div>
      </div>
    </div>
  );
}