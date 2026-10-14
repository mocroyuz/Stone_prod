import { useEffect, useRef, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import DashboardSidebar, {
  useSidebarOffset,
} from "../components/DashboardSidebar";
import PageTransition from "../components/PageTransition";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import NewPostModal, { type NewPostPayload } from "../components/Newpostmodal";
import {
  ZapierIcon,
  ClaudeIcon,
  ChatGPTIcon,
  NotionIcon,
  GoogleIcon,
  N8nIcon,
  RaycastIcon,
  PerplexityIcon,
  GoogleDriveIcon,
  GmailIcon,
  GoogleCalendarIcon,
  CanvaIcon,
} from "../components/IntegrationIcons";

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function PlugIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 3v4M15 3v4" />
      <path d="M6.5 7h11v4.5a5.5 5.5 0 0 1-11 0V7Z" />
      <path d="M12 17v4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[16px] w-[16px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[14px] w-[14px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[12px] w-[12px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m4 12 6 6L20 6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[13px] w-[13px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[14px] w-[14px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function SunMoonIcon({ isDark }: { isDark: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {isDark ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </>
      ) : (
        <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

type IntegrationCardData = {
  title: string;
  meta?: string;
  body: string;
  progress: number;
};

const INTEGRATIONS: IntegrationCardData[] = [
  { title: "Zapier", meta: "Automatisation", body: "Automate workflows with Zapier", progress: 70 },
  { title: "Claude", meta: "IA", body: "Manage your content from Claude and Claude Code", progress: 85 },
  { title: "ChatGPT", meta: "IA", body: "Manage your content from ChatGPT and Codex", progress: 75 },
  { title: "Notion", meta: "Documentation", body: "Manage your content from Notion custom agents", progress: 60 },
  { title: "Google", meta: "Productivité", body: "Connect Google services and tools", progress: 65 },
  { title: "n8n", meta: "Automatisation", body: "Workflow automation with n8n", progress: 60 },
  { title: "Raycast", meta: "Productivité", body: "Quick actions from your menu bar", progress: 70 },
  { title: "Perplexity", meta: "IA", body: "Manage your content from Perplexity Web and Desktop", progress: 50 },
  { title: "Canva", meta: "Design", body: "Create and manage your designs from Canva", progress: 55 },
  { title: "Google Drive", meta: "Stockage", body: "Sync and manage your files from Google Drive", progress: 75 },
  { title: "Gmail", meta: "Email", body: "Manage your emails and automate responses", progress: 80 },
  { title: "Google Calendar", meta: "Planning", body: "Sync your calendar and automate scheduling", progress: 65 },
];

const ICONS: Record<string, (props: { className?: string }) => JSX.Element | null> = {
  Zapier: ZapierIcon,
  Claude: ClaudeIcon,
  ChatGPT: ChatGPTIcon,
  Notion: NotionIcon,
  Google: GoogleIcon,
  n8n: N8nIcon,
  Raycast: RaycastIcon,
  Perplexity: PerplexityIcon,
  Canva: CanvaIcon,
  "Google Drive": GoogleDriveIcon,
  Gmail: GmailIcon,
  "Google Calendar": GoogleCalendarIcon,
};

const FILTERS = ["Toutes", "Connectées", "Disponibles"] as const;
type Filter = (typeof FILTERS)[number];

/* Seuil à partir duquel une intégration est considérée comme connectée. */
const CONNECTED_THRESHOLD = 60;

/* ------------------------------------------------------------------ */
/* Shared styling                                                      */
/* ------------------------------------------------------------------ */

const focusRing = (isDark: boolean) =>
  isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function ProgressBar({ value, isDark }: { value: number; isDark: boolean }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Setup progress"
      className={[
        "h-[3px] w-full overflow-hidden rounded-full",
        isDark ? "bg-white/15" : "bg-black/10",
      ].join(" ")}
    >
      <div
        className={["h-full rounded-full", isDark ? "bg-white" : "bg-neutral-900"].join(" ")}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function IntegrationCard({
  data,
  isDark,
}: {
  data: IntegrationCardData;
  isDark: boolean;
}) {
  const Icon = ICONS[data.title];
  const connected = data.progress >= CONNECTED_THRESHOLD;

  return (
    <div
      className={[
        "group flex h-full flex-col rounded-[clamp(16px,1.6vw,22px)] border p-[clamp(16px,1.6vw,22px)] transition",
        isDark
          ? "border-white/10 bg-[#151517] hover:bg-[#19191c]"
          : "border-black/[0.06] bg-white hover:border-black/[0.12]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && <Icon className="h-5 w-5 shrink-0" />}
          <h3
            className={[
              "truncate font-display text-[clamp(14px,1.1vw,17px)] font-semibold",
              isDark ? "text-white" : "text-neutral-900",
            ].join(" ")}
          >
            {data.title}
          </h3>
        </div>

        <button
          type="button"
          aria-label={`Configurer ${data.title}`}
          className={[
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition",
            focusRing(isDark),
            isDark
              ? "text-neutral-400 hover:bg-white/10 hover:text-white"
              : "text-neutral-400 hover:bg-black/5 hover:text-neutral-900",
          ].join(" ")}
        >
          <ArrowRightIcon />
        </button>
      </div>

      <div className="mt-3">
        <ProgressBar value={data.progress} isDark={isDark} />
      </div>

      <div className="mt-3 flex items-start gap-2">
        {data.meta && (
          <span
            className={[
              "shrink-0 text-[10.5px] font-medium tracking-wide",
              isDark ? "text-neutral-500" : "text-neutral-400",
            ].join(" ")}
          >
            {data.meta}
          </span>
        )}
        <p
          className={[
            "text-[clamp(11.5px,0.95vw,13px)] leading-[1.45]",
            isDark ? "text-neutral-400" : "text-neutral-600",
          ].join(" ")}
        >
          {data.body}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between pt-4">
        <span
          className={[
            "flex items-center gap-1.5 text-[10.5px] font-medium",
            connected
              ? isDark
                ? "text-emerald-400"
                : "text-emerald-600"
              : isDark
                ? "text-neutral-500"
                : "text-neutral-400",
          ].join(" ")}
        >
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              connected ? "bg-emerald-500" : isDark ? "bg-neutral-600" : "bg-neutral-300",
            ].join(" ")}
          />
          {connected ? "Connected" : "Available"}
        </span>
        <span className={["text-[10.5px] tabular-nums", isDark ? "text-neutral-600" : "text-neutral-400"].join(" ")}>
          {data.progress}%
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Integrations() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  /* Marge gauche : suit l'état réduit / ouvert de la sidebar. */
  const sidebarOffset = useSidebarOffset();

  /* Recherche & filtre de la grille. */
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("Toutes");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  /* BottomBar / Folder / NewPostModal (recherche de la barre indépendante). */
  const [bottomQuery, setBottomQuery] = useState("");
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);

  /* Ferme le menu du filtre au clic extérieur / Échap. */
  useEffect(() => {
    if (!filterOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!filterRef.current?.contains(e.target as Node)) setFilterOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filterOpen]);

  const needle = query.trim().toLowerCase();

  const visible = INTEGRATIONS.filter((item) => {
    const matchesQuery =
      needle.length === 0 ||
      `${item.title} ${item.meta ?? ""}`.toLowerCase().includes(needle);

    const isConnected = item.progress >= CONNECTED_THRESHOLD;
    const matchesFilter =
      filter === "Toutes" ||
      (filter === "Connectées" ? isConnected : !isConnected);

    return matchesQuery && matchesFilter;
  });

  const hasActiveFilters = needle.length > 0 || filter !== "Toutes";

  const resetFilters = () => {
    setQuery("");
    setFilter("Toutes");
  };

  const handleBottomBarChange = (id: BottomBarTab) => {
    switch (id) {
      case "add":
        setIsFolderOpen(false);
        setIsNewPostOpen(true);
        break;
      case "files":
        setIsFolderOpen((open) => !open);
        break;
    }
  };

  const handleCreatePost = async (payload: NewPostPayload) => {
    // TODO : brancher ici le vrai envoi (Supabase, file d'attente, etc.).
    console.log("Nouveau post :", payload);
  };

  return (
    <main
      className={[
        "relative min-h-screen w-full transition-colors duration-500",
        isDark ? "bg-[#09090a]" : "bg-[#f3f1ed]",
      ].join(" ")}
    >
      <DashboardSidebar theme={theme} />

      {/* Le padding-left suit l'ouverture/fermeture de la sidebar. */}
      <div
        className={[
          "transition-[padding-left] duration-[380ms]",
          "ease-[cubic-bezier(0.4,0,0.2,1)]",
          "motion-reduce:transition-none",
        ].join(" ")}
        style={{ paddingLeft: sidebarOffset }}
      >
        <PageTransition>
          {/* Pleine largeur ; pb-[96px] réserve la place de la BottomBar. */}
          <div className="w-full max-w-none px-[clamp(12px,1.5vw,24px)] pt-[clamp(16px,2vw,28px)] pb-[96px]">
            {/* Titre de la page : en haut à gauche */}
            <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                    isDark
                      ? "border-white/10 bg-white/[0.03] text-white"
                      : "border-black/[0.08] bg-white text-neutral-900 shadow-sm",
                  ].join(" ")}
                >
                  <PlugIcon />
                </div>
                <h1
                  className={[
                    "font-display text-[clamp(17px,1.5vw,20px)] font-semibold tracking-[-0.01em]",
                    isDark ? "text-white" : "text-neutral-900",
                  ].join(" ")}
                >
                  Integrations
                </h1>
              </div>

              {/* Actions à droite */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTheme(isDark ? "light" : "dark")}
                  aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full border transition",
                    focusRing(isDark),
                    isDark
                      ? "border-white/10 text-neutral-300 hover:bg-white/10"
                      : "border-black/[0.06] text-neutral-500 hover:bg-black/5",
                  ].join(" ")}
                >
                  <SunMoonIcon isDark={isDark} />
                </button>

                <button
                  type="button"
                  className={[
                    "flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition",
                    focusRing(isDark),
                    isDark
                      ? "bg-white text-neutral-900 hover:bg-neutral-200"
                      : "bg-neutral-900 text-white hover:bg-neutral-800",
                  ].join(" ")}
                >
                  <PlusIcon />
                  Nouvelle intégration
                </button>
              </div>
            </header>

            {/* Recherche + filtre */}
            <div className="mt-[clamp(14px,2vw,22px)] flex flex-wrap items-center gap-2">
              <label
                className={[
                  "flex min-w-0 flex-1 items-center gap-2.5 rounded-full border px-3.5 py-2 transition sm:max-w-[360px]",
                  "focus-within:ring-2",
                  isDark
                    ? "border-white/10 bg-[#1c1c1e] text-neutral-500 focus-within:ring-white/20"
                    : "border-black/[0.06] bg-white text-neutral-400 focus-within:ring-black/15",
                ].join(" ")}
              >
                <SearchIcon />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher une intégration"
                  aria-label="Rechercher une intégration"
                  className={[
                    "w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-inherit",
                    "[&::-webkit-search-cancel-button]:appearance-none",
                    isDark ? "text-white" : "text-neutral-800",
                  ].join(" ")}
                />
              </label>

              <div className="relative" ref={filterRef}>
                <button
                  type="button"
                  onClick={() => setFilterOpen((value) => !value)}
                  aria-haspopup="menu"
                  aria-expanded={filterOpen}
                  className={[
                    "flex items-center gap-2 rounded-full border px-4 py-2 text-[12.5px] font-medium transition",
                    focusRing(isDark),
                    isDark
                      ? "border-white/10 bg-[#1c1c1e] text-neutral-200 hover:bg-[#242427]"
                      : "border-black/[0.06] bg-white text-neutral-700 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  {filter}
                  <span className={["flex transition-transform duration-200", filterOpen ? "rotate-180" : ""].join(" ")}>
                    <ChevronDownIcon />
                  </span>
                </button>

                {filterOpen && (
                  <div
                    role="menu"
                    className={[
                      "absolute left-0 z-20 mt-2 w-44 overflow-hidden rounded-[12px] border py-1 shadow-lg",
                      isDark
                        ? "border-white/10 bg-[#1c1c1e]"
                        : "border-black/[0.06] bg-white",
                    ].join(" ")}
                  >
                    {FILTERS.map((option) => {
                      const selected = option === filter;
                      return (
                        <button
                          key={option}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selected}
                          onClick={() => {
                            setFilter(option);
                            setFilterOpen(false);
                          }}
                          className={[
                            "flex w-full items-center justify-between px-4 py-2.5 text-left text-[12.5px] transition",
                            selected
                              ? isDark
                                ? "font-semibold text-white"
                                : "font-semibold text-neutral-900"
                              : isDark
                                ? "text-neutral-400 hover:bg-white/5"
                                : "text-neutral-500 hover:bg-black/[0.03]",
                          ].join(" ")}
                        >
                          {option}
                          {selected && <CheckIcon />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <span
                aria-live="polite"
                className={["ml-auto text-[12px]", isDark ? "text-neutral-500" : "text-neutral-400"].join(" ")}
              >
                {visible.length} {visible.length === 1 ? "integration" : "integrations"}
              </span>
            </div>

            {/* Cards grid */}
            <div className="mt-[clamp(14px,2vw,22px)] grid grid-cols-1 gap-[clamp(12px,1.4vw,18px)] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visible.map((card) => (
                <IntegrationCard
                  key={card.title}
                  data={card}
                  isDark={isDark}
                />
              ))}
            </div>

            {visible.length === 0 && (
              <div className="mt-16 flex flex-col items-center gap-3 text-center">
                <p
                  className={[
                    "text-[13px]",
                    isDark ? "text-neutral-500" : "text-neutral-400",
                  ].join(" ")}
                >
                  Aucune intégration ne correspond à votre recherche.
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className={[
                      "rounded-full border px-4 py-1.5 text-[12px] font-semibold transition",
                      focusRing(isDark),
                      isDark
                        ? "border-white/10 text-white hover:bg-white/[0.07]"
                        : "border-black/10 text-neutral-900 hover:bg-neutral-100",
                    ].join(" ")}
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            )}
          </div>
        </PageTransition>
      </div>

      {/* Barre d'actions rapides, centrée sur la zone de contenu. */}
      <Folder
        isOpen={isFolderOpen}
        onClose={() => setIsFolderOpen(false)}
        isDark={isDark}
        offsetLeft={sidebarOffset}
      />

      <BottomBar
        isDark={isDark}
        offsetLeft={sidebarOffset}
        active={isFolderOpen ? "files" : null}
        onChange={handleBottomBarChange}
        query={bottomQuery}
        onQueryChange={setBottomQuery}
      />

      <NewPostModal
        isOpen={isNewPostOpen}
        onClose={() => setIsNewPostOpen(false)}
        isDark={isDark}
        onSubmit={handleCreatePost}
      />
    </main>
  );
}