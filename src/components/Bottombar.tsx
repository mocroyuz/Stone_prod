import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import NewIdeaModal, { type NewIdeaValues } from "./Newideamodal";
import { useGlobalTextSearch } from "../hooks/useGlobalTextSearch";
import { navigate, useHashRoute } from "../hooks/useHashRoute";
import {
  clearGlobalTextHighlights,
  highlightGlobalText,
  setGlobalTextSearchOpen,
  setGlobalTextSearchQuery,
  setGlobalTextSearchSelection,
} from "../services/globalTextSearch";

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

  /** Recherche : valeur contrôlée + setter. */
  query: string;
  onQueryChange: (value: string) => void;

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

const SearchIcon = (
  <svg {...svgProps} width={18} height={18}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
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

const ClearIcon = (
  <svg {...svgProps} width={12} height={12} strokeWidth={2.6}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/* ─────────────────────────────────────────────────────────
 * Keyframes
 * ───────────────────────────────────────────────────────── */

const ANIMATION_KEYFRAMES = `
@keyframes searchIconOpen {
  0%   { transform: scale(.8) rotate(-14deg); opacity: .6; }
  55%  { transform: scale(1.1) rotate(4deg);  opacity: 1; }
  100% { transform: scale(1) rotate(0deg);    opacity: 1; }
}
@keyframes searchContentIn {
  0%   { opacity: 0; transform: translateX(-8px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes searchGlow {
  0%   { box-shadow: 0 0 0 0 rgba(128,128,128,0); }
  45%  { box-shadow: 0 0 0 3px rgba(128,128,128,.12); }
  100% { box-shadow: 0 0 0 0 rgba(128,128,128,0); }
}
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
  query,
  onQueryChange,
  offsetLeft = 0,
  onSelectFiles,
  onSubmitIdea,
  onCreatePost,
  onChange,
}: BottomBarProps) {
  const globalSearch = useGlobalTextSearch();
  const route = useHashRoute();
  const searchQuery = globalSearch.query || query;
  const [isSearchOpen, setIsSearchOpen] = useState(globalSearch.isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isIdeaOpen, setIsIdeaOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /** La modale « idée » est toujours disponible via le menu. */
  const hasIdea = true;
  const hasMenu = hasIdea || Boolean(onCreatePost);
  const activeResult = globalSearch.results[globalSearch.selectedIndex] ?? null;
  const activeRoute = route === "calendar" ? "schedule" : route;
  const groupedResults = new Map<
    string,
    {
      page: string;
      items: { result: (typeof globalSearch.results)[number]; index: number }[];
    }
  >();
  globalSearch.results.forEach((result, index) => {
    const group = groupedResults.get(result.route) ?? {
      page: result.page,
      items: [],
    };
    group.items.push({ result, index });
    groupedResults.set(result.route, group);
  });

  useEffect(() => {
    setIsSearchOpen(globalSearch.isOpen);
    if (globalSearch.isOpen) setIsClosing(false);
  }, [globalSearch.isOpen]);

  useEffect(() => {
    if (!globalSearch.query.trim()) {
      clearGlobalTextHighlights(document);
      return;
    }

    const occurrence =
      activeResult?.route === activeRoute ? activeResult.occurrence : -1;
    const timer = window.setTimeout(
      () => highlightGlobalText(document, globalSearch.query, occurrence),
      80
    );
    return () => window.clearTimeout(timer);
  }, [
    activeRoute,
    activeResult,
    globalSearch.query,
    globalSearch.results,
    globalSearch.selectedIndex,
  ]);

  /** Recherche visuellement dépliée (animation d'origine). */
  const isExpanded = isSearchOpen && !isClosing;

  /* ── Handlers internes ─────────────────────────────────── */

  const openSearch = useCallback(() => {
    setIsAddMenuOpen(false);
    setIsClosing(false);
    setIsSearchOpen(true);
    setGlobalTextSearchOpen(true);
    if (query.trim()) setGlobalTextSearchQuery(query);
    // Focus synchrone : indispensable pour ouvrir le clavier sur iOS.
    inputRef.current?.focus({ preventScroll: true });
  }, [query]);

  const closeSearch = useCallback(() => {
    setIsClosing(true);
    window.setTimeout(() => {
      setIsSearchOpen(false);
      setIsClosing(false);
      setGlobalTextSearchOpen(false);
    }, 220);
  }, []);

  const handleQueryChange = useCallback(
    (value: string) => {
      onQueryChange(value);
      setGlobalTextSearchQuery(value);
    },
    [onQueryChange]
  );

  const selectResult = useCallback(
    (index: number) => {
      const resultCount = globalSearch.results.length;
      if (resultCount === 0) return;
      const selectedIndex = (index + resultCount) % resultCount;
      const result = globalSearch.results[selectedIndex];
      if (!result) return;
      setGlobalTextSearchSelection(selectedIndex);
      setGlobalTextSearchOpen(true);
      setIsSearchOpen(true);
      setIsClosing(false);
      navigate(result.route);
    },
    [globalSearch.results]
  );

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

  // Raccourci global : ⌘K / Ctrl+K ouvre la recherche.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openSearch]);

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

  const searchTone = isDark
    ? "border-white/10 bg-[#141416] text-neutral-300 focus-within:border-white/35"
    : "border-black/10 bg-white text-black/70 focus-within:border-black/35";

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
          {isSearchOpen && searchQuery.trim() !== "" && (
            <section
              data-global-search-ignore
              aria-label="Résultats de recherche globale"
              className={[
                "pointer-events-auto absolute bottom-full left-1/2 z-40 mb-3",
                "w-[min(560px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden",
                "rounded-[18px] border backdrop-blur-xl",
                "shadow-[0_20px_50px_-10px_rgba(0,0,0,0.25)]",
                isDark
                  ? "border-white/10 bg-[#1c1c1e]/95 text-neutral-100"
                  : "border-black/[0.06] bg-white/95 text-neutral-900",
              ].join(" ")}
            >
              <header
                className={[
                  "flex items-center justify-between gap-3 border-b px-3.5 py-2.5",
                  isDark ? "border-white/10" : "border-black/[0.06]",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">
                    {globalSearch.isIndexing
                      ? "Indexation des pages…"
                      : `${globalSearch.results.length} résultat${globalSearch.results.length === 1 ? "" : "s"}`}
                  </p>
                  <p
                    className={[
                      "text-[11px]",
                      isDark ? "text-neutral-400" : "text-neutral-500",
                    ].join(" ")}
                  >
                    {globalSearch.isIndexing
                      ? `${globalSearch.indexedPages}/${globalSearch.totalPages} pages parcourues`
                      : globalSearch.results.length > 0
                        ? `${globalSearch.selectedIndex + 1} sur ${globalSearch.results.length}`
                        : "Toutes les pages accessibles"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Résultat précédent"
                    title="Résultat précédent"
                    disabled={globalSearch.results.length === 0}
                    onClick={() => selectResult(globalSearch.selectedIndex - 1)}
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-lg transition",
                      "disabled:pointer-events-none disabled:opacity-35",
                      isDark ? "hover:bg-white/10" : "hover:bg-black/[0.05]",
                    ].join(" ")}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m6 14 6-6 6 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Résultat suivant"
                    title="Résultat suivant"
                    disabled={globalSearch.results.length === 0}
                    onClick={() => selectResult(globalSearch.selectedIndex + 1)}
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-lg transition",
                      "disabled:pointer-events-none disabled:opacity-35",
                      isDark ? "hover:bg-white/10" : "hover:bg-black/[0.05]",
                    ].join(" ")}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m6 10 6 6 6-6" />
                    </svg>
                  </button>
                </div>
              </header>

              {globalSearch.results.length > 0 ? (
                <ul className="max-h-[min(42vh,340px)] overflow-y-auto p-1.5">
                  {Array.from(groupedResults, ([routeKey, group]) => (
                    <li key={routeKey}>
                      <h3
                        className={[
                          "flex items-center justify-between px-3 pb-1 pt-2 text-[11px] font-semibold",
                          isDark ? "text-pink-300" : "text-pink-700",
                        ].join(" ")}
                      >
                        <span>{group.page}</span>
                        <span className={isDark ? "text-neutral-500" : "text-neutral-400"}>
                          {group.items.length}
                        </span>
                      </h3>
                      <ul>
                        {group.items.map(({ result, index }) => (
                          <li key={result.id}>
                            <button
                              type="button"
                              aria-current={
                                index === globalSearch.selectedIndex ? "true" : undefined
                              }
                              onClick={() => selectResult(index)}
                              className={[
                                "flex w-full rounded-xl px-3 py-2 text-left transition",
                                index === globalSearch.selectedIndex
                                  ? isDark
                                    ? "bg-pink-400/15 ring-1 ring-pink-300/30"
                                    : "bg-pink-500/10 ring-1 ring-pink-500/25"
                                  : isDark
                                    ? "hover:bg-white/[0.06]"
                                    : "hover:bg-black/[0.035]",
                              ].join(" ")}
                            >
                              <span className="line-clamp-2 text-[12px] leading-relaxed">
                                {result.excerpt}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : (
                <p
                  className={[
                    "px-4 py-5 text-center text-[13px]",
                    isDark ? "text-neutral-400" : "text-neutral-500",
                  ].join(" ")}
                >
                  {globalSearch.isIndexing
                    ? "Recherche dans le texte des pages…"
                    : "Aucun résultat trouvé."}
                </p>
              )}

              {globalSearch.failedPages.length > 0 && (
                <p
                  className={[
                    "border-t px-3.5 py-2 text-[11px]",
                    isDark
                      ? "border-white/10 text-amber-300"
                      : "border-black/[0.06] text-amber-700",
                  ].join(" ")}
                >
                  Certaines pages n’ont pas pu être indexées : {globalSearch.failedPages.join(", ")}
                </p>
              )}
            </section>
          )}

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

            {/* Recherche */}
            <li>
              <div
                className={[
                  "relative flex h-12 items-center overflow-hidden rounded-full border",
                  "transition-[width,background-color,border-color,box-shadow]",
                  "duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                  searchTone,
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
                      isExpanded
                        ? "bb-anim animate-[searchIconOpen_420ms_cubic-bezier(0.22,1,0.36,1)]"
                        : "",
                    ].join(" ")}
                  >
                    {SearchIcon}
                  </span>
                </button>

                <div
                  className={[
                    "flex min-w-0 flex-1 items-center",
                    "transition-opacity duration-200",
                    isExpanded
                      ? "opacity-100"
                      : "pointer-events-none opacity-0",
                  ].join(" ")}
                >
                  <input
                    ref={inputRef}
                    type="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    spellCheck={false}
                    value={searchQuery}
                    onChange={(event) => handleQueryChange(event.target.value)}
                    onBlur={() => {
                      if (searchQuery.trim() === "") closeSearch();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        handleQueryChange("");
                        closeSearch();
                        inputRef.current?.blur();
                      } else if (
                        event.key === "ArrowDown" &&
                        globalSearch.results.length > 0
                      ) {
                        event.preventDefault();
                        selectResult(globalSearch.selectedIndex + 1);
                      } else if (
                        event.key === "ArrowUp" &&
                        globalSearch.results.length > 0
                      ) {
                        event.preventDefault();
                        selectResult(globalSearch.selectedIndex - 1);
                      } else if (event.key === "Enter") {
                        if (globalSearch.results.length > 0) {
                          event.preventDefault();
                          selectResult(globalSearch.selectedIndex);
                        } else {
                          inputRef.current?.blur();
                        }
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

                  {searchQuery !== "" && isSearchOpen && (
                    <button
                      type="button"
                      aria-label="Effacer la recherche"
                      title="Effacer"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        handleQueryChange("");
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