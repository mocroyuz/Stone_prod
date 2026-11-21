// src/components/Avatar.tsx
import { useEffect, useState, type ReactNode } from "react";

type AvatarProps = {
  name: string;
  photoUrl?: string | null;
  isDark: boolean;
  /** Classes Tailwind de taille, ex. "h-10 w-10" */
  sizeClass?: string;
  textClass?: string;
  /** Arrondi de la photo (défaut : rond). Ex. "rounded-[14px]" */
  radiusClass?: string;
  /** Petit logo incrusté en bas à droite de la photo (ex. logo de l'app). */
  badge?: ReactNode;
  /** Classes du carré qui porte le badge (fond + anneau). */
  badgeClass?: string;
  /** Arrondi du badge (défaut : rond). Ex. "rounded-[5px]" */
  badgeRadiusClass?: string;
  title?: string;
};

/** Photo de profil, avec initiales du nom en repli et badge optionnel. */
export default function Avatar({
  name,
  photoUrl,
  isDark,
  sizeClass = "h-10 w-10",
  textClass = "text-[13px]",
  radiusClass = "rounded-full",
  badge,
  badgeClass = "",
  badgeRadiusClass = "rounded-full",
  title,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);

  // Si l'URL change, on retente le chargement.
  useEffect(() => {
    setFailed(false);
  }, [photoUrl]);

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  const core =
    photoUrl && !failed ? (
      <img
        src={photoUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={[
          "select-none object-cover",
          radiusClass,
          sizeClass,
        ].join(" ")}
      />
    ) : (
      <span
        aria-hidden="true"
        className={[
          "flex items-center justify-center font-semibold",
          radiusClass,
          sizeClass,
          textClass,
          isDark ? "bg-white/10 text-white" : "bg-black/[0.06] text-neutral-700",
        ].join(" ")}
      >
        {initials}
      </span>
    );

  return (
    <span className="relative inline-flex shrink-0" title={title}>
      {core}
      {badge && (
        <span
          className={[
            "absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center ring-2",
            badgeRadiusClass,
            badgeClass,
          ].join(" ")}
        >
          {badge}
        </span>
      )}
    </span>
  );
}