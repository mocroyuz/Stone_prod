import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

export type BottomBarTab = "files" | "add";

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
  <svg {...svgProps} width={24} height={24} strokeWidth={2.2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IdeaIcon = (
  <svg {...svgProps} width={20} height={20}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
  </svg>
);

const PostIcon = (
  <svg {...svgProps} width={20} height={20}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const ChevronIcon = (
  <svg {...svgProps} width={16} height={16} strokeWidth={2}>
    <path d="m9 6 6 6-6 6" />
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
  0% { opacity: 0; transform: translateY(10px) scale(.94); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes addItemIn {
  0% { opacity: 0; transform: translateY(6px); }
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

type BottomBarProps = {
  isDark?: boolean;
  /** « files » pour Dossiers. « add » uniquement si aucun menu n'est branché (voir onCreateIdea / onCreatePost). */
  onChange?: (id: BottomBarTab) => void;
  active?: BottomBarTab | null;
  addLabel?: string;
  query: string;
  onQueryChange: (value: string) => void;
  offsetLeft?: number;
  /** « Créer une idée » dans le menu du « + ». */
  onCreateIdea?: () => void;
  /** « Créer un post » dans le menu du « + » : c'est ici qu'on ouvre la modale de nouveau post. */
  onCreatePost?: () => void;
};

export default function BottomBar({
  isDark = false,
  onChange,
  active = null,
  addLabel = "Nouvelle publication",
  query,
  onQueryChange,
  offsetLeft = 0,
  onCreateIdea,
  onCreatePost,
}: BottomBarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Si le parent ne fournit aucun handler, le « + » garde son ancien comportement. */
  const hasMenu = Boolean(onCreateIdea || onCreatePost);

  /* Focus de l'input à l'ouverture de la recherche */
  useEffect(() => {
    if (isSearchOpen) {
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 180);

      return () => window.clearTimeout(timer);
    }
  }, [isSearchOpen]);

  /* Menu « + » : focus du premier choix à l'ouverture, Échap pour fermer */
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

  const openSearch = () => {
    setIsAddMenuOpen(false);
    setIsClosing(false);
    setIsSearchOpen(true);
  };

  const closeSearch = () => {
    setIsClosing(true);

    window.setTimeout(() => {
      setIsSearchOpen(false);
      setIsClosing(false);
    }, 220);
  };

  const handleAddClick = () => {
    if (!hasMenu) {
      onChange?.("add");
      return;
    }

    setIsAddMenuOpen((open) => !open);
  };

  const handleCreateIdea = () => {
    setIsAddMenuOpen(false);
    onCreateIdea?.();
  };

  const handleCreatePost = () => {
    setIsAddMenuOpen(false);
    onCreatePost?.();
  };

  /* Navigation clavier dans le menu (↑ ↓ Home End) */
  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]'
      ) ?? []
    );
    if (items.length === 0) return;

    const index = items.indexOf(document.activeElement as HTMLButtonElement);

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
  };

  const focusRing = [
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-neutral-500 focus-visible:ring-offset-2",
    isDark ? "focus-visible:ring-offset-[#1c1c1e]" : "focus-visible:ring-offset-white",
  ].join(" ");

  /* ───────── Styles ───────── */
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
    ? "border border-white/10 bg-[#1c1c1e]/95 text-neutral-100 shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
    : "border border-black/[0.06] bg-white/95 text-neutral-900 shadow-[0_24px_64px_rgba(0,0,0,0.18)]";

  const mutedText = isDark ? "text-neutral-400" : "text-neutral-500";

  return (
    <>
      <style>{ANIMATION_KEYFRAMES}</style>

      {/* Voile derrière le menu : assombrit la page et ferme au clic */}
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
          {/* Menu « + » : centré au-dessus de la barre */}
          {isAddMenuOpen && (
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-3 flex w-0 justify-center">
              <div
                ref={menuRef}
                role="menu"
                aria-label={addLabel}
                onKeyDown={handleMenuKeyDown}
                className={[
                  "bb-anim pointer-events-auto origin-bottom",
                  "w-[min(300px,calc(100vw-32px))] rounded-[28px] p-2 backdrop-blur-xl",
                  "animate-[addMenuIn_220ms_cubic-bezier(0.22,1,0.36,1)_both]",
                  menuTone,
                ].join(" ")}
              >
                <p
                  className={[
                    "px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em]",
                    mutedText,
                  ].join(" ")}
                >
                  Nouveau
                </p>

                {onCreateIdea && (
                  <MenuItem
                    icon={IdeaIcon}
                    title="Créer une idée"
                    description="Note rapide à développer plus tard"
                    chipTone={
                      isDark
                        ? "bg-amber-400/15 text-amber-300"
                        : "bg-amber-100 text-amber-600"
                    }
                    isDark={isDark}
                    delay={40}
                    onClick={handleCreateIdea}
                  />
                )}

                {onCreatePost && (
                  <MenuItem
                    icon={PostIcon}
                    title="Créer un post"
                    description="Rédige une publication à partager"
                    chipTone={
                      isDark
                        ? "bg-indigo-400/15 text-indigo-300"
                        : "bg-indigo-100 text-indigo-600"
                    }
                    isDark={isDark}
                    delay={90}
                    onClick={handleCreatePost}
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
                onClick={() => {
                  setIsAddMenuOpen(false);
                  onChange?.("files");
                }}
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
                {/* Loupe */}
                <button
                  type="button"
                  aria-label="Rechercher"
                  aria-expanded={isSearchOpen}
                  title="Rechercher"
                  onMouseDown={(event) => {
                    if (isSearchOpen) {
                      event.preventDefault();
                    }
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

                {/* Zone de recherche */}
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
                      if (query.trim() === "") {
                        closeSearch();
                      }
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
    </>
  );
}

type MenuItemProps = {
  icon: ReactNode;
  title: string;
  description: string;
  chipTone: string;
  isDark: boolean;
  delay: number;
  onClick: () => void;
};

function MenuItem({
  icon,
  title,
  description,
  chipTone,
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
        "bb-anim group flex w-full items-center gap-3 rounded-2xl p-2.5 text-left",
        "outline-none transition duration-150 active:scale-[0.98]",
        "animate-[addItemIn_260ms_cubic-bezier(0.22,1,0.36,1)_both]",
        isDark
          ? "hover:bg-white/[0.07] focus-visible:bg-white/[0.07]"
          : "hover:bg-black/[0.04] focus-visible:bg-black/[0.04]",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]",
          "transition-transform duration-200 group-hover:scale-105",
          chipTone,
        ].join(" ")}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold leading-tight">
          {title}
        </span>
        <span
          className={[
            "mt-0.5 block truncate text-[12.5px] leading-tight",
            isDark ? "text-neutral-400" : "text-neutral-500",
          ].join(" ")}
        >
          {description}
        </span>
      </span>

      <span
        className={[
          "shrink-0 transition duration-150 group-hover:translate-x-0.5",
          isDark ? "text-neutral-500" : "text-neutral-400",
        ].join(" ")}
      >
        {ChevronIcon}
      </span>
    </button>
  );
}