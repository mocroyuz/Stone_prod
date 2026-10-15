
import { useEffect, useRef, useState, type ReactNode } from "react";

export type BottomBarTab = "files" | "add";

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

const ADD_ITEM: Item = {
  id: "add",
  label: "Nouvelle publication",
  primary: true,
  icon: (
    <svg {...svgProps} width={24} height={24} strokeWidth={2.2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
};

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

const SEARCH_KEYFRAMES = `
@keyframes searchIconOpen {
  0% {
    transform: scale(.82) rotate(-12deg);
    opacity: .65;
  }

  55% {
    transform: scale(1.08) rotate(3deg);
    opacity: 1;
  }

  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

@keyframes searchContentIn {
  0% {
    opacity: 0;
    transform: translateX(-8px);
  }

  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes searchContentOut {
  0% {
    opacity: 1;
    transform: translateX(0);
  }

  100% {
    opacity: 0;
    transform: translateX(-6px);
  }
}

@keyframes searchGlow {
  0% {
    box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
  }

  45% {
    box-shadow: 0 0 0 3px rgba(0, 0, 0, .035);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
  }
}
`;

type BottomBarProps = {
  isDark?: boolean;
  onChange?: (id: BottomBarTab) => void;
  active?: BottomBarTab | null;
  addLabel?: string;
  query: string;
  onQueryChange: (value: string) => void;
  offsetLeft?: number;
};

export default function BottomBar({
  isDark = false,
  onChange,
  active = null,
  addLabel,
  query,
  onQueryChange,
  offsetLeft = 0,
}: BottomBarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 180);

      return () => window.clearTimeout(timer);
    }
  }, [isSearchOpen]);

  const openSearch = () => {
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

  const renderButton = ({
    id,
    label,
    icon,
    primary,
  }: Item) => {
    const isActive = active === id;

    const tone = primary
      ? isDark
        ? "bg-white text-neutral-900"
        : "bg-black text-white"
      : isDark
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
          onClick={() => onChange?.(id)}
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

  return (
    <nav
      aria-label="Actions rapides"
      className="pointer-events-none fixed bottom-0 right-0 z-30 flex justify-center px-4"
      style={{
        left: offsetLeft,
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      }}
    >
      <style>{SEARCH_KEYFRAMES}</style>

      <ul
        className={[
          "pointer-events-auto flex items-center gap-2 rounded-full p-2",
          isDark
            ? "border border-white/10 bg-[#1c1c1e] shadow-[0_16px_44px_rgba(0,0,0,0.5)]"
            : "bg-[#faf9f6] shadow-[0_16px_44px_rgba(0,0,0,0.10)]",
        ].join(" ")}
      >
        {renderButton(FILES_ITEM)}

        <li>
          <div
            className={[
              "relative flex h-12 items-center overflow-hidden rounded-full border",
              "transition-[width,background-color,border-color,box-shadow]",
              "duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              isDark
                ? "border-white/10 bg-[#141416] text-neutral-300"
                : "border-black/10 bg-white text-black/80",

              isSearchOpen
                ? "w-[190px] sm:w-[280px]"
                : "w-12",

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
                onChange={(event) =>
                  onQueryChange(event.target.value)
                }
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
                  isDark
                    ? "text-white"
                    : "text-neutral-800",
                ].join(" ")}
              />
            </div>
          </div>
        </li>

        {renderButton(addLabel ? { ...ADD_ITEM, label: addLabel } : ADD_ITEM)}
      </ul>
    </nav>
  );
}
