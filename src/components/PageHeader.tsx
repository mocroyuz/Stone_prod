import type { ReactNode } from "react";
import { Bookmark } from "lucide-react";

type PageHeaderProps = {
  title: string;
  icon: ReactNode;
  isDark: boolean;
  subtitle?: ReactNode;
  actions?: ReactNode;
  bookmarkAction?: ReactNode;
  centered?: boolean;
  className?: string;
};

export default function PageHeader({
  title,
  icon,
  isDark,
  subtitle,
  actions,
  bookmarkAction,
  centered = false,
  className = "",
}: PageHeaderProps) {
  return (
    <header
      className={[
        "flex w-full gap-4",
        centered
          ? "flex-col items-center text-center"
          : "flex-wrap items-center justify-between",
        className,
      ].join(" ")}
    >
      <div
        className={[
          "flex min-w-0 items-center gap-3 sm:gap-4",
          centered ? "justify-center" : "flex-1",
        ].join(" ")}
      >
        <div
          aria-hidden="true"
          className={[
            "flex h-[clamp(16px,1.733vw,23.333px)] w-[clamp(16px,1.733vw,23.333px)] shrink-0 items-center justify-center rounded-[6.667px] border",
            isDark
              ? "border-white/[0.08] bg-[#19191b] text-white"
              : "border-black/[0.07] bg-[#f7f6f3] text-neutral-900",
          ].join(" ")}
        >
          <span className="inline-flex scale-[0.333333]">{icon}</span>
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <h1
              className={[
                "font-display text-[clamp(24px,3.1vw,42px)] font-bold leading-[1.05] tracking-[-0.045em]",
                isDark ? "text-white" : "text-neutral-900",
              ].join(" ")}
            >
              {title}
            </h1>
            {bookmarkAction ?? (
              <Bookmark
                aria-hidden="true"
                className={[
                  "h-[18px] w-[18px] shrink-0 sm:h-5 sm:w-5",
                  isDark ? "text-white/65" : "text-neutral-500",
                ].join(" ")}
                strokeWidth={1.6}
              />
            )}
          </div>
          {subtitle && (
            <div
              className={[
                "mt-1.5 text-[13px] font-medium",
                isDark ? "text-neutral-400" : "text-neutral-500",
              ].join(" ")}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {actions}
    </header>
  );
}
