// src/components/insights/HeaderButton.tsx
// Bouton d'icône d'en-tête : même rendu que les IconButton de Create /
// Community (discret, arrondi, infobulle sombre au survol).

import type { ReactNode } from "react";
import type { Ink } from "./theme";

export default function HeaderButton({
  label,
  onClick,
  pressed,
  disabled,
  ink,
  isDark,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  ink: Ink;
  isDark: boolean;
  children: ReactNode;
}) {
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        disabled={disabled}
        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9 ${ink.focus} ${ink.hover} ${ink.soft}`}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute right-0 top-full z-50 mt-2 w-max max-w-[240px] rounded-lg px-3 py-2 text-[13px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 motion-reduce:transition-none group-hover:opacity-100 group-hover:delay-300 group-focus-within:opacity-100 max-md:hidden ${
          isDark ? "bg-[#2e2e31]" : "bg-neutral-900"
        }`}
      >
        {label}
      </span>
    </span>
  );
}
