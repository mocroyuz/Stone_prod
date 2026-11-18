import type { ReactNode } from "react";
import { Check, Crop, Send } from "lucide-react";
import NetworkLogo, { NETWORK_LABELS, type LandingNetwork } from "./NetworkLogo";
import { cn } from "../../utils/cn";

/* Aperçus fidèles à l'interface de Stone, avec du contenu d'exemple.
   Tous sont décoratifs (aria-hidden) : le texte de la carte porte le sens. */

const panel =
  "rounded-2xl border border-black/[0.07] bg-[#faf9f7] dark:border-white/[0.08] dark:bg-[#0b0b0c]";
const innerCard =
  "rounded-xl border border-black/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.09] dark:bg-[#1a1a1d] dark:shadow-none";

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden="true" className={cn(panel, "p-3.5 sm:p-4", className)}>
      {children}
    </div>
  );
}

/* ───────── 1. Programmation multi-réseaux ───────── */

const COMPOSER_NETWORKS: LandingNetwork[] = ["instagram", "threads", "youtube", "tiktok", "pinterest"];

export function ComposerPreview() {
  return (
    <Frame>
      <p className="mb-2.5 text-[12px] font-semibold">Nouvelle publication</p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {COMPOSER_NETWORKS.map((network, index) => (
          <span
            key={network}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[11px] font-medium",
              index < 3
                ? "border-neutral-900 bg-white dark:border-white dark:bg-white/[0.08]"
                : "border-black/[0.1] text-neutral-500 dark:border-white/[0.12] dark:text-neutral-400"
            )}
          >
            <NetworkLogo network={network} size={18} />
            {NETWORK_LABELS[network]}
            {index < 3 && <Check size={11} />}
          </span>
        ))}
      </div>

      <div className={cn(innerCard, "p-3")}>
        <p className="text-[12.5px] leading-relaxed text-neutral-800 dark:text-neutral-200">
          Les coulisses de notre nouvelle collection arrivent jeudi. Dites-nous ce que vous aimeriez voir en premier.
        </p>
        <div className="mt-3 flex gap-2">
          {["/images/case-1.jpg", "/images/case-2.jpg"].map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              width={44}
              height={44}
              loading="lazy"
              decoding="async"
              className="h-11 w-11 rounded-lg object-cover"
              draggable={false}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white p-0.5 text-[11px] font-medium dark:border-white/[0.1] dark:bg-white/[0.04]">
          <span className="rounded-full px-2.5 py-1 text-neutral-500 dark:text-neutral-400">Maintenant</span>
          <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-white dark:bg-white dark:text-neutral-900">
            Programmer
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          Jeu. 19 nov. · 18:30
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-neutral-900 px-3 font-medium text-white dark:bg-white dark:text-neutral-900">
            <Send size={11} /> Programmer
          </span>
        </span>
      </div>
    </Frame>
  );
}

/* ───────── 2. Calendrier éditorial (vue mois) ───────── */

const MONTH_DAYS = [
  26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
];
const MONTH_POSTS: Record<number, LandingNetwork[]> = {
  3: ["instagram"],
  5: ["tiktok", "threads"],
  10: ["youtube"],
  12: ["instagram"],
  16: ["pinterest", "instagram"],
  18: ["youtube"],
  19: ["instagram", "threads"],
  24: ["tiktok"],
  26: ["pinterest"],
};

