// src/components/OnboardingModals.tsx
//
// Onboarding en 2 étapes après la connexion d'un canal :
//   1. <ConfirmAccountModal />   -> sur /channels  ("Confirm your Account")
//   2. <FrequencyOnboarding />   -> sur /insights  (objectif de publication)
//
// Les deux sont reliés par sessionStorage (queueFrequencyOnboarding).
// Design aligné sur les maquettes : mêmes textes, mêmes layouts — seules les
// couleurs diffèrent (palette noir/blanc au lieu des accents verts).

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ComponentType, CSSProperties, KeyboardEvent, ReactNode, RefObject } from "react";

import { useTheme } from "../hooks/useTheme";

import {
  InstagramIcon,
  FacebookIcon,
  TikTokIcon,
  YouTubeIcon,
  PinterestIcon,
  ThreadsIcon,
} from "./IntegrationIcons";

/* ============================================================================
   TYPES + STORAGE
============================================================================ */

export type OnboardingChannelKey =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "threads";

export type OnboardingAccount = {
  key: OnboardingChannelKey;
  name: string;
  accountLabel: string;
  handle?: string;
  avatarUrl?: string;
};

type IconComponent = ComponentType<{ className?: string; size?: number }>;

const ICONS: Record<OnboardingChannelKey, IconComponent> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  pinterest: PinterestIcon,
  threads: ThreadsIcon,
};

const QUEUE_KEY = "stone:onboarding:frequency";
const GOAL_KEY = (key: string) => `stone:posting-goal:${key}`;

export function queueFrequencyOnboarding(account: OnboardingAccount) {
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(account));
  } catch {
    /* storage indisponible */
  }
}

function readQueued(): OnboardingAccount | null {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OnboardingAccount) : null;
  } catch {
    return null;
  }
}

function clearQueued() {
  try {
    sessionStorage.removeItem(QUEUE_KEY);
  } catch {
    /* noop */
  }
}

function saveGoal(key: string, postsPerWeek: number) {
  try {
    localStorage.setItem(GOAL_KEY(key), String(postsPerWeek));
  } catch {
    /* noop */
  }
}

/* ============================================================================
   PALETTE (blanc en dark, noir en light)
============================================================================ */

type Palette = {
  bg: string;
  border: string;
  borderStrong: string;
  surface: string;
  surfaceHover: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  overlay: string;
};

function palette(isDark: boolean): Palette {
  return isDark
    ? {
        bg: "#141414",
        border: "#262626",
        borderStrong: "#3a3a3a",
        surface: "#1a1a1a",
        surfaceHover: "#202020",
        text: "#ffffff",
        muted: "#8a8a93",
        accent: "#ffffff",
        accentText: "#0a0a0a",
        overlay: "rgba(0,0,0,0.72)",
      }
    : {
        bg: "#ffffff",
        border: "#e8e8ea",
        borderStrong: "#d4d4d8",
        surface: "#fafafa",
        surfaceHover: "#f4f4f5",
        text: "#0a0a0a",
        muted: "#76767f",
        accent: "#0a0a0a",
        accentText: "#ffffff",
        overlay: "rgba(24,24,27,0.4)",
      };
}

/* ============================================================================
   ICONS
============================================================================ */

