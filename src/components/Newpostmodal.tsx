import { useEffect, useMemo, useRef, useState } from "react";
import { EmojiPicker as FrimousseEmojiPicker } from "frimousse";
import {
  Maximize2, Minimize2, X, Tag, FileText, Smile, Hash,
  Image as ImageIcon, ImagePlus, Pencil, ChevronDown, CalendarClock,
  Check, ArrowLeft, Wand2, Plus, Play, Info, Loader2, RotateCcw,
  PanelRightClose, PanelRightOpen, Cloud, ChevronRight, ExternalLink,
} from "lucide-react";
import {
  XIcon, FacebookIcon, InstagramIcon, LinkedInIcon,
  TikTokIcon, YouTubeIcon, PinterestIcon, ThreadsIcon,
  GoogleDriveIcon as IntegrationGoogleDriveIcon,
} from "./IntegrationIcons";
import { CalendarPicker } from "./CalendarPicker";
import { TimePicker } from "./TimePicker";
import EditMediaModal from "./EditMediaModal";
import { navigate } from "../hooks/useHashRoute";
import {
  useConnectedChannels,
  type ConnectedChannel,
} from "../hooks/useConnectedChannels";
import { useNewPostShortcut } from "../hooks/useNewPostShortcut";
import {
  clearNewPostRequest,
  peekNewPostRequest,
  subscribeNewPostRequests,
} from "../services/Newpostbus";
import {
  getTikTokCreatorInfo,
  publishToTikTok,
  publishPhotosToTikTok,
  waitForTikTokPublish,
  type TikTokCreatorInfo,
  type TikTokPostOptions,
} from "../services/tiktok";
import {
  CANVA_SIZES,
  CanvaError,
  createCanvaDesign,
  getCanvaAuthUrl,
  importCanvaDesign,
  openCanvaPopup,
  waitForCanvaConnection,
  type CanvaSize,
} from "../services/canva";
import {
  downloadDropboxFile,
  getDropboxAuthUrl,
  getDropboxStatus,
  listDropboxFiles,
  type DropboxFileEntry,
} from "../services/dropbox";
import {
  downloadGoogleDriveFile,
  getGoogleDriveAuthUrl,
  getGoogleDriveStatus,
  listGoogleDriveFiles,
  type GoogleDriveFileEntry,
} from "../services/googledrive";
import {
  downloadGooglePhotosItem,
  getGooglePhotosAuthUrl,
  getGooglePhotosStatus,
  pickFromGooglePhotos,
} from "../services/googlephotos";

export type SocialNetworkId =
  | "x" | "facebook" | "instagram" | "linkedin"
  | "tiktok" | "youtube" | "pinterest" | "threads";

type NetworkIconComponent = (props: { className?: string }) => JSX.Element;

type MediaKind = "image" | "video";

type MediaItem = {
  id: string;
  file: File;
  url: string;
  kind: MediaKind;
};

function isDropboxMedia(entry: DropboxFileEntry): boolean {
  if (entry[".tag"] === "folder") return true;
  if (entry.mime_type?.startsWith("image/") || entry.mime_type?.startsWith("video/")) {
    return true;
  }
  return /\.(avif|gif|heic|heif|jpe?g|png|webp|m4v|mov|mp4|webm)$/i.test(entry.name);
}

function getDropboxParentPath(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return segments.length > 1 ? `/${segments.slice(0, -1).join("/")}` : "";
}

function isGoogleDriveMedia(entry: GoogleDriveFileEntry): boolean {
  const mimeType = entry.mime_type ?? entry.mimeType ?? "";
  if (mimeType === "application/vnd.google-apps.folder") return true;
  if (mimeType.startsWith("image/") || mimeType.startsWith("video/")) {
    return true;
  }
  return /\.(avif|gif|heic|heif|jpe?g|png|webp|m4v|mov|mp4|webm)$/i.test(
    entry.name
  );
}

/** Design Canva en cours d'édition, en attente d'être importé dans le post. */
type CanvaPendingDesign = {
  designId: string;
  target: string;
  label: string;
  editUrl: string;
  importing: boolean;
};

export type ScheduleAction = "save_in_folder" | "now" | "set_date";

/* ── YouTube ── */

export type YouTubeVisibility = "public" | "unlisted" | "private";
export type YouTubeLicense = "youtube" | "creativeCommon";

export type YouTubeOptions = {
  title: string;
  categoryId: string;
  visibility: YouTubeVisibility;
  license: YouTubeLicense;
  notifySubscribers: boolean;
  allowEmbedding: boolean;
  madeForKids: boolean;
};

export type NewPostPayload = {
  title: string;
  content: string;
  contents?: Record<string, string>; // Texte par réseau
  hashtags: string[];
  networks: SocialNetworkId[];
  scheduleMode: "now" | "save_in_folder" | "later";
  scheduledAt: string | null;
  media: File[];
  /** Médias propres à un réseau (remplacent `media` pour ce réseau). */
  mediaByNetwork?: Partial<Record<SocialNetworkId, File[]>>;
  youtube?: YouTubeOptions;
};

export function unavailablePostActionMessage(payload: NewPostPayload): string {
  if (payload.scheduleMode === "save_in_folder") {
    return "Saving posts to a folder isn't connected yet. This post wasn't saved.";
  }

  const channelNames: Record<SocialNetworkId, string> = {
    x: "X",
    facebook: "Facebook",
    instagram: "Instagram",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
    youtube: "YouTube Shorts",
    pinterest: "Pinterest",
    threads: "Threads",
  };
  const channels =
    payload.networks.map((network) => channelNames[network]).join(", ") ||
    "the selected channels";

  return payload.scheduleMode === "later"
    ? `Scheduling to ${channels} isn't connected yet. This post wasn't scheduled.`
    : `Publishing to ${channels} isn't connected yet. This post wasn't sent there.`;
}

interface NewPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onSubmit: (payload: NewPostPayload) => void | Promise<void>;
  initialScheduledAt?: Date | null;
  onRequestOpen?: () => void;
}

const MAX_MEDIA = 20;

const SOCIAL_NETWORKS: {
  id: SocialNetworkId;
  label: string;
  Icon: NetworkIconComponent;
}[] = [
  { id: "x", label: "X", Icon: XIcon },
  { id: "facebook", label: "Facebook", Icon: FacebookIcon },
  { id: "instagram", label: "Instagram", Icon: InstagramIcon },
  { id: "linkedin", label: "LinkedIn", Icon: LinkedInIcon },
  { id: "tiktok", label: "TikTok", Icon: TikTokIcon },
  { id: "youtube", label: "YouTube Shorts", Icon: YouTubeIcon },
  { id: "pinterest", label: "Pinterest", Icon: PinterestIcon },
  {
    id: "threads",
    label: "Threads",
    Icon: ThreadsIcon as unknown as NetworkIconComponent,
  },
];

const CHAR_LIMITS: Record<SocialNetworkId, number> = {
  x: 280,
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  tiktok: 2200,
  youtube: 5000,
  pinterest: 500,
  threads: 500,
};

const SCHEDULE_ACTIONS: {
  id: ScheduleAction;
  label: string;
  description: string;
}[] = [
  { id: "save_in_folder", label: "Save in folder", description: "Save your post in a folder to publish it later." },
  { id: "now", label: "Now", description: "Publish your post right away." },
  { id: "set_date", label: "Set date and time", description: "Choose a specific time to post, or use our recommendation." },
];

const POSTING_SLOTS: { label: string; hour: number; minute: number }[] = [
  { label: "9:00 AM", hour: 9, minute: 0 },
  { label: "12:00 PM", hour: 12, minute: 0 },
  { label: "6:00 PM", hour: 18, minute: 0 },
];

const TIKTOK_PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};

const TIKTOK_FALLBACK_PRIVACY: string[] = ["SELF_ONLY"];

const TIKTOK_MUSIC_URL =
  "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
const TIKTOK_BRANDED_URL =
  "https://www.tiktok.com/legal/page/global/bc-policy/en";

const TIKTOK_DEFAULT_OPTIONS: TikTokPostOptions = {
  privacy_level: "",
  disable_comment: false,
  disable_duet: false,
  disable_stitch: false,
};

type TikTokAllow = { comment: boolean; duet: boolean; stitch: boolean };
const TIKTOK_DEFAULT_ALLOW: TikTokAllow = {
  comment: false,
  duet: false,
  stitch: false,
};

type TikTokCommercial = { on: boolean; yourBrand: boolean; branded: boolean };
const TIKTOK_DEFAULT_COMMERCIAL: TikTokCommercial = {
  on: false,
  yourBrand: false,
  branded: false,
};

/* ── YouTube ── */

const YOUTUBE_TITLE_MAX = 100;

const YOUTUBE_CATEGORIES: { id: string; label: string }[] = [
  { id: "2", label: "Autos & Vehicles" },
  { id: "1", label: "Film & Animation" },
  { id: "10", label: "Music" },
  { id: "15", label: "Pets & Animals" },
  { id: "17", label: "Sports" },
  { id: "19", label: "Travel & Events" },
  { id: "20", label: "Gaming" },
  { id: "22", label: "People & Blogs" },
  { id: "23", label: "Comedy" },
  { id: "24", label: "Entertainment" },
  { id: "25", label: "News & Politics" },
  { id: "26", label: "Howto & Style" },
  { id: "27", label: "Education" },
  { id: "28", label: "Science & Technology" },
  { id: "29", label: "Nonprofits & Activism" },
];

const YOUTUBE_VISIBILITY: { id: YouTubeVisibility; label: string }[] = [
  { id: "public", label: "Public" },
  { id: "unlisted", label: "Unlisted" },
  { id: "private", label: "Private" },
];

const YOUTUBE_LICENSES: { id: YouTubeLicense; label: string }[] = [
  { id: "youtube", label: "Standard YouTube License" },
  { id: "creativeCommon", label: "Creative Commons - Attribution" },
];

const YOUTUBE_DEFAULT_OPTIONS: YouTubeOptions = {
  title: "",
  categoryId: YOUTUBE_CATEGORIES[0].id,
  visibility: "public",
  license: "youtube",
  notifySubscribers: true,
  allowEmbedding: true,
  madeForKids: false,
};

/* ──────────────────────────────────────────────────────────────
   Brouillon
   `contents` ne contient que les textes personnalisés par réseau
   (ceux qui diffèrent du texte principal).
   ────────────────────────────────────────────────────────────── */

type DraftData = {
  title: string;
  masterContent: string;
  contents: Record<string, string>;
  networks: SocialNetworkId[];
  scheduleAction: ScheduleAction;
  scheduledAt: number;
  files: File[];
  channelFiles?: Record<string, File[]>;
  youtubeOptions?: YouTubeOptions;
};

let savedDraft: DraftData | null = null;

/* ──────────────────────────────────────────────────────────────
   Persistance du brouillon (localStorage + IndexedDB)
   Les métadonnées/textes vont dans localStorage. Les File
   (non sérialisables) vont dans IndexedDB, ce qui permet de
   retrouver un brouillon complet après un rafraîchissement ou
   après avoir quitté puis rouvert le site.
   ────────────────────────────────────────────────────────────── */

const DRAFT_META_KEY = "newpost:draft:v1";
const DRAFT_DB_NAME = "newpost-drafts";
const DRAFT_DB_STORE = "files";

type SerializedDraft = {
  title: string;
  masterContent: string;
  contents: Record<string, string>;
  networks: SocialNetworkId[];
  scheduleAction: ScheduleAction;
  scheduledAt: number;
  youtubeOptions?: YouTubeOptions;
  fileIds: string[];
  channelFileIds?: Record<string, string[]>;
};

function openDraftDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DRAFT_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DRAFT_DB_STORE)) {
        req.result.createObjectStore(DRAFT_DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putDraftFiles(files: Record<string, File>): Promise<void> {
  const db = await openDraftDB();
  try {
    const tx = db.transaction(DRAFT_DB_STORE, "readwrite");
    const store = tx.objectStore(DRAFT_DB_STORE);
    store.clear();
    for (const [id, file] of Object.entries(files)) {
      store.put(file, id);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function readDraftFiles(ids: string[]): Promise<Record<string, File>> {
  if (ids.length === 0) return {};
  const db = await openDraftDB();
  try {
    const tx = db.transaction(DRAFT_DB_STORE, "readonly");
    const store = tx.objectStore(DRAFT_DB_STORE);
    const result: Record<string, File> = {};
    await Promise.all(
      ids.map(
        (id) =>
          new Promise<void>((resolve) => {
            const req = store.get(id);
            req.onsuccess = () => {
              if (req.result instanceof File) result[id] = req.result;
              resolve();
            };
            req.onerror = () => resolve();
          })
      )
    );
    return result;
  } finally {
    db.close();
  }
}

async function clearDraftFiles(): Promise<void> {
  try {
    const db = await openDraftDB();
    try {
      const tx = db.transaction(DRAFT_DB_STORE, "readwrite");
      tx.objectStore(DRAFT_DB_STORE).clear();
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } finally {
      db.close();
    }
  } catch {
    /* IndexedDB indisponible : rien à nettoyer. */
  }
}

async function persistDraftToStorage(draft: DraftData): Promise<void> {
  try {
    const filesById: Record<string, File> = {};
    const fileIds: string[] = [];
    for (const file of draft.files) {
      const id = makeId();
      fileIds.push(id);
      filesById[id] = file;
    }

    const channelFileIds: Record<string, string[]> = {};
    for (const [key, files] of Object.entries(draft.channelFiles ?? {})) {
      channelFileIds[key] = [];
      for (const file of files) {
        const id = makeId();
        channelFileIds[key].push(id);
        filesById[id] = file;
      }
    }

    await putDraftFiles(filesById);

    const serialized: SerializedDraft = {
      title: draft.title,
      masterContent: draft.masterContent,
      contents: draft.contents,
      networks: draft.networks,
      scheduleAction: draft.scheduleAction,
      scheduledAt: draft.scheduledAt,
      youtubeOptions: draft.youtubeOptions,
      fileIds,
      channelFileIds:
        Object.keys(channelFileIds).length > 0 ? channelFileIds : undefined,
    };
    localStorage.setItem(DRAFT_META_KEY, JSON.stringify(serialized));
  } catch {
    /* Échec de persistance : le brouillon reste en mémoire pour la session. */
  }
}

async function loadDraftFromStorage(): Promise<DraftData | null> {
  let serialized: SerializedDraft | null = null;
  try {
    const raw = localStorage.getItem(DRAFT_META_KEY);
    if (!raw) return null;
    serialized = JSON.parse(raw) as SerializedDraft;
  } catch {
    return null;
  }

  try {
    const allIds = [
      ...(serialized.fileIds ?? []),
      ...Object.values(serialized.channelFileIds ?? {}).flat(),
    ];
    const filesById = await readDraftFiles(allIds);

    const files = (serialized.fileIds ?? [])
      .map((id) => filesById[id])
      .filter(Boolean) as File[];

    const channelFiles = serialized.channelFileIds
      ? Object.fromEntries(
          Object.entries(serialized.channelFileIds)
            .map(([key, ids]) => [
              key,
              ids.map((id) => filesById[id]).filter(Boolean) as File[],
            ])
            .filter(([, list]) => list.length > 0)
        )
      : undefined;

    return {
      title: serialized.title,
      masterContent: serialized.masterContent,
      contents: serialized.contents,
      networks: serialized.networks,
      scheduleAction: serialized.scheduleAction,
      scheduledAt: serialized.scheduledAt,
      files,
      channelFiles,
      youtubeOptions: serialized.youtubeOptions,
    };
  } catch {
    return null;
  }
}

async function clearDraftFromStorage(): Promise<void> {
  try {
    localStorage.removeItem(DRAFT_META_KEY);
  } catch {
    /* ignore */
  }
  await clearDraftFiles();
}

/** Un brouillon n'est proposé que s'il contient du vrai contenu
 *  (texte, titre ou média) — pas juste des réseaux connectés. */
function draftHasContent(draft: DraftData): boolean {
  return (
    draft.masterContent.trim().length > 0 ||
    Object.values(draft.contents).some((c) => c.trim().length > 0) ||
    draft.title.trim().length > 0 ||
    draft.files.length > 0 ||
    Object.keys(draft.channelFiles ?? {}).length > 0
  );
}

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mergeDateTime(datePart: Date, timePart: Date): Date {
  const merged = new Date(datePart);
  merged.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return merged;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function defaultScheduledDate(): Date {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}

function formatShortDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatLongDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "Local";
  }
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the video duration."));
    };
    video.src = url;
  });
}

async function toTikTokImage(file: File): Promise<File> {
  if (file.type === "image/jpeg" || file.type === "image/webp") return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not convert an image for TikTok.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  );

  if (!blob) throw new Error("Could not convert an image for TikTok.");

  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
}

