import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { navigate } from "../hooks/useHashRoute";
import { useTheme, type Theme } from "../hooks/useTheme";
import Modal from "../components/Modal";

import {
  getCurrentUser,
  updateUserProfile,
  uploadAvatar,
  deleteAvatar,
  resendVerificationEmail,
  updatePassword,
  type UserProfile,
} from "../services/supabase";

/* ── Tokens (classes complètes, compatibles Tailwind v3/v4) ── */

const DARK = {
  pageBg: "bg-[#050505]",
  card: "bg-[#0a0a0a]",
  cardBorder: "border-white/[0.08]",
  divide: "divide-white/[0.08]",
  muted: "bg-white/[0.03]",
  sidebarBg: "bg-[#0a0a0a]",
  group: "text-neutral-500",
  item: "text-neutral-300",
  itemHover: "hover:bg-white/[0.05]",
  itemActive: "bg-white/[0.09] text-white",
  badgeNew: "bg-fuchsia-500/20 text-fuchsia-300",
  label: "text-neutral-300",
  heading: "text-white",
  body: "text-neutral-400",
  subtle: "text-neutral-500",
  link: "text-white",
  inputBg: "bg-[#111]",
  inputBorder: "border-white/10",
  inputText: "text-white",
  placeholder: "placeholder:text-neutral-500",
  inputFocus: "focus:border-neutral-400 focus:ring-2 focus:ring-white/10",
  primary: "bg-white text-black hover:bg-neutral-200",
  secondary:
    "border border-white/10 bg-transparent text-white hover:bg-white/[0.06]",
  ring: "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60",
  toggleOn: "bg-white",
  toggleOff: "bg-white/15",
  toggleKnob: "bg-black",
  toast: "border-white/10 bg-[#141414] text-white",
  avatarRing: "ring-white/10",
  ghostHover: "hover:bg-white/10 hover:text-neutral-200",
  ok: "bg-emerald-500/15 text-emerald-300",
  warn: "bg-amber-500/15 text-amber-300",
  track: "bg-white/10",
  dangerBorder: "border-red-500/30",
  dangerTitle: "text-red-400",
  dangerBtn: "bg-red-600 text-white hover:bg-red-500",
};

type Tokens = Record<keyof typeof DARK, string>;

const LIGHT: Tokens = {
  pageBg: "bg-[#fafaf9]",
  card: "bg-white",
  cardBorder: "border-neutral-200",
  divide: "divide-neutral-200",
  muted: "bg-neutral-50",
  sidebarBg: "bg-[#f7f6f3]",
  group: "text-neutral-500",
  item: "text-neutral-700",
  itemHover: "hover:bg-black/[0.04]",
  itemActive: "bg-black/[0.07] text-neutral-900",
  badgeNew: "bg-fuchsia-100 text-fuchsia-700",
  label: "text-neutral-700",
  heading: "text-neutral-900",
  body: "text-neutral-600",
  subtle: "text-neutral-500",
  link: "text-neutral-900",
  inputBg: "bg-white",
  inputBorder: "border-neutral-300",
  inputText: "text-neutral-900",
  placeholder: "placeholder:text-neutral-400",
  inputFocus: "focus:border-neutral-500 focus:ring-2 focus:ring-black/10",
  primary: "bg-neutral-900 text-white hover:bg-neutral-800",
  secondary:
    "border border-neutral-300 bg-transparent text-neutral-900 hover:bg-neutral-100",
  ring: "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900/60",
  toggleOn: "bg-neutral-900",
  toggleOff: "bg-neutral-300",
  toggleKnob: "bg-white",
  toast: "border-neutral-200 bg-white text-neutral-900",
  avatarRing: "ring-black/10",
  ghostHover: "hover:bg-neutral-200 hover:text-neutral-800",
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  track: "bg-neutral-200",
  dangerBorder: "border-red-200",
  dangerTitle: "text-red-600",
  dangerBtn: "bg-red-600 text-white hover:bg-red-500",
};

const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

const uid = () => Math.random().toString(36).slice(2, 10);

/* ── Icons ── */

const svgBase = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const mkIcon =
  (paths: ReactNode, size = "h-[18px] w-[18px]") =>
  ({ className = size }: { className?: string }) =>
    (
      <svg {...svgBase} className={className}>
        {paths}
      </svg>
    );

const UserIcon = mkIcon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>
);
const ShieldIcon = mkIcon(
  <path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z" />
);
const SunIcon = mkIcon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>
);
const BellIcon = mkIcon(
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>
);
const CardIcon = mkIcon(
  <>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </>
);
const AlertIcon = mkIcon(
  <>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
  </>
);
const ArrowLeftIcon = mkIcon(
  <>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </>,
  "h-5 w-5"
);
const EyeIcon = mkIcon(
  <>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
  "h-4 w-4"
);
const EyeOffIcon = mkIcon(
  <>
    <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </>,
  "h-4 w-4"
);
const CheckIcon = mkIcon(<path d="m5 12.5 4.2 4.2L19 7" />, "h-4 w-4");
const TagIcon = mkIcon(
  <>
    <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
    <circle cx="7" cy="7" r="1.2" />
  </>
);
const ClipboardIcon = mkIcon(
  <>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4" />
    <path d="M12 16h4" />
    <path d="M8 11h.01" />
    <path d="M8 16h.01" />
  </>
);
const SearchIcon = mkIcon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
  "h-4 w-4"
);
const PencilIcon = mkIcon(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </>,
  "h-4 w-4"
);
const TrashIcon = mkIcon(
  <>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </>,
  "h-4 w-4"
);
const MoreIcon = mkIcon(
  <>
    <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </>
);

/* ── Hooks ── */

function usePref(key: string, initial: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : stored === "1";
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, value ? "1" : "0");
    } catch {
      /* stockage indisponible */
    }
    document.documentElement.dataset[key] = value ? "true" : "false";
  }, [key, value]);

  return [value, setValue] as const;
}

/* ── UI de base ── */

