// src/pages/Create.tsx
// Page Create (routes "create", "create/ideas", "create/templates").
// Shell visuel et responsive alignés sur Home / Schedule :
//  - 100dvh + padding haut = barre mobile de la sidebar (safe-area incluse)
//  - AUCUN décalage gauche sur mobile (la sidebar y est un tiroir)
//  - un seul breakpoint de bascule : md (768px) <-> useIsMobile()
//  - cibles tactiles >= 40px sur mobile
//  - mobile : menus = feuilles glissables (BottomSheet), comme Schedule
//  - mobile : board = onglets de groupes + liste verticale (swipe gauche/droite
//    pour changer de groupe). Le drag & drop reste sur desktop ; au doigt on
//    déplace une idée via « Déplacer vers » dans la feuille de la carte.
//
// Deux notions distinctes :
//  - GROUPES : les colonnes du board (Unassigned, To Do, In Progress…).
//              Présents par défaut, gérés par l'utilisateur (créer / renommer /
//              réordonner / supprimer). Une idée est dans exactement 1 groupe.
//  - TAGS    : étiquettes libres. AUCUN par défaut : c'est l'utilisateur qui
//              les crée, les assigne aux idées (0..n par idée) et filtre avec.
//
// Groupes et tags vivent dans un store partagé (services/boardMeta) :
// chargés une seule fois, visibles aussi par BottomBar / NewIdeaModal.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { PointerEvent as RPointerEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../hooks/useTheme";
import { navigate } from "../hooks/useHashRoute";
import DashboardSidebar, {
  useSidebarOffset,
  useFavorites,
} from "../components/DashboardSidebar";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import HelpChatButton from "../components/Helpchatbutton";
import { requestNewPost } from "../services/Newpostbus";
import type { Group, Tag } from "../services/supabase";
import {
  UNASSIGNED,
  useBoardMeta,
  loadBoardMeta,
  addGroup,
  renameGroup,
  removeGroup,
  moveGroup,
  addTag,
  removeTag as removeTagApi,
} from "../services/boardMeta";

/* ───────── Language ───────── */

type Lang = "fr" | "en";

const LANGUAGE_STORAGE_KEY = "stone:language";

/** Lit la langue dans le localStorage. Anglais par défaut si absent. */
function detectLanguage(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* stockage indisponible */
  }
  return "en";
}

/** Hook réactif : se resynchronise sur storage / focus / hashchange. */
function useLanguage(): Lang {
  const [lang, setLang] = useState<Lang>(() => detectLanguage());

  useEffect(() => {
    const refresh = () => setLang(detectLanguage());
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    window.addEventListener("hashchange", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("hashchange", refresh);
    };
  }, []);

  return lang;
}

/* ───────── Responsive ───────── */

const MOBILE_QUERY = "(max-width: 767px)";

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(
    () =>
      typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

/* ───────── Copy ───────── */

type Copy = {
  pageTitle: string;
  header: {
    addFavorite: string;
    removeFavorite: string;
    autoReplies: string;
  };
  tabs: {
    ideas: string;
    templates: string;
    ariaLabel: string;
  };
  groupsMenu: {
    label: string;
    createPlaceholder: string;
    createAria: string;
    closeMenu: string;
  };
  tagsMenu: {
    label: string;
    createPlaceholder: string;
    createAria: string;
    closeMenu: string;
    empty: string;
    deleteTag: string;
  };
  view: {
    board: string;
    gallery: string;
    ariaLabel: string;
  };
  templatesEmpty: {
    title: string;
    description: string;
  };
  board: {
    newGroup: string;
    groupNamePlaceholder: string;
    cancel: string;
    save: string;
    groupOptions: string;
    renameGroup: string;
    moveAllToUnassigned: string;
    deleteGroup: string;
    closeMenu: string;
    loadError: string;
    retry: string;
    emptyGroup: string;
    noGroups: string;
  };
  ideaCard: {
    options: string;
    delete: string;
    closeMenu: string;
    tags: string;
    noTags: string;
    moveTo: string;
  };
  galleryEmpty: {
    title: string;
    description: string;
  };
  bottomBar: {
    newIdea: string;
  };
};

const COPY: Record<Lang, Copy> = {
  en: {
    pageTitle: "Create",
    header: {
      addFavorite: "Add to favorites",
      removeFavorite: "Remove from favorites",
      autoReplies: "Auto-replies",
    },
    tabs: {
      ideas: "Ideas",
      templates: "Templates",
      ariaLabel: "Create sections",
    },
    groupsMenu: {
      label: "Groups",
      createPlaceholder: "Create a group…",
      createAria: "Create group",
      closeMenu: "Close menu",
    },
    tagsMenu: {
      label: "Tags",
      createPlaceholder: "Create a tag…",
      createAria: "Create tag",
      closeMenu: "Close menu",
      empty: "No tags yet. Create your first one below.",
      deleteTag: "Delete tag",
    },
    view: {
      board: "Board",
      gallery: "Gallery",
      ariaLabel: "View",
    },
    templatesEmpty: {
      title: "No templates yet",
      description: "Save a post as a template to reuse it later.",
    },
    board: {
      newGroup: "New group",
      groupNamePlaceholder: "Group name…",
      cancel: "Cancel",
      save: "Save",
      groupOptions: "Group options",
      renameGroup: "Rename group",
      moveAllToUnassigned: "Move all to Unassigned",
      deleteGroup: "Delete group",
      closeMenu: "Close menu",
      loadError: "Couldn't load your groups.",
      retry: "Retry",
      emptyGroup: "No ideas in this group yet.",
      noGroups: "All groups are hidden. Show some from the Groups menu.",
    },
    ideaCard: {
      options: "Idea options",
      delete: "Delete",
      closeMenu: "Close menu",
      tags: "Tags",
      noTags: "No tags yet. Create one from the Tags menu.",
      moveTo: "Move to",
    },
    galleryEmpty: {
      title: "No ideas yet",
      description: "Capture your next post idea before it gets away.",
    },
    bottomBar: {
      newIdea: "New Idea",
    },
  },
  fr: {
    pageTitle: "Create",
    header: {
      addFavorite: "Ajouter aux favoris",
      removeFavorite: "Retirer des favoris",
      autoReplies: "Réponses auto",
    },
    tabs: {
      ideas: "Idées",
      templates: "Modèles",
      ariaLabel: "Sections Create",
    },
    groupsMenu: {
      label: "Groupes",
      createPlaceholder: "Créer un groupe…",
      createAria: "Créer le groupe",
      closeMenu: "Fermer le menu",
    },
    tagsMenu: {
      label: "Tags",
      createPlaceholder: "Créer un tag…",
      createAria: "Créer le tag",
      closeMenu: "Fermer le menu",
      empty: "Aucun tag pour l'instant. Créez le premier ci-dessous.",
      deleteTag: "Supprimer le tag",
    },
    view: {
      board: "Tableau",
      gallery: "Galerie",
      ariaLabel: "Affichage",
    },
    templatesEmpty: {
      title: "Aucun modèle pour l'instant",
      description:
        "Enregistrez un post comme modèle pour le réutiliser plus tard.",
    },
    board: {
      newGroup: "Nouveau groupe",
      groupNamePlaceholder: "Nom du groupe…",
      cancel: "Annuler",
      save: "Enregistrer",
      groupOptions: "Options du groupe",
      renameGroup: "Renommer le groupe",
      moveAllToUnassigned: "Tout déplacer vers Unassigned",
      deleteGroup: "Supprimer le groupe",
      closeMenu: "Fermer le menu",
      loadError: "Impossible de charger vos groupes.",
      retry: "Réessayer",
      emptyGroup: "Aucune idée dans ce groupe pour l'instant.",
      noGroups:
        "Tous les groupes sont masqués. Affichez-en depuis le menu Groupes.",
    },
    ideaCard: {
      options: "Options de l'idée",
      delete: "Supprimer",
      closeMenu: "Fermer le menu",
      tags: "Tags",
      noTags: "Aucun tag. Créez-en un depuis le menu Tags.",
      moveTo: "Déplacer vers",
    },
    galleryEmpty: {
      title: "Aucune idée pour l'instant",
      description:
        "Capturez votre prochaine idée de post avant qu'elle ne s'échappe.",
    },
    bottomBar: {
      newIdea: "Nouvelle idée",
    },
  },
};

/* ───────── Types ───────── */

type Tab = "ideas" | "templates";
type View = "board" | "gallery";

type Idea = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  /** Colonne du board (exactement une). */
  groupId: string;
  /** Étiquettes libres (0..n). */
  tagIds: string[];
};

type IconProps = { className?: string };

/** Route de cette page dans la sidebar (doit exister dans navItems). */
const PAGE_ROUTE = "create";

/** Délai avant d'exécuter une action lancée depuis une feuille (laisse finir l'animation de fermeture). */
const SHEET_ACTION_DELAY = 280;

/** Marge latérale du shell (identique au padding du conteneur). */
const EDGE_BLEED =
  "-mx-[clamp(14px,3vw,48px)] px-[clamp(14px,3vw,48px)] md:mx-0 md:px-0";

const HIDE_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/* ───────── Onglet ↔ URL (#/create, #/create/templates, …) ───────── */

function tabFromHash(): Tab {
  const m = window.location.hash.match(/create\/(ideas|templates)/);
  return (m?.[1] as Tab | undefined) ?? "ideas";
}

function writeTabToHash(tab: Tab) {
  const current = window.location.hash;
  const prefix = current.startsWith("#/") ? "#/" : "#";
  const next = tab === "ideas" ? `${prefix}create` : `${prefix}create/${tab}`;
  if (current !== next) history.replaceState(null, "", next);
}

