import { useEffect, useRef, useState, type FormEvent } from "react";

export type NewIdeaValues = {
  title: string;
  notes: string;
};

type NewIdeaModalProps = {
  /** Affiche ou masque la modale. */
  isOpen: boolean;
  /** Appelé à la fermeture (Échap, clic sur le voile, Annuler, ✕). */
  onClose: () => void;
  /** Appelé à la validation avec les valeurs saisies. */
  onSubmit: (values: NewIdeaValues) => void | Promise<void>;
  isDark?: boolean;
};

const KEYFRAMES = `
@keyframes ideaScrimIn { 0% { opacity: 0; } 100% { opacity: 1; } }
@keyframes ideaModalIn {
  0% { opacity: 0; transform: translateY(12px) scale(.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .idea-anim { animation: none !important; }
}
`;

const CloseIcon = (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

const BulbIcon = (
  <svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
  </svg>
);

export default function NewIdeaModal({
  isOpen,
  onClose,
  onSubmit,
  isDark = false,
}: NewIdeaModalProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const canSubmit = title.trim() !== "" && !isSubmitting;

  /* Ouverture : mémorise le focus, focus le titre, reset à la fermeture */
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => titleRef.current?.focus(), 40);

    return () => {
      window.clearTimeout(timer);
      previouslyFocused.current?.focus();
      setTitle("");
      setNotes("");
      setIsSubmitting(false);
    };
  }, [isOpen]);

  /* Échap + piège de focus (Tab reste dans la modale) + blocage du scroll */
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      setIsSubmitting(true);
      await onSubmit({ title: title.trim(), notes: notes.trim() });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Styles ──────────────────────────────────────────── */

  const panelTone = isDark
    ? "border border-white/10 bg-[#1c1c1e] text-neutral-100 shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
    : "border border-black/[0.06] bg-white text-neutral-900 shadow-[0_24px_64px_rgba(0,0,0,0.18)]";

  const fieldTone = isDark
    ? "border-white/10 bg-[#141416] text-white placeholder:text-neutral-500 focus:border-white/40"
    : "border-black/10 bg-[#faf9f6] text-neutral-900 placeholder:text-neutral-400 focus:border-black/40";

  const mutedText = isDark ? "text-neutral-400" : "text-neutral-500";

  const iconChip = isDark ? "bg-white/10 text-white" : "bg-black/[0.05] text-black";

  const ghostButton = isDark
    ? "text-neutral-300 hover:bg-white/[0.07]"
    : "text-neutral-600 hover:bg-black/[0.04]";

  const primaryButton = isDark
    ? "bg-white text-neutral-900"
    : "bg-black text-white";

  const focusRing = [
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500",
    "focus-visible:ring-offset-2",
    isDark
      ? "focus-visible:ring-offset-[#1c1c1e]"
      : "focus-visible:ring-offset-white",
  ].join(" ");

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div
        className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
        role="presentation"
      >
        {/* Voile */}
        <div
          aria-hidden
          onClick={onClose}
          className={[
            "idea-anim absolute inset-0 backdrop-blur-[2px]",
            "animate-[ideaScrimIn_200ms_ease-out_both]",
            isDark ? "bg-black/60" : "bg-black/30",
          ].join(" ")}
        />

        {/* Panneau */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-idea-title"
          className={[
            "idea-anim relative w-full max-w-[420px] rounded-[20px] p-5",
            "animate-[ideaModalIn_220ms_cubic-bezier(0.22,1,0.36,1)_both]",
            panelTone,
          ].join(" ")}
        >
          <header className="mb-4 flex items-center gap-3">
            <span
              className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]",
                iconChip,
              ].join(" ")}
            >
              {BulbIcon}
            </span>

            <div className="min-w-0 flex-1">
              <h2
                id="new-idea-title"
                className="text-[16px] font-semibold leading-tight"
              >
                New idea
              </h2>
              <p className={["mt-0.5 text-[13px] leading-tight", mutedText].join(" ")}>
                Capture a content idea
              </p>
            </div>

            <button
              type="button"
              aria-label="Close"
              title="Close"
              onClick={onClose}
              className={[
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                "transition duration-150 active:scale-90",
                ghostButton,
                focusRing,
              ].join(" ")}
            >
              {CloseIcon}
            </button>
          </header>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Title</span>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What's the idea?"
                maxLength={120}
                className={[
                  "h-11 w-full rounded-[12px] border px-3 text-[14px]",
                  "outline-none transition-colors duration-150",
                  fieldTone,
                ].join(" ")}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">
                Notes <span className={["font-normal", mutedText].join(" ")}>(optional)</span>
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Angle, references, anything useful…"
                rows={4}
                className={[
                  "w-full resize-none rounded-[12px] border px-3 py-2.5 text-[14px]",
                  "outline-none transition-colors duration-150",
                  fieldTone,
                ].join(" ")}
              />
            </label>

            <div className="mt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className={[
                  "h-10 rounded-full px-4 text-[14px] font-medium",
                  "transition duration-150 active:scale-95",
                  ghostButton,
                  focusRing,
                ].join(" ")}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!canSubmit}
                className={[
                  "h-10 rounded-full px-5 text-[14px] font-semibold",
                  "transition duration-150 active:scale-95",
                  "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
                  primaryButton,
                  focusRing,
                ].join(" ")}
              >
                {isSubmitting ? "Saving…" : "Save idea"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}