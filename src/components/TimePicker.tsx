import { useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type SimpleTimeOption = {
  value: number;
  label: string;
  disabled?: boolean;
};

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 12 6 6L20 6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Date helpers (natifs, sans dépendance)                              */
/* ------------------------------------------------------------------ */

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function withTime(base: Date, hour: number, minute: number) {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function startOfHour(d: Date) {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x;
}
function endOfHour(d: Date) {
  const x = new Date(d);
  x.setMinutes(59, 59, 999);
  return x;
}
function startOfMinute(d: Date) {
  const x = new Date(d);
  x.setSeconds(0, 0);
  return x;
}
function endOfMinute(d: Date) {
  const x = new Date(d);
  x.setSeconds(59, 999);
  return x;
}

/* Label FR : l'heure 0 s'affiche "Minuit", sinon 00, 01, ... 23. */
function hourLabel(h: number) {
  return h === 0 ? "Minuit" : pad2(h);
}

/* ------------------------------------------------------------------ */
/* TimePicker — format 24h uniquement, sans AM/PM                      */
/* ------------------------------------------------------------------ */

export function TimePicker({
  value,
  onChange,
  isDark = false,
  minuteStep = 5,
  min,
  max,
  disabled,
  hasError,
  className,
}: {
  value: Date;
  onChange: (date: Date) => void;
  isDark?: boolean;
  /** Pas entre deux minutes proposées (5 par défaut). */
  minuteStep?: number;
  min?: Date;
  max?: Date;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const hour = value.getHours();
  const minute = value.getMinutes();

  const containerRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLButtonElement>(null);
  const minuteRef = useRef<HTMLButtonElement>(null);

  /* Fermeture au clic extérieur / Escape */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /* Scroll auto (silencieux) vers la sélection à l'ouverture */
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      hourRef.current?.scrollIntoView({ block: "center" });
      minuteRef.current?.scrollIntoView({ block: "center" });
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const hourOptions: SimpleTimeOption[] = useMemo(() => {
    return Array.from({ length: 24 }, (_, h) => {
      const hStart = startOfHour(withTime(value, h, 0));
      const hEnd = endOfHour(withTime(value, h, 0));
      let dis = false;
      if (min && hEnd < min) dis = true;
      if (max && hStart > max) dis = true;
      return { value: h, label: hourLabel(h), disabled: dis };
    });
  }, [value, min, max]);

  const minuteOptions: SimpleTimeOption[] = useMemo(() => {
    const steps = Math.max(1, Math.floor(60 / minuteStep));
    return Array.from({ length: steps }, (_, i) => {
      const m = i * minuteStep;
      const mStart = startOfMinute(withTime(value, hour, m));
      const mEnd = endOfMinute(withTime(value, hour, m));
      let dis = false;
      if (min && mEnd < min) dis = true;
      if (max && mStart > max) dis = true;
      return { value: m, label: pad2(m), disabled: dis };
    });
  }, [value, min, max, hour, minuteStep]);

  const commit = (nextHour: number, nextMinute: number) => {
    let next = withTime(value, nextHour, nextMinute);
    if (min && next < min) next = new Date(min);
    if (max && next > max) next = new Date(max);
    onChange(next);
  };

  const handleHourSelect = (opt: SimpleTimeOption) => commit(opt.value, minute);
  const handleMinuteSelect = (opt: SimpleTimeOption) => commit(hour, opt.value);

  const display = `${pad2(hour)}:${pad2(minute)}`;

  return (
    <div className="relative" ref={containerRef}>
      {/* Masque visuellement les scrollbars natives tout en gardant le défilement. */}
      <style>{`
        .tp-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .tp-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={[
          "flex w-full items-center justify-between rounded-[10px] border px-3 py-2 text-[13px] font-normal outline-none transition",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          hasError
            ? "border-[#C24B41]"
            : isDark
              ? "border-white/10 bg-[#242427] text-white hover:border-white/25"
              : "border-black/[0.08] bg-neutral-50 text-neutral-900 hover:border-black/20",
          className ?? "",
        ].join(" ")}
      >
        {display}
        <span className={isDark ? "text-neutral-500" : "text-neutral-400"}>
          <ClockIcon />
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          className={[
            "absolute left-0 bottom-full z-50 mb-1.5 w-full min-w-[140px] overflow-hidden rounded-[12px] border shadow-lg",
            isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/[0.06] bg-white",
          ].join(" ")}
        >
          <div
            className={[
              "flex h-40 divide-x",
              isDark ? "divide-white/10" : "divide-black/10",
            ].join(" ")}
          >
            <TimeColumn
              options={hourOptions}
              selected={hour}
              onSelect={handleHourSelect}
              isDark={isDark}
              activeRef={hourRef}
            />
            <TimeColumn
              options={minuteOptions}
              selected={minute}
              onSelect={handleMinuteSelect}
              isDark={isDark}
              activeRef={minuteRef}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TimeColumn({
  options,
  selected,
  onSelect,
  isDark,
  activeRef,
}: {
  options: SimpleTimeOption[];
  selected: number;
  onSelect: (opt: SimpleTimeOption) => void;
  isDark: boolean;
  activeRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="tp-scroll flex-1 overflow-y-auto py-1">
      {options.map((opt) => {
        const isSelected = opt.value === selected;
        return (
          <button
            key={opt.value}
            ref={isSelected ? activeRef : undefined}
            type="button"
            disabled={opt.disabled}
            onClick={() => onSelect(opt)}
            className={[
              "flex w-full items-center gap-1.5 px-3 py-1.5 text-[12.5px] transition",
              opt.disabled ? "cursor-not-allowed opacity-30" : "cursor-pointer",
              isSelected
                ? isDark
                  ? "bg-white/10 font-semibold text-white"
                  : "bg-black/5 font-semibold text-neutral-900"
                : isDark
                  ? "text-neutral-300 hover:bg-white/5"
                  : "text-neutral-600 hover:bg-black/[0.03]",
            ].join(" ")}
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center">
              {isSelected && <CheckIcon />}
            </span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}