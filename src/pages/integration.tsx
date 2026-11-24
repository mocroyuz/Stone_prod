import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { useDialog } from "../hooks/useDialog";
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

  useDialog({ open: true, onClose: requestClose, ref: sheetRef });

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
        tabIndex={-1}
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

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-[15px] w-[15px]"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
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

type View = "connected" | "catalog";

/** Nombre de services dont l'état de connexion est vérifié au chargement. */
const STATUS_CHECK_COUNT = 4;

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
  variant = "catalog",
}: {
  data: IntegrationCardData;
  isDark: boolean;
  service?: ServiceConnection;
  /** "connected" : ligne d'une app connectée ; "catalog" : ligne du catalogue. */
  variant?: "catalog" | "connected";
}) {
  const Icon = ICONS[data.title];
  const isConnectedRow = variant === "connected";
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen || isMobile) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
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
    <article
      className={[
        "group flex min-w-0 items-center gap-3 sm:gap-4",
        isConnectedRow
          ? [
              "border-b px-0 py-3 sm:py-3.5",
              isDark ? "border-white/[0.07]" : "border-black/[0.07]",
            ].join(" ")
          : [
              "rounded-xl px-2 py-2.5",
            ].join(" "),
      ].join(" ")}
    >
      <div
        className={[
          "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border",
          isConnectedRow ? "h-12 w-12 sm:h-[52px] sm:w-[52px]" : "h-11 w-11",
          isDark
            ? "border-white/[0.12] bg-[#202024] text-neutral-100"
            : "border-black/[0.08] bg-white text-neutral-800",
        ].join(" ")}
      >
        {Icon && (
          <Icon className={isConnectedRow ? "h-6 w-6 sm:h-7 sm:w-7" : "h-6 w-6"} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3
          className={[
            "truncate text-[14px] font-bold leading-[1.25] tracking-[-0.02em] sm:text-[15px]",
            strongClass(isDark),
          ].join(" ")}
        >
          {data.title}
        </h3>
        <p
          className={[
            "mt-0.5 line-clamp-2 text-[12px] leading-[1.4] sm:text-[13px]",
            isDark ? "text-neutral-400" : "text-neutral-600",
          ].join(" ")}
        >
          {data.body}
        </p>
        {service?.error && (
          <p role="alert" className="mt-1.5 text-[12px] leading-relaxed text-red-400">
            {service.error}
          </p>
        )}
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
              "flex h-9 items-center justify-center transition-colors",
              isConnectedRow
                ? "gap-1.5 rounded-lg px-2 text-[13px] sm:px-2.5"
                : "w-9 rounded-lg",
              focusRingClass(isDark),
              isDark
                ? "text-neutral-400 hover:bg-white/[0.08] hover:text-white"
                : "text-neutral-500 hover:bg-black/[0.055] hover:text-neutral-900",
            ].join(" ")}
          >
            {isConnectedRow ? (
              <>
                <span className="hidden sm:inline">Gérer la connexion</span>
                <ChevronRightIcon className="h-[18px] w-[18px]" />
              </>
            ) : (
              <MoreIcon />
            )}
          </button>

          {menuOpen && !isMobile && (
            <div
              role="menu"
              className={[
                "absolute right-0 top-12 z-50 w-48 rounded-xl border p-1.5",
                isDark ? "border-white/[0.1] bg-[#1b1b1f]" : "border-black/[0.08] bg-white",
              ].join(" ")}
            >
              <button
                type="button"
                role="menuitem"
                disabled={service.busy}
                onClick={() => { setMenuOpen(false); service.onReconnect(); }}
                className={[
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium disabled:opacity-40",
                  isDark ? "text-neutral-200 hover:bg-white/[0.06]" : "text-neutral-700 hover:bg-black/[0.04]",
                ].join(" ")}
              >
                <RefreshIcon />
                Reconnecter
              </button>
              <div className={["my-1 h-px", isDark ? "bg-white/[0.07]" : "bg-black/[0.06]"].join(" ")} />
              <button
                type="button"
                role="menuitem"
                disabled={service.busy}
                onClick={() => { setMenuOpen(false); service.onDisconnect(); }}
                className={[
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium disabled:opacity-40",
                  isDark ? "text-rose-400 hover:bg-rose-500/[0.08]" : "text-rose-600 hover:bg-rose-500/[0.07]",
                ].join(" ")}
              >
                <DisconnectIcon />
                Déconnecter
              </button>
            </div>
          )}

          {sheetOpen && isMobile && (
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
                    onClick={() => { close(); service.onReconnect(); }}
                    className={[
                      "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-semibold disabled:opacity-40",
                      focusRingClass(isDark),
                      isDark ? "text-neutral-200 active:bg-white/[0.06]" : "text-neutral-700 active:bg-black/[0.04]",
                    ].join(" ")}
                  >
                    <RefreshIcon />
                    Reconnecter
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={service.busy}
                    onClick={() => { close(); service.onDisconnect(); }}
                    className={[
                      "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-semibold disabled:opacity-40",
                      focusRingClass(isDark),
                      isDark ? "text-rose-400 active:bg-rose-500/[0.07]" : "text-rose-600 active:bg-rose-500/[0.07]",
                    ].join(" ")}
                  >
                    <DisconnectIcon />
                    Déconnecter
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
          aria-label={`Connecter ${data.title}`}
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-default active:scale-90",
            service?.busy ? "animate-pulse opacity-60" : "",
            focusRingClass(isDark),
            isDark
              ? "text-neutral-300 hover:bg-white/[0.12] hover:text-white"
              : "text-neutral-700 hover:bg-black/[0.09] hover:text-neutral-950",
          ].join(" ")}
        >
          <PlusIcon />
        </button>
      )}
    </article>
  );
}

