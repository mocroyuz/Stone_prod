
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type MouseEvent,
} from "react";

type ModalProps = {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  dark?: boolean;
};

export default function Modal({
  title,
  description,
  open,
  onClose,
  children,
  dark = true,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab") return;
      const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(selector);
      if (!focusable?.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropClick = (
    event: MouseEvent<HTMLDivElement>
  ) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-[3px]"
      onMouseDown={handleBackdropClick}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          "my-auto w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl",
          dark
            ? "border-white/10 bg-[#111111] text-white"
            : "border-neutral-200 bg-white text-neutral-900",
        ].join(" ")}
      >
        <header
          className={[
            "flex items-start justify-between gap-4 border-b px-6 py-5",
            dark ? "border-white/10" : "border-neutral-200",
          ].join(" ")}
        >
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-tight"
            >
              {title}
            </h2>

            {description && (
              <p
                className={[
                  "mt-1 text-sm leading-relaxed",
                  dark ? "text-neutral-400" : "text-neutral-500",
                ].join(" ")}
              >
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl transition",
              dark
                ? "text-neutral-400 hover:bg-white/10 hover:text-white"
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
            ].join(" ")}
          >
            ×
          </button>
        </header>

        <div className="p-6">{children}</div>
      </section>
    </div>
  );
}