/* ───────── Persistance des préférences UI (affichage uniquement) ───────── */

const CREATE_VIEW_STORAGE_KEY = "create.view";
const CREATE_HIDDEN_GROUPS_STORAGE_KEY = "create.hiddenGroups";

function readStoredView(): View {
  if (typeof window === "undefined") return "board";
  try {
    const raw = window.localStorage.getItem(CREATE_VIEW_STORAGE_KEY);
    if (raw === "board" || raw === "gallery") return raw;
  } catch {
    /* ignore */
  }
  return "board";
}

function readStoredIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every((x): x is string => typeof x === "string")
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

function writeStoredIds(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

const readStoredHiddenGroups = () =>
  readStoredIds(CREATE_HIDDEN_GROUPS_STORAGE_KEY);

/* ───────── Données ───────── */

function useBoard() {
  const { groups, tags, status } = useBoardMeta();
  const [ideas, setIdeas] = useState<Idea[]>([]);

  /* ── Groupes ── */

  const deleteGroup = async (id: string) => {
    if (id === UNASSIGNED) return;
    const prevIdeas = ideas;
    setIdeas((prev) =>
      prev.map((i) => (i.groupId === id ? { ...i, groupId: UNASSIGNED } : i))
    );
    const ok = await removeGroup(id);
    if (!ok) setIdeas(prevIdeas);
  };

  /* ── Tags (vides par défaut, créés par l'utilisateur) ── */

  const deleteTag = async (id: string) => {
    const prevIdeas = ideas;
    setIdeas((prev) =>
      prev.map((i) => ({ ...i, tagIds: i.tagIds.filter((t) => t !== id) }))
    );
    const ok = await removeTagApi(id);
    if (!ok) setIdeas(prevIdeas);
  };

  /* ── Idées ── */

  const addIdea = (idea: Omit<Idea, "id">) =>
    setIdeas((prev) => [{ ...idea, id: crypto.randomUUID() }, ...prev]);

  const moveIdea = (id: string, groupId: string, beforeId?: string) =>
    setIdeas((prev) => {
      const idea = prev.find((i) => i.id === id);
      if (!idea) return prev;
      const rest = prev.filter((i) => i.id !== id);
      const moved = { ...idea, groupId };
      if (beforeId && beforeId !== id) {
        const at = rest.findIndex((i) => i.id === beforeId);
        if (at >= 0) {
          rest.splice(at, 0, moved);
          return rest;
        }
      }
      return [...rest, moved];
    });

  const deleteIdea = (id: string) =>
    setIdeas((prev) => prev.filter((i) => i.id !== id));

  const moveAll = (from: string, to: string) =>
    setIdeas((prev) =>
      prev.map((i) => (i.groupId === from ? { ...i, groupId: to } : i))
    );

  const toggleIdeaTag = (ideaId: string, tagId: string) =>
    setIdeas((prev) =>
      prev.map((i) =>
        i.id !== ideaId
          ? i
          : {
              ...i,
              tagIds: i.tagIds.includes(tagId)
                ? i.tagIds.filter((t) => t !== tagId)
                : [...i.tagIds, tagId],
            }
      )
    );

  return {
    groups,
    tags,
    status,
    ideas,
    addGroup,
    renameGroup,
    deleteGroup,
    moveGroup,
    addTag,
    deleteTag,
    addIdea,
    deleteIdea,
    moveIdea,
    moveAll,
    toggleIdeaTag,
  };
}

/* ───────── Icônes ───────── */

function Svg({
  className = "h-4 w-4",
  children,
}: IconProps & { children: ReactNode }) {
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

const BulbIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
  </Svg>
);
const BookmarkIcon = (p: IconProps & { filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={p.className ?? "h-4 w-4"}
    fill={p.filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.8L6 20V5.5a1 1 0 0 1 1-1Z" />
  </svg>
);
const ChatHeartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20.5a8.5 8.5 0 1 0-7.4-4.3L3.5 20.5l4.5-1.1a8.4 8.4 0 0 0 4 1.1Z" />
    <path d="M12 14.6s-2.8-1.6-2.8-3.4a1.6 1.6 0 0 1 2.8-1 1.6 1.6 0 0 1 2.8 1c0 1.8-2.8 3.4-2.8 3.4Z" />
  </Svg>
);
const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 19l1-12" />
    <path d="M9 7V4.5A.5.5 0 0 1 9.5 4h5a.5.5 0 0 1 .5.5V7" />
  </Svg>
);
const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m14.5 7.5 3 3" />
  </Svg>
);
const MoveIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12h14M13 7l5 5-5 5" />
  </Svg>
);
const DotsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="2.6" />
  </Svg>
);
const DragDotsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M8.5 10h.01M12 10h.01M15.5 10h.01M8.5 14h.01M12 14h.01M15.5 14h.01"
      strokeWidth="2.6"
    />
  </Svg>
);
const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
const TagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7a1 1 0 0 1 .7.3l7.6 7.6a1 1 0 0 1 0 1.4l-7.7 7.7a1 1 0 0 1-1.4 0l-7.6-7.6a1 1 0 0 1-.3-.7Z" />
    <path d="M8 8h.01" strokeWidth="2.4" />
  </Svg>
);
const BoardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M8.5 8v7M12 8v4M15.5 8v6" />
  </Svg>
);
const GalleryIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Svg>
);

/* ───────── Feuille glissable (mobile) — identique à Schedule ───────── */

function useEscape(onEscape: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onEscape]);
}

/**
 * Feuille glissable (mobile) / dialogue centré (si la fenêtre est élargie).
 * Glisser la poignée ou le titre vers le bas pour fermer.
 * `children` reçoit `close` : fermeture animée.
 * Rendue dans document.body (portail) : échappe aux overflow / z-index.
 */
function BottomSheet({
  isDark,
  title,
  onClose,
  children,
}: {
  isDark: boolean;
  title: string;
  onClose: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startT: number } | null>(null);

  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(true))
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setDragging(false);
    window.setTimeout(onClose, 300);
  }, [closing, onClose]);

  useEscape(requestClose);

  const onDragStart = (e: RPointerEvent<HTMLDivElement>) => {
    if (closing) return;
    drag.current = { startY: e.clientY, startT: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onDragMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setDragY(Math.max(0, e.clientY - d.startY));
  };

  const onDragEnd = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);

    const dy = Math.max(0, e.clientY - d.startY);
    const velocity = dy / Math.max(1, performance.now() - d.startT);
    const height = sheetRef.current?.offsetHeight ?? 500;

    if (dy > height * 0.25 || velocity > 0.5) requestClose();
    else setDragY(0);
  };

  const hidden = closing || !shown;
  const height = sheetRef.current?.offsetHeight ?? 600;
  const backdropOpacity = hidden ? 0 : 1 - Math.min(1, dragY / height);
  const ease = "cubic-bezier(0.32, 0.72, 0, 1)";

  return createPortal(
    <div
      // Les événements React remontent à travers les portails : on les
      // arrête pour ne pas déclencher le drag d'une carte parente.
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        style={{
          opacity: backdropOpacity,
          transition: dragging ? "none" : `opacity 300ms ${ease}`,
        }}
        onClick={requestClose}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          transform: hidden ? "translateY(100%)" : `translateY(${dragY}px)`,
          transition: dragging ? "none" : `transform 300ms ${ease}`,
          willChange: "transform",
        }}
        className={[
          "relative z-10 flex max-h-[92dvh] w-full flex-col overflow-y-auto overscroll-contain border p-4 shadow-2xl",
          "rounded-t-3xl pb-[calc(1rem+env(safe-area-inset-bottom))]",
          "md:max-w-sm md:rounded-2xl md:pb-4",
          isDark
            ? "border-white/[0.08] bg-[#101012]"
            : "border-black/[0.06] bg-[#f6f4f0]",
        ].join(" ")}
      >
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          className="-mx-4 -mt-4 mb-1 shrink-0 cursor-grab touch-none select-none px-4 pb-3 pt-3 active:cursor-grabbing md:mx-0 md:mt-0 md:cursor-default md:touch-auto md:px-0 md:pb-2 md:pt-0"
        >
          <div
            className={[
              "mx-auto mb-3 h-1.5 w-12 rounded-full md:hidden",
              isDark ? "bg-white/25" : "bg-black/15",
            ].join(" ")}
          />
          <h2
            className={[
              "truncate text-center text-[17px] font-semibold tracking-[-0.02em]",
              isDark ? "text-white" : "text-neutral-900",
            ].join(" ")}
          >
            {title}
          </h2>
        </div>

        {children(requestClose)}
      </div>
    </div>,
    document.body
  );
}

/** Ligne d'action d'une feuille (grande cible tactile). */
function sheetRowClass(isDark: boolean, danger = false) {
  return [
    "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2",
    isDark ? "focus-visible:ring-white/30" : "focus-visible:ring-black/25",
    danger
      ? isDark
        ? "text-rose-400 active:bg-white/[0.06]"
        : "text-rose-600 active:bg-black/[0.04]"
      : isDark
        ? "text-white active:bg-white/[0.06]"
        : "text-neutral-900 active:bg-black/[0.04]",
  ].join(" ");
}

/* ───────── Petits composants ───────── */

