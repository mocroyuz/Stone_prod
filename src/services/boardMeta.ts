// src/services/boardMeta.ts
// Store module-level (sans localStorage) pour les GROUPES et les TAGS.
// Chargés une seule fois, partagés entre Create, BottomBar et NewIdeaModal
// via useSyncExternalStore.

import { useEffect, useSyncExternalStore } from "react";
import { useUser } from "../contexts/UserContext";
import {
  ensureDefaultGroups,
  listGroups,
  createGroup as apiCreateGroup,
  updateGroup as apiUpdateGroup,
  deleteGroup as apiDeleteGroup,
  listTags,
  createTag as apiCreateTag,
  deleteTag as apiDeleteTag,
  type Group,
  type Tag,
} from "./supabase";

/* ───────── Constantes ───────── */

export const UNASSIGNED = "unassigned";

/**
 * Groupe système figé en première colonne (non renommable, non supprimable,
 * non déplaçable). Son libellé n'est pas traduit.
 */
export const UNASSIGNED_GROUP: Group = {
  id: UNASSIGNED,
  label: "Unassigned",
  color: "bg-neutral-400",
};

const DEFAULT_GROUP_ORDER = ["to do", "in progress"];

/** Palette utilisée pour les nouveaux groupes ET les nouveaux tags. */
export const NEW_COLORS = [
  "bg-[#6366f1]",
  "bg-[#ec4899]",
  "bg-[#14b8a6]",
  "bg-[#eab308]",
  "bg-[#84cc16]",
  "bg-[#0ea5e9]",
];

/* ───────── Store ───────── */

export type BoardMetaStatus = "idle" | "loading" | "ready" | "error";

export type BoardMetaState = {
  groups: Group[];
  tags: Tag[];
  status: BoardMetaStatus;
};

const emptyState: BoardMetaState = {
  groups: [UNASSIGNED_GROUP],
  tags: [],
  status: "idle",
};

let activeUserId: string | null = null;
let state: BoardMetaState = emptyState;
const statesByUser = new Map<string, BoardMetaState>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<BoardMetaState>, userId = activeUserId) {
  if (!userId || userId !== activeUserId) return;
  state = { ...state, ...patch };
  statesByUser.set(userId, state);
  notify();
}

