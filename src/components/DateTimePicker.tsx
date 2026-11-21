import { useEffect, useRef, useState } from "react";
import { Clock, ChevronDown } from "lucide-react";
import { CalendarPicker } from "./CalendarPicker";
import { TimePicker } from "./TimePicker";

const WEEKDAY_LOCALE = "en-US";

export function DateTimePicker({
  isDark,
  date,
  onDateChange,
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  isDark: boolean;
  date: Date;
  onDateChange: (d: Date) => void;
  start: Date;
  end: Date;
  onStartChange: (d: Date) => void;
  onEndChange: (d: Date) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calendarOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setCalendarOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCalendarOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [calendarOpen]);

  const weekdayLabel = date.toLocaleDateString(WEEKDAY_LOCALE, { weekday: "long" });
  const dateLabel = date.toLocaleDateString(WEEKDAY_LOCALE, { day: "numeric", month: "long" });

  return (
    <div className="flex flex-col gap-3">
      {/* Ligne 1 : icône horloge + sélecteur de date */}
      <div className="flex items-center gap-2.5">
        <span className={["shrink-0", isDark ? "text-neutral-500" : "text-neutral-400"].join(" ")}>
          <Clock className="h-[18px] w-[18px]" />
        </span>

        <div className="relative" ref={containerRef}>
          <button
            type="button"
            onClick={() => setCalendarOpen((v) => !v)}
            aria-expanded={calendarOpen}
            aria-haspopup="dialog"
            className={[
              "flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[13px] font-medium transition",
              isDark
                ? "border-white/10 bg-[#242427] text-white hover:border-white/25"
                : "border-black/[0.08] bg-neutral-50 text-neutral-900 hover:border-black/20",
            ].join(" ")}
          >
            <span>{weekdayLabel}</span>
            <span className={isDark ? "text-neutral-500" : "text-neutral-400"}>· {dateLabel}</span>
            <ChevronDown
              className={["h-3.5 w-3.5 transition-transform", calendarOpen ? "rotate-180" : ""].join(" ")}
            />
          </button>

          {calendarOpen && (
            <div className="absolute left-0 top-full z-50 mt-1.5">
              <CalendarPicker
                value={date}
                onChange={onDateChange}
                isDark={isDark}
                onClose={() => setCalendarOpen(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Ligne 2 : icône horloge + Début / Fin */}
      <div className="flex items-start gap-2.5">
        <span className={["mt-[22px] shrink-0", isDark ? "text-neutral-500" : "text-neutral-400"].join(" ")}>
          <Clock className="h-[18px] w-[18px]" />
        </span>

        <div className="flex flex-1 items-start gap-2">
          <div className="flex-1">
            <span className={["mb-1 block text-[11px] font-medium", isDark ? "text-neutral-500" : "text-neutral-400"].join(" ")}>
              Début
            </span>
            <TimePicker value={start} onChange={onStartChange} isDark={isDark} />
          </div>

          <span className={["mt-[30px] text-[12px]", isDark ? "text-neutral-600" : "text-neutral-300"].join(" ")}>
            →
          </span>

          <div className="flex-1">
            <span className={["mb-1 block text-[11px] font-medium", isDark ? "text-neutral-500" : "text-neutral-400"].join(" ")}>
              Fin
            </span>
            <TimePicker value={end} onChange={onEndChange} isDark={isDark} min={start} />
          </div>
        </div>
      </div>
    </div>
  );
}