function IconButton({
  label,
  onClick,
  children,
  ghost,
  isDark,
  className = "h-10 w-10 md:h-9 md:w-9",
  align = "center",
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  ghost: string;
  isDark: boolean;
  className?: string;
  align?: "center" | "end";
}) {
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={`flex items-center justify-center rounded-xl transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 ${ghost} ${
          isDark ? "focus-visible:ring-white/30" : "focus-visible:ring-black/25"
        } ${className}`}
      >
        {children}
      </button>

      {/* Tooltip : survol uniquement (masqué sur tactile / mobile) */}
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-50 mt-2 w-max max-w-[240px] rounded-lg px-3 py-2 text-[13px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 motion-reduce:transition-none max-md:hidden group-hover:opacity-100 group-hover:delay-300 group-focus-within:opacity-100 [@media(hover:none)]:hidden ${
          isDark ? "bg-[#2e2e31]" : "bg-neutral-900"
        } ${align === "end" ? "right-0" : "left-1/2 -translate-x-1/2"}`}
      >
        {label}
      </span>
    </span>
  );
}

/** Champ « créer un groupe / un tag » : Entrée ou clic sur + pour valider. */
function CreateNameInput({
  onCreate,
  isDark,
  placeholder,
  submitAria,
  autoFocus,
}: {
  onCreate: (label: string) => void;
  isDark: boolean;
  placeholder: string;
  submitAria: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) return;
    onCreate(value);
    setValue("");
  };

  return (
    <div
      className={`flex items-center gap-1 rounded-xl border px-2 md:rounded-lg ${
        isDark ? "border-white/[0.10]" : "border-black/[0.10]"
      }`}
    >
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        maxLength={30}
        // 16px sur mobile : évite le zoom automatique d'iOS au focus
        className={`min-w-0 flex-1 bg-transparent py-3 text-[16px] outline-none md:py-2 md:text-[13px] ${
          isDark
            ? "placeholder:text-neutral-600"
            : "placeholder:text-neutral-400"
        }`}
      />
      <button
        type="button"
        aria-label={submitAria}
        onClick={submit}
        disabled={!value.trim()}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30 md:h-6 md:w-6 md:rounded-md ${
          isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]"
        }`}
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Case à cocher visuelle (✓) des menus. */
function CheckBox({ on, isDark }: { on: boolean; isDark: boolean }) {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
        on
          ? isDark
            ? "border-white bg-white text-black"
            : "border-black bg-black text-white"
          : isDark
            ? "border-white/25"
            : "border-black/25"
      }`}
    >
      {on ? "✓" : ""}
    </span>
  );
}

/** Classes d'un menu déroulant desktop. */
const dropdownClass = (isDark: boolean, width: string) =>
  `absolute right-0 z-40 mt-2 rounded-xl border p-1 shadow-lg ${width} ${
    isDark
      ? "border-white/[0.08] bg-[#101012]"
      : "border-black/[0.06] bg-white"
  }`;

/** Contenu du menu « Groupes » (partagé dropdown desktop / feuille mobile). */
function GroupsPanel({
  groups,
  hidden,
  onToggle,
  onCreate,
  isDark,
  c,
}: {
  groups: Group[];
  hidden: string[];
  onToggle: (id: string) => void;
  onCreate: (label: string) => void;
  isDark: boolean;
  c: Copy;
}) {
  return (
    <>
      <ul className="max-h-[320px] overflow-y-auto md:max-h-[260px]">
        {groups.map((g) => {
          const on = !hidden.includes(g.id);
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => onToggle(g.id)}
                className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-medium transition-colors md:min-h-0 md:rounded-lg md:text-[13px] ${
                  isDark
                    ? "active:bg-white/[0.06] md:hover:bg-white/[0.06]"
                    : "active:bg-black/[0.04] md:hover:bg-black/[0.04]"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${g.color}`}
                  />
                  <span className="truncate">{g.label}</span>
                </span>
                <CheckBox on={on} isDark={isDark} />
              </button>
            </li>
          );
        })}
      </ul>
      <div
        className={`mt-1 border-t p-1 pt-2 ${
          isDark ? "border-white/[0.07]" : "border-black/[0.06]"
        }`}
      >
        <CreateNameInput
          onCreate={onCreate}
          isDark={isDark}
          placeholder={c.groupsMenu.createPlaceholder}
          submitAria={c.groupsMenu.createAria}
        />
      </div>
    </>
  );
}

