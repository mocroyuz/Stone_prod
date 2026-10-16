import { useEffect, useRef, useState, type ReactNode } from "react";

export type BottomBarTab = "files" | "add";
export type AddKind = "post" | "idea";

type Item = {
  id: BottomBarTab;
  label: string;
  icon: ReactNode;
  primary?: boolean;
};

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

const FILES_ITEM: Item = {
  id: "files",
  label: "Dossiers",
  icon: (
    <svg {...svgProps}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  ),
};

const ADD_LABEL = "Nouvelle publication";

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

function PostIcon() {
  return (
    <svg {...svgProps} width={22} height={22}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6M9 9h2" />
    </svg>
  );
}

function IdeaIcon() {
  return (
    <svg {...svgProps} width={22} height={22}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
    </svg>
  );
}

const ADD_MENU: {
  kind: AddKind;
  title: string;
  description: string;
  icon: ReactNode;
  tileDark: string;
  tileLight: string;
}[] = [
  {
    kind: "post",
    title: "Post",
    description: "Publish content to a channel",
    icon: <PostIcon />,
    tileDark: "bg-[#17395c] text-[#cfe4ff]",
    tileLight: "bg-[#dbeafe] text-[#1d4f8f]",
  },
  {
    kind: "idea",
    title: "Idea",
    description: "Capture a content idea",
    icon: <IdeaIcon />,
    tileDark: "bg-[#3b4a33] text-[#a9d98c]",
    tileLight: "bg-[#e4f3d9] text-[#3f7a22]",
  },
];

const KEYFRAMES = `
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
`;

type BottomBarProps = {
  isDark?: boolean;
  onChange?: (id: BottomBarTab) => void;
  onAddSelect?: (kind: AddKind) => void;
  active?: BottomBarTab | null;
  addLabel?: string;
  query: string;
  onQueryChange: (value: string) => void;
  offsetLeft?: number;
};

export default function BottomBar({
  isDark = false,
  onChange,
  onAddSelect,
  active = null,
  addLabel,
  query,
  onQueryChange,
  offsetLeft = 0,
}: BottomBarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const addWrapperRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 180);

      return () => window.clearTimeout(timer);
    }
  }, [isSearchOpen]);

  // Fermeture du menu : clic extérieur + Échap
  useEffect(() => {
    if (!isAddOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        addWrapperRef.current &&
        !addWrapperRef.current.contains(event.target as Node)
      ) {
        setIsAddOpen(false);
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsAddOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isAddOpen]);

  const openSearch = () => {
    setIsAddOpen(false);
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

  const toggleAdd = () => {
    setIsAddOpen((open) => {
      if (!open) onChange?.("add");
      return !open;
    });
  };

  const handleSelect = (kind: AddKind) => {
    setIsAddOpen(false);
    onAddSelect?.(kind);
  };

  const renderButton = ({ id, label, icon }: Item) => {
    const isActive = active === id;

    const tone = isDark
      ? isActive
        ? "border border-white/60 bg-[#141416] text-white"
        : "border border-white/10 bg-[#141416] text-neutral-300"
      : isActive
        ? "border border-black bg-white text-black"
        : "border border-black/10 bg-white text-black/80";

    return (
      <li key={id}>
        <button
          type="button"
          aria-label={label}
          title={label}
          aria-current={isActive ? "true" : undefined}
          onClick={() => {
            setIsAddOpen(false);
            onChange?.(id);
          }}
          className={[
            "flex h-12 w-12 items-center justify-center rounded-full",
            "transition duration-150 active:scale-90",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-neutral-500 focus-visible:ring-offset-2",
            tone,
          ].join(" ")}
        >
          {icon}
        </button>
      </li>
    );
  };

  const label = addLabel ?? ADD_LABEL;

  return (
    <nav
      aria-label="Actions rapides"
      className="pointer-events-none fixed bottom-0 right-0 z-30 flex justify-center px-4"
      style={{
        left: offsetLeft,
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      }}
    >
      <style>{KEYFRAMES}</style>

      <ul
        className={[
          "pointer-events-auto flex items-center gap-2 rounded-full p-2",
          isDark
            ? "border border-white/10 bg-[#1c1c1e] shadow-[0_16px_44px_rgba(0,0,0,0.5)]"
            : "bg-[#faf9f6] shadow-[0_16px_44px_rgba(0,0,0,0.10)]",
        ].join(" ")}
      >
        {renderButton(FILES_ITEM)}

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
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-neutral-500 focus-visible:ring-offset-2",
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
                  if (query.trim() === "") closeSearch();
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

        {/* Bouton + et menu collé au-dessus */}
        <li ref={addWrapperRef} className="relative">
          {isAddOpen && (
            <div
              role="menu"
              aria-label={label}
              className={[
                "absolute bottom-full right-0 mb-3 w-[280px] origin-bottom-right",
                "rounded-2xl p-2",
                "animate-[addMenuIn_180ms_cubic-bezier(0.22,1,0.36,1)]",
                isDark
                  ? "border border-white/10 bg-[#262826] shadow-[0_16px_44px_rgba(0,0,0,0.55)]"
                  : "border border-black/5 bg-white shadow-[0_16px_44px_rgba(0,0,0,0.14)]",
              ].join(" ")}
            >
              {ADD_MENU.map((entry) => (
                <button
                  key={entry.kind}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(entry.kind)}
                  className={[
                    "flex w-full items-center gap-4 rounded-xl p-2.5 text-left",
                    "transition duration-150 active:scale-[0.98]",
                    "focus-visible:outline-none focus-visible:ring-2",
                    "focus-visible:ring-neutral-500",
                    isDark ? "hover:bg-white/5" : "hover:bg-black/5",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                      isDark ? entry.tileDark : entry.tileLight,
                    ].join(" ")}
                  >
                    {entry.icon}
                  </span>

                  <span className="min-w-0">
                    <span
                      className={[
                        "block text-[16px] font-semibold leading-tight",
                        isDark ? "text-white" : "text-neutral-900",
                      ].join(" ")}
                    >
                      {entry.title}
                    </span>
                    <span
                      className={[
                        "mt-0.5 block text-[13px] leading-snug",
                        isDark ? "text-neutral-400" : "text-neutral-500",
                      ].join(" ")}
                    >
                      {entry.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            aria-label={label}
            title={label}
            aria-haspopup="menu"
            aria-expanded={isAddOpen}
            onClick={toggleAdd}
            className={[
              "flex h-12 w-12 items-center justify-center rounded-full",
              "transition duration-150 active:scale-90",
              "focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-neutral-500 focus-visible:ring-offset-2",
              isDark ? "bg-white text-neutral-900" : "bg-black text-white",
            ].join(" ")}
          >
            <svg
              {...svgProps}
              width={24}
              height={24}
              strokeWidth={2.2}
              className={[
                "transition-transform duration-200 ease-out",
                isAddOpen ? "rotate-45" : "rotate-0",
              ].join(" ")}
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </li>
      </ul>
    </nav>
  );
}