// src/components/insights/theme.ts
// Tokens visuels d'Insights — alignés mot pour mot sur ceux de home / schedule
// (fond de page, panneau principal, cartes, surfaces, texte, focus).

export type Ink = {
  /** Fond de la page (derrière le panneau principal). */
  page: string;
  /** Panneau principal arrondi. */
  panel: string;
  /** Carte posée sur le panneau. */
  card: string;
  /** Surface en creux à l'intérieur d'une carte. */
  well: string;
  /** Hover d'une surface. */
  hover: string;
  /** Filets (séparateurs). */
  hairline: string;
  /** Bordure complète. */
  border: string;
  strong: string;
  soft: string;
  muted: string;
  focus: string;
  /** Couleur pleine (SVG) du trait principal et des barres. */
  ink: string;
  /** Couleur pleine (SVG) du trait secondaire. */
  inkSoft: string;
  /** Grille / axes SVG. */
  grid: string;
  /** Accent unique, réservé au meilleur créneau. */
  accent: string;
  /** Bouton plein. */
  solid: string;
  /** Valeurs positives / négatives (texte uniquement, jamais de fond). */
  up: string;
  down: string;
  /** Ombre d'une carte flottante (popover, tooltip). */
  float: string;
};

export const ink = (isDark: boolean): Ink =>
  isDark
    ? {
        page: "bg-[#050505]",
        panel: "border-white/[0.07] bg-[#0a0a0c]",
        card: "border-white/[0.07] bg-[#0f0f11]",
        well: "border-white/[0.07] bg-white/[0.025]",
        hover: "hover:bg-white/[0.05]",
        hairline: "border-white/[0.07]",
        border: "border-white/[0.07]",
        strong: "text-white",
        soft: "text-neutral-400",
        muted: "text-neutral-500",
        focus:
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
        ink: "#f5f5f5",
        inkSoft: "rgba(255,255,255,0.28)",
        grid: "rgba(255,255,255,0.07)",
        accent: "#fb923c",
        solid: "bg-white text-neutral-900 hover:bg-neutral-200",
        up: "text-emerald-400",
        down: "text-rose-400",
        float:
          "border-white/10 bg-[#161618] shadow-[0_18px_48px_-12px_rgba(0,0,0,0.7)]",
      }
    : {
        page: "bg-[#f5f3ef]",
        panel: "border-black/[0.06] bg-white",
        card: "border-black/[0.06] bg-white",
        well: "border-black/[0.06] bg-[#f6f4f0]",
        hover: "hover:bg-black/[0.04]",
        hairline: "border-black/[0.06]",
        border: "border-black/[0.06]",
        strong: "text-neutral-900",
        soft: "text-neutral-500",
        muted: "text-neutral-400",
        focus:
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25",
        ink: "#171717",
        inkSoft: "rgba(0,0,0,0.22)",
        grid: "rgba(0,0,0,0.07)",
        accent: "#ea580c",
        solid: "bg-neutral-900 text-white hover:bg-neutral-800",
        up: "text-emerald-600",
        down: "text-rose-600",
        float:
          "border-black/[0.08] bg-white shadow-[0_18px_48px_-12px_rgba(0,0,0,0.22)]",
      };

/** Carte standard : mêmes finitions que les cartes de home. */
export const CARD =
  "rounded-2xl border shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

/** Titre de carte. */
export const CARD_TITLE = "text-[14px] font-semibold tracking-[-0.01em]";