/* ============================================================
   PAGE
============================================================ */

type IntegrationsProps = { embedded?: boolean };

export default function Integrations({ embedded = false }: IntegrationsProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const sidebarOffset = useSidebarOffset();
  const isMobile = useIsMobile();

  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const saved = isFavorite(PAGE_ROUTE);

  const [query, setQuery] = useState("");
  // Choix explicite de l'utilisateur ; sinon la vue dépend des apps connectées.
  const [chosenView, setChosenView] = useState<View | null>(null);
  const [settledChecks, setSettledChecks] = useState(0);

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
      })
      .finally(() => {
        if (active) setSettledChecks((count) => count + 1);
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
      })
      .finally(() => {
        if (active) setSettledChecks((count) => count + 1);
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
      })
      .finally(() => {
        if (active) setSettledChecks((count) => count + 1);
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
      })
      .finally(() => {
        if (active) setSettledChecks((count) => count + 1);
      });

    return () => {
      active = false;
    };
  }, []);

  const needle = query.trim().toLowerCase();
  const connectionState: Record<string, boolean> = {
    Canva: canvaConnected,
    Dropbox: dropboxConnected,
    "Google Drive": gdriveConnected,
    "Google Photos": gphotosConnected,
  };

  const matchesSearch = (item: IntegrationCardData): boolean =>
    needle.length === 0 ||
    `${item.title} ${item.meta ?? ""}`.toLowerCase().includes(needle);

  const visible = INTEGRATIONS.filter(matchesSearch);
  const hasActiveSearch = needle.length > 0;

  const resetSearch = () => setQuery("");

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

  const isServiceConnected = (item: IntegrationCardData): boolean =>
    connectionState[item.title] === true;

  const installed = INTEGRATIONS.filter(
    (item) => isServiceConnected(item)
  );
  const popularNames = ["Gmail", "Google Drive", "Canva", "Dropbox", "Google Photos", "Google Calendar"];
  const popular = visible.filter((item) => popularNames.includes(item.title));
  const popularSet = new Set(popularNames);
  const discoveries = visible.filter((item) => !popularSet.has(item.title));

  // Vue affichée : apps connectées s'il y en a, sinon le catalogue.
  // Tant que l'état de connexion n'est pas connu, on n'affiche rien de trompeur.
  const checksDone = settledChecks >= STATUS_CHECK_COUNT;
  const hasConnected = installed.length > 0;
  const view: View | null =
    chosenView === "catalog"
      ? "catalog"
      : !checksDone && chosenView === null
        ? null
        : hasConnected
          ? "connected"
          : "catalog";

  const PageContainer = embedded ? "div" : "main";

  return (
    <PageContainer
      className={[
        "relative w-full min-w-0 transition-colors duration-300",
        embedded ? "min-h-0" : "h-dvh min-h-dvh overflow-hidden overscroll-none",
        embedded ? "" : pageBgClass(isDark),
      ].join(" ")}
    >
      {!embedded && <DashboardSidebar theme={theme} />}

      <div
        className={[
          "min-w-0",
          embedded
            ? "w-full"
            : [
                "h-full min-h-0 px-2 py-2 md:py-3 md:pl-0 md:pr-3",
                "max-md:pt-[calc(3.5rem+env(safe-area-inset-top))]",
                "transition-[padding-left] duration-[380ms]",
                "ease-[cubic-bezier(0.4,0,0.2,1)]",
                "motion-reduce:transition-none",
              ].join(" "),
        ].join(" ")}
        style={embedded || isMobile ? undefined : { paddingLeft: sidebarOffset }}
      >
        <div
          className={[
            "min-w-0",
            embedded
              ? "w-full"
              : [
                  "h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain",
                  "rounded-2xl border md:rounded-[28px]",
                  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  "transition-colors duration-300",
                  mainPanelClass(isDark),
                ].join(" "),
          ].join(" ")}
        >
          <div
            className={[
              "mx-auto flex w-full min-w-0 max-w-[1720px] flex-col",
              embedded
                ? "px-0 pb-0 pt-0"
                : [
                    "px-[clamp(18px,1.8vw,30px)]",
                    "pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[clamp(16px,3vw,30px)]",
                  ].join(" "),
            ].join(" ")}
          >
            {!embedded && (
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

            )}

            {/* CHARGEMENT — état de connexion en cours de vérification */}
            {view === null && (
              <p
                role="status"
                className={["mt-6 text-[13px]", mutedClass(isDark)].join(" ")}
              >
                Chargement des intégrations…
              </p>
            )}

            {/* APPS CONNECTÉES — vue par défaut quand au moins une app est connectée */}
            {view === "connected" && (
              <section className={embedded ? "mt-0" : "mt-6"}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className={["text-[13px]", mutedClass(isDark)].join(" ")}>
                    {installed.length === 1
                      ? "1 app connectée"
                      : `${installed.length} apps connectées`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setChosenView("catalog")}
                    className={[
                      "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[12px] font-medium transition-colors",
                      focusRingClass(isDark),
                      isDark
                        ? "border-white/[0.12] text-neutral-200 hover:bg-white/[0.06]"
                        : "border-black/[0.1] bg-white text-neutral-800 hover:bg-black/[0.03]",
                    ].join(" ")}
                  >
                    Catalogue
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  {installed.map((card) => (
                    <IntegrationCard
                      key={card.title}
                      data={card}
                      isDark={isDark}
                      service={services[card.title]}
                      variant="connected"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* CATALOGUE — affiché quand aucune app n'est connectée, ou sur demande */}
            {view === "catalog" && (
              <>
                {/* SEARCH — largeur complète */}
                <div className={embedded ? "mt-0" : "mt-7 sm:mt-8"}>
                  <label
                    className={[
                      "flex h-11 w-full items-center gap-3 rounded-full border px-4 transition",
                      "focus-within:ring-2",
                      isDark
                        ? "border-white/[0.12] bg-white/[0.035] text-neutral-400 focus-within:ring-white/20"
                        : "border-black/[0.12] bg-white text-neutral-500 focus-within:ring-black/10",
                    ].join(" ")}
                  >
                    <SearchIcon />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Rechercher des intégrations"
                      aria-label="Rechercher des intégrations"
                      className={[
                        "w-full min-w-0 bg-transparent text-[14px] outline-none placeholder:text-inherit",
                        "[&::-webkit-search-cancel-button]:appearance-none",
                        isDark ? "text-white" : "text-neutral-900",
                      ].join(" ")}
                    />
                  </label>
                </div>

                {/* INSTALLÉS */}
                <section className="mt-7 sm:mt-8">
                  <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
                    <h2 className={["flex items-center gap-1.5 text-[16px] font-semibold tracking-[-0.025em] sm:text-[17px]", strongClass(isDark)].join(" ")}>
                      Installés
                      <span className={mutedClass(isDark)}><ChevronRightIcon /></span>
                    </h2>
                    {hasConnected && (
                      <button
                        type="button"
                        onClick={() => setChosenView("connected")}
                        className={[
                          "inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-medium transition-colors",
                          focusRingClass(isDark),
                          isDark
                            ? "text-neutral-300 hover:bg-white/[0.07]"
                            : "text-neutral-600 hover:bg-black/[0.05]",
                        ].join(" ")}
                      >
                        Gérer les apps connectées
                        <ChevronRightIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {hasConnected ? (
                    <div className="flex flex-wrap items-center gap-2.5 pb-6 sm:gap-3">
                      {installed.map((item) => {
                        const Icon = ICONS[item.title];
                        return (
                          <div
                            key={item.title}
                            tabIndex={0}
                            aria-label={item.title}
                            className="group relative outline-none"
                          >
                            <div
                              className={[
                                "flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5",
                                isDark
                                  ? "bg-[#202024] group-hover:bg-[#2a2a2f]"
                                  : "bg-neutral-100 group-hover:bg-neutral-200/70",
                              ].join(" ")}
                            >
                              {Icon && <Icon className="h-6 w-6" />}
                            </div>
                            <span
                              className={[
                                "pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 translate-y-[-3px] whitespace-nowrap text-[13px] font-bold tracking-[-0.01em] opacity-0 transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100",
                                strongClass(isDark),
                              ].join(" ")}
                            >
                              {item.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={["text-[13px]", mutedClass(isDark)].join(" ")}>
                      Vos apps connectées apparaîtront ici.
                    </p>
                  )}
                </section>

                {/* LES PLUS UTILISÉS */}
                <section className="mt-7 sm:mt-8">
                  <h2 className={["mb-2.5 flex items-center gap-1 text-[16px] font-semibold tracking-[-0.025em] sm:text-[17px]", strongClass(isDark)].join(" ")}>
                    Les plus utilisés
                    <span className={mutedClass(isDark)}><ChevronRightIcon /></span>
                  </h2>
                  {popular.length > 0 ? (
                    <div className="grid grid-cols-1 gap-x-6 gap-y-1 lg:grid-cols-2">
                      {popular.map((card) => (
                        <IntegrationCard key={card.title} data={card} isDark={isDark} service={services[card.title]} />
                      ))}
                    </div>
                  ) : (
                    <p className={["text-[13px]", mutedClass(isDark)].join(" ")}>Aucune intégration ne correspond.</p>
                  )}
                </section>

                {/* NOUVEAUTÉS À DÉCOUVRIR */}
                <section className="mt-7 sm:mt-8">
                  <h2 className={["mb-2.5 flex items-center gap-1 text-[16px] font-semibold tracking-[-0.025em] sm:text-[17px]", strongClass(isDark)].join(" ")}>
                    Nouveautés à découvrir
                    <span className={mutedClass(isDark)}><ChevronRightIcon /></span>
                  </h2>
                  {discoveries.length > 0 ? (
                    <div className="grid grid-cols-1 gap-x-6 gap-y-1 lg:grid-cols-2">
                      {discoveries.map((card) => (
                        <IntegrationCard key={card.title} data={card} isDark={isDark} service={services[card.title]} />
                      ))}
                    </div>
                  ) : (
                    <p className={["text-[13px]", mutedClass(isDark)].join(" ")}>Aucune intégration ne correspond.</p>
                  )}
                </section>

                {visible.length === 0 && (
                  <div className={[
                    "mt-8 flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-2xl border px-4 py-10 text-center",
                    panelSurfaceClass(isDark),
                  ].join(" ")}>
                    <p className={["text-[13px]", mutedClass(isDark)].join(" ")}>
                      Aucune intégration ne correspond à votre recherche.
                    </p>
                    {hasActiveSearch && (
                      <button
                        type="button"
                        onClick={resetSearch}
                        className={[
                          "rounded-full border px-4 py-2 text-[12px] font-semibold transition",
                          focusRingClass(isDark),
                          isDark ? "border-white/10 text-white hover:bg-white/[0.07]" : "border-black/10 text-neutral-900 hover:bg-neutral-100",
                        ].join(" ")}
                      >
                        Effacer la recherche
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {!embedded && (
        <>
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
        </>
      )}
    </PageContainer>
  );
}