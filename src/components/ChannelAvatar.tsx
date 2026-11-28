// src/components/ChannelAvatar.tsx
import { useEffect, useRef, useState } from "react";

type Props = {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
  /** Appelé UNE fois par URL si l'image échoue (URL expirée). */
  onBroken?: () => void;
};

export default function ChannelAvatar({
  src,
  name = "",
  size = 40,
  className,
  onBroken,
}: Props) {
  const [failed, setFailed] = useState(false);
  const retriedFor = useRef<string | null>(null);

  // Nouvelle URL (après rafraîchissement) → on réessaie d'afficher l'image.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initial = (name.trim()[0] || "?").toUpperCase();

  if (!src || failed) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e5e7eb",
          color: "#374151",
          fontWeight: 600,
          fontSize: size * 0.45,
          flexShrink: 0,
        }}
        aria-label={name}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={className}
      referrerPolicy="no-referrer"
      style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      onError={() => {
        setFailed(true);

        // Un seul retry par URL : évite toute boucle infinie.
        if (retriedFor.current !== src) {
          retriedFor.current = src;
          onBroken?.();
        }
      }}
    />
  );
}