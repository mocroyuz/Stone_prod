// src/components/insights/RangeControl.tsx
// Choix de la période : bouton + menu (7 j / 30 j / mois / personnalisé).
// « Personnalisé » ouvre le calendrier (de / à). Desktop : popover ancré ;
// mobile : feuille en bas d'écran.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, Check, ChevronDown } from "lucide-react";
import { CalendarPicker } from "../CalendarPicker";
import { COPY, type Lang, type Range } from "./copy";
import { fmt, startOfDay } from "./data";
import type { Ink } from "./theme";

const PRESETS: Range[] = ["7d", "30d", "mtd"];

export default function RangeControl({
  range,
  start,
  end,
  onPreset,
  onCustom,
  ink,
  isDark,
  isMobile,
  lang,
}: {
  range: Range;
  start: Date;
  end: Date;
  onPreset: (r: Range) => void;
  onCustom: (start: Date, end: Date) => void;
  ink: Ink;
  isDark: boolean;
  isMobile: boolean;
  lang: Lang;
}) {
  const c = COPY[lang];
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [field, setField] = useState<"from" | "to">("from");
  const [draft, setDraft] = useState<{ s: Date; e: Date }>({ s: start, e: end });
  const wrap = useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!isMobile && wrap.current && !wrap.current.contains(e.target as Node))
        close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, isMobile]);

  const toggle = () => {
    if (open) return close();
    setView("list");
    setField("from");
    setDraft({ s: start, e: end });
    setOpen(true);
  };

  const pickDate = (d: Date) => {
    if (field === "from") {
      const e = startOfDay(d) > draft.e ? d : draft.e;
      setDraft({ s: d, e });
      setField("to");
    } else {
      const s = startOfDay(d) < draft.s ? d : draft.s;
      setDraft({ s, e: d });
    }
  };

  const label =
    range === "custom"
      ? `${fmt(start, lang)} – ${fmt(end, lang)}`
      : c.ranges[range];

  const row = (active: boolean) =>
    `flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-[13px] font-medium transition-colors md:min-h-9 md:text-[12.5px] ${ink.focus} ${ink.hover} ${
      active ? ink.strong : ink.soft
    }`;

  const body = (
    <div>
      {view === "list" ? (
        <div className="p-1.5">
          {PRESETS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                onPreset(r);
                close();
              }}
              className={row(range === r)}
            >
              {c.ranges[r]}
              {range === r && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          ))}
          <div className={`mx-1 my-1 border-t ${ink.hairline}`} />
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={row(range === "custom")}
          >
            {c.ranges.custom}…
            {range === "custom" && (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      ) : (
        <>
          <div className={`flex gap-1 border-b p-2 ${ink.hairline}`}>
            {(["from", "to"] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={field === id}
                onClick={() => setField(id)}
                className={`h-9 flex-1 whitespace-nowrap rounded-lg px-2 text-[12px] font-semibold transition-colors ${ink.focus} ${
                  field === id
                    ? isDark
                      ? "bg-white/[0.10] text-white"
                      : "bg-neutral-900 text-white"
                    : `${ink.soft} ${ink.hover}`
                }`}
              >
                {id === "from" ? c.calendar.from : c.calendar.to} ·{" "}
                {fmt(id === "from" ? draft.s : draft.e, lang)}
              </button>
            ))}
          </div>
          <div className="p-3">
            <p className={`mb-2 text-[12px] ${ink.soft}`}>
              {field === "from" ? c.calendar.helpFrom : c.calendar.helpTo}
            </p>
            <CalendarPicker
              key={field}
              value={field === "from" ? draft.s : draft.e}
              onChange={pickDate}
              isDark={isDark}
              disablePast={false}
              max={today}
              min={field === "to" ? startOfDay(draft.s) : undefined}
            />
          </div>
          <div
            className={`flex items-center justify-between border-t px-3 py-2 ${ink.hairline}`}
          >
            <button
              type="button"
              onClick={() => setView("list")}
              className={`h-9 rounded-lg px-2 text-[12.5px] font-semibold ${ink.focus} ${ink.hover} ${ink.soft}`}
            >
              {c.calendar.back}
            </button>
            <button
              type="button"
              onClick={() => {
                onCustom(draft.s, draft.e);
                close();
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold ${ink.focus} ${ink.solid}`}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
              {c.calendar.done}
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={c.calendar.rangeAria}
        onClick={toggle}
        className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold transition-colors md:h-9 ${ink.focus} ${ink.card} ${ink.hover} ${ink.strong}`}
      >
        <Calendar className={`h-3.5 w-3.5 ${ink.muted}`} aria-hidden="true" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${ink.muted} ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && !isMobile && (
        <div
          role="dialog"
          aria-label={c.sheets.dateRange}
          className={`absolute right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border ${ink.float} ${
            view === "calendar" ? "w-[300px]" : "w-[200px]"
          }`}
        >
          {body}
        </div>
      )}

      {open &&
        isMobile &&
        createPortal(
          <div className="fixed inset-0 z-[90]">
            <button
              type="button"
              aria-label={c.calendar.done}
              onClick={close}
              className="absolute inset-0 bg-black/45"
            />
            <div
              role="dialog"
              aria-label={c.sheets.dateRange}
              className={`absolute inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] overflow-hidden rounded-3xl border ${ink.float}`}
            >
              {body}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
