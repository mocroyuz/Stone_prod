import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import NewIdeaModal, { type NewIdeaValues } from "./Newideamodal";

/* ─────────────────────────────────────────────────────────
 * Types publics
 * ───────────────────────────────────────────────────────── */

export type BottomBarTab = "files" | "add";

type BottomBarProps = {
  /** Thème. */
  isDark?: boolean;

  /** Onglet actif, piloté par le parent. */
  active?: BottomBarTab | null;

  /** Libellé accessible du bouton de création et de son menu. */
  addLabel?: string;

  /** Décalage à gauche (ex : largeur d'une sidebar). */
  offsetLeft?: number;

  /** Clic sur l'onglet Dossiers. */
  onSelectFiles?: () => void;

  /** Soumission de la modale « Nouvelle idée » (gérée par le BottomBar). */
  onSubmitIdea?: (values: NewIdeaValues) => void | Promise<void>;

  /** Choix « Publication » dans le menu de création. */
  onCreatePost?: () => void;

  /**
   * Fallback : si aucun handler de création n'est fourni,
   * le bouton de création remonte cet id via `onChange("add")`.
   */
  onChange?: (id: BottomBarTab) => void;
};

/* ─────────────────────────────────────────────────────────
 * Icônes
 * ───────────────────────────────────────────────────────── */

const svgProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const FilesIcon = (
  <svg {...svgProps}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  </svg>
);

