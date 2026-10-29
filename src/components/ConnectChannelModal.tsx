// src/components/ConnectChannelModal.tsx
import { useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import type {
  Channel,
  ChannelKey,
  ConnectionState,
} from "../pages/channels";

/* ============================================================================
   Icônes locales au modal (pour ne pas dépendre de Channels.tsx à l'exécution)
============================================================================ */

type IconProps = { className?: string };

function Svg({
  className = "h-4 w-4",
  children,
}: IconProps & { children: ReactNode }) {
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

function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

/* ============================================================================
   ConnectChannelModal
   Rendu dans document.body via un portail : aucun parent (sidebar, overflow,
   transform, pointer-events...) ne peut intercepter les clics.
============================================================================ */

export type ConnectChannelModalProps = {
  channels: Channel[];
  connections: ConnectionState;
  pendingKey: ChannelKey | null;
  limitReached: boolean;
  planName: string;
  realOAuthKeys: ChannelKey[];
  errorMessage: string | null;
  isDark: boolean;
  onToggle: (key: ChannelKey) => void;
  onClose: () => void;
};

export default function ConnectChannelModal({
  channels,
  connections,
  pendingKey,
  limitReached,
  planName,
  realOAuthKeys,
  errorMessage,
  isDark,
  onToggle,
  onClose,
}: ConnectChannelModalProps) {
  // Fermeture au clavier (Escape)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const cardBase = [
    "flex min-h-[148px] flex-col items-center justify-center gap-0.5",
    "rounded-2xl border px-3 py-5 text-center",
    "transition-colors duration-150",
    isDark
      ? "border-white/10 bg-transparent"
      : "border-black/10 bg-transparent",
  ].join(" ");

  const cardHover = isDark
    ? "hover:bg-white/[0.04]"
    : "hover:bg-black/[0.03]";

  const subtitleColor = isDark ? "text-white/55" : "text-black/50";

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      className={[
        "fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8",
        "backdrop-blur-sm",
        isDark ? "bg-black/70" : "bg-black/40",
      ].join(" ")}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connect a New Channel"
        onClick={(event) => event.stopPropagation()}
        className={[
          "flex max-h-[560px] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border",
          isDark
            ? "border-white/10 bg-[#1f2020] text-[#f3f3ef] shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
            : "border-black/10 bg-white text-[#151515] shadow-[0_24px_60px_rgba(0,0,0,0.18)]",
        ].join(" ")}
      >
        {/* Header (sans barre de séparation) */}
        <div className="relative flex shrink-0 items-center justify-center px-14 py-4">
          <h2 className="text-[17px] font-medium">Connect a New Channel</h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={[
              "absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2",
              "items-center justify-center rounded-xl border",
              "transition-colors duration-150",
              isDark
                ? "border-white/15 text-white/80 hover:bg-white/10"
                : "border-black/15 text-black/60 hover:bg-black/[0.05]",
            ].join(" ")}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {errorMessage && (
            <p
              role="alert"
              className={[
                "mx-auto mb-5 max-w-[600px] rounded-lg border px-3 py-2 text-[13px]",
                isDark
                  ? "border-red-400/30 bg-red-500/10 text-red-300"
                  : "border-red-300 bg-red-50 text-red-700",
              ].join(" ")}
            >
              {errorMessage}
            </p>
          )}

          {limitReached && (
            <p
              className={[
                "mx-auto mb-5 max-w-[600px] text-center text-[13px]",
                subtitleColor,
              ].join(" ")}
            >
              You've reached the channel limit of your {planName} plan.
              Upgrade to connect more.
            </p>
          )}

          <div className="mx-auto grid max-w-[600px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {channels.map((channel) => {
              const connected = connections[channel.key].connected;
              const isPending = pendingKey === channel.key;
              // Un canal déjà connecté peut toujours être reconnecté
              const blocked = limitReached && !connected;
              const Icon = channel.icon;

              return (
                <button
                  key={channel.key}
                  type="button"
                  disabled={isPending || blocked}
                  onClick={() => onToggle(channel.key)}
                  className={[
                    cardBase,
                    blocked ? "" : cardHover,
                    "disabled:cursor-default",
                    isPending || blocked ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <span className="mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-white">
                    <Icon className="h-7 w-7" size={28} />
                  </span>

                  <span className="text-[16px] font-semibold leading-tight">
                    {channel.name}
                  </span>

                  <span
                    className={[
                      "text-[13px] leading-snug",
                      subtitleColor,
                    ].join(" ")}
                  >
                    {isPending
                      ? realOAuthKeys.includes(channel.key)
                        ? "Redirecting..."
                        : "Connecting..."
                      : channel.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}