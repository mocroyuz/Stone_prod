// src/components/insights/Segmented.tsx
// Sélecteur segmenté : piste en creux, segment actif en relief (comme les
// bascules de schedule). Navigation clavier flèches gauche/droite.

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import type { Ink } from "./theme";

export type SegmentedOption<T extends string> = {
  key: T;
  label: ReactNode;
  ariaLabel?: string;
};

export default function Segmented<T extends string>({
  value,
  options,
  onChange,
  ink,
  isDark,
  label,
  size = "md",
  stretch = false,
  className = "",
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (key: T) => void;
  ink: Ink;
  isDark: boolean;
  label: string;
  size?: "sm" | "md";
  /** Segments de largeur égale, la piste prend toute la largeur. */
  stretch?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = options.findIndex((o) => o.key === value);
    const next =
      (i + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    onChange(options[next].key);
    refs.current[next]?.focus();
  };

  const pad = stretch
    ? "h-8 min-w-0 px-1 text-[12px]"
    : size === "sm"
      ? "h-7 px-2.5 text-[11.5px]"
      : "h-8 px-3 text-[12px]";

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className={`${stretch ? "flex w-full" : "inline-flex"} max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${ink.well} ${className}`}
    >
      {options.map((o, i) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.ariaLabel}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.key)}
            className={`${pad} ${stretch ? "flex-1" : "shrink-0"} whitespace-nowrap rounded-[10px] font-semibold transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none ${ink.focus} ${
              active
                ? isDark
                  ? "bg-white/[0.10] text-white shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                  : "bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.04)]"
                : `${ink.soft} ${isDark ? "hover:text-white" : "hover:text-neutral-900"}`
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
