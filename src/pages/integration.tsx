import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../hooks/useTheme";
import DashboardSidebar, {
  useSidebarOffset,
  useFavorites,
} from "../components/DashboardSidebar";
import BottomBar, { type BottomBarTab } from "../components/Bottombar";
import Folder from "../components/Folder";
import NewPostModal, {
  type NewPostPayload,
  unavailablePostActionMessage,
} from "../components/Newpostmodal";
import HelpChatButton from "../components/Helpchatbutton";
import { createPosts } from "../services/posts";
import {
  ZapierIcon,
  ClaudeIcon,
  ChatGPTIcon,
  NotionIcon,
  GoogleIcon,
  N8nIcon,
  RaycastIcon,
  DropboxIcon,
  GoogleDriveIcon,
  GmailIcon,
  GoogleCalendarIcon,
  CanvaIcon,
} from "../components/IntegrationIcons";
import {
  getCanvaAuthUrl,
  getCanvaStatus,
  openCanvaPopup,
  waitForCanvaConnection,
  disconnectCanva,
} from "../services/canva";
import {
  getDropboxAuthUrl,
  getDropboxStatus,
  disconnectDropbox,
} from "../services/dropbox";
import {
  getGoogleDriveAuthUrl,
  getGoogleDriveStatus,
  disconnectGoogleDrive,
} from "../services/googledrive";
import {
  getGooglePhotosAuthUrl,
  getGooglePhotosStatus,
  disconnectGooglePhotos,
} from "../services/googlephotos";

/** Route de cette page dans la sidebar (section Favorite). */
const PAGE_ROUTE = "integrations";

/* ============================================================
   MOBILE
============================================================ */
const MOBILE_QUERY = "(max-width: 767px)";

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia(MOBILE_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

/* ============================================================
   BOTTOM SHEET (mobile) — feuille glissable, comme sur Home
============================================================ */
function useEscape(onEscape: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onEscape]);
}

function BottomSheet({
  isDark,
  title,
  onClose,
  children,
}: {
  isDark: boolean;
  title: string;
  onClose: () => void;
  children: (close: () => void) => React.ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startT: number } | null>(null);

  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(true))
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setDragging(false);
    window.setTimeout(onClose, 300);
  }, [closing, onClose]);

  useEscape(requestClose);

  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (closing) return;
    drag.current = { startY: e.clientY, startT: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setDragY(Math.max(0, e.clientY - d.startY));
  };

  const onDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);

    const dy = Math.max(0, e.clientY - d.startY);
    const velocity = dy / Math.max(1, performance.now() - d.startT);
    const height = sheetRef.current?.offsetHeight ?? 500;

    if (dy > height * 0.25 || velocity > 0.5) requestClose();
    else setDragY(0);
  };

  const hidden = closing || !shown;
  const height = sheetRef.current?.offsetHeight ?? 600;
  const backdropOpacity = hidden ? 0 : 1 - Math.min(1, dragY / height);
  const ease = "cubic-bezier(0.32, 0.72, 0, 1)";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        style={{
          opacity: backdropOpacity,
          transition: dragging ? "none" : `opacity 300ms ${ease}`,
        }}
        onClick={requestClose}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          transform: hidden ? "translateY(100%)" : `translateY(${dragY}px)`,
          transition: dragging ? "none" : `transform 300ms ${ease}`,
          willChange: "transform",
        }}
        className={[
          "relative z-10 flex max-h-[92dvh] w-full flex-col overflow-y-auto overscroll-contain border p-4 shadow-2xl",
          "rounded-t-3xl pb-[calc(1rem+env(safe-area-inset-bottom))]",
          isDark
            ? "border-white/[0.08] bg-[#101012]"
            : "border-black/[0.06] bg-[#f6f4f0]",
        ].join(" ")}
      >
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          className="-mx-4 -mt-4 mb-1 shrink-0 cursor-grab touch-none select-none px-4 pb-3 pt-3 active:cursor-grabbing"
        >
          <div
            className={[
              "mx-auto mb-3 h-1.5 w-12 rounded-full",
              isDark ? "bg-white/25" : "bg-black/15",
            ].join(" ")}
          />
          <h2
            className={[
              "truncate text-center text-[17px] font-semibold tracking-[-0.02em]",
              isDark ? "text-white" : "text-neutral-900",
            ].join(" ")}
          >
            {title}
          </h2>
        </div>

        {children(requestClose)}
      </div>
    </div>,
    document.body
  );
}

