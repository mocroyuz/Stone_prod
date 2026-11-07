import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { 
  X, 
  ImagePlus, 
  Smile, 
  Palette, 
  ChevronDown, 
  ListTodo, 
  Tag as TagIcon 
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
  // Optionnel : pour passer les vrais tags/groupes
  availableTags?: { id: string; name: string; color: string }[];
  availableGroups?: { id: string; name: string }[];
};

export default function NewIdeaModal({
  isOpen,
  onClose,
  onSubmit,
  isDark = true, // L'image montre un thème sombre par défaut
  availableTags = [],
  availableGroups = [],
}: NewIdeaModalProps) {
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // État pour les menus déroulants
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>("Unassigned");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const canSubmit = title.trim() !== "" && !isSubmitting;

  /* Gestion de l'ouverture / fermeture */
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => titleRef.current?.focus(), 40);

    return () => {
      window.clearTimeout(timer);
      previouslyFocused.current?.focus();
      setTitle("");
      setFiles([]);
      setIsSubmitting(false);
      setSelectedGroup("Unassigned");
      setSelectedTags([]);
      setIsGroupMenuOpen(false);
      setIsTagMenuOpen(false);
    };
  }, [isOpen]);

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

  /* Auto-resize du textarea principal */
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = `${Math.min(titleRef.current.scrollHeight, 400)}px`;
    }
  }, [title]);

  /* Clic extérieur pour fermer les menus */
  useEffect(() => {
    if (!isGroupMenuOpen && !isTagMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".dropdown-container")) {
        setIsGroupMenuOpen(false);
        setIsTagMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isGroupMenuOpen, isTagMenuOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      setIsSubmitting(true);
      await onSubmit({ 
        title: title.trim(), 
        notes: "", // Gardé pour compatibilité avec l'ancien type
        files,
        groupId: selectedGroup !== "Unassigned" ? selectedGroup : undefined,
        tagIds: selectedTags
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  /* Gestion des fichiers */
  const addFiles = (incomingFiles: FileList | File[]) => {
    const newFiles = Array.from(incomingFiles).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    setFiles((prev) => [...prev, ...newFiles]);
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

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /* Styles conditionnels */
  const bgModal = isDark ? "bg-[#1c1c1e]" : "bg-white";
  const border = isDark ? "border-white/10" : "border-black/10";
  const textPrimary = isDark ? "text-white" : "text-neutral-900";
  const textSecondary = isDark ? "text-neutral-400" : "text-neutral-500";
  const hoverSoft = isDark ? "hover:bg-white/5" : "hover:bg-black/5";
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-idea-title"
        className={[
          "relative flex h-full max-h-[90vh] w-full max-w-[820px] flex-col overflow-hidden rounded-[24px] border shadow-2xl",
          bgModal,
          border,
          isDark ? "shadow-[0_24px_64px_rgba(0,0,0,0.6)]" : "shadow-[0_24px_64px_rgba(0,0,0,0.18)]"
        ].join(" ")}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between px-6 py-5">
          <h2 id="create-idea-title" className={["text-[22px] font-semibold tracking-tight", textPrimary].join(" ")}>
            Create Idea
          </h2>
          
          <div className="flex items-center gap-2 dropdown-container">
            {/* Group Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsGroupMenuOpen(!isGroupMenuOpen);
                  setIsTagMenuOpen(false);
                }}
                className={[
                  "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition",
                  border,
                  textPrimary,
                  hoverSoft
                ].join(" ")}
              >
                <ListTodo className="h-4 w-4 text-neutral-400" />
                {availableGroups.find(g => g.id === selectedGroup)?.name || "Unassigned"}
                <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
              </button>
              
              {isGroupMenuOpen && (
                <div className={[
                  "absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border p-1.5 shadow-xl",
                  isDark ? "border-white/10 bg-[#242427]" : "border-black/10 bg-white"
                ].join(" ")}>
                  <button
                    onClick={() => { setSelectedGroup("Unassigned"); setIsGroupMenuOpen(false); }}
                    className={["flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] transition", textPrimary, hoverSoft].join(" ")}
                  >
                    Unassigned
                  </button>
                  {availableGroups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => { setSelectedGroup(g.id); setIsGroupMenuOpen(false); }}
                      className={["flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] transition", textPrimary, hoverSoft].join(" ")}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tags Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsTagMenuOpen(!isTagMenuOpen);
                  setIsGroupMenuOpen(false);
                }}
                className={[
                  "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition",
                  border,
                  textPrimary,
                  hoverSoft
                ].join(" ")}
              >
                <TagIcon className="h-4 w-4 text-neutral-400" />
                Tags
                {selectedTags.length > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-neutral-500 text-[10px] text-white">
                    {selectedTags.length}
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
              </button>

              {isTagMenuOpen && (
                <div className={[
                  "absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border p-1.5 shadow-xl",
                  isDark ? "border-white/10 bg-[#242427]" : "border-black/10 bg-white"
                ].join(" ")}>
                  {availableTags.length === 0 ? (
                    <p className={["px-3 py-2 text-[12.5px]", textSecondary].join(" ")}>No tags yet.</p>
                  ) : (
                    availableTags.map(tag => {
                      const isSelected = selectedTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => {
                            setSelectedTags(prev => 
                              isSelected ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                            );
                          }}
                          className={["flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition", textPrimary, hoverSoft].join(" ")}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                          <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                          {isSelected && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={["ml-2 flex h-8 w-8 items-center justify-center rounded-full transition", textSecondary, hoverSoft].join(" ")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
          <form id="idea-form" onSubmit={handleSubmit} className="flex h-full flex-col">
            
            {/* Title Input */}
            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your idea a title"
              className={[
                "w-full resize-none bg-transparent text-[28px] font-semibold leading-tight outline-none placeholder:text-neutral-500",
                textPrimary
              ].join(" ")}
              rows={2}
            />

            {/* Media Attachments Grid */}
            {files.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3">
                {files.map((file, i) => (
                  <div key={i} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    {file.type.startsWith("image/") ? (
                      <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-white">Video</div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-md bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/90 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Spacer to push drag drop zone to bottom */}
            <div className="flex-1" />

            {/* Drag & Drop Zone */}
            <div className="mt-8">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className={[
                  "flex h-[120px] w-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center transition-colors",
                  isDragging 
                    ? "border-white/40 bg-white/5" 
                    : isDark ? "border-white/20 hover:border-white/40 hover:bg-white/5" : "border-black/20 hover:border-black/40 hover:bg-black/5"
                ].join(" ")}
              >
                <ImagePlus className={["h-6 w-6", textSecondary].join(" ")} />
                <div className={["px-2 text-[11px] leading-tight", textSecondary].join(" ")}>
                  Drag & drop<br/>or select a file
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <footer className={["flex shrink-0 items-center justify-between border-t px-6 py-4", border].join(" ")}>
          {/* Left icons */}
          <div className="flex items-center gap-1">
            <button type="button" className={["flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold transition", textSecondary, hoverSoft].join(" ")}>
              <Palette className="h-4 w-4" />
              <ChevronDown className="h-3 w-3" />
            </button>
            <button type="button" className={["flex h-8 w-8 items-center justify-center rounded-lg transition", textSecondary, hoverSoft].join(" ")}>
              <Smile className="h-4 w-4" />
            </button>
          </div>

          {/* Right Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!canSubmit}
              className={[
                "h-10 rounded-full px-5 text-[14px] font-semibold transition",
                "disabled:cursor-not-allowed disabled:opacity-40",
                isDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-black/5 text-black hover:bg-black/10"
              ].join(" ")}
            >
              Create Post
            </button>
            <button
              type="submit"
              form="idea-form"
              disabled={!canSubmit}
              className={[
                "h-10 rounded-full px-5 text-[14px] font-semibold transition",
                "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
                isDark ? "bg-white text-black hover:bg-neutral-200" : "bg-black text-white hover:bg-neutral-800"
              ].join(" ")}
            >
              {isSubmitting ? "Saving…" : "Save Idea"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}