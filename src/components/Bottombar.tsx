import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

export type BottomBarTab = "files" | "add";

type BottomBarProps = {
  isDark?: boolean;
  onChange?: (id: BottomBarTab) => void;
  active?: BottomBarTab | null;
  addLabel?: string;
  query: string;
  onQueryChange: (value: string) => void;
  offsetLeft?: number;
  onCreateIdea?: () => void;
  onCreatePost?: () => void;
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
  "aria-hidden": true as const,
};

function FilesIcon() {
  return <svg {...svgProps}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>;
}

function PlusIcon() {
  return <svg {...svgProps} width={24} height={24} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>;
}

function IdeaIcon() {
  return <svg {...svgProps}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" /></svg>;
}

function PostIcon() {
  return <svg {...svgProps}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
}

function ChevronIcon() {
  return <svg {...svgProps} width={16} height={16} strokeWidth={2}><path d="m9 6 6 6-6 6" /></svg>;
}

function ClearIcon() {
  return <svg {...svgProps} width={14} height={14} strokeWidth={2.2}><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

const ANIMATIONS = `
@keyframes bb-menu-in {
  from { opacity: 0; transform: translate(-50%, 12px) scale(.97); }
  to { opacity: 1; transform: translate(-50%, 0) scale(1); }
}
@keyframes bb-scrim-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes bb-card-in {
  from { opacity: 0; transform: translateY(7px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .bb-motion { animation: none !important; transition-duration: 0.01ms !important; }
}
`;

type CreateOptionProps = {
  icon: ReactNode;
  title: string;
  description: string;
  eyebrow: string;
  dark: boolean;
  tone: "idea" | "post";
  delay: number;
  onClick: () => void;
};

function CreateOption({ icon, title, description, eyebrow, dark, tone, delay, onClick }: CreateOptionProps) {
  const palette = tone === "idea"
    ? dark
      ? "bg-amber-300/10 text-amber-200 ring-amber-200/15"
      : "bg-amber-50 text-amber-700 ring-amber-200/70"
    : dark
      ? "bg-violet-300/10 text-violet-200 ring-violet-200/15"
      : "bg-violet-50 text-violet-700 ring-violet-200/70";

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={[
        "bb-motion group w-full rounded-2xl border p-3.5 text-left",
        "flex items-center gap-3.5 outline-none transition duration-200",
        "animate-[bb-card-in_260ms_cubic-bezier(0.2,0.8,0.2,1)_both]",
        "focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
        dark
          ? "border-white/[0.08] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.07] focus-visible:ring-offset-[#171719]"
          : "border-black/[0.06] bg-white hover:border-black/10 hover:bg-neutral-50 hover:shadow-sm focus-visible:ring-offset-white",
        "active:scale-[0.99]",
      ].join(" ")}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] ring-1 transition-transform duration-200 group-hover:scale-105 ${palette}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] ${dark ? "text-neutral-500" : "text-neutral-400"}`}>{eyebrow}</span>
        <span className={`block text-[14px] font-semibold tracking-[-0.02em] ${dark ? "text-white" : "text-neutral-900"}`}>{title}</span>
        <span className={`mt-1 block text-[12px] leading-relaxed ${dark ? "text-neutral-400" : "text-neutral-500"}`}>{description}</span>
      </span>
      <span className={`shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${dark ? "text-neutral-500" : "text-neutral-400"}`}><ChevronIcon /></span>
    </button>
  );
}

export default function BottomBar({
  isDark = false,
  onChange,
  active = null,
  addLabel = "Créer",
  query,
  onQueryChange,
  offsetLeft = 0,
  onCreateIdea,
  onCreatePost,
}: BottomBarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasMenu = Boolean(onCreateIdea || onCreatePost);
  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2";
  const ringOffset = isDark ? "focus-visible:ring-offset-[#1c1c1e]" : "focus-visible:ring-offset-white";

  useEffect(() => {
    if (isSearchOpen) inputRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isAddMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !addButtonRef.current?.contains(target)) {
        setIsAddMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAddMenuOpen(false);
        addButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    }, 40);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [isAddMenuOpen]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  const openSearch = () => {
    setIsAddMenuOpen(false);
    setIsSearchOpen(true);
  };

  const closeSearch = () => setIsSearchOpen(false);

  const handleAddClick = () => {
    if (!hasMenu) {
      onChange?.("add");
      return;
    }
    setIsSearchOpen(false);
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

  const filesActive = active === "files";
  const filesTone = isDark
    ? filesActive
      ? "border-white/50 bg-[#141416] text-white"
      : "border-white/10 bg-[#141416] text-neutral-300 hover:border-white/25"
    : filesActive
      ? "border-black/20 bg-white text-black"
      : "border-black/10 bg-white text-black/80 hover:border-black/25";
  const barTone = isDark
    ? "border border-white/10 bg-[#1c1c1e]/90 shadow-[0_16px_44px_rgba(0,0,0,0.5)]"
    : "border border-black/[0.05] bg-[#faf9f6]/90 shadow-[0_16px_44px_rgba(0,0,0,0.12)]";
  const menuTone = isDark
    ? "border border-white/10 bg-[#19191c]/[97%] text-neutral-100 shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
    : "border border-black/[0.06] bg-white/[98%] text-neutral-900 shadow-[0_24px_70px_rgba(0,0,0,0.16)]";

  return (
    <>
      <style>{ANIMATIONS}</style>

      {isAddMenuOpen && (
        <button
          type="button"
          aria-label="Fermer le menu de création"
          onClick={() => setIsAddMenuOpen(false)}
          className={`bb-motion fixed inset-0 z-20 cursor-default backdrop-blur-[3px] animate-[bb-scrim-in_180ms_ease-out_both] ${isDark ? "bg-black/55" : "bg-black/20"}`}
        />
      )}

      <nav
        aria-label="Actions rapides"
        className="pointer-events-none fixed bottom-0 right-0 z-30 flex justify-center px-4"
        style={{ left: offsetLeft, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="relative">
          {isAddMenuOpen && (
            <section
              ref={menuRef}
              role="menu"
              aria-label="Choisir quoi créer"
              onKeyDown={handleMenuKeyDown}
              className={[
                "bb-motion pointer-events-auto absolute bottom-full left-1/2 mb-4",
                "w-[min(360px,calc(100vw-28px))] -translate-x-1/2 rounded-[28px] p-3.5",
                "origin-bottom animate-[bb-menu-in_240ms_cubic-bezier(0.2,0.8,0.2,1)_both] backdrop-blur-2xl",
                menuTone,
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3 px-1.5 pb-3.5 pt-1">
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? "text-violet-300" : "text-violet-600"}`}>Espace de création</p>
                  <h2 className={`mt-1 text-[19px] font-semibold tracking-[-0.04em] ${isDark ? "text-white" : "text-neutral-900"}`}>Qu’est-ce qu’on crée ?</h2>
                  <p className={`mt-1 text-[12px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Choisis un format pour commencer.</p>
                </div>
                <button
                  type="button"
                  aria-label="Fermer"
                  onClick={() => setIsAddMenuOpen(false)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${isDark ? "text-neutral-400 hover:bg-white/10 hover:text-white" : "text-neutral-500 hover:bg-black/5 hover:text-black"}`}
                >
                  <svg {...svgProps} width={16} height={16}><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>

              <div className="grid gap-2">
                {onCreateIdea && (
                  <CreateOption
                    icon={<IdeaIcon />}
                    title="Créer une idée"
                    eyebrow="À garder sous la main"
                    description="Capture une inspiration et développe-la plus tard."
                    tone="idea"
                    dark={isDark}
                    delay={35}
                    onClick={handleCreateIdea}
                  />
                )}
                {onCreatePost && (
                  <CreateOption
                    icon={<PostIcon />}
                    title="Créer un post"
                    eyebrow="Prêt à être partagé"
                    description="Rédige une publication et prépare-la à être diffusée."
                    tone="post"
                    dark={isDark}
                    delay={75}
                    onClick={handleCreatePost}
                  />
                )}
              </div>
              <p className={`px-1.5 pb-0.5 pt-3 text-center text-[10px] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                Tu pourras continuer à modifier ton contenu ensuite.
              </p>
            </section>
          )}

          <ul className={`pointer-events-auto flex items-center gap-2 rounded-full p-2 backdrop-blur-xl ${barTone}`}>
            <li>
              <button
                type="button"
                aria-label="Dossiers"
                title="Dossiers"
                aria-current={filesActive ? "page" : undefined}
                onClick={() => {
                  setIsAddMenuOpen(false);
                  onChange?.("files");
                }}
                className={`flex h-12 w-12 items-center justify-center rounded-full border transition duration-150 active:scale-90 ${focusRing} ${ringOffset} ${filesTone}`}
              >
                <FilesIcon />
              </button>
            </li>

            <li>
              <div className={[
                "relative flex h-12 items-center overflow-hidden rounded-full border",
                "transition-[width,background-color,border-color] duration-300 ease-out",
                isDark ? "border-white/10 bg-[#141416] text-neutral-300 focus-within:border-white/30" : "border-black/10 bg-white text-black/80 focus-within:border-black/30",
                isSearchOpen ? "w-[min(230px,45vw)] sm:w-[290px]" : "w-12",
              ].join(" ")}>
                <button
                  type="button"
                  aria-label={isSearchOpen ? "Revenir à la recherche" : "Rechercher"}
                  aria-expanded={isSearchOpen}
                  title="Rechercher"
                  onClick={() => {
                    if (isSearchOpen) inputRef.current?.focus();
                    else openSearch();
                  }}
                  className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${focusRing} ${ringOffset}`}
                >
                  <SearchIcon />
                </button>
                <div className={`flex min-w-0 flex-1 items-center transition-opacity duration-200 ${isSearchOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    onBlur={() => { if (query.trim() === "") closeSearch(); }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        onQueryChange("");
                        closeSearch();
                        inputRef.current?.blur();
                      }
                    }}
                    placeholder="Rechercher…"
                    aria-label="Rechercher"
                    aria-hidden={!isSearchOpen}
                    tabIndex={isSearchOpen ? 0 : -1}
                    className={`w-full min-w-0 bg-transparent pr-2 text-[14px] outline-none placeholder:opacity-50 ${isDark ? "text-white" : "text-neutral-800"}`}
                  />
                  {query !== "" && isSearchOpen && (
                    <button
                      type="button"
                      aria-label="Effacer la recherche"
                      title="Effacer"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => { onQueryChange(""); inputRef.current?.focus(); }}
                      className={`mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${isDark ? "bg-white/10 hover:bg-white/20" : "bg-black/5 hover:bg-black/10"}`}
                    >
                      <ClearIcon />
                    </button>
                  )}
                </div>
              </div>
            </li>

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
                  "transition duration-200 active:scale-90",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                  isDark ? "bg-white text-neutral-900 focus-visible:ring-offset-[#1c1c1e]" : "bg-neutral-950 text-white focus-visible:ring-offset-white",
                ].join(" ")}
              >
                <span className={`flex items-center justify-center transition-transform duration-300 ease-out ${isAddMenuOpen ? "rotate-[135deg]" : "rotate-0"}`}>
                  <PlusIcon />
                </span>
              </button>
            </li>
          </ul>
        </div>
      </nav>
    </>
  );
}