function Svg({ className = "h-4 w-4", children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const CheckIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m5 12 4 4L19 6" />
  </Svg>
);
const ArrowIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </Svg>
);
const CloseIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m6 6 12 12" />
    <path d="m18 6-12 12" />
  </Svg>
);
const HelpIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </Svg>
);
const PencilIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </Svg>
);
const MinusIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M5 12h14" />
  </Svg>
);
const PlusIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Svg>
);

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} animate-spin`} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ============================================================================
   KEYFRAMES + STYLES PARTAGÉS (hover via CSS, plus de handlers JS)
============================================================================ */

function Keyframes() {
  return (
    <style>{`
      @keyframes stone-fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes stone-pop {
        from { opacity: 0; transform: translateY(10px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes stone-rise {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes stone-fall {
        0%   { opacity: 0; transform: translateY(-8px) rotate(0deg); }
        15%  { opacity: 1; }
        85%  { opacity: 1; }
        100% { opacity: 0; transform: translateY(46px) rotate(220deg); }
      }
      @keyframes stone-check {
        from { transform: scale(0.4); opacity: 0; }
        to   { transform: scale(1); opacity: 1; }
      }

      .stone-ghost { transition: background-color .15s, color .15s; }
      .stone-ghost:hover { background: var(--s-hover) !important; color: var(--s-text) !important; }
      .stone-btn:hover:not(:disabled) { opacity: .86; }
      .stone-card:not([aria-checked="true"]):hover { background: var(--s-hover) !important; border-color: var(--s-border-strong) !important; }
      .stone-stepper:hover:not(:disabled) { background: var(--s-hover); }

      @media (prefers-reduced-motion: reduce) {
        .stone-modal, .stone-modal * { animation-duration: 0.01ms !important; animation-delay: 0s !important; transition-duration: 0.01ms !important; }
      }
    `}</style>
  );
}

/* ============================================================================
   CONFETTIS (étape 2, comme sur la maquette — version monochrome)
============================================================================ */

const CONFETTI = [
  { left: "12%", delay: "0s", duration: "2.6s", size: 7 },
  { left: "22%", delay: "0.35s", duration: "3.1s", size: 5 },
  { left: "33%", delay: "0.15s", duration: "2.8s", size: 6 },
  { left: "44%", delay: "0.55s", duration: "3.4s", size: 5 },
  { left: "52%", delay: "0.1s", duration: "2.5s", size: 8 },
  { left: "63%", delay: "0.45s", duration: "3s", size: 5 },
  { left: "72%", delay: "0.25s", duration: "2.7s", size: 6 },
  { left: "82%", delay: "0.6s", duration: "3.3s", size: 5 },
  { left: "90%", delay: "0.2s", duration: "2.9s", size: 7 },
];

function Confetti({ p }: { p: Palette }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[90px] overflow-hidden" aria-hidden="true">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-[2px]"
          style={{
            left: c.left,
            width: c.size,
            height: c.size * 1.6,
            background: i % 3 === 0 ? p.text : p.accent,
            opacity: 0.9,
            animation: `stone-fall ${c.duration} ease-in ${c.delay} both`,
          }}
        />
      ))}
    </div>
  );
}

/* ============================================================================
   SHELL
============================================================================ */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Échap pour fermer, scroll verrouillé, focus piégé dans la modale puis restauré à la fermeture. */
function useModalBehavior(onClose: () => void, dialogRef: RefObject<HTMLDivElement | null>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!active || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [dialogRef]);
}

function StepDots({ current, total, p }: { current: number; total: number; p: Palette }) {
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={`Étape ${current} sur ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-[3px] rounded-full transition-all duration-300"
          style={{
            width: i + 1 === current ? 24 : 12,
            background: i + 1 <= current ? p.accent : p.border,
          }}
        />
      ))}
    </div>
  );
}