function getNetworkId(channel: ConnectedChannel): SocialNetworkId | null {
  const c = channel as unknown as Record<string, unknown>;
  const raw = String(c.platform ?? c.network ?? c.provider ?? channel.key)
    .toLowerCase()
    .trim();

  if (raw.includes("tiktok")) return "tiktok";
  if (raw.includes("insta")) return "instagram";
  if (raw.includes("youtube") || raw === "yt") return "youtube";
  if (raw.includes("facebook") || raw === "fb") return "facebook";
  if (raw.includes("linkedin")) return "linkedin";
  if (raw.includes("pinterest")) return "pinterest";
  if (raw.includes("threads")) return "threads";
  if (raw === "x" || raw.includes("twitter")) return "x";
  return null;
}

function channelLabel(channel: ConnectedChannel | undefined, fallback: string) {
  return channel?.handle || channel?.name || fallback;
}

type ChannelTileData = {
  channel: ConnectedChannel;
  network: (typeof SOCIAL_NETWORKS)[number];
  order: number;
};

/* ──────────────────────────────────────────────────────────────
   Composants secondaires
   ────────────────────────────────────────────────────────────── */

type AvatarSize = "sm" | "md" | "lg";

const AVATAR_SIZES: Record<
  AvatarSize,
  { box: string; badge: string; icon: string; text: string }
> = {
  sm: {
    box: "h-8 w-8 rounded-full",
    badge: "h-4 w-4 -bottom-1 -right-1 ring-2",
    icon: "h-2.5 w-2.5",
    text: "text-[11px]",
  },
  md: {
    box: "h-10 w-10 rounded-xl",
    badge: "h-5 w-5 -bottom-1.5 -right-1.5 ring-2",
    icon: "h-3 w-3",
    text: "text-[14px]",
  },
  lg: {
    box: "h-14 w-14 rounded-2xl",
    badge: "h-6 w-6 -bottom-1.5 -right-1.5 ring-[3px]",
    icon: "h-3 w-3",
    text: "text-[18px]",
  },
};