function activateUser(userId: string | null) {
  if (activeUserId === userId) return;
  activeUserId = userId;
  state = userId ? statesByUser.get(userId) ?? emptyState : emptyState;
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;

/* ───────── Chargement unique (dédupliqué) ───────── */

const loadPromises = new Map<string, Promise<void>>();

export function loadBoardMeta(userId = activeUserId): Promise<void> {
  if (!userId) return Promise.resolve();
  activateUser(userId);
  if (state.status === "ready") return Promise.resolve();

  const inflight = loadPromises.get(userId);
  if (inflight) return inflight;

  setState({ status: "loading" }, userId);

  const promise = (async () => {
    try {
      await ensureDefaultGroups();
      const [server, tags] = await Promise.all([listGroups(), listTags()]);
      if (activeUserId !== userId) return;
      const rank = (g: Group) => {
        const i = DEFAULT_GROUP_ORDER.indexOf(g.label.trim().toLowerCase());
        return i === -1 ? DEFAULT_GROUP_ORDER.length : i;
      };
      const sorted = [...server].sort((a, b) => rank(a) - rank(b));
      setState(
        {
          groups: [UNASSIGNED_GROUP, ...sorted],
          tags,
          status: "ready",
        },
        userId
      );
    } catch (e) {
      console.error("Error loading board meta:", e);
      setState({ status: "error" }, userId);
    } finally {
      loadPromises.delete(userId);
    }
  })();
  loadPromises.set(userId, promise);
  return promise;
}

/* ───────── Groupes ───────── */

export async function addGroup(label: string): Promise<string | null> {
  const userId = activeUserId;
  const l = label.trim();
  if (!userId || !l) return null;
  const existing = state.groups.find(
    (g) => g.label.toLowerCase() === l.toLowerCase()
  );
  if (existing) return existing.id;
  try {
    const color = NEW_COLORS[(state.groups.length - 1) % NEW_COLORS.length];
    const created = await apiCreateGroup(l, color);
    setState({ groups: [...state.groups, created] }, userId);
    return created.id;
  } catch (e) {
    console.error("Error creating group:", e);
    return null;
  }
}

export async function renameGroup(id: string, label: string) {
  const userId = activeUserId;
  const l = label.trim();
  const group = state.groups.find((g) => g.id === id);
  if (!userId || !l || !group || id === UNASSIGNED || l === group.label) return;
  setState({
    groups: state.groups.map((g) => (g.id === id ? { ...g, label: l } : g)),
  }, userId);
  try {
    await apiUpdateGroup(id, { label: l, color: group.color });
  } catch (e) {
    console.error("Error renaming group:", e);
    setState(
      { groups: state.groups.map((g) => (g.id === id ? group : g)) },
      userId
    );
  }
}

/** Retourne false si l'API échoue (l'appelant peut rollback ses idées). */
export async function removeGroup(id: string): Promise<boolean> {
  const userId = activeUserId;
  if (!userId || id === UNASSIGNED) return false;
  const prev = state.groups;
  setState({ groups: prev.filter((g) => g.id !== id) }, userId);
  try {
    await apiDeleteGroup(id);
    return true;
  } catch (e) {
    console.error("Error deleting group:", e);
    setState({ groups: prev }, userId);
    return false;
  }
}

/** Réordonne en mémoire (l'ordre est perdu au refresh complet). */
export function moveGroup(id: string, toId: string) {
  if (!activeUserId) return;
  const cur = state.groups;
  const from = cur.findIndex((g) => g.id === id);
  const to = cur.findIndex((g) => g.id === toId);
  if (from < 1 || to < 1 || from === to) return;
  const next = [...cur];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  setState({ groups: next });
}

/* ───────── Tags ───────── */

export async function addTag(label: string): Promise<string | null> {
  const userId = activeUserId;
  const l = label.trim();
  if (!userId || !l) return null;
  const existing = state.tags.find(
    (t) => t.label.toLowerCase() === l.toLowerCase()
  );
  if (existing) return existing.id;
  try {
    const color = NEW_COLORS[state.tags.length % NEW_COLORS.length];
    const created = await apiCreateTag(l, color);
    setState({ tags: [...state.tags, created] }, userId);
    return created.id;
  } catch (e) {
    console.error("Error creating tag:", e);
    return null;
  }
}

/** Retourne false si l'API échoue (l'appelant peut rollback ses idées). */
export async function removeTag(id: string): Promise<boolean> {
  const userId = activeUserId;
  if (!userId) return false;
  const prev = state.tags;
  setState({ tags: prev.filter((t) => t.id !== id) }, userId);
  try {
    await apiDeleteTag(id);
    return true;
  } catch (e) {
    console.error("Error deleting tag:", e);
    setState({ tags: prev }, userId);
    return false;
  }
}

/* ───────── Hook ───────── */

export function useBoardMeta(): BoardMetaState {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const getUserSnapshot = () =>
    activeUserId === userId ? getSnapshot() : emptyState;
  const s = useSyncExternalStore(subscribe, getUserSnapshot, () => emptyState);

  useEffect(() => {
    activateUser(userId);
    if (userId) void loadBoardMeta(userId);
  }, [userId]);

  return s;
}

/* ───────── Utils ───────── */

/** "bg-[#6366f1]" -> "#6366f1" (le modal utilise des couleurs hex). */
export function classToHex(cls: string, fallback = "#a3a3a3"): string {
  return cls.match(/#[0-9a-fA-F]{3,8}/)?.[0] ?? fallback;
}