function Field({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
  error,
  trailing,
  hint,
  readOnly,
  onEnter,
  autoFocus,
  tokens,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  error?: string;
  trailing?: ReactNode;
  hint?: string;
  readOnly?: boolean;
  onEnter?: () => void;
  autoFocus?: boolean;
  tokens: Tokens;
}) {
  return (
    <label className="block">
      <span
        className={cx("mb-1.5 block text-[13px] font-medium", tokens.label)}
      >
        {label}
      </span>

      <div className="relative">
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          readOnly={readOnly}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEnter?.();
          }}
          className={cx(
            "w-full rounded-[10px] border px-3.5 py-2.5 text-[14px] outline-none transition",
            tokens.inputBg,
            tokens.inputText,
            tokens.placeholder,
            readOnly ? "cursor-default opacity-70" : tokens.inputFocus,
            trailing && "pr-11",
            error ? "border-red-500" : tokens.inputBorder
          )}
        />

        {trailing && (
          <span className="absolute top-1/2 right-2 -translate-y-1/2">
            {trailing}
          </span>
        )}
      </div>

      {error ? (
        <span className="mt-1.5 block text-[12px] text-red-500">{error}</span>
      ) : hint ? (
        <span className={cx("mt-1.5 block text-[12px]", tokens.subtle)}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  tokens,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  tokens: Tokens;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        tokens.ring,
        checked ? tokens.toggleOn : tokens.toggleOff
      )}
    >
      <span
        className={cx(
          "inline-block h-5 w-5 rounded-full shadow transition-transform",
          checked ? tokens.toggleKnob : "bg-white",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function Row({
  title,
  description,
  children,
  tokens,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  tokens: Tokens;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className={cx("text-[14px] font-medium", tokens.heading)}>{title}</p>
        {description && (
          <p className={cx("mt-0.5 text-[12.5px] leading-relaxed", tokens.body)}>
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Button({
  variant = "primary",
  tokens,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  tokens: Tokens;
}) {
  const style =
    variant === "primary"
      ? tokens.primary
      : variant === "danger"
      ? tokens.dangerBtn
      : tokens.secondary;

  return (
    <button
      type="button"
      {...props}
      className={cx(
        "rounded-[10px] px-4 py-2.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        tokens.ring,
        style,
        className
      )}
    />
  );
}

function SectionCard({
  title,
  description,
  children,
  tokens,
  danger,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  tokens: Tokens;
  danger?: boolean;
  footer?: ReactNode;
}) {
  return (
    <section
      className={cx(
        "overflow-hidden rounded-2xl border shadow-sm transition-colors duration-300",
        tokens.card,
        danger ? tokens.dangerBorder : tokens.cardBorder
      )}
    >
      <div className="p-[clamp(18px,2.4vw,28px)]">
        <header className="mb-4">
          <h3
            className={cx(
              "font-display text-[17px] font-semibold tracking-[-0.01em]",
              danger ? tokens.dangerTitle : tokens.heading
            )}
          >
            {title}
          </h3>
          {description && (
            <p className={cx("mt-1 text-[13px] leading-relaxed", tokens.body)}>
              {description}
            </p>
          )}
        </header>

        <div className={cx("divide-y", tokens.divide)}>{children}</div>
      </div>

      {footer && (
        <div
          className={cx(
            "flex items-center justify-end gap-3 border-t px-[clamp(18px,2.4vw,28px)] py-3.5",
            tokens.muted,
            danger ? tokens.dangerBorder : tokens.cardBorder
          )}
        >
          {footer}
        </div>
      )}
    </section>
  );
}

/* ── Sidebar ── */

type SectionKey =
  | "profile"
  | "account"
  | "appearance"
  | "notifications"
  | "billing"
  | "tags"
  | "savedReplies"
  | "danger";

const SIDEBAR_GROUPS: {
  label: string;
  items: { key: SectionKey; label: string; icon: ReactNode; badge?: string }[];
}[] = [
  {
    label: "Account",
    items: [
      { key: "profile", label: "Profile", icon: <UserIcon /> },
      { key: "account", label: "Security", icon: <ShieldIcon /> },
      { key: "notifications", label: "Notifications", icon: <BellIcon /> },
    ],
  },
  {
    label: "Organization",
    items: [{ key: "billing", label: "Billing", icon: <CardIcon /> }],
  },
  {
    label: "Utils",
    items: [
      { key: "tags", label: "Tags", icon: <TagIcon /> },
      { key: "savedReplies", label: "Saved replies", icon: <ClipboardIcon /> },
    ],
  },
  {
    label: "Other",
    items: [
      { key: "appearance", label: "Appearance", icon: <SunIcon />, badge: "New" },
      { key: "danger", label: "Danger zone", icon: <AlertIcon /> },
    ],
  },
];

const SECTION_TITLES: Record<SectionKey, string> = {
  profile: "Profile",
  account: "Security",
  appearance: "Appearance",
  notifications: "Notifications",
  billing: "Billing",
  tags: "Tags",
  savedReplies: "Saved Replies",
  danger: "Danger zone",
};

function SettingsSidebar({
  active,
  onSelect,
  onBack,
  tokens,
}: {
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  onBack: () => void;
  tokens: Tokens;
}) {
  return (
    <aside
      className={cx(
        "flex shrink-0 flex-col border-r transition-colors duration-300 max-md:sticky max-md:top-0 max-md:z-20 max-md:w-full max-md:border-r-0 max-md:border-b md:sticky md:top-0 md:h-screen md:w-[232px] md:overflow-y-auto",
        tokens.sidebarBg,
        tokens.cardBorder
      )}
    >
      <div className="flex items-center gap-2.5 px-3 pt-5 pb-3 max-md:pt-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to home"
          title="Back to home"
          className={cx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
            tokens.item,
            tokens.itemHover,
            tokens.ring
          )}
        >
          <ArrowLeftIcon />
        </button>
        <h2
          className={cx(
            "font-display text-[17px] font-semibold tracking-[-0.01em]",
            tokens.heading
          )}
        >
          Settings
        </h2>
      </div>

      <nav
        aria-label="Settings sections"
        className="px-3 pb-4 max-md:flex max-md:gap-1 max-md:overflow-x-auto max-md:pb-3"
      >
        {SIDEBAR_GROUPS.map((group, index) => (
          <div
            key={group.label}
            className={cx(index === 0 ? "mt-1" : "mt-5", "max-md:mt-0")}
          >
            <p
              className={cx(
                "mb-1.5 px-3 text-[12px] max-md:hidden",
                tokens.group
              )}
            >
              {group.label}
            </p>

            <ul className="flex flex-col gap-0.5 max-md:flex-row">
              {group.items.map((item) => {
                const isActive = active === item.key;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.key)}
                      aria-current={isActive ? "page" : undefined}
                      className={cx(
                        "flex h-10 w-full items-center gap-3 rounded-[10px] px-[11px] text-left text-[14px] font-medium whitespace-nowrap transition-colors",
                        tokens.ring,
                        isActive
                          ? tokens.itemActive
                          : `${tokens.item} ${tokens.itemHover}`
                      )}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span
                          className={cx(
                            "rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                            tokens.badgeNew
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

/* ── Page ── */

type SettingsProps = {
  theme?: Theme;
  onToggleTheme?: () => void;
};

type Notify = (message: string, kind?: "success" | "error") => void;

export default function Settings(_props: SettingsProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const tokens = useMemo<Tokens>(() => (isDark ? DARK : LIGHT), [isDark]);

  const [active, setActive] = useState<SectionKey>("profile");
  const [toast, setToast] = useState<{
    message: string;
    kind: "success" | "error";
  } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  const notify = useCallback<Notify>((message, kind) => {
    const resolved =
      kind ??
      (/fail|error|must|enter|do not|different/i.test(message)
        ? "error"
        : "success");

    setToast({ message, kind: resolved });

    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);

    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    []
  );

  const handleSelectTheme = useCallback(
    (next: "light" | "dark", origin?: { x: number; y: number }) => {
      if (next !== theme) toggle(origin);
    },
    [theme, toggle]
  );

  const handleSelect = useCallback((key: SectionKey) => {
    setActive(key);
    window.scrollTo({ top: 0 });
    titleRef.current?.focus();
  }, []);

  const handleBack = useCallback(() => navigate("home"), []);

  return (
    <main
      className={cx(
        "min-h-screen w-full transition-colors duration-500",
        tokens.pageBg
      )}
    >
      <div className="flex w-full max-md:flex-col">
        <SettingsSidebar
          active={active}
          onSelect={handleSelect}
          onBack={handleBack}
          tokens={tokens}
        />

        <div className="mx-auto w-full max-w-[840px] min-w-0 flex-1 px-[clamp(16px,4vw,48px)] py-[clamp(24px,4vw,56px)]">
          <h1
            ref={titleRef}
            tabIndex={-1}
            className={cx(
              "mb-[clamp(18px,2.4vw,28px)] font-display text-[clamp(26px,2.6vw,34px)] font-semibold tracking-[-0.02em] outline-none",
              tokens.heading
            )}
          >
            {SECTION_TITLES[active]}
          </h1>

          <div className="flex flex-col gap-5">
            {active === "profile" && (
              <ProfileSection tokens={tokens} notify={notify} />
            )}
            {active === "account" && (
              <AccountSection tokens={tokens} notify={notify} />
            )}
            {active === "appearance" && (
              <AppearanceSection
                tokens={tokens}
                isDark={isDark}
                setTheme={handleSelectTheme}
              />
            )}
            {active === "notifications" && (
              <NotificationsSection tokens={tokens} notify={notify} />
            )}
            {active === "billing" && (
              <BillingSection tokens={tokens} notify={notify} />
            )}
            {active === "tags" && (
              <TagsSection tokens={tokens} notify={notify} isDark={isDark} />
            )}
            {active === "savedReplies" && (
              <SavedRepliesSection
                tokens={tokens}
                notify={notify}
                isDark={isDark}
              />
            )}
            {active === "danger" && (
              <DangerSection tokens={tokens} notify={notify} />
            )}
          </div>
        </div>
      </div>

      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 left-1/2 z-30 -translate-x-1/2 px-4"
      >
        {toast && (
          <div
            className={cx(
              "flex items-center gap-2.5 rounded-full border py-2.5 pr-5 pl-3 text-[13px] font-medium shadow-lg backdrop-blur",
              tokens.toast
            )}
          >
            <span
              className={cx(
                "flex h-5 w-5 items-center justify-center rounded-full text-white",
                toast.kind === "error" ? "bg-red-500" : "bg-emerald-500"
              )}
            >
              {toast.kind === "error" ? (
                <span className="text-[12px] leading-none font-bold">!</span>
              ) : (
                <CheckIcon className="h-3 w-3" />
              )}
            </span>
            {toast.message}
          </div>
        )}
      </div>
    </main>
  );
}

/* ── Profile ── */

function ProfileSection({
  tokens,
  notify,
}: {
  tokens: Tokens;
  notify: Notify;
}) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await getCurrentUser();
        if (!mounted || !data) return;

        setUser(data);
        setFirst(data.first_name || "");
        setLast(data.last_name || "");
        setAvatarUrl(data.avatar_url || null);
        setAvatarLoadFailed(false);
      } catch (error) {
        console.error("Error loading user profile:", error);
        if (mounted) notify("Failed to load profile", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [notify]);

  const dirty =
    !!user &&
    (first.trim() !== (user.first_name || "") ||
      last.trim() !== (user.last_name || ""));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      notify("File size must be less than 2MB", "error");
      return;
    }

    if (!file.type.startsWith("image/")) {
      notify("File must be an image", "error");
      return;
    }

    setUploading(true);
    const previous = avatarUrl;

    try {
      const publicUrl = await uploadAvatar(file, user.id);

      if (!publicUrl) {
        notify("Failed to upload image", "error");
        return;
      }

      setAvatarUrl(publicUrl);
      setAvatarLoadFailed(false);

      const ok = await updateUserProfile({ avatar_url: publicUrl });

      if (!ok) {
        setAvatarUrl(previous);
        notify("Image uploaded but profile update failed", "error");
        return;
      }

      if (previous && previous !== publicUrl) {
        try {
          await deleteAvatar(previous);
        } catch (e) {
          console.warn("Old avatar could not be deleted:", e);
        }
      }

      setUser((c) => (c ? { ...c, avatar_url: publicUrl } : c));
      notify("Profile picture updated");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      setAvatarUrl(previous);
      notify(
        error instanceof Error ? error.message : "Failed to upload image",
        "error"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || !avatarUrl || uploading) return;

    setUploading(true);

    try {
      await deleteAvatar(avatarUrl);

      const ok = await updateUserProfile({ avatar_url: "" });

      if (!ok) {
        notify("Avatar deleted but profile update failed", "error");
        return;
      }

      setAvatarUrl(null);
      setAvatarLoadFailed(false);
      setUser((c) => (c ? { ...c, avatar_url: undefined } : c));
      notify("Profile picture removed");
    } catch (error) {
      console.error("Error removing avatar:", error);
      notify(
        error instanceof Error
          ? error.message
          : "Failed to remove profile picture",
        "error"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user || saving || !dirty) return;

    setSaving(true);

    const next = {
      first_name: first.trim(),
      last_name: last.trim(),
    };

    try {
      const ok = await updateUserProfile({
        ...next,
        avatar_url: avatarUrl || undefined,
      });

      if (!ok) {
        notify("Failed to save profile", "error");
        return;
      }

      setUser({ ...user, ...next, avatar_url: avatarUrl || undefined });
      notify("Profile saved");
    } catch (error) {
      console.error("Error saving profile:", error);
      notify(
        error instanceof Error ? error.message : "Failed to save profile",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const description = "This information is visible to your teammates.";

  if (loading) {
    return (
      <SectionCard title="Profile" description={description} tokens={tokens}>
        <div className="animate-pulse space-y-4 py-2" aria-busy="true">
          <div className="flex items-center gap-4">
            <div className={cx("h-16 w-16 rounded-full", tokens.track)} />
            <div className="space-y-2">
              <div className={cx("h-3 w-32 rounded", tokens.track)} />
              <div className={cx("h-3 w-48 rounded", tokens.track)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={cx("h-11 rounded-[10px]", tokens.track)} />
            <div className={cx("h-11 rounded-[10px]", tokens.track)} />
          </div>
        </div>
      </SectionCard>
    );
  }

  if (!user) {
    return (
      <SectionCard title="Profile" description={description} tokens={tokens}>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className={cx("text-[13.5px]", tokens.body)}>
            Please sign in to view your profile.
          </p>
          <Button tokens={tokens} onClick={() => navigate("home")}>
            Go to home
          </Button>
        </div>
      </SectionCard>
    );
  }

  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "U";
  const showImage = Boolean(avatarUrl) && !avatarLoadFailed;

  return (
    <SectionCard
      title="Profile"
      description={description}
      tokens={tokens}
      footer={
        <>
          {dirty && (
            <span className={cx("text-[12.5px]", tokens.subtle)}>
              Unsaved changes
            </span>
          )}
          <Button
            tokens={tokens}
            onClick={handleSave}
            disabled={!dirty || saving || uploading}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {showImage ? (
            <img
              key={avatarUrl}
              src={avatarUrl!}
              alt="Profile"
              className={cx(
                "h-16 w-16 shrink-0 rounded-full object-cover ring-1",
                tokens.avatarRing,
                uploading && "opacity-50"
              )}
              onError={() => setAvatarLoadFailed(true)}
            />
          ) : (
            <div
              className={cx(
                "flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-[19px] font-semibold",
                tokens.primary
              )}
            >
              {initials}
            </div>
          )}

          <div>
            <p className={cx("text-[14px] font-medium", tokens.heading)}>
              Profile picture
            </p>
            <p className={cx("mt-0.5 text-[12.5px]", tokens.body)}>
              PNG, JPG, GIF or WebP, up to 2 MB.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={handleFileUpload}
            className="peer sr-only"
            id="avatar-upload"
            disabled={uploading}
          />

          <label
            htmlFor="avatar-upload"
            className={cx(
              "rounded-[10px] px-3.5 py-2 text-[13px] font-medium transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
              uploading ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              tokens.secondary
            )}
          >
            {uploading ? "Uploading..." : avatarUrl ? "Change" : "Upload"}
          </label>

          {avatarUrl && (
            <Button
              tokens={tokens}
              variant="secondary"
              onClick={handleRemoveAvatar}
              disabled={uploading}
              className="!px-3.5 !py-2 !font-medium"
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 pt-5 sm:grid-cols-2">
        <Field
          label="First name"
          value={first}
          onChange={setFirst}
          autoComplete="given-name"
          tokens={tokens}
        />
        <Field
          label="Last name"
          value={last}
          onChange={setLast}
          autoComplete="family-name"
          tokens={tokens}
        />
      </div>
    </SectionCard>
  );
}

/* ── Security ── */

const STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = [
  "bg-red-500",
  "bg-red-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
];

function passwordScore(value: string): number {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  return Math.min(score, 4);
}

function AccountSection({
  tokens,
  notify,
}: {
  tokens: Tokens;
  notify: Notify;
}) {
  const [email, setEmail] = useState("");
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [verified, setVerified] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [provider, setProvider] = useState<string>("email");
  const [hasPassword, setHasPassword] = useState(true);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNext, setConfirmNext] = useState("");
  const [show, setShow] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await getCurrentUser();
        if (!mounted || !data) return;

        setEmail(data.email || "");
        setVerified(Boolean(data.email_confirmed_at));
        setProvider(data.provider ?? "email");
        setHasPassword(data.hasPassword !== undefined ? data.hasPassword : true);
      } catch (error) {
        console.error("Error loading account details:", error);
        if (mounted) notify("Failed to load account details", "error");
      } finally {
        if (mounted) setLoadingAccount(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [notify]);

  const handleSendVerification = async () => {
    if (loadingAccount || verified || sendingVerification) return;

    setSendingVerification(true);

    try {
      const ok = await resendVerificationEmail();
      notify(
        ok ? "Verification email sent" : "Failed to send verification email",
        ok ? "success" : "error"
      );
    } catch (error) {
      console.error("Error sending verification email:", error);
      notify(
        error instanceof Error
          ? error.message
          : "Failed to send verification email",
        "error"
      );
    } finally {
      setSendingVerification(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (updatingPassword || loadingAccount) return;

    if (hasPassword && !current) return notify("Enter your current password");
    if (!next)
      return notify(hasPassword ? "Enter a new password" : "Enter a password");
    if (next.length < 8)
      return notify("Password must be at least 8 characters");
    if (hasPassword && next === current)
      return notify("New password must be different from the current one");
    if (next !== confirmNext) return notify("Passwords do not match");

    setUpdatingPassword(true);

    try {
      await updatePassword(hasPassword ? current : null, next);

      const wasSetting = !hasPassword;

      setCurrent("");
      setNext("");
      setConfirmNext("");
      setHasPassword(true);

      notify(wasSetting ? "Password set" : "Password updated");
    } catch (error) {
      console.error("Error updating password:", error);
      notify(
        error instanceof Error ? error.message : "Failed to update password",
        "error"
      );
    } finally {
      setUpdatingPassword(false);
    }
  };

  const trailing = (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setShow((v) => !v)}
      aria-label={show ? "Hide password" : "Show password"}
      title={show ? "Hide password" : "Show password"}
      className={cx(
        "flex h-7 w-7 items-center justify-center rounded-md transition",
        tokens.subtle,
        tokens.ghostHover,
        tokens.ring
      )}
    >
      {show ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );

  const providerLabel =
    provider === "google" ? "Google" : provider === "github" ? "GitHub" : null;

  const isOAuthOnly = !hasPassword;
  const score = passwordScore(next);
  const mismatch = confirmNext.length > 0 && next !== confirmNext;
  const pwType = show ? "text" : "password";

  return (
    <>
      <SectionCard
        title="Email"
        description="We'll send confirmation links and important notices here."
        tokens={tokens}
        footer={
          <Button
            tokens={tokens}
            variant="secondary"
            disabled={loadingAccount || verified || sendingVerification}
            onClick={handleSendVerification}
            className="!px-3.5 !py-2 !font-medium"
          >
            {sendingVerification ? "Sending..." : "Send verification email"}
          </Button>
        }
      >
        <Field
          label="Email address"
          type="email"
          value={email}
          placeholder={loadingAccount ? "Loading..." : undefined}
          onChange={() => undefined}
          readOnly
          autoComplete="email"
          hint="Contact support to change your email address."
          tokens={tokens}
        />

        <div className="pt-4">
          <span
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
              verified ? tokens.ok : tokens.warn
            )}
          >
            {verified && <CheckIcon className="h-3 w-3" />}
            {loadingAccount ? "Checking..." : verified ? "Verified" : "Unverified"}
          </span>
        </div>
      </SectionCard>

      <SectionCard
        title={isOAuthOnly ? "Set a password" : "Password"}
        description={
          loadingAccount
            ? "Loading your account details..."
            : isOAuthOnly
            ? `You signed in with ${
                providerLabel ?? "an external provider"
              }. Set a password to also sign in with your email.`
            : "Use at least 8 characters. Mix letters, numbers, and symbols."
        }
        tokens={tokens}
        footer={
          <Button
            tokens={tokens}
            onClick={handleUpdatePassword}
            disabled={updatingPassword || loadingAccount}
          >
            {updatingPassword
              ? isOAuthOnly
                ? "Saving..."
                : "Updating..."
              : isOAuthOnly
              ? "Set password"
              : "Update password"}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {!loadingAccount && !isOAuthOnly && (
            <Field
              label="Current password"
              type={pwType}
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
              placeholder="••••••••"
              onEnter={handleUpdatePassword}
              tokens={tokens}
            />
          )}

          <div>
            <Field
              label={isOAuthOnly ? "Password" : "New password"}
              type={pwType}
              value={next}
              onChange={setNext}
              autoComplete="new-password"
              placeholder="••••••••"
              onEnter={handleUpdatePassword}
              tokens={tokens}
              trailing={trailing}
            />

            {next && (
              <div className="mt-2.5" aria-live="polite">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((level) => (
                    <span
                      key={level}
                      className={cx(
                        "h-1 flex-1 rounded-full transition-colors",
                        level <= score ? STRENGTH_COLORS[score] : tokens.track
                      )}
                    />
                  ))}
                </div>
                <span className={cx("mt-1 block text-[12px]", tokens.subtle)}>
                  {STRENGTH_LABELS[score]}
                </span>
              </div>
            )}
          </div>

          <Field
            label="Confirm password"
            type={pwType}
            value={confirmNext}
            onChange={setConfirmNext}
            autoComplete="new-password"
            placeholder="••••••••"
            error={mismatch ? "Passwords do not match" : undefined}
            onEnter={handleUpdatePassword}
            tokens={tokens}
          />
        </div>

        {isOAuthOnly && providerLabel && (
          <p className={cx("pt-4 text-[12.5px] leading-relaxed", tokens.body)}>
            You can still sign in with {providerLabel}. To manage that account,
            open your{" "}
            <a
              href={
                provider === "google"
                  ? "https://myaccount.google.com/security"
                  : "https://github.com/settings/security"
              }
              target="_blank"
              rel="noreferrer noopener"
              className={cx(
                "font-medium underline underline-offset-2",
                tokens.link
              )}
            >
              {providerLabel} security settings
            </a>
            .
          </p>
        )}
      </SectionCard>
    </>
  );
}

/* ── Appearance ── */

function ThemePreview({ dark }: { dark: boolean }) {
  const frame = dark
    ? "border-white/10 bg-[#0b0b0c]"
    : "border-neutral-200 bg-[#f3f1ed]";
  const side = dark ? "bg-white/[0.06]" : "bg-black/[0.05]";
  const line = dark ? "bg-white/15" : "bg-neutral-400/40";
  const faint = dark ? "bg-white/[0.08]" : "bg-neutral-400/25";
  const accent = dark ? "bg-white" : "bg-neutral-900";

  return (
    <div
      className={cx(
        "flex h-24 w-full overflow-hidden rounded-[8px] border",
        frame
      )}
    >
      <div className={cx("h-full w-1/4 space-y-1.5 p-2", side)}>
        <div className={cx("h-1.5 w-full rounded-full", line)} />
        <div className={cx("h-1.5 w-2/3 rounded-full", faint)} />
        <div className={cx("h-1.5 w-3/4 rounded-full", faint)} />
      </div>
      <div className="flex-1 space-y-1.5 p-2.5">
        <div className={cx("h-2.5 w-1/2 rounded-full", line)} />
        <div className={cx("h-1.5 w-5/6 rounded-full", faint)} />
        <div className={cx("h-1.5 w-2/3 rounded-full", faint)} />
        <div className={cx("mt-2 h-3.5 w-10 rounded-[4px]", accent)} />
      </div>
    </div>
  );
}

function AppearanceSection({
  tokens,
  isDark,
  setTheme,
}: {
  tokens: Tokens;
  isDark: boolean;
  setTheme: (t: "light" | "dark", origin?: { x: number; y: number }) => void;
}) {
  const options: { key: "light" | "dark"; label: string }[] = [
    { key: "light", label: "Light" },
    { key: "dark", label: "Dark" },
  ];

  const selected = isDark ? "dark" : "light";

  const [reduceMotion, setReduceMotion] = usePref(
    "reduceMotion",
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [compact, setCompact] = usePref("compact", false);

  return (
    <SectionCard
      title="Appearance"
      description="Customize how the interface looks on this device."
      tokens={tokens}
    >
      <div className="pb-5">
        <p className={cx("mb-2.5 text-[13px] font-medium", tokens.label)}>
          Theme
        </p>

        <div
          role="radiogroup"
          aria-label="Theme"
          className="grid gap-3 sm:grid-cols-2"
        >
          {options.map((option) => {
            const isActive = selected === option.key;

            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={(e) =>
                  setTheme(option.key, { x: e.clientX, y: e.clientY })
                }
                className={cx(
                  "relative flex flex-col rounded-[14px] border p-3 text-left transition",
                  tokens.ring,
                  tokens.card,
                  isActive
                    ? "border-neutral-400 ring-2 ring-neutral-400/30"
                    : tokens.cardBorder
                )}
              >
                <ThemePreview dark={option.key === "dark"} />

                <span
                  className={cx(
                    "mt-2.5 text-[13px] font-medium",
                    isActive ? tokens.heading : tokens.body
                  )}
                >
                  {option.label}
                </span>

                {isActive && (
                  <span className="absolute top-5 right-5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Row
        title="Reduce motion"
        description="Disable non-essential animations across the app."
        tokens={tokens}
      >
        <Toggle
          checked={reduceMotion}
          onChange={setReduceMotion}
          label="Reduce motion"
          tokens={tokens}
        />
      </Row>

      <Row
        title="Compact mode"
        description="Show more content with tighter spacing."
        tokens={tokens}
      >
        <Toggle
          checked={compact}
          onChange={setCompact}
          label="Compact mode"
          tokens={tokens}
        />
      </Row>
    </SectionCard>
  );
}

/* ── Notifications ── */

const NOTIFICATION_ITEMS: {
  key: string;
  title: string;
  description: string;
}[] = [
  {
    key: "productUpdates",
    title: "Product updates",
    description: "New features, improvements, and release notes.",
  },
  {
    key: "securityAlerts",
    title: "Security alerts",
    description:
      "Sign-ins from new devices and password changes. Recommended.",
  },
  {
    key: "mentions",
    title: "Mentions",
    description: "When someone mentions you in a comment or thread.",
  },
  {
    key: "weeklyDigest",
    title: "Weekly digest",
    description: "A summary of activity in your workspace, every Monday.",
  },
  {
    key: "marketing",
    title: "Marketing",
    description: "Tips, offers, and occasional product news.",
  },
];

function NotificationsSection({
  tokens,
  notify,
}: {
  tokens: Tokens;
  notify: Notify;
}) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    productUpdates: true,
    securityAlerts: true,
    weeklyDigest: false,
    mentions: true,
    marketing: false,
  });

  const saved = useRef(prefs);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved.current);

  const save = () => {
    saved.current = prefs;
    setPrefs({ ...prefs });
    notify("Preferences saved");
  };

  return (
    <SectionCard
      title="Notifications"
      description="Choose what we should email you about."
      tokens={tokens}
      footer={
        <>
          {dirty && (
            <span className={cx("text-[12.5px]", tokens.subtle)}>
              Unsaved changes
            </span>
          )}
          <Button tokens={tokens} onClick={save} disabled={!dirty}>
            Save preferences
          </Button>
        </>
      }
    >
      {NOTIFICATION_ITEMS.map((item) => (
        <Row
          key={item.key}
          title={item.title}
          description={item.description}
          tokens={tokens}
        >
          <Toggle
            checked={prefs[item.key]}
            onChange={(value) =>
              setPrefs((prev) => ({ ...prev, [item.key]: value }))
            }
            label={item.title}
            tokens={tokens}
          />
        </Row>
      ))}
    </SectionCard>
  );
}

/* ── Billing ── */

function BillingSection({
  tokens,
  notify,
}: {
  tokens: Tokens;
  notify: Notify;
}) {
  const soon = () => notify("Billing isn't available yet", "error");

  return (
    <>
      <SectionCard
        title="Plan"
        description="You're currently on a free trial."
        tokens={tokens}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className={cx("text-[14px] font-medium", tokens.heading)}>
                Pro trial
              </p>
              <span
                className={cx(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  tokens.warn
                )}
              >
                Ends Oct 19, 2026
              </span>
            </div>
            <p className={cx("mt-0.5 text-[12.5px]", tokens.body)}>
              No card on file.
            </p>
          </div>

          <Button tokens={tokens} onClick={soon}>
            Upgrade plan
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Payment method"
        description="Cards are only charged when a paid plan is active."
        tokens={tokens}
      >
        <div className="flex items-center justify-between gap-3">
          <p className={cx("text-[13px]", tokens.body)}>
            No payment method on file.
          </p>
          <Button
            tokens={tokens}
            variant="secondary"
            onClick={soon}
            className="!px-3.5 !py-2 !font-medium"
          >
            Add card
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Invoices"
        description="Download past receipts."
        tokens={tokens}
      >
        <p className={cx("text-[13px]", tokens.body)}>No invoices yet.</p>
      </SectionCard>
    </>
  );
}

/* ── Utils · Tags ── */

const TAG_COLORS = [
  "bg-fuchsia-500",
  "bg-red-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-teal-500",
];

type Tag = { id: string; label: string; color: string };

const INITIAL_TAGS: Tag[] = [
  { id: "vip", label: "VIP", color: TAG_COLORS[0] },
  { id: "urgent", label: "Urgent", color: TAG_COLORS[1] },
  { id: "bug", label: "Bug", color: TAG_COLORS[2] },
  { id: "feature", label: "Feature", color: TAG_COLORS[3] },
];

function TagsSection({
  tokens,
  notify,
  isDark,
}: {
  tokens: Tokens;
  notify: Notify;
  isDark: boolean;
}) {
  const [tags, setTags] = useState<Tag[]>(INITIAL_TAGS);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [draft, setDraft] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const filtered = tags.filter((t) =>
    t.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setDraft("");
    setColor(TAG_COLORS[0]);
    setModalOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setEditing(tag);
    setDraft(tag.label);
    setColor(tag.color);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSave = () => {
    const label = draft.trim();
    if (!label) return notify("Enter a tag name", "error");

    const duplicate = tags.some(
      (t) => t.label.toLowerCase() === label.toLowerCase() && t.id !== editing?.id
    );
    if (duplicate) return notify("Tag already exists", "error");

    if (editing) {
      setTags((prev) =>
        prev.map((t) => (t.id === editing.id ? { ...t, label, color } : t))
      );
      notify("Tag updated");
    } else {
      setTags((prev) => [...prev, { id: uid(), label, color }]);
      notify("Tag created");
    }
    closeModal();
  };

  const handleDelete = (id: string) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
    setMenuOpenId(null);
    notify("Tag deleted");
  };

  const duplicateTag = (tag: Tag) => {
    setTags((prev) => [
      ...prev,
      { id: uid(), label: `${tag.label} copy`, color: tag.color },
    ]);
    setMenuOpenId(null);
    notify("Tag duplicated");
  };

  const iconBtn = cx(
    "flex h-8 w-8 items-center justify-center rounded-md transition",
    tokens.subtle,
    tokens.ghostHover,
    tokens.ring
  );

  return (
    <>
      {/* Header : description + bouton New Tag */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={cx("text-[13.5px] leading-relaxed", tokens.body)}>
          Tags are visible to everyone in your organization.{" "}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className={cx(
              "font-medium underline underline-offset-2 transition-opacity hover:opacity-80",
              tokens.link
            )}
          >
            Learn more ↗
          </a>
        </p>

        <div className="sm:shrink-0">
          <Button tokens={tokens} onClick={openCreate}>
            + New Tag
          </Button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-neutral-500">
          <SearchIcon className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tags..."
          className={cx(
            "w-full rounded-[10px] border py-3 pr-3.5 pl-10 text-[14px] outline-none transition",
            tokens.inputBg,
            tokens.inputText,
            tokens.placeholder,
            tokens.inputBorder,
            tokens.inputFocus
          )}
        />
      </div>

      {/* Liste des tags */}
      {filtered.length === 0 ? (
        <div
          className={cx(
            "rounded-2xl border py-8 text-center text-[13px]",
            tokens.card,
            tokens.cardBorder,
            tokens.body
          )}
        >
          {tags.length === 0 ? "No tags yet." : "No tags found."}
        </div>
      ) : (
        <div
          className={cx(
            "rounded-2xl border divide-y",
            tokens.card,
            tokens.cardBorder,
            tokens.divide
          )}
        >
          {filtered.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-3 px-4 py-3.5"
            >
              <span className={cx("h-3.5 w-3.5 shrink-0 rounded-full", tag.color)} />
              <span
                className={cx(
                  "flex-1 truncate text-[14px] font-medium",
                  tokens.heading
                )}
              >
                {tag.label}
              </span>

              <button
                type="button"
                onClick={() => openEdit(tag)}
                className={iconBtn}
                aria-label={`Edit ${tag.label}`}
              >
                <PencilIcon />
              </button>

              <button
                type="button"
                onClick={() => handleDelete(tag.id)}
                className={cx(iconBtn, "hover:!text-red-400")}
                aria-label={`Delete ${tag.label}`}
              >
                <TrashIcon />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setMenuOpenId(menuOpenId === tag.id ? null : tag.id)
                  }
                  className={iconBtn}
                  aria-label={`More options for ${tag.label}`}
                >
                  <MoreIcon />
                </button>

                {menuOpenId === tag.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpenId(null)}
                    />
                    <div
                      className={cx(
                        "absolute top-full right-0 z-20 mt-1 min-w-[140px] overflow-hidden rounded-lg border py-1 shadow-lg",
                        tokens.card,
                        tokens.cardBorder
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => duplicateTag(tag)}
                        className={cx(
                          "block w-full px-3 py-2 text-left text-[13px]",
                          tokens.heading,
                          tokens.ghostHover
                        )}
                      >
                        Duplicate
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de création / édition */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "Edit Tag" : "New Tag"}
        description={
          editing
            ? "Update this tag's name or color."
            : "Create a tag to organize and filter your items."
        }
        dark={isDark}
      >
        <div className="flex flex-col gap-4">
          <Field
            label="Tag name"
            value={draft}
            onChange={setDraft}
            placeholder="e.g. Design"
            onEnter={handleSave}
            autoFocus
            tokens={tokens}
          />

          <div>
            <p className={cx("mb-2 text-[13px] font-medium", tokens.label)}>
              Color
            </p>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use color ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cx(
                    "flex h-8 w-8 items-center justify-center rounded-full transition",
                    c,
                    color === c
                      ? "scale-110 ring-2 ring-white/70 ring-offset-2 ring-offset-transparent"
                      : "opacity-70 hover:opacity-100"
                  )}
                >
                  {color === c && <CheckIcon className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className={cx("flex justify-end gap-2 border-t pt-4", tokens.cardBorder)}>
            <Button tokens={tokens} variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button tokens={tokens} onClick={handleSave} disabled={!draft.trim()}>
              {editing ? "Save changes" : "Create tag"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ── Utils · Saved replies ── */

type SavedReply = {
  id: string;
  name: string;
  content: string;
};

function SavedRepliesSection({
  tokens,
  notify,
  isDark,
}: {
  tokens: Tokens;
  notify: Notify;
  isDark: boolean;
}) {
  const [replies, setReplies] = useState<SavedReply[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SavedReply | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  const openCreate = () => {
    setEditing(null);
    setName("");
    setContent("");
    setModalOpen(true);
  };

  const openEdit = (reply: SavedReply) => {
    setEditing(reply);
    setName(reply.name);
    setContent(reply.content);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (!name.trim() || !content.trim()) return;

    if (editing) {
      setReplies((prev) =>
        prev.map((r) =>
          r.id === editing.id
            ? { ...r, name: name.trim(), content: content.trim() }
            : r
        )
      );
      notify("Saved reply updated");
    } else {
      setReplies((prev) => [
        ...prev,
        { id: uid(), name: name.trim(), content: content.trim() },
      ]);
      notify("Saved reply created");
    }
    closeModal();
  };

  const handleDelete = (id: string) => {
    setReplies((prev) => prev.filter((r) => r.id !== id));
    notify("Saved reply deleted");
  };

  const iconBtn = cx(
    "flex h-8 w-8 items-center justify-center rounded-md transition",
    tokens.subtle,
    tokens.ghostHover,
    tokens.ring
  );

  const emptyCircle = isDark ? "bg-white/[0.05]" : "bg-neutral-100";

  return (
    <>
      <p className={cx("text-[13.5px] leading-relaxed", tokens.body)}>
        Saved Replies are visible to everyone in your organization.
      </p>

      {replies.length === 0 ? (
        /* État vide */
        <div className="flex flex-col items-center gap-5 py-16 text-center">
          <div
            className={cx(
              "flex h-24 w-24 items-center justify-center rounded-full",
              emptyCircle
            )}
          >
            <ClipboardIcon className="h-10 w-10 text-neutral-500" />
          </div>

          <p
            className={cx(
              "max-w-md text-[15px] leading-relaxed",
              tokens.heading
            )}
          >
            Save information you share often to quickly insert it to your
            replies.
          </p>

          <Button tokens={tokens} onClick={openCreate}>
            + New Saved Reply
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button tokens={tokens} onClick={openCreate}>
              + New Saved Reply
            </Button>
          </div>

          <div
            className={cx(
              "rounded-2xl border divide-y",
              tokens.card,
              tokens.cardBorder,
              tokens.divide
            )}
          >
            {replies.map((reply) => (
              <div
                key={reply.id}
                className="flex items-start justify-between gap-3 px-4 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={cx(
                      "text-[14px] font-medium",
                      tokens.heading
                    )}
                  >
                    {reply.name}
                  </p>
                  <p
                    className={cx(
                      "mt-1 text-[12.5px] leading-relaxed whitespace-pre-wrap",
                      tokens.body
                    )}
                  >
                    {reply.content}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(reply)}
                    className={iconBtn}
                    aria-label={`Edit ${reply.name}`}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(reply.id)}
                    className={cx(iconBtn, "hover:!text-red-400")}
                    aria-label={`Delete ${reply.name}`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de création / édition */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "Edit Saved Reply" : "New Saved Reply"}
        description={
          editing
            ? "Update this saved reply."
            : "Create a quick reply to use in your messages."
        }
        dark={isDark}
      >
        <div className="flex flex-col gap-4">
          <Field
            label="Name"
            value={name}
            onChange={setName}
            placeholder="e.g. Welcome message"
            autoFocus
            tokens={tokens}
          />

          <div className="flex flex-col gap-1.5">
            <span
              className={cx("text-[13px] font-medium", tokens.label)}
            >
              Content
            </span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your saved reply"
              rows={4}
              maxLength={1000}
              className={cx(
                "w-full resize-y rounded-[10px] border px-3.5 py-2.5 text-[14px] outline-none transition",
                tokens.inputBg,
                tokens.inputText,
                tokens.placeholder,
                tokens.inputBorder,
                tokens.inputFocus
              )}
            />
            <div className="flex justify-end">
              <span
                className={cx("text-[12px] tabular-nums", tokens.subtle)}
              >
                {content.length}/1000
              </span>
            </div>
          </div>

          <div className={cx("flex justify-end gap-2 border-t pt-4", tokens.cardBorder)}>
            <Button tokens={tokens} variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              tokens={tokens}
              onClick={handleSave}
              disabled={!name.trim() || !content.trim()}
            >
              {editing ? "Save changes" : "Save reply"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ── Danger zone ── */

function DangerSection({
  tokens,
  notify,
}: {
  tokens: Tokens;
  notify: Notify;
}) {
  const [confirm, setConfirm] = useState("");
  const canDelete = confirm.trim().toLowerCase() === "delete";

  const handleDelete = () => {
    if (!canDelete) return;
    notify("Account deletion is disabled in this demo", "error");
  };

  return (
    <>
      <SectionCard
        title="Export data"
        description="Download a copy of everything tied to your account."
        tokens={tokens}
      >
        <div className="flex items-center justify-between gap-3">
          <p className={cx("text-[13px]", tokens.body)}>
            You'll receive an email with a download link.
          </p>
          <Button
            tokens={tokens}
            variant="secondary"
            onClick={() => notify("Export requested")}
            className="!px-3.5 !py-2 !font-medium"
          >
            Request export
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Delete account"
        description="This permanently removes your account, workspace, and all data. This cannot be undone."
        tokens={tokens}
        danger
        footer={
          <Button
            tokens={tokens}
            variant="danger"
            disabled={!canDelete}
            onClick={handleDelete}
          >
            Delete my account
          </Button>
        }
      >
        <Field
          label='Type "delete" to confirm'
          value={confirm}
          onChange={setConfirm}
          placeholder="delete"
          onEnter={handleDelete}
          tokens={tokens}
        />
      </SectionCard>
    </>
  );
}