function ModalShell({
  p,
  onClose,
  labelledBy,
  step,
  children,
  footer,
  withConfetti,
}: {
  p: Palette;
  onClose: () => void;
  labelledBy: string;
  step: { current: number; total: number };
  children: ReactNode;
  footer: ReactNode;
  withConfetti?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const pressedOnBackdrop = useRef(false);
  useModalBehavior(onClose, dialogRef);

  const cssVars = {
    "--s-hover": p.surfaceHover,
    "--s-text": p.text,
    "--s-border-strong": p.borderStrong,
  } as CSSProperties;

  return (
    <div
      className="stone-modal fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{
        ...cssVars,
        background: p.overlay,
        backdropFilter: "blur(6px)",
        animation: "stone-fade 0.2s ease-out both",
      }}
      // On ferme seulement si le clic commence ET finit sur le fond
      // (évite de fermer en relâchant une sélection de texte hors de la modale).
      onMouseDown={(event) => {
        pressedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        if (pressedOnBackdrop.current && event.target === event.currentTarget) onClose();
        pressedOnBackdrop.current = false;
      }}
    >
      <Keyframes />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative flex min-h-[560px] w-full max-w-[920px] flex-col overflow-hidden rounded-[20px] border sm:min-h-[640px]"
        style={{
          background: p.bg,
          borderColor: p.border,
          color: p.text,
          maxHeight: "calc(100vh - 32px)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
          animation: "stone-pop 0.28s cubic-bezier(.2,.9,.25,1) both",
        }}
      >
        {withConfetti && <Confetti p={p} />}

        <div className="absolute left-6 top-7 z-10 sm:left-8">
          <StepDots current={step.current} total={step.total} p={p} />
        </div>

        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="stone-ghost absolute right-5 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2"
          style={{ color: p.muted, outlineColor: p.accent }}
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-8 pt-16 sm:px-14">
          <div className="flex w-full max-w-[680px] flex-col items-center">{children}</div>
        </div>

        <div
          className="relative flex min-h-[68px] shrink-0 flex-wrap items-center justify-between gap-3 border-t px-6 py-3 sm:px-8"
          style={{ borderColor: p.border }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}

function Avatar({ account, p }: { account: OnboardingAccount; p: Palette }) {
  const Icon = ICONS[account.key];
  const [failed, setFailed] = useState(false);
  const hasImage = Boolean(account.avatarUrl) && !failed;

  return (
    <div className="relative mb-7 h-[72px] w-[72px]" style={{ animation: "stone-rise 0.35s ease-out both" }}>
      {hasImage ? (
        <img
          src={account.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full rounded-full object-cover"
          style={{ boxShadow: `0 0 0 1px ${p.border}` }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full border"
          style={{ background: p.surface, borderColor: p.border }}
        >
          <Icon className="h-7 w-7" size={28} />
        </div>
      )}

      <span
        className="absolute -bottom-0.5 -right-0.5 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2"
        style={{
          background: p.accent,
          color: p.accentText,
          borderColor: p.bg,
          animation: "stone-check 0.3s cubic-bezier(.2,.9,.25,1) 0.25s both",
        }}
      >
        <CheckIcon className="h-3 w-3" />
      </span>
    </div>
  );
}

function PrimaryButton({
  p,
  onClick,
  loading,
  autoFocus,
  children,
}: {
  p: Palette;
  onClick: () => void;
  loading?: boolean;
  autoFocus?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      disabled={loading}
      aria-busy={loading || undefined}
      onClick={onClick}
      className="stone-btn inline-flex h-[40px] min-w-[132px] items-center justify-center gap-2 rounded-[10px] px-5 text-[13px] font-medium transition-all active:scale-[0.97] disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ background: p.accent, color: p.accentText, outlineColor: p.accent }}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

function GhostButton({
  p,
  onClick,
  disabled,
  children,
  ...aria
}: {
  p: Palette;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...aria}
      className="stone-ghost inline-flex h-[40px] items-center gap-2 rounded-[10px] px-3 text-[13px] font-medium focus-visible:outline focus-visible:outline-2 disabled:opacity-50"
      style={{ color: p.muted, outlineColor: p.accent }}
    >
      {children}
    </button>
  );
}

/** Bulle d'aide : se ferme au clic extérieur. */
function HelpPopover({
  p,
  label,
  title,
  children,
}: {
  p: Palette;
  label: string;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <GhostButton p={p} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup>
        <HelpIcon className="h-4 w-4" /> {label}
      </GhostButton>
      {open && (
        <div
          role="tooltip"
          className="absolute bottom-[calc(100%+10px)] left-0 w-[300px] rounded-xl border p-4 text-[12.5px] leading-relaxed shadow-xl"
          style={{
            background: p.bg,
            borderColor: p.border,
            color: p.muted,
            animation: "stone-rise 0.2s ease-out both",
          }}
        >
          <span className="font-semibold" style={{ color: p.text }}>
            {title}
          </span>{" "}
          {children}
        </div>
      )}
    </div>
  );
}

function Title({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="text-balance text-center text-[24px] font-semibold leading-tight tracking-[-0.02em]"
      style={{ animation: "stone-rise 0.35s ease-out 0.05s both" }}
    >
      {children}
    </h2>
  );
}

/* ============================================================================
   ÉTAPE 1 : "CONFIRM YOUR ACCOUNT"
============================================================================ */

export function ConfirmAccountModal({
  account,
  isDark,
  loading,
  onConfirm,
  onReject,
  onClose,
}: {
  account: OnboardingAccount;
  isDark: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onClose: () => void;
}) {
  const p = palette(isDark);

  return (
    <ModalShell
      p={p}
      onClose={onClose}
      labelledBy="stone-confirm-title"
      step={{ current: 1, total: 2 }}
      footer={
        <>
          <HelpPopover p={p} label="Need Help?" title="Besoin d'aide ?">
            Si ce compte n'est pas le tien, déconnecte-le depuis la page Canaux puis reconnecte le bon compte.
          </HelpPopover>

          <div className="ml-auto flex items-center gap-2">
            <GhostButton p={p} onClick={onReject} disabled={loading}>
              Not this account
            </GhostButton>
            <PrimaryButton p={p} onClick={onConfirm} loading={loading} autoFocus>
              Finish Connection <ArrowIcon className="h-4 w-4" />
            </PrimaryButton>
          </div>
        </>
      }
    >
      <Avatar account={account} p={p} />

      <Title id="stone-confirm-title">Confirm your Account</Title>
      <p
        className="mb-8 mt-3 max-w-[400px] text-center text-[14px] leading-relaxed"
        style={{ color: p.muted, animation: "stone-rise 0.35s ease-out 0.1s both" }}
      >
        Vérifie que c'est bien le {account.accountLabel.toLowerCase()} que tu veux relier à Stone.
      </p>

      <div
        className="flex w-full max-w-[480px] items-center gap-3 rounded-[14px] border px-5 py-4"
        style={{
          background: p.surface,
          borderColor: p.accent,
          animation: "stone-rise 0.35s ease-out 0.15s both",
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{account.handle || account.name}</p>
          <p className="mt-0.5 text-[12.5px]" style={{ color: p.muted }}>
            {account.accountLabel}
          </p>
        </div>
        <span
          className="flex h-[22px] w-[22px] items-center justify-center rounded-full"
          style={{ background: p.accent, color: p.accentText }}
        >
          <CheckIcon className="h-3 w-3" />
        </span>
      </div>
    </ModalShell>
  );
}

/* ============================================================================
   ÉTAPE 2 : FRÉQUENCE DE PUBLICATION
============================================================================ */

type FrequencyOption = {
  id: "1x" | "3x" | "5x" | "custom";
  title: string;
  cadence: string;
  hint: string;
  tile: ReactNode;
  badge?: string;
};

const OPTIONS: FrequencyOption[] = [
  { id: "1x", title: "Keep it steady", cadence: "1 time/week", hint: "Idéal pour démarrer", tile: "1x" },
  {
    id: "3x",
    title: "Build a presence",
    cadence: "3 times/week",
    hint: "Le bon équilibre",
    tile: "3x",
    badge: "Recommandé",
  },
  { id: "5x", title: "Reach new heights", cadence: "5 times/week", hint: "Croissance rapide", tile: "5x" },
  {
    id: "custom",
    title: "Choose your goal",
    cadence: "Ton propre rythme",
    hint: "De 1 à 21 par semaine",
    tile: <PencilIcon className="h-4 w-4" />,
  },
];

const MIN_PER_WEEK = 1;
const MAX_PER_WEEK = 21;

export function PostingFrequencyModal({
  account,
  isDark,
  onNext,
  onClose,
}: {
  account: OnboardingAccount;
  isDark: boolean;
  onNext: (postsPerWeek: number) => void;
  onClose: () => void;
}) {
  const p = palette(isDark);
  const [selected, setSelected] = useState<FrequencyOption["id"]>("3x");
  const [custom, setCustom] = useState(7);
  const [saving, setSaving] = useState(false);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const perWeek = selected === "custom" ? custom : parseInt(selected, 10);
  const perMonth = Math.round((perWeek * 52) / 12);

  // Le focus démarre sur l'option active : flèches + Entrée marchent tout de suite.
  useEffect(() => {
    const index = OPTIONS.findIndex((o) => o.id === "3x");
    optionRefs.current[index]?.focus();
  }, []);

  const submit = () => {
    if (saving) return;
    setSaving(true);
    window.setTimeout(() => onNext(perWeek), 250);
  };

  const move = (delta: number) => {
    const index = OPTIONS.findIndex((o) => o.id === selected);
    const nextIndex = (index + delta + OPTIONS.length) % OPTIONS.length;
    setSelected(OPTIONS[nextIndex].id);
    optionRefs.current[nextIndex]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  return (
    <ModalShell
      p={p}
      onClose={onClose}
      labelledBy="stone-frequency-title"
      step={{ current: 2, total: 2 }}
      withConfetti
      footer={
        <>
          <HelpPopover p={p} label="What's a Recommended Time?" title="Les horaires recommandés">
            sont les créneaux où ton audience est la plus active. Stone les place dans ta file d'attente selon
            ton objectif hebdomadaire.
          </HelpPopover>

          <div className="ml-auto flex items-center gap-4">
            <span
              className="hidden text-[12.5px] tabular-nums sm:inline"
              style={{ color: p.muted }}
              aria-live="polite"
            >
              {perWeek} / semaine · environ {perMonth} / mois
            </span>
            <PrimaryButton p={p} onClick={submit} loading={saving}>
              Next <ArrowIcon className="h-4 w-4" />
            </PrimaryButton>
          </div>
        </>
      }
    >
      <Avatar account={account} p={p} />

      <Title id="stone-frequency-title">How many times a week would you like to post?</Title>
      <p
        className="mb-8 mt-3 max-w-[420px] text-center text-[14px] leading-relaxed"
        style={{ color: p.muted, animation: "stone-rise 0.35s ease-out 0.1s both" }}
      >
        Tu pourras modifier cet objectif à tout moment.
      </p>

      <div
        role="radiogroup"
        aria-label="Posting frequency"
        onKeyDown={onKeyDown}
        className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2"
      >
        {OPTIONS.map((option, i) => {
          const active = selected === option.id;
          const cadence = option.id === "custom" && active ? `${custom} times/week` : option.cadence;

          return (
            <button
              key={option.id}
              ref={(node) => {
                optionRefs.current[i] = node;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setSelected(option.id)}
              onDoubleClick={submit}
              className="stone-card flex min-h-[76px] w-full items-center gap-3.5 rounded-[14px] border px-3.5 py-3 text-left transition-colors duration-150 active:scale-[0.995] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                background: active ? p.surface : "transparent",
                borderColor: active ? p.accent : p.border,
                boxShadow: active ? `0 0 0 1px ${p.accent}` : "none",
                outlineColor: p.accent,
                animation: `stone-rise 0.35s ease-out ${120 + i * 45}ms both`,
              }}
            >
              <span
                className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[10px] text-[15px] font-semibold transition-colors"
                style={{
                  background: active ? p.accent : p.surfaceHover,
                  color: active ? p.accentText : p.text,
                }}
              >
                {option.tile}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-semibold">{option.title}</span>
                  {option.badge && (
                    <span
                      className="shrink-0 rounded-full px-2 py-[2px] text-[10.5px] font-medium"
                      style={{ background: p.accent, color: p.accentText }}
                    >
                      {option.badge}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[12.5px]">{cadence}</span>
                <span className="block truncate text-[11.5px]" style={{ color: p.muted }}>
                  {option.hint}
                </span>
              </span>

              <span
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors"
                style={{ borderColor: active ? p.accent : p.muted }}
              >
                <span
                  className="h-[9px] w-[9px] rounded-full transition-transform duration-200"
                  style={{ background: p.accent, transform: active ? "scale(1)" : "scale(0)" }}
                />
              </span>
            </button>
          );
        })}
      </div>

      {selected === "custom" && (
        <div
          className="mt-3 flex w-full items-center justify-between rounded-[14px] border px-5 py-3"
          style={{ background: p.surface, borderColor: p.border, animation: "stone-rise 0.25s ease-out both" }}
        >
          <span className="text-[13.5px] font-medium">Publications par semaine</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Diminuer"
              disabled={custom <= MIN_PER_WEEK}
              onClick={() => setCustom((n) => Math.max(MIN_PER_WEEK, n - 1))}
              className="stone-stepper flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-30 focus-visible:outline focus-visible:outline-2"
              style={{ borderColor: p.border, outlineColor: p.accent }}
            >
              <MinusIcon className="h-3.5 w-3.5" />
            </button>
            <span
              className="w-8 text-center text-[16px] font-semibold tabular-nums"
              role="status"
              aria-label={`${custom} publications par semaine`}
            >
              {custom}
            </span>
            <button
              type="button"
              aria-label="Augmenter"
              disabled={custom >= MAX_PER_WEEK}
              onClick={() => setCustom((n) => Math.min(MAX_PER_WEEK, n + 1))}
              className="stone-stepper flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-30 focus-visible:outline focus-visible:outline-2"
              style={{ borderColor: p.border, outlineColor: p.accent }}
            >
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

/* ============================================================================
   À MONTER SUR LA PAGE /insights
============================================================================ */

/**
 * Affiche la popup "objectif de publication" PAR-DESSUS la page courante, via
 * un root React indépendant. Elle survit donc au changement de route
 * (Channels -> /insights) sans rien ajouter dans la page Insights.
 */
export function openFrequencyOnboarding(account: OnboardingAccount, isDark: boolean) {
  document.querySelectorAll("[data-stone-onboarding]").forEach((node) => node.remove());

  const host = document.createElement("div");
  host.setAttribute("data-stone-onboarding", "");
  document.body.appendChild(host);

  const root = createRoot(host);
  const close = () => {
    window.setTimeout(() => {
      root.unmount();
      host.remove();
    }, 0);
  };

  root.render(
    <PostingFrequencyModal
      account={account}
      isDark={isDark}
      onClose={close}
      onNext={(postsPerWeek) => {
        saveGoal(account.key, postsPerWeek);
        close();
      }}
    />
  );
}

/** Optionnel : à monter sur la page Insights si tu préfères la méthode par sessionStorage. */
export default function FrequencyOnboarding() {
  const { theme } = useTheme();
  const [account, setAccount] = useState<OnboardingAccount | null>(() => readQueued());

  if (!account) return null;

  const dismiss = () => {
    clearQueued();
    setAccount(null);
  };

  return (
    <PostingFrequencyModal
      account={account}
      isDark={theme === "dark"}
      onClose={dismiss}
      onNext={(postsPerWeek) => {
        saveGoal(account.key, postsPerWeek);
        dismiss();
      }}
    />
  );
}