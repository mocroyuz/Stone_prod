import { useEffect, useRef, useState, type ReactNode } from "react";

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
  <svg {...svgProps} width={18} height={18}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
  </svg>
);

const PostIcon = (
  <svg {...svgProps} width={18} height={18}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
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
  0% { opacity: 0; transform: translateY(8px) scale(.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
`;

type BottomBarProps = {
  isDark?: boolean;
  /** Appelé quand on clique sur « Dossiers ». */
  onChange?: (id: BottomBarTab) => void;
  active?: BottomBarTab | null;
  addLabel?: string;
  query: string;
  onQueryChange: (value: string) => void;
  offsetLeft?: number;
  /** Appelé quand on choisit « Créer une idée » dans le menu du « + ». */
  onCreateIdea?: () => void;
  /** Appelé quand on choisit « Créer un post » dans le menu du « + ». */
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
  const addWrapperRef = useRef<HTMLLIElement>(null);

  /* Focus de l'input à l'ouverture de la recherche */
  useEffect(() => {
    if (isSearchOpen) {
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 180);

      return () => window.clearTimeout(timer);
    }
  }, [isSearchOpen]);

  /* Fermeture du menu « + » : clic extérieur ou Échap */
  useEffect(() => {
    if (!isAddMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        addWrapperRef.current &&
        !addWrapperRef.current.contains(event.target as Node)
      ) {
        setIsAddMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAddMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
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

  const focusRing = [
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-neutral-500 focus-visible:ring-offset-2",
  ].join(" ");

  /* ───────── Bouton « Dossiers » ───────── */
  const isFilesActive = active === "files";

  const filesTone = isDark
    ? isFilesActive
      ? "border border-white/60 bg-[#141416] text-white"
      : "border border-white/10 bg-[#141416] text-neutral-300"
    : isFilesActive
      ? "border border-black bg-white text-black"
      : "border border-black/10 bg-white text-black/80";

  /* ───────── Bouton « + » ───────── */
  const addTone = isDark
    ? "bg-white text-neutral-900"
    : "bg-black text-white";

  const menuTone = isDark
    ? "border border-white/10 bg-[#1c1c1e] text-neutral-100 shadow-[0_16px_44px_rgba(0,0,0,0.5)]"
    : "border border-black/5 bg-[#faf9f6] text-neutral-800 shadow-[0_16px_44px_rgba(0,0,0,0.14)]";

  const menuItemTone = isDark
    ? "hover:bg-white/10 focus-visible:bg-white/10"
    : "hover:bg-black/5 focus-visible:bg-black/5";

  const handleCreateIdea = () => {
    setIsAddMenuOpen(false);
    onCreateIdea?.();
  };

  const handleCreatePost = () => {
    setIsAddMenuOpen(false);
    onCreatePost?.();
  };

  return (
    <nav
      aria-label="Actions rapides"
      className="pointer-events-none fixed bottom-0 right-0 z-30 flex justify-center px-4"
      style={{
        left: offsetLeft,
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      }}
    >
      <style>{ANIMATION_KEYFRAMES}</style>

      <ul
        className={[
          "pointer-events-auto flex items-center gap-2 rounded-full p-2",
          isDark
            ? "border border-white/10 bg-[#1c1c1e] shadow-[0_16px_44px_rgba(0,0,0,0.5)]"
            : "bg-[#faf9f6] shadow-[0_16px_44px_rgba(0,0,0,0.10)]",
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
                ? "border-white/10 bg-[#141416] text-neutral-300"
                : "border-black/10 bg-white text-black/80",

              isSearchOpen ? "w-[190px] sm:w-[280px]" : "w-12",

              isSearchOpen &&
                !isClosing &&
                "animate-[searchGlow_500ms_ease-out]",

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
                    ? "animate-[searchIconOpen_420ms_cubic-bezier(0.22,1,0.36,1)]"
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
                placeholder="Search everything"
                aria-label="Search everything"
                aria-hidden={!isSearchOpen}
                tabIndex={isSearchOpen ? 0 : -1}
                className={[
                  "w-full min-w-0 bg-transparent",
                  "pr-4 text-[13px] outline-none",
                  "placeholder:text-inherit placeholder:opacity-50",
                  "animate-[searchContentIn_300ms_150ms_both]",
                  isDark ? "text-white" : "text-neutral-800",
                ].join(" ")}
              />
            </div>
          </div>
        </li>

        {/* « + » avec menu : idée ou post */}
        <li ref={addWrapperRef} className="relative">
          <button
            type="button"
            aria-label={addLabel}
            title={addLabel}
            aria-haspopup="menu"
            aria-expanded={isAddMenuOpen}
            onClick={() => setIsAddMenuOpen((open) => !open)}
            className={[
              "flex h-12 w-12 items-center justify-center rounded-full",
              "transition duration-150 active:scale-90",
              focusRing,
              addTone,
            ].join(" ")}
          >
            <span
              className={[
                "flex items-center justify-center transition-transform duration-200",
                isAddMenuOpen ? "rotate-45" : "rotate-0",
              ].join(" ")}
            >
              {PlusIcon}
            </span>
          </button>

          {isAddMenuOpen && (
            <div
              role="menu"
              aria-label={addLabel}
              className={[
                "absolute bottom-full right-0 mb-3 w-56 origin-bottom-right",
                "rounded-2xl p-1.5",
                "animate-[addMenuIn_180ms_cubic-bezier(0.22,1,0.36,1)]",
                menuTone,
              ].join(" ")}
            >
              <MenuItem
                icon={IdeaIcon}
                label="Créer une idée"
                tone={menuItemTone}
                onClick={handleCreateIdea}
              />
              <MenuItem
                icon={PostIcon}
                label="Créer un post"
                tone={menuItemTone}
                onClick={handleCreatePost}
              />
            </div>
          )}
        </li>
      </ul>
    </nav>
  );
}

type MenuItemProps = {
  icon: ReactNode;
  label: string;
  tone: string;
  onClick: () => void;
};

function MenuItem({ icon, label, tone, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5",
        "text-left text-[14px] font-medium outline-none",
        "transition-colors duration-150",
        tone,
      ].join(" ")}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center opacity-80">
        {icon}
      </span>
      {label}
    </button>
  );
}