const PlusIcon = (
  <svg {...svgProps} width={20} height={20} strokeWidth={2.4}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IdeaIcon = (
  <svg {...svgProps} width={22} height={22}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
  </svg>
);

const PostIcon = (
  <svg {...svgProps} width={22} height={22}>
    <path d="M6 3h9l5 5v13H6z" />
    <path d="M14 3v6h6M9 13h8M9 17h8" />
  </svg>
);

/* ─────────────────────────────────────────────────────────
 * Keyframes
 * ───────────────────────────────────────────────────────── */

const ANIMATION_KEYFRAMES = `
@keyframes addMenuIn {
  0%   { opacity: 0; transform: translateY(10px) scale(.94); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes addItemIn {
  0%   { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes scrimIn {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .bb-anim { animation: none !important; }
  .bb-motion { transition: none !important; }
}
`;

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/* ─────────────────────────────────────────────────────────
 * Composant
 * ───────────────────────────────────────────────────────── */

export default function BottomBar({
  isDark = false,
  active = null,
  addLabel = "Nouvelle publication",
  offsetLeft = 0,
  onSelectFiles,
  onSubmitIdea,
  onCreatePost,
  onChange,
}: BottomBarProps) {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isIdeaOpen, setIsIdeaOpen] = useState(false);

  const addButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /** La modale « idée » est toujours disponible via le menu. */
  const hasIdea = true;
  const hasMenu = hasIdea || Boolean(onCreatePost);

  /* ── Handlers internes ─────────────────────────────────── */

  const closeMenu = useCallback((restoreFocus = false) => {
    setIsAddMenuOpen(false);
    if (restoreFocus) addButtonRef.current?.focus();
  }, []);

  const handleFilesClick = useCallback(() => {
    setIsAddMenuOpen(false);
    if (onSelectFiles) onSelectFiles();
    else onChange?.("files");
  }, [onSelectFiles, onChange]);

  const handleAddClick = useCallback(() => {
    if (!hasMenu) {
      onChange?.("add");
      return;
    }
    setIsAddMenuOpen((open) => !open);
  }, [hasMenu, onChange]);

  const handleCreateIdea = useCallback(() => {
    setIsAddMenuOpen(false);
    setIsIdeaOpen(true);
  }, []);

  const closeIdea = useCallback(() => {
    setIsIdeaOpen(false);
    addButtonRef.current?.focus();
  }, []);

  const submitIdea = useCallback(
    async (values: NewIdeaValues) => {
      await onSubmitIdea?.(values);
    },
    [onSubmitIdea]
  );

  const handleCreatePost = useCallback(() => {
    setIsAddMenuOpen(false);
    onCreatePost?.();
  }, [onCreatePost]);

  /** Clavier dans le menu : ↑ ↓ Home End, raccourcis P / I, Tab et Échap. */
  const handleMenuKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]'
        ) ?? []
      );
      if (items.length === 0) return;

      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const key = event.key;

      if (key === "ArrowDown") {
        event.preventDefault();
        items[(index + 1) % items.length].focus();
      } else if (key === "ArrowUp") {
        event.preventDefault();
        items[(index - 1 + items.length) % items.length].focus();
      } else if (key === "Home") {
        event.preventDefault();
        items[0].focus();
      } else if (key === "End") {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (key === "Tab") {
        event.preventDefault();
        closeMenu(true);
      } else if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        const k = key.toLowerCase();
        if (k === "i") handleCreateIdea();
        else if (k === "p" && onCreatePost) handleCreatePost();
      }
    },
    [closeMenu, handleCreateIdea, handleCreatePost, onCreatePost]
  );

  /* ── Effets ────────────────────────────────────────────── */

  // Menu : focus du premier item + Échap.
  useEffect(() => {
    if (!isAddMenuOpen) return;

    const focusTimer = window.setTimeout(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
        ?.focus();
    }, 30);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu(true);
    };

    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
    };
  }, [isAddMenuOpen, closeMenu]);

  /* ── Styles dérivés ────────────────────────────────────── */

  const focusRing = [
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-neutral-500 focus-visible:ring-offset-2",
    isDark
      ? "focus-visible:ring-offset-[#1c1c1e]"
      : "focus-visible:ring-offset-[#faf9f6]",
  ].join(" ");

  const isFilesActive = active === "files";

  const filesTone = isDark
    ? isFilesActive
      ? "border border-white/50 bg-white/10 text-white"
      : "border border-white/10 bg-[#141416] text-neutral-300 hover:border-white/25 hover:text-white"
    : isFilesActive
      ? "border border-black/70 bg-black/[0.04] text-black"
      : "border border-black/10 bg-white text-black/70 hover:border-black/25 hover:text-black";

  const addTone = isDark
    ? "bg-white text-neutral-900 hover:bg-neutral-200"
    : "bg-black text-white hover:bg-neutral-800";

  const barTone = isDark
    ? "border border-white/10 bg-[#1c1c1e]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_48px_-12px_rgba(0,0,0,0.7)]"
    : "border border-black/[0.06] bg-[#faf9f6]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_48px_-12px_rgba(0,0,0,0.25)]";

  const menuTone = isDark
    ? "border border-white/10 bg-[#1c1c1e]/95 text-neutral-100 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7)]"
    : "border border-black/[0.06] bg-white/95 text-neutral-900 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.25)]";

  /* ── Rendu ─────────────────────────────────────────────── */

  return (
    <>
      <style>{ANIMATION_KEYFRAMES}</style>

      {/* Voile derrière le menu */}
      {isAddMenuOpen && (
        <div
          aria-hidden
          onClick={() => closeMenu()}
          className={[
            "bb-anim fixed inset-0 z-20 backdrop-blur-[3px]",
            "animate-[scrimIn_200ms_ease-out_both]",
            isDark ? "bg-black/55" : "bg-black/25",
          ].join(" ")}
        />
      )}

      <nav
        aria-label="Actions rapides"
        className="pointer-events-none fixed bottom-0 right-0 z-30 flex justify-center px-4"
        style={{
          left: offsetLeft,
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="relative">
          {/* Menu de création */}
          {isAddMenuOpen && (
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-3 flex w-0 justify-center">
              <div
                ref={menuRef}
                id="bottombar-add-menu"
                role="menu"
                aria-label={addLabel}
                aria-orientation="vertical"
                onKeyDown={handleMenuKeyDown}
                className={[
                  "bb-anim pointer-events-auto origin-bottom",
                  "w-[min(300px,calc(100vw-32px))] rounded-[22px] p-1.5 backdrop-blur-xl",
                  "animate-[addMenuIn_220ms_cubic-bezier(0.22,1,0.36,1)_both]",
                  menuTone,
                ].join(" ")}
              >
                {onCreatePost && (
                  <MenuItem
                    icon={PostIcon}
                    title="Publication"
                    description="Publier du contenu sur un canal"
                    shortcut="P"
                    isDark={isDark}
                    delay={30}
                    onClick={handleCreatePost}
                  />
                )}

                {hasIdea && (
                  <MenuItem
                    icon={IdeaIcon}
                    title="Nouvelle idée"
                    description="Noter une idée de contenu"
                    shortcut="I"
                    isDark={isDark}
                    delay={70}
                    onClick={handleCreateIdea}
                  />
                )}
              </div>
            </div>
          )}

          <ul
            className={[
              "pointer-events-auto flex items-center gap-2 rounded-full p-2",
              "backdrop-blur-xl backdrop-saturate-150",
              barTone,
            ].join(" ")}
          >
            {/* Dossiers */}
            <li>
              <button
                type="button"
                aria-label="Dossiers"
                title="Dossiers"
                aria-current={isFilesActive ? "page" : undefined}
                onClick={handleFilesClick}
                className={[
                  "bb-motion relative flex h-12 w-12 items-center justify-center rounded-full",
                  "transition duration-150 active:scale-90",
                  focusRing,
                  filesTone,
                ].join(" ")}
              >
                {FilesIcon}
                {isFilesActive && (
                  <span
                    aria-hidden
                    className="absolute bottom-1.5 h-1 w-1 rounded-full bg-current"
                  />
                )}
              </button>
            </li>

            {/* « + » */}
            <li>
              <button
                ref={addButtonRef}
                type="button"
                aria-label={isAddMenuOpen ? "Fermer le menu" : addLabel}
                title={addLabel}
                aria-haspopup={hasMenu ? "menu" : undefined}
                aria-expanded={hasMenu ? isAddMenuOpen : undefined}
                aria-controls={hasMenu ? "bottombar-add-menu" : undefined}
                onClick={handleAddClick}
                className={[
                  "bb-motion flex h-12 w-12 items-center justify-center rounded-full",
                  "transition duration-150 active:scale-90",
                  focusRing,
                  addTone,
                ].join(" ")}
              >
                <span
                  className={[
                    "bb-motion flex items-center justify-center",
                    "transition-transform duration-300",
                    EASE,
                    isAddMenuOpen ? "rotate-[135deg]" : "rotate-0",
                  ].join(" ")}
                >
                  {PlusIcon}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {/* Modale « Nouvelle idée » */}
      <NewIdeaModal
        isOpen={isIdeaOpen}
        onClose={closeIdea}
        onSubmit={submitIdea}
        isDark={isDark}
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────
 * MenuItem
 * ───────────────────────────────────────────────────────── */

type MenuItemProps = {
  icon: ReactNode;
  title: string;
  description: string;
  shortcut?: string;
  isDark: boolean;
  delay: number;
  onClick: () => void;
};

function MenuItem({
  icon,
  title,
  description,
  shortcut,
  isDark,
  delay,
  onClick,
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={[
        "bb-anim group flex w-full items-center gap-3 rounded-[16px] p-2 text-left",
        "outline-none transition duration-150 active:scale-[0.98]",
        "animate-[addItemIn_240ms_cubic-bezier(0.22,1,0.36,1)_both]",
        isDark
          ? "hover:bg-white/[0.07] focus-visible:bg-white/[0.09] focus-visible:ring-1 focus-visible:ring-white/25"
          : "hover:bg-black/[0.04] focus-visible:bg-black/[0.05] focus-visible:ring-1 focus-visible:ring-black/20",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]",
          "transition-transform duration-200 group-hover:scale-105",
          isDark ? "bg-white/10 text-white" : "bg-black/[0.05] text-black",
        ].join(" ")}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight">
          {title}
        </span>
        <span
          className={[
            "mt-0.5 block truncate text-[13px] leading-tight",
            isDark ? "text-neutral-400" : "text-neutral-500",
          ].join(" ")}
        >
          {description}
        </span>
      </span>

      {shortcut && (
        <kbd
          aria-hidden
          className={[
            "hidden shrink-0 rounded-md border px-1.5 py-0.5 sm:block",
            "font-sans text-[11px] leading-none",
            isDark
              ? "border-white/10 text-neutral-500"
              : "border-black/10 text-neutral-400",
          ].join(" ")}
        >
          {shortcut}
        </kbd>
      )}
    </button>
  );
}