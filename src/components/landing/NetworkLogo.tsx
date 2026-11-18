import { useId } from "react";
import { SiPinterest } from "@icons-pack/react-simple-icons";
import {
  ThreadsIcon,
  TikTokIcon,
  YouTubeIcon,
} from "../IntegrationIcons";
import { cn } from "../../utils/cn";

export type LandingNetwork =
  | "instagram"
  | "threads"
  | "youtube"
  | "tiktok"
  | "pinterest";

export const NETWORK_LABELS: Record<LandingNetwork, string> = {
  instagram: "Instagram",
  threads: "Threads",
  youtube: "YouTube Shorts",
  tiktok: "TikTok",
  pinterest: "Pinterest",
};

const INSTAGRAM_PATH =
  "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z";

/** Instagram avec un dégradé à identifiant unique : un SVG masqué (display:none)
 *  portant le même id casserait les autres instances. */
function InstagramGlyph({ size }: { size: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block" aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <path fill={`url(#${id})`} d={INSTAGRAM_PATH} />
    </svg>
  );
}

type Props = {
  network: LandingNetwork;
  /** Taille de la pastille en px. */
  size?: number;
  className?: string;
};

/**
 * Logo officiel du réseau posé sur une pastille blanche : même principe que
 * dans l'application, pour rester lisible dans les deux thèmes (le glyphe
 * TikTok est noir, Threads aussi).
 */
export default function NetworkLogo({ network, size = 28, className }: Props) {
  const glyph = Math.round(size * 0.62);

  if (network === "youtube") {
    return (
      <span
        className={cn("inline-flex shrink-0 ring-1 ring-black/[0.08]", className)}
        style={{ width: size, height: size, borderRadius: "24%" }}
      >
        <YouTubeIcon className="h-full w-full" title="YouTube Shorts" />
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={NETWORK_LABELS[network]}
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-white text-black ring-1 ring-black/[0.08]",
        className
      )}
      style={{ width: size, height: size, borderRadius: "26%" }}
    >
      {network === "instagram" && <InstagramGlyph size={glyph} />}
      {network === "threads" && <ThreadsIcon size={glyph} className="block" mono="black" />}
      {network === "tiktok" && <TikTokIcon size={glyph} className="block" />}
      {network === "pinterest" && (
        <SiPinterest size={glyph} color="#E60023" className="block" aria-hidden="true" />
      )}
    </span>
  );
}