function Avatar({
  channel,
  label,
  Icon,
  size,
  isDark,
  ringClass,
}: {
  channel?: ConnectedChannel;
  label: string;
  Icon: NetworkIconComponent;
  size: AvatarSize;
  isDark: boolean;
  ringClass: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [channel?.avatarUrl]);

  const s = AVATAR_SIZES[size];
  const initial = label.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const showImage = Boolean(channel?.avatarUrl) && !failed;

  return (
    <span className={["relative inline-block shrink-0", s.box].join(" ")}>
      {showImage ? (
        <img
          src={channel!.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={["h-full w-full object-cover", s.box].join(" ")}
        />
      ) : (
        <span
          className={[
            "flex h-full w-full items-center justify-center font-semibold text-white",
            s.box,
            s.text,
            isDark ? "bg-[#2a2a2d]" : "bg-neutral-900",
          ].join(" ")}
        >
          {initial}
        </span>
      )}
      <span
        className={[
          "absolute flex items-center justify-center rounded-full bg-white text-black",
          s.badge,
          ringClass,
        ].join(" ")}
      >
        <Icon className={s.icon} />
      </span>
    </span>
  );
}

function ChannelTile({
  channel,
  network,
  isDark,
  isSelected,
  onToggle,
}: {
  channel: ConnectedChannel;
  network: (typeof SOCIAL_NETWORKS)[number];
  isDark: boolean;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const label = channelLabel(channel, network.label);

  return (
    <button
      type="button"
      onClick={onToggle}
      title={`${label} · ${network.label}`}
      aria-label={`${network.label}: ${label}`}
      aria-pressed={isSelected}
      className={[
        "relative h-14 w-14 shrink-0 rounded-2xl outline-none transition duration-200",
        "focus-visible:ring-2 focus-visible:ring-offset-[3px]",
        isDark
          ? "focus-visible:ring-white/60 focus-visible:ring-offset-[#141416]"
          : "focus-visible:ring-neutral-900/60 focus-visible:ring-offset-white",
        isSelected
          ? isDark
            ? "opacity-100 ring-2 ring-white ring-offset-[3px] ring-offset-[#141416]"
            : "opacity-100 ring-2 ring-neutral-900 ring-offset-[3px] ring-offset-white"
          : "opacity-45 grayscale hover:opacity-80 hover:grayscale-0",
      ].join(" ")}
    >
      <Avatar
        channel={channel}
        label={label}
        Icon={network.Icon}
        size="lg"
        isDark={isDark}
        ringClass={isDark ? "ring-[#141416]" : "ring-white"}
      />
    </button>
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
  isDark,
  ariaLabel,
  placeholder,
  className = "",
}: {
  value: T;
  options: { id: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  isDark: boolean;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={["relative", className].join(" ")}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={[
          "w-full cursor-pointer appearance-none rounded-xl border py-2.5 pl-4 pr-10 text-[14px] font-medium outline-none transition",
          isDark
            ? "border-white/10 bg-[#242427] text-white hover:bg-[#2b2b2e] focus:border-white/30"
            : "border-black/10 bg-white text-neutral-900 hover:bg-neutral-50 focus:border-black/30",
        ].join(" ")}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.id} value={o.id} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={[
          "pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2",
          isDark ? "text-neutral-300" : "text-neutral-500",
        ].join(" ")}
      />
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  title,
  isDark,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  title?: string;
  isDark: boolean;
}) {
  return (
    <label
      title={title}
      className={[
        "flex select-none items-start gap-2.5 text-[14px] font-medium",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        isDark ? "text-white" : "text-neutral-900",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={[
          "mt-px flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-md border transition",
          isDark
            ? "peer-focus-visible:ring-2 peer-focus-visible:ring-white/50"
            : "peer-focus-visible:ring-2 peer-focus-visible:ring-black/40",
          checked
            ? isDark
              ? "border-white bg-white text-[#141416]"
              : "border-neutral-900 bg-neutral-900 text-white"
            : isDark
            ? "border-white/30 bg-transparent hover:border-white/60"
            : "border-black/30 bg-transparent hover:border-black/60",
        ].join(" ")}
      >
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
      </span>
      <span className="min-w-0">
        <span className="block">{label}</span>
        {description && (
          <span
            className={[
              "mt-0.5 block text-[12px] font-normal leading-snug",
              isDark ? "text-neutral-400" : "text-neutral-500",
            ].join(" ")}
          >
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

function SettingsBlock({
  title,
  subtitle,
  isDark,
  children,
}: {
  title: string;
  subtitle?: string;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "mt-4 rounded-xl border p-4",
        isDark ? "border-white/10 bg-black/20" : "border-black/[0.06] bg-white",
      ].join(" ")}
    >
      <p className={["text-[13.5px] font-semibold", isDark ? "text-white" : "text-neutral-900"].join(" ")}>
        {title}
      </p>
      {subtitle && (
        <p className={["mt-0.5 text-[12px]", isDark ? "text-neutral-400" : "text-neutral-500"].join(" ")}>
          {subtitle}
        </p>
      )}
      <div className="mt-3.5 flex flex-col gap-3.5">{children}</div>
    </div>
  );
}

function FieldRow({
  label,
  htmlFor,
  isDark,
  children,
}: {
  label: string;
  htmlFor?: string;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[110px_1fr] sm:gap-3">
      <label
        htmlFor={htmlFor}
        className={["text-[13.5px] font-semibold", isDark ? "text-white" : "text-neutral-900"].join(" ")}
      >
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ── Sources de médias (icônes simplifiées, monochromes) ── */

type SourceIconProps = { className?: string; inner?: string };

function CanvaIcon({ className, inner = "#1c1c1e" }: SourceIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path
        d="M15.2 9.2a4.2 4.2 0 1 0 0 5.6"
        fill="none"
        stroke={inner}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DropboxIcon({ className }: SourceIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <polygon points="6,2 12,5.5 6,9 0,5.5" />
      <polygon points="18,2 24,5.5 18,9 12,5.5" />
      <polygon points="6,9 12,12.5 6,16 0,12.5" />
      <polygon points="18,9 24,12.5 18,16 12,12.5" />
      <polygon points="6,17.4 12,13.9 18,17.4 12,20.9" />
    </svg>
  );
}

function GooglePhotosIcon({ className }: SourceIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      {[0, 90, 180, 270].map((deg) => (
        <path
          key={deg}
          d="M12 2a5 5 0 0 1 5 5v5h-5z"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

function OneDriveIcon({ className }: SourceIconProps) {
  return <Cloud className={className} fill="currentColor" strokeWidth={1.5} />;
}

function UnsplashIcon({ className }: SourceIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M7.5 6.75V0h9v6.75h-9zm9 3.75H24V24H0V10.5h7.5v6.75h9V10.5z" />
    </svg>
  );
}

type MediaSourceId =
  | "canva" | "dropbox" | "google_drive"
  | "google_photos" | "onedrive" | "unsplash";

const MEDIA_SOURCES: {
  id: MediaSourceId;
  label: string;
  Icon: (props: SourceIconProps) => JSX.Element;
  submenu?: boolean;
}[] = [
  { id: "canva", label: "Canva", Icon: CanvaIcon, submenu: true },
  { id: "dropbox", label: "Dropbox", Icon: DropboxIcon },
  { id: "google_drive", label: "Google Drive", Icon: IntegrationGoogleDriveIcon },
  { id: "google_photos", label: "Google Photos", Icon: GooglePhotosIcon },
  { id: "onedrive", label: "OneDrive", Icon: OneDriveIcon },
  { id: "unsplash", label: "Unsplash", Icon: UnsplashIcon },
];

/**
 * Menu « + » des sources de médias. Canva ouvre un sous-menu de tailles de
 * design (au survol sur desktop, au clic sur mobile). Le sous-menu est un
 * frère du menu principal (et non un enfant) pour ne pas être rogné par son
 * `overflow-hidden`.
 */
function MediaSourceMenu({
  isDark,
  onPick,
  onPickCanva,
}: {
  isDark: boolean;
  onPick: (id: MediaSourceId) => void;
  onPickCanva: (size: CanvaSize) => void;
}) {
  const [canvaOpen, setCanvaOpen] = useState(false);

  const panel = isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/10 bg-white";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const hover = isDark ? "hover:bg-white/5" : "hover:bg-black/[0.04]";
  const active = isDark ? "bg-white/10" : "bg-black/[0.06]";

  return (
    <div className="absolute bottom-full left-0 z-50 mb-2">
      <div
        role="menu"
        aria-label="Add media from"
        className={[
          "w-[230px] overflow-hidden rounded-2xl border p-2 shadow-2xl",
          panel,
        ].join(" ")}
      >
        {MEDIA_SOURCES.map(({ id, label, Icon, submenu }) => {
          const isCanvaRow = id === "canva";
          return (
            <button
              key={id}
              type="button"
              role="menuitem"
              aria-haspopup={submenu ? "menu" : undefined}
              aria-expanded={submenu ? canvaOpen : undefined}
              onMouseEnter={() => setCanvaOpen(isCanvaRow)}
              onClick={() => {
                if (isCanvaRow) setCanvaOpen((v) => !v);
                else onPick(id);
              }}
              className={[
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] font-semibold transition",
                isDark ? "text-neutral-100" : "text-neutral-800",
                isCanvaRow && canvaOpen ? active : hover,
              ].join(" ")}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" inner={isDark ? "#1c1c1e" : "#ffffff"} />
              <span className="flex-1">{label}</span>
              {submenu && <ChevronRight className={["h-4 w-4", muted].join(" ")} />}
            </button>
          );
        })}
      </div>

      {canvaOpen && (
        <div
          role="menu"
          aria-label="Canva design size"
          className={[
            "absolute bottom-0 left-full ml-1.5 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border p-2 shadow-2xl",
            panel,
          ].join(" ")}
        >
          {CANVA_SIZES.map((size) => (
            <button
              key={size.id}
              type="button"
              role="menuitem"
              onClick={() => onPickCanva(size)}
              className={[
                "flex w-full items-baseline gap-2 rounded-lg px-4 py-3.5 text-left transition",
                isDark ? "text-neutral-100" : "text-neutral-800",
                hover,
              ].join(" ")}
            >
              <span className="text-[15px] font-semibold">
                {size.label} {size.ratio}
              </span>
              <span className={["text-[13px] font-normal", muted].join(" ")}>
                ({size.width}×{size.height})
                {size.isDefault ? " · Default" : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const EMOJI_FONT =
  '"Noto Emoji", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

function EmojiPickerPanel({
  isDark,
  onPick,
}: {
  isDark: boolean;
  onPick: (emoji: string) => void;
}) {
  const components = useMemo(
    () => ({
      CategoryHeader: ({
        category,
        ...props
      }: {
        category: { label: string };
      } & React.HTMLAttributes<HTMLDivElement>) => (
        <div
          className={[
            "px-3 pb-1.5 pt-3 text-[11.5px] font-semibold",
            isDark ? "bg-[#1c1c1e] text-neutral-400" : "bg-white text-neutral-500",
          ].join(" ")}
          {...props}
        >
          {category.label}
        </div>
      ),
      Row: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
        <div className="scroll-my-1.5 px-1.5" {...props}>
          {children}
        </div>
      ),
      Emoji: ({
        emoji,
        ...props
      }: {
        emoji: { emoji: string };
      } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button
          {...props}
          style={{ ...props.style, fontFamily: EMOJI_FONT }}
          className={[
            "flex size-9 items-center justify-center rounded-lg text-[22px] grayscale",
            isDark
              ? "text-white data-[active]:bg-white/15"
              : "text-neutral-900 data-[active]:bg-black/[0.07]",
          ].join(" ")}
        >
          {emoji.emoji}
        </button>
      ),
    }),
    [isDark]
  );

  return (
    <div
      role="dialog"
      aria-label="Choose an emoji"
      className={[
        "absolute bottom-full left-0 z-50 mb-2 overflow-hidden rounded-xl border shadow-2xl",
        isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/10 bg-white",
      ].join(" ")}
    >
      <FrimousseEmojiPicker.Root
        locale="en"
        columns={8}
        onEmojiSelect={({ emoji }) => onPick(emoji)}
        className="isolate flex h-[340px] w-[300px] flex-col"
      >
        <FrimousseEmojiPicker.Search
          autoFocus
          placeholder="Search emoji"
          className={[
            "z-10 mx-2 mt-2 appearance-none rounded-lg px-3 py-2 text-[13px] outline-none",
            isDark
              ? "bg-white/10 text-white placeholder:text-neutral-500"
              : "bg-neutral-100 text-neutral-900 placeholder:text-neutral-400",
          ].join(" ")}
        />
        <FrimousseEmojiPicker.Viewport className="relative flex-1 outline-none">
          <FrimousseEmojiPicker.Loading
            className={[
              "absolute inset-0 flex items-center justify-center text-[13px]",
              isDark ? "text-neutral-500" : "text-neutral-400",
            ].join(" ")}
          >
            Loading…
          </FrimousseEmojiPicker.Loading>
          <FrimousseEmojiPicker.Empty
            className={[
              "absolute inset-0 flex items-center justify-center text-[13px]",
              isDark ? "text-neutral-500" : "text-neutral-400",
            ].join(" ")}
          >
            No emoji found.
          </FrimousseEmojiPicker.Empty>
          <FrimousseEmojiPicker.List
            className="select-none pb-1.5"
            components={components}
          />
        </FrimousseEmojiPicker.Viewport>
      </FrimousseEmojiPicker.Root>
    </div>
  );
}

/** Textarea qui s'agrandit avec son contenu. */
function AutoTextarea({
  value,
  onChange,
  onCaret,
  textareaRef,
  className,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onCaret: (el: HTMLTextAreaElement) => void;
  textareaRef?: (el: HTMLTextAreaElement | null) => void;
  className: string;
  placeholder: string;
  ariaLabel: string;
}) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 420)}px`;
  }, [value]);

  return (
    <textarea
      ref={(el) => {
        innerRef.current = el;
        textareaRef?.(el);
      }}
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value);
        onCaret(e.target);
      }}
      onSelect={(e) => onCaret(e.currentTarget)}
      onKeyUp={(e) => onCaret(e.currentTarget)}
      onClick={(e) => onCaret(e.currentTarget)}
      className={className}
    />
  );
}

function ComposerToolbar({
  isDark,
  emojiOpen,
  onToggleEmoji,
  onPickEmoji,
  onHash,
  length,
  limit,
  extra,
  leading,
}: {
  isDark: boolean;
  emojiOpen: boolean;
  onToggleEmoji: () => void;
  onPickEmoji: (emoji: string) => void;
  onHash: () => void;
  length: number;
  limit?: number;
  extra?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  const over = limit !== undefined && length > limit;
  const near = limit !== undefined && !over && length > limit * 0.9;
  const textSecondary = isDark ? "text-neutral-400" : "text-neutral-500";
  const hover = isDark ? "hover:bg-white/10 hover:text-white" : "hover:bg-black/5 hover:text-neutral-900";
  const active = isDark ? "bg-white/10 text-white" : "bg-black/5 text-neutral-900";

  return (
    <div
      className={[
        "mt-3 flex items-center justify-between border-t pt-3",
        isDark ? "border-white/5" : "border-black/[0.04]",
      ].join(" ")}
    >
      <div className="flex items-center gap-1">
        {leading}
        <div className="emoji-wrapper relative">
          <button
            type="button"
            aria-label="Insert emoji"
            aria-expanded={emojiOpen}
            onClick={onToggleEmoji}
            className={["flex h-8 w-8 items-center justify-center rounded-lg transition", emojiOpen ? active : `${textSecondary} ${hover}`].join(" ")}
          >
            <Smile className="h-4 w-4" />
          </button>
          {emojiOpen && <EmojiPickerPanel isDark={isDark} onPick={onPickEmoji} />}
        </div>
        <button
          type="button"
          aria-label="Insert hashtag"
          onClick={onHash}
          className={["flex h-8 w-8 items-center justify-center rounded-lg transition", textSecondary, hover].join(" ")}
        >
          <Hash className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-3">
        {extra}
        <span
          aria-live="polite"
          className={[
            "text-[12px] tabular-nums",
            over ? "font-semibold text-red-500" : near ? "font-semibold text-amber-500" : textSecondary,
          ].join(" ")}
        >
          {length.toLocaleString("en-US")}
          {limit !== undefined && limit <= 5000 ? ` / ${limit.toLocaleString("en-US")}` : ""}
        </span>
      </div>
    </div>
  );
}

function PostPreview({
  isDark,
  network,
  channel,
  text,
  limit,
  media,
}: {
  isDark: boolean;
  network: (typeof SOCIAL_NETWORKS)[number] | null;
  channel?: ConnectedChannel;
  text: string;
  limit?: number;
  media: MediaItem[];
}) {
  const textPrimary = isDark ? "text-white" : "text-neutral-900";
  const textSecondary = isDark ? "text-neutral-400" : "text-neutral-500";
  const label = channelLabel(channel, network?.label ?? "Your account");
  const within = limit !== undefined ? text.slice(0, limit) : text;
  const overflow = limit !== undefined ? text.slice(limit) : "";
  const cover = media[0];

  return (
    <div
      className={[
        "w-full max-w-[320px] rounded-2xl border p-4 shadow-sm",
        isDark ? "border-white/10 bg-[#242427]" : "border-black/[0.06] bg-white",
      ].join(" ")}
    >
      <div className="mb-3 flex items-center gap-2.5">
        {network ? (
          <Avatar
            channel={channel}
            label={label}
            Icon={network.Icon}
            size="sm"
            isDark={isDark}
            ringClass={isDark ? "ring-[#242427]" : "ring-white"}
          />
        ) : (
          <div className={["h-8 w-8 rounded-full", isDark ? "bg-white/10" : "bg-neutral-200"].join(" ")} />
        )}
        <div className="min-w-0">
          <p className={["truncate text-[13px] font-semibold", textPrimary].join(" ")}>{label}</p>
          <p className={["text-[11.5px]", textSecondary].join(" ")}>Just now</p>
        </div>
      </div>

      {text.trim() ? (
        <p className={["whitespace-pre-wrap break-words text-[13.5px] leading-relaxed", textPrimary].join(" ")}>
          {within}
          {overflow && (
            <mark className="rounded bg-red-500/25 px-0.5 text-inherit" title="Over the character limit">
              {overflow}
            </mark>
          )}
        </p>
      ) : (
        <p className={["text-[13px] italic", textSecondary].join(" ")}>Your text will appear here.</p>
      )}

      {cover && (
        <div className="relative mt-3 overflow-hidden rounded-xl">
          {cover.kind === "image" ? (
            <img src={cover.url} alt="" className="max-h-[280px] w-full object-cover" />
          ) : (
            <video src={cover.url} className="max-h-[280px] w-full object-cover" muted playsInline />
          )}
          {media.length > 1 && (
            <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
              1/{media.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Composant principal
   ────────────────────────────────────────────────────────────── */

export default function NewPostModal({
  isOpen,
  onClose,
  isDark,
  onSubmit,
  initialScheduledAt,
  onRequestOpen,
}: NewPostModalProps) {
  const [masterContent, setMasterContent] = useState("");
  /** Textes personnalisés par réseau. Absent = suit le texte principal. */
  const [contents, setContents] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [networks, setNetworks] = useState<SocialNetworkId[]>([]);
  const [scheduleAction, setScheduleAction] = useState<ScheduleAction>("now");
  const [scheduledAt, setScheduledAt] = useState<Date>(() => defaultScheduledDate());
  const [media, setMedia] = useState<MediaItem[]>([]);
  /** Médias propres à un réseau. Absent = le réseau utilise les médias partagés. */
  const [channelMedia, setChannelMedia] = useState<Record<string, MediaItem[]>>({});
  const [mediaError, setMediaError] = useState<{ target: string; message: string } | null>(null);
  const [draggingTarget, setDraggingTarget] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDateTimePanel, setShowDateTimePanel] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [pendingDraft, setPendingDraft] = useState<DraftData | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitProgress, setSubmitProgress] = useState<string | null>(null);

  const [activeEmojiNetwork, setActiveEmojiNetwork] = useState<string | null>(null);
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});
  const [previewNetwork, setPreviewNetwork] = useState<SocialNetworkId | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showSourceMenu, setShowSourceMenu] = useState<string | null>(null);
  const [requestTick, setRequestTick] = useState(0);

  // ── Canva ──
  /** Zone de texte (target) pour laquelle un design Canva est en cours de création. */
  const [canvaBusy, setCanvaBusy] = useState<string | null>(null);
  const [canvaDesigns, setCanvaDesigns] = useState<CanvaPendingDesign[]>([]);

  // ── Dropbox ──
  const [dropboxPickerOpen, setDropboxPickerOpen] = useState(false);
  const [dropboxNeedsConnection, setDropboxNeedsConnection] = useState(false);
  const [dropboxFiles, setDropboxFiles] = useState<DropboxFileEntry[]>([]);
  const [dropboxPath, setDropboxPath] = useState("");
  const [dropboxCursor, setDropboxCursor] = useState<string | null>(null);
  const [dropboxHasMore, setDropboxHasMore] = useState(false);
  const [dropboxLoading, setDropboxLoading] = useState(false);
  const [dropboxImporting, setDropboxImporting] = useState<string | null>(null);
  const [dropboxError, setDropboxError] = useState<string | null>(null);
  const [dropboxTarget, setDropboxTarget] = useState("master");

  // ── Google Drive ──
  const [googleDrivePickerOpen, setGoogleDrivePickerOpen] = useState(false);
  const [googleDriveNeedsConnection, setGoogleDriveNeedsConnection] =
    useState(false);
  const [googleDriveFiles, setGoogleDriveFiles] = useState<
    GoogleDriveFileEntry[]
  >([]);
  const [googleDriveFolders, setGoogleDriveFolders] = useState<
    { id: string; name: string }[]
  >([{ id: "", name: "My Drive" }]);
  const [googleDriveCursor, setGoogleDriveCursor] = useState<string | null>(
    null
  );
  const [googleDriveHasMore, setGoogleDriveHasMore] = useState(false);
  const [googleDriveLoading, setGoogleDriveLoading] = useState(false);
  const [googleDriveImporting, setGoogleDriveImporting] = useState<
    string | null
  >(null);
  const [googleDriveError, setGoogleDriveError] = useState<string | null>(null);
  const [googleDriveTarget, setGoogleDriveTarget] = useState("master");

  // ── Google Photos ──
  const [googlePhotosPickerOpen, setGooglePhotosPickerOpen] = useState(false);
  const [googlePhotosNeedsConnection, setGooglePhotosNeedsConnection] =
    useState(false);
  const [googlePhotosReady, setGooglePhotosReady] = useState(false);
  const [googlePhotosChecking, setGooglePhotosChecking] = useState(false);
  const [googlePhotosLoading, setGooglePhotosLoading] = useState(false);
  const [googlePhotosError, setGooglePhotosError] = useState<string | null>(null);
  const [googlePhotosTarget, setGooglePhotosTarget] = useState("master");

  // ── YouTube ──
  const [youtubeOptions, setYoutubeOptions] = useState<YouTubeOptions>(
    YOUTUBE_DEFAULT_OPTIONS
  );

  // ── TikTok ──
  const [tiktokInfo, setTiktokInfo] = useState<TikTokCreatorInfo | null>(null);
  const [tiktokInfoError, setTiktokInfoError] = useState<string | null>(null);
  const [tiktokInfoAttempt, setTiktokInfoAttempt] = useState(0);
  const [tiktokMode, setTiktokMode] = useState<"direct" | "draft">("direct");
  const [tiktokOptions, setTiktokOptions] = useState<TikTokPostOptions>(
    TIKTOK_DEFAULT_OPTIONS
  );
  const [tiktokAllow, setTiktokAllow] = useState<TikTokAllow>(TIKTOK_DEFAULT_ALLOW);
  const [tiktokCommercial, setTiktokCommercial] = useState<TikTokCommercial>(
    TIKTOK_DEFAULT_COMMERCIAL
  );

  const tiktokSelected = networks.includes("tiktok");
  const youtubeSelected = networks.includes("youtube");

  const tiktokPrivacyOptions = useMemo<string[]>(() => {
    const fromInfo = tiktokInfo?.privacy_level_options;
    if (fromInfo && fromInfo.length > 0) return fromInfo as string[];
    if (tiktokInfoError || tiktokInfo) return TIKTOK_FALLBACK_PRIVACY;
    return [];
  }, [tiktokInfo, tiktokInfoError]);

  const connectedChannels = useConnectedChannels();
  useNewPostShortcut(() => onRequestOpen?.(), !isOpen && Boolean(onRequestOpen));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvaPopupMonitorRef = useRef<number | null>(null);
  const mediaRef = useRef<MediaItem[]>(media);
  mediaRef.current = media;
  const channelMediaRef = useRef(channelMedia);
  channelMediaRef.current = channelMedia;
  const uploadTargetRef = useRef<string>("master");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const closeWithDraftRef = useRef<() => void>(() => {});
  const submitRef = useRef<() => void>(() => {});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const caretRefs = useRef<Record<string, { start: number; end: number }>>({});

  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const onRequestOpenRef = useRef(onRequestOpen);
  onRequestOpenRef.current = onRequestOpen;
  // Suivi de l'état du formulaire, pour éviter d'écraser une saisie en cours
  // quand un brouillon persisté est chargé de façon asynchrone.
  const hasFormContentRef = useRef(false);

  const preselectRef = useRef<SocialNetworkId | null>(null);

  useEffect(
    () => () => {
      if (canvaPopupMonitorRef.current !== null) {
        window.clearInterval(canvaPopupMonitorRef.current);
      }
    },
    []
  );

  const timeMin = useMemo(() => {
    const now = new Date();
    return isSameCalendarDay(scheduledAt, now) ? now : undefined;
  }, [scheduledAt]);

  const timezone = useMemo(() => getLocalTimezone(), []);

  const channelTiles = useMemo<ChannelTileData[]>(() => {
    const tiles: ChannelTileData[] = [];

    for (const channel of connectedChannels) {
      const networkId = getNetworkId(channel);
      if (!networkId) continue;
      const order = SOCIAL_NETWORKS.findIndex((n) => n.id === networkId);
      if (order === -1) continue;
      tiles.push({ channel, network: SOCIAL_NETWORKS[order], order });
    }

    return tiles.sort((a, b) => a.order - b.order);
  }, [connectedChannels]);

  useEffect(() => {
    const handle = () => {
      if (!peekNewPostRequest()) return;
      if (!isOpenRef.current) onRequestOpenRef.current?.();
      setRequestTick((n) => n + 1);
    };

    const unsubscribe = subscribeNewPostRequests(handle);
    handle();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const request = peekNewPostRequest();
    if (!request) return;
    const tile = channelTiles.find((item) => item.channel.key === request.channelKey);
    if (!tile) return;

    clearNewPostRequest();
    preselectRef.current = tile.network.id;
    setNetworks([tile.network.id]);
  }, [isOpen, requestTick, channelTiles]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showSourceMenu) {
          setShowSourceMenu(null);
        } else if (activeEmojiNetwork) {
          setActiveEmojiNetwork(null);
        } else if (showActionMenu || showDateTimePanel) {
          setShowActionMenu(false);
          setShowDateTimePanel(false);
        } else {
          closeWithDraftRef.current();
        }
      } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        submitRef.current();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, showActionMenu, showDateTimePanel, activeEmojiNetwork, showSourceMenu]);

  // Focus le champ principal à l'ouverture (sauf si un brouillon est proposé)
  useEffect(() => {
    if (!isOpen || savedDraft) return;
    const id = requestAnimationFrame(() => textareaRefs.current.master?.focus());
    return () => cancelAnimationFrame(id);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      mediaRef.current.forEach((item) => URL.revokeObjectURL(item.url));
      Object.values(channelMediaRef.current).flat().forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  // Restaure un éventuel brouillon persisté (refresh, retour sur le site…)
  useEffect(() => {
    if (savedDraft) return; // déjà en mémoire (même session)
    let cancelled = false;
    (async () => {
      const persisted = await loadDraftFromStorage();
      if (cancelled || !persisted || !draftHasContent(persisted)) return;
      savedDraft = persisted;
      // Si le modal est déjà ouvert et que l'utilisateur n'a rien saisi,
      // on lui propose tout de suite de reprendre.
      if (isOpenRef.current && !hasFormContentRef.current) {
        setPendingDraft(persisted);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPendingDraft(isOpen ? savedDraft : null);
  }, [isOpen]);

  const initialScheduledTime = initialScheduledAt
    ? initialScheduledAt.getTime()
    : null;

  useEffect(() => {
    if (isOpen && initialScheduledTime !== null) {
      setScheduleAction("set_date");
      setScheduledAt(new Date(initialScheduledTime));
    }
  }, [isOpen, initialScheduledTime]);

  useEffect(() => {
    if (!showActionMenu && !showDateTimePanel) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setShowActionMenu(false);
        setShowDateTimePanel(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [showActionMenu, showDateTimePanel]);

  useEffect(() => {
    if (!activeEmojiNetwork) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".emoji-wrapper")) {
        setActiveEmojiNetwork(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [activeEmojiNetwork]);

  useEffect(() => {
    if (!showSourceMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".source-wrapper")) {
        setShowSourceMenu(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [showSourceMenu]);

  useEffect(() => {
    if (!isOpen || !tiktokSelected || tiktokInfo) return;
    let cancelled = false;

    getTikTokCreatorInfo()
      .then((info) => {
        if (cancelled) return;
        setTiktokInfo(info);
        setTiktokInfoError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setTiktokInfoError(
          e instanceof Error ? e.message : "Could not load TikTok settings."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, tiktokSelected, tiktokInfo, tiktokInfoAttempt]);

  if (!isOpen) return null;

  /* ── Contenu : le texte principal est la source, chaque réseau peut le surcharger ── */

  const isDragging = draggingTarget === "master";
  const mediaFor = (id: string): MediaItem[] => channelMedia[id] ?? media;

  const contentFor = (id: string): string => contents[id] ?? masterContent;
  const isCustomized = (id: string): boolean =>
    contents[id] !== undefined && contents[id] !== masterContent;

  const strictestLimit = networks.length
    ? Math.min(...networks.map((n) => CHAR_LIMITS[n]))
    : undefined;

  const overLimitNetworks = networks.filter(
    (n) => contentFor(n).length > CHAR_LIMITS[n]
  );

  const hasContent =
    masterContent.trim().length > 0 ||
    networks.some((n) => contentFor(n).trim().length > 0);

  const hasDraftContent =
    hasContent ||
    Object.values(contents).some((c) => c.trim().length > 0) ||
    title.trim().length > 0 ||
    media.length > 0 ||
    Object.keys(channelMedia).length > 0;

  hasFormContentRef.current = hasDraftContent;

  const clearForm = () => {
    media.forEach((item) => URL.revokeObjectURL(item.url));
    Object.values(channelMedia).flat().forEach((item) => URL.revokeObjectURL(item.url));
    setChannelMedia({});
    setDraggingTarget(null);
    setMasterContent("");
    setContents({});
    setTitle("");
    setNetworks([]);
    setScheduleAction("now");
    setScheduledAt(defaultScheduledDate());
    setMedia([]);
    setMediaError(null);
    setIsSubmitting(false);
    setIsFullscreen(false);
    setShowActionMenu(false);
    setShowDateTimePanel(false);
    setEditingItem(null);
    setSubmitError(null);
    setSubmitProgress(null);
    setActiveEmojiNetwork(null);
    setShowSourceMenu(null);
    setCanvaBusy(null);
    setCanvaDesigns([]);
    setDropboxPickerOpen(false);
    setDropboxNeedsConnection(false);
    setDropboxFiles([]);
    setDropboxPath("");
    setDropboxCursor(null);
    setDropboxHasMore(false);
    setDropboxLoading(false);
    setDropboxImporting(null);
    setDropboxError(null);
    setDropboxTarget("master");
    setGoogleDrivePickerOpen(false);
    setGoogleDriveNeedsConnection(false);
    setGoogleDriveFiles([]);
    setGoogleDriveFolders([{ id: "", name: "My Drive" }]);
    setGoogleDriveCursor(null);
    setGoogleDriveHasMore(false);
    setGoogleDriveLoading(false);
    setGoogleDriveImporting(null);
    setGoogleDriveError(null);
    setGoogleDriveTarget("master");
    setGooglePhotosPickerOpen(false);
    setGooglePhotosNeedsConnection(false);
    setGooglePhotosReady(false);
    setGooglePhotosChecking(false);
    setGooglePhotosLoading(false);
    setGooglePhotosError(null);
    setGooglePhotosTarget("master");
    setCollapsedCards({});
    setPreviewNetwork(null);
    setTiktokInfo(null);
    setTiktokInfoError(null);
    setTiktokMode("direct");
    setTiktokOptions(TIKTOK_DEFAULT_OPTIONS);
    setTiktokAllow(TIKTOK_DEFAULT_ALLOW);
    setTiktokCommercial(TIKTOK_DEFAULT_COMMERCIAL);
    setYoutubeOptions(YOUTUBE_DEFAULT_OPTIONS);
    caretRefs.current = {};
    preselectRef.current = null;
  };

  const discardAndClose = () => {
    savedDraft = null;
    void clearDraftFromStorage();
    clearForm();
    onClose();
  };

  const closeWithDraft = () => {
    if (isSubmitting) return;

    // Si le dialogue « Resume / Start fresh » est encore affiché et que
    // l'utilisateur ferme sans choisir : on conserve le brouillon tel quel.
    if (pendingDraft && !hasDraftContent) {
      savedDraft = pendingDraft;
      clearForm();
      onClose();
      return;
    }

    if (hasDraftContent) {
      const draft: DraftData = {
        title,
        masterContent,
        contents,
        networks,
        scheduleAction,
        scheduledAt: scheduledAt.getTime(),
        files: media.map((m) => m.file),
        channelFiles: Object.fromEntries(
          Object.entries(channelMedia).map(([k, v]) => [k, v.map((m) => m.file)])
        ),
        youtubeOptions,
      };
      savedDraft = draft;
      void persistDraftToStorage(draft); // fire-and-forget
    } else {
      // Plus de contenu → on efface le brouillon persisté.
      savedDraft = null;
      void clearDraftFromStorage();
    }

    clearForm();
    onClose();
  };
  closeWithDraftRef.current = closeWithDraft;

  const resumeDraft = () => {
    if (!pendingDraft) return;
    setTitle(pendingDraft.title);
    setMasterContent(pendingDraft.masterContent || "");
    setContents(pendingDraft.contents || {});
    setNetworks(
      preselectRef.current ? [preselectRef.current] : pendingDraft.networks
    );
    setScheduleAction(pendingDraft.scheduleAction);
    setScheduledAt(new Date(pendingDraft.scheduledAt));
    setYoutubeOptions(pendingDraft.youtubeOptions ?? YOUTUBE_DEFAULT_OPTIONS);
    setMedia(
      pendingDraft.files.map((file) => ({
        id: makeId(),
        file,
        url: URL.createObjectURL(file),
        kind: file.type.startsWith("video/") ? "video" : "image",
      }))
    );
    setChannelMedia(
      Object.fromEntries(
        Object.entries(pendingDraft.channelFiles ?? {}).map(([k, files]) => [
          k,
          files.map((file) => ({
            id: makeId(),
            file,
            url: URL.createObjectURL(file),
            kind: (file.type.startsWith("video/") ? "video" : "image") as MediaKind,
          })),
        ])
      )
    );
    caretRefs.current = {};
    savedDraft = null;
    setPendingDraft(null);
  };

  const ignoreDraft = () => {
    savedDraft = null;
    setPendingDraft(null);
    void clearDraftFromStorage(); // l'utilisateur refuse le brouillon
  };

  const updateCaret = (target: string, el: HTMLTextAreaElement) => {
    caretRefs.current[target] = { start: el.selectionStart, end: el.selectionEnd };
  };

  const handleMasterChange = (val: string) => {
    const previous = masterContent;
    setMasterContent(val);
    // Les réseaux qui suivaient encore le texte principal continuent de le suivre ;
    // ceux qui ont été personnalisés gardent leur version.
    setContents((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key] === previous) delete next[key];
      }
      return next;
    });
  };

  const handleNetworkChange = (networkId: string, val: string) => {
    setContents((prev) => {
      const next = { ...prev };
      if (val === masterContent) delete next[networkId];
      else next[networkId] = val;
      return next;
    });
  };

  const resetToMaster = (networkId: string) => {
    setContents((prev) => {
      const next = { ...prev };
      delete next[networkId];
      return next;
    });
  };

  const insertAtCursor = (target: string, text: string) => {
    const current = target === "master" ? masterContent : contentFor(target);
    const caret = caretRefs.current[target] ?? {
      start: current.length,
      end: current.length,
    };
    const start = Math.min(caret.start, current.length);
    const end = Math.min(Math.max(caret.end, start), current.length);
    const next = current.slice(0, start) + text + current.slice(end);
    const position = start + text.length;

    if (target === "master") handleMasterChange(next);
    else handleNetworkChange(target, next);

    caretRefs.current[target] = { start: position, end: position };
    setActiveEmojiNetwork(null);

    requestAnimationFrame(() => {
      const el = textareaRefs.current[target];
      if (!el) return;
      el.focus();
      el.setSelectionRange(position, position);
    });
  };

  const toggleNetwork = (id: SocialNetworkId) => {
    if (id === "tiktok" && networks.includes("tiktok")) {
      setTiktokInfo(null);
      setTiktokInfoError(null);
    }

    setNetworks((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  };

  const allSelected =
    channelTiles.length > 0 &&
    channelTiles.every((t) => networks.includes(t.network.id));

  const toggleAllNetworks = () => {
    if (allSelected) {
      setNetworks([]);
      setTiktokInfo(null);
      setTiktokInfoError(null);
    } else {
      setNetworks(Array.from(new Set(channelTiles.map((t) => t.network.id))));
    }
  };

  const handleConnectChannel = () => {
    closeWithDraft();
    navigate("channels");
  };

  const toggleCollapse = (id: string) => {
    setCollapsedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const addFiles = (fileList: FileList | File[], target: string = "master") => {
    const all = Array.from(fileList);
    const incoming = all.filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
    );
    const current =
      target === "master" ? mediaRef.current : channelMediaRef.current[target] ?? [];
    const room = Math.max(MAX_MEDIA - current.length, 0);
    const accepted = incoming.slice(0, room);

    if (incoming.length > accepted.length) {
      setMediaError({ target, message: `You can add up to ${MAX_MEDIA} files per post.` });
    } else if (incoming.length < all.length) {
      setMediaError({ target, message: "Only images and videos are supported." });
    } else {
      setMediaError(null);
    }

    if (accepted.length === 0) return;

    const newItems: MediaItem[] = accepted.map((file) => ({
      id: makeId(),
      file,
      url: URL.createObjectURL(file),
      kind: file.type.startsWith("video/") ? "video" : "image",
    }));

    if (target === "master") {
      setMedia((prev) => [...prev, ...newItems]);
    } else {
      setChannelMedia((prev) => ({
        ...prev,
        [target]: [...(prev[target] ?? []), ...newItems],
      }));
    }
  };

  const loadDropboxFolder = async (
    path: string,
    cursor?: string,
    append = false
  ) => {
    setDropboxLoading(true);
    setDropboxError(null);
    try {
      const page = await listDropboxFiles(path, cursor);
      setDropboxFiles((current) =>
        append ? [...current, ...page.entries] : page.entries
      );
      setDropboxPath(path);
      setDropboxCursor(page.cursor || null);
      setDropboxHasMore(page.has_more);
    } catch (error) {
      setDropboxError(
        error instanceof Error ? error.message : "Unable to load Dropbox files."
      );
    } finally {
      setDropboxLoading(false);
    }
  };

  const openDropboxPicker = async (target: string) => {
    setDropboxTarget(target);
    setDropboxPickerOpen(true);
    setDropboxNeedsConnection(false);
    setDropboxFiles([]);
    setDropboxPath("");
    setDropboxError(null);
    setDropboxLoading(true);

    try {
      const status = await getDropboxStatus();
      if (!status.connected) {
        setDropboxNeedsConnection(true);
        return;
      }
      await loadDropboxFolder("");
    } catch (error) {
      setDropboxError(
        error instanceof Error ? error.message : "Unable to connect to Dropbox."
      );
    } finally {
      setDropboxLoading(false);
    }
  };

  const handleDropboxConnect = async () => {
    setDropboxError(null);
    setDropboxLoading(true);
    try {
      const { url } = await getDropboxAuthUrl();
      const authUrl = new URL(url);
      const hostname = authUrl.hostname.toLowerCase();
      if (
        authUrl.protocol !== "https:" ||
        (hostname !== "dropbox.com" && !hostname.endsWith(".dropbox.com"))
      ) {
        throw new Error("The Dropbox authorization link is invalid.");
      }
      window.location.assign(authUrl.toString());
    } catch (error) {
      setDropboxError(
        error instanceof Error ? error.message : "Unable to start Dropbox connection."
      );
      setDropboxLoading(false);
    }
  };

  const handleDropboxImport = async (entry: DropboxFileEntry) => {
    const current =
      dropboxTarget === "master"
        ? mediaRef.current
        : channelMediaRef.current[dropboxTarget] ?? [];
    if (current.length >= MAX_MEDIA) {
      setMediaError({
        target: dropboxTarget,
        message: `You can add up to ${MAX_MEDIA} files per post.`,
      });
      return;
    }

    setDropboxImporting(entry.path_lower);
    setDropboxError(null);
    try {
      const file = await downloadDropboxFile(entry);
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        throw new Error("Only image and video files can be added to a post.");
      }
      addFiles([file], dropboxTarget);
    } catch (error) {
      setDropboxError(
        error instanceof Error ? error.message : "Unable to import this Dropbox file."
      );
    } finally {
      setDropboxImporting(null);
    }
  };

  const loadGoogleDriveFolder = async (
    folderId: string,
    cursor?: string,
    append = false
  ) => {
    setGoogleDriveLoading(true);
    setGoogleDriveError(null);
    try {
      const page = await listGoogleDriveFiles(folderId, cursor);
      setGoogleDriveFiles((current) =>
        append ? [...current, ...page.entries] : page.entries
      );
      setGoogleDriveCursor(page.cursor || null);
      setGoogleDriveHasMore(page.has_more);
    } catch (error) {
      setGoogleDriveError(
        error instanceof Error
          ? error.message
          : "Unable to load Google Drive files."
      );
    } finally {
      setGoogleDriveLoading(false);
    }
  };

  const openGoogleDrivePicker = async (target: string) => {
    setGoogleDriveTarget(target);
    setGoogleDrivePickerOpen(true);
    setGoogleDriveNeedsConnection(false);
    setGoogleDriveFiles([]);
    setGoogleDriveFolders([{ id: "", name: "My Drive" }]);
    setGoogleDriveError(null);
    setGoogleDriveLoading(true);

    try {
      const status = await getGoogleDriveStatus();
      if (!status.connected) {
        setGoogleDriveNeedsConnection(true);
        return;
      }
      await loadGoogleDriveFolder("");
    } catch (error) {
      setGoogleDriveError(
        error instanceof Error
          ? error.message
          : "Unable to connect to Google Drive."
      );
    } finally {
      setGoogleDriveLoading(false);
    }
  };

  const handleGoogleDriveConnect = async () => {
    setGoogleDriveError(null);
    setGoogleDriveLoading(true);
    try {
      const { url } = await getGoogleDriveAuthUrl();
      const authUrl = new URL(url);
      const hostname = authUrl.hostname.toLowerCase();
      if (
        authUrl.protocol !== "https:" ||
        (hostname !== "accounts.google.com" &&
          !hostname.endsWith(".accounts.google.com"))
      ) {
        throw new Error("The Google Drive authorization link is invalid.");
      }
      window.location.assign(authUrl.toString());
    } catch (error) {
      setGoogleDriveError(
        error instanceof Error
          ? error.message
          : "Unable to start Google Drive connection."
      );
      setGoogleDriveLoading(false);
    }
  };

  const handleGoogleDriveImport = async (entry: GoogleDriveFileEntry) => {
    const current =
      googleDriveTarget === "master"
        ? mediaRef.current
        : channelMediaRef.current[googleDriveTarget] ?? [];
    if (current.length >= MAX_MEDIA) {
      setMediaError({
        target: googleDriveTarget,
        message: `You can add up to ${MAX_MEDIA} files per post.`,
      });
      return;
    }

    setGoogleDriveImporting(entry.id);
    setGoogleDriveError(null);
    try {
      const file = await downloadGoogleDriveFile(entry);
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        throw new Error("Only image and video files can be added to a post.");
      }
      addFiles([file], googleDriveTarget);
    } catch (error) {
      setGoogleDriveError(
        error instanceof Error
          ? error.message
          : "Unable to import this Google Drive file."
      );
    } finally {
      setGoogleDriveImporting(null);
    }
  };

  const openGooglePhotosPicker = async (target: string) => {
    setGooglePhotosTarget(target);
    setGooglePhotosPickerOpen(true);
    setGooglePhotosNeedsConnection(false);
    setGooglePhotosReady(false);
    setGooglePhotosError(null);
    setGooglePhotosChecking(true);
    setGooglePhotosLoading(true);

    try {
      const status = await getGooglePhotosStatus();
      if (status.connected) setGooglePhotosReady(true);
      else setGooglePhotosNeedsConnection(true);
    } catch (error) {
      setGooglePhotosError(
        error instanceof Error
          ? error.message
          : "Unable to check Google Photos connection."
      );
    } finally {
      setGooglePhotosChecking(false);
      setGooglePhotosLoading(false);
    }
  };

  const handleGooglePhotosConnect = async () => {
    setGooglePhotosError(null);
    setGooglePhotosLoading(true);
    try {
      const { url } = await getGooglePhotosAuthUrl();
      const authUrl = new URL(url);
      const hostname = authUrl.hostname.toLowerCase();
      if (
        authUrl.protocol !== "https:" ||
        (hostname !== "accounts.google.com" &&
          !hostname.endsWith(".accounts.google.com"))
      ) {
        throw new Error("The Google Photos authorization link is invalid.");
      }
      window.location.assign(authUrl.toString());
    } catch (error) {
      setGooglePhotosError(
        error instanceof Error
          ? error.message
          : "Unable to start Google Photos connection."
      );
      setGooglePhotosLoading(false);
    }
  };

  const handleGooglePhotosPick = async () => {
    const current =
      googlePhotosTarget === "master"
        ? mediaRef.current
        : channelMediaRef.current[googlePhotosTarget] ?? [];
    const remaining = MAX_MEDIA - current.length;
    if (remaining <= 0) {
      setMediaError({
        target: googlePhotosTarget,
        message: `You can add up to ${MAX_MEDIA} files per post.`,
      });
      return;
    }

    const popup = window.open("", "_blank", "popup,width=520,height=720");
    if (!popup) {
      setGooglePhotosError(
        "The Google Photos picker was blocked. Allow pop-ups and try again."
      );
      return;
    }

    setGooglePhotosLoading(true);
    setGooglePhotosError(null);
    try {
      const pickedItems = await pickFromGooglePhotos(popup);
      if (pickedItems.length > remaining) {
        setMediaError({
          target: googlePhotosTarget,
          message: `Only ${remaining} more file${remaining === 1 ? "" : "s"} can be added to this post.`,
        });
      }

      for (const item of pickedItems.slice(0, remaining)) {
        const file = await downloadGooglePhotosItem(item);
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
          throw new Error("Only image and video files can be added to a post.");
        }
        addFiles([file], googlePhotosTarget);
      }
      if (pickedItems.length > 0) setGooglePhotosPickerOpen(false);
    } catch (error) {
      setGooglePhotosError(
        error instanceof Error
          ? error.message
          : "Unable to import media from Google Photos."
      );
    } finally {
      setGooglePhotosLoading(false);
    }
  };

  const handleSourcePick = (id: MediaSourceId) => {
    const source = MEDIA_SOURCES.find((m) => m.id === id);
    const target = showSourceMenu ?? "master";
    setShowSourceMenu(null);
    if (id === "dropbox") {
      void openDropboxPicker(target);
      return;
    }
    if (id === "google_drive") {
      void openGoogleDrivePicker(target);
      return;
    }
    if (id === "google_photos") {
      void openGooglePhotosPicker(target);
      return;
    }
    // TODO: brancher l'import réel (OAuth + sélecteur) pour chaque source.
    setMediaError({
      target,
      message: `${source?.label ?? "This source"} import isn't connected yet.`,
    });
  };

  /* ── Canva ──
     1. L'utilisateur choisit une taille dans le sous-menu.
     2. Une fenêtre est ouverte tout de suite (dans le clic, sinon le navigateur
        la bloque), puis le serveur crée un design vide chez Canva.
     3. Si le compte Canva n'est pas relié, la même fenêtre sert à l'autorisation
        OAuth ; on attend la connexion puis on crée le design.
     4. La fenêtre est redirigée vers l'éditeur Canva. Le design apparaît dans
        la zone média avec un bouton « Import design » : il est exporté en PNG
        et ajouté aux médias. */

  const handleCanvaPick = async (size: CanvaSize) => {
    const target = showSourceMenu ?? "master";
    setShowSourceMenu(null);
    setMediaError(null);

    if (canvaBusy) return;

    const win = openCanvaPopup();
    if (!win) {
      setMediaError({
        target,
        message:
          "Your browser blocked the Canva window. Allow pop-ups for this site, then try again.",
      });
      return;
    }
    win.document.body.innerText = "Opening Canva…";

    setCanvaBusy(target);

    try {
      let design;

      try {
        design = await createCanvaDesign(size);
      } catch (error) {
        if (!(error instanceof CanvaError && error.needsConnection)) throw error;

        win.location.href = await getCanvaAuthUrl();

        const connected = await waitForCanvaConnection(win);
        if (!connected) throw new Error("The Canva connection wasn't completed.");

        design = await createCanvaDesign(size);
      }

      if (!win.closed) {
        win.location.href = design.editUrl;

        if (canvaPopupMonitorRef.current !== null) {
          window.clearInterval(canvaPopupMonitorRef.current);
        }

        let hasLeftStone = false;
        canvaPopupMonitorRef.current = window.setInterval(() => {
          if (win.closed) {
            if (canvaPopupMonitorRef.current !== null) {
              window.clearInterval(canvaPopupMonitorRef.current);
              canvaPopupMonitorRef.current = null;
            }
            return;
          }

          try {
            const returnedToStone = win.location.origin === window.location.origin;
            if (!returnedToStone) {
              hasLeftStone = true;
              return;
            }

            if (hasLeftStone) {
              win.close();
              if (canvaPopupMonitorRef.current !== null) {
                window.clearInterval(canvaPopupMonitorRef.current);
                canvaPopupMonitorRef.current = null;
              }
            }
          } catch {
            hasLeftStone = true;
          }
        }, 500);
      }

      setCanvaDesigns((prev) => [
        ...prev,
        {
          designId: design.designId,
          target,
          label: `${size.label} ${size.ratio}`,
          editUrl: design.editUrl,
          importing: false,
        },
      ]);
    } catch (error) {
      win?.close();
      setMediaError({
        target,
        message:
          error instanceof Error ? error.message : "Could not open Canva. Please try again.",
      });
    } finally {
      setCanvaBusy(null);
    }
  };

  const handleCanvaImport = async (designId: string) => {
    const item = canvaDesigns.find((d) => d.designId === designId);
    if (!item || item.importing) return;

    setMediaError(null);
    setCanvaDesigns((prev) =>
      prev.map((d) => (d.designId === designId ? { ...d, importing: true } : d))
    );

    try {
      const files = await importCanvaDesign(designId, item.label);
      addFiles(files, item.target);
      setCanvaDesigns((prev) => prev.filter((d) => d.designId !== designId));
    } catch (error) {
      setMediaError({
        target: item.target,
        message:
          error instanceof Error
            ? error.message
            : "Could not import the design from Canva.",
      });
      setCanvaDesigns((prev) =>
        prev.map((d) => (d.designId === designId ? { ...d, importing: false } : d))
      );
    }
  };

  const dismissCanvaDesign = (designId: string) => {
    setCanvaDesigns((prev) => prev.filter((d) => d.designId !== designId));
  };

  const removeMedia = (id: string) => {
    const all = [...mediaRef.current, ...Object.values(channelMediaRef.current).flat()];
    const found = all.find((item) => item.id === id);
    if (found) URL.revokeObjectURL(found.url);

    setMedia((prev) => prev.filter((item) => item.id !== id));
    setChannelMedia((prev) => {
      const next: Record<string, MediaItem[]> = {};
      for (const [key, list] of Object.entries(prev)) {
        const kept = list.filter((item) => item.id !== id);
        // Un réseau sans média propre retombe sur les médias partagés.
        if (kept.length > 0) next[key] = kept;
      }
      return next;
    });
    setMediaError(null);
  };

  const resetChannelMedia = (target: string) => {
    (channelMediaRef.current[target] ?? []).forEach((item) => URL.revokeObjectURL(item.url));
    setChannelMedia((prev) => {
      const next = { ...prev };
      delete next[target];
      return next;
    });
    setMediaError(null);
  };

  const handleApplyMediaEdit = (id: string, newFile: File, newUrl: string) => {
    const apply = (list: MediaItem[]) =>
      list.map((item) => {
        if (item.id !== id) return item;
        URL.revokeObjectURL(item.url);
        return { ...item, file: newFile, url: newUrl };
      });
    setMedia(apply);
    setChannelMedia((prev) =>
      Object.fromEntries(Object.entries(prev).map(([k, list]) => [k, apply(list)]))
    );
    setEditingItem(null);
  };

  /* ── TikTok ── */

  const tiktokMedia = mediaFor("tiktok");
  const tiktokVideo = tiktokMedia.find((m) => m.kind === "video")?.file ?? null;
  const tiktokImages = tiktokMedia.filter((m) => m.kind === "image");
  const tiktokPostType: "video" | "photo" | null = tiktokVideo
    ? "video"
    : tiktokImages.length > 0
    ? "photo"
    : null;

  const tiktokTypeLabel =
    tiktokPostType === "photo"
      ? tiktokImages.length > 1
        ? `Carousel of ${tiktokImages.length} photos`
        : "Photo post"
      : tiktokPostType === "video"
      ? tiktokImages.length > 0
        ? "Video post (photos are ignored)"
        : "Video post"
      : "Add a video, or one or more photos.";

  const brandedChosen =
    tiktokMode === "direct" && tiktokCommercial.on && tiktokCommercial.branded;

  const tiktokBlockingReason: string | null = !tiktokSelected
    ? null
    : scheduleAction === "set_date"
    ? "TikTok doesn't support scheduling. Choose “Now” or remove TikTok."
    : scheduleAction === "save_in_folder"
    ? null
    : !tiktokPostType
    ? "TikTok needs a video or at least one photo."
    : tiktokMode === "direct" && !tiktokOptions.privacy_level
    ? tiktokPrivacyOptions.length === 0 && !tiktokInfoError
      ? "Loading TikTok settings…"
      : "Choose who can view your TikTok."
    : tiktokMode === "direct" &&
      tiktokCommercial.on &&
      !tiktokCommercial.yourBrand &&
      !tiktokCommercial.branded
    ? "Say whether your TikTok promotes yourself, a third party, or both."
    : null;

  /* ── YouTube ── */

  const primaryContent = masterContent || (networks[0] ? contentFor(networks[0]) : "");

  const youtubeFallbackTitle = (
    title.trim() ||
    primaryContent.trim().split("\n")[0] ||
    ""
  ).slice(0, YOUTUBE_TITLE_MAX);

  const youtubeEffectiveTitle = (
    youtubeOptions.title.trim() || youtubeFallbackTitle
  ).slice(0, YOUTUBE_TITLE_MAX);

  const youtubeBlockingReason: string | null = !youtubeSelected
    ? null
    : scheduleAction === "save_in_folder"
    ? null
    : !youtubeEffectiveTitle
    ? "Add a title for your YouTube Shorts video."
    : null;

  const updateYoutube = <K extends keyof YouTubeOptions>(
    key: K,
    value: YouTubeOptions[K]
  ) => setYoutubeOptions((o) => ({ ...o, [key]: value }));

  /* ── Validation : une seule raison lisible, affichée dans le footer ── */

  const labelOf = (id: SocialNetworkId) =>
    SOCIAL_NETWORKS.find((n) => n.id === id)?.label ?? id;

  const blockingReason: string | null =
    networks.length === 0
      ? "Select at least one channel."
      : !hasContent && !networks.some((n) => mediaFor(n).length > 0)
      ? "Write something or add media."
      : scheduleAction === "set_date" && scheduledAt.getTime() <= Date.now()
      ? "Pick a date and time in the future."
      : overLimitNetworks.length > 0
      ? `Too long for ${overLimitNetworks.map(labelOf).join(", ")}.`
      : tiktokBlockingReason || youtubeBlockingReason || null;

  const canSubmit = !blockingReason && !isSubmitting;

  const showTikTokDeclaration = tiktokSelected && scheduleAction === "now";

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const resolved: Record<string, string> = {};
    networks.forEach((n) => {
      resolved[n] = contentFor(n);
    });

    const allTexts = Object.values(resolved).join(" ");
    const extractedHashtags = Array.from(
      new Set(
        (allTexts.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.slice(1))
      )
    );

    const tiktokNow = tiktokSelected && scheduleAction === "now";
    const remainingNetworks = tiktokNow
      ? networks.filter((n) => n !== "tiktok")
      : networks;

    const mediaByNetwork: Partial<Record<SocialNetworkId, File[]>> = {};
    remainingNetworks.forEach((n) => {
      const own = channelMedia[n];
      if (own) mediaByNetwork[n] = own.map((item) => item.file);
    });

    const payload: NewPostPayload = {
      title: title.trim(),
      content: resolved[remainingNetworks[0]]?.trim() || masterContent.trim() || "",
      contents: resolved,
      hashtags: extractedHashtags,
      networks: remainingNetworks,
      scheduleMode: scheduleAction === "set_date" ? "later" : scheduleAction,
      scheduledAt:
        scheduleAction === "set_date" ? scheduledAt.toISOString() : null,
      media: media.map((item) => item.file),
      ...(Object.keys(mediaByNetwork).length > 0 ? { mediaByNetwork } : {}),
      ...(remainingNetworks.includes("youtube")
        ? { youtube: { ...youtubeOptions, title: youtubeEffectiveTitle } }
        : {}),
    };

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      setSubmitProgress(null);

      if (tiktokNow && tiktokPostType) {
        const tiktokCaption = resolved["tiktok"]?.trim() || "";
        const isPhoto = tiktokPostType === "photo";

        if (tiktokVideo) {
          const maxDuration = (
            tiktokInfo as unknown as { max_video_post_duration_sec?: number } | null
          )?.max_video_post_duration_sec;

          if (maxDuration) {
            const duration = await getVideoDuration(tiktokVideo);
            if (duration > maxDuration) {
              throw new Error(
                `This video is too long for your TikTok account (max ${formatDuration(maxDuration)}).`
              );
            }
          }
        }

        const options: TikTokPostOptions = {
          ...tiktokOptions,
          disable_comment:
            !tiktokAllow.comment || Boolean(tiktokInfo?.comment_disabled),
          disable_duet:
            isPhoto || !tiktokAllow.duet || Boolean(tiktokInfo?.duet_disabled),
          disable_stitch:
            isPhoto || !tiktokAllow.stitch || Boolean(tiktokInfo?.stitch_disabled),
          brand_content_toggle:
            tiktokMode === "direct" &&
            tiktokCommercial.on &&
            tiktokCommercial.branded,
          brand_organic_toggle:
            tiktokMode === "direct" &&
            tiktokCommercial.on &&
            tiktokCommercial.yourBrand,
        };

        let publishId: string;

        if (isPhoto) {
          setSubmitProgress(
            tiktokImages.length > 1
              ? "Preparing your carousel…"
              : "Preparing your photo…"
          );

          const photos = await Promise.all(
            tiktokImages.map((item) => toTikTokImage(item.file))
          );

          setSubmitProgress("Uploading photos to TikTok…");

          publishId = await publishPhotosToTikTok({
            photos,
            caption: tiktokCaption,
            mode: tiktokMode,
            options,
          });
        } else {
          setSubmitProgress("Uploading video to TikTok…");

          publishId = await publishToTikTok({
            video: tiktokVideo as File,
            caption: tiktokCaption,
            mode: tiktokMode,
            options,
          });
        }

        await waitForTikTokPublish(publishId, (status) => {
          setSubmitProgress(
            status === "PROCESSING_UPLOAD" || status === "PROCESSING_DOWNLOAD"
              ? "TikTok is processing your content…"
              : "Finalizing…"
          );
        });

        // TikTok est déjà parti : on le retire pour ne pas le renvoyer en cas de nouvel essai.
        setNetworks((prev) => prev.filter((n) => n !== "tiktok"));
      }

      if (
        remainingNetworks.length > 0 ||
        scheduleAction === "save_in_folder"
      ) {
        await onSubmit(payload);
      }

      discardAndClose();
    } catch (error) {
      console.error("Error while creating the post:", error);

      const raw = error instanceof Error ? error.message : "";
      const message = /too_many_posts|spam_risk/i.test(raw)
        ? "This TikTok account has reached its posting limit for now. Please try again later."
        : raw || "Something went wrong while publishing.";

      setSubmitError(message);
      setSubmitProgress(null);
      setIsSubmitting(false);
    }
  };
  submitRef.current = handleSubmit;

  const selectAction = (action: ScheduleAction) => {
    setScheduleAction(action);
    setShowActionMenu(false);
    setShowDateTimePanel(action === "set_date");
  };

  const applyPostingSlot = (hour: number, minute: number) => {
    setScheduledAt((prev) => {
      const next = new Date(prev);
      next.setHours(hour, minute, 0, 0);
      return next;
    });
  };

  const footerLabel =
    scheduleAction === "set_date"
      ? formatShortDateTime(scheduledAt)
      : scheduleAction === "save_in_folder"
      ? "Save in folder"
      : "Now";

  const submitLabel = isSubmitting
    ? scheduleAction === "save_in_folder"
      ? "Saving…"
      : scheduleAction === "set_date"
      ? "Scheduling…"
      : "Publishing…"
    : scheduleAction === "now"
    ? tiktokSelected && tiktokMode === "draft"
      ? "Send to TikTok"
      : "Post now"
    : scheduleAction === "save_in_folder"
    ? "Save post"
    : "Schedule post";

  // ── Thèmes ──
  const bgModal = isDark ? "bg-[#141416]" : "bg-white";
  const bgPanel = isDark ? "bg-[#1c1c1e]" : "bg-neutral-50";
  const bgCard = isDark ? "bg-[#1c1c1e]" : "bg-neutral-50";
  const border = isDark ? "border-white/10" : "border-black/[0.06]";
  const textPrimary = isDark ? "text-white" : "text-neutral-900";
  const textSecondary = isDark ? "text-neutral-400" : "text-neutral-500";
  const hoverSoft = isDark ? "hover:bg-white/10 hover:text-white" : "hover:bg-black/5 hover:text-neutral-900";

  const accentBg = isDark ? "bg-white/10" : "bg-neutral-200";
  const accentText = isDark ? "text-white" : "text-neutral-900";
  const accentCheck = isDark ? "text-white" : "text-neutral-900";
  const accentSolid = isDark ? "bg-white/5" : "bg-neutral-100";
  const accentBorder = isDark ? "border-white/15" : "border-black/10";

  const allowRows: {
    key: keyof TikTokAllow;
    label: string;
    forced: boolean;
  }[] = [
    { key: "comment", label: "Allow comments", forced: Boolean(tiktokInfo?.comment_disabled) },
    ...(tiktokPostType === "photo"
      ? []
      : [
          { key: "duet" as const, label: "Allow duet", forced: Boolean(tiktokInfo?.duet_disabled) },
          { key: "stitch" as const, label: "Allow stitch", forced: Boolean(tiktokInfo?.stitch_disabled) },
        ]),
  ];

  const linkClass = "underline underline-offset-2 hover:opacity-80";

  const textareaClass = [
    "w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none",
    textPrimary,
    isDark ? "placeholder:text-neutral-600" : "placeholder:text-neutral-400",
  ].join(" ");

  // Aperçu : réseau actif (onglet), sinon le premier sélectionné
  const activePreviewId =
    previewNetwork && networks.includes(previewNetwork)
      ? previewNetwork
      : networks[0] ?? null;
  const previewNetworkData = activePreviewId
    ? SOCIAL_NETWORKS.find((n) => n.id === activePreviewId) ?? null
    : null;
  const previewChannel = activePreviewId
    ? channelTiles.find((t) => t.network.id === activePreviewId)?.channel
    : undefined;
  const previewText = activePreviewId ? contentFor(activePreviewId) : masterContent;
  const previewMedia = activePreviewId ? mediaFor(activePreviewId) : media;
  const previewHasSomething = previewText.trim().length > 0 || previewMedia.length > 0;

  const avatarRing = isDark ? "ring-[#1c1c1e]" : "ring-neutral-50";

  // Zone média (miniatures + tuile « Drag & drop ») : une pour le texte principal,
  // une par canal. Un canal sans média propre utilise les médias partagés.
  const renderMediaArea = (target: string) => {
    const isMaster = target === "master";
    const items = isMaster ? media : channelMedia[target] ?? [];
    const hasOwn = !isMaster && channelMedia[target] !== undefined;
    const error = mediaError?.target === target ? mediaError.message : null;
    const pendingCanva = canvaDesigns.filter((d) => d.target === target);

    return (
      <>
        {!isMaster && !hasOwn && media.length > 0 && (
          <p className={["mt-3 text-[12.5px]", textSecondary].join(" ")}>
            Using the shared media ({media.length}). Add files here to use different media for this channel.
          </p>
        )}

        {canvaBusy === target && (
          <p
            role="status"
            className={["mt-3 flex items-center gap-2 text-[12.5px]", textSecondary].join(" ")}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Opening Canva…
          </p>
        )}

        {pendingCanva.map((design) => (
          <div
            key={design.designId}
            className={[
              "mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-3",
              border,
              accentSolid,
            ].join(" ")}
          >
            <CanvaIcon
              className={["h-[18px] w-[18px] shrink-0", textPrimary].join(" ")}
              inner={isDark ? "#1c1c1e" : "#ffffff"}
            />
            <div className="min-w-0 flex-1">
              <p className={["truncate text-[13px] font-semibold", textPrimary].join(" ")}>
                Canva design · {design.label}
              </p>
              <p className={["text-[12px]", textSecondary].join(" ")}>
                Finish it in Canva, then import it into your post.
              </p>
            </div>
            <a
              href={design.editUrl}
              target="_blank"
              rel="noreferrer"
              className={["flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition", textSecondary, hoverSoft].join(" ")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Canva
            </a>
            <button
              type="button"
              onClick={() => handleCanvaImport(design.designId)}
              disabled={design.importing}
              className={[
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                isDark
                  ? "bg-white text-[#141416] hover:bg-neutral-200"
                  : "bg-neutral-900 text-white hover:bg-neutral-800",
              ].join(" ")}
            >
              {design.importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {design.importing ? "Importing…" : "Import design"}
            </button>
            <button
              type="button"
              aria-label="Dismiss Canva design"
              onClick={() => dismissCanvaDesign(design.designId)}
              disabled={design.importing}
              className={["flex h-7 w-7 items-center justify-center rounded-lg transition disabled:opacity-50", textSecondary, hoverSoft].join(" ")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <div className="mt-4 flex flex-wrap items-end gap-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="group relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-xl border border-black/5"
            >
              {item.kind === "image" ? (
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="relative h-full w-full">
                  <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                    <Play className="h-5 w-5 fill-current" />
                  </div>
                </div>
              )}
              {index === 0 && items.length > 1 && (
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Cover
                </span>
              )}
              <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
              <button
                type="button"
                aria-label="Remove media"
                onClick={() => removeMedia(item.id)}
                className="absolute right-1.5 top-1.5 z-30 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg bg-black/70 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/90 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
              {item.kind === "image" && (
                <button
                  type="button"
                  aria-label="Edit image"
                  onClick={() => setEditingItem(item)}
                  className="absolute bottom-1.5 right-1.5 z-30 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg bg-black/70 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/90 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              )}
            </div>
          ))}

          {items.length < MAX_MEDIA && (
            <button
              type="button"
              onClick={() => {
                uploadTargetRef.current = target;
                fileInputRef.current?.click();
              }}
              className={[
                "flex h-[104px] w-[104px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-2 text-center text-[12px] leading-tight transition-colors",
                isDark
                  ? "border-white/20 text-neutral-400 hover:border-white/40 hover:bg-white/5"
                  : "border-black/20 text-neutral-500 hover:border-black/40 hover:bg-white",
              ].join(" ")}
            >
              <ImagePlus className="h-6 w-6" strokeWidth={1.75} />
              <span>
                Drag &amp; drop or
                <br />
                <span className={["font-semibold", isDark ? "text-white" : "text-neutral-900"].join(" ")}>
                  select a file
                </span>
              </span>
            </button>
          )}
        </div>

        {hasOwn && (
          <button
            type="button"
            onClick={() => resetChannelMedia(target)}
            className={["mt-3 flex cursor-pointer items-center gap-1.5 self-start rounded-md px-2 py-1 text-[12px] font-semibold transition", textSecondary, hoverSoft].join(" ")}
          >
            <RotateCcw className="h-3 w-3" />
            Use shared media
          </button>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[12.5px] text-red-500">
            {error}
          </p>
        )}
      </>
    );
  };

  // Bouton « + » (sources de médias) : un par zone de texte, un seul menu ouvert à la fois.
  // Les médias restent partagés par tous les canaux.
  const renderSourceButton = (target: string) => {
    const open = showSourceMenu === target;
    return (
      <div className="source-wrapper relative">
        <button
          type="button"
          aria-label="Add media from…"
          title="Add media (shared by all channels)"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            setActiveEmojiNetwork(null);
            setShowSourceMenu(open ? null : target);
          }}
          className={[
            "flex h-8 w-8 items-center justify-center rounded-lg transition",
            open
              ? isDark ? "bg-white/10 text-white" : "bg-black/5 text-neutral-900"
              : `${textSecondary} ${hoverSoft}`,
          ].join(" ")}
        >
          <Plus className="h-4 w-4" />
        </button>
        {open && (
          <MediaSourceMenu
            isDark={isDark}
            onPick={handleSourcePick}
            onPickCanva={handleCanvaPick}
          />
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-md"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeWithDraft();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create post"
        className={[
          "relative flex flex-col overflow-hidden border",
          isFullscreen
            ? "h-[96vh] w-[96vw] rounded-[28px]"
            : "h-[90vh] w-full max-w-[1200px] rounded-[28px]",
          bgModal,
          border,
          isDark ? "shadow-[0_32px_80px_rgba(0,0,0,0.6)]" : "shadow-[0_32px_80px_rgba(0,0,0,0.22)]",
        ].join(" ")}
      >
        {/* ── Header ── */}
        <div className={["flex shrink-0 items-center justify-between border-b px-6 py-4", border].join(" ")}>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={closeWithDraft}
              className={["flex items-center gap-2 rounded-lg text-[17px] font-bold tracking-tight transition hover:opacity-70", textPrimary].join(" ")}
            >
              <ArrowLeft className="h-4 w-4" />
              Create post
            </button>
            <button
              type="button"
              disabled
              title="Coming soon"
              className={["flex cursor-not-allowed items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium opacity-50", border, textSecondary].join(" ")}
            >
              <Tag className="h-3.5 w-3.5" />
              Tags
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              title="Coming soon"
              className={["flex cursor-not-allowed items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium opacity-50", textSecondary].join(" ")}
            >
              <FileText className="h-4 w-4" />
              Templates
            </button>
            <div className={["mx-1 h-5 w-px", isDark ? "bg-white/10" : "bg-black/10"].join(" ")} />
            <button
              type="button"
              aria-pressed={showPreview}
              aria-label={showPreview ? "Hide preview" : "Show preview"}
              title={showPreview ? "Hide preview" : "Show preview"}
              onClick={() => setShowPreview((v) => !v)}
              className={["hidden h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition lg:flex", textSecondary, hoverSoft].join(" ")}
            >
              {showPreview ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              Preview
            </button>
            <button
              type="button"
              aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
              onClick={() => setIsFullscreen((v) => !v)}
              className={["flex h-8 w-8 items-center justify-center rounded-full transition", textSecondary, hoverSoft].join(" ")}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              aria-label="Close"
              title={hasDraftContent ? "Close (your draft is kept)" : "Close"}
              onClick={closeWithDraft}
              className={["flex h-8 w-8 items-center justify-center rounded-full transition", textSecondary, hoverSoft].join(" ")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Colonne gauche */}
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">

            {/* Canaux connectés */}
            <section aria-label="Channels">
              <div className="mb-3 flex items-center justify-between">
                <h2 className={["text-[13px] font-semibold", textPrimary].join(" ")}>
                  Post to
                  {networks.length > 0 && (
                    <span className={["ml-2 font-normal", textSecondary].join(" ")}>
                      {networks.length} selected
                    </span>
                  )}
                </h2>
                {channelTiles.length > 1 && (
                  <button
                    type="button"
                    onClick={toggleAllNetworks}
                    className={["rounded-md px-2 py-1 text-[12.5px] font-semibold transition", textSecondary, hoverSoft].join(" ")}
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {channelTiles.map(({ channel, network }) => (
                  <ChannelTile
                    key={channel.key}
                    channel={channel}
                    network={network}
                    isDark={isDark}
                    isSelected={networks.includes(network.id)}
                    onToggle={() => toggleNetwork(network.id)}
                  />
                ))}
                <button
                  type="button"
                  onClick={handleConnectChannel}
                  title="Connect a channel"
                  aria-label="Connect a channel"
                  className={[
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-dashed transition",
                    isDark
                      ? "border-white/20 text-neutral-400 hover:bg-white/5 hover:text-white"
                      : "border-black/20 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                  ].join(" ")}
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              {channelTiles.length === 0 && (
                <p className={["mt-3 text-[13px]", textSecondary].join(" ")}>
                  No channel connected yet. Connect one to start publishing.
                </p>
              )}
            </section>

            {/* Zone d'écriture principale */}
            <section
              aria-label="Post text and media"
              onDragOver={(e) => {
                e.preventDefault();
                setDraggingTarget("master");
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDraggingTarget(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDraggingTarget(null);
                if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
              }}
              className={[
                "relative flex flex-col rounded-2xl border p-5 transition-colors",
                isDragging
                  ? isDark
                    ? "border-white/40 bg-white/5"
                    : "border-neutral-400 bg-neutral-100"
                  : [border, bgCard].join(" "),
              ].join(" ")}
            >
              <div className="mb-3 flex items-center gap-3">
                {networks.length > 0 && (
                  <div className="flex items-center -space-x-2">
                    {networks.map((networkId) => {
                      const network = SOCIAL_NETWORKS.find((n) => n.id === networkId)!;
                      const channel = channelTiles.find((t) => t.network.id === networkId)?.channel;
                      return (
                        <Avatar
                          key={networkId}
                          channel={channel}
                          label={channelLabel(channel, network.label)}
                          Icon={network.Icon}
                          size="sm"
                          isDark={isDark}
                          ringClass={avatarRing}
                        />
                      );
                    })}
                  </div>
                )}
                <span className={["text-[15px] font-semibold", textPrimary].join(" ")}>
                  {networks.length > 1
                    ? "Write once, post everywhere"
                    : networks.length === 1
                    ? "Your post"
                    : "Write your post"}
                </span>
              </div>

              <AutoTextarea
                value={masterContent}
                onChange={handleMasterChange}
                onCaret={(el) => updateCaret("master", el)}
                textareaRef={(el) => {
                  textareaRefs.current.master = el;
                }}
                ariaLabel="Post text for all selected channels"
                placeholder="What do you want to share?"
                className={[textareaClass, "min-h-[150px]"].join(" ")}
              />

              {renderMediaArea("master")}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files, uploadTargetRef.current);
                  e.target.value = "";
                }}
              />

              {isDragging && (
                <div
                  className={[
                    "pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl text-[14px] font-semibold backdrop-blur-[1px]",
                    isDark ? "bg-black/50 text-white" : "bg-white/70 text-neutral-900",
                  ].join(" ")}
                >
                  Drop to add to your post
                </div>
              )}

              <ComposerToolbar
                isDark={isDark}
                emojiOpen={activeEmojiNetwork === "master"}
                onToggleEmoji={() =>
                  setActiveEmojiNetwork(activeEmojiNetwork === "master" ? null : "master")
                }
                onPickEmoji={(emoji) => insertAtCursor("master", emoji)}
                onHash={() => insertAtCursor("master", "#")}
                length={masterContent.length}
                limit={strictestLimit}
                leading={renderSourceButton("master")}
              />
            </section>

            {/* Cartes par réseau */}
            {networks.length > 0 ? (
              <section aria-label="Customize per channel" className="flex flex-col gap-4">
                <div>
                  <h2 className={["text-[15px] font-semibold", textPrimary].join(" ")}>
                    Customize per channel
                  </h2>
                  <p className={["mt-0.5 text-[12.5px]", textSecondary].join(" ")}>
                    Each channel follows your text above until you edit it here.
                  </p>
                </div>

                {networks.map((networkId) => {
                  const network = SOCIAL_NETWORKS.find((n) => n.id === networkId)!;
                  const channel = channelTiles.find((t) => t.network.id === networkId)?.channel;
                  const label = channelLabel(channel, network.label);
                  const isEmojiOpen = activeEmojiNetwork === networkId;
                  const isCollapsed = Boolean(collapsedCards[networkId]);
                  const currentContent = contentFor(networkId);
                  const customized = isCustomized(networkId);
                  const limit = CHAR_LIMITS[networkId];
                  const over = currentContent.length > limit;

                  return (
                    <div
                      key={networkId}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDraggingTarget(networkId);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                          setDraggingTarget(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDraggingTarget(null);
                        if (e.dataTransfer.files) addFiles(e.dataTransfer.files, networkId);
                      }}
                      className={[
                        "relative flex flex-col rounded-2xl border p-5 transition-colors",
                        draggingTarget === networkId
                          ? isDark ? "border-white/40" : "border-neutral-400"
                          : over ? "border-red-500/60" : border,
                        bgCard,
                      ].join(" ")}
                    >
                      {draggingTarget === networkId && (
                        <div
                          className={[
                            "pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl text-[14px] font-semibold backdrop-blur-[1px]",
                            isDark ? "bg-black/50 text-white" : "bg-white/70 text-neutral-900",
                          ].join(" ")}
                        >
                          Drop to add media for {network.label}
                        </div>
                      )}
                      {/* Header de la carte */}
                      <button
                        type="button"
                        onClick={() => toggleCollapse(networkId)}
                        aria-expanded={!isCollapsed}
                        className="flex w-full items-center justify-between gap-3 text-left outline-none"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar
                            channel={channel}
                            label={label}
                            Icon={network.Icon}
                            size="md"
                            isDark={isDark}
                            ringClass={avatarRing}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={["truncate text-[15px] font-semibold", textPrimary].join(" ")}>
                                {label}
                              </span>
                              {customized && (
                                <span className={["shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", accentBg, accentText].join(" ")}>
                                  Customized
                                </span>
                              )}
                              {over && (
                                <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-500">
                                  Too long
                                </span>
                              )}
                            </div>
                            {isCollapsed && (
                              <p className={["mt-0.5 truncate text-[12.5px]", textSecondary].join(" ")}>
                                {currentContent.trim() || "No text"}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronDown
                          className={["h-4 w-4 shrink-0 transition-transform", textSecondary, isCollapsed ? "" : "rotate-180"].join(" ")}
                        />
                      </button>

                      {!isCollapsed && (
                        <div className="mt-4 flex flex-col">
                          <AutoTextarea
                            value={currentContent}
                            onChange={(val) => handleNetworkChange(networkId, val)}
                            onCaret={(el) => updateCaret(networkId, el)}
                            textareaRef={(el) => {
                              textareaRefs.current[networkId] = el;
                            }}
                            ariaLabel={`Post text for ${network.label}`}
                            placeholder={`Write your ${network.label} post…`}
                            className={[textareaClass, "min-h-[72px]"].join(" ")}
                          />

                          {renderMediaArea(networkId)}

                          <ComposerToolbar
                            isDark={isDark}
                            emojiOpen={isEmojiOpen}
                            onToggleEmoji={() => setActiveEmojiNetwork(isEmojiOpen ? null : networkId)}
                            onPickEmoji={(emoji) => insertAtCursor(networkId, emoji)}
                            onHash={() => insertAtCursor(networkId, "#")}
                            leading={renderSourceButton(networkId)}
                            length={currentContent.length}
                            limit={limit}
                            extra={
                              customized ? (
                                <button
                                  type="button"
                                  onClick={() => resetToMaster(networkId)}
                                  className={["flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold transition", textSecondary, hoverSoft].join(" ")}
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Reset to main text
                                </button>
                              ) : null
                            }
                          />

                          {/* YouTube */}
                          {networkId === "youtube" && (
                            <SettingsBlock
                              title="YouTube Shorts settings"
                              subtitle="Title, audience and visibility for your video."
                              isDark={isDark}
                            >
                              <FieldRow label="Title" htmlFor="youtube-title" isDark={isDark}>
                                <input
                                  id="youtube-title"
                                  type="text"
                                  value={youtubeOptions.title}
                                  maxLength={YOUTUBE_TITLE_MAX}
                                  onChange={(e) => updateYoutube("title", e.target.value)}
                                  placeholder="Enter a title for your video"
                                  className={[
                                    "w-full rounded-xl border px-4 py-2.5 text-[14px] outline-none transition",
                                    isDark
                                      ? "border-white/10 bg-[#242427] text-white placeholder:text-neutral-500 focus:border-white/30"
                                      : "border-black/10 bg-white text-neutral-900 placeholder:text-neutral-400 focus:border-black/30",
                                  ].join(" ")}
                                />
                                <p className={["mt-1.5 flex justify-between gap-3 text-[12px]", textSecondary].join(" ")}>
                                  <span className="min-w-0 truncate">
                                    {!youtubeOptions.title.trim() && youtubeFallbackTitle
                                      ? `Will use: “${youtubeFallbackTitle}”`
                                      : ""}
                                  </span>
                                  <span className="shrink-0 tabular-nums">
                                    {youtubeOptions.title.length} / {YOUTUBE_TITLE_MAX}
                                  </span>
                                </p>
                              </FieldRow>

                              <FieldRow label="Category" isDark={isDark}>
                                <Select
                                  ariaLabel="YouTube category"
                                  value={youtubeOptions.categoryId}
                                  options={YOUTUBE_CATEGORIES}
                                  onChange={(v) => updateYoutube("categoryId", v)}
                                  isDark={isDark}
                                />
                              </FieldRow>

                              <FieldRow label="Visibility" isDark={isDark}>
                                <Select
                                  ariaLabel="YouTube visibility"
                                  value={youtubeOptions.visibility}
                                  options={YOUTUBE_VISIBILITY}
                                  onChange={(v) => updateYoutube("visibility", v)}
                                  isDark={isDark}
                                />
                              </FieldRow>

                              <FieldRow label="License" isDark={isDark}>
                                <Select
                                  ariaLabel="YouTube license"
                                  value={youtubeOptions.license}
                                  options={YOUTUBE_LICENSES}
                                  onChange={(v) => updateYoutube("license", v)}
                                  isDark={isDark}
                                />
                              </FieldRow>

                              <FieldRow label="Options" isDark={isDark}>
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
                                  <Checkbox label="Notify subscribers" checked={youtubeOptions.notifySubscribers} onChange={(v) => updateYoutube("notifySubscribers", v)} isDark={isDark} />
                                  <Checkbox label="Allow embedding" checked={youtubeOptions.allowEmbedding} onChange={(v) => updateYoutube("allowEmbedding", v)} isDark={isDark} />
                                  <Checkbox label="Made for kids" checked={youtubeOptions.madeForKids} onChange={(v) => updateYoutube("madeForKids", v)} isDark={isDark} />
                                </div>
                              </FieldRow>
                            </SettingsBlock>
                          )}

                          {/* TikTok */}
                          {networkId === "tiktok" && scheduleAction !== "save_in_folder" && (
                            <SettingsBlock
                              title={`TikTok settings${tiktokInfo?.creator_nickname ? ` · ${tiktokInfo.creator_nickname}` : ""}`}
                              subtitle={tiktokTypeLabel}
                              isDark={isDark}
                            >
                              {tiktokInfoError && (
                                <p role="alert" className="flex flex-wrap items-center gap-2 text-[12.5px] text-red-500">
                                  <span>{tiktokInfoError}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTiktokInfoError(null);
                                      setTiktokInfoAttempt((n) => n + 1);
                                    }}
                                    className="font-semibold underline"
                                  >
                                    Retry
                                  </button>
                                </p>
                              )}

                              <div>
                                <div
                                  role="radiogroup"
                                  aria-label="TikTok publishing mode"
                                  className={["inline-flex rounded-xl border p-1", border].join(" ")}
                                >
                                  {(["direct", "draft"] as const).map((m) => (
                                    <button
                                      key={m}
                                      type="button"
                                      role="radio"
                                      aria-checked={tiktokMode === m}
                                      onClick={() => setTiktokMode(m)}
                                      className={[
                                        "rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition",
                                        tiktokMode === m
                                          ? isDark
                                            ? "bg-white text-[#141416]"
                                            : "bg-neutral-900 text-white"
                                          : `${textSecondary} ${hoverSoft}`,
                                      ].join(" ")}
                                    >
                                      {m === "direct" ? "Publish directly" : "Save as draft"}
                                    </button>
                                  ))}
                                </div>
                                <p className={["mt-1.5 text-[12px]", textSecondary].join(" ")}>
                                  {tiktokMode === "direct"
                                    ? "Goes live on your profile as soon as TikTok has processed it."
                                    : "Lands in your TikTok inbox so you can finish it in the app."}
                                </p>
                              </div>

                              {tiktokMode === "direct" && (
                                <>
                                  <FieldRow label="Who can view" isDark={isDark}>
                                    <Select
                                      ariaLabel="Who can view this TikTok"
                                      value={tiktokOptions.privacy_level as string}
                                      placeholder="Choose an audience"
                                      options={tiktokPrivacyOptions.map((p) => ({
                                        id: p,
                                        label: TIKTOK_PRIVACY_LABELS[p] ?? p,
                                        disabled: p === "SELF_ONLY" && brandedChosen,
                                      }))}
                                      onChange={(v) =>
                                        setTiktokOptions((o) => ({
                                          ...o,
                                          privacy_level: v as TikTokPostOptions["privacy_level"],
                                        }))
                                      }
                                      isDark={isDark}
                                    />
                                    {brandedChosen && (
                                      <p className={["mt-1.5 text-[12px]", textSecondary].join(" ")}>
                                        Branded content can't be private.
                                      </p>
                                    )}
                                  </FieldRow>

                                  <FieldRow label="Interactions" isDark={isDark}>
                                    <div className="flex flex-wrap gap-x-6 gap-y-2.5">
                                      {allowRows.map(({ key, label: rowLabel, forced }) => (
                                        <Checkbox
                                          key={key}
                                          label={rowLabel}
                                          title={forced ? "Disabled in your TikTok settings" : undefined}
                                          disabled={forced}
                                          checked={!forced && tiktokAllow[key]}
                                          onChange={(v) => setTiktokAllow((a) => ({ ...a, [key]: v }))}
                                          isDark={isDark}
                                        />
                                      ))}
                                    </div>
                                  </FieldRow>

                                  <div className={["border-t pt-3.5", border].join(" ")}>
                                    <Checkbox
                                      label="Content disclosure"
                                      description="Turn on if this post promotes you, a brand or a third party."
                                      checked={tiktokCommercial.on}
                                      onChange={(v) =>
                                        setTiktokCommercial(
                                          v ? { ...tiktokCommercial, on: true } : TIKTOK_DEFAULT_COMMERCIAL
                                        )
                                      }
                                      isDark={isDark}
                                    />
                                    {tiktokCommercial.on && (
                                      <div className="ml-[30px] mt-3 flex flex-col gap-2.5">
                                        <Checkbox
                                          label="Your brand"
                                          checked={tiktokCommercial.yourBrand}
                                          onChange={(v) => setTiktokCommercial((c) => ({ ...c, yourBrand: v }))}
                                          isDark={isDark}
                                        />
                                        <Checkbox
                                          label="Branded content"
                                          disabled={tiktokOptions.privacy_level === "SELF_ONLY"}
                                          title={tiktokOptions.privacy_level === "SELF_ONLY" ? "Not available when only you can view" : undefined}
                                          checked={tiktokCommercial.branded}
                                          onChange={(v) => setTiktokCommercial((c) => ({ ...c, branded: v }))}
                                          isDark={isDark}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}

                              <p className={["flex items-start gap-1.5 text-[12px]", textSecondary].join(" ")}>
                                <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                                After publishing, it can take a few minutes for TikTok to process your content.
                              </p>
                            </SettingsBlock>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            ) : (
              channelTiles.length > 0 && (
                <p className={["text-center text-[13px]", textSecondary].join(" ")}>
                  Select a channel above to customize your post for each network.
                </p>
              )
            )}
          </div>

          {/* Colonne droite : aperçu */}
          <aside
            aria-label="Post preview"
            className={["hidden w-[400px] shrink-0 flex-col border-l", showPreview ? "lg:flex" : "", border, bgPanel].join(" ")}
          >
            <div className={["flex flex-col gap-3 border-b px-5 py-4", border].join(" ")}>
              <h3 className={["text-[15px] font-semibold", textPrimary].join(" ")}>Preview</h3>
              {networks.length > 1 && (
                <div role="tablist" aria-label="Preview channel" className="flex flex-wrap gap-1.5">
                  {networks.map((id) => {
                    const n = SOCIAL_NETWORKS.find((s) => s.id === id)!;
                    const active = id === activePreviewId;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setPreviewNetwork(id)}
                        className={[
                          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold transition",
                          active
                            ? `${accentBg} ${accentText} ${accentBorder}`
                            : `border-transparent ${textSecondary} ${hoverSoft}`,
                        ].join(" ")}
                      >
                        <n.Icon className="h-3.5 w-3.5" />
                        {n.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
              {previewHasSomething ? (
                <PostPreview
                  isDark={isDark}
                  network={previewNetworkData}
                  channel={previewChannel}
                  text={previewText}
                  limit={previewNetworkData ? CHAR_LIMITS[previewNetworkData.id] : undefined}
                  media={previewMedia}
                />
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className={["mb-4 flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-dashed", isDark ? "border-neutral-600/30" : "border-neutral-300"].join(" ")}>
                    <ImageIcon className={["h-6 w-6", textSecondary].join(" ")} />
                  </div>
                  <p className={["max-w-[220px] text-[13px]", textSecondary].join(" ")}>
                    Start writing or add media to see how your post will look.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* ── Statut de publication ── */}
        {(submitProgress || submitError) && (
          <div
            role={submitError ? "alert" : "status"}
            className={[
              "flex shrink-0 items-center gap-2 border-t px-6 py-2.5 text-[13px]",
              border,
              submitError
                ? isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
                : `${bgPanel} ${textSecondary}`,
            ].join(" ")}
          >
            {submitError ? (
              <Info className="h-4 w-4 shrink-0" />
            ) : (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            )}
            <span className="min-w-0">{submitError ?? submitProgress}</span>
          </div>
        )}

        {/* ── Footer ── */}
        <div className={["relative flex shrink-0 items-center justify-end gap-4 border-t px-6 py-4", border].join(" ")}>
          <div className="mr-auto flex min-w-0 flex-1 flex-col gap-1">
            {blockingReason && !isSubmitting && (
              <p className={["flex items-center gap-1.5 text-[12.5px]", textSecondary].join(" ")}>
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0">{blockingReason}</span>
              </p>
            )}
            {showTikTokDeclaration && (
              <p className={["text-[11.5px] leading-snug", textSecondary].join(" ")}>
                By posting, you agree to TikTok's{" "}
                {brandedChosen && (
                  <>
                    <a href={TIKTOK_BRANDED_URL} target="_blank" rel="noreferrer" className={linkClass}>Branded Content Policy</a>
                    {" and "}
                  </>
                )}
                <a href={TIKTOK_MUSIC_URL} target="_blank" rel="noreferrer" className={linkClass}>Music Usage Confirmation</a>.
              </p>
            )}
          </div>

          <div className="relative shrink-0" ref={dropdownRef}>
            <div className={["flex items-stretch overflow-hidden rounded-xl border", border, isDark ? "bg-white/5" : "bg-neutral-100"].join(" ")}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={showActionMenu || showDateTimePanel}
                onClick={() => {
                  if (showDateTimePanel) {
                    setShowDateTimePanel(false);
                    setShowActionMenu(true);
                  } else {
                    setShowActionMenu((v) => !v);
                  }
                }}
                className={["flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-semibold transition", textPrimary, isDark ? "hover:bg-white/5" : "hover:bg-black/5"].join(" ")}
              >
                <CalendarClock className={["h-4 w-4", textSecondary].join(" ")} />
                <span>{footerLabel}</span>
                <ChevronDown className={["h-3.5 w-3.5 transition", (showActionMenu || showDateTimePanel) ? "rotate-180" : "", textSecondary].join(" ")} />
              </button>

              <div className={["w-px", isDark ? "bg-white/10" : "bg-black/10"].join(" ")} />

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                title={canSubmit ? "Ctrl/⌘ + Enter" : blockingReason ?? undefined}
                className={[
                  "flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold transition",
                  canSubmit
                    ? isDark ? "bg-white text-[#141416] hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-neutral-800"
                    : isDark ? "cursor-not-allowed text-neutral-600" : "cursor-not-allowed text-neutral-400",
                ].join(" ")}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitLabel}
              </button>
            </div>

            {showActionMenu && (
              <div role="menu" className={["absolute bottom-full right-0 z-50 mb-2 w-[340px] overflow-hidden rounded-xl border p-2 shadow-2xl", isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/10 bg-white"].join(" ")}>
                {SCHEDULE_ACTIONS.map((action) => {
                  const isSelected = scheduleAction === action.id;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      onClick={() => selectAction(action.id)}
                      className={["flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition", isSelected ? `${accentBg} ${accentText}` : isDark ? "text-neutral-200 hover:bg-white/5" : "text-neutral-700 hover:bg-black/[0.04]"].join(" ")}
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                        {isSelected && <Check className={["h-4 w-4", accentCheck].join(" ")} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={["block text-[13.5px] font-bold", isSelected ? accentText : ""].join(" ")}>{action.label}</span>
                        <span className={["mt-0.5 block text-[12.5px] leading-snug", isSelected ? (isDark ? "text-white/80" : "text-neutral-700") : textSecondary].join(" ")}>{action.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {showDateTimePanel && (
              <div className={["absolute bottom-full right-0 z-50 mb-2 w-[280px] overflow-hidden rounded-xl border shadow-2xl", isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/10 bg-white"].join(" ")}>
                <div className="w-full p-3">
                  <CalendarPicker value={scheduledAt} onChange={(date) => setScheduledAt((prev) => mergeDateTime(date, prev))} isDark={isDark} />
                </div>
                <div className={["border-t p-3", isDark ? "border-white/10" : "border-black/10"].join(" ")}>
                  <p className={["mb-2 text-[13px] font-semibold", textPrimary].join(" ")}>Suggested times</p>
                  <div className="flex flex-col gap-2">
                    {POSTING_SLOTS.map((slot) => {
                      const isActive = scheduledAt.getHours() === slot.hour && scheduledAt.getMinutes() === slot.minute;
                      return (
                        <button
                          key={slot.label}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => applyPostingSlot(slot.hour, slot.minute)}
                          className={["flex w-full items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-semibold transition", isActive ? `${accentBg} ${accentText} ${accentBorder}` : isDark ? "border-white/10 text-neutral-200 hover:bg-white/5" : "border-black/10 text-neutral-700 hover:bg-black/[0.04]"].join(" ")}
                        >
                          <Wand2 className="h-3.5 w-3.5" /> {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="px-3 pb-3">
                  <p className={["mb-2 text-[13px] font-semibold", textPrimary].join(" ")}>Time</p>
                  <div className={["rounded-lg border px-3 py-2", accentSolid, accentBorder].join(" ")}>
                    <TimePicker value={scheduledAt} onChange={(date) => setScheduledAt(date)} isDark={isDark} min={timeMin} className={isDark ? "border-transparent bg-transparent text-white" : "border-transparent bg-transparent text-neutral-900"} />
                  </div>
                  <p className={["mt-1.5 text-[11.5px]", textSecondary].join(" ")}>{timezone}</p>
                  <p
                    className={[
                      "mt-2 text-[12px] font-medium",
                      scheduledAt.getTime() <= Date.now() ? "text-red-500" : textPrimary,
                    ].join(" ")}
                  >
                    {scheduledAt.getTime() <= Date.now()
                      ? "Pick a time in the future."
                      : formatLongDateTime(scheduledAt)}
                  </p>
                </div>
                <div className={["flex items-center justify-between border-t px-3 py-2.5", isDark ? "border-white/10" : "border-black/10"].join(" ")}>
                  <button type="button" onClick={() => { setShowDateTimePanel(false); setShowActionMenu(true); }} className={["flex items-center gap-1.5 text-[12.5px] font-semibold transition", textPrimary].join(" ")}>
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <button type="button" onClick={() => setShowDateTimePanel(false)} className={["flex items-center gap-1.5 text-[12.5px] font-semibold transition", textPrimary].join(" ")}>
                    <Check className="h-3.5 w-3.5" strokeWidth={3} /> Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Dialogue : reprendre le brouillon ou l'ignorer ── */}
        {pendingDraft && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
            <div
              role="alertdialog"
              aria-labelledby="draft-title"
              className={["w-[360px] max-w-[90%] rounded-2xl border p-6 text-center shadow-2xl", isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/10 bg-white"].join(" ")}
            >
              <h3 id="draft-title" className={["text-[16px] font-bold", textPrimary].join(" ")}>Resume your draft?</h3>
              <p className={["mt-2 text-[13px]", textSecondary].join(" ")}>
                You have a post in progress. Pick up where you left off, or start fresh.
              </p>
              {(pendingDraft.masterContent || Object.values(pendingDraft.contents || {})[0]) && (
                <p className={["mt-3 line-clamp-2 rounded-lg px-3 py-2 text-left text-[12.5px]", isDark ? "bg-white/5 text-neutral-300" : "bg-neutral-100 text-neutral-600"].join(" ")}>
                  {pendingDraft.masterContent || Object.values(pendingDraft.contents || {})[0]}
                </p>
              )}
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={ignoreDraft} className={["flex-1 rounded-xl border px-4 py-2.5 text-[13.5px] font-semibold transition", border, textPrimary, isDark ? "hover:bg-white/5" : "hover:bg-black/5"].join(" ")}>Start fresh</button>
                <button type="button" autoFocus onClick={resumeDraft} className={["flex-1 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold transition", isDark ? "bg-white text-[#141416] hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-neutral-800"].join(" ")}>Resume</button>
              </div>
            </div>
          </div>
        )}

        {dropboxPickerOpen && (
          <div
            className="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={(event) => {
              if (event.target === event.currentTarget) setDropboxPickerOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="dropbox-picker-title"
              className={[
                "flex max-h-[82vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border shadow-2xl",
                bgModal,
                border,
              ].join(" ")}
            >
              <header className={["flex items-center gap-3 border-b px-5 py-4", border].join(" ")}>
                <DropboxIcon className="h-6 w-6 shrink-0 text-[#0061ff]" />
                <div className="min-w-0 flex-1">
                  <h2 id="dropbox-picker-title" className={["text-[15px] font-semibold", textPrimary].join(" ")}>
                    Add from Dropbox
                  </h2>
                  <p className={["text-[12px]", textSecondary].join(" ")}>
                    Choose an image or video for this post.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close Dropbox picker"
                  onClick={() => setDropboxPickerOpen(false)}
                  className={["flex h-8 w-8 items-center justify-center rounded-lg transition", textSecondary, hoverSoft].join(" ")}
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              {dropboxNeedsConnection ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <DropboxIcon className="h-10 w-10 text-[#0061ff]" />
                  <p className={["mt-4 text-[14px] font-semibold", textPrimary].join(" ")}>
                    Connect your Dropbox account
                  </p>
                  <p className={["mt-1 max-w-[340px] text-[12.5px]", textSecondary].join(" ")}>
                    Authorize Dropbox to browse and import your media files.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDropboxConnect()}
                    disabled={dropboxLoading}
                    className="mt-5 flex items-center gap-2 rounded-lg bg-[#0061ff] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#0754d3] disabled:opacity-60"
                  >
                    {dropboxLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Connect Dropbox
                  </button>
                </div>
              ) : (
                <>
                  <div className={["flex items-center gap-2 border-b px-5 py-3", border].join(" ")}>
                    {dropboxPath && (
                      <button
                        type="button"
                        onClick={() => void loadDropboxFolder(getDropboxParentPath(dropboxPath))}
                        className={["flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold transition", textSecondary, hoverSoft].join(" ")}
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back
                      </button>
                    )}
                    <p className={["min-w-0 flex-1 truncate text-[12px]", textSecondary].join(" ")}>
                      {dropboxPath || "All files"}
                    </p>
                    <span className={["text-[11px]", textSecondary].join(" ")}>
                      {dropboxTarget === "master" ? "Shared media" : "Channel media"}
                    </span>
                  </div>

                  {dropboxError && (
                    <div className="mx-5 mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                      <p role="alert" className="min-w-0 flex-1 text-[12px] text-red-500">
                        {dropboxError}
                      </p>
                      <button
                        type="button"
                        onClick={() => void loadDropboxFolder(dropboxPath)}
                        className="shrink-0 text-[12px] font-semibold text-red-500 underline underline-offset-2"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  <div className="min-h-[180px] overflow-y-auto px-3 py-2">
                    {dropboxFiles.filter(isDropboxMedia).map((entry) => {
                      const isFolder = entry[".tag"] === "folder";
                      const importing = dropboxImporting === entry.path_lower;
                      return (
                        <div
                          key={entry.id ?? entry.path_lower}
                          className={["flex items-center gap-3 rounded-lg px-3 py-2.5", hoverSoft].join(" ")}
                        >
                          <span className={["flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", accentSolid, textSecondary].join(" ")}>
                            {isFolder ? <ChevronRight className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                          </span>
                          {isFolder ? (
                            <button
                              type="button"
                              onClick={() => void loadDropboxFolder(entry.path_lower)}
                              className={["min-w-0 flex-1 truncate text-left text-[13px] font-medium", textPrimary].join(" ")}
                            >
                              {entry.name}
                            </button>
                          ) : (
                            <span className={["min-w-0 flex-1 truncate text-[13px] font-medium", textPrimary].join(" ")}>
                              {entry.name}
                            </span>
                          )}
                          {!isFolder && (
                            <button
                              type="button"
                              onClick={() => void handleDropboxImport(entry)}
                              disabled={dropboxImporting !== null}
                              className={[
                                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold transition disabled:opacity-50",
                                isDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-black/[0.06] text-neutral-900 hover:bg-black/10",
                              ].join(" ")}
                            >
                              {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              {importing ? "Importing" : "Add"}
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {dropboxLoading && !dropboxNeedsConnection && (
                      <div className={["flex items-center justify-center gap-2 py-10 text-[12.5px]", textSecondary].join(" ")}>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading Dropbox files…
                      </div>
                    )}

                    {!dropboxLoading && !dropboxError && dropboxFiles.filter(isDropboxMedia).length === 0 && (
                      <p className={["py-10 text-center text-[12.5px]", textSecondary].join(" ")}>
                        This folder has no supported image or video files.
                      </p>
                    )}
                  </div>

                  {dropboxHasMore && dropboxCursor && (
                    <footer className={["border-t px-5 py-3", border].join(" ")}>
                      <button
                        type="button"
                        onClick={() => void loadDropboxFolder(dropboxPath, dropboxCursor, true)}
                        disabled={dropboxLoading}
                        className={["w-full rounded-lg px-3 py-2 text-[12px] font-semibold transition disabled:opacity-50", hoverSoft, textPrimary].join(" ")}
                      >
                        Load more files
                      </button>
                    </footer>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        {googleDrivePickerOpen && (
          <div
            className="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setGoogleDrivePickerOpen(false);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="google-drive-picker-title"
              className={[
                "flex max-h-[82vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border shadow-2xl",
                bgModal,
                border,
              ].join(" ")}
            >
              <header className={["flex items-center gap-3 border-b px-5 py-4", border].join(" ")}>
                <IntegrationGoogleDriveIcon className="h-6 w-6 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h2 id="google-drive-picker-title" className={["text-[15px] font-semibold", textPrimary].join(" ")}>
                    Add from Google Drive
                  </h2>
                  <p className={["text-[12px]", textSecondary].join(" ")}>
                    Choose an image or video for this post.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close Google Drive picker"
                  onClick={() => setGoogleDrivePickerOpen(false)}
                  className={["flex h-8 w-8 items-center justify-center rounded-lg transition", textSecondary, hoverSoft].join(" ")}
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              {googleDriveNeedsConnection ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <IntegrationGoogleDriveIcon className="h-10 w-10" />
                  <p className={["mt-4 text-[14px] font-semibold", textPrimary].join(" ")}>
                    Connect your Google Drive account
                  </p>
                  <p className={["mt-1 max-w-[340px] text-[12.5px]", textSecondary].join(" ")}>
                    Authorize Google Drive to browse and import your media files.
                  </p>
                  {googleDriveError && (
                    <p role="alert" className="mt-3 max-w-[360px] text-[12px] text-red-500">
                      {googleDriveError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleGoogleDriveConnect()}
                    disabled={googleDriveLoading}
                    className="mt-5 flex items-center gap-2 rounded-lg bg-[#34a853] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#278b43] disabled:opacity-60"
                  >
                    {googleDriveLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Connect Google Drive
                  </button>
                </div>
              ) : (
                <>
                  <div className={["flex items-center gap-2 border-b px-5 py-3", border].join(" ")}>
                    {googleDriveFolders.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const parentFolders = googleDriveFolders.slice(0, -1);
                          setGoogleDriveFolders(parentFolders);
                          void loadGoogleDriveFolder(
                            parentFolders[parentFolders.length - 1].id
                          );
                        }}
                        className={["flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold transition", textSecondary, hoverSoft].join(" ")}
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back
                      </button>
                    )}
                    <p className={["min-w-0 flex-1 truncate text-[12px]", textSecondary].join(" ")}>
                      {googleDriveFolders[googleDriveFolders.length - 1].name}
                    </p>
                    <span className={["text-[11px]", textSecondary].join(" ")}>
                      {googleDriveTarget === "master" ? "Shared media" : "Channel media"}
                    </span>
                  </div>

                  {googleDriveError && (
                    <div className="mx-5 mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                      <p role="alert" className="min-w-0 flex-1 text-[12px] text-red-500">
                        {googleDriveError}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          void loadGoogleDriveFolder(
                            googleDriveFolders[googleDriveFolders.length - 1].id
                          )
                        }
                        className="shrink-0 text-[12px] font-semibold text-red-500 underline underline-offset-2"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  <div className="min-h-[180px] overflow-y-auto px-3 py-2">
                    {googleDriveFiles.filter(isGoogleDriveMedia).map((entry) => {
                      const isFolder =
                        (entry.mime_type ?? entry.mimeType) ===
                        "application/vnd.google-apps.folder";
                      const importing = googleDriveImporting === entry.id;
                      return (
                        <div
                          key={entry.id}
                          className={["flex items-center gap-3 rounded-lg px-3 py-2.5", hoverSoft].join(" ")}
                        >
                          <span className={["flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", accentSolid, textSecondary].join(" ")}>
                            {isFolder ? <ChevronRight className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                          </span>
                          {isFolder ? (
                            <button
                              type="button"
                              onClick={() => {
                                setGoogleDriveFolders((current) => [
                                  ...current,
                                  { id: entry.id, name: entry.name },
                                ]);
                                void loadGoogleDriveFolder(entry.id);
                              }}
                              className={["min-w-0 flex-1 truncate text-left text-[13px] font-medium", textPrimary].join(" ")}
                            >
                              {entry.name}
                            </button>
                          ) : (
                            <span className={["min-w-0 flex-1 truncate text-[13px] font-medium", textPrimary].join(" ")}>
                              {entry.name}
                            </span>
                          )}
                          {!isFolder && (
                            <button
                              type="button"
                              onClick={() => void handleGoogleDriveImport(entry)}
                              disabled={googleDriveImporting !== null}
                              className={[
                                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold transition disabled:opacity-50",
                                isDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-black/[0.06] text-neutral-900 hover:bg-black/10",
                              ].join(" ")}
                            >
                              {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              {importing ? "Importing" : "Add"}
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {googleDriveLoading && !googleDriveNeedsConnection && (
                      <div className={["flex items-center justify-center gap-2 py-10 text-[12.5px]", textSecondary].join(" ")}>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading Google Drive files…
                      </div>
                    )}

                    {!googleDriveLoading &&
                      !googleDriveError &&
                      googleDriveFiles.filter(isGoogleDriveMedia).length === 0 && (
                        <p className={["py-10 text-center text-[12.5px]", textSecondary].join(" ")}>
                          This folder has no supported image or video files.
                        </p>
                      )}
                  </div>

                  {googleDriveHasMore && googleDriveCursor && (
                    <footer className={["border-t px-5 py-3", border].join(" ")}>
                      <button
                        type="button"
                        onClick={() =>
                          void loadGoogleDriveFolder(
                            googleDriveFolders[googleDriveFolders.length - 1].id,
                            googleDriveCursor,
                            true
                          )
                        }
                        disabled={googleDriveLoading}
                        className={["w-full rounded-lg px-3 py-2 text-[12px] font-semibold transition disabled:opacity-50", hoverSoft, textPrimary].join(" ")}
                      >
                        Load more files
                      </button>
                    </footer>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        {googlePhotosPickerOpen && (
          <div
            className="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={(event) => {
              if (event.target === event.currentTarget && !googlePhotosLoading) {
                setGooglePhotosPickerOpen(false);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="google-photos-picker-title"
              className={[
                "flex w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border shadow-2xl",
                bgModal,
                border,
              ].join(" ")}
            >
              <header className={["flex items-center gap-3 border-b px-5 py-4", border].join(" ")}>
                <GooglePhotosIcon className="h-6 w-6 shrink-0 text-[#4285f4]" />
                <div className="min-w-0 flex-1">
                  <h2 id="google-photos-picker-title" className={["text-[15px] font-semibold", textPrimary].join(" ")}>
                    Add from Google Photos
                  </h2>
                  <p className={["text-[12px]", textSecondary].join(" ")}>
                    Choose photos or videos for this post.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close Google Photos picker"
                  onClick={() => setGooglePhotosPickerOpen(false)}
                  disabled={googlePhotosLoading}
                  className={["flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-50", textSecondary, hoverSoft].join(" ")}
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="flex flex-col items-center px-6 py-10 text-center">
                <GooglePhotosIcon className="h-10 w-10 text-[#4285f4]" />
                {googlePhotosLoading ? (
                  <div className={["mt-4 flex items-center gap-2 text-[13px]", textSecondary].join(" ")}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {googlePhotosChecking
                      ? "Checking Google Photos connection…"
                      : "Importing selected media…"}
                  </div>
                ) : googlePhotosNeedsConnection ? (
                  <>
                    <p className={["mt-4 text-[14px] font-semibold", textPrimary].join(" ")}>
                      Connect your Google Photos account
                    </p>
                    <p className={["mt-1 max-w-[340px] text-[12.5px]", textSecondary].join(" ")}>
                      Authorize Google Photos to select and import your media.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleGooglePhotosConnect()}
                      className="mt-5 flex items-center gap-2 rounded-lg bg-[#4285f4] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#3367d6]"
                    >
                      Connect Google Photos
                    </button>
                  </>
                ) : !googlePhotosReady ? (
                  <>
                    <p className={["mt-4 text-[14px] font-semibold", textPrimary].join(" ")}>
                      Google Photos connection could not be verified
                    </p>
                    <button
                      type="button"
                      onClick={() => void openGooglePhotosPicker(googlePhotosTarget)}
                      className={["mt-5 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition", hoverSoft, textPrimary].join(" ")}
                    >
                      Retry
                    </button>
                  </>
                ) : (
                  <>
                    <p className={["mt-4 text-[14px] font-semibold", textPrimary].join(" ")}>
                      Select media from your library
                    </p>
                    <p className={["mt-1 max-w-[340px] text-[12.5px]", textSecondary].join(" ")}>
                      Google Photos will open in a separate window. Your selection will be added to this post.
                    </p>
                    <p className={["mt-2 text-[11px]", textSecondary].join(" ")}>
                      {googlePhotosTarget === "master" ? "Shared media" : "Channel media"}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleGooglePhotosPick()}
                      className="mt-5 flex items-center gap-2 rounded-lg bg-[#4285f4] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#3367d6]"
                    >
                      Open Google Photos
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </>
                )}
                {googlePhotosError && (
                  <p role="alert" className="mt-4 max-w-[360px] text-[12px] text-red-500">
                    {googlePhotosError}
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      <EditMediaModal isOpen={editingItem !== null} mediaItem={editingItem} isDark={isDark} onClose={() => setEditingItem(null)} onApply={handleApplyMediaEdit} />
    </div>
  );
}