/** Menu « Groupes » de la barre d'outils : affiche / masque les colonnes. */
function GroupsMenu({
  groups,
  hidden,
  onToggle,
  onCreate,
  isDark,
  isMobile,
  ghost,
  c,
}: {
  groups: Group[];
  hidden: string[];
  onToggle: (id: string) => void;
  onCreate: (label: string) => void;
  isDark: boolean;
  isMobile: boolean;
  ghost: string;
  c: Copy;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-haspopup={isMobile ? "dialog" : "listbox"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 md:min-h-0 ${ghost} ${
          isDark ? "focus-visible:ring-white/30" : "focus-visible:ring-black/25"
        }`}
      >
        <BoardIcon className="h-4 w-4" />
        {c.groupsMenu.label}
        {hidden.length > 0 && (
          <span
            className={`rounded-full px-1.5 text-[11px] tabular-nums ${
              isDark ? "bg-white text-black" : "bg-black text-white"
            }`}
          >
            {groups.length - hidden.length}/{groups.length}
          </span>
        )}
        <ChevronDownIcon className="h-4 w-4 opacity-60" />
      </button>

      {open && isMobile && (
        <BottomSheet
          isDark={isDark}
          title={c.groupsMenu.label}
          onClose={() => setOpen(false)}
        >
          {() => (
            <GroupsPanel
              groups={groups}
              hidden={hidden}
              onToggle={onToggle}
              onCreate={onCreate}
              isDark={isDark}
              c={c}
            />
          )}
        </BottomSheet>
      )}

      {open && !isMobile && (
        <>
          <button
            type="button"
            aria-label={c.groupsMenu.closeMenu}
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className={dropdownClass(isDark, "w-[240px]")}>
            <GroupsPanel
              groups={groups}
              hidden={hidden}
              onToggle={onToggle}
              onCreate={onCreate}
              isDark={isDark}
              c={c}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** Contenu du menu « Tags » (partagé dropdown desktop / feuille mobile). */
function TagsPanel({
  tags,
  active,
  onToggle,
  onCreate,
  onDelete,
  isDark,
  c,
}: {
  tags: Tag[];
  active: string[];
  onToggle: (id: string) => void;
  onCreate: (label: string) => void;
  onDelete: (id: string) => void;
  isDark: boolean;
  c: Copy;
}) {
  return (
    <>
      {tags.length === 0 ? (
        <p
          className={`px-3 py-3 text-[14px] md:text-[13px] ${
            isDark ? "text-neutral-500" : "text-neutral-400"
          }`}
        >
          {c.tagsMenu.empty}
        </p>
      ) : (
        <ul className="max-h-[320px] overflow-y-auto md:max-h-[260px]">
          {tags.map((t) => {
            const on = active.includes(t.id);
            return (
              <li key={t.id} className="group/tag flex items-center">
                <button
                  type="button"
                  onClick={() => onToggle(t.id)}
                  className={`flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-medium transition-colors md:min-h-0 md:rounded-lg md:text-[13px] ${
                    isDark
                      ? "active:bg-white/[0.06] md:hover:bg-white/[0.06]"
                      : "active:bg-black/[0.04] md:hover:bg-black/[0.04]"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.color}`}
                    />
                    <span className="truncate">{t.label}</span>
                  </span>
                  <CheckBox on={on} isDark={isDark} />
                </button>
                <button
                  type="button"
                  aria-label={c.tagsMenu.deleteTag}
                  onClick={() => onDelete(t.id)}
                  className={`ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-opacity focus-visible:opacity-100 md:h-7 md:w-7 md:rounded-lg md:opacity-0 md:group-hover/tag:opacity-100 [@media(hover:none)]:opacity-100 ${
                    isDark
                      ? "text-rose-400 hover:bg-white/[0.06]"
                      : "text-rose-600 hover:bg-black/[0.04]"
                  }`}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div
        className={`mt-1 border-t p-1 pt-2 ${
          isDark ? "border-white/[0.07]" : "border-black/[0.06]"
        }`}
      >
        <CreateNameInput
          onCreate={onCreate}
          isDark={isDark}
          placeholder={c.tagsMenu.createPlaceholder}
          submitAria={c.tagsMenu.createAria}
        />
      </div>
    </>
  );
}

/** Menu « Tags » : filtre les idées par tag, crée / supprime des tags. */
function TagsMenu({
  tags,
  active,
  onToggle,
  onCreate,
  onDelete,
  isDark,
  isMobile,
  ghost,
  c,
}: {
  tags: Tag[];
  active: string[];
  onToggle: (id: string) => void;
  onCreate: (label: string) => void;
  onDelete: (id: string) => void;
  isDark: boolean;
  isMobile: boolean;
  ghost: string;
  c: Copy;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-haspopup={isMobile ? "dialog" : "listbox"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 md:min-h-0 ${ghost} ${
          isDark ? "focus-visible:ring-white/30" : "focus-visible:ring-black/25"
        }`}
      >
        <TagIcon className="h-4 w-4" />
        {c.tagsMenu.label}
        {active.length > 0 && (
          <span
            className={`rounded-full px-1.5 text-[11px] tabular-nums ${
              isDark ? "bg-white text-black" : "bg-black text-white"
            }`}
          >
            {active.length}
          </span>
        )}
        <ChevronDownIcon className="h-4 w-4 opacity-60" />
      </button>

      {open && isMobile && (
        <BottomSheet
          isDark={isDark}
          title={c.tagsMenu.label}
          onClose={() => setOpen(false)}
        >
          {() => (
            <TagsPanel
              tags={tags}
              active={active}
              onToggle={onToggle}
              onCreate={onCreate}
              onDelete={onDelete}
              isDark={isDark}
              c={c}
            />
          )}
        </BottomSheet>
      )}

      {open && !isMobile && (
        <>
          <button
            type="button"
            aria-label={c.tagsMenu.closeMenu}
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className={dropdownClass(isDark, "w-[260px]")}>
            <TagsPanel
              tags={tags}
              active={active}
              onToggle={onToggle}
              onCreate={onCreate}
              onDelete={onDelete}
              isDark={isDark}
              c={c}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** Contenu du menu d'une idée : déplacer / tags / supprimer. */
function IdeaMenuItems({
  idea,
  ideaTags,
  allTags,
  moveGroups,
  onToggleTag,
  onMove,
  onDelete,
  dismiss,
  delayed,
  isDark,
  muted,
  c,
}: {
  idea: Idea;
  ideaTags: Tag[];
  allTags: Tag[];
  moveGroups?: Group[];
  onToggleTag?: (tagId: string) => void;
  onMove?: (groupId: string) => void;
  onDelete?: () => void;
  /** Ferme le menu (dropdown : immédiat ; feuille : animé). */
  dismiss: () => void;
  /** Feuille : l'action part après l'animation de fermeture. */
  delayed: boolean;
  isDark: boolean;
  muted: string;
  c: Copy;
}) {
  const run = (fn: () => void) => {
    dismiss();
    if (delayed) window.setTimeout(fn, SHEET_ACTION_DELAY);
    else fn();
  };

  const item = `flex min-h-12 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[15px] font-medium transition-colors md:min-h-0 md:rounded-lg md:text-[13px] ${
    isDark
      ? "active:bg-white/[0.06] md:hover:bg-white/[0.06]"
      : "active:bg-black/[0.04] md:hover:bg-black/[0.04]"
  }`;

  const sep = `my-1 border-t ${
    isDark ? "border-white/[0.07]" : "border-black/[0.06]"
  }`;

  const sectionLabel = `px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide ${muted}`;

  return (
    <>
      {onMove && moveGroups && moveGroups.length > 0 && (
        <>
          <p className={sectionLabel}>{c.ideaCard.moveTo}</p>
          {moveGroups.map((g) => {
            const current = g.id === idea.groupId;
            return (
              <button
                key={g.id}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                disabled={current}
                onClick={() => run(() => onMove(g.id))}
                className={`${item} justify-between disabled:opacity-50`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${g.color}`}
                  />
                  <span className="truncate">{g.label}</span>
                </span>
                {current && <span className="text-[12px]">✓</span>}
              </button>
            );
          })}
          {(onToggleTag || onDelete) && <div className={sep} />}
        </>
      )}

      {onToggleTag && (
        <>
          <p className={sectionLabel}>{c.ideaCard.tags}</p>
          {allTags.length === 0 ? (
            <p className={`px-3 pb-2 text-[13px] md:text-[12px] ${muted}`}>
              {c.ideaCard.noTags}
            </p>
          ) : (
            allTags.map((t) => {
              const on = ideaTags.some((x) => x.id === t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => onToggleTag(t.id)}
                  className={`${item} justify-between`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.color}`}
                    />
                    <span className="truncate">{t.label}</span>
                  </span>
                  <CheckBox on={on} isDark={isDark} />
                </button>
              );
            })
          )}
          {onDelete && <div className={sep} />}
        </>
      )}

      {onDelete && (
        <button
          type="button"
          role="menuitem"
          onClick={() => run(onDelete)}
          className={`${item} ${isDark ? "text-rose-400" : "text-rose-600"}`}
        >
          <TrashIcon className="h-4 w-4" />
          {c.ideaCard.delete}
        </button>
      )}
    </>
  );
}

/** Carte d'idée (board desktop : déplaçable aux pointer events ; mobile / galerie : statique). */
function IdeaCard({
  idea,
  groupLabel,
  groupColor,
  ideaTags,
  allTags,
  moveGroups,
  isDark,
  isMobile,
  muted,
  draggable,
  placeholder,
  onPointerDown,
  onDelete,
  onToggleTag,
  onMove,
  c,
}: {
  idea: Idea;
  /** Affichés en galerie uniquement (en board, la colonne = le groupe). */
  groupLabel?: string;
  groupColor?: string;
  /** Tags de CETTE idée. */
  ideaTags: Tag[];
  /** Tous les tags existants (sous-menu d'assignation). */
  allTags: Tag[];
  /** Groupes disponibles pour « Déplacer vers » (au doigt, sans drag). */
  moveGroups?: Group[];
  isDark: boolean;
  isMobile: boolean;
  muted: string;
  draggable?: boolean;
  placeholder?: boolean;
  onPointerDown?: (e: RPointerEvent) => void;
  onDelete?: () => void;
  onToggleTag?: (tagId: string) => void;
  onMove?: (groupId: string) => void;
  c: Copy;
}) {
  const [menu, setMenu] = useState(false);
  const hasMenu = !!onDelete || !!onToggleTag || !!onMove;

  const chipClass = `inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${
    isDark ? "bg-white/[0.06]" : "bg-black/[0.05]"
  }`;

  const menuItems = (dismiss: () => void, delayed: boolean) => (
    <IdeaMenuItems
      idea={idea}
      ideaTags={ideaTags}
      allTags={allTags}
      moveGroups={moveGroups}
      onToggleTag={onToggleTag}
      onMove={onMove}
      onDelete={onDelete}
      dismiss={dismiss}
      delayed={delayed}
      isDark={isDark}
      muted={muted}
      c={c}
    />
  );

  return (
    <div
      data-card={draggable ? idea.id : undefined}
      onPointerDown={onPointerDown}
      className={`group/card relative rounded-xl ${menu ? "z-20" : ""} ${
        draggable
          ? "cursor-grab select-none active:cursor-grabbing md:touch-none"
          : ""
      } ${
        placeholder
          ? `${
              isDark ? "bg-white/[0.06]" : "bg-black/[0.05]"
            } [&>*]:invisible`
          : ""
      }`}
    >
      <article
        onDragStart={(e) => e.preventDefault()}
        className={`rounded-xl border transition-colors ${
          isDark
            ? "border-white/[0.07] bg-[#0f0f11] hover:border-white/[0.12]"
            : "border-black/[0.06] bg-white hover:border-black/[0.12]"
        }`}
      >
        {idea.imageUrl && (
          <img
            src={idea.imageUrl}
            alt=""
            className="h-[150px] w-full rounded-t-[11px] object-cover"
            draggable={false}
          />
        )}
        <div className="flex flex-col gap-1 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em] md:text-[14px]">
              {idea.title}
            </h3>

            {hasMenu && (
              <div className="relative -my-1.5 -mr-2 shrink-0">
                <button
                  type="button"
                  aria-label={c.ideaCard.options}
                  aria-haspopup={isMobile ? "dialog" : "menu"}
                  aria-expanded={menu}
                  onClick={() => setMenu((v) => !v)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-[opacity,background-color] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 md:h-7 md:w-7 md:rounded-lg md:group-hover/card:opacity-100 [@media(hover:none)]:opacity-100 ${
                    menu ? "opacity-100" : "max-md:opacity-100 md:opacity-0"
                  } ${
                    isDark
                      ? "hover:bg-white/[0.06] focus-visible:ring-white/30"
                      : "hover:bg-black/[0.05] focus-visible:ring-black/25"
                  }`}
                >
                  <DotsIcon className="h-[18px] w-[18px]" />
                </button>

                {menu && isMobile && (
                  <BottomSheet
                    isDark={isDark}
                    title={idea.title}
                    onClose={() => setMenu(false)}
                  >
                    {(close) => (
                      <div className="flex flex-col gap-0.5">
                        {menuItems(close, true)}
                      </div>
                    )}
                  </BottomSheet>
                )}

                {menu && !isMobile && (
                  <>
                    <button
                      type="button"
                      aria-label={c.ideaCard.closeMenu}
                      tabIndex={-1}
                      className="fixed inset-0 z-30 cursor-default"
                      onClick={() => setMenu(false)}
                    />
                    <div
                      role="menu"
                      onPointerDown={(e) => e.stopPropagation()}
                      className={`absolute right-0 top-full z-40 mt-1 min-w-[190px] rounded-xl border p-1 shadow-lg ${
                        isDark
                          ? "border-white/[0.08] bg-[#101012]"
                          : "border-black/[0.06] bg-white"
                      }`}
                    >
                      {menuItems(() => setMenu(false), false)}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {idea.description && (
            <p className={`line-clamp-2 text-[14px] md:text-[13px] ${muted}`}>
              {idea.description}
            </p>
          )}

          {(groupLabel || ideaTags.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {groupLabel && (
                <span className={chipClass}>
                  {groupColor && (
                    <span className={`h-2 w-2 rounded-full ${groupColor}`} />
                  )}
                  {groupLabel}
                </span>
              )}
              {ideaTags.map((t) => (
                <span key={t.id} className={chipClass}>
                  <span className={`h-2 w-2 rounded-full ${t.color}`} />
                  {t.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

/** Corps de la feuille « Options du groupe » (mobile) : renommer / tout déplacer / supprimer. */
function GroupActionsBody({
  group,
  isDark,
  close,
  onRename,
  onMoveAll,
  onDelete,
  c,
}: {
  group: Group;
  isDark: boolean;
  close: () => void;
  onRename: (label: string) => void;
  onMoveAll: () => void;
  onDelete: () => void;
  c: Copy;
}) {
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(group.label);

  const later = (fn: () => void) => {
    close();
    window.setTimeout(fn, SHEET_ACTION_DELAY);
  };

  const submit = () => {
    const label = value.trim();
    if (!label) return;
    later(() => onRename(label));
  };

  if (renaming) {
    return (
      <div className="flex flex-col gap-3 pt-1">
        <input
          autoFocus
          value={value}
          maxLength={30}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={c.board.groupNamePlaceholder}
          // 16px : évite le zoom automatique d'iOS
          className={`w-full rounded-xl border bg-transparent px-3 py-3 text-[16px] outline-none ${
            isDark
              ? "border-white/[0.14] placeholder:text-neutral-600"
              : "border-black/[0.12] placeholder:text-neutral-400"
          }`}
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRenaming(false)}
            className={`min-h-12 rounded-2xl border text-[15px] font-medium ${
              isDark
                ? "border-white/[0.12] text-white active:bg-white/[0.06]"
                : "border-black/[0.10] text-neutral-900 active:bg-black/[0.04]"
            }`}
          >
            {c.board.cancel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            className={`min-h-12 rounded-2xl text-[15px] font-semibold transition-opacity disabled:opacity-40 ${
              isDark ? "bg-white text-black" : "bg-neutral-900 text-white"
            }`}
          >
            {c.board.save}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 pt-1">
      <button
        type="button"
        onClick={() => setRenaming(true)}
        className={sheetRowClass(isDark)}
      >
        <PencilIcon className="h-[18px] w-[18px]" />
        {c.board.renameGroup}
      </button>
      <button
        type="button"
        onClick={() => later(onMoveAll)}
        className={sheetRowClass(isDark)}
      >
        <MoveIcon className="h-[18px] w-[18px]" />
        {c.board.moveAllToUnassigned}
      </button>
      <button
        type="button"
        onClick={() => later(onDelete)}
        className={sheetRowClass(isDark, true)}
      >
        <TrashIcon className="h-[18px] w-[18px]" />
        {c.board.deleteGroup}
      </button>
    </div>
  );
}

/* ───────── Page ───────── */

function styleGhost(
  el: HTMLElement,
  rect: DOMRect,
  isDark: boolean,
  bg: string | null,
  radius: string
) {
  Object.assign(el.style, {
    position: "fixed",
    margin: "0",
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: "200",
    pointerEvents: "none",
    transition: "none",
    transform: "rotate(2deg)",
    transformOrigin: "50% 0",
    opacity: "1",
    borderRadius: radius,
    boxShadow: isDark
      ? "0 18px 40px rgba(0,0,0,0.7)"
      : "0 18px 40px rgba(0,0,0,0.18)",
    ...(bg ? { background: bg } : {}),
  } as Partial<CSSStyleDeclaration>);
}

export default function Create() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const sidebarOffset = useSidebarOffset();
  const isMobile = useIsMobile();

  const lang = useLanguage();
  const c = COPY[lang];

  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const saved = isFavorite(PAGE_ROUTE);

  const {
    groups,
    tags,
    status,
    ideas,
    addGroup,
    renameGroup,
    deleteGroup,
    moveGroup,
    addTag,
    deleteTag,
    addIdea,
    deleteIdea,
    moveIdea,
    moveAll,
    toggleIdeaTag,
  } = useBoard();

  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [view, setView] = useState<View>(readStoredView);
  const [hiddenGroups, setHiddenGroups] = useState<string[]>(
    readStoredHiddenGroups
  );
  /** Filtre par tags (vide = pas de filtre). Non persisté. */
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [isFolderOpen, setIsFolderOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(CREATE_VIEW_STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  useEffect(() => {
    writeStoredIds(CREATE_HIDDEN_GROUPS_STORAGE_KEY, hiddenGroups);
  }, [hiddenGroups]);

  /* ── Desktop : drag & drop ── */
  const [colDrag, setColDrag] = useState<string | null>(null);
  const [cardDrag, setCardDrag] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef(new Map<string, HTMLElement>());
  const prevLefts = useRef(new Map<string, number>());
  const prevCards = useRef(new Map<string, { y: number; col: string }>());
  const visibleRef = useRef<Group[]>([]);

  const [colMenu, setColMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [addingCol, setAddingCol] = useState(false);

  /* ── Mobile : groupe affiché, feuilles ── */
  const [mobileGroupId, setMobileGroupId] = useState<string | null>(null);
  const [groupSheetId, setGroupSheetId] = useState<string | null>(null);
  const [newGroupSheet, setNewGroupSheet] = useState(false);
  const chipsRef = useRef<HTMLDivElement>(null);
  const mobileListRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  /* ───────── Onglet ↔ URL ───────── */

  const selectTab = (next: Tab) => {
    setTab(next);
    writeTabToHash(next);
  };

  useEffect(() => {
    const onHash = () => {
      if (/create(\/|$)/.test(window.location.hash)) {
        const next = tabFromHash();
        setTab(next);
        if (/create\/feeds(?:$|[?#])/.test(window.location.hash)) {
          writeTabToHash(next);
        }
      }
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  /* ───────── Shell tokens ───────── */

  const page = isDark ? "bg-[#050505]" : "bg-[#f5f3ef]";
  const panel = isDark
    ? "border-white/[0.07] bg-[#0a0a0c]"
    : "border-black/[0.06] bg-white";
  const line = isDark ? "border-white/[0.07]" : "border-black/[0.06]";
  const muted = isDark ? "text-neutral-500" : "text-neutral-400";
  const ghost = isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]";
  const ring = isDark
    ? "focus-visible:ring-white/30"
    : "focus-visible:ring-black/25";
  const column = isDark ? "bg-white/[0.025]" : "bg-[#f6f4f0]";
  const chip = isDark ? "bg-white/[0.06]" : "bg-black/[0.05]";
  const strong = isDark ? "text-white" : "text-neutral-900";

  /* ───────── Dérivés groupes / tags ───────── */

  const visibleGroups = groups.filter((g) => !hiddenGroups.includes(g.id));
  visibleRef.current = visibleGroups;

  const groupLabel = (id: string) => groups.find((g) => g.id === id)?.label;
  const groupColor = (id: string) => groups.find((g) => g.id === id)?.color;
  const tagsOf = (idea: Idea): Tag[] =>
    idea.tagIds
      .map((id) => tags.find((t) => t.id === id))
      .filter((t): t is Tag => Boolean(t));

  /** Filtre par tags : l'idée doit avoir au moins un des tags actifs. */
  const matchesTagFilter = (idea: Idea) =>
    activeTags.length === 0 || idea.tagIds.some((id) => activeTags.includes(id));

  const toggleHiddenGroup = (id: string) =>
    setHiddenGroups((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleActiveTag = (id: string) =>
    setActiveTags((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const createGroup = async (label: string) => {
    const id = await addGroup(label);
    if (id) setHiddenGroups((prev) => prev.filter((x) => x !== id));
    return id;
  };

  const removeTag = async (id: string) => {
    setActiveTags((prev) => prev.filter((x) => x !== id));
    await deleteTag(id);
  };

  /** Groupe affiché sur mobile : celui choisi, sinon le premier visible. */
  const activeGroup =
    visibleGroups.find((g) => g.id === mobileGroupId) ?? visibleGroups[0];
  const activeGroupIdeas = activeGroup
    ? ideas.filter((i) => i.groupId === activeGroup.id && matchesTagFilter(i))
    : [];
  const sheetGroup = groupSheetId
    ? (groups.find((g) => g.id === groupSheetId) ?? null)
    : null;

  /** Change de groupe (chips ou swipe) avec une petite animation de glissement. */
  const selectMobileGroup = (id: string, dir: 1 | -1 = 1) => {
    if (id === activeGroup?.id) return;
    const el = mobileListRef.current;
    if (el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.animate(
        [
          { transform: `translateX(${dir * 28}px)`, opacity: 0.35 },
          { transform: "translateX(0)", opacity: 1 },
        ],
        { duration: 240, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }
      );
    }
    setMobileGroupId(id);
  };

  const stepMobileGroup = (dir: 1 | -1) => {
    if (!activeGroup) return;
    const i = visibleGroups.findIndex((g) => g.id === activeGroup.id);
    const next = visibleGroups[i + dir];
    if (next) selectMobileGroup(next.id, dir);
  };

  const onSwipeStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY };
  };

  const onSwipeEnd = (e: React.TouchEvent) => {
    const s0 = swipeStart.current;
    swipeStart.current = null;
    if (!s0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s0.x;
    const dy = t.clientY - s0.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    stepMobileGroup(dx < 0 ? 1 : -1);
  };

  /** Garde la pastille du groupe actif visible dans la rangée scrollable. */
  useEffect(() => {
    if (!isMobile || !activeGroup) return;
    const el = chipsRef.current?.querySelector<HTMLElement>(
      `[data-chip="${CSS.escape(activeGroup.id)}"]`
    );
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [isMobile, activeGroup?.id]);

  /* ── Drag d'une colonne (groupe) — desktop ── */

  const onHeaderPointerDown = (e: RPointerEvent, groupId: string) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button,input")) return;
    const section = colRefs.current.get(groupId);
    if (!section) return;

    const rect = section.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const offX = e.clientX - rect.left;
    const offY = e.clientY - rect.top;
    let ghostEl: HTMLElement | null = null;

    const onMove = (ev: PointerEvent) => {
      if (!ghostEl) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;

        ghostEl = section.cloneNode(true) as HTMLElement;
        styleGhost(
          ghostEl,
          rect,
          isDark,
          isDark ? "#0f0f11" : "#f6f4f0",
          "16px"
        );
        ghostEl.style.color = getComputedStyle(section).color;
        const grip = ghostEl.querySelector<HTMLElement>("[data-grip]");
        if (grip) grip.style.opacity = "1";
        document.body.appendChild(ghostEl);
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        setColDrag(groupId);
      }

      ghostEl.style.left = `${ev.clientX - offX}px`;
      ghostEl.style.top = `${ev.clientY - offY}px`;

      const board = boardRef.current;
      if (!board) return;
      const b = board.getBoundingClientRect();

      if (ev.clientX > b.right - 60) board.scrollLeft += 14;
      else if (ev.clientX < b.left + 60) board.scrollLeft -= 14;

      const x = ev.clientX - b.left + board.scrollLeft;
      const order = visibleRef.current;
      const from = order.findIndex((g) => g.id === groupId);
      let target: number | null = null;
      for (let i = 1; i < order.length; i++) {
        if (i === from) continue;
        const el = colRefs.current.get(order[i].id);
        if (!el) continue;
        const mid = el.offsetLeft + el.offsetWidth / 2;
        if (i > from && x > mid) target = i;
        else if (i < from && x < mid && target === null) target = i;
      }
      if (target !== null) moveGroup(groupId, order[target].id);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      ghostEl?.remove();
      ghostEl = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setColDrag(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  /* ── Drag d'une carte — desktop ── */

  const onCardPointerDown = (e: RPointerEvent, ideaId: string) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    const wrapper = e.currentTarget as HTMLElement;

    const rect = wrapper.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const offX = e.clientX - rect.left;
    const offY = e.clientY - rect.top;
    let ghostEl: HTMLElement | null = null;
    let last = "";

    const onMove = (ev: PointerEvent) => {
      if (!ghostEl) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;

        ghostEl = wrapper.cloneNode(true) as HTMLElement;
        ghostEl.removeAttribute("data-card");
        styleGhost(ghostEl, rect, isDark, null, "12px");
        ghostEl.style.color = getComputedStyle(wrapper).color;
        document.body.appendChild(ghostEl);
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        setCardDrag(ideaId);
      }

      ghostEl.style.left = `${ev.clientX - offX}px`;
      ghostEl.style.top = `${ev.clientY - offY}px`;

      const board = boardRef.current;
      if (!board) return;
      const b = board.getBoundingClientRect();

      if (ev.clientX > b.right - 60) board.scrollLeft += 14;
      else if (ev.clientX < b.left + 60) board.scrollLeft -= 14;

      let section: HTMLElement | null = null;
      for (const s of Array.from(
        board.querySelectorAll<HTMLElement>("[data-col]")
      )) {
        const r = s.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right) {
          section = s;
          break;
        }
      }
      if (!section) return;
      const groupId = section.dataset.col as string;
      setOverCol(groupId);

      const list = section.querySelector<HTMLElement>("[data-list]");
      if (!list) return;
      const lr = list.getBoundingClientRect();

      if (ev.clientY > lr.bottom - 50) list.scrollTop += 12;
      else if (ev.clientY < lr.top + 50) list.scrollTop -= 12;

      const y = ev.clientY - lr.top + list.scrollTop;
      let before: string | undefined;
      for (const el of Array.from(
        list.querySelectorAll<HTMLElement>("[data-card]")
      )) {
        if (el.dataset.card === ideaId) continue;
        if (y < el.offsetTop + el.offsetHeight / 2) {
          before = el.dataset.card;
          break;
        }
      }

      const key = `${groupId}:${before ?? ""}`;
      if (key !== last) {
        last = key;
        moveIdea(ideaId, groupId, before);
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      ghostEl?.remove();
      ghostEl = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setCardDrag(null);
      setOverCol(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  /** FLIP : anime les colonnes et les cartes qui changent de place (desktop). */
  useLayoutEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const play = (el: HTMLElement, from: string) => {
      if (reduce) return;
      el.style.transition = "none";
      el.style.transform = from;
      el.getBoundingClientRect();
      el.style.transition =
        "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)";
      el.style.transform = "";
      el.addEventListener(
        "transitionend",
        () => (el.style.transition = ""),
        { once: true }
      );
    };

    const nextLefts = new Map<string, number>();
    colRefs.current.forEach((el, id) => {
      const left = el.offsetLeft;
      nextLefts.set(id, left);
      const prev = prevLefts.current.get(id);
      if (prev !== undefined && prev !== left)
        play(el, `translateX(${prev - left}px)`);
    });
    prevLefts.current = nextLefts;

    const nextCards = new Map<string, { y: number; col: string }>();
    boardRef.current
      ?.querySelectorAll<HTMLElement>("[data-card]")
      .forEach((el) => {
        const id = el.dataset.card as string;
        const col =
          el.closest<HTMLElement>("[data-col]")?.dataset.col ?? "";
        const y = el.offsetTop;
        nextCards.set(id, { y, col });
        const prev = prevCards.current.get(id);
        if (prev && prev.col === col && prev.y !== y)
          play(el, `translateY(${prev.y - y}px)`);
      });
    prevCards.current = nextCards;
  });

  /* ───────── Idées visibles (galerie) ───────── */

  const searchTerm = query.trim().toLowerCase();
  const visibleIdeas = ideas.filter((idea) => {
    if (hiddenGroups.includes(idea.groupId)) return false;
    if (!matchesTagFilter(idea)) return false;
    if (!searchTerm) return true;

    return [
      idea.title,
      idea.description,
      groupLabel(idea.groupId) ?? "",
      ...tagsOf(idea).map((t) => t.label),
    ].some((value) => value.toLowerCase().includes(searchTerm));
  });

  const handleBottomBarChange = (id: BottomBarTab) => {
    if (id === "add") return;
    setIsFolderOpen((open) => !open);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "ideas", label: c.tabs.ideas },
    { key: "templates", label: c.tabs.templates },
  ];

  const viewOptions: { key: View; label: string; icon: ReactNode }[] = [
    { key: "board", label: c.view.board, icon: <BoardIcon className="h-4 w-4" /> },
    {
      key: "gallery",
      label: c.view.gallery,
      icon: <GalleryIcon className="h-4 w-4" />,
    },
  ];

  const boardLoading = status === "idle" || status === "loading";

  return (
    <main
      className={[
        "relative h-[100dvh] w-full overflow-hidden overscroll-none",
        "transition-colors duration-300",
        page,
      ].join(" ")}
    >
      <DashboardSidebar theme={theme} />

      <div
        className={[
          "h-full min-h-0 px-2 py-2 md:py-3 md:pl-0 md:pr-3",
          "max-md:pt-[calc(3.5rem+env(safe-area-inset-top))]",
          "transition-[padding-left] duration-[380ms]",
          "ease-[cubic-bezier(0.4,0,0.2,1)]",
          "motion-reduce:transition-none",
        ].join(" ")}
        // Sur mobile la sidebar est un tiroir : aucun décalage à gauche.
        style={isMobile ? undefined : { paddingLeft: sidebarOffset }}
      >
        <div
          className={[
            "flex h-full min-h-0 flex-col overflow-hidden",
            "rounded-2xl border md:rounded-[28px]",
            "transition-colors duration-300",
            panel,
          ].join(" ")}
        >
          <div
            className={[
              "flex min-h-0 w-full flex-1 flex-col",
              "px-[clamp(14px,3vw,48px)]",
              // pb : place pour la BottomBar flottante sur mobile
              "pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[clamp(16px,3vw,30px)] md:pb-6",
            ].join(" ")}
          >
            {/* HEADER */}
            <div className="flex shrink-0 items-center justify-between gap-3 pb-3 md:pb-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border md:h-9 md:w-9",
                    isDark
                      ? "border-white/[0.07] bg-white/[0.04] text-neutral-400"
                      : "border-black/[0.06] bg-white text-neutral-500",
                  ].join(" ")}
                >
                  <BulbIcon />
                </span>
                <h1
                  className={[
                    "truncate text-[24px] font-semibold tracking-[-0.03em] md:text-[20px]",
                    strong,
                  ].join(" ")}
                >
                  {c.pageTitle}
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-1 md:gap-2">
                <IconButton
                  label={
                    saved ? c.header.removeFavorite : c.header.addFavorite
                  }
                  onClick={() => toggleFavorite(PAGE_ROUTE)}
                  ghost={ghost}
                  isDark={isDark}
                  align="end"
                >
                  <BookmarkIcon className="h-5 w-5" filled={saved} />
                </IconButton>
                <IconButton
                  label={c.header.autoReplies}
                  ghost={ghost}
                  isDark={isDark}
                  align="end"
                >
                  <ChatHeartIcon className="h-5 w-5" />
                </IconButton>
              </div>
            </div>

            {/* Tabs + toolbar : la toolbar passe sous les onglets sur mobile */}
            <div
              className={[
                "flex shrink-0 flex-wrap items-center justify-between gap-x-4 border-b",
                line,
              ].join(" ")}
            >
              <div
                role="tablist"
                aria-label={c.tabs.ariaLabel}
                className="flex gap-6"
              >
                {tabs.map((tb) => (
                  <button
                    key={tb.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === tb.key}
                    onClick={() => selectTab(tb.key)}
                    className={[
                      "-mb-px min-h-10 border-b-2 px-1 pb-3 pt-2 text-[15px] font-medium transition-colors motion-reduce:transition-none md:min-h-0 md:text-[14px]",
                      "focus-visible:outline-none focus-visible:ring-2",
                      ring,
                      tab === tb.key
                        ? isDark
                          ? "border-white text-white"
                          : "border-neutral-900 text-neutral-900"
                        : `border-transparent ${muted} ${
                            isDark
                              ? "hover:text-white"
                              : "hover:text-neutral-900"
                          }`,
                    ].join(" ")}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>

              {tab === "ideas" && (
                <div
                  className={[
                    "flex items-center gap-2 pb-2",
                    // mobile : rangée pleine largeur, scrollable, sans scrollbar
                    "max-md:order-last max-md:w-[calc(100%+2*clamp(14px,3vw,48px))] max-md:overflow-x-auto max-md:pt-1",
                    "max-md:-mx-[clamp(14px,3vw,48px)] max-md:px-[clamp(14px,3vw,48px)]",
                    HIDE_SCROLLBAR,
                  ].join(" ")}
                >
                  <GroupsMenu
                    groups={groups}
                    hidden={hiddenGroups}
                    onToggle={toggleHiddenGroup}
                    onCreate={(l) => void createGroup(l)}
                    isDark={isDark}
                    isMobile={isMobile}
                    ghost={ghost}
                    c={c}
                  />
                  <TagsMenu
                    tags={tags}
                    active={activeTags}
                    onToggle={toggleActiveTag}
                    onCreate={(l) => void addTag(l)}
                    onDelete={(id) => void removeTag(id)}
                    isDark={isDark}
                    isMobile={isMobile}
                    ghost={ghost}
                    c={c}
                  />
                  <div
                    role="tablist"
                    aria-label={c.view.ariaLabel}
                    className={[
                      "inline-flex shrink-0 gap-1 rounded-xl border p-1 max-md:ml-auto",
                      line,
                    ].join(" ")}
                  >
                    {viewOptions.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        role="tab"
                        aria-selected={view === o.key}
                        aria-label={o.label}
                        title={o.label}
                        onClick={() => setView(o.key)}
                        className={[
                          "flex min-h-9 items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors motion-reduce:transition-none md:min-h-0",
                          "focus-visible:outline-none focus-visible:ring-2",
                          ring,
                          view === o.key
                            ? isDark
                              ? "bg-white text-black"
                              : "bg-neutral-900 text-white"
                            : isDark
                              ? "text-neutral-400 hover:text-white"
                              : "text-neutral-500 hover:text-neutral-900",
                        ].join(" ")}
                      >
                        {o.icon}
                        <span className="max-md:sr-only">{o.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1 flex-col pt-3 md:pt-5">
              {/* Templates */}
              {tab === "templates" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <h2
                    className={[
                      "text-[20px] font-semibold tracking-[-0.02em]",
                      strong,
                    ].join(" ")}
                  >
                    {c.templatesEmpty.title}
                  </h2>
                  <p
                    className={[
                      "max-w-[380px] text-[14px] leading-relaxed md:text-[13px]",
                      muted,
                    ].join(" ")}
                  >
                    {c.templatesEmpty.description}
                  </p>
                </div>
              )}

              {/* Board : chargement (skeleton) */}
              {tab === "ideas" && view === "board" && boardLoading && (
                <>
                  {isMobile ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                      <div className="flex gap-2">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className={`h-10 w-24 shrink-0 animate-pulse rounded-full motion-reduce:animate-none ${column}`}
                          />
                        ))}
                      </div>
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={`h-[96px] w-full shrink-0 animate-pulse rounded-xl motion-reduce:animate-none ${column}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={`h-[220px] w-[300px] shrink-0 animate-pulse rounded-2xl motion-reduce:animate-none ${column}`}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Board : erreur de chargement */}
              {tab === "ideas" && view === "board" && status === "error" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                  <p className={["text-[14px] md:text-[13px]", muted].join(" ")}>
                    {c.board.loadError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadBoardMeta()}
                    className={[
                      "min-h-11 rounded-xl border px-5 py-2 text-[14px] font-medium transition-colors md:min-h-0 md:px-4 md:text-[13px]",
                      "focus-visible:outline-none focus-visible:ring-2",
                      ring,
                      line,
                      ghost,
                    ].join(" ")}
                  >
                    {c.board.retry}
                  </button>
                </div>
              )}

              {/* ───────── Board MOBILE : onglets de groupes + liste verticale ───────── */}
              {tab === "ideas" &&
                view === "board" &&
                status === "ready" &&
                isMobile && (
                  <div className="flex min-h-0 flex-1 flex-col">
                    {visibleGroups.length === 0 || !activeGroup ? (
                      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
                        <p
                          className={`max-w-[300px] text-[14px] leading-relaxed ${muted}`}
                        >
                          {c.board.noGroups}
                        </p>
                        <button
                          type="button"
                          onClick={() => setNewGroupSheet(true)}
                          className={[
                            "flex min-h-11 items-center gap-2 rounded-xl border border-dashed px-5 text-[14px] font-medium",
                            isDark
                              ? "border-white/[0.14] text-neutral-300"
                              : "border-black/[0.10] text-neutral-600",
                          ].join(" ")}
                        >
                          <PlusIcon className="h-[18px] w-[18px]" />
                          {c.board.newGroup}
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Pastilles de groupes */}
                        <div
                          ref={chipsRef}
                          role="tablist"
                          aria-label={c.groupsMenu.label}
                          className={[
                            "flex shrink-0 gap-2 overflow-x-auto pb-3",
                            EDGE_BLEED,
                            HIDE_SCROLLBAR,
                          ].join(" ")}
                        >
                          {visibleGroups.map((g) => {
                            const count = ideas.filter(
                              (i) => i.groupId === g.id && matchesTagFilter(i)
                            ).length;
                            const active = g.id === activeGroup.id;
                            const index = visibleGroups.findIndex(
                              (x) => x.id === g.id
                            );
                            const current = visibleGroups.findIndex(
                              (x) => x.id === activeGroup.id
                            );
                            return (
                              <button
                                key={g.id}
                                type="button"
                                role="tab"
                                data-chip={g.id}
                                aria-selected={active}
                                onClick={() =>
                                  selectMobileGroup(g.id, index > current ? 1 : -1)
                                }
                                className={[
                                  "flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[14px] font-medium transition-colors",
                                  "focus-visible:outline-none focus-visible:ring-2",
                                  ring,
                                  active
                                    ? isDark
                                      ? "border-white bg-white text-black"
                                      : "border-neutral-900 bg-neutral-900 text-white"
                                    : isDark
                                      ? "border-white/[0.10] text-neutral-300 active:bg-white/[0.06]"
                                      : "border-black/[0.08] text-neutral-600 active:bg-black/[0.04]",
                                ].join(" ")}
                              >
                                <span
                                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${g.color}`}
                                />
                                <span className="max-w-[140px] truncate">
                                  {g.label}
                                </span>
                                <span
                                  className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                                    active
                                      ? isDark
                                        ? "bg-black/10 text-black"
                                        : "bg-white/20 text-white"
                                      : `${chip} ${muted}`
                                  }`}
                                >
                                  {count}
                                </span>
                              </button>
                            );
                          })}

                          <button
                            type="button"
                            aria-label={c.board.newGroup}
                            onClick={() => setNewGroupSheet(true)}
                            className={[
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed",
                              "focus-visible:outline-none focus-visible:ring-2",
                              ring,
                              isDark
                                ? "border-white/[0.18] text-neutral-300 active:bg-white/[0.06]"
                                : "border-black/[0.14] text-neutral-600 active:bg-black/[0.04]",
                            ].join(" ")}
                          >
                            <PlusIcon className="h-[18px] w-[18px]" />
                          </button>
                        </div>

                        {/* En-tête du groupe actif */}
                        <div className="flex shrink-0 items-center justify-between gap-2 pb-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <h2
                              className={`truncate text-[17px] font-semibold tracking-[-0.02em] ${strong}`}
                            >
                              {activeGroup.label}
                            </h2>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium tabular-nums ${chip} ${muted}`}
                            >
                              {activeGroupIdeas.length}
                            </span>
                          </div>
                          {activeGroup.id !== UNASSIGNED && (
                            <IconButton
                              label={c.board.groupOptions}
                              onClick={() => setGroupSheetId(activeGroup.id)}
                              ghost={ghost}
                              isDark={isDark}
                              className="h-10 w-10"
                              align="end"
                            >
                              <DotsIcon className="h-5 w-5" />
                            </IconButton>
                          )}
                        </div>

                        {/* Liste verticale — swipe gauche/droite pour changer de groupe */}
                        <div
                          ref={mobileListRef}
                          onTouchStart={onSwipeStart}
                          onTouchEnd={onSwipeEnd}
                          className={[
                            "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pb-2 [touch-action:pan-y]",
                            HIDE_SCROLLBAR,
                          ].join(" ")}
                        >
                          {activeGroupIdeas.length === 0 ? (
                            <div
                              className={`flex flex-1 items-center justify-center rounded-2xl px-6 py-12 text-center text-[14px] ${column} ${muted}`}
                            >
                              {c.board.emptyGroup}
                            </div>
                          ) : (
                            activeGroupIdeas.map((idea) => (
                              <IdeaCard
                                key={idea.id}
                                idea={idea}
                                ideaTags={tagsOf(idea)}
                                allTags={tags}
                                moveGroups={groups}
                                onToggleTag={(tid) =>
                                  toggleIdeaTag(idea.id, tid)
                                }
                                onMove={(gid) => moveIdea(idea.id, gid)}
                                onDelete={() => deleteIdea(idea.id)}
                                isDark={isDark}
                                isMobile
                                muted={muted}
                                c={c}
                              />
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

              {/* ───────── Board DESKTOP : colonnes libres + drag & drop ───────── */}
              {tab === "ideas" &&
                view === "board" &&
                status === "ready" &&
                !isMobile && (
                  <div
                    ref={boardRef}
                    className={[
                      "relative flex min-h-0 flex-1 gap-4 overflow-x-auto overscroll-x-contain pb-2",
                      HIDE_SCROLLBAR,
                    ].join(" ")}
                  >
                    {visibleGroups.map((group) => {
                      const items = ideas.filter(
                        (i) => i.groupId === group.id && matchesTagFilter(i)
                      );
                      const fixed = group.id === UNASSIGNED;
                      const isPlaceholder = colDrag === group.id;
                      const ideaTarget =
                        cardDrag !== null && overCol === group.id;

                      return (
                        <section
                          key={group.id}
                          data-col={group.id}
                          ref={(el) => {
                            if (el) colRefs.current.set(group.id, el);
                            else colRefs.current.delete(group.id);
                          }}
                          className={[
                            "group/col relative flex min-h-0 w-[300px] shrink-0 flex-col rounded-2xl p-3",
                            "transition-colors motion-reduce:transition-none",
                            isPlaceholder
                              ? `${
                                  isDark
                                    ? "bg-white/[0.06]"
                                    : "bg-black/[0.05]"
                                } [&>*]:invisible`
                              : ideaTarget
                                ? isDark
                                  ? "bg-white/[0.08]"
                                  : "bg-black/[0.05]"
                                : column,
                          ].join(" ")}
                        >
                          {!fixed && (
                            <span
                              data-grip
                              aria-hidden="true"
                              className={`pointer-events-none absolute left-1/2 top-0.5 -translate-x-1/2 opacity-0 transition-opacity group-hover/col:opacity-100 ${muted}`}
                            >
                              <DragDotsIcon className="h-5 w-5" />
                            </span>
                          )}

                          <div
                            onPointerDown={(e) =>
                              !fixed &&
                              editing !== group.id &&
                              onHeaderPointerDown(e, group.id)
                            }
                            className={[
                              "flex items-center justify-between px-2 pb-3 pt-3",
                              fixed
                                ? ""
                                : "cursor-grab select-none active:cursor-grabbing touch-none",
                            ].join(" ")}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${group.color}`}
                              />
                              {editing === group.id ? (
                                <input
                                  autoFocus
                                  defaultValue={group.label}
                                  maxLength={30}
                                  onBlur={(e) => {
                                    void renameGroup(group.id, e.target.value);
                                    setEditing(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      e.currentTarget.blur();
                                    if (e.key === "Escape") setEditing(null);
                                  }}
                                  className={[
                                    "w-[120px] rounded-md border bg-transparent px-2 py-0.5 text-[14px] font-semibold outline-none",
                                    isDark
                                      ? "border-white/30"
                                      : "border-black/30",
                                  ].join(" ")}
                                />
                              ) : (
                                <h2
                                  className={[
                                    "truncate text-[14px] font-semibold",
                                    strong,
                                  ].join(" ")}
                                >
                                  {group.label}
                                </h2>
                              )}
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium tabular-nums ${chip} ${muted}`}
                              >
                                {items.length}
                              </span>
                            </div>

                            <div className="relative flex items-center">
                              {!fixed && (
                                <>
                                  <IconButton
                                    label={c.board.groupOptions}
                                    onClick={() =>
                                      setColMenu((cur) =>
                                        cur === group.id ? null : group.id
                                      )
                                    }
                                    ghost={ghost}
                                    isDark={isDark}
                                    className="h-8 w-8"
                                    align="end"
                                  >
                                    <DotsIcon className="h-[18px] w-[18px]" />
                                  </IconButton>
                                  {colMenu === group.id && (
                                    <>
                                      <button
                                        type="button"
                                        aria-label={c.board.closeMenu}
                                        tabIndex={-1}
                                        className="fixed inset-0 z-30 cursor-default"
                                        onClick={() => setColMenu(null)}
                                      />
                                      <div
                                        className={`absolute right-0 top-full z-40 mt-1 min-w-[210px] rounded-xl border p-1 shadow-lg ${
                                          isDark
                                            ? "border-white/[0.08] bg-[#101012]"
                                            : "border-black/[0.06] bg-white"
                                        }`}
                                      >
                                        {[
                                          {
                                            label: c.board.renameGroup,
                                            run: () => setEditing(group.id),
                                          },
                                          {
                                            label: c.board.moveAllToUnassigned,
                                            run: () =>
                                              moveAll(group.id, UNASSIGNED),
                                          },
                                          {
                                            label: c.board.deleteGroup,
                                            run: () =>
                                              void deleteGroup(group.id),
                                          },
                                        ].map((o) => (
                                          <button
                                            key={o.label}
                                            type="button"
                                            onClick={() => {
                                              o.run();
                                              setColMenu(null);
                                            }}
                                            className={`w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                                              isDark
                                                ? "hover:bg-white/[0.06]"
                                                : "hover:bg-black/[0.04]"
                                            }`}
                                          >
                                            {o.label}
                                          </button>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          <div
                            data-list
                            className={`relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto ${HIDE_SCROLLBAR}`}
                          >
                            {items.map((idea) => (
                              <IdeaCard
                                key={idea.id}
                                idea={idea}
                                ideaTags={tagsOf(idea)}
                                allTags={tags}
                                moveGroups={groups}
                                onToggleTag={(tid) =>
                                  toggleIdeaTag(idea.id, tid)
                                }
                                onMove={(gid) => moveIdea(idea.id, gid)}
                                isDark={isDark}
                                isMobile={false}
                                muted={muted}
                                draggable
                                placeholder={cardDrag === idea.id}
                                onPointerDown={(e) =>
                                  onCardPointerDown(e, idea.id)
                                }
                                onDelete={() => deleteIdea(idea.id)}
                                c={c}
                              />
                            ))}
                          </div>
                        </section>
                      );
                    })}

                    {/* Ajouter un groupe */}
                    <div className="w-[260px] shrink-0">
                      {addingCol ? (
                        <div className={`rounded-2xl p-3 ${column}`}>
                          <CreateNameInput
                            autoFocus
                            isDark={isDark}
                            placeholder={c.board.groupNamePlaceholder}
                            submitAria={c.groupsMenu.createAria}
                            onCreate={(l) => {
                              void createGroup(l);
                              setAddingCol(false);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setAddingCol(false)}
                            className={`mt-2 w-full rounded-lg px-3 py-1.5 text-[13px] font-medium ${muted} ${ghost}`}
                          >
                            {c.board.cancel}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingCol(true)}
                          className={[
                            "flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-4 text-[14px] font-medium transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2",
                            ring,
                            isDark
                              ? "border-white/[0.14] text-neutral-300 hover:bg-white/[0.04]"
                              : "border-black/[0.10] text-neutral-600 hover:bg-black/[0.03]",
                          ].join(" ")}
                        >
                          <PlusIcon className="h-[18px] w-[18px]" />
                          {c.board.newGroup}
                        </button>
                      )}
                    </div>
                  </div>
                )}

              {/* Gallery */}
              {tab === "ideas" && view === "gallery" && (
                <div
                  className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${HIDE_SCROLLBAR}`}
                >
                  {visibleIdeas.length === 0 ? (
                    <div className="mt-12 flex flex-col items-center gap-3 text-center md:mt-16">
                      <h2
                        className={[
                          "text-[20px] font-semibold tracking-[-0.02em]",
                          strong,
                        ].join(" ")}
                      >
                        {c.galleryEmpty.title}
                      </h2>
                      <p
                        className={[
                          "max-w-[360px] text-[14px] leading-relaxed md:text-[13px]",
                          muted,
                        ].join(" ")}
                      >
                        {c.galleryEmpty.description}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 pb-4 min-[560px]:grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] md:gap-4">
                      {visibleIdeas.map((idea) => (
                        <IdeaCard
                          key={idea.id}
                          idea={idea}
                          groupLabel={groupLabel(idea.groupId)}
                          groupColor={groupColor(idea.groupId)}
                          ideaTags={tagsOf(idea)}
                          allTags={tags}
                          moveGroups={groups}
                          onToggleTag={(tid) => toggleIdeaTag(idea.id, tid)}
                          onMove={(gid) => moveIdea(idea.id, gid)}
                          isDark={isDark}
                          isMobile={isMobile}
                          muted={muted}
                          onDelete={() => deleteIdea(idea.id)}
                          c={c}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Feuille « Options du groupe » (mobile) */}
      {isMobile && sheetGroup && (
        <BottomSheet
          isDark={isDark}
          title={sheetGroup.label}
          onClose={() => setGroupSheetId(null)}
        >
          {(close) => (
            <GroupActionsBody
              group={sheetGroup}
              isDark={isDark}
              close={close}
              c={c}
              onRename={(label) => void renameGroup(sheetGroup.id, label)}
              onMoveAll={() => moveAll(sheetGroup.id, UNASSIGNED)}
              onDelete={() => void deleteGroup(sheetGroup.id)}
            />
          )}
        </BottomSheet>
      )}

      {/* Feuille « Nouveau groupe » (mobile) */}
      {isMobile && newGroupSheet && (
        <BottomSheet
          isDark={isDark}
          title={c.board.newGroup}
          onClose={() => setNewGroupSheet(false)}
        >
          {(close) => (
            <div className="pt-1">
              <CreateNameInput
                autoFocus
                isDark={isDark}
                placeholder={c.board.groupNamePlaceholder}
                submitAria={c.groupsMenu.createAria}
                onCreate={(label) => {
                  close();
                  void createGroup(label).then((id) => {
                    if (id) setMobileGroupId(id);
                  });
                }}
              />
            </div>
          )}
        </BottomSheet>
      )}

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
        addLabel={c.bottomBar.newIdea}
        onChange={handleBottomBarChange}
        onSubmitIdea={({ title, notes, groupId, tagIds }) =>
          addIdea({
            title,
            description: notes,
            groupId: groupId ?? UNASSIGNED,
            tagIds: tagIds ?? [],
          })
        }
        onCreatePost={() => {
          if (!requestNewPost("")) navigate("schedule");
        }}
        query={query}
        onQueryChange={setQuery}
      />

      <HelpChatButton isDark={isDark} />
    </main>
  );
}