/* ============================================================
   SHELL (aligné sur Home)
============================================================ */

const pageBgClass = (isDark: boolean) =>
  isDark ? "bg-[#09090a]" : "bg-[#f5f3ef]";

const mainPanelClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#0f0f11]"
    : "border-black/[0.06] bg-white";

const cardClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-[#141416]"
    : "border-black/[0.06] bg-white";

const panelSurfaceClass = (isDark: boolean) =>
  isDark
    ? "border-white/[0.07] bg-white/[0.03]"
    : "border-black/[0.06] bg-[#f6f4f0]";

const mutedClass = (isDark: boolean) =>
  isDark ? "text-neutral-500" : "text-neutral-400";

const strongClass = (isDark: boolean) =>
  isDark ? "text-white" : "text-neutral-900";

const focusRingClass = (isDark: boolean) =>
  isDark
    ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25";

/* ============================================================
   ICONS
============================================================ */

function PlugIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[17px] w-[17px] sm:h-4 sm:w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 3v4M15 3v4" />
      <path d="M6.5 7h11v4.5a5.5 5.5 0 0 1-11 0V7Z" />
      <path d="M12 17v4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[16px] w-[16px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[14px] w-[14px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-[12px] w-[12px]"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m4 12 6 6L20 6" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px] sm:h-[14px] sm:w-[14px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function BookmarkIcon({
  className,
  filled = false,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-4 w-4"}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.8L6 20V5.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 sm:h-4 sm:w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21v-5h5" />
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
    </svg>
  );
}

function GooglePhotosIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M12 2a5 5 0 0 1 5 5v5h-5V2Z" />
      <path fill="#4285F4" d="M22 12a5 5 0 0 1-5 5h-5v-5h10Z" />
      <path fill="#34A853" d="M12 22a5 5 0 0 1-5-5v-5h5v10Z" />
      <path fill="#FBBC04" d="M2 12a5 5 0 0 1 5-5h5v5H2Z" />
    </svg>
  );
}

/* ============================================================
   DATA
============================================================ */

type IntegrationCardData = {
  title: string;
  meta?: string;
  body: string;
  progress: number;
};

const INTEGRATIONS: IntegrationCardData[] = [
  { title: "Zapier", meta: "Automatisation", body: "Automate workflows with Zapier", progress: 70 },
  { title: "Claude", meta: "IA", body: "Manage your content from Claude and Claude Code", progress: 85 },
  { title: "ChatGPT", meta: "IA", body: "Manage your content from ChatGPT and Codex", progress: 75 },
  { title: "Notion", meta: "Documentation", body: "Manage your content from Notion custom agents", progress: 60 },
  { title: "Google", meta: "Productivité", body: "Connect Google services and tools", progress: 65 },
  { title: "n8n", meta: "Automatisation", body: "Workflow automation with n8n", progress: 60 },
  { title: "Raycast", meta: "Productivité", body: "Quick actions from your menu bar", progress: 70 },
  { title: "Dropbox", meta: "Stockage", body: "Connect and manage files from your Dropbox account", progress: 50 },
  { title: "Canva", meta: "Design", body: "Create and manage your designs from Canva", progress: 55 },
  { title: "Google Drive", meta: "Stockage", body: "Sync and manage your files from Google Drive", progress: 75 },
  { title: "Google Photos", meta: "Photos", body: "Import photos and videos from Google Photos", progress: 55 },
  { title: "Gmail", meta: "Email", body: "Manage your emails and automate responses", progress: 80 },
  { title: "Google Calendar", meta: "Planning", body: "Sync your calendar and automate scheduling", progress: 65 },
];

const ICONS: Record<string, (props: { className?: string }) => ReactElement | null> = {
  Zapier: ZapierIcon,
  Claude: ClaudeIcon,
  ChatGPT: ChatGPTIcon,
  Notion: NotionIcon,
  Google: GoogleIcon,
  n8n: N8nIcon,
  Raycast: RaycastIcon,
  Dropbox: DropboxIcon,
  Canva: CanvaIcon,
  "Google Drive": GoogleDriveIcon,
  "Google Photos": GooglePhotosIcon,
  Gmail: GmailIcon,
  "Google Calendar": GoogleCalendarIcon,
};

