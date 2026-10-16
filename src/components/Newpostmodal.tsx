import { useEffect, useMemo, useRef, useState } from "react";
import { EmojiPicker as FrimousseEmojiPicker } from "frimousse";
import {
  Maximize2, Minimize2, X, Tag, FileText,
  Eye, Smile, Hash, Image as ImageIcon, ImagePlus, Pencil, ChevronDown,
  CalendarClock, Check, Sparkles, ArrowLeft, Wand2, Plus, Trash2,
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
  youtube?: YouTubeOptions;
};

export function unavailablePostActionMessage(payload: NewPostPayload): string {
  if (payload.scheduleMode === "save_in_folder") {
    return "L'enregistrement dans un dossier n'est pas encore connecté. Ce post n'a pas été enregistré.";
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
    "les canaux sélectionnés";

  return payload.scheduleMode === "later"
    ? `La programmation vers ${channels} n'est pas encore connectée. Ce post n'a pas été programmé.`
    : `La publication vers ${channels} n'est pas encore connectée. Ce post n'y a pas été envoyé.`;
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

const SCHEDULE_ACTIONS: {
  id: ScheduleAction;
  label: string;
  description: string;
}[] = [
  { id: "save_in_folder", label: "Enregistrer dans un dossier", description: "Garde ton post de côté pour le publier plus tard." },
  { id: "now", label: "Maintenant", description: "Publie ton post tout de suite." },
  { id: "set_date", label: "Choisir une date et une heure", description: "Programme une heure précise, ou utilise notre suggestion." },
];

const POSTING_SLOTS: { label: string; hour: number; minute: number }[] = [
  { label: "9:00", hour: 9, minute: 0 },
  { label: "12:00", hour: 12, minute: 0 },
  { label: "18:00", hour: 18, minute: 0 },
];

const TIKTOK_PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Tout le monde",
  MUTUAL_FOLLOW_FRIENDS: "Amis",
  FOLLOWER_OF_CREATOR: "Abonnés",
  SELF_ONLY: "Moi uniquement",
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
  { id: "unlisted", label: "Non répertoriée" },
  { id: "private", label: "Privée" },
];

const YOUTUBE_LICENSES: { id: YouTubeLicense; label: string }[] = [
  { id: "youtube", label: "Licence YouTube standard" },
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
  return date.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
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
      reject(new Error("Impossible de lire la durée de la vidéo."));
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
  if (!ctx) throw new Error("Impossible de convertir une image pour TikTok.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  );

  if (!blob) throw new Error("Impossible de convertir une image pour TikTok.");

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

type ChannelTileData = {
  channel: ConnectedChannel;
  network: (typeof SOCIAL_NETWORKS)[number];
  order: number;
};

/* ──────────────────────────────────────────────────────────────
   Constantes de design (alignées sur la BottomBar)
   ────────────────────────────────────────────────────────────── */

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

function ChevronIcon() {
  return (
    <svg {...svgProps} width={16} height={16} strokeWidth={2}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...svgProps} width={16} height={16} strokeWidth={2}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

const ANIMATIONS = `
@keyframes npm-modal-in {
  from { opacity: 0; transform: translateY(14px) scale(.985); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes npm-scrim-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes npm-card-in {
  from { opacity: 0; transform: translateY(7px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes npm-menu-in {
  from { opacity: 0; transform: translateY(6px) scale(.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .npm-motion { animation: none !important; transition-duration: 0.01ms !important; }
}
`;

/* ──────────────────────────────────────────────────────────────
   Pastille d'un canal connecté
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
        isDark ? "focus-visible:ring-offset-[#1c1c1e]" : "focus-visible:ring-offset-white",
        isSelected
          ? isDark
            ? "opacity-100 ring-2 ring-white ring-offset-[3px] ring-offset-[#1c1c1e]"
            : "opacity-100 ring-2 ring-neutral-900 ring-offset-[3px] ring-offset-white"
          : "opacity-45 grayscale hover:opacity-80 hover:grayscale-0 active:scale-95",
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
          isDark ? "ring-[#1c1c1e]" : "ring-white",
        ].join(" ")}
      >
        <NetworkIcon className="h-3 w-3" />
      </span>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────
   Select stylé
   ────────────────────────────────────────────────────────────── */

function StylishSelect<T extends string>({
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
          "w-full cursor-pointer appearance-none rounded-2xl border py-2.5 pl-4 pr-10 text-[14px] font-medium outline-none transition",
          "focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
          isDark
            ? "border-white/10 bg-[#242427] text-white hover:bg-[#2b2b2e] focus:border-white/30 focus-visible:ring-offset-[#1c1c1e]"
            : "border-black/10 bg-white text-neutral-900 hover:bg-neutral-50 focus:border-black/30 focus-visible:ring-offset-white",
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
   Case à cocher stylée
   ────────────────────────────────────────────────────────────── */

function Checkbox({
  checked,
  onChange,
  label,
  isDark,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  isDark: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      className={[
        "flex select-none items-center gap-2.5 text-[14px] font-medium",
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
          "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border transition",
          isDark
            ? "peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500"
            : "peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500",
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
   Emoji picker
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
        "npm-motion absolute bottom-full left-0 z-50 mb-3 overflow-hidden rounded-[22px] border shadow-2xl",
        "animate-[npm-menu-in_200ms_cubic-bezier(0.2,0.8,0.2,1)_both]",
        isDark
          ? "border-white/10 bg-[#19191c]/[97%] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
          : "border-black/[0.06] bg-white/[98%] shadow-[0_24px_70px_rgba(0,0,0,0.16)]",
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
            "z-10 mx-2 mt-2 appearance-none rounded-xl px-3 py-2 text-[13px] outline-none",
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

  const [requestTick, setRequestTick] = useState(0);

  const [youtubeOptions, setYoutubeOptions] = useState<YouTubeOptions>(
    YOUTUBE_DEFAULT_OPTIONS
  );

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
  const mediaRef = useRef<MediaItem[]>(media);
  mediaRef.current = media;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const closeWithDraftRef = useRef<() => void>(() => {});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<{ start: number; end: number } | null>(null);

  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const onRequestOpenRef = useRef(onRequestOpen);
  onRequestOpenRef.current = onRequestOpen;

  const preselectRef = useRef<SocialNetworkId | null>(null);

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
          e instanceof Error ? e.message : "Impossible de charger les paramètres TikTok."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, tiktokSelected, tiktokInfo, tiktokInfoAttempt]);

  if (!isOpen) return null;

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

  const discardAndClose = () => {
    savedDraft = null;
    clearForm();
    onClose();
  };

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

    requestAnimationFrame(() => {
      const el = textareaRef.current;
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
    ? "TikTok ne supporte pas la programmation. Choisis « Maintenant » ou retire TikTok."
    : scheduleAction === "save_in_folder"
    ? null
    : !tiktokPostType
    ? "TikTok exige une vidéo ou au moins une photo. Ajoute un média ou décoche TikTok."
    : tiktokMode === "direct" && !tiktokOptions.privacy_level
    ? tiktokPrivacyOptions.length === 0 && !tiktokInfoError
      ? "Chargement des paramètres TikTok…"
      : "Choisis qui peut voir ton TikTok."
    : tiktokMode === "direct" &&
      tiktokCommercial.on &&
      !tiktokCommercial.yourBrand &&
      !tiktokCommercial.branded
    ? "Indique si ton contenu fait la promotion de toi, d'un tiers, ou des deux."
    : null;

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
    ? "Ajoute un titre pour ta vidéo YouTube Shorts."
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

  const tiktokLabelNotice =
    tiktokMode === "direct" && tiktokCommercial.on
      ? tiktokCommercial.branded
        ? `Ta ${tiktokPostType === "photo" ? "photo" : "vidéo"} sera étiquetée « Partenariat rémunéré »`
        : tiktokCommercial.yourBrand
        ? `Ta ${tiktokPostType === "photo" ? "photo" : "vidéo"} sera étiquetée « Contenu promotionnel »`
        : null
      : null;

  const showTikTokDeclaration = tiktokSelected && scheduleAction === "now";

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const tiktokNow = tiktokSelected && scheduleAction === "now";

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

        if (tiktokVideo) {
          const maxDuration = (
            tiktokInfo as unknown as { max_video_post_duration_sec?: number } | null
          )?.max_video_post_duration_sec;

          if (maxDuration) {
            const duration = await getVideoDuration(tiktokVideo);
            if (duration > maxDuration) {
              throw new Error(
                `Cette vidéo est trop longue pour ton compte TikTok (max ${Math.floor(
                  maxDuration / 60
                )} min ${maxDuration % 60 ? `${maxDuration % 60} s` : ""}).`.replace(
                  /\s+\)/,
                  ")"
                )
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
              ? "Préparation du carrousel…"
              : "Préparation de la photo…"
          );

          const photos = await Promise.all(
            tiktokImages.map((item) => toTikTokImage(item.file))
          );

          setSubmitProgress("Envoi des photos à TikTok…");

          publishId = await publishPhotosToTikTok({
            photos,
            caption,
            mode: tiktokMode,
            options,
          });
        } else {
          setSubmitProgress("Envoi de la vidéo à TikTok…");

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
              ? "TikTok traite ton contenu…"
              : "Finalisation…"
          );
        });

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
        ? "Ce compte TikTok a atteint sa limite de publications pour le moment. Réessaie plus tard."
        : raw || "Une erreur est survenue pendant la publication.";

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
      ? "Enregistrer dans un dossier"
      : "Maintenant";

  const submitLabel = isSubmitting
    ? scheduleAction === "save_in_folder"
      ? "Enregistrement…"
      : "Publication…"
    : scheduleAction === "now"
    ? tiktokSelected && tiktokMode === "draft"
      ? "Envoyer sur TikTok"
      : "Publier"
    : scheduleAction === "save_in_folder"
    ? "Enregistrer"
    : "Programmer";

  /* ── Thèmes ── */
  const bgModal = isDark ? "bg-[#141416]" : "bg-[#faf9f6]";
  const bgPanel = isDark ? "bg-[#1c1c1e]" : "bg-[#f5f3ef]";
  const border = isDark ? "border-white/10" : "border-black/[0.06]";
  const textPrimary = isDark ? "text-white" : "text-neutral-900";
  const textSecondary = isDark ? "text-neutral-400" : "text-neutral-500";
  const textEyebrow = isDark ? "text-neutral-500" : "text-neutral-400";

  const accentBg = isDark ? "bg-white/10" : "bg-neutral-200";
  const accentText = isDark ? "text-white" : "text-neutral-900";
  const accentCheck = isDark ? "text-white" : "text-neutral-900";
  const accentSolid = isDark ? "bg-white/5" : "bg-neutral-100";
  const accentBorder = isDark ? "border-white/15" : "border-black/10";

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2";
  const ringOffset = isDark
    ? "focus-visible:ring-offset-[#141416]"
    : "focus-visible:ring-offset-white";

  const allowRows: {
    key: keyof TikTokAllow;
    label: string;
    forced: boolean;
  }[] = [
    { key: "comment", label: "Autoriser les commentaires", forced: Boolean(tiktokInfo?.comment_disabled) },
    ...(tiktokPostType === "photo"
      ? []
      : [
          { key: "duet" as const, label: "Autoriser le duo", forced: Boolean(tiktokInfo?.duet_disabled) },
          { key: "stitch" as const, label: "Autoriser le stitch", forced: Boolean(tiktokInfo?.stitch_disabled) },
        ]),
  ];

  const linkClass = "underline underline-offset-2 hover:opacity-80";

  return (
    <>
      <style>{ANIMATIONS}</style>

      <div
        className="npm-motion fixed inset-0 z-50 flex items-center justify-center p-3 animate-[npm-scrim-in_200ms_ease-out_both]"
        style={{
          backgroundColor: isDark
            ? "rgba(0,0,0,0.65)"
            : "rgba(0,0,0,0.28)",
          backdropFilter: "blur(6px)",
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeWithDraft();
        }}
      >
        <div
          className={[
            "npm-motion relative flex flex-col overflow-hidden border",
            "animate-[npm-modal-in_280ms_cubic-bezier(0.2,0.8,0.2,1)_both]",
            isFullscreen
              ? "h-[96vh] w-[96vw] rounded-[28px]"
              : "h-[90vh] w-full max-w-[1200px] rounded-[28px]",
            bgModal,
            border,
            isDark
              ? "shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
              : "shadow-[0_32px_80px_rgba(0,0,0,0.22)]",
          ].join(" ")}
        >
          {/* ── Header ── */}
          <div
            className={[
              "flex shrink-0 items-center justify-between gap-4 border-b px-6 py-4",
              border,
            ].join(" ")}
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="min-w-0">
                <p
                  className={[
                    "text-[10px] font-bold uppercase tracking-[0.16em]",
                    isDark ? "text-violet-300" : "text-violet-600",
                  ].join(" ")}
                >
                  Espace de création
                </p>
                <h2
                  className={[
                    "mt-0.5 text-[19px] font-semibold tracking-[-0.04em]",
                    textPrimary,
                  ].join(" ")}
                >
                  Créer un post
                </h2>
              </div>

              <button
                type="button"
                className={[
                  "hidden items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition sm:flex",
                  border,
                  textSecondary,
                  isDark
                    ? "hover:border-white/20 hover:text-white"
                    : "hover:border-black/20 hover:text-neutral-900",
                  focusRing,
                  ringOffset,
                ].join(" ")}
              >
                <Tag className="h-3.5 w-3.5" />
                Tags
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={[
                  "hidden items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition sm:flex",
                  textSecondary,
                  isDark ? "hover:bg-white/5 hover:text-white" : "hover:bg-black/5 hover:text-neutral-900",
                  focusRing,
                  ringOffset,
                ].join(" ")}
              >
                <FileText className="h-4 w-4" />
                Modèles
              </button>
              <div
                className={[
                  "mx-1 hidden h-5 w-px sm:block",
                  isDark ? "bg-white/10" : "bg-black/10",
                ].join(" ")}
              />
              <button
                type="button"
                onClick={() => setIsFullscreen((v) => !v)}
                aria-label={isFullscreen ? "Réduire" : "Agrandir"}
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full transition",
                  textSecondary,
                  isDark
                    ? "hover:bg-white/10 hover:text-white"
                    : "hover:bg-black/5 hover:text-neutral-900",
                  focusRing,
                  ringOffset,
                ].join(" ")}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={closeWithDraft}
                aria-label="Fermer"
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full transition",
                  textSecondary,
                  isDark
                    ? "hover:bg-white/10 hover:text-white"
                    : "hover:bg-black/5 hover:text-neutral-900",
                  focusRing,
                  ringOffset,
                ].join(" ")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Colonne gauche */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
              {/* Canaux connectés */}
              <div className="mb-5">
                <p
                  className={[
                    "mb-3 text-[10px] font-bold uppercase tracking-[0.16em]",
                    textEyebrow,
                  ].join(" ")}
                >
                  Canaux
                </p>
                <div className="flex flex-wrap items-center gap-3.5">
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
                    title="Connecter un réseau"
                    aria-label="Connecter un réseau"
                    className={[
                      "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-dashed transition",
                      isDark
                        ? "border-white/15 bg-transparent text-neutral-500 hover:border-white/30 hover:text-white"
                        : "border-black/15 bg-transparent text-neutral-400 hover:border-black/30 hover:text-neutral-900",
                      focusRing,
                      ringOffset,
                    ].join(" ")}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Zone de texte */}
              <div
                className={[
                  "relative flex min-h-[180px] flex-1 flex-col rounded-2xl border p-4 transition-colors",
                  border,
                  isDark
                    ? "bg-white/[0.025] focus-within:border-violet-500/40"
                    : "bg-white focus-within:border-violet-500/40",
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
                  placeholder="Commence à écrire, ou inspire-toi avec les modèles…"
                  className={[
                    "w-full flex-1 resize-none bg-transparent text-[15px] leading-relaxed outline-none",
                    textPrimary,
                    isDark
                      ? "placeholder:text-neutral-600"
                      : "placeholder:text-neutral-400",
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

              {/* Médias */}
              <div className="mt-4 flex flex-wrap items-end gap-3">
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
                          <img
                            src={item.url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="relative h-full w-full">
                            <video
                              src={item.url}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                              <Eye className="h-5 w-5" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div
                        className={[
                          "pointer-events-none absolute inset-0 transition-colors duration-150",
                          isHovered ? "bg-black/25" : "bg-black/0",
                        ].join(" ")}
                      />

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
                          focusRing,
                          ringOffset,
                          isHovered
                            ? "pointer-events-auto opacity-100"
                            : "pointer-events-none opacity-0",
                        ].join(" ")}
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>

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
                            focusRing,
                            ringOffset,
                            isHovered
                              ? "pointer-events-auto opacity-100"
                              : "pointer-events-none opacity-0",
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
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
                    }}
                    className={[
                      "flex h-[100px] w-[100px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-center transition-all duration-200",
                      focusRing,
                      ringOffset,
                      isDragging
                        ? isDark
                          ? "scale-[1.03] border-violet-400/60 bg-violet-400/[0.06]"
                          : "scale-[1.03] border-violet-400 bg-violet-50"
                        : isDark
                        ? "border-white/15 hover:border-white/30 hover:bg-white/[0.03]"
                        : "border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50",
                    ].join(" ")}
                  >
                    <ImagePlus
                      className={[
                        "h-6 w-6",
                        isDark ? "text-white/40" : "text-neutral-400",
                      ].join(" ")}
                      strokeWidth={1.75}
                    />
                    <span
                      className={[
                        "mt-1 text-[10px] font-medium leading-tight",
                        isDark ? "text-white/50" : "text-neutral-400",
                      ].join(" ")}
                    >
                      Glisser-déposer
                    </span>
                    <span
                      className={[
                        "text-[10px] font-semibold leading-tight",
                        textPrimary,
                      ].join(" ")}
                    >
                      ou parcourir
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
                    "mt-5 rounded-2xl border p-5",
                    border,
                    isDark ? "bg-[#1c1c1e]" : "bg-white",
                  ].join(" ")}
                >
                  <div className="mb-4 flex items-center gap-2.5">
                    <span
                      className={[
                        "flex h-7 w-7 items-center justify-center rounded-lg",
                        isDark ? "bg-white text-black" : "bg-neutral-900 text-white",
                      ].join(" ")}
                    >
                      <YouTubeIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className={["text-[14px] font-semibold tracking-[-0.01em]", textPrimary].join(" ")}>
                      Paramètres YouTube Shorts
                    </span>
                  </div>

                  <div className="flex flex-col gap-3.5">
                    <div className="grid grid-cols-[130px_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1.5">
                      <label
                        htmlFor="youtube-title"
                        className={["text-[13px] font-semibold", textPrimary].join(" ")}
                      >
                        Titre
                      </label>
                      <input
                        id="youtube-title"
                        type="text"
                        value={youtubeOptions.title}
                        maxLength={YOUTUBE_TITLE_MAX}
                        onChange={(e) => updateYoutube("title", e.target.value)}
                        placeholder="Titre de ta vidéo"
                        className={[
                          "w-full rounded-2xl border px-4 py-2.5 text-[14px] outline-none transition",
                          focusRing,
                          isDark
                            ? "border-white/10 bg-[#242427] text-white placeholder:text-neutral-500 focus:border-violet-500/50 focus-visible:ring-offset-[#1c1c1e]"
                            : "border-black/10 bg-white text-neutral-900 placeholder:text-neutral-400 focus:border-violet-500/50 focus-visible:ring-offset-white",
                        ].join(" ")}
                      />
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1.5">
                      <span className={["text-[13px] font-semibold", textPrimary].join(" ")}>
                        Catégorie
                      </span>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                        <StylishSelect
                          ariaLabel="Catégorie YouTube Shorts"
                          value={youtubeOptions.categoryId}
                          options={YOUTUBE_CATEGORIES}
                          onChange={(v) => updateYoutube("categoryId", v)}
                          isDark={isDark}
                          className="min-w-[200px] flex-1"
                        />
                        <div className="flex min-w-[220px] flex-1 items-center gap-4">
                          <span className={["text-[13px] font-semibold", textPrimary].join(" ")}>
                            Visibilité
                          </span>
                          <StylishSelect
                            ariaLabel="Visibilité YouTube Shorts"
                            value={youtubeOptions.visibility}
                            options={YOUTUBE_VISIBILITY}
                            onChange={(v) => updateYoutube("visibility", v)}
                            isDark={isDark}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-[130px_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1.5">
                      <span className={["text-[13px] font-semibold", textPrimary].join(" ")}>
                        Licence
                      </span>
                      <StylishSelect
                        ariaLabel="Licence YouTube Shorts"
                        value={youtubeOptions.license}
                        options={YOUTUBE_LICENSES}
                        onChange={(v) => updateYoutube("license", v)}
                        isDark={isDark}
                      />
                    </div>

                    <div className="grid grid-cols-[130px_1fr] gap-3 max-sm:grid-cols-1">
                      <span aria-hidden="true" className="max-sm:hidden" />
                      <div className="flex flex-wrap items-center gap-x-8 gap-y-2.5">
                        <Checkbox
                          label="Notifier les abonnés"
                          checked={youtubeOptions.notifySubscribers}
                          onChange={(v) => updateYoutube("notifySubscribers", v)}
                          isDark={isDark}
                        />
                        <Checkbox
                          label="Autoriser l'intégration"
                          checked={youtubeOptions.allowEmbedding}
                          onChange={(v) => updateYoutube("allowEmbedding", v)}
                          isDark={isDark}
                        />
                        <Checkbox
                          label="Contenu pour enfants"
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
                <div
                  className={[
                    "mt-5 rounded-2xl border p-5 text-[13px]",
                    border,
                    isDark ? "bg-[#1c1c1e]" : "bg-white",
                  ].join(" ")}
                >
                  <p className={["mb-1 text-[13px] font-semibold tracking-[-0.01em]", textPrimary].join(" ")}>
                    Publication sur TikTok
                    {tiktokInfo?.creator_nickname ? (
                      <span className={["ml-1 font-normal", textSecondary].join(" ")}>
                        · {tiktokInfo.creator_nickname}
                      </span>
                    ) : null}
                  </p>

                  <p className={["mb-3 text-[12px] leading-relaxed", textSecondary].join(" ")}>
                    {tiktokPostType === "photo"
                      ? tiktokImages.length > 1
                        ? `Carrousel de ${tiktokImages.length} photos`
                        : "Publication photo"
                      : tiktokPostType === "video"
                      ? tiktokImages.length > 0
                        ? "Publication vidéo (tes images ne seront pas envoyées à TikTok)"
                        : "Publication vidéo"
                      : "Ajoute une vidéo, ou une ou plusieurs photos (plusieurs photos forment un carrousel)."}
                  </p>

                  {tiktokInfoError && (
                    <p className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-red-500">
                      <span>{tiktokInfoError}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setTiktokInfoError(null);
                          setTiktokInfoAttempt((n) => n + 1);
                        }}
                        className="font-semibold underline"
                      >
                        Réessayer
                      </button>
                    </p>
                  )}

                  <div className="mb-3 flex gap-2">
                    {(["direct", "draft"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTiktokMode(m)}
                        className={[
                          "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition",
                          focusRing,
                          ringOffset,
                          tiktokMode === m
                            ? isDark
                              ? "border-white/30 bg-white/10 text-white"
                              : "border-black/20 bg-neutral-100 text-neutral-900"
                            : [
                                border,
                                textSecondary,
                                isDark
                                  ? "hover:border-white/20 hover:text-white"
                                  : "hover:border-black/20 hover:text-neutral-900",
                              ].join(" "),
                        ].join(" ")}
                      >
                        {m === "direct" ? "Publier directement" : "Brouillon TikTok"}
                      </button>
                    ))}
                  </div>

                  {tiktokMode === "direct" && (
                    <>
                      <div className="relative">
                        <select
                          value={tiktokOptions.privacy_level}
                          onChange={(e) =>
                            setTiktokOptions((o) => ({
                              ...o,
                              privacy_level:
                                e.target.value as TikTokPostOptions["privacy_level"],
                            }))
                          }
                          className={[
                            "w-full cursor-pointer appearance-none rounded-2xl border py-2.5 pl-4 pr-10 text-[13px] outline-none transition",
                            focusRing,
                            isDark
                              ? "border-white/10 bg-[#242427] text-white focus:border-violet-500/50 focus-visible:ring-offset-[#1c1c1e]"
                              : "border-black/10 bg-white text-neutral-900 focus:border-violet-500/50 focus-visible:ring-offset-white",
                          ].join(" ")}
                        >
                          <option value="">
                            Qui peut voir ce {tiktokPostType === "photo" ? "post" : "contenu"}…
                          </option>
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
                        <ChevronDown
                          className={[
                            "pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2",
                            isDark ? "text-neutral-300" : "text-neutral-500",
                          ].join(" ")}
                        />
                      </div>

                      {brandedChosen && (
                        <p className={["mt-2 text-[11.5px]", textSecondary].join(" ")}>
                          La visibilité du contenu sponsorisé ne peut pas être privée.
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-4">
                        {allowRows.map(({ key, label, forced }) => (
                          <label
                            key={key}
                            title={
                              forced
                                ? "Désactivé dans tes paramètres TikTok"
                                : undefined
                            }
                            className={[
                              "flex items-center gap-2 text-[12.5px]",
                              forced ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                              textSecondary,
                            ].join(" ")}
                          >
                            <input
                              type="checkbox"
                              checked={!forced && tiktokAllow[key]}
                              disabled={forced}
                              onChange={(e) =>
                                setTiktokAllow((a) => ({
                                  ...a,
                                  [key]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 rounded border-neutral-400 accent-violet-500"
                            />
                            {label}
                          </label>
                        ))}
                      </div>

                      <div className={["mt-4 border-t pt-4", border].join(" ")}>
                        <label
                          className={[
                            "flex cursor-pointer items-center justify-between gap-3",
                            textPrimary,
                          ].join(" ")}
                        >
                          <span className="min-w-0">
                            <span className="block text-[12.5px] font-semibold">
                              Divulgation de contenu
                            </span>
                            <span className={["block text-[11.5px]", textSecondary].join(" ")}>
                              Active pour indiquer que ce contenu fait la promotion de toi, d'une marque, d'un produit ou d'un service.
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
                            className="h-4 w-4 shrink-0 rounded border-neutral-400 accent-violet-500"
                          />
                        </label>

                        {tiktokCommercial.on && (
                          <div className="mt-3 flex flex-col gap-2 pl-1">
                            <label
                              className={[
                                "flex cursor-pointer items-center gap-2 text-[12.5px]",
                                textSecondary,
                              ].join(" ")}
                            >
                              <input
                                type="checkbox"
                                checked={tiktokCommercial.yourBrand}
                                onChange={(e) =>
                                  setTiktokCommercial((c) => ({
                                    ...c,
                                    yourBrand: e.target.checked,
                                  }))
                                }
                                className="h-4 w-4 rounded border-neutral-400 accent-violet-500"
                              />
                              Ta marque
                              <span className="text-[11.5px] opacity-80">
                                — tu fais la promotion de toi ou de ton activité
                              </span>
                            </label>

                            <label
                              title={
                                tiktokOptions.privacy_level === "SELF_ONLY"
                                  ? "La visibilité du contenu sponsorisé ne peut pas être privée."
                                  : undefined
                              }
                              className={[
                                "flex items-center gap-2 text-[12.5px]",
                                tiktokOptions.privacy_level === "SELF_ONLY"
                                  ? "cursor-not-allowed opacity-50"
                                  : "cursor-pointer",
                                textSecondary,
                              ].join(" ")}
                            >
                              <input
                                type="checkbox"
                                checked={tiktokCommercial.branded}
                                disabled={tiktokOptions.privacy_level === "SELF_ONLY"}
                                onChange={(e) =>
                                  setTiktokCommercial((c) => ({
                                    ...c,
                                    branded: e.target.checked,
                                  }))
                                }
                                className="h-4 w-4 rounded border-neutral-400 accent-violet-500"
                              />
                              Contenu sponsorisé
                              <span className="text-[11.5px] opacity-80">
                                — tu fais la promotion d'une autre marque ou d'un tiers
                              </span>
                            </label>

                            {tiktokOptions.privacy_level === "SELF_ONLY" && (
                              <p className={["text-[11.5px]", textSecondary].join(" ")}>
                                La visibilité du contenu sponsorisé ne peut pas être privée. Choisis une autre visibilité pour l'activer.
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

                  <p className={["mt-4 text-[11.5px] leading-relaxed", textSecondary].join(" ")}>
                    Après publication, quelques minutes peuvent être nécessaires avant que ton contenu soit traité et visible sur ton profil TikTok.
                  </p>
                </div>
              )}

              {/* ── Tags ── */}
              <div className="mt-5">
                <label
                  htmlFor="hashtag-input"
                  className={[
                    "mb-2 block text-[10px] font-bold uppercase tracking-[0.16em]",
                    textEyebrow,
                  ].join(" ")}
                >
                  Tags
                </label>

                <div
                  onClick={() => document.getElementById("hashtag-input")?.focus()}
                  className={[
                    "flex min-h-[56px] cursor-text flex-wrap items-center gap-2 rounded-2xl border px-3 py-2.5 transition-colors",
                    border,
                    isDark
                      ? "bg-white/[0.025] focus-within:border-violet-500/40"
                      : "bg-white focus-within:border-violet-500/40",
                  ].join(" ")}
                >
                  {hashtags.map((tag) => (
                    <span
                      key={tag}
                      className={[
                        "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium",
                        isDark
                          ? "border-white/10 bg-[#2a2a2d] text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                          : "border-black/[0.06] bg-white text-neutral-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
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
                        className={[
                          isDark
                            ? "text-neutral-400 hover:text-white"
                            : "text-neutral-500 hover:text-neutral-900",
                        ].join(" ")}
                      >
                        <X className="h-3.5 w-3.5" />
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
                      } else if (
                        e.key === "Backspace" &&
                        !hashtagDraft &&
                        hashtags.length > 0
                      ) {
                        removeHashtag(hashtags[hashtags.length - 1]);
                      }
                    }}
                    onBlur={commitHashtagDraft}
                    placeholder={hashtags.length === 0 ? "Ajouter un tag…" : ""}
                    className={[
                      "min-w-[100px] flex-1 bg-transparent px-1 text-[14px] outline-none",
                      textPrimary,
                      isDark
                        ? "placeholder:text-neutral-600"
                        : "placeholder:text-neutral-400",
                    ].join(" ")}
                  />
                </div>
              </div>

              {mediaError && (
                <p className="mt-2 text-[11.5px] text-red-500">{mediaError}</p>
              )}

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

              {/* Barre d'outils */}
              <div
                className={[
                  "mt-4 flex items-center gap-2 border-t pt-3",
                  border,
                ].join(" ")}
              >
                <div ref={emojiWrapRef} className="relative">
                  <button
                    type="button"
                    title="Emoji"
                    aria-label="Ajouter un emoji"
                    aria-haspopup="dialog"
                    aria-expanded={showEmojiPicker}
                    onClick={() => setShowEmojiPicker((open) => !open)}
                    className={[
                      "flex h-9 w-9 items-center justify-center rounded-full transition",
                      focusRing,
                      ringOffset,
                      showEmojiPicker
                        ? isDark
                          ? "bg-white/10 text-white"
                          : "bg-black/5 text-neutral-900"
                        : textSecondary,
                      isDark
                        ? "hover:bg-white/10 hover:text-white"
                        : "hover:bg-black/5 hover:text-neutral-900",
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
                  title="Ajouter un tag"
                  aria-label="Ajouter un tag"
                  onClick={() => document.getElementById("hashtag-input")?.focus()}
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full transition",
                    focusRing,
                    ringOffset,
                    textSecondary,
                    isDark
                      ? "hover:bg-white/10 hover:text-white"
                      : "hover:bg-black/5 hover:text-neutral-900",
                  ].join(" ")}
                >
                  <Hash className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Colonne droite : Previews */}
            <div
              className={[
                "hidden w-[400px] shrink-0 flex-col border-l lg:flex",
                border,
                bgPanel,
              ].join(" ")}
            >
              <div
                className={[
                  "flex items-center gap-2 border-b px-5 py-4",
                  border,
                ].join(" ")}
              >
                <h3 className={["text-[14px] font-semibold tracking-[-0.01em]", textPrimary].join(" ")}>
                  Aperçu du post
                </h3>
                <div
                  className={[
                    "flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold",
                    textSecondary,
                    border,
                  ].join(" ")}
                >
                  i
                </div>
              </div>

              <div className="flex flex-1 items-center justify-center p-6">
                {content.trim() || media.length > 0 ? (
                  <div
                    className={[
                      "w-full max-w-[300px] rounded-2xl border p-4 shadow-sm",
                      border,
                      isDark ? "bg-[#242427]" : "bg-white",
                    ].join(" ")}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <div
                        className={[
                          "h-8 w-8 rounded-full",
                          isDark ? "bg-white/10" : "bg-neutral-200",
                        ].join(" ")}
                      />
                      <div>
                        <div
                          className={[
                            "h-2 w-20 rounded",
                            isDark ? "bg-white/10" : "bg-neutral-200",
                          ].join(" ")}
                        />
                        <div
                          className={[
                            "mt-1 h-2 w-12 rounded",
                            isDark ? "bg-white/5" : "bg-neutral-100",
                          ].join(" ")}
                        />
                      </div>
                    </div>
                    {content && (
                      <p
                        className={[
                          "text-[13px] leading-relaxed",
                          textPrimary,
                        ].join(" ")}
                      >
                        {content}
                      </p>
                    )}
                    {hashtags.length > 0 && (
                      <p
                        className={[
                          "mt-2 text-[12px]",
                          isDark ? "text-white/60" : "text-neutral-500",
                        ].join(" ")}
                      >
                        {hashtags.map((t) => `#${t}`).join(" ")}
                      </p>
                    )}
                    {media.length > 0 && (
                      <div className="relative mt-3 overflow-hidden rounded-xl">
                        {media[0].kind === "image" ? (
                          <img
                            src={media[0].url}
                            alt=""
                            className="w-full object-cover"
                          />
                        ) : (
                          <video
                            src={media[0].url}
                            className="w-full object-cover"
                            muted
                            playsInline
                          />
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
                    <div
                      className={[
                        "relative mb-4 flex h-32 w-32 items-center justify-center rounded-2xl border-2 border-dashed",
                        isDark ? "border-neutral-600/30" : "border-neutral-300",
                      ].join(" ")}
                    >
                      <div
                        className={[
                          "flex h-16 w-16 items-center justify-center rounded-xl",
                          isDark ? "bg-white/5" : "bg-neutral-200/50",
                        ].join(" ")}
                      >
                        <ImageIcon
                          className={["h-6 w-6", textSecondary].join(" ")}
                        />
                      </div>
                      <Sparkles
                        className={[
                          "absolute -right-2 -top-2 h-5 w-5",
                          isDark ? "text-white/30" : "text-neutral-300",
                        ].join(" ")}
                      />
                      <Sparkles
                        className={[
                          "absolute -bottom-1 -left-1 h-3 w-3",
                          isDark ? "text-white/30" : "text-neutral-300",
                        ].join(" ")}
                      />
                    </div>
                    <p className={["text-[13px]", textSecondary].join(" ")}>
                      Vois l'aperçu de ton post ici
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div
            className={[
              "relative flex shrink-0 items-center justify-end gap-4 border-t px-6 py-4",
              border,
            ].join(" ")}
          >
            {showTikTokDeclaration && (
              <div className="mr-auto flex min-w-0 flex-1 flex-col gap-1">
                <p
                  className={[
                    "text-[11.5px] leading-snug",
                    textSecondary,
                  ].join(" ")}
                >
                  En publiant, tu acceptes la{" "}
                  {brandedChosen && (
                    <>
                      <a
                        href={TIKTOK_BRANDED_URL}
                        target="_blank"
                        rel="noreferrer"
                        className={linkClass}
                      >
                        politique de contenu sponsorisé
                      </a>{" "}
                      et la{" "}
                    </>
                  )}
                  <a
                    href={TIKTOK_MUSIC_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={linkClass}
                  >
                    confirmation d'usage musical
                  </a>{" "}
                  de TikTok.
                </p>
              </div>
            )}

            <div className="relative shrink-0" ref={dropdownRef}>
              <div
                className={[
                  "flex items-stretch overflow-hidden rounded-full border p-1",
                  border,
                  isDark ? "bg-white/[0.04]" : "bg-black/[0.03]",
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
                    "flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition",
                    focusRing,
                    ringOffset,
                    textPrimary,
                    isDark ? "hover:bg-white/5" : "hover:bg-black/5",
                  ].join(" ")}
                >
                  <CalendarClock
                    className={["h-4 w-4", textSecondary].join(" ")}
                  />
                  <span>{footerLabel}</span>
                  <ChevronDown
                    className={[
                      "h-3.5 w-3.5 transition",
                      showActionMenu || showDateTimePanel ? "rotate-180" : "",
                      textSecondary,
                    ].join(" ")}
                  />
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={[
                    "rounded-full px-5 py-2 text-[13.5px] font-semibold transition active:scale-[0.98]",
                    focusRing,
                    ringOffset,
                    canSubmit
                      ? isDark
                        ? "bg-white text-[#141416] hover:bg-neutral-200"
                        : "bg-neutral-950 text-white hover:bg-neutral-800"
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
                    "npm-motion absolute bottom-full right-0 z-50 mb-3 w-[340px] overflow-hidden rounded-[22px] border p-2 shadow-2xl",
                    "animate-[npm-menu-in_200ms_cubic-bezier(0.2,0.8,0.2,1)_both]",
                    isDark
                      ? "border-white/10 bg-[#19191c]/[97%] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
                      : "border-black/[0.06] bg-white/[98%] shadow-[0_24px_70px_rgba(0,0,0,0.16)]",
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
                          "flex w-full items-start gap-2 rounded-2xl px-3 py-2.5 text-left transition",
                          focusRing,
                          ringOffset,
                          isSelected
                            ? `${accentBg} ${accentText}`
                            : isDark
                            ? "text-neutral-200 hover:bg-white/5"
                            : "text-neutral-700 hover:bg-black/[0.04]",
                        ].join(" ")}
                      >
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                          {isSelected && (
                            <Check
                              className={["h-4 w-4", accentCheck].join(" ")}
                              strokeWidth={3}
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={[
                              "block text-[13.5px] font-semibold tracking-[-0.01em]",
                              isSelected ? accentText : "",
                            ].join(" ")}
                          >
                            {action.label}
                          </span>
                          <span
                            className={[
                              "mt-0.5 block text-[12px] leading-snug",
                              isSelected
                                ? isDark
                                  ? "text-white/80"
                                  : "text-neutral-700"
                                : textSecondary,
                            ].join(" ")}
                          >
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
                    "npm-motion absolute bottom-full right-0 z-50 mb-3 w-[280px] overflow-hidden rounded-[22px] border shadow-2xl",
                    "animate-[npm-menu-in_200ms_cubic-bezier(0.2,0.8,0.2,1)_both]",
                    isDark
                      ? "border-white/10 bg-[#19191c]/[97%] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
                      : "border-black/[0.06] bg-white/[98%] shadow-[0_24px_70px_rgba(0,0,0,0.16)]",
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

                  <div className={["border-t p-3", border].join(" ")}>
                    <p
                      className={[
                        "mb-2 text-[13px] font-semibold",
                        textPrimary,
                      ].join(" ")}
                    >
                      Créneaux suggérés
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
                              "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-semibold transition",
                              focusRing,
                              ringOffset,
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
                    <p
                      className={[
                        "mb-2 text-[13px] font-semibold",
                        textPrimary,
                      ].join(" ")}
                    >
                      Heure
                    </p>
                    <div
                      className={[
                        "rounded-xl border px-3 py-2",
                        accentSolid,
                        accentBorder,
                      ].join(" ")}
                    >
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

                  <div
                    className={[
                      "flex items-center justify-between border-t px-3 py-2.5",
                      border,
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowDateTimePanel(false);
                        setShowActionMenu(true);
                      }}
                      className={[
                        "flex items-center gap-1.5 rounded-full px-2 py-1 text-[12.5px] font-semibold transition",
                        focusRing,
                        ringOffset,
                        textPrimary,
                        isDark ? "hover:bg-white/5" : "hover:bg-black/5",
                      ].join(" ")}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Retour
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDateTimePanel(false)}
                      className={[
                        "flex items-center gap-1.5 rounded-full px-2 py-1 text-[12.5px] font-semibold transition",
                        focusRing,
                        ringOffset,
                        textPrimary,
                        isDark ? "hover:bg-white/5" : "hover:bg-black/5",
                      ].join(" ")}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      Valider
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Dialogue : brouillon ── */}
          {pendingDraft && (
            <div className="npm-motion absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[3px] animate-[npm-scrim-in_180ms_ease-out_both]">
              <div
                className={[
                  "npm-motion w-[380px] rounded-[28px] border p-6 text-center animate-[npm-modal-in_240ms_cubic-bezier(0.2,0.8,0.2,1)_both]",
                  isDark
                    ? "border-white/10 bg-[#19191c] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
                    : "border-black/[0.06] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.16)]",
                ].join(" ")}
              >
                <p
                  className={[
                    "text-[10px] font-bold uppercase tracking-[0.16em]",
                    isDark ? "text-violet-300" : "text-violet-600",
                  ].join(" ")}
                >
                  Brouillon trouvé
                </p>
                <h3
                  className={[
                    "mt-1.5 text-[19px] font-semibold tracking-[-0.04em]",
                    textPrimary,
                  ].join(" ")}
                >
                  Reprendre votre brouillon ?
                </h3>
                <p
                  className={[
                    "mt-2 text-[13px] leading-relaxed",
                    textSecondary,
                  ].join(" ")}
                >
                  Tu avais un post en cours. Reprendre là où tu en étais ou repartir de zéro ?
                </p>
                {pendingDraft.content && (
                  <p
                    className={[
                      "mt-3 line-clamp-2 rounded-2xl px-3.5 py-2.5 text-left text-[12.5px] leading-relaxed",
                      isDark
                        ? "bg-white/[0.04] text-neutral-300"
                        : "bg-neutral-100 text-neutral-600",
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
                      "flex flex-1 items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-[13.5px] font-semibold transition",
                      focusRing,
                      ringOffset,
                      border,
                      textPrimary,
                      isDark ? "hover:bg-white/5" : "hover:bg-black/5",
                    ].join(" ")}
                  >
                    <Trash2 className="h-4 w-4" />
                    Ignorer
                  </button>
                  <button
                    type="button"
                    onClick={resumeDraft}
                    className={[
                      "flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-semibold transition",
                      focusRing,
                      ringOffset,
                      isDark
                        ? "bg-white text-[#141416] hover:bg-neutral-200"
                        : "bg-neutral-950 text-white hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    <ArrowLeft className="h-4 w-4 rotate-180" />
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
    </>
  );
}