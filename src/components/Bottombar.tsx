import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import NewIdeaModal, { type NewIdeaValues } from "./NewIdeaModal";

/* ─────────────────────────────────────────────────────────
 * Types publics
 * ───────────────────────────────────────────────────────── */

export type BottomBarTab = "files" | "add";

/**
 * Le BottomBar est un composant « présentationnel + orchestration » :
 *  - il gère l'état LOCAL de l'UI (menu ouvert, recherche ouverte, focus…)
 *  - il expose des HANDLERS au parent pour toute action métier
 *    (ouvrir une modale, naviguer, filtrer…)
 */
type BottomBarProps = {
  /** Thème. */
  isDark?: boolean;

  /** Onglet actif, piloté par le parent. */
  active?: BottomBarTab | null;

  /** Libellé accessible du bouton « + » et de son menu. */
  addLabel?: string;

  /** Recherche : valeur contrôlée + setter. */
  query: string;
  onQueryChange: (value: string) => void;

  /** Décalage à gauche (ex : largeur d'une sidebar). */
  offsetLeft?: number;

  /** Clic sur l'onglet Dossiers. */
  onSelectFiles?: () => void;

  /**
   * Soumission de la modale « New idea » (gérée par le BottomBar).
   * Si fourni, l'entrée « Idea » du menu ouvre la modale.
   */
  onSubmitIdea?: (values: NewIdeaValues) => void | Promise<void>;

  /** Optionnel : notifié quand l'utilisateur choisit « Idea » (ouverture). */
  onCreateIdea?: () => void;

  /** Choix « Post » dans le menu du « + ». */
  onCreatePost?: () => void;

  /**
   * Fallback : si aucun handler de création n'est fourni,
   * le « + » remonte cet id via `onChange("add")`.
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
  <svg {...svgProps} width={22} height={22} strokeWidth={2.2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/* Icônes du menu : 32 → 22 */
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

const ClearIcon = (
  <svg {...svgProps} width={14} height={14} strokeWidth={2.2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[17px] w-[17px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Keyframes
 * ───────────────────────────────────────────────────────── */

const ANIMATION_KEYFRAMES = `
@keyframes searchIconOpen {
  0% { transform: scale(.82) rotate(-12deg); opacity: .65; }
  55% { transform: scale(1.08) rotate(3deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes searchContentIn {
  0% { opacity: 0; transform: translateX(-8px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes searchGlow {
  0% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
  45% { box-shadow: 0 0 0 3px rgba(0, 0, 0, .035); }
  100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
}
@keyframes addMenuIn {
  0% { opacity: 0; transform: translateY(8px) scale(.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes addItemIn {
  0% { opacity: 0; transform: translateY(5px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes scrimIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .bb-anim { animation: none !important; }
}
`;

/* ─────────────────────────────────────────────────────────
 * Composant
 * ───────────────────────────────────────────────────────── */

export default function BottomBar({
  isDark = false,
  active = null,
  addLabel = "Nouvelle publication",
  query,
  onQueryChange,
  offsetLeft = 0,
  onSelectFiles,
  onSubmitIdea,
  onCreateIdea,
  onCreatePost,
  onChange,
}: BottomBarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isIdeaOpen, setIsIdeaOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /** Le menu n'existe que si au moins un handler est branché. */
  const hasIdea = Boolean(onSubmitIdea || onCreateIdea);
  const hasMenu = hasIdea || Boolean(onCreatePost);

  /* ── Effets : focus & clavier ──────────────────────────── */

  useEffect(() => {
    if (!isSearchOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(timer);
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isAddMenuOpen) return;

    const focusTimer = window.setTimeout(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
        ?.focus();
    }, 30);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAddMenuOpen(false);
        addButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAddMenuOpen]);

  /* ── Handlers internes ─────────────────────────────────── */

  const openSearch = useCallback(() => {
    setIsAddMenuOpen(false);
    setIsClosing(false);
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsClosing(true);
    window.setTimeout(() => {
      setIsSearchOpen(false);
      setIsClosing(false);
    }, 220);
  }, []);

  const handleFilesClick = useCallback(() => {
    setIsAddMenuOpen(false);
    if (onSelectFiles) {
      onSelectFiles();
    } else {
      onChange?.("files");
    }
  }, [onSelectFiles, onChange]);

  const handleAddClick = useCallback(() => {
    if (!hasMenu) {
      onChange?.("add");
      return;
    }
    setIsAddMenuOpen((open) => !open);
  }, [hasMenu, onChange]);

  /** Choix « Idea » → ferme le menu, ouvre la modale, prévient le parent. */
  const handleCreateIdea = useCallback(() => {
    setIsAddMenuOpen(false);
    setIsIdeaOpen(true);
    onCreateIdea?.();
  }, [onCreateIdea]);

  const closeIdea = useCallback(() => setIsIdeaOpen(false), []);

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

  /** Navigation clavier dans le menu (↑ ↓ Home End). */
  const handleMenuKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]'
        ) ?? []
      );
      if (items.length === 0) return;

      const index = items.indexOf(
        document.activeElement as HTMLButtonElement
      );

      if (event.key === "ArrowDown") {
        event.preventDefault();
        items[(index + 1) % items.length].focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        items[(index - 1 + items.length) % items.length].focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        items[0].focus();
      } else if (event.key === "End") {
        event.preventDefault();
        items[items.length - 1].focus();
      }
    },
    []
  );

  /* ── Styles dérivés ────────────────────────────────────── */

  const focusRing = [
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-neutral-500 focus-visible:ring-offset-2",
    isDark
      ? "focus-visible:ring-offset-[#1c1c1e]"
      : "focus-visible:ring-offset-white",
  ].join(" ");

  const isFilesActive = active === "files";

  const filesTone = isDark
    ? isFilesActive
      ? "border border-white/60 bg-[#141416] text-white"
      : "border border-white/10 bg-[#141416] text-neutral-300 hover:border-white/25"
    : isFilesActive
      ? "border border-black bg-white text-black"
      : "border border-black/10 bg-white text-black/80 hover:border-black/25";

  const addTone = isDark
    ? "bg-white text-neutral-900"
    : "bg-black text-white";

  const barTone = isDark
    ? "border border-white/10 bg-[#1c1c1e]/85 shadow-[0_16px_44px_rgba(0,0,0,0.5)]"
    : "border border-black/[0.04] bg-[#faf9f6]/85 shadow-[0_16px_44px_rgba(0,0,0,0.12)]";

  const menuTone = isDark
    ? "border border-white/10 bg-[#1c1c1e]/95 text-neutral-100 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
    : "border border-black/[0.06] bg-white/95 text-neutral-900 shadow-[0_16px_40px_rgba(0,0,0,0.14)]";

  /* ── Rendu ─────────────────────────────────────────────── */

  return (
    <>
      <style>{ANIMATION_KEYFRAMES}</style>

      {/* Voile derrière le menu */}
      {isAddMenuOpen && (
        <div
          aria-hidden
          onClick={() => setIsAddMenuOpen(false)}
          className={[
            "bb-anim fixed inset-0 z-20 backdrop-blur-[2px]",
            "animate-[scrimIn_200ms_ease-out_both]",
            isDark ? "bg-black/50" : "bg-black/20",
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
          {/* Menu « + » : plus compact (≈ 280px au lieu de 526px) */}
          {isAddMenuOpen && (
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-2.5 flex w-0 justify-center">
              <div
                ref={menuRef}
                role="menu"
                aria-label={addLabel}
                onKeyDown={handleMenuKeyDown}
                className={[
                  "bb-anim pointer-events-auto origin-bottom",
                  "w-[min(280px,calc(100vw-32px))] rounded-[20px] p-1.5 backdrop-blur-xl",
                  "animate-[addMenuIn_200ms_cubic-bezier(0.22,1,0.36,1)_both]",
                  menuTone,
                ].join(" ")}
              >
                {onCreatePost && (
                  <MenuItem
                    icon={PostIcon}
                    title="Post"
                    description="Publish content to a channel"
                    isDark={isDark}
                    delay={30}
                    onClick={handleCreatePost}
                  />
                )}

                {hasIdea && (
                  <MenuItem
                    icon={IdeaIcon}
                    title="Idea"
                    description="Capture a content idea"
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
              "pointer-events-auto flex items-center gap-2 rounded-full p-2 backdrop-blur-xl",
              barTone,
            ].join(" ")}
          >
            {/* Dossiers */}
            <li>
              <button
                type="button"
                aria-label="Dossiers"
                title="Dossiers"
                aria-current={isFilesActive ? "true" : undefined}
                onClick={handleFilesClick}
                className={[
                  "flex h-12 w-12 items-center justify-center rounded-full",
                  "transition duration-150 active:scale-90",
                  focusRing,
                  filesTone,
                ].join(" ")}
              >
                {FilesIcon}
              </button>
            </li>

            {/* Recherche */}
            <li>
              <div
                className={[
                  "relative flex h-12 items-center overflow-hidden rounded-full border",
                  "transition-[width,background-color,border-color,box-shadow]",
                  "duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isDark
                    ? "border-white/10 bg-[#141416] text-neutral-300 focus-within:border-white/30"
                    : "border-black/10 bg-white text-black/80 focus-within:border-black/30",
                  isSearchOpen ? "w-[200px] sm:w-[290px]" : "w-12",
                  isSearchOpen &&
                    !isClosing &&
                    "bb-anim animate-[searchGlow_500ms_ease-out]",
                  isClosing && "w-12",
                ].join(" ")}
              >
                <button
                  type="button"
                  aria-label="Rechercher"
                  aria-expanded={isSearchOpen}
                  title="Rechercher"
                  onMouseDown={(event) => {
                    if (isSearchOpen) event.preventDefault();
                  }}
                  onClick={() => {
                    if (isSearchOpen) {
                      inputRef.current?.focus();
                    } else {
                      openSearch();
                    }
                  }}
                  className={[
                    "relative z-10 flex h-12 w-12 shrink-0",
                    "items-center justify-center rounded-full",
                    focusRing,
                    !isSearchOpen && "transition duration-150 active:scale-90",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex items-center justify-center",
                      isSearchOpen && !isClosing
                        ? "bb-anim animate-[searchIconOpen_420ms_cubic-bezier(0.22,1,0.36,1)]"
                        : "",
                    ].join(" ")}
                  >
                    <SearchIcon />
                  </span>
                </button>

                <div
                  className={[
                    "flex min-w-0 flex-1 items-center",
                    "transition-opacity duration-200",
                    isSearchOpen && !isClosing
                      ? "opacity-100"
                      : "pointer-events-none opacity-0",
                  ].join(" ")}
                >
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    onBlur={() => {
                      if (query.trim() === "") closeSearch();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        onQueryChange("");
                        closeSearch();
                        inputRef.current?.blur();
                      }
                    }}
                    placeholder="Rechercher"
                    aria-label="Rechercher"
                    aria-hidden={!isSearchOpen}
                    tabIndex={isSearchOpen ? 0 : -1}
                    className={[
                      "bb-anim w-full min-w-0 bg-transparent",
                      "pr-2 text-[14px] outline-none",
                      "[&::-webkit-search-cancel-button]:hidden",
                      "placeholder:text-inherit placeholder:opacity-50",
                      "animate-[searchContentIn_300ms_150ms_both]",
                      isDark ? "text-white" : "text-neutral-800",
                    ].join(" ")}
                  />

                  {query !== "" && isSearchOpen && (
                    <button
                      type="button"
                      aria-label="Effacer la recherche"
                      title="Effacer"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onQueryChange("");
                        inputRef.current?.focus();
                      }}
                      className={[
                        "mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        "transition active:scale-90",
                        isDark
                          ? "bg-white/10 hover:bg-white/20"
                          : "bg-black/5 hover:bg-black/10",
                      ].join(" ")}
                    >
                      {ClearIcon}
                    </button>
                  )}
                </div>
              </div>
            </li>

            {/* « + » */}
            <li>
              <button
                ref={addButtonRef}
                type="button"
                aria-label={addLabel}
                title={addLabel}
                aria-haspopup={hasMenu ? "menu" : undefined}
                aria-expanded={hasMenu ? isAddMenuOpen : undefined}
                onClick={handleAddClick}
                className={[
                  "flex h-12 w-12 items-center justify-center rounded-full",
                  "transition duration-150 active:scale-90",
                  focusRing,
                  addTone,
                ].join(" ")}
              >
                <span
                  className={[
                    "flex items-center justify-center",
                    "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
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

      {/* Modale « New idea » */}
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
 * MenuItem — version compacte
 * ───────────────────────────────────────────────────────── */

type MenuItemProps = {
  icon: ReactNode;
  title: string;
  description: string;
  isDark: boolean;
  delay: number;
  onClick: () => void;
};

function MenuItem({
  icon,
  title,
  description,
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
        "bb-anim group flex w-full items-center gap-3 rounded-[14px] p-2 text-left",
        "outline-none transition duration-150 active:scale-[0.98]",
        "animate-[addItemIn_220ms_cubic-bezier(0.22,1,0.36,1)_both]",
        isDark
          ? "hover:bg-white/[0.07] focus-visible:bg-white/[0.07]"
          : "hover:bg-black/[0.04] focus-visible:bg-black/[0.04]",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]",
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
    </button>
  );
}