const FILTERS = ["Toutes", "Connectées", "Disponibles"] as const;
type Filter = (typeof FILTERS)[number];

const CONNECTED_THRESHOLD = 60;

/* ============================================================
   CARD
============================================================ */

type ServiceConnection = {
  connected: boolean;
  busy: boolean;
  error: string | null;
  onConnect: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
};

function IntegrationCard({
  data,
  isDark,
  service,
}: {
  data: IntegrationCardData;
  isDark: boolean;
  service?: ServiceConnection;
}) {
  const Icon = ICONS[data.title];
  const isMobile = useIsMobile();

  // Desktop : menu "trois points" en dropdown ancré à la carte.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Mobile : les options passent en feuille glissable (comme Home).
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen || isMobile) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, isMobile]);

  return (
    <div
      className={[
        "group flex h-full flex-col rounded-2xl border p-4 transition sm:p-3.5",
        cardClass(isDark),
        focusRingClass(isDark),
        isDark
          ? "hover:bg-[#19191c] hover:border-white/[0.12]"
          : "hover:bg-[#f6f4f0] hover:border-black/[0.12]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <div
              className={[
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border sm:h-10 sm:w-10 sm:rounded-xl",
                isDark
                  ? "border-white/[0.08] bg-white/[0.04] text-neutral-300"
                  : "border-black/[0.06] bg-[#f6f4f0] text-neutral-600",
              ].join(" ")}
            >
              <Icon className="h-[21px] w-[21px] sm:h-[19px] sm:w-[19px]" />
            </div>
          )}
          <h3
            className={[
              "truncate text-[15px] font-semibold tracking-[-0.01em] sm:text-[13.5px]",
              strongClass(isDark),
            ].join(" ")}
          >
            {data.title}
          </h3>
        </div>

        {service?.connected ? (
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              aria-label={`Options pour ${data.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen || sheetOpen}
              onClick={() => (isMobile ? setSheetOpen(true) : setMenuOpen((v) => !v))}
              className={[
                "flex h-10 w-10 items-center justify-center rounded-lg transition-colors sm:h-8 sm:w-8",
                focusRingClass(isDark),
                mutedClass(isDark),
                isDark
                  ? "hover:bg-white/[0.06] hover:text-white"
                  : "hover:bg-black/[0.05] hover:text-neutral-900",
              ].join(" ")}
            >
              <MoreIcon />
            </button>

            {/* Desktop : dropdown */}
            {menuOpen && !isMobile && (
              <div
                role="menu"
                className={[
                  "absolute right-0 top-10 z-50 w-44 max-w-[calc(100vw-32px)] rounded-xl border p-1 shadow-xl",
                  isDark
                    ? "border-white/[0.08] bg-[#16161a]"
                    : "border-black/[0.06] bg-white",
                ].join(" ")}
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={service.busy}
                  onClick={() => {
                    setMenuOpen(false);
                    service.onReconnect();
                  }}
                  className={[
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] font-medium disabled:opacity-40",
                    isDark
                      ? "text-neutral-200 hover:bg-white/[0.06] hover:text-white"
                      : "text-neutral-700 hover:bg-black/[0.04] hover:text-neutral-900",
                  ].join(" ")}
                >
                  <RefreshIcon />
                  Reconnect
                </button>

                <div
                  className={[
                    "my-1 h-px",
                    isDark ? "bg-white/[0.06]" : "bg-black/[0.06]",
                  ].join(" ")}
                />

                <button
                  type="button"
                  role="menuitem"
                  disabled={service.busy}
                  onClick={() => {
                    setMenuOpen(false);
                    service.onDisconnect();
                  }}
                  className={[
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] font-medium disabled:opacity-40",
                    isDark
                      ? "text-rose-400 hover:bg-rose-500/[0.07]"
                      : "text-rose-600 hover:bg-rose-500/[0.07]",
                  ].join(" ")}
                >
                  <DisconnectIcon />
                  Disconnect
                </button>
              </div>
            )}

            {/* Mobile : feuille glissable */}
            {sheetOpen && isMobile && service && (
              <BottomSheet
                isDark={isDark}
                title={data.title}
                onClose={() => setSheetOpen(false)}
              >
                {(close) => (
                  <div role="menu" className="flex flex-col gap-1 pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={service.busy}
                      onClick={() => {
                        close();
                        service.onReconnect();
                      }}
                      className={[
                        "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-semibold transition disabled:opacity-40",
                        focusRingClass(isDark),
                        isDark
                          ? "text-neutral-200 active:bg-white/[0.06]"
                          : "text-neutral-700 active:bg-black/[0.04]",
                      ].join(" ")}
                    >
                      <RefreshIcon />
                      Reconnect
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={service.busy}
                      onClick={() => {
                        close();
                        service.onDisconnect();
                      }}
                      className={[
                        "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-semibold transition disabled:opacity-40",
                        focusRingClass(isDark),
                        isDark
                          ? "text-rose-400 active:bg-rose-500/[0.07]"
                          : "text-rose-600 active:bg-rose-500/[0.07]",
                      ].join(" ")}
                    >
                      <DisconnectIcon />
                      Disconnect
                    </button>
                  </div>
                )}
              </BottomSheet>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={service?.onConnect}
            disabled={service?.busy}
            aria-busy={service?.busy}
            aria-label={
              service ? `Connecter ${data.title}` : `Configurer ${data.title}`
            }
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:cursor-default sm:h-7 sm:w-7",
              service?.busy ? "animate-pulse opacity-60" : "",
              focusRingClass(isDark),
              isDark
                ? "text-neutral-400 hover:bg-white/10 hover:text-white"
                : "text-neutral-400 hover:bg-black/5 hover:text-neutral-900",
            ].join(" ")}
          >
            <ArrowRightIcon />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-start gap-2">
        {data.meta && (
          <span
            className={[
              "shrink-0 text-[11px] font-medium tracking-wide sm:text-[10.5px]",
              isDark ? "text-neutral-500" : "text-neutral-400",
            ].join(" ")}
          >
            {data.meta}
          </span>
        )}
        <p
          className={[
            "text-[12.5px] leading-[1.45] sm:text-[12px]",
            isDark ? "text-neutral-400" : "text-neutral-600",
          ].join(" ")}
        >
          {data.body}
        </p>
      </div>

      {service?.error && (
        <p role="alert" className="mt-3 text-[11px] leading-relaxed text-red-400">
          {service.error}
        </p>
      )}
    </div>
  );
}

/* ============================================================
   PAGE
============================================================ */

export default function Integrations() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const sidebarOffset = useSidebarOffset();
  const isMobile = useIsMobile();

  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const saved = isFavorite(PAGE_ROUTE);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("Toutes");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);

  const [canvaConnected, setCanvaConnected] = useState(false);
  const [canvaBusy, setCanvaBusy] = useState(false);
  const [canvaError, setCanvaError] = useState<string | null>(null);

  const [dropboxConnected, setDropboxConnected] = useState(false);
  const [dropboxBusy, setDropboxBusy] = useState(false);
  const [dropboxError, setDropboxError] = useState<string | null>(null);

  const [gdriveConnected, setGdriveConnected] = useState(false);
  const [gdriveBusy, setGdriveBusy] = useState(false);
  const [gdriveError, setGdriveError] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("gdrive_error")
  );

  const [gphotosConnected, setGphotosConnected] = useState(false);
  const [gphotosBusy, setGphotosBusy] = useState(false);
  const [gphotosError, setGphotosError] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("gphotos_error")
  );

  useEffect(() => {
    let active = true;

    getCanvaStatus()
      .then((status) => {
        if (!active) return;
        setCanvaConnected(status.connected);
      })
      .catch((error: unknown) => {
        if (active) {
          setCanvaError(
            error instanceof Error
              ? error.message
              : "Impossible de vérifier la connexion Canva."
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    getDropboxStatus()
      .then((status) => {
        if (!active) return;
        setDropboxConnected(status.connected);
      })
      .catch((error: unknown) => {
        if (active) {
          setDropboxError(
            error instanceof Error
              ? error.message
              : "Impossible de vérifier la connexion Dropbox."
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    getGoogleDriveStatus()
      .then((status) => {
        if (active) setGdriveConnected(status.connected);
      })
      .catch((error: unknown) => {
        if (active) {
          setGdriveError(
            error instanceof Error
              ? error.message
              : "Impossible de vérifier la connexion Google Drive."
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    getGooglePhotosStatus()
      .then((status) => {
        if (active) setGphotosConnected(status.connected);
      })
      .catch((error: unknown) => {
        if (active) {
          setGphotosError(
            error instanceof Error
              ? error.message
              : "Impossible de vérifier la connexion Google Photos."
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Fermeture du dropdown de filtre (clic extérieur / Escape).
  useEffect(() => {
    if (!filterOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!filterRef.current?.contains(e.target as Node)) setFilterOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filterOpen]);

  const needle = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      INTEGRATIONS.filter((item) => {
        const matchesQuery =
          needle.length === 0 ||
          `${item.title} ${item.meta ?? ""}`.toLowerCase().includes(needle);

        let isConnected: boolean;
        if (item.title === "Canva") isConnected = canvaConnected;
        else if (item.title === "Dropbox") isConnected = dropboxConnected;
        else if (item.title === "Google Drive") isConnected = gdriveConnected;
        else if (item.title === "Google Photos") isConnected = gphotosConnected;
        else isConnected = item.progress >= CONNECTED_THRESHOLD;

        const matchesFilter =
          filter === "Toutes" ||
          (filter === "Connectées" ? isConnected : !isConnected);

        return matchesQuery && matchesFilter;
      }),
    [
      needle,
      filter,
      canvaConnected,
      dropboxConnected,
      gdriveConnected,
      gphotosConnected,
    ]
  );

  const hasActiveFilters = needle.length > 0 || filter !== "Toutes";

  const resetFilters = () => {
    setQuery("");
    setFilter("Toutes");
  };

  const handleBottomBarChange = (id: BottomBarTab) => {
    switch (id) {
      case "add":
        setIsFolderOpen(false);
        setIsNewPostOpen(true);
        break;
      case "files":
        setIsFolderOpen((open) => !open);
        break;
    }
  };

  const handleCreatePost = async (payload: NewPostPayload) => {
    if (payload.scheduleMode === "later") {
      await createPosts(payload);
      return;
    }

    throw new Error(unavailablePostActionMessage(payload));
  };

  const handleCanvaConnect = async () => {
    if (canvaBusy || canvaConnected) return;

    const popup = openCanvaPopup();
    if (!popup) {
      setCanvaError(
        "Autorisez les fenêtres pop-up pour ce site, puis réessayez."
      );
      return;
    }

    setCanvaError(null);
    setCanvaBusy(true);

    try {
      popup.document.body.innerText = "Opening Canva…";
      popup.location.href = await getCanvaAuthUrl();

      const connected = await waitForCanvaConnection(popup);
      if (!connected) {
        throw new Error("La connexion Canva n’a pas été terminée.");
      }

      setCanvaConnected(true);
      popup.close();
    } catch (error) {
      popup.close();
      setCanvaError(
        error instanceof Error
          ? error.message
          : "Impossible de connecter Canva. Réessayez."
      );
    } finally {
      setCanvaBusy(false);
    }
  };

  const handleCanvaReconnect = async () => {
    if (canvaBusy) return;

    setCanvaError(null);
    setCanvaBusy(true);
    let redirecting = false;

    try {
      await disconnectCanva();
      setCanvaConnected(false);

      const url = await getCanvaAuthUrl();
      redirecting = true;
      window.location.assign(url);
    } catch (error) {
      setCanvaError(
        error instanceof Error
          ? error.message
          : "Impossible de reconnecter Canva. Réessayez."
      );
    } finally {
      if (!redirecting) setCanvaBusy(false);
    }
  };

  const handleCanvaDisconnect = async () => {
    if (canvaBusy) return;

    setCanvaError(null);
    setCanvaBusy(true);

    try {
      await disconnectCanva();
      setCanvaConnected(false);
    } catch (error) {
      setCanvaError(
        error instanceof Error
          ? error.message
          : "Impossible de déconnecter Canva. Réessayez."
      );
    } finally {
      setCanvaBusy(false);
    }
  };

  const handleDropboxDisconnect = async () => {
    if (dropboxBusy) return;

    setDropboxError(null);
    setDropboxBusy(true);

    try {
      await disconnectDropbox();
      setDropboxConnected(false);
    } catch (error) {
      setDropboxError(
        error instanceof Error
          ? error.message
          : "Impossible de déconnecter Dropbox. Réessayez."
      );
    } finally {
      setDropboxBusy(false);
    }
  };

  const handleDropboxConnect = async (reconnect = false) => {
    if (dropboxBusy || (dropboxConnected && !reconnect)) return;

    setDropboxError(null);
    setDropboxBusy(true);

    try {
      const { url } = await getDropboxAuthUrl();
      const authUrl = new URL(url);
      const hostname = authUrl.hostname.toLowerCase();
      if (
        authUrl.protocol !== "https:" ||
        (hostname !== "dropbox.com" && !hostname.endsWith(".dropbox.com"))
      ) {
        throw new Error("Le backend a renvoyé une URL Dropbox invalide.");
      }

      if (reconnect) {
        authUrl.searchParams.set("force_reapprove", "true");
        authUrl.searchParams.set("force_reauthentication", "false");
      }

      window.location.assign(authUrl.toString());
    } catch (error) {
      setDropboxError(
        error instanceof Error
          ? error.message
          : "Impossible de démarrer la connexion Dropbox. Réessayez."
      );
      setDropboxBusy(false);
    }
  };

  const handleGDriveDisconnect = async () => {
    if (gdriveBusy) return;

    setGdriveError(null);
    setGdriveBusy(true);

    try {
      await disconnectGoogleDrive();
      setGdriveConnected(false);
    } catch (error) {
      setGdriveError(
        error instanceof Error
          ? error.message
          : "Impossible de déconnecter Google Drive. Réessayez."
      );
    } finally {
      setGdriveBusy(false);
    }
  };

  const handleGDriveConnect = async () => {
    if (gdriveBusy) return;

    setGdriveError(null);
    setGdriveBusy(true);

    try {
      const { url } = await getGoogleDriveAuthUrl();
      const authUrl = new URL(url);

      if (
        authUrl.protocol !== "https:" ||
        authUrl.hostname.toLowerCase() !== "accounts.google.com"
      ) {
        throw new Error("Le backend a renvoyé une URL Google invalide.");
      }

      window.location.assign(authUrl.toString());
    } catch (error) {
      setGdriveError(
        error instanceof Error
          ? error.message
          : "Impossible de démarrer la connexion Google Drive. Réessayez."
      );
      setGdriveBusy(false);
    }
  };

  const handleGPhotosDisconnect = async () => {
    if (gphotosBusy) return;

    setGphotosError(null);
    setGphotosBusy(true);

    try {
      await disconnectGooglePhotos();
      setGphotosConnected(false);
    } catch (error) {
      setGphotosError(
        error instanceof Error
          ? error.message
          : "Impossible de déconnecter Google Photos. Réessayez."
      );
    } finally {
      setGphotosBusy(false);
    }
  };

  const handleGPhotosConnect = async () => {
    if (gphotosBusy) return;

    setGphotosError(null);
    setGphotosBusy(true);

    try {
      const { url } = await getGooglePhotosAuthUrl();
      const authUrl = new URL(url);

      if (
        authUrl.protocol !== "https:" ||
        authUrl.hostname.toLowerCase() !== "accounts.google.com"
      ) {
        throw new Error("Le backend a renvoyé une URL Google invalide.");
      }

      window.location.assign(authUrl.toString());
    } catch (error) {
      setGphotosError(
        error instanceof Error
          ? error.message
          : "Impossible de démarrer la connexion Google Photos. Réessayez."
      );
      setGphotosBusy(false);
    }
  };

  const services: Record<string, ServiceConnection> = {
    Canva: {
      connected: canvaConnected,
      busy: canvaBusy,
      error: canvaError,
      onConnect: () => handleCanvaConnect(),
      onReconnect: handleCanvaReconnect,
      onDisconnect: handleCanvaDisconnect,
    },
    Dropbox: {
      connected: dropboxConnected,
      busy: dropboxBusy,
      error: dropboxError,
      onConnect: () => handleDropboxConnect(),
      onReconnect: () => handleDropboxConnect(true),
      onDisconnect: handleDropboxDisconnect,
    },
    "Google Drive": {
      connected: gdriveConnected,
      busy: gdriveBusy,
      error: gdriveError,
      onConnect: handleGDriveConnect,
      onReconnect: handleGDriveConnect,
      onDisconnect: handleGDriveDisconnect,
    },
    "Google Photos": {
      connected: gphotosConnected,
      busy: gphotosBusy,
      error: gphotosError,
      onConnect: handleGPhotosConnect,
      onReconnect: handleGPhotosConnect,
      onDisconnect: handleGPhotosDisconnect,
    },
  };

  return (
    <main
      className={[
        "relative h-dvh min-h-dvh w-full overflow-hidden overscroll-none",
        "transition-colors duration-300",
        pageBgClass(isDark),
      ].join(" ")}
    >
      <DashboardSidebar theme={theme} />

      {/* Mobile : la sidebar est un tiroir → aucun décalage à gauche. */}
      <div
        className={[
          "h-full min-h-0 px-2 py-2 md:py-3 md:pl-0 md:pr-3",
          "max-md:pt-[calc(3.5rem+env(safe-area-inset-top))]",
          "transition-[padding-left] duration-[380ms]",
          "ease-[cubic-bezier(0.4,0,0.2,1)]",
          "motion-reduce:transition-none",
        ].join(" ")}
        style={isMobile ? undefined : { paddingLeft: sidebarOffset }}
      >
        {/* PANNEAU ARRONDI : c'est lui qui scrolle */}
        <div
          className={[
            "h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain",
            "rounded-2xl border md:rounded-[28px]",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "transition-colors duration-300",
            mainPanelClass(isDark),
          ].join(" ")}
        >
          <div
            className={[
              "mx-auto flex w-full min-w-0 max-w-[1720px]",
              "flex-col px-[clamp(14px,3vw,48px)]",
              "pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[clamp(16px,3vw,30px)]",
            ].join(" ")}
          >
            {/* HEADER — compact sur mobile, ligne unique */}
            <header className="flex min-w-0 shrink-0 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-2.5">
                <span
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:h-9 sm:w-9",
                    isDark
                      ? "border-white/[0.07] bg-white/[0.04] text-neutral-400"
                      : "border-black/[0.06] bg-white text-neutral-500",
                  ].join(" ")}
                >
                  <PlugIcon />
                </span>
                <div className="min-w-0">
                  <h1
                    className={[
                      "truncate text-[19px] font-semibold tracking-[-0.03em] sm:text-[16px]",
                      strongClass(isDark),
                    ].join(" ")}
                  >
                    Integrations
                  </h1>
                  <p
                    className={[
                      "mt-0.5 truncate text-[12px] sm:text-[11px]",
                      mutedClass(isDark),
                    ].join(" ")}
                  >
                    Connect your favorite tools and services.
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label={saved ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={saved}
                title={saved ? "Remove from favorites" : "Add to favorites"}
                onClick={() => toggleFavorite(PAGE_ROUTE)}
                className={[
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors motion-reduce:transition-none sm:h-9 sm:w-9",
                  focusRingClass(isDark),
                  mutedClass(isDark),
                  isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]",
                ].join(" ")}
              >
                <BookmarkIcon className="h-5 w-5" filled={saved} />
              </button>
            </header>

            {/* SEARCH + FILTER — pleine largeur sur mobile */}
            <div className="mt-5 flex flex-wrap items-center gap-2 sm:mt-6">
              <label
                className={[
                  "flex min-w-0 w-full items-center gap-2.5 rounded-full border px-3.5 py-2.5 transition sm:w-auto sm:flex-1 sm:py-2 sm:max-w-[360px]",
                  "focus-within:ring-2",
                  isDark
                    ? "border-white/[0.08] bg-white/[0.03] text-neutral-500 focus-within:ring-white/20"
                    : "border-black/[0.06] bg-white text-neutral-400 focus-within:ring-black/15",
                ].join(" ")}
              >
                <SearchIcon />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher une intégration"
                  aria-label="Rechercher une intégration"
                  className={[
                    "w-full min-w-0 bg-transparent text-[14px] outline-none placeholder:text-inherit sm:text-[13px]",
                    "[&::-webkit-search-cancel-button]:appearance-none",
                    isDark ? "text-white" : "text-neutral-800",
                  ].join(" ")}
                />
              </label>

              <div className="relative flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none" ref={filterRef}>
                <button
                  type="button"
                  onClick={() => setFilterOpen((value) => !value)}
                  aria-haspopup="menu"
                  aria-expanded={filterOpen}
                  className={[
                    "flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition sm:min-h-0 sm:text-[12.5px]",
                    focusRingClass(isDark),
                    isDark
                      ? "border-white/[0.08] bg-white/[0.03] text-neutral-200 hover:bg-white/[0.06]"
                      : "border-black/[0.06] bg-white text-neutral-700 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  {filter}
                  <span
                    className={[
                      "flex transition-transform duration-200",
                      filterOpen ? "rotate-180" : "",
                    ].join(" ")}
                  >
                    <ChevronDownIcon />
                  </span>
                </button>

                {filterOpen && (
                  <div
                    role="menu"
                    className={[
                      "absolute right-0 z-20 mt-2 w-44 max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border py-1 shadow-lg",
                      isDark
                        ? "border-white/[0.08] bg-[#16161a]"
                        : "border-black/[0.06] bg-white",
                    ].join(" ")}
                  >
                    {FILTERS.map((option) => {
                      const selected = option === filter;
                      return (
                        <button
                          key={option}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selected}
                          onClick={() => {
                            setFilter(option);
                            setFilterOpen(false);
                          }}
                          className={[
                            "flex min-h-11 w-full items-center justify-between px-4 py-2.5 text-left text-[13px] transition sm:min-h-0 sm:text-[12.5px]",
                            selected
                              ? isDark
                                ? "font-semibold text-white"
                                : "font-semibold text-neutral-900"
                              : isDark
                                ? "text-neutral-400 hover:bg-white/[0.05]"
                                : "text-neutral-500 hover:bg-black/[0.03]",
                          ].join(" ")}
                        >
                          {option}
                          {selected && <CheckIcon />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* COMPTE — sous la barre de recherche, discret */}
            <p
              aria-live="polite"
              className={["mt-2.5 text-[12px] sm:hidden", mutedClass(isDark)].join(" ")}
            >
              {visible.length}{" "}
              {visible.length === 1 ? "integration" : "integrations"}
            </p>
            <span
              aria-live="polite"
              className={["ml-auto hidden text-[12px] sm:block", mutedClass(isDark)].join(" ")}
            >
              {visible.length}{" "}
              {visible.length === 1 ? "integration" : "integrations"}
            </span>

            {/* GRID */}
            <div className="mt-4 grid grid-cols-1 items-start gap-3 sm:mt-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visible.map((card) => (
                <IntegrationCard
                  key={card.title}
                  data={card}
                  isDark={isDark}
                  service={services[card.title]}
                />
              ))}
            </div>

            {visible.length === 0 && (
              <div
                className={[
                  "mt-6 flex min-h-[280px] flex-col items-center justify-center gap-3",
                  "rounded-2xl border px-4 py-10 text-center",
                  panelSurfaceClass(isDark),
                ].join(" ")}
              >
                <p className={["text-[13px]", mutedClass(isDark)].join(" ")}>
                  Aucune intégration ne correspond à votre recherche.
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className={[
                      "flex min-h-11 items-center rounded-full border px-4 text-[13px] font-semibold transition sm:min-h-0 sm:text-[12px]",
                      focusRingClass(isDark),
                      isDark
                        ? "border-white/10 text-white hover:bg-white/[0.07]"
                        : "border-black/10 text-neutral-900 hover:bg-neutral-100",
                    ].join(" ")}
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FOLDER */}
      <Folder
        isOpen={isFolderOpen}
        onClose={() => setIsFolderOpen(false)}
        isDark={isDark}
        offsetLeft={sidebarOffset}
      />

      {/* BOTTOM BAR */}
      <BottomBar
        isDark={isDark}
        offsetLeft={sidebarOffset}
        active={isFolderOpen ? "files" : null}
        onChange={handleBottomBarChange}
        onCreatePost={() => handleBottomBarChange("add")}
      />

      {/* NEW POST */}
      <NewPostModal
        isOpen={isNewPostOpen}
        onClose={() => setIsNewPostOpen(false)}
        isDark={isDark}
        onSubmit={handleCreatePost}
        onRequestOpen={() => setIsNewPostOpen(true)}
      />

      {/* HELP */}
      <HelpChatButton isDark={isDark} />
    </main>
  );
}