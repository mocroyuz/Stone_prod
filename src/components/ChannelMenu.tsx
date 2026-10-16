// src/components/ChannelMenu.tsx
// Sélecteur de channel partagé (même rendu que celui d'Insights) :
// avatar + badge réseau, nom, chevron, bookmark, menu déroulant + "Manage channels".

import { useEffect, useRef, useState, type ComponentType } from "react";
import { Bookmark, Check, ChevronDown, Plus } from "lucide-react";
import { navigate } from "../hooks/useHashRoute";
import type { ConnectedChannel } from "../hooks/useConnectedChannels";
import {
  XIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
  YouTubeIcon,
  PinterestIcon,
  ThreadsIcon,
} from "./IntegrationIcons";

type IconComponent = ComponentType<{ className?: string }>;

const NETWORK_ICONS: Record<string, IconComponent> = {
  x: XIcon as IconComponent,
  facebook: FacebookIcon as IconComponent,
  instagram: InstagramIcon as IconComponent,
  linkedin: LinkedInIcon as IconComponent,
  tiktok: TikTokIcon as IconComponent,
  youtube: YouTubeIcon as IconComponent,
  pinterest: PinterestIcon as IconComponent,
  threads: ThreadsIcon as IconComponent,
};

function getNetworkIcon(channel?: ConnectedChannel): IconComponent | undefined {
  if (!channel) return undefined;
  const c = channel as unknown as Record<string, unknown>;
  const raw = String(c.platform ?? c.network ?? c.provider ?? channel.key)
    .toLowerCase()
    .trim();

  if (raw.includes("tiktok")) return NETWORK_ICONS.tiktok;
  if (raw.includes("insta")) return NETWORK_ICONS.instagram;
  if (raw.includes("youtube") || raw === "yt") return NETWORK_ICONS.youtube;
  if (raw.includes("facebook") || raw === "fb") return NETWORK_ICONS.facebook;
  if (raw.includes("linkedin")) return NETWORK_ICONS.linkedin;
  if (raw.includes("pinterest")) return NETWORK_ICONS.pinterest;
  if (raw.includes("threads")) return NETWORK_ICONS.threads;
  if (raw === "x" || raw.includes("twitter")) return NETWORK_ICONS.x;
  return undefined;
}

const channelName = (c?: ConnectedChannel) =>
  c ? (c.handle || c.name).replace(/^@/, "") : "No channel";

function NetworkBadge({ channel, isDark }: { channel?: ConnectedChannel; isDark: boolean }) {
  const Icon = getNetworkIcon(channel);
  if (!Icon) return null;
  return (
    <span
      className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-black ring-1 ${
        isDark ? "ring-[#0f0f11]" : "ring-white"
      }`}
    >
      <Icon className="h-2.5 w-2.5" />
    </span>
  );
}

export function ChannelAvatar({
  channel,
  isDark,
  size = 36,
  showNetwork = true,
}: {
  channel?: ConnectedChannel;
  isDark: boolean;
  size?: number;
  showNetwork?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [channel?.avatarUrl]);
  const label = (channel?.handle || channel?.name || "?").replace(/^@/, "");
  const box = { width: size, height: size };

  return (
    <span className="relative inline-flex shrink-0" style={box}>
      {channel?.avatarUrl && !failed ? (
        <img
          src={channel.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={box}
          className="rounded-full object-cover"
        />
      ) : (
        <span
          style={box}
          className={`flex items-center justify-center rounded-full text-[12px] font-semibold ${
            isDark ? "bg-white text-black" : "bg-neutral-900 text-white"
          }`}
        >
          {label.charAt(0).toUpperCase() || "?"}
        </span>
      )}
      {showNetwork && <NetworkBadge channel={channel} isDark={isDark} />}
    </span>
  );
}

export default function ChannelMenu({
  channels,
  current,
  isDark,
  onSelect,
}: {
  channels: ConnectedChannel[];
  current?: ConnectedChannel;
  isDark: boolean;
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const ring = isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";
  const hover = isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]";
  const text = isDark ? "text-white" : "text-neutral-900";
  const soft = isDark ? "text-neutral-400" : "text-neutral-500";
  const muted = isDark ? "text-neutral-600" : "text-neutral-400";
  const border = isDark ? "border-white/[0.07]" : "border-black/[0.06]";
  const popover = isDark ? "border-white/10 bg-[#1b1b1e]" : "border-black/10 bg-white";
  const boxed = isDark
    ? "border border-white/[0.07] bg-white/[0.04]"
    : "border border-black/[0.06] bg-white";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const canSwitch = channels.length > 1;

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={!canSwitch}
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-3 rounded-xl py-1 pr-2 transition-colors disabled:cursor-default ${ring} ${
            canSwitch ? hover : ""
          }`}
        >
          <ChannelAvatar channel={current} isDark={isDark} size={28} />
          <span className={`max-w-[160px] truncate text-[14px] font-semibold tracking-[-0.01em] ${text}`}>
            {channelName(current)}
          </span>
          {canSwitch && <ChevronDown className={`h-4 w-4 ${muted}`} aria-hidden="true" />}
        </button>

        <button
          type="button"
          aria-label={saved ? "Remove bookmark" : "Bookmark"}
          onClick={() => setSaved((s) => !s)}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${ring} ${soft} ${hover}`}
        >
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-50 mt-2 w-64 rounded-2xl border p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] ${popover}`}
        >
          {channels.map((c) => {
            const active = c.key === current?.key;
            return (
              <button
                key={c.key}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setOpen(false);
                  onSelect(c.key);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${ring} ${hover}`}
              >
                <ChannelAvatar channel={c} isDark={isDark} size={28} showNetwork={false} />
                <span className={`min-w-0 flex-1 truncate text-[12px] font-semibold ${text}`}>
                  {channelName(c)}
                </span>
                {active && <Check className={`h-4 w-4 ${text}`} aria-hidden="true" />}
              </button>
            );
          })}
          <div className={`my-1 border-t ${border}`} />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("channels");
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[12px] font-semibold transition-colors ${ring} ${hover} ${soft}`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-current opacity-60">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            Manage channels
          </button>
        </div>
      )}
    </div>
  );
}