import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import DashboardSidebar, {
  useSidebarOffset,
} from "../components/DashboardSidebar";
import { useTheme } from "../hooks/useTheme";

import NewPostModal, {
  type NewPostPayload,
  unavailablePostActionMessage,
} from "../components/Newpostmodal";

import Folder from "../components/Folder";

import BottomBar, {
  type BottomBarTab,
} from "../components/Bottombar";

import { navigate } from "../hooks/useHashRoute";

/* ============================================================================
   Types
============================================================================ */

type Template = {
  id: string;
  emoji?: string;
  name: string;
  description: string;
  content: string;
  tags: string[];
  usage: number;
  updatedAt: string;
};

type ViewTab = "mine" | "discover";

const VIEW_LABELS: Record<ViewTab, string> = {
  mine: "My template",
  discover: "Discover",
};

const sampleData: Record<string, string> = {
  product: "Stone",
  benefit: "publie plus vite, avec plus de clarté",
  link: "stone.app",
  hashtag: "buildinpublic",
  name: "Ronan",
};

/* ============================================================================
   Mock data
============================================================================ */

/* Aucun template par défaut */
const initialTemplates: Template[] = [];

/* Featured templates */
type FeaturedTemplate = {
  id: string;
  emoji: string;
  name: string;
  description: string;
};

const FEATURED: FeaturedTemplate[] = [
  {
    id: "f1",
    emoji: "📊",
    name: "Report on a one-week experiment you ran",
    description:
      "Share a one-week experiment you actually ran, what was hard about it, and what shifted by the end.",
  },
  {
    id: "f2",
    emoji: "🟥",
    name: "Describe the rule you broke and what happened",
    description:
      "Share a “best practice” or common belief that no longer served you and what you now do instead.",
  },
  {
    id: "f3",
    emoji: "💸",
    name: "Walk through how your pricing changed",
    description:
      "How you used to set prices, what that cost you, and how you price now.",
  },
];

const TIPS: FeaturedTemplate[] = [
  {
    id: "tip1",
    emoji: "💬",
    name: "The fuller answer to a question you get a lot",
    description:
      "What's the question people ask you over and over? This prompt is space for the answer you'd give if you had the time.",
  },
  {
    id: "tip2",
    emoji: "🕯️",
    name: "The thing that nearly made you stop",
    description:
      "Many of us have had a stretch when carrying on with the work felt like too much. If you've been through one, describe it.",
  },
  {
    id: "tip3",
    emoji: "🔍",
    name: "Feedback that turned out to be right",
    description:
      "Has a piece of feedback ever stung at first and stuck with you anyway? If it took you a while to come around, share it.",
  },
  {
    id: "tip4",
    emoji: "✏️",
    name: "A mistake that taught you something specific",
    description:
      "Think of a mistake you've made that taught you something you still use. Small ones work just as well as big ones.",
  },
  {
    id: "tip5",
    emoji: "📐",
    name: "Something you're still working on",
    description:
      "There might be a part of your craft that has never come naturally, however long you've been at it. Name it.",
  },
];

const CASE_STUDIES: FeaturedTemplate[] = [
  {
    id: "cs1",
    emoji: "🚀",
    name: "From 0 to 10k users in 90 days",
    description:
      "Break down the tactics, channels, and turning points that grew your product fastest.",
  },
  {
    id: "cs2",
    emoji: "🔁",
    name: "A pivot that saved the product",
    description:
      "What signal told you to change direction, and what did the pivot actually look like?",
  },
  {
    id: "cs3",
    emoji: "📉",
    name: "The launch that flopped",
    description:
      "Walk through what you expected, what actually happened, and what you'd do differently.",
  },
  {
    id: "cs4",
    emoji: "🤝",
    name: "The partnership that unlocked growth",
    description:
      "Who did you partner with, how did you find them, and what did both sides actually get out of it?",
  },
];

/* ============================================================================
   Icônes
============================================================================ */

function Svg({
  className = "h-4 w-4",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const PlusIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <Svg className={className}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

const SearchIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

const EditIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <Svg className={className}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
);

const CopyIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <Svg className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);

const TrashIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <Svg className={className}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
);

const XIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <Svg className={className}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);

/* ============================================================================
   Carte "prompt" (avec emoji)
============================================================================ */

