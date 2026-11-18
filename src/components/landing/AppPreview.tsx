import type { ReactNode } from "react";
import {
  CalendarDays, Check, ChartColumn, House, MessageCircle, Pencil, Plus, Puzzle, Share2,
} from "lucide-react";
import NetworkLogo, { type LandingNetwork } from "./NetworkLogo";
import { cn } from "../../utils/cn";

export function WindowFrame({
  children,
  className,
  label = "Aperçu · contenu d’exemple",
}: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={cn(
      "overflow-hidden rounded-[22px] border border-black/[0.09] bg-white shadow-[0_2px_4px_rgba(0,0,0,0.04),0_40px_80px_-40px_rgba(0,0,0,0.35)] dark:border-white/[0.1] dark:bg-[#0f0f11] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_44px_90px_-40px_rgba(0,0,0,1)]",
      className
    )}>
      <div className="flex h-10 items-center gap-3 border-b border-black/[0.06] bg-[#faf9f7] px-4 dark:border-white/[0.07] dark:bg-[#141416]">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-black/[0.12] dark:bg-white/[0.16]" />
          <span className="h-2.5 w-2.5 rounded-full bg-black/[0.12] dark:bg-white/[0.16]" />
          <span className="h-2.5 w-2.5 rounded-full bg-black/[0.12] dark:bg-white/[0.16]" />
        </div>
        <span className="ml-auto rounded-full border border-black/[0.08] bg-white px-2.5 py-0.5 text-[10.5px] font-medium text-neutral-500 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-neutral-400">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

const SIDEBAR_ITEMS = [
  { label: "Accueil", icon: House },
  { label: "Calendrier", icon: CalendarDays, active: true },
  { label: "Créer", icon: Pencil },
  { label: "Communauté", icon: MessageCircle },
  { label: "Canaux", icon: Share2 },
  { label: "Insights", icon: ChartColumn },
  { label: "Intégrations", icon: Puzzle },
] as const;

function MiniSidebar() {
  return (
    <aside aria-hidden="true" className="hidden w-[176px] shrink-0 flex-col gap-1 border-r border-black/[0.06] bg-[#faf9f7] p-3 dark:border-white/[0.07] dark:bg-[#0b0b0c] md:flex">
      <div className="mb-3 flex items-center gap-1.5 px-2 pt-1">
        <img src="/images/icon.png" alt="" className="h-6 w-auto dark:invert" draggable={false} />
        <span className="font-display text-[15px] font-bold tracking-[-0.03em]">Stone</span>
      </div>
      <div className="mb-3 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-neutral-900 text-[12px] font-medium text-white dark:bg-white dark:text-neutral-900">
        <Plus size={14} /> Nouvelle publication
      </div>
      {SIDEBAR_ITEMS.map((item) => {
        const active = "active" in item && item.active;
        const Icon = item.icon;
        return (
          <div key={item.label} className={cn(
            "flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-[12.5px] font-medium",
            active ? "bg-black/[0.06] text-neutral-900 dark:bg-white/[0.09] dark:text-white" : "text-neutral-500 dark:text-neutral-400"
          )}>
            <Icon size={15} /> {item.label}
          </div>
        );
      })}
    </aside>
  );
}

type Chip = { day: number; hour: number; span: number; network: LandingNetwork; title: string; time: string; published?: boolean };
const DAYS = [
  { name: "Lun", date: 16 }, { name: "Mar", date: 17 }, { name: "Mer", date: 18, today: true },
  { name: "Jeu", date: 19 }, { name: "Ven", date: 20 }, { name: "Sam", date: 21 }, { name: "Dim", date: 22 },
];
const CHIPS: Chip[] = [
  { day: 0, hour: 10, span: 2, network: "instagram", title: "Lancement collection", time: "10:00", published: true },
  { day: 0, hour: 17, span: 2, network: "tiktok", title: "Coulisses du shooting", time: "17:30", published: true },
  { day: 1, hour: 13, span: 2, network: "threads", title: "Annonce atelier", time: "13:00", published: true },
  { day: 2, hour: 11, span: 2, network: "youtube", title: "Short du mercredi", time: "11:30" },
  { day: 3, hour: 9, span: 2, network: "pinterest", title: "Épingle inspiration", time: "09:00" },
  { day: 3, hour: 16, span: 2, network: "instagram", title: "Carrousel conseils", time: "16:00" },
  { day: 4, hour: 12, span: 2, network: "tiktok", title: "Vidéo produit", time: "12:15" },
  { day: 4, hour: 18, span: 2, network: "threads", title: "Question à la commu", time: "18:00" },
  { day: 5, hour: 10, span: 2, network: "youtube", title: "Short du week-end", time: "10:30" },
  { day: 6, hour: 15, span: 2, network: "instagram", title: "Reel récap", time: "15:00" },
];
const FIRST_HOUR = 8;
const LAST_HOUR = 20;
const HOUR_PX = 24;
const HOUR_LABELS = [8, 10, 12, 14, 16, 18, 20];

export function CalendarWeek({ className }: { className?: string }) {
  return (
    <div className={cn("min-w-0 flex-1 p-3 sm:p-4", className)} aria-hidden="true">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-[15px] font-bold tracking-[-0.02em]">Calendrier</h3>
          <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-white/[0.07] dark:text-neutral-400">Semaine</span>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white p-0.5 text-[11px] font-medium dark:border-white/[0.1] dark:bg-white/[0.04]">
          <span className="rounded-full px-2.5 py-1 text-neutral-500 dark:text-neutral-400">3 jours</span>
          <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-white dark:bg-white dark:text-neutral-900">Semaine</span>
          <span className="rounded-full px-2.5 py-1 text-neutral-500 dark:text-neutral-400">Mois</span>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-black/[0.07] dark:border-white/[0.08]">
        <div className="grid grid-cols-[34px_repeat(3,minmax(0,1fr))] border-b border-black/[0.07] bg-[#faf9f7] text-center dark:border-white/[0.08] dark:bg-[#141416] sm:grid-cols-[34px_repeat(7,minmax(0,1fr))]">
          <span />
          {DAYS.map((day, index) => (
            <div key={day.name} className={cn("py-2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400", index > 2 && "hidden sm:block")}>
              {day.name} <span className={cn(
                "ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px]",
                day.today ? "bg-neutral-900 font-semibold text-white dark:bg-white dark:text-neutral-900" : "text-neutral-800 dark:text-neutral-200"
              )}>{day.date}</span>
            </div>
          ))}
        </div>
        <div className="relative grid grid-cols-[34px_repeat(3,minmax(0,1fr))] sm:grid-cols-[34px_repeat(7,minmax(0,1fr))]" style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX }}>
          <div className="relative">
            {HOUR_LABELS.map((hour) => (
              <span key={hour} className="absolute right-1.5 -translate-y-1/2 text-[9.5px] text-neutral-400 dark:text-neutral-500" style={{ top: (hour - FIRST_HOUR) * HOUR_PX + 1 }}>
                {hour} h
              </span>
            ))}
          </div>
          {DAYS.map((day, dayIndex) => (
            <div key={day.name} className={cn(
              "relative border-l border-black/[0.06] dark:border-white/[0.07]",
              dayIndex > 2 && "hidden sm:block",
              day.today && "bg-black/[0.018] dark:bg-white/[0.025]"
            )}>
              {HOUR_LABELS.slice(1, -1).map((hour) => (
                <span key={hour} className="absolute inset-x-0 border-t border-black/[0.05] dark:border-white/[0.055]" style={{ top: (hour - FIRST_HOUR) * HOUR_PX }} />
              ))}
              {CHIPS.filter((chip) => chip.day === dayIndex).map((chip) => (
                <div key={chip.title} className={cn(
                  "absolute inset-x-1 flex flex-col justify-between overflow-hidden rounded-lg border px-1.5 py-1",
                  "border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:border-white/[0.1] dark:bg-[#1b1b1e] dark:shadow-none",
                  chip.published && "opacity-60"
                )} style={{ top: (chip.hour - FIRST_HOUR) * HOUR_PX + 1, height: chip.span * HOUR_PX - 3 }}>
                  <div className="flex items-center gap-1">
                    <NetworkLogo network={chip.network} size={14} />
                    <span className="truncate text-[10px] font-semibold leading-none">{chip.title}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[9.5px] leading-none text-neutral-500 dark:text-neutral-400">
                    {chip.published && <Check size={9} aria-hidden="true" />} {chip.time}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AppPreview() {
  return (
    <WindowFrame className="lp-app-window">
      <div className="flex">
        <MiniSidebar />
        <CalendarWeek />
      </div>
    </WindowFrame>
  );
}
