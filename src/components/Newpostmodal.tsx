import { useEffect, useMemo, useRef, useState } from "react";
import { EmojiPicker as FrimousseEmojiPicker } from "frimousse";
import {
  Maximize2, Minimize2, X, Tag, FileText,
  Eye, Smile, Hash, Image as ImageIcon, ImagePlus, Pencil, ChevronDown,
  CalendarClock, Check, Sparkles, ArrowLeft, Wand2, Plus
} from "lucide-react";
import {
  XIcon, FacebookIcon, InstagramIcon, LinkedInIcon,
  TikTokIcon, YouTubeIcon, PinterestIcon, ThreadsIcon,
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

export type ScheduleAction = "save_in_folder" | "now" | "set_date";

/* ── YouTube ── */

export type YouTubeVisibility = "public" | "unlisted" | "private";
export type YouTubeLicense = "youtube" | "creativeCommon";

export type YouTubeOptions = {
  title: string;
  /** ID de catégorie YouTube (ex. "2" = Autos & Vehicles). */
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
  hashtags: string[];
  networks: SocialNetworkId[];
  scheduleMode: "now" | "save_in_folder" | "later";
  scheduledAt: string | null;
  media: File[];
  /** Présent uniquement si YouTube fait partie des réseaux envoyés au parent. */
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
  /** Date/heure préremplies (ex. clic sur une case du calendrier). */
  initialScheduledAt?: Date | null;
  /**
   * Appelé quand l'utilisateur presse N + P, OU clique sur le « + » d'un canal
   * dans la sidebar, alors que la modale est fermée.
   * Le parent doit y passer `isOpen` à true. Sans cette prop, ces deux
   * déclencheurs sont désactivés.
   */
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

const SCHEDULE_ACTIONS: {
  id: ScheduleAction;
  label: string;
  description: string;
}[] = [
  { id: "save_in_folder", label: "Save in folder", description: "Save your post in a folder to publish it later." },
  { id: "now", label: "Now", description: "Publish your post right away." },
  { id: "set_date", label: "Set Date and Time", description: "Choose a specific time to post, or use our recommendation." },
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

// Repli si les infos créateur TikTok ne sont pas disponibles :
// le serveur force de toute façon SELF_ONLY par défaut.
// (Proposé comme option, jamais présélectionné : règle TikTok.)
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

// TikTok : aucune interaction cochée par défaut.
type TikTokAllow = { comment: boolean; duet: boolean; stitch: boolean };
const TIKTOK_DEFAULT_ALLOW: TikTokAllow = {
  comment: false,
  duet: false,
  stitch: false,
};

// TikTok : divulgation de contenu commercial désactivée par défaut.
type TikTokCommercial = { on: boolean; yourBrand: boolean; branded: boolean };
const TIKTOK_DEFAULT_COMMERCIAL: TikTokCommercial = {
  on: false,
  yourBrand: false,
  branded: false,
};

/* ── YouTube : valeurs proposées ── */

const YOUTUBE_TITLE_MAX = 100;

// Catégories officielles de l'API YouTube (videoCategories).
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
   ────────────────────────────────────────────────────────────── */

type DraftData = {
  title: string;
  content: string;
  hashtags: string[];
  networks: SocialNetworkId[];
  scheduleAction: ScheduleAction;
  scheduledAt: number;
  files: File[];
  youtubeOptions?: YouTubeOptions;
};

// Survit à la fermeture (et même au démontage) du composant.
// Les File ne peuvent pas être mis dans localStorage, d'où la variable de module.
let savedDraft: DraftData | null = null;

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

function toSentenceCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
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

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "Local";
  }
}

/** Durée d'une vidéo en secondes (lecture des métadonnées uniquement). */
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

/**
 * TikTok n'accepte que JPEG et WebP pour les photos :
 * les autres formats (PNG, GIF...) sont convertis en JPEG.
 */
async function toTikTokImage(file: File): Promise<File> {
  if (file.type === "image/jpeg" || file.type === "image/webp") return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not convert an image for TikTok.");

  // Fond blanc : le JPEG n'a pas de transparence.
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

/**
 * Déduit le réseau (SocialNetworkId) d'un canal connecté.
 * On regarde d'abord un champ `platform` / `network` / `provider`
 * s'il existe, puis la clé du canal.
 */
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

type ChannelTileData = {
  channel: ConnectedChannel;
  network: (typeof SOCIAL_NETWORKS)[number];
  order: number;
};

/* ──────────────────────────────────────────────────────────────
   Pastille d'un canal connecté : photo de profil + badge du réseau
   ────────────────────────────────────────────────────────────── */

function ChannelTile({
  channel,
  NetworkIcon,
  isDark,
  isSelected,
  onToggle,
}: {
  channel: ConnectedChannel;
  NetworkIcon: NetworkIconComponent;
  isDark: boolean;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const [failed, setFailed] = useState(false);

  // Si l'URL change (reconnexion), on retente le chargement.
  useEffect(() => {
    setFailed(false);
  }, [channel.avatarUrl]);

  const label = channel.handle || channel.name;
  const initial = label.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const showImage = Boolean(channel.avatarUrl) && !failed;

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-pressed={isSelected}
      className={[
        "relative h-14 w-14 shrink-0 rounded-2xl transition duration-200",
        isSelected
          ? isDark
            ? "opacity-100 ring-2 ring-white ring-offset-[3px] ring-offset-[#141416]"
            : "opacity-100 ring-2 ring-neutral-900 ring-offset-[3px] ring-offset-white"
          : "opacity-45 grayscale hover:opacity-80 hover:grayscale-0",
      ].join(" ")}
    >
      {showImage ? (
        <img
          src={channel.avatarUrl}
          alt={label}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full rounded-2xl object-cover"
        />
      ) : (
        <span
          className={[
            "flex h-full w-full items-center justify-center rounded-2xl text-[18px] font-semibold",
            isDark ? "bg-[#2a2a2d] text-white" : "bg-neutral-900 text-white",
          ].join(" ")}
        >
          {initial}
        </span>
      )}

      <span
        className={[
          "absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-black ring-[3px]",
          isDark ? "ring-[#141416]" : "ring-white",
        ].join(" ")}
      >
        <NetworkIcon className="h-3 w-3" />
      </span>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────
   Menu déroulant (select natif stylé) utilisé par le panneau YouTube
   ────────────────────────────────────────────────────────────── */

function YouTubeSelect<T extends string>({
  value,
  options,
  onChange,
  isDark,
  ariaLabel,
  className = "",
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  isDark: boolean;
  ariaLabel: string;
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
        {options.map((o) => (
          <option key={o.id} value={o.id}>
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

/* ──────────────────────────────────────────────────────────────
   Case à cocher du panneau YouTube
   ────────────────────────────────────────────────────────────── */

function YouTubeCheckbox({
  checked,
  onChange,
  label,
  isDark,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  isDark: boolean;
}) {
  return (
    <label
      className={[
        "flex cursor-pointer select-none items-center gap-2.5 text-[14px] font-medium",
        isDark ? "text-white" : "text-neutral-900",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={[
          "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border transition",
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
      {label}
    </label>
  );
}

/* ──────────────────────────────────────────────────────────────
   Sélecteur d'emoji (frimousse) — noir et blanc
   - Thème clair : emoji en noir sur fond blanc
   - Thème sombre : emoji en blanc sur fond noir
   La police « Noto Emoji » est monochrome : elle prend la couleur du texte.
   Si elle n'est pas chargée, les emoji système sont passés en niveaux de gris.
   ────────────────────────────────────────────────────────────── */

const EMOJI_FONT =
  '"Noto Emoji", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

function EmojiPickerPanel({
  isDark,
  onPick,
}: {
  isDark: boolean;
  onPick: (emoji: string) => void;
}) {
  // Les composants internes sont recréés seulement si le thème change.
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
      aria-label="Choisir un emoji"
      className={[
        "absolute bottom-full left-0 z-50 mb-2 overflow-hidden rounded-xl border shadow-2xl",
        isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/10 bg-white",
      ].join(" ")}
    >
      <FrimousseEmojiPicker.Root
        locale="fr"
        columns={8}
        onEmojiSelect={({ emoji }) => onPick(emoji)}
        className="isolate flex h-[340px] w-[300px] flex-col"
      >
        <FrimousseEmojiPicker.Search
          placeholder="Rechercher un emoji"
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
            Chargement…
          </FrimousseEmojiPicker.Loading>

          <FrimousseEmojiPicker.Empty
            className={[
              "absolute inset-0 flex items-center justify-center text-[13px]",
              isDark ? "text-neutral-500" : "text-neutral-400",
            ].join(" ")}
          >
            Aucun emoji trouvé.
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
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagDraft, setHashtagDraft] = useState("");
  const [networks, setNetworks] = useState<SocialNetworkId[]>([]);
  const [scheduleAction, setScheduleAction] = useState<ScheduleAction>("now");
  const [scheduledAt, setScheduledAt] = useState<Date>(() => defaultScheduledDate());
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDateTimePanel, setShowDateTimePanel] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [hoveredMediaId, setHoveredMediaId] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<DraftData | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitProgress, setSubmitProgress] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Incrémenté à chaque demande « New post » reçue depuis la sidebar :
  // relance l'effet qui présélectionne le canal.
  const [requestTick, setRequestTick] = useState(0);

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

  // Visibilités proposées : celles de TikTok si disponibles ;
  // en cas d'échec du chargement, on propose « Only me » (jamais présélectionné).
  const tiktokPrivacyOptions = useMemo<string[]>(() => {
    const fromInfo = tiktokInfo?.privacy_level_options;
    if (fromInfo && fromInfo.length > 0) return fromInfo as string[];
    if (tiktokInfoError || tiktokInfo) return TIKTOK_FALLBACK_PRIVACY;
    return [];
  }, [tiktokInfo, tiktokInfoError]);

  // Réseaux connectés (cache partagé avec la page Channels) :
  // TikTok, YouTube, Pinterest... tous sont affichés.
  const connectedChannels = useConnectedChannels();

  // Raccourci N + P : ouvre la modale quand elle est fermée.
  // (Hook placé avant le `if (!isOpen) return null;` pour respecter l'ordre des hooks.)
  useNewPostShortcut(() => onRequestOpen?.(), !isOpen && Boolean(onRequestOpen));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaItem[]>(media);
  mediaRef.current = media;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const closeWithDraftRef = useRef<() => void>(() => {});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);
  // Dernière position du curseur dans le texte (null = jamais placé : on ajoute à la fin).
  const caretRef = useRef<{ start: number; end: number } | null>(null);

  // Refs pour lire les dernières valeurs depuis l'abonnement au bus (créé une seule fois).
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const onRequestOpenRef = useRef(onRequestOpen);
  onRequestOpenRef.current = onRequestOpen;

  // Réseau présélectionné via le « + » de la sidebar (prioritaire sur un brouillon repris).
  const preselectRef = useRef<SocialNetworkId | null>(null);

  const timeMin = useMemo(() => {
    const now = new Date();
    return isSameCalendarDay(scheduledAt, now) ? now : undefined;
  }, [scheduledAt]);

  const timezone = useMemo(() => getLocalTimezone(), []);

  // ── FIX React #310 ──
  // Ce useMemo DOIT être avant le `if (!isOpen) return null;`
  // sinon React voit plus de hooks au 2e rendu → erreur #310.
  // Trié selon SOCIAL_NETWORKS : YouTube se place juste après TikTok.
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

  // ── « New post » depuis la sidebar ──
  // On s'abonne dès le montage (même modale fermée) : si la demande arrive
  // alors que la modale est fermée, on demande au parent de l'ouvrir.
  // On lit aussi une demande déjà en attente (arrivée avant le montage,
  // quand la sidebar a dû naviguer vers la page qui contient ce modal).
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

  // Une fois la modale ouverte, on sélectionne le canal demandé.
  // Si les canaux ne sont pas encore chargés, la demande reste en attente
  // et l'effet se relance quand `channelTiles` change.
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
        if (showEmojiPicker) {
          setShowEmojiPicker(false);
        } else if (showActionMenu || showDateTimePanel) {
          setShowActionMenu(false);
          setShowDateTimePanel(false);
        } else {
          closeWithDraftRef.current();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, showActionMenu, showDateTimePanel, showEmojiPicker]);

  useEffect(() => {
    return () => {
      mediaRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  // À l'ouverture : s'il existe un brouillon, on propose de le reprendre
  useEffect(() => {
    setPendingDraft(isOpen ? savedDraft : null);
  }, [isOpen]);

  // Ouverture depuis une case du calendrier : date/heure préremplies.
  // On dépend de la VALEUR (getTime) et non de l'objet Date, pour ne pas
  // repasser l'action sur « set_date » si le parent recrée la Date à chaque rendu.
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
    if (!showEmojiPicker) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!emojiWrapRef.current?.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [showEmojiPicker]);

  // Charge les infos créateur TikTok (pseudo, visibilités autorisées, durée max...)
  // à chaque fois que TikTok est (re)sélectionné : TikTok exige les infos les
  // plus récentes. `tiktokInfo` est remis à null à la désélection / fermeture.
  // `tiktokInfoAttempt` permet de relancer le chargement via « Retry ».
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

  // Le simple choix d'un réseau (ex. via le « + » de la sidebar) ne compte pas
  // comme du contenu : sinon fermer la modale sans rien écrire créerait un brouillon.
  const hasDraftContent =
    content.trim().length > 0 ||
    title.trim().length > 0 ||
    hashtags.length > 0 ||
    media.length > 0;

  const clearForm = () => {
    media.forEach((item) => URL.revokeObjectURL(item.url));
    setContent("");
    setTitle("");
    setHashtags([]);
    setHashtagDraft("");
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
    setShowEmojiPicker(false);
    setTiktokInfo(null);
    setTiktokInfoError(null);
    setTiktokMode("direct");
    setTiktokOptions(TIKTOK_DEFAULT_OPTIONS);
    setTiktokAllow(TIKTOK_DEFAULT_ALLOW);
    setTiktokCommercial(TIKTOK_DEFAULT_COMMERCIAL);
    setYoutubeOptions(YOUTUBE_DEFAULT_OPTIONS);
    caretRef.current = null;
    preselectRef.current = null;
  };

  // Fermeture après publication : on jette tout
  const discardAndClose = () => {
    savedDraft = null;
    clearForm();
    onClose();
  };

  // Fermeture manuelle (X, fond, Escape) : on garde un brouillon
  const closeWithDraft = () => {
    if (isSubmitting) return;

    if (hasDraftContent) {
      savedDraft = {
        title,
        content,
        hashtags,
        networks,
        scheduleAction,
        scheduledAt: scheduledAt.getTime(),
        files: media.map((m) => m.file),
        youtubeOptions,
      };
    }
    clearForm();
    onClose();
  };
  closeWithDraftRef.current = closeWithDraft;

  const resumeDraft = () => {
    if (!pendingDraft) return;
    setTitle(pendingDraft.title);
    setContent(pendingDraft.content);
    setHashtags(pendingDraft.hashtags);
    // Si on est arrivé via le « + » d'un canal, ce canal reste celui sélectionné.
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
    caretRef.current = null;
    savedDraft = null;
    setPendingDraft(null);
  };

  const ignoreDraft = () => {
    savedDraft = null;
    setPendingDraft(null);
  };

  const updateCaret = () => {
    const el = textareaRef.current;
    if (el) {
      caretRef.current = { start: el.selectionStart, end: el.selectionEnd };
    }
  };

  const insertEmoji = (emoji: string) => {
    const caret = caretRef.current ?? { start: content.length, end: content.length };
    const start = Math.min(caret.start, content.length);
    const end = Math.min(Math.max(caret.end, start), content.length);

    const next = content.slice(0, start) + emoji + content.slice(end);
    const position = start + emoji.length;

    setContent(next);
    caretRef.current = { start: position, end: position };

    // On remet le curseur juste après l'emoji une fois le texte mis à jour.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(position, position);
    });
  };

  const toggleNetwork = (id: SocialNetworkId) => {
    // Désélection de TikTok : on oublie les infos créateur pour les
    // recharger à la prochaine sélection.
    if (id === "tiktok" && networks.includes("tiktok")) {
      setTiktokInfo(null);
      setTiktokInfoError(null);
    }

    setNetworks((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  };

  // Le brouillon est sauvegardé, puis on va connecter un réseau.
  const handleConnectChannel = () => {
    closeWithDraft();
    navigate("channels");
  };

  const commitHashtagDraft = () => {
    const clean = toSentenceCase(hashtagDraft.trim().replace(/^#+/, ""));
    if (!clean) {
      setHashtagDraft("");
      return;
    }
    setHashtags((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setHashtagDraft("");
  };

  const removeHashtag = (tag: string) => {
    setHashtags((prev) => prev.filter((t) => t !== tag));
  };

  const addFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList).filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
    );

    setMedia((prev) => {
      const room = MAX_MEDIA - prev.length;
      const accepted = incoming.slice(0, Math.max(room, 0));

      if (incoming.length > accepted.length) {
        setMediaError(`Maximum ${MAX_MEDIA} fichiers.`);
      } else {
        setMediaError(null);
      }

      const newItems: MediaItem[] = accepted.map((file) => ({
        id: makeId(),
        file,
        url: URL.createObjectURL(file),
        kind: file.type.startsWith("video/") ? "video" : "image",
      }));

      return [...prev, ...newItems];
    });
  };

  const removeMedia = (id: string) => {
    setMedia((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((item) => item.id !== id);
    });
    setMediaError(null);
  };

  const handleApplyMediaEdit = (id: string, newFile: File, newUrl: string) => {
    setMedia((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        URL.revokeObjectURL(item.url);
        return { ...item, file: newFile, url: newUrl };
      })
    );
    setEditingItem(null);
  };

  // ── Règles TikTok ──
  // TikTok n'a pas d'API de programmation : seule la publication immédiate
  // (ou le brouillon dans l'app TikTok) est possible.
  // "save_in_folder" reste géré par le parent (rien n'est envoyé à TikTok).
  //
  // Type de post :
  //   - une vidéo présente → post vidéo (les images sont ignorées pour TikTok)
  //   - sinon, 1 à N images → post photo (2+ images = carrousel)
  const tiktokVideo = media.find((m) => m.kind === "video")?.file ?? null;
  const tiktokImages = media.filter((m) => m.kind === "image");
  const tiktokPostType: "video" | "photo" | null = tiktokVideo
    ? "video"
    : tiktokImages.length > 0
    ? "photo"
    : null;

  const brandedChosen =
    tiktokMode === "direct" && tiktokCommercial.on && tiktokCommercial.branded;

  const tiktokBlockingReason: string | null = !tiktokSelected
    ? null
    : scheduleAction === "set_date"
    ? "TikTok doesn't support scheduling. Choose “Now” or remove TikTok."
    : scheduleAction === "save_in_folder"
    ? null
    : !tiktokPostType
    ? "TikTok requires a video or at least one photo. Add media, or deselect TikTok."
    : tiktokMode === "direct" && !tiktokOptions.privacy_level
    ? tiktokPrivacyOptions.length === 0 && !tiktokInfoError
      ? "Loading TikTok settings…"
      : "Choose who can view your TikTok."
    : tiktokMode === "direct" &&
      tiktokCommercial.on &&
      !tiktokCommercial.yourBrand &&
      !tiktokCommercial.branded
    ? "You need to indicate if your content promotes yourself, a third party, or both."
    : null;

  // ── Règles YouTube ──
  // En mode « Automatic », un titre vide retombe sur le titre du post,
  // puis sur la première ligne du texte.

  const youtubeEffectiveTitle = (
    youtubeOptions.title.trim() ||
    title.trim() ||
    content.trim().split("\n")[0] ||
    ""
  ).slice(0, YOUTUBE_TITLE_MAX);

  const youtubeBlockingReason: string | null = !youtubeSelected
    ? null
    : scheduleAction === "save_in_folder"
    ? null
    : !youtubeEffectiveTitle
    ? "Enter a title for your YouTube Shorts video."
    : null;

  const updateYoutube = <K extends keyof YouTubeOptions>(
    key: K,
    value: YouTubeOptions[K]
  ) => setYoutubeOptions((o) => ({ ...o, [key]: value }));

  const canSubmit =
    networks.length > 0 &&
    (content.trim().length > 0 || media.length > 0) &&
    (scheduleAction !== "set_date" || scheduledAt.getTime() > Date.now()) &&
    !tiktokBlockingReason &&
    !youtubeBlockingReason &&
    !isSubmitting;

  // Libellé légal obligatoire (« Promotional content » / « Paid partnership »).
  const tiktokLabelNotice =
    tiktokMode === "direct" && tiktokCommercial.on
      ? tiktokCommercial.branded
        ? `Your ${tiktokPostType === "photo" ? "photo" : "video"} will be labeled as “Paid partnership”`
        : tiktokCommercial.yourBrand
        ? `Your ${tiktokPostType === "photo" ? "photo" : "video"} will be labeled as “Promotional content”`
        : null
      : null;

  const showTikTokDeclaration = tiktokSelected && scheduleAction === "now";

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const tiktokNow = tiktokSelected && scheduleAction === "now";

    // TikTok est publié directement depuis ici ; les autres réseaux
    // passent par `onSubmit` comme avant.
    const remainingNetworks = tiktokNow
      ? networks.filter((n) => n !== "tiktok")
      : networks;

    const payload: NewPostPayload = {
      title: title.trim(),
      content: content.trim(),
      hashtags,
      networks: remainingNetworks,
      scheduleMode: scheduleAction === "set_date" ? "later" : scheduleAction,
      scheduledAt:
        scheduleAction === "set_date" ? scheduledAt.toISOString() : null,
      media: media.map((item) => item.file),
      ...(remainingNetworks.includes("youtube")
        ? { youtube: { ...youtubeOptions, title: youtubeEffectiveTitle } }
        : {}),
    };

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      setSubmitProgress(null);

      if (tiktokNow && tiktokPostType) {
        const caption = [
          content.trim(),
          hashtags.map((t) => `#${t}`).join(" "),
        ]
          .filter(Boolean)
          .join("\n\n");

        const isPhoto = tiktokPostType === "photo";

        // Vidéo : la durée doit respecter la limite du compte TikTok.
        if (tiktokVideo) {
          const maxDuration = (
            tiktokInfo as unknown as { max_video_post_duration_sec?: number } | null
          )?.max_video_post_duration_sec;

          if (maxDuration) {
            const duration = await getVideoDuration(tiktokVideo);
            if (duration > maxDuration) {
              throw new Error(
                `This video is too long for your TikTok account (max ${Math.floor(
                  maxDuration / 60
                )} min ${maxDuration % 60 ? `${maxDuration % 60} s` : ""}).`.replace(
                  /\s+\)/,
                  ")"
                )
              );
            }
          }
        }

        // Interactions : rien n'est autorisé par défaut, et TikTok peut
        // en désactiver certaines au niveau du compte.
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
            caption,
            mode: tiktokMode,
            options,
          });
        } else {
          setSubmitProgress("Uploading video to TikTok…");

          publishId = await publishToTikTok({
            video: tiktokVideo as File,
            caption,
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

        // Évite de republier sur TikTok si un autre réseau échoue ensuite
        // et que l'utilisateur réessaie.
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
      console.error("Erreur lors de la création du post:", error);

      const raw = error instanceof Error ? error.message : "";
      const message = /too_many_posts|spam_risk/i.test(raw)
        ? "This TikTok account has reached its posting limit for now. Please try again later."
        : raw || "Something went wrong while publishing.";

      setSubmitError(message);
      setSubmitProgress(null);
      setIsSubmitting(false);
    }
  };

  const selectAction = (action: ScheduleAction) => {
    setScheduleAction(action);
    if (action === "set_date") {
      setShowActionMenu(false);
      setShowDateTimePanel(true);
    } else {
      setShowDateTimePanel(false);
      setShowActionMenu(false);
    }
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
      : "Publishing…"
    : scheduleAction === "now"
    ? tiktokSelected && tiktokMode === "draft"
      ? "Send to TikTok"
      : "Post Now"
    : scheduleAction === "save_in_folder"
    ? "Save Post"
    : "Schedule Post";

  // ── Thèmes ──
  const bgModal = isDark ? "bg-[#141416]" : "bg-white";
  const bgPanel = isDark ? "bg-[#1c1c1e]" : "bg-neutral-50";
  const border = isDark ? "border-white/10" : "border-black/[0.06]";
  const textPrimary = isDark ? "text-white" : "text-neutral-900";
  const textSecondary = isDark ? "text-neutral-400" : "text-neutral-500";

  const accentBg = isDark ? "bg-white/10" : "bg-neutral-200";
  const accentText = isDark ? "text-white" : "text-neutral-900";
  const accentCheck = isDark ? "text-white" : "text-neutral-900";
  const accentSolid = isDark ? "bg-white/5" : "bg-neutral-100";
  const accentBorder = isDark ? "border-white/15" : "border-black/10";

  // Interactions affichées (Duet / Stitch n'existent pas pour les photos).
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-md"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeWithDraft();
      }}
    >
      <div
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
            <h2 className={["text-[19px] font-bold tracking-tight", textPrimary].join(" ")}>Create Post</h2>
            <button className={["flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition", border, isDark ? "hover:bg-white/5" : "hover:bg-black/5", textSecondary].join(" ")}>
              <Tag className="h-3.5 w-3.5" />
              Tags
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button className={["flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium transition", textSecondary, isDark ? "hover:text-white" : "hover:text-neutral-900"].join(" ")}>
              <FileText className="h-4 w-4" />
              Templates
            </button>
            <div className={["mx-1 h-5 w-px", isDark ? "bg-white/10" : "bg-black/10"].join(" ")} />
            <button
              onClick={() => setIsFullscreen((v) => !v)}
              className={["flex h-8 w-8 items-center justify-center rounded-full transition", textSecondary, isDark ? "hover:bg-white/10 hover:text-white" : "hover:bg-black/5 hover:text-neutral-900"].join(" ")}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              onClick={closeWithDraft}
              className={["flex h-8 w-8 items-center justify-center rounded-full transition", textSecondary, isDark ? "hover:bg-white/10 hover:text-white" : "hover:bg-black/5 hover:text-neutral-900"].join(" ")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Colonne gauche */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
            {/* Canaux connectés (photo de profil + badge du réseau) + bouton « + » */}
            <div className="mb-4 flex flex-wrap items-center gap-4">
              {channelTiles.map(({ channel, network }) => (
                <ChannelTile
                  key={channel.key}
                  channel={channel}
                  NetworkIcon={network.Icon}
                  isDark={isDark}
                  isSelected={networks.includes(network.id)}
                  onToggle={() => toggleNetwork(network.id)}
                />
              ))}

              <button
                type="button"
                onClick={handleConnectChannel}
                title="Connect a network"
                aria-label="Connect a network"
                className={[
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border transition",
                  isDark
                    ? "border-white/10 bg-[#242427] text-neutral-400 hover:bg-[#2e2e31] hover:text-white"
                    : "border-black/10 bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900",
                ].join(" ")}
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            <div
              className={[
                "relative flex min-h-[160px] flex-1 flex-col rounded-2xl border p-4 transition-colors",
                border,
                isDark
                  ? "bg-white/[0.03] focus-within:border-white/25"
                  : "bg-neutral-50/60 focus-within:border-black/25",
              ].join(" ")}
            >
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(event) => {
                  setContent(toSentenceCase(event.target.value));
                  updateCaret();
                }}
                onSelect={updateCaret}
                onKeyUp={updateCaret}
                onClick={updateCaret}
                placeholder="Start writing or get inspired with Templates"
                className={[
                  "w-full flex-1 resize-none bg-transparent text-[15px] leading-relaxed outline-none",
                  textPrimary,
                  isDark ? "placeholder:text-neutral-500" : "placeholder:text-neutral-400",
                ].join(" ")}
              />
              <span
                className={[
                  "pointer-events-none self-end pt-2 text-[11px] tabular-nums",
                  textSecondary,
                ].join(" ")}
              >
                {content.length}
              </span>
            </div>

            {/* ── Miniatures média : croix + crayon visibles au survol de la miniature ── */}
            <div className="mt-3 flex flex-wrap items-end gap-3">
              {media.map((item) => {
                const isHovered = hoveredMediaId === item.id;
                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHoveredMediaId(item.id)}
                    onMouseLeave={() => setHoveredMediaId(null)}
                    className="relative h-[100px] w-[100px] shrink-0 overflow-hidden rounded-2xl"
                  >
                    <div className="h-full w-full overflow-hidden rounded-2xl">
                      {item.kind === "image" ? (
                        <img src={item.url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="relative h-full w-full">
                          <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                            <Eye className="h-5 w-5" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Léger assombrissement au survol pour mieux détacher les icônes */}
                    <div
                      className={[
                        "pointer-events-none absolute inset-0 transition-colors duration-150",
                        isHovered ? "bg-black/20" : "bg-black/0",
                      ].join(" ")}
                    />

                    {/* Bouton supprimer — visible uniquement au survol de la miniature */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMedia(item.id);
                      }}
                      title="Supprimer"
                      aria-label="Supprimer le média"
                      className={[
                        "absolute right-1.5 top-1.5 z-30 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg bg-black/70 text-white backdrop-blur-sm transition-opacity duration-150 hover:bg-black/90",
                        isHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
                      ].join(" ")}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>

                    {/* Bouton éditer — visible uniquement au survol de la miniature (images uniquement) */}
                    {item.kind === "image" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem(item);
                        }}
                        title="Éditer"
                        aria-label="Éditer le média"
                        className={[
                          "absolute bottom-1.5 right-1.5 z-30 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg bg-black/70 text-white backdrop-blur-sm transition-opacity duration-150 hover:bg-black/90",
                          isHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
                        ].join(" ")}
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                );
              })}

              {media.length < MAX_MEDIA && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
                  }}
                  className={[
                    "flex h-[100px] w-[100px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-center transition-all duration-200",
                    isDragging
                      ? isDark
                        ? "scale-105 border-white/50 bg-white/5"
                        : "scale-105 border-neutral-400 bg-neutral-100"
                      : isDark
                      ? "border-white/15 hover:border-white/30 hover:bg-white/5"
                      : "border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  <ImagePlus className={["h-6 w-6", isDark ? "text-white/40" : "text-neutral-400"].join(" ")} strokeWidth={1.75} />
                  <span className={["mt-1 text-[10px] font-medium leading-tight", isDark ? "text-white/50" : "text-neutral-400"].join(" ")}>
                    Drag & drop or
                  </span>
                  <span className={["text-[10px] font-semibold leading-tight", textPrimary].join(" ")}>
                    select a file
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {/* ── Options YouTube ── */}
            {youtubeSelected && (
              <div
                className={[
                  "mt-4 rounded-2xl border p-5",
                  border,
                  isDark ? "bg-[#1c1c1e]" : "bg-neutral-50",
                ].join(" ")}
              >
                <div className={["mb-4 flex items-center gap-2 text-[14px] font-semibold", textPrimary].join(" ")}>
                  <span
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-lg",
                      isDark ? "bg-white text-black" : "bg-neutral-900 text-white",
                    ].join(" ")}
                  >
                    <YouTubeIcon className="h-3.5 w-3.5" />
                  </span>
                  YouTube Shorts settings
                </div>

                <div className="flex flex-col gap-3.5">
                  {/* Title */}
                  <div className="grid grid-cols-[110px_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1.5">
                    <label
                      htmlFor="youtube-title"
                      className={["text-[14px] font-semibold", textPrimary].join(" ")}
                    >
                      Title
                    </label>
                    <input
                      id="youtube-title"
                      type="text"
                      value={youtubeOptions.title}
                      maxLength={YOUTUBE_TITLE_MAX}
                      onChange={(e) => updateYoutube("title", e.target.value)}
                      placeholder="Enter a title for your video"
                      className={[
                        "w-full rounded-xl border px-4 py-2.5 text-[15px] outline-none transition",
                        isDark
                          ? "border-white/10 bg-[#242427] text-white placeholder:text-neutral-500 focus:border-white/30"
                          : "border-black/10 bg-white text-neutral-900 placeholder:text-neutral-400 focus:border-black/30",
                      ].join(" ")}
                    />
                  </div>

                  {/* Category + Visibility */}
                  <div className="grid grid-cols-[110px_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1.5">
                    <span className={["text-[14px] font-semibold", textPrimary].join(" ")}>
                      Category
                    </span>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                      <YouTubeSelect
                        ariaLabel="YouTube Shorts category"
                        value={youtubeOptions.categoryId}
                        options={YOUTUBE_CATEGORIES}
                        onChange={(v) => updateYoutube("categoryId", v)}
                        isDark={isDark}
                        className="min-w-[200px] flex-1"
                      />
                      <div className="flex min-w-[220px] flex-1 items-center gap-4">
                        <span className={["text-[14px] font-semibold", textPrimary].join(" ")}>
                          Visibility
                        </span>
                        <YouTubeSelect
                          ariaLabel="YouTube Shorts visibility"
                          value={youtubeOptions.visibility}
                          options={YOUTUBE_VISIBILITY}
                          onChange={(v) => updateYoutube("visibility", v)}
                          isDark={isDark}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* License */}
                  <div className="grid grid-cols-[110px_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1.5">
                    <span className={["text-[14px] font-semibold", textPrimary].join(" ")}>
                      License
                    </span>
                    <YouTubeSelect
                      ariaLabel="YouTube Shorts license"
                      value={youtubeOptions.license}
                      options={YOUTUBE_LICENSES}
                      onChange={(v) => updateYoutube("license", v)}
                      isDark={isDark}
                    />
                  </div>

                  {/* Cases à cocher */}
                  <div className="grid grid-cols-[110px_1fr] gap-3 max-sm:grid-cols-1">
                    <span aria-hidden="true" className="max-sm:hidden" />
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-2.5">
                      <YouTubeCheckbox
                        label="Notify Subscribers"
                        checked={youtubeOptions.notifySubscribers}
                        onChange={(v) => updateYoutube("notifySubscribers", v)}
                        isDark={isDark}
                      />
                      <YouTubeCheckbox
                        label="Allow Embedding"
                        checked={youtubeOptions.allowEmbedding}
                        onChange={(v) => updateYoutube("allowEmbedding", v)}
                        isDark={isDark}
                      />
                      <YouTubeCheckbox
                        label="Made for Kids"
                        checked={youtubeOptions.madeForKids}
                        onChange={(v) => updateYoutube("madeForKids", v)}
                        isDark={isDark}
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ── Options TikTok ── */}
            {tiktokSelected && scheduleAction !== "save_in_folder" && (
              <div className={["mt-4 rounded-2xl border p-4 text-[13px]", border, bgPanel].join(" ")}>
                {/* Compte de destination (obligatoire : le pseudo du créateur) */}
                <p className={["mb-1 font-semibold", textPrimary].join(" ")}>
                  Posting to TikTok
                  {tiktokInfo?.creator_nickname ? ` · ${tiktokInfo.creator_nickname}` : ""}
                </p>

                <p className={["mb-2 text-[12px]", textSecondary].join(" ")}>
                  {tiktokPostType === "photo"
                    ? tiktokImages.length > 1
                      ? `Carousel of ${tiktokImages.length} photos`
                      : "Photo post"
                    : tiktokPostType === "video"
                    ? tiktokImages.length > 0
                      ? "Video post (your images won't be sent to TikTok)"
                      : "Video post"
                    : "Add a video, or one or more photos (several photos make a carousel)."}
                </p>

                {tiktokInfoError && (
                  <p className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-red-500">
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

                <div className="mb-2 flex gap-2">
                  {(["direct", "draft"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTiktokMode(m)}
                      className={[
                        "rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition",
                        tiktokMode === m
                          ? `${accentBg} ${accentText} ${accentBorder}`
                          : `${border} ${textSecondary}`,
                      ].join(" ")}
                    >
                      {m === "direct" ? "Publish directly" : "Save as TikTok draft"}
                    </button>
                  ))}
                </div>

                {tiktokMode === "direct" && (
                  <>
                    {/* Visibilité : choix manuel obligatoire, aucune valeur par défaut */}
                    <select
                      value={tiktokOptions.privacy_level}
                      onChange={(e) =>
                        setTiktokOptions((o) => ({
                          ...o,
                          privacy_level: e.target.value as TikTokPostOptions["privacy_level"],
                        }))
                      }
                      className={[
                        "mb-1 w-full rounded-lg border px-2 py-1.5 text-[12.5px] outline-none",
                        border,
                        isDark ? "bg-[#242427] text-white" : "bg-white text-neutral-900",
                      ].join(" ")}
                    >
                      <option value="">Who can view this {tiktokPostType === "photo" ? "post" : "video"}…</option>
                      {tiktokPrivacyOptions.map((p) => (
                        <option
                          key={p}
                          value={p}
                          disabled={p === "SELF_ONLY" && brandedChosen}
                        >
                          {TIKTOK_PRIVACY_LABELS[p] ?? p}
                        </option>
                      ))}
                    </select>

                    {brandedChosen && (
                      <p className={["mb-2 text-[11.5px]", textSecondary].join(" ")}>
                        Branded content visibility cannot be set to private.
                      </p>
                    )}

                    {/* Interactions : décochées par défaut, grisées si désactivées par TikTok */}
                    <div className="mt-2 flex flex-wrap gap-4">
                      {allowRows.map(({ key, label, forced }) => (
                        <label
                          key={key}
                          title={forced ? "Disabled in your TikTok settings" : undefined}
                          className={[
                            "flex items-center gap-1.5 text-[12.5px]",
                            forced ? "cursor-not-allowed opacity-50" : "",
                            textSecondary,
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            checked={!forced && tiktokAllow[key]}
                            disabled={forced}
                            onChange={(e) =>
                              setTiktokAllow((a) => ({ ...a, [key]: e.target.checked }))
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>

                    {/* Divulgation de contenu commercial : désactivée par défaut */}
                    <div className={["mt-3 border-t pt-3", border].join(" ")}>
                      <label className={["flex items-center justify-between gap-3", textPrimary].join(" ")}>
                        <span>
                          <span className="block text-[12.5px] font-semibold">
                            Content disclosure
                          </span>
                          <span className={["block text-[11.5px]", textSecondary].join(" ")}>
                            Turn on to disclose that this content promotes yourself, a brand, product or service.
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={tiktokCommercial.on}
                          onChange={(e) =>
                            setTiktokCommercial(
                              e.target.checked
                                ? { ...tiktokCommercial, on: true }
                                : TIKTOK_DEFAULT_COMMERCIAL
                            )
                          }
                        />
                      </label>

                      {tiktokCommercial.on && (
                        <div className="mt-2 flex flex-col gap-1.5 pl-1">
                          <label className={["flex items-center gap-1.5 text-[12.5px]", textSecondary].join(" ")}>
                            <input
                              type="checkbox"
                              checked={tiktokCommercial.yourBrand}
                              onChange={(e) =>
                                setTiktokCommercial((c) => ({ ...c, yourBrand: e.target.checked }))
                              }
                            />
                            Your brand
                            <span className="text-[11.5px] opacity-80">
                              — you are promoting yourself or your own business
                            </span>
                          </label>

                          <label
                            title={
                              tiktokOptions.privacy_level === "SELF_ONLY"
                                ? "Visibility for branded content can't be private."
                                : undefined
                            }
                            className={[
                              "flex items-center gap-1.5 text-[12.5px]",
                              tiktokOptions.privacy_level === "SELF_ONLY" ? "cursor-not-allowed opacity-50" : "",
                              textSecondary,
                            ].join(" ")}
                          >
                            <input
                              type="checkbox"
                              checked={tiktokCommercial.branded}
                              disabled={tiktokOptions.privacy_level === "SELF_ONLY"}
                              onChange={(e) =>
                                setTiktokCommercial((c) => ({ ...c, branded: e.target.checked }))
                              }
                            />
                            Branded content
                            <span className="text-[11.5px] opacity-80">
                              — you are promoting another brand or a third party
                            </span>
                          </label>

                          {tiktokOptions.privacy_level === "SELF_ONLY" && (
                            <p className={["text-[11.5px]", textSecondary].join(" ")}>
                              Visibility for branded content can't be private. Pick another visibility to enable it.
                            </p>
                          )}

                          {tiktokLabelNotice && (
                            <p className={["text-[12px] font-medium", textPrimary].join(" ")}>
                              {tiktokLabelNotice}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <p className={["mt-3 text-[11.5px]", textSecondary].join(" ")}>
                  After you publish, it may take a few minutes for your content to be processed and visible on your TikTok profile.
                </p>

              </div>
            )}

            {/* ── Tags : champ arrondi + chips blanches à ombre légère ── */}
            <div className="mt-4">
              <label
                htmlFor="hashtag-input"
                className={["mb-2 block text-[13px] font-bold uppercase tracking-wide", textPrimary].join(" ")}
              >
                Hashtag
              </label>

              <div
                onClick={() => document.getElementById("hashtag-input")?.focus()}
                className={[
                  "flex min-h-[56px] cursor-text flex-wrap items-center gap-2 rounded-2xl border px-3 py-2.5 transition-colors",
                  border,
                  isDark
                    ? "bg-white/[0.03] focus-within:border-white/25"
                    : "bg-white focus-within:border-black/25",
                ].join(" ")}
              >
                {hashtags.map((tag) => (
                  <span
                    key={tag}
                    className={[
                      "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[14px] font-medium",
                      isDark
                        ? "border-white/10 bg-[#2a2a2d] text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                        : "border-black/[0.06] bg-white text-neutral-800 shadow-[0_2px_8px_rgba(0,0,0,0.10)]",
                    ].join(" ")}
                  >
                    {tag}
                    <button
                      type="button"
                      aria-label={`Supprimer ${tag}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeHashtag(tag);
                      }}
                      className={isDark ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-neutral-900"}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ))}

                <input
                  id="hashtag-input"
                  type="text"
                  value={hashtagDraft}
                  onChange={(e) => setHashtagDraft(toSentenceCase(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === " ") {
                      e.preventDefault();
                      commitHashtagDraft();
                    } else if (e.key === "Backspace" && !hashtagDraft && hashtags.length > 0) {
                      removeHashtag(hashtags[hashtags.length - 1]);
                    }
                  }}
                  onBlur={commitHashtagDraft}
                  placeholder={hashtags.length === 0 ? "Add hashtag..." : ""}
                  className={[
                    "min-w-[100px] flex-1 bg-transparent px-1 text-[14px] outline-none",
                    textPrimary,
                    isDark ? "placeholder:text-neutral-600" : "placeholder:text-neutral-400",
                  ].join(" ")}
                />
              </div>
            </div>

            {mediaError && <p className="mt-1 text-[11px] text-red-500">{mediaError}</p>}

            {submitProgress && (
              <p
                role="status"
                className={["mt-2 text-[12px]", textSecondary].join(" ")}
              >
                {submitProgress}
              </p>
            )}
            {submitError && (
              <p role="alert" className="mt-2 text-[12px] text-red-500">
                {submitError}
              </p>
            )}

            {/* ── Barre d'outils : emoji + focus hashtag ── */}
            <div className={["mt-4 flex items-center gap-4 border-t pt-3", border].join(" ")}>
              <div ref={emojiWrapRef} className="relative">
                <button
                  type="button"
                  title="Emoji"
                  aria-label="Ajouter un emoji"
                  aria-haspopup="dialog"
                  aria-expanded={showEmojiPicker}
                  onClick={() => setShowEmojiPicker((open) => !open)}
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full transition",
                    showEmojiPicker
                      ? isDark
                        ? "bg-white/10 text-white"
                        : "bg-black/5 text-neutral-900"
                      : textSecondary,
                    isDark ? "hover:bg-white/10 hover:text-white" : "hover:bg-black/5 hover:text-neutral-900",
                  ].join(" ")}
                >
                  <Smile className="h-4 w-4" />
                </button>

                {showEmojiPicker && (
                  <EmojiPickerPanel isDark={isDark} onPick={insertEmoji} />
                )}
              </div>

              <button
                type="button"
                title="Add hashtag"
                aria-label="Ajouter un hashtag"
                onClick={() => document.getElementById("hashtag-input")?.focus()}
                className={["flex h-8 w-8 items-center justify-center rounded-full transition", textSecondary, isDark ? "hover:bg-white/10 hover:text-white" : "hover:bg-black/5 hover:text-neutral-900"].join(" ")}
              >
                <Hash className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Colonne droite : Previews */}
          <div className={["flex w-[400px] shrink-0 flex-col border-l", border, bgPanel].join(" ")}>
            <div className={["flex items-center gap-2 border-b px-5 py-4", border].join(" ")}>
              <h3 className={["text-[15px] font-semibold", textPrimary].join(" ")}>Post Previews</h3>
              <div className={["flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold", textSecondary, border].join(" ")}>
                i
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center p-6">
              {(content.trim() || media.length > 0) ? (
                <div className={["w-full max-w-[300px] rounded-xl border p-4 shadow-sm", border, isDark ? "bg-[#242427]" : "bg-white"].join(" ")}>
                  <div className="mb-3 flex items-center gap-2">
                    <div className={["h-8 w-8 rounded-full", isDark ? "bg-white/10" : "bg-neutral-200"].join(" ")} />
                    <div>
                      <div className={["h-2 w-20 rounded", isDark ? "bg-white/10" : "bg-neutral-200"].join(" ")} />
                      <div className={["mt-1 h-2 w-12 rounded", isDark ? "bg-white/5" : "bg-neutral-100"].join(" ")} />
                    </div>
                  </div>
                  {content && <p className={["text-[13px] leading-relaxed", textPrimary].join(" ")}>{content}</p>}
                  {hashtags.length > 0 && (
                    <p className={["mt-2 text-[12px]", isDark ? "text-white/60" : "text-neutral-500"].join(" ")}>
                      {hashtags.map((t) => `#${t}`).join(" ")}
                    </p>
                  )}
                  {media.length > 0 && (
                    <div className="relative mt-3 overflow-hidden rounded-lg">
                      {media[0].kind === "image" ? (
                        <img src={media[0].url} alt="" className="w-full object-cover" />
                      ) : (
                        <video src={media[0].url} className="w-full object-cover" muted playsInline />
                      )}
                      {media.length > 1 && (
                        <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                          1/{media.length}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className={["relative mb-4 flex h-32 w-32 items-center justify-center rounded-2xl border-2 border-dashed", isDark ? "border-neutral-600/30" : "border-neutral-300"].join(" ")}>
                    <div className={["flex h-16 w-16 items-center justify-center rounded-xl", isDark ? "bg-white/5" : "bg-neutral-200/50"].join(" ")}>
                      <ImageIcon className={["h-6 w-6", textSecondary].join(" ")} />
                    </div>
                    <Sparkles className={["absolute -right-2 -top-2 h-5 w-5", isDark ? "text-white/30" : "text-neutral-300"].join(" ")} />
                    <Sparkles className={["absolute -bottom-1 -left-1 h-3 w-3", isDark ? "text-white/30" : "text-neutral-300"].join(" ")} />
                  </div>
                  <p className={["text-[13px]", textSecondary].join(" ")}>See your post's preview here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className={["relative flex shrink-0 items-center justify-end gap-4 border-t px-6 py-4", border].join(" ")}>
          {/* Déclaration TikTok (juste avant le bouton) */}
          {showTikTokDeclaration && (
            <div className="mr-auto flex min-w-0 flex-1 flex-col gap-1">
              <p className={["text-[11.5px] leading-snug", textSecondary].join(" ")}>
                By posting, you agree to TikTok's{" "}
                {brandedChosen && (
                  <>
                    <a href={TIKTOK_BRANDED_URL} target="_blank" rel="noreferrer" className={linkClass}>
                      Branded Content Policy
                    </a>{" "}
                    and{" "}
                  </>
                )}
                <a href={TIKTOK_MUSIC_URL} target="_blank" rel="noreferrer" className={linkClass}>
                  Music Usage Confirmation
                </a>
                .
              </p>
            </div>
          )}

          <div className="relative shrink-0" ref={dropdownRef}>
            <div
              className={[
                "flex items-stretch overflow-hidden rounded-xl border",
                border,
                isDark ? "bg-white/5" : "bg-neutral-100",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => {
                  if (showDateTimePanel) {
                    setShowDateTimePanel(false);
                    setShowActionMenu(true);
                  } else {
                    setShowActionMenu((v) => !v);
                  }
                }}
                aria-expanded={showActionMenu || showDateTimePanel}
                aria-haspopup="menu"
                className={[
                  "flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-semibold transition",
                  textPrimary,
                  isDark ? "hover:bg-white/5" : "hover:bg-black/5",
                ].join(" ")}
              >
                <CalendarClock className={["h-4 w-4", textSecondary].join(" ")} />
                <span>{footerLabel}</span>
                <ChevronDown
                  className={[
                    "h-3.5 w-3.5 transition",
                    (showActionMenu || showDateTimePanel) ? "rotate-180" : "",
                    textSecondary,
                  ].join(" ")}
                />
              </button>

              <div className={["w-px", isDark ? "bg-white/10" : "bg-black/10"].join(" ")} />

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={[
                  "px-5 py-2.5 text-[14px] font-semibold transition",
                  canSubmit
                    ? isDark
                      ? "bg-white text-[#141416] hover:bg-neutral-200"
                      : "bg-neutral-900 text-white hover:bg-neutral-800"
                    : isDark
                    ? "cursor-not-allowed text-neutral-600"
                    : "cursor-not-allowed text-neutral-400",
                ].join(" ")}
              >
                {submitLabel}
              </button>
            </div>

            {showActionMenu && (
              <div
                role="menu"
                className={[
                  "absolute bottom-full right-0 z-50 mb-2 w-[340px] overflow-hidden rounded-xl border p-2 shadow-2xl",
                  isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/10 bg-white",
                ].join(" ")}
              >
                {SCHEDULE_ACTIONS.map((action) => {
                  const isSelected = scheduleAction === action.id;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      role="menuitem"
                      onClick={() => selectAction(action.id)}
                      className={[
                        "flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition",
                        isSelected
                          ? `${accentBg} ${accentText}`
                          : isDark
                          ? "text-neutral-200 hover:bg-white/5"
                          : "text-neutral-700 hover:bg-black/[0.04]",
                      ].join(" ")}
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                        {isSelected && <Check className={["h-4 w-4", accentCheck].join(" ")} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={["block text-[13.5px] font-bold", isSelected ? accentText : ""].join(" ")}>
                          {action.label}
                        </span>
                        <span className={["mt-0.5 block text-[12.5px] leading-snug", isSelected ? (isDark ? "text-white/80" : "text-neutral-700") : textSecondary].join(" ")}>
                          {action.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {showDateTimePanel && (
              <div
                className={[
                  "absolute bottom-full right-0 z-50 mb-2 w-[280px] overflow-hidden rounded-xl border shadow-2xl",
                  isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/10 bg-white",
                ].join(" ")}
              >
                <div className="w-full p-3">
                  <CalendarPicker
                    value={scheduledAt}
                    onChange={(date) => {
                      setScheduledAt((prev) => mergeDateTime(date, prev));
                    }}
                    isDark={isDark}
                  />
                </div>

                <div className={["border-t p-3", isDark ? "border-white/10" : "border-black/10"].join(" ")}>
                  <p className={["mb-2 text-[13px] font-semibold", textPrimary].join(" ")}>
                    Posting Slots
                  </p>
                  <div className="flex flex-col gap-2">
                    {POSTING_SLOTS.map((slot) => {
                      const isActive =
                        scheduledAt.getHours() === slot.hour &&
                        scheduledAt.getMinutes() === slot.minute;
                      return (
                        <button
                          key={slot.label}
                          type="button"
                          onClick={() => applyPostingSlot(slot.hour, slot.minute)}
                          className={[
                            "flex w-full items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-semibold transition",
                            isActive
                              ? `${accentBg} ${accentText} ${accentBorder}`
                              : isDark
                              ? "border-white/10 text-neutral-200 hover:bg-white/5"
                              : "border-black/10 text-neutral-700 hover:bg-black/[0.04]",
                          ].join(" ")}
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="px-3 pb-3">
                  <p className={["mb-2 text-[13px] font-semibold", textPrimary].join(" ")}>
                    Select Time
                  </p>
                  <div className={["rounded-lg border px-3 py-2", accentSolid, accentBorder].join(" ")}>
                    <TimePicker
                      value={scheduledAt}
                      onChange={(date) => setScheduledAt(date)}
                      isDark={isDark}
                      min={timeMin}
                      className={
                        isDark
                          ? "border-transparent bg-transparent text-white hover:border-transparent"
                          : "border-transparent bg-transparent text-neutral-900 hover:border-transparent"
                      }
                    />
                  </div>
                  <p className={["mt-1.5 text-[11.5px]", textSecondary].join(" ")}>
                    {timezone}
                  </p>
                </div>

                <div className={["flex items-center justify-between border-t px-3 py-2.5", isDark ? "border-white/10" : "border-black/10"].join(" ")}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDateTimePanel(false);
                      setShowActionMenu(true);
                    }}
                    className={["flex items-center gap-1.5 text-[12.5px] font-semibold transition", textPrimary].join(" ")}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    More
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDateTimePanel(false)}
                    className={["flex items-center gap-1.5 text-[12.5px] font-semibold transition", textPrimary].join(" ")}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    Done
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
              className={[
                "w-[360px] rounded-2xl border p-6 text-center shadow-2xl",
                isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/10 bg-white",
              ].join(" ")}
            >
              <h3 className={["text-[16px] font-bold", textPrimary].join(" ")}>
                Reprendre votre brouillon ?
              </h3>
              <p className={["mt-2 text-[13px]", textSecondary].join(" ")}>
                Vous aviez un post en cours. Voulez-vous reprendre où vous en étiez ou repartir de zéro ?
              </p>
              {pendingDraft.content && (
                <p
                  className={[
                    "mt-3 line-clamp-2 rounded-lg px-3 py-2 text-left text-[12.5px]",
                    isDark ? "bg-white/5 text-neutral-300" : "bg-neutral-100 text-neutral-600",
                  ].join(" ")}
                >
                  {pendingDraft.content}
                </p>
              )}
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={ignoreDraft}
                  className={[
                    "flex-1 rounded-xl border px-4 py-2.5 text-[13.5px] font-semibold transition",
                    border,
                    textPrimary,
                    isDark ? "hover:bg-white/5" : "hover:bg-black/5",
                  ].join(" ")}
                >
                  Ignorer
                </button>
                <button
                  type="button"
                  onClick={resumeDraft}
                  className={[
                    "flex-1 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold transition",
                    isDark
                      ? "bg-white text-[#141416] hover:bg-neutral-200"
                      : "bg-neutral-900 text-white hover:bg-neutral-800",
                  ].join(" ")}
                >
                  Reprendre
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Éditeur de média ── */}
      <EditMediaModal
        isOpen={editingItem !== null}
        mediaItem={editingItem}
        isDark={isDark}
        onClose={() => setEditingItem(null)}
        onApply={handleApplyMediaEdit}
      />
    </div>
  );
}