function PromptCard({
  template,
  onOpen,
  surface,
  titleClass,
  descClass,
}: {
  template: FeaturedTemplate;
  onOpen: (t: FeaturedTemplate) => void;
  surface: string;
  titleClass: string;
  descClass: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(template)}
      className={[
        "group flex h-full flex-col items-start rounded-2xl border p-5 text-left",
        "transition-[background-color,border-color,transform] duration-150",
        "hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/20",
        surface,
      ].join(" ")}
    >
      <span className="text-[20px] leading-none" role="img" aria-hidden="true">
        {template.emoji}
      </span>

      <h3
        className={[
          "mt-4 text-[15px] font-semibold leading-snug",
          titleClass,
        ].join(" ")}
      >
        {template.name}
      </h3>

      <p
        className={[
          "mt-2 line-clamp-3 text-[12.5px] leading-relaxed",
          descClass,
        ].join(" ")}
      >
        {template.description}
      </p>
    </button>
  );
}

/* ============================================================================
   Page
============================================================================ */

export default function TemplatesPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  /* Marge gauche : suit l'état réduit / ouvert de la sidebar. */
  const sidebarOffset = useSidebarOffset();

  /* Onglet actif — state local, aucun impact sur le hash de l'URL.
     La sidebar a une seule entrée "Templates" → route "template". */
  const [activeTab, setActiveTab] = useState<ViewTab>("mine");

  const [templates, setTemplates] = useState<Template[]>(initialTemplates);

  /* Recherche partagée : filtre la page ET alimente la BottomBar. */
  const [query, setQuery] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Template | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [tagsInput, setTagsInput] = useState("");

  /* Modaux pilotés par la BottomBar */
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [isFolderOpen, setIsFolderOpen] = useState(false);

  /* --------------------------------------------------------------------------
     Theme tokens
  -------------------------------------------------------------------------- */

  const t = useMemo(
    () =>
      isDark
        ? {
            page: "bg-[#0a0a0b] text-[#f3f3ef]",
            title: "text-white",
            muted: "text-[#99a2a2]",

            /* Featured section : fond sombre + dégradé noir & blanc */
            featuredBg:
              "border border-white/10 bg-[#111112] " +
              "bg-[radial-gradient(120%_100%_at_0%_0%,rgba(255,255,255,0.10),rgba(0,0,0,0)_55%)]",
            featuredLabel: "text-white/60",
            featuredTitle: "text-white",
            featuredDesc: "text-white/55",
            cardFeatured:
              "border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/20",

            /* Cartes de la grid principale */
            card: "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20",
            cardTitle: "text-white",
            cardDesc: "text-[#99a2a2]",
            cardBody: "text-[#d7d7d2]",
            tag: "bg-white/10 text-[#d7d7d2]",

            /* Cartes horizontales (Tip / Case Study) */
            cardFlat:
              "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20",
            sectionTitle: "text-white",
            seeAll: "text-[#99a2a2] hover:text-white",

            tabList: "border border-white/10 bg-white/[0.04]",
            tabActive: "bg-white/15 text-white",
            tabIdle: "text-[#99a2a2] hover:text-white",

            input:
              "border-white/10 bg-white/[0.04] text-white placeholder:text-white/40 focus:border-white/30 focus:bg-white/[0.06]",
            buttonPrimary: "bg-white text-black hover:bg-white/90",
            buttonGhost:
              "border-white/10 text-[#d7d7d2] hover:bg-white/[0.06]",
            modal: "border-white/10 bg-[#111112]",
            divider: "border-white/10",
            iconBtn: "hover:bg-white/10 text-[#d7d7d2]",

            /* Empty state */
            emptyCircle: "bg-white/[0.06] text-white/60",
            emptyTitle: "text-white",
            emptyDesc: "text-[#99a2a2]",
            emptyButton: "bg-white text-black hover:bg-white/90",
          }
        : {
            page: "bg-[#f7f7f5] text-[#151515]",
            title: "text-[#151515]",
            muted: "text-[#71706d]",

            /* Featured section : fond clair + dégradé noir & blanc */
            featuredBg:
              "border border-black/[0.06] bg-[#f1f1ef] " +
              "bg-[radial-gradient(120%_100%_at_0%_0%,rgba(0,0,0,0.06),rgba(255,255,255,0)_55%)]",
            featuredLabel: "text-black/55",
            featuredTitle: "text-[#151515]",
            featuredDesc: "text-[#52514e]",
            cardFeatured:
              "border-black/[0.06] bg-white hover:bg-white hover:border-black/20 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",

            card: "border-black/10 bg-white hover:bg-black/[0.02] hover:border-black/20",
            cardTitle: "text-[#151515]",
            cardDesc: "text-[#71706d]",
            cardBody: "text-[#3f3f3d]",
            tag: "bg-black/[0.05] text-[#3f3f3d]",

            cardFlat:
              "border-black/10 bg-white hover:bg-black/[0.02] hover:border-black/20",
            sectionTitle: "text-[#151515]",
            seeAll: "text-[#71706d] hover:text-[#151515]",

            tabList: "border border-black/10 bg-black/[0.03]",
            tabActive: "bg-white text-[#151515] shadow-sm",
            tabIdle: "text-[#71706d] hover:text-[#151515]",

            input:
              "border-black/10 bg-white text-[#151515] placeholder:text-black/40 focus:border-black/30 focus:bg-white",
            buttonPrimary: "bg-[#151515] text-white hover:bg-[#2a2a2a]",
            buttonGhost:
              "border-black/10 text-[#3f3f3d] hover:bg-black/[0.04]",
            modal: "border-black/10 bg-white",
            divider: "border-black/[0.07]",
            iconBtn: "hover:bg-black/[0.05] text-[#3f3f3d]",

            /* Empty state */
            emptyCircle: "bg-black/[0.05] text-black/45",
            emptyTitle: "text-[#151515]",
            emptyDesc: "text-[#71706d]",
            emptyButton: "bg-[#151515] text-white hover:bg-[#2a2a2a]",
          },
    [isDark]
  );

  /* --------------------------------------------------------------------------
     Filtrage
  -------------------------------------------------------------------------- */

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return templates.filter((template) => {
      if (!q) return true;

      return (
        template.name.toLowerCase().includes(q) ||
        template.description.toLowerCase().includes(q) ||
        template.content.toLowerCase().includes(q) ||
        template.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [templates, query]);

  const discoverItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = [...TIPS, ...CASE_STUDIES];
    if (!q) return items;

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [query]);

  const hasAnyTemplate = templates.length > 0;

  /* --------------------------------------------------------------------------
     Actions
  -------------------------------------------------------------------------- */

  const openNew = useCallback(() => {
    setIsNew(true);
    setTagsInput("");
    setDraft({
      id: "",
      name: "",
      description: "",
      content: "",
      tags: [],
      usage: 0,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((template: Template) => {
    setIsNew(false);
    setTagsInput(template.tags.join(", "));
    setDraft({ ...template });
    setEditorOpen(true);
  }, []);

  const openFromPrompt = useCallback((prompt: FeaturedTemplate) => {
    setIsNew(true);
    setTagsInput("");
    setDraft({
      id: "",
      emoji: prompt.emoji,
      name: prompt.name,
      description: prompt.description,
      content: "",
      tags: [],
      usage: 0,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setDraft(null);
  }, []);

  const handleSave = useCallback(() => {
    if (!draft) return;

    const now = new Date().toISOString().slice(0, 10);
    const tags = tagsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (isNew) {
      setTemplates((prev) => [
        {
          ...draft,
          id: `t-${Date.now()}`,
          tags,
          usage: 0,
          updatedAt: now,
        },
        ...prev,
      ]);
    } else {
      setTemplates((prev) =>
        prev.map((item) =>
          item.id === draft.id ? { ...draft, tags, updatedAt: now } : item
        )
      );
    }

    closeEditor();
  }, [draft, tagsInput, isNew, closeEditor]);

  const handleDuplicate = useCallback((template: Template) => {
    setTemplates((prev) => [
      {
        ...template,
        id: `t-${Date.now()}`,
        name: `${template.name} (copie)`,
        usage: 0,
        updatedAt: new Date().toISOString().slice(0, 10),
      },
      ...prev,
    ]);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /* --------------------------------------------------------------------------
     CREATE POST
  -------------------------------------------------------------------------- */

  const handleCreatePost = useCallback(
    async (payload: NewPostPayload) => {
      throw new Error(unavailablePostActionMessage(payload));
    },
    []
  );

  /* --------------------------------------------------------------------------
     BOTTOM BAR
  -------------------------------------------------------------------------- */

  const handleBottomBarChange = useCallback((id: BottomBarTab) => {
    switch (id) {
      case "add":
        setIsFolderOpen(false);
        setIsNewPostOpen(true);
        break;

      case "files":
        setIsFolderOpen((open) => !open);
        break;

      default:
        break;
    }
  }, []);

  /* Ferme l'éditeur avec Escape */
  useEffect(() => {
    if (!editorOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEditor();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editorOpen, closeEditor]);

  /* ==========================================================================
     Render
  ========================================================================== */

  return (
    <div
      className={["relative h-screen w-screen overflow-hidden", t.page].join(" ")}
    >
      {/* Sidebar flottante */}
      <DashboardSidebar />

      {/* Contenu principal */}
      <main
        className={[
          "h-full overflow-y-auto overflow-x-hidden",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "transition-[padding-left] duration-[380ms]",
          "ease-[cubic-bezier(0.4,0,0.2,1)]",
          "motion-reduce:transition-none",
        ].join(" ")}
        style={{ paddingLeft: sidebarOffset }}
      >
        <div className="mx-auto max-w-[1200px] px-6 pb-[120px] pt-10 sm:px-10 sm:pt-12">
          {/* ============================================================
              HEADER
          ============================================================ */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1
                className={[
                  "text-[26px] font-semibold tracking-tight",
                  t.title,
                ].join(" ")}
              >
                Templates
              </h1>
              <p className={["mt-1 text-[13px]", t.muted].join(" ")}>
                Créez, réutilisez et adaptez vos templates en quelques secondes.
              </p>
            </div>

            <button
              type="button"
              onClick={openNew}
              className={[
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4",
                "text-[13px] font-semibold",
                "transition-[background-color,transform] duration-150",
                "active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/20",
                t.buttonPrimary,
              ].join(" ")}
            >
              <PlusIcon />
              Nouveau template
            </button>
          </div>

          {/* ---------- Section "Featured templates" ---------- */}
          <section
            className={[
              "mt-8 relative overflow-hidden rounded-3xl p-6 sm:p-8",
              t.featuredBg,
            ].join(" ")}
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr] lg:gap-8">
              <div className="flex flex-col justify-center">
                <span
                  className={[
                    "text-[11px] font-semibold uppercase tracking-[0.08em]",
                    t.featuredLabel,
                  ].join(" ")}
                >
                  Featured templates
                </span>
                <h2
                  className={[
                    "mt-2 font-display text-[30px] font-semibold tracking-[-0.02em] sm:text-[34px]",
                    t.featuredTitle,
                  ].join(" ")}
                >
                  Our top picks
                </h2>
                <p
                  className={[
                    "mt-2 max-w-[220px] text-[13px] leading-relaxed",
                    t.featuredDesc,
                  ].join(" ")}
                >
                  Helpful starting points to plan your next post.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {FEATURED.map((item) => (
                  <PromptCard
                    key={item.id}
                    template={item}
                    onOpen={openFromPrompt}
                    surface={t.cardFeatured}
                    titleClass={t.cardTitle}
                    descClass={t.cardDesc}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ============================================================
              MY TEMPLATE / DISCOVER
          ============================================================ */}
          <section className="mt-12">
            <h2
              className={[
                "text-[20px] font-semibold tracking-tight",
                t.sectionTitle,
              ].join(" ")}
            >
              {activeTab === "discover" ? "Discover" : "My templates"}
            </h2>

            {/* Tabs + recherche */}
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div
                className={["flex gap-1 rounded-xl p-1", t.tabList].join(" ")}
                role="tablist"
              >
                {(Object.keys(VIEW_LABELS) as ViewTab[]).map((tab) => {
                  const active = tab === activeTab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(tab)}
                      className={[
                        "rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium",
                        "transition-colors duration-150",
                        active ? t.tabActive : t.tabIdle,
                      ].join(" ")}
                    >
                      {VIEW_LABELS[tab]}
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-72">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-40" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un template…"
                  className={[
                    "h-10 w-full rounded-xl border pl-9 pr-3 text-[13px]",
                    "outline-none transition-colors duration-150",
                    t.input,
                  ].join(" ")}
                />
              </div>
            </div>

            {/* Contenu de l'onglet actif */}
            {activeTab === "discover" ? (
              discoverItems.length > 0 ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {discoverItems.map((item) => (
                    <PromptCard
                      key={item.id}
                      template={item}
                      onOpen={openFromPrompt}
                      surface={t.cardFlat}
                      titleClass={t.cardTitle}
                      descClass={t.cardDesc}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className={[
                    "mt-10 flex flex-col items-center gap-2 text-center text-[13px]",
                    t.muted,
                  ].join(" ")}
                >
                  <SearchIcon className="h-5 w-5 opacity-50" />
                  <p>{`Aucun résultat pour « ${query} ».`}</p>
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className={[
                      "mt-1 inline-flex h-8 items-center gap-2 rounded-lg border px-3",
                      "text-[12px] font-semibold",
                      "transition-[background-color,transform] duration-150",
                      "active:scale-[0.98]",
                      t.buttonGhost,
                    ].join(" ")}
                  >
                    Effacer la recherche
                  </button>
                </div>
              )
            ) : filtered.length > 0 ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((template) => (
                  <article
                    key={template.id}
                    className={[
                      "group flex flex-col rounded-2xl border p-4",
                      "transition-[background-color,border-color,transform] duration-150",
                      "hover:-translate-y-0.5",
                      t.card,
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3
                          className={[
                            "truncate text-[14px] font-semibold",
                            t.cardTitle,
                          ].join(" ")}
                        >
                          {template.name}
                        </h3>
                        <p
                          className={[
                            "mt-0.5 line-clamp-2 text-[12px]",
                            t.cardDesc,
                          ].join(" ")}
                        >
                          {template.description}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          aria-label="Éditer"
                          onClick={() => openEdit(template)}
                          className={[
                            "rounded-lg p-1.5 transition-colors",
                            t.iconBtn,
                          ].join(" ")}
                        >
                          <EditIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Dupliquer"
                          onClick={() => handleDuplicate(template)}
                          className={[
                            "rounded-lg p-1.5 transition-colors",
                            t.iconBtn,
                          ].join(" ")}
                        >
                          <CopyIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Supprimer"
                          onClick={() => handleDelete(template.id)}
                          className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-500/10"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <p
                      className={[
                        "mt-3 line-clamp-3 whitespace-pre-wrap text-[12px]",
                        t.cardBody,
                      ].join(" ")}
                    >
                      {template.content}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {template.tags.map((tag) => (
                        <span
                          key={tag}
                          className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            t.tag,
                          ].join(" ")}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div
                      className={[
                        "mt-4 flex items-center justify-between border-t pt-3 text-[11px]",
                        t.divider,
                        t.muted,
                      ].join(" ")}
                    >
                      <span>{template.usage} utilisations</span>
                      <span>{template.updatedAt}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : hasAnyTemplate && query ? (
              /* Recherche sans résultat */
              <div
                className={[
                  "mt-10 flex flex-col items-center gap-2 text-center text-[13px]",
                  t.muted,
                ].join(" ")}
              >
                <SearchIcon className="h-5 w-5 opacity-50" />
                <p>{`Aucun template trouvé pour « ${query} ».`}</p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className={[
                    "mt-1 inline-flex h-8 items-center gap-2 rounded-lg border px-3",
                    "text-[12px] font-semibold",
                    "transition-[background-color,transform] duration-150",
                    "active:scale-[0.98]",
                    t.buttonGhost,
                  ].join(" ")}
                >
                  Effacer la recherche
                </button>
              </div>
            ) : (
              /* ============================================================
                 EMPTY STATE — version compacte
              ============================================================ */
              <div className="mt-8 flex flex-col items-center justify-center py-8 text-center">
                {/* Cercle gris clair avec + (plus petit) */}
                <div
                  className={[
                    "flex h-[72px] w-[72px] items-center justify-center rounded-full",
                    t.emptyCircle,
                  ].join(" ")}
                >
                  <PlusIcon className="h-6 w-6" />
                </div>

                <h3
                  className={[
                    "mt-5 text-[18px] font-bold tracking-[-0.01em]",
                    t.emptyTitle,
                  ].join(" ")}
                >
                  Create your first template
                </h3>

                <p
                  className={[
                    "mt-1.5 max-w-[360px] text-[13px] leading-relaxed",
                    t.emptyDesc,
                  ].join(" ")}
                >
                  Once created, you'll see your templates listed here.
                </p>

                <button
                  type="button"
                  onClick={openNew}
                  className={[
                    "mt-5 rounded-xl px-5 py-2.5 text-[13px] font-semibold",
                    "transition-[background-color,transform] duration-150",
                    "active:scale-[0.98]",
                    t.emptyButton,
                  ].join(" ")}
                >
                  New template
                </button>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ============================================================
          FOLDER
      ============================================================ */}
      <Folder
        isOpen={isFolderOpen}
        onClose={() => setIsFolderOpen(false)}
        isDark={isDark}
        offsetLeft={sidebarOffset}
      />

      {/* ============================================================
          BOTTOM BAR
      ============================================================ */}
      <BottomBar
        isDark={isDark}
        offsetLeft={sidebarOffset}
        active={isFolderOpen ? "files" : null}
        onChange={handleBottomBarChange}
        query={query}
        onQueryChange={setQuery}
      />

      {/* ============================================================
          NEW POST
      ============================================================ */}
      <NewPostModal
        isOpen={isNewPostOpen}
        onClose={() => setIsNewPostOpen(false)}
        isDark={isDark}
        onSubmit={handleCreatePost}
      />

      {/* ============================================================
          ÉDITEUR (panneau latéral)
      ============================================================ */}
      {editorOpen && draft && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm"
          onClick={closeEditor}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className={[
              "h-full w-full max-w-lg overflow-y-auto border-l p-6",
              "shadow-[-30px_0_60px_-20px_rgba(0,0,0,0.35)]",
              t.modal,
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {draft.emoji && (
                  <span className="text-[22px] leading-none" aria-hidden="true">
                    {draft.emoji}
                  </span>
                )}
                <h2
                  className={["text-[16px] font-semibold", t.title].join(" ")}
                >
                  {isNew ? "Nouveau template" : "Éditer le template"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                aria-label="Fermer"
                className={["rounded-lg p-1.5 transition-colors", t.iconBtn].join(
                  " "
                )}
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              <Field label="Nom">
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  className={[
                    "h-10 rounded-xl border px-3 text-[13px] outline-none transition-colors",
                    t.input,
                  ].join(" ")}
                />
              </Field>

              <Field label="Description">
                <input
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  className={[
                    "h-10 rounded-xl border px-3 text-[13px] outline-none transition-colors",
                    t.input,
                  ].join(" ")}
                />
              </Field>

              <Field label="Contenu">
                <textarea
                  value={draft.content}
                  onChange={(event) =>
                    setDraft({ ...draft, content: event.target.value })
                  }
                  rows={5}
                  className={[
                    "resize-none rounded-xl border px-3 py-2 text-[13px] outline-none transition-colors",
                    t.input,
                  ].join(" ")}
                />
              </Field>

              <Field label="Tags (séparés par des virgules)">
                <input
                  value={tagsInput}
                  onChange={(event) => setTagsInput(event.target.value)}
                  placeholder="growth, tips, fr"
                  className={[
                    "h-10 rounded-xl border px-3 text-[13px] outline-none transition-colors",
                    t.input,
                  ].join(" ")}
                />
              </Field>

              <div
                className={[
                  "mt-2 rounded-xl border p-3.5",
                  t.divider,
                ].join(" ")}
              >
                <p
                  className={[
                    "text-[11px] font-semibold uppercase tracking-wide",
                    t.muted,
                  ].join(" ")}
                >
                  Aperçu
                </p>
                <p
                  className={[
                    "mt-2 whitespace-pre-wrap text-[13px]",
                    t.cardBody,
                  ].join(" ")}
                >
                  {draft.content
                    ? draft.content.replace(
                        /\{\{(\w+)\}\}/g,
                        (_, key) => sampleData[key] ?? `{{${key}}}`
                      )
                    : "…"}
                </p>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className={[
                  "h-10 rounded-xl border px-4 text-[13px] font-medium",
                  "transition-colors duration-150",
                  t.buttonGhost,
                ].join(" ")}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!draft.name.trim() || !draft.content.trim()}
                className={[
                  "h-10 rounded-xl px-4 text-[13px] font-semibold",
                  "transition-[background-color,transform] duration-150",
                  "active:scale-[0.98]",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  t.buttonPrimary,
                ].join(" ")}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   Field
============================================================================ */

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium">{label}</span>
      {children}
    </label>
  );
}