export function MonthPreview() {
  return (
    <Frame className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-semibold">Novembre</p>
        <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10.5px] font-medium text-neutral-500 dark:bg-white/[0.07] dark:text-neutral-400">
          Mois
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["L", "M", "M", "J", "V", "S", "D"].map((name, index) => (
          <span key={index} className="pb-1 text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
            {name}
          </span>
        ))}
        {MONTH_DAYS.map((day, index) => {
          const outside = index < 6 || index > 29;
          const today = !outside && day === 18;
          const posts = !outside ? MONTH_POSTS[day] : undefined;
          return (
            <div
              key={index}
              className={cn(
                "flex h-[42px] flex-col items-center justify-between rounded-lg border py-1",
                outside
                  ? "border-transparent text-neutral-300 dark:text-neutral-600"
                  : "border-black/[0.06] bg-white dark:border-white/[0.07] dark:bg-[#161618]",
                today && "border-neutral-900 dark:border-white"
              )}
            >
              <span className={cn("text-[10.5px]", today ? "font-bold" : "text-neutral-600 dark:text-neutral-400")}>
                {day}
              </span>
              <span className="flex -space-x-1">
                {posts?.slice(0, 2).map((network) => (
                  <NetworkLogo key={network} network={network} size={12} className="ring-1 ring-white dark:ring-[#161618]" />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

/* ───────── 3. Gestion des publications (statuts) ───────── */

type Status = "scheduled" | "published" | "draft" | "failed";

const STATUS_STYLE: Record<Status, { label: string; className: string }> = {
  scheduled: {
    label: "Programmé",
    className: "border-black/[0.12] text-neutral-700 dark:border-white/[0.16] dark:text-neutral-300",
  },
  published: {
    label: "Publié",
    className: "border-transparent bg-neutral-900 text-white dark:bg-white dark:text-neutral-900",
  },
  draft: {
    label: "Brouillon",
    className: "border-dashed border-black/[0.22] text-neutral-500 dark:border-white/[0.24] dark:text-neutral-400",
  },
  failed: {
    label: "Échec",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300",
  },
};

const POSTS: { network: LandingNetwork; title: string; date: string; status: Status }[] = [
  { network: "instagram", title: "Lancement collection", date: "16 nov. · 10:00", status: "published" },
  { network: "youtube", title: "Short du mercredi", date: "18 nov. · 11:30", status: "scheduled" },
  { network: "tiktok", title: "Vidéo produit", date: "20 nov. · 12:15", status: "draft" },
  { network: "pinterest", title: "Épingle inspiration", date: "19 nov. · 09:00", status: "failed" },
];

export function StatusPreview() {
  return (
    <Frame className="space-y-2 p-3">
      {POSTS.map((post) => {
        const style = STATUS_STYLE[post.status];
        return (
          <div key={post.title} className={cn(innerCard, "flex items-center gap-2.5 px-2.5 py-2")}>
            <NetworkLogo network={post.network} size={24} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold leading-tight">{post.title}</p>
              <p className="text-[10.5px] text-neutral-500 dark:text-neutral-400">{post.date}</p>
            </div>
            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-medium", style.className)}>
              {style.label}
            </span>
          </div>
        );
      })}
    </Frame>
  );
}

/* ───────── 4. Insights ───────── */

const WEEKDAYS = [
  { d: "L", v: 38 },
  { d: "M", v: 52 },
  { d: "M", v: 44 },
  { d: "J", v: 92, best: true },
  { d: "V", v: 70 },
  { d: "S", v: 34 },
  { d: "D", v: 26 },
];

export function InsightsPreview() {
  return (
    <Frame>
      <div className="mb-3 flex flex-wrap gap-1 text-[10.5px] font-medium">
        {["7 jours", "30 jours", "Mois en cours"].map((range, index) => (
          <span
            key={range}
            className={cn(
              "rounded-full px-2.5 py-1",
              index === 1
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "border border-black/[0.08] text-neutral-500 dark:border-white/[0.1] dark:text-neutral-400"
            )}
          >
            {range}
          </span>
        ))}
      </div>

      <p className="text-[12px] font-semibold">Meilleur moment pour publier</p>

      <div className="mt-3 flex h-[88px] items-end gap-1.5">
        {WEEKDAYS.map((day, index) => (
          <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div
              className={cn(
                "w-full rounded-md",
                day.best ? "bg-neutral-900 dark:bg-white" : "bg-black/[0.1] dark:bg-white/[0.14]"
              )}
              style={{ height: `${day.v * 0.78}%` }}
            />
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{day.d}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="inline-flex h-7 items-center rounded-full border border-black/[0.1] bg-white px-3 text-[11px] font-medium dark:border-white/[0.14] dark:bg-white/[0.05]">
          Utiliser jeudi 18 h
        </span>
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Données de démonstration</span>
      </div>
    </Frame>
  );
}

/* ───────── 5. Commentaires ───────── */

const COMMENTS = [
  { initial: "C", name: "Camille", text: "Super vidéo, la mise en scène est vraiment soignée.", time: "il y a 2 h", unread: true },
  { initial: "L", name: "Léo", text: "Vous prévoyez une suite ? Je serais preneur.", time: "il y a 5 h", unread: true },
];

export function CommentsPreview() {
  return (
    <Frame className="p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[12px] font-semibold">
          <NetworkLogo network="youtube" size={20} />
          Commentaires
        </span>
        <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-neutral-900">
          2 non lus
        </span>
      </div>

      <div className="space-y-2">
        {COMMENTS.map((comment) => (
          <div key={comment.name} className={cn(innerCard, "flex gap-2.5 p-2.5")}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[0.07] text-[11px] font-semibold dark:bg-white/[0.1]">
              {comment.initial}
            </span>
            <div className="min-w-0">
              <p className="text-[11.5px] font-semibold leading-tight">
                {comment.name}{" "}
                <span className="font-normal text-neutral-400 dark:text-neutral-500">· {comment.time}</span>
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-600 dark:text-neutral-300">{comment.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex h-9 items-center justify-between rounded-full border border-black/[0.09] bg-white pl-3.5 pr-1 text-[11.5px] text-neutral-400 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-neutral-500">
        Répondre…
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
          <Send size={12} />
        </span>
      </div>
    </Frame>
  );
}

/* ───────── 6. Médias et création ───────── */

const RATIOS = ["4:3", "16:9", "9:16", "1:1"];
const SOURCES = ["Canva", "Dropbox", "Google Drive", "Google Photos"];

export function MediaPreview() {
  return (
    <Frame>
      <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr]">
        <div className="relative overflow-hidden rounded-xl">
          <img
            src="/images/case-3.jpg"
            alt=""
            width={320}
            height={320}
            loading="lazy"
            decoding="async"
            className="aspect-square w-full object-cover"
            draggable={false}
          />
          <span className="absolute inset-[14%] rounded-md border border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.38)]" />
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white">
            <Crop size={10} /> Recadrer
          </span>
        </div>

        <div className="flex flex-col justify-between gap-3">
          <div>
            <p className="mb-1.5 text-[10.5px] font-medium text-neutral-500 dark:text-neutral-400">Format</p>
            <div className="flex flex-wrap gap-1">
              {RATIOS.map((ratio) => (
                <span
                  key={ratio}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10.5px] font-medium",
                    ratio === "1:1"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "border border-black/[0.1] text-neutral-600 dark:border-white/[0.12] dark:text-neutral-300"
                  )}
                >
                  {ratio}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10.5px] font-medium text-neutral-500 dark:text-neutral-400">Importer depuis</p>
            <div className="flex flex-wrap gap-1">
              {SOURCES.map((source) => (
                <span
                  key={source}
                  className="rounded-full border border-black/[0.1] bg-white px-2.5 py-1 text-[10.5px] font-medium text-neutral-700 dark:border-white/[0.12] dark:bg-white/[0.05] dark:text-neutral-300"
                >
                  {source}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ───────── 7. Comptes sociaux ───────── */

const ACCOUNTS: { network: LandingNetwork; hint: string; connected: boolean }[] = [
  { network: "instagram", hint: "Business ou Creator", connected: true },
  { network: "youtube", hint: "Chaîne", connected: true },
  { network: "tiktok", hint: "Business ou personnel", connected: false },
  { network: "pinterest", hint: "Business ou profil", connected: false },
];

export function AccountsPreview() {
  return (
    <Frame className="space-y-2 p-3">
      {ACCOUNTS.map((account) => (
        <div key={account.network} className={cn(innerCard, "flex items-center gap-2.5 px-2.5 py-2")}>
          <NetworkLogo network={account.network} size={26} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold leading-tight">{NETWORK_LABELS[account.network]}</p>
            <p className="truncate text-[10.5px] text-neutral-500 dark:text-neutral-400">
              {account.connected ? "Connecté" : account.hint}
            </p>
          </div>
          {account.connected ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
              <Check size={12} />
            </span>
          ) : (
            <span className="rounded-full border border-black/[0.12] px-2.5 py-1 text-[10.5px] font-medium dark:border-white/[0.16]">
              Connecter
            </span>
          )}
        </div>
      ))}
    </Frame>
  );
}
