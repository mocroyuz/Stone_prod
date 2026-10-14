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

import {
  getCurrentUser,
  updateUserProfile,
  uploadAvatar,
  deleteAvatar,
  resendVerificationEmail,
  updatePassword,
  type UserProfile,
} from "../services/supabase";

/* ──────────────────────────────────────────────────────────────
   Theme tokens
   Toutes les classes sont écrites en entier (jamais construites
   dynamiquement) et n'utilisent que des valeurs arbitraires
   `/[0.08]` pour rester compatibles Tailwind v3 ET v4.
   Aucun variant `dark:` : tout dépend uniquement de `isDark`.
   ────────────────────────────────────────────────────────────── */

type Tokens = {
  pageBg: string;
  cardBg: string;
  cardBorder: string;
  cardDivide: string;
  sidebarBg: string;
  sidebarBorder: string;
  sidebarGroup: string;
  sidebarItem: string;
  sidebarItemHover: string;
  sidebarItemActive: string;
  sidebarBack: string;
  badgeNew: string;
  labelText: string;
  heading: string;
  body: string;
  subtle: string;
  link: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  inputFocus: string;
  primaryBg: string;
  secondaryBg: string;
  dangerBorder: string;
  dangerText: string;
  dangerSolid: string;
  toggleOff: string;
  toggleOn: string;
  toggleKnob: string;
  toast: string;
  avatarRing: string;
  eyeHover: string;
  badgeVerified: string;
  badgePending: string;
  previewDarkFrame: string;
  previewLightFrame: string;
};

const DARK_TOKENS: Tokens = {
  pageBg: "bg-[#050505]",
  cardBg: "bg-[#0a0a0a]",
  cardBorder: "border-white/[0.08]",
  cardDivide: "divide-white/[0.08]",
  sidebarBg: "bg-[#0a0a0a]",
  sidebarBorder: "border-white/[0.08]",
  sidebarGroup: "text-neutral-500",
  sidebarItem: "text-neutral-300",
  sidebarItemHover: "hover:bg-white/[0.05]",
  sidebarItemActive: "bg-white/[0.09] text-white",
  sidebarBack: "text-neutral-300 hover:bg-white/[0.06]",
  badgeNew: "bg-fuchsia-500/20 text-fuchsia-300",
  labelText: "text-neutral-300",
  heading: "text-white",
  body: "text-neutral-400",
  subtle: "text-neutral-500",
  link: "text-white",
  inputBg: "bg-[#111]",
  inputBorder: "border-white/10",
  inputText: "text-white",
  inputPlaceholder: "placeholder:text-neutral-500",
  inputFocus: "focus:border-neutral-500",
  primaryBg: "bg-white text-black hover:bg-neutral-200",
  secondaryBg:
    "border border-white/10 bg-transparent text-white hover:bg-white/[0.06]",
  dangerBorder: "border-white/30",
  dangerText: "text-white",
  dangerSolid: "bg-white text-black hover:bg-neutral-200",
  toggleOff: "bg-white/15",
  toggleOn: "bg-white",
  toggleKnob: "bg-black",
  toast: "border-white/10 bg-[#111] text-white",
  avatarRing: "ring-white/10",
  eyeHover: "hover:bg-white/10 hover:text-neutral-200",
  badgeVerified: "bg-emerald-500/15 text-emerald-300",
  badgePending: "bg-amber-500/15 text-amber-300",
  previewDarkFrame: "border-white/10 bg-[#0b0b0c]",
  previewLightFrame: "border-neutral-200 bg-[#f3f1ed]",
};

const LIGHT_TOKENS: Tokens = {
  pageBg: "bg-white",
  cardBg: "bg-white",
  cardBorder: "border-neutral-200",
  cardDivide: "divide-neutral-200",
  sidebarBg: "bg-[#f7f6f3]",
  sidebarBorder: "border-neutral-200",
  sidebarGroup: "text-neutral-500",
  sidebarItem: "text-neutral-700",
  sidebarItemHover: "hover:bg-black/[0.04]",
  sidebarItemActive: "bg-black/[0.07] text-neutral-900",
  sidebarBack: "text-neutral-700 hover:bg-black/[0.05]",
  badgeNew: "bg-fuchsia-100 text-fuchsia-700",
  labelText: "text-neutral-700",
  heading: "text-neutral-900",
  body: "text-neutral-600",
  subtle: "text-neutral-500",
  link: "text-neutral-900",
  inputBg: "bg-white",
  inputBorder: "border-neutral-300",
  inputText: "text-neutral-900",
  inputPlaceholder: "placeholder:text-neutral-400",
  inputFocus: "focus:border-neutral-500",
  primaryBg: "bg-neutral-900 text-white hover:bg-neutral-800",
  secondaryBg:
    "border border-neutral-300 bg-transparent text-neutral-900 hover:bg-neutral-100",
  dangerBorder: "border-neutral-300",
  dangerText: "text-neutral-900",
  dangerSolid: "bg-neutral-900 text-white hover:bg-neutral-800",
  toggleOff: "bg-neutral-300",
  toggleOn: "bg-neutral-900",
  toggleKnob: "bg-white",
  toast: "border-neutral-200 bg-white text-neutral-900",
  avatarRing: "ring-black/10",
  eyeHover: "hover:bg-neutral-200 hover:text-neutral-800",
  badgeVerified: "bg-emerald-50 text-emerald-700",
  badgePending: "bg-amber-50 text-amber-700",
  previewDarkFrame: "border-white/10 bg-[#0b0b0c]",
  previewLightFrame: "border-neutral-200 bg-[#f3f1ed]",
};

function buildTokens(isDark: boolean): Tokens {
  return isDark ? DARK_TOKENS : LIGHT_TOKENS;
}

/* ──────────────────────────────────────────────────────────────
   Icons
   ────────────────────────────────────────────────────────────── */

type IconProps = {
  className?: string;
};

const baseIcon = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const UserIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...baseIcon} className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

const SlidersIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...baseIcon} className={className}>
    <path d="M6 3v6M6 13v8M12 3v10M12 17v4M18 3v3M18 10v11" />
    <path d="M4 9h4M10 13h4M16 6h4" />
  </svg>
);

const SunIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...baseIcon} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const BellIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...baseIcon} className={className}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const BillingIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...baseIcon} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M14.8 9.2c-.4-.8-1.4-1.2-2.8-1.2-1.6 0-2.8.8-2.8 2s1 1.7 2.8 2 2.8.8 2.8 2-1.2 2-2.8 2c-1.4 0-2.4-.4-2.8-1.2M12 6.5V8M12 16v1.5" />
  </svg>
);

const AlertIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...baseIcon} className={className}>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
  </svg>
);

const ArrowLeftIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...baseIcon} strokeWidth={2} className={className}>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </svg>
);

const SidebarIcon = ({ className = "h-[18px] w-[18px]" }: IconProps) => (
  <svg {...baseIcon} className={className}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M9 3v18" />
  </svg>
);

const EyeIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...baseIcon} className={className}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...baseIcon} className={className}>
    <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

/* ──────────────────────────────────────────────────────────────
   Reusable UI
   ────────────────────────────────────────────────────────────── */

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
  tokens: Tokens;
}) {
  return (
    <label className="block">
      <span
        className={`mb-1.5 block text-[clamp(11.5px,0.95vw,13px)] font-medium ${tokens.labelText}`}
      >
        {label}
      </span>

      <div className="relative">
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full rounded-[9px] border px-3.5 py-[clamp(9px,0.9vw,12px)] text-[clamp(12.5px,1vw,14px)] outline-none transition ${tokens.inputBg} ${tokens.inputText} ${tokens.inputPlaceholder} ${tokens.inputFocus} ${
            trailing ? "pr-10" : ""
          } ${error ? "border-red-500" : tokens.inputBorder}`}
        />

        {trailing && (
          <span
            className={`absolute top-1/2 right-2 -translate-y-1/2 ${tokens.subtle}`}
          >
            {trailing}
          </span>
        )}
      </div>

      {error ? (
        <span className="mt-1 block text-[11px] text-red-500">{error}</span>
      ) : hint ? (
        <span className={`mt-1 block text-[11px] ${tokens.subtle}`}>
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
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition ${
        checked ? tokens.toggleOn : tokens.toggleOff
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full shadow transition ${
          checked ? tokens.toggleKnob : "bg-white"
        } ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`}
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
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className={`text-[13.5px] font-medium ${tokens.heading}`}>
          {title}
        </p>

        {description && (
          <p className={`mt-0.5 text-[12px] leading-relaxed ${tokens.body}`}>
            {description}
          </p>
        )}
      </div>

      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  tokens,
  danger,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  tokens: Tokens;
  danger?: boolean;
}) {
  return (
    <section
      className={`border-b pb-[clamp(20px,2.4vw,32px)] transition-colors duration-300 last:border-b-0 last:pb-0 ${
        danger ? tokens.dangerBorder : tokens.cardBorder
      }`}
    >
      <header className="mb-2">
        <h3
          className={`font-display text-[clamp(15px,1.2vw,17px)] font-semibold tracking-[-0.01em] ${
            danger ? tokens.dangerText : tokens.heading
          }`}
        >
          {title}
        </h3>

        {description && (
          <p className={`mt-1 text-[12px] leading-relaxed ${tokens.body}`}>
            {description}
          </p>
        )}
      </header>

      <div className={`divide-y ${tokens.cardDivide}`}>{children}</div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Sidebar
   Colonne pleine hauteur : retour + titre, puis groupes de
   sections (Account / Organization / Other).
   ────────────────────────────────────────────────────────────── */

type SectionKey =
  | "profile"
  | "account"
  | "appearance"
  | "notifications"
  | "billing"
  | "danger";

type SidebarItem = {
  key: SectionKey;
  label: string;
  icon: ReactNode;
  badge?: string;
};

type SidebarGroup = {
  label: string;
  items: SidebarItem[];
};

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Account",
    items: [
      { key: "profile", label: "Profile", icon: <UserIcon /> },
      { key: "account", label: "Security", icon: <SlidersIcon /> },
      { key: "notifications", label: "Notifications", icon: <BellIcon /> },
    ],
  },
  {
    label: "Organization",
    items: [{ key: "billing", label: "Billing", icon: <BillingIcon /> }],
  },
  {
    label: "Other",
    items: [
      {
        key: "appearance",
        label: "Appearance",
        icon: <SunIcon />,
        badge: "New",
      },
      { key: "danger", label: "Danger zone", icon: <AlertIcon /> },
    ],
  },
];

const SIDEBAR_STORAGE_KEY = "settings:sidebar-collapsed";

const SECTION_TITLES: Record<SectionKey, string> = {
  profile: "Profile",
  account: "Security",
  appearance: "Appearance",
  notifications: "Notifications",
  billing: "Billing",
  danger: "Danger zone",
};

function SettingsSidebar({
  active,
  onSelect,
  onBack,
  collapsed,
  onToggleCollapsed,
  tokens,
}: {
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  onBack: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  tokens: Tokens;
}) {
  /*
   * Le repli ne s'applique qu'à partir de `md` (sur mobile la barre est
   * horizontale et reste toujours ouverte) : toutes les classes liées à
   * `collapsed` sont donc préfixées par `md:`.
   *
   * Animation : la largeur s'anime avec une courbe ease-in-out ; les
   * textes s'effacent en fondu (avec un léger délai à la réouverture
   * pour apparaître une fois la barre assez large).
   */
  const ease = "ease-[cubic-bezier(0.4,0,0.2,1)]";

  const fade = collapsed
    ? "opacity-100 md:opacity-0"
    : "opacity-100 delay-100 motion-reduce:delay-0";

  const itemBase =
    "flex h-10 w-full items-center gap-3 rounded-[10px] px-[11px] text-left text-[14px] font-medium whitespace-nowrap transition-colors";

  return (
    <aside
      data-collapsed={collapsed}
      className={`flex shrink-0 flex-col border-r transition-[width,background-color] duration-300 ${ease} motion-reduce:transition-none max-md:w-full max-md:border-r-0 max-md:border-b md:sticky md:top-0 md:h-screen md:overflow-x-hidden md:overflow-y-auto ${
        collapsed ? "md:w-[64px]" : "md:w-[216px]"
      } ${tokens.sidebarBg} ${tokens.sidebarBorder}`}
    >
      {/* Back + title */}

      <div className="flex items-center gap-2.5 px-3 pt-5 pb-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to home"
          title="Back to home"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${tokens.sidebarBack}`}
        >
          <ArrowLeftIcon />
        </button>

        <h2
          className={`font-display text-[17px] font-semibold tracking-[-0.01em] whitespace-nowrap transition-opacity duration-200 motion-reduce:transition-none ${fade} ${tokens.heading}`}
        >
          Settings
        </h2>
      </div>

      {/* Groups */}

      <nav aria-label="Settings sections" className="px-3 pb-4">
        {SIDEBAR_GROUPS.map((group, index) => (
          <div
            key={group.label}
            className={`transition-[margin] duration-300 ${ease} motion-reduce:transition-none ${
              index === 0 ? "mt-1" : collapsed ? "mt-5 md:mt-2" : "mt-5"
            }`}
          >
            {/* Séparateur visible uniquement quand la barre est repliée */}

            {index > 0 && (
              <div
                aria-hidden="true"
                className={`mx-2 mb-2 border-t transition-opacity duration-300 motion-reduce:transition-none max-md:hidden ${
                  tokens.sidebarBorder
                } ${collapsed ? "opacity-100" : "opacity-0"}`}
              />
            )}

            <p
              className={`overflow-hidden px-3 text-[12px] whitespace-nowrap transition-all duration-300 ${ease} motion-reduce:transition-none ${
                collapsed
                  ? "mb-1.5 h-[18px] opacity-100 md:mb-0 md:h-0 md:opacity-0"
                  : "mb-1.5 h-[18px] opacity-100"
              } ${tokens.sidebarGroup}`}
            >
              {group.label}
            </p>

            <ul className="flex flex-col gap-0.5 max-md:flex-row max-md:flex-wrap">
              {group.items.map((item) => {
                const isActive = active === item.key;

                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.key)}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      title={collapsed ? item.label : undefined}
                      className={[
                        itemBase,
                        isActive
                          ? tokens.sidebarItemActive
                          : `${tokens.sidebarItem} ${tokens.sidebarItemHover}`,
                      ].join(" ")}
                    >
                      <span className="shrink-0">{item.icon}</span>

                      <span
                        className={`min-w-0 flex-1 truncate transition-opacity duration-200 motion-reduce:transition-none ${fade}`}
                      >
                        {item.label}
                      </span>

                      {item.badge && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium transition-opacity duration-200 motion-reduce:transition-none ${fade} ${tokens.badgeNew}`}
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

      {/* Bouton de repli (desktop uniquement) */}

      <div className="mt-auto px-3 pb-4 max-md:hidden">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors ${tokens.sidebarItem} ${tokens.sidebarItemHover}`}
        >
          <SidebarIcon />
        </button>
      </div>
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────── */

/*
 * Les props sont conservées uniquement pour rester compatible avec
 * <Settings theme=... onToggleTheme=... />, mais elles ne sont plus
 * nécessaires : le composant lit et modifie le thème via useTheme().
 */
type SettingsProps = {
  theme?: Theme;
  onToggleTheme?: () => void;
};

export default function Settings(_props: SettingsProps) {
  const { theme, toggle } = useTheme();

  const isDark = theme === "dark";

  const tokens = useMemo(() => buildTokens(isDark), [isDark]);

  const [active, setActive] = useState<SectionKey>("profile");

  /* Sidebar repliée ? Mémorisé dans localStorage (avec try/catch). */
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* stockage indisponible : on ignore */
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => !value);
  }, []);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  /*
   * `notify` doit rester stable (useCallback) : les sections l'ont en
   * dépendance de leur useEffect de chargement. Une identité qui change
   * à chaque rendu déclencherait un rechargement à chaque toast.
   */
  const notify = useCallback((message: string) => {
    setToast(message);

    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current);
    }

    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 2400);
  }, []);

  /* Nettoyage du timer au démontage. */
  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

  /*
   * Choix explicite du thème : on ne bascule que si le thème demandé
   * est différent du thème courant.
   */
  const handleSelectTheme = useCallback(
    (next: "light" | "dark", origin?: { x: number; y: number }) => {
      if (next !== theme) {
        toggle(origin);
      }
    },
    [theme, toggle]
  );

  const handleBack = useCallback(() => navigate("home"), []);

  return (
    <main
      className={`min-h-screen w-full transition-colors duration-500 ${tokens.pageBg}`}
    >
      <div className="flex w-full max-md:flex-col">
        <SettingsSidebar
          active={active}
          onSelect={setActive}
          onBack={handleBack}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          tokens={tokens}
        />

        {/* Content */}

        <div className="mx-auto w-full max-w-[820px] min-w-0 flex-1 px-[clamp(16px,4vw,48px)] py-[clamp(28px,4vw,56px)]">
          <h1
            className={`mb-[clamp(20px,2.4vw,32px)] font-display text-[clamp(24px,2.6vw,34px)] font-semibold tracking-[-0.02em] ${tokens.heading}`}
          >
            {SECTION_TITLES[active]}
          </h1>

          <div className="flex flex-col gap-[clamp(16px,1.8vw,22px)]">
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

            {active === "billing" && <BillingSection tokens={tokens} />}

            {active === "danger" && (
              <DangerSection tokens={tokens} notify={notify} />
            )}
          </div>
        </div>
      </div>

      {/* Toast */}

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-30 -translate-x-1/2">
          <div
            role="status"
            className={`rounded-full border px-4 py-2.5 text-[12.5px] font-medium shadow-lg backdrop-blur ${tokens.toast}`}
          >
            {toast}
          </div>
        </div>
      )}
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────
   Profile
   ────────────────────────────────────────────────────────────── */

function ProfileSection({
  tokens,
  notify,
}: {
  tokens: Tokens;
  notify: (m: string) => void;
}) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  /* L'image a-t-elle échoué à charger ? Permet de retomber sur les
     initiales au lieu de laisser un espace vide invisible. */
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadUserProfile = async () => {
      try {
        const userData = await getCurrentUser();

        if (!mounted) return;

        if (userData) {
          setUser(userData);
          setFirst(userData.first_name || "");
          setLast(userData.last_name || "");
          setBio(userData.bio || "");

          /* On reflète directement la valeur renvoyée par le serveur. */
          setAvatarUrl(userData.avatar_url || null);
          setAvatarLoadFailed(false);
        }
      } catch (error) {
        console.error("Error loading user profile:", error);

        if (mounted) {
          notify("Failed to load profile");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadUserProfile();

    return () => {
      mounted = false;
    };
  }, [notify]);

  /* ─────────────────────────────────────────────
     Upload avatar
     ───────────────────────────────────────────── */

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !user) {
      return;
    }

    /* Reset input so the same file can be selected again */
    event.target.value = "";

    /* Max 2 MB */
    if (file.size > 2 * 1024 * 1024) {
      notify("File size must be less than 2MB");
      return;
    }

    /* Image only */
    if (!file.type.startsWith("image/")) {
      notify("File must be an image");
      return;
    }

    setUploading(true);

    const previousAvatar = avatarUrl;

    try {
      /* Upload the new image first. */
      const publicUrl = await uploadAvatar(file, user.id);

      if (!publicUrl) {
        notify("Failed to upload image");
        return;
      }

      /* Immediately update the UI. */
      setAvatarUrl(publicUrl);
      setAvatarLoadFailed(false);

      /* Save the new URL in Supabase Auth metadata. */
      const success = await updateUserProfile({
        avatar_url: publicUrl,
      });

      if (!success) {
        /* If metadata update fails, restore the old avatar in the UI. */
        setAvatarUrl(previousAvatar);

        notify("Image uploaded but profile update failed");

        return;
      }

      /* New avatar saved: remove the old one to avoid duplicates. */
      if (previousAvatar && previousAvatar !== publicUrl) {
        try {
          await deleteAvatar(previousAvatar);
        } catch (deleteError) {
          console.warn("Old avatar could not be deleted:", deleteError);
        }
      }

      setUser((current) =>
        current ? { ...current, avatar_url: publicUrl } : current
      );

      notify("Profile picture updated");
    } catch (error) {
      console.error("Error uploading avatar:", error);

      setAvatarUrl(previousAvatar);

      notify(
        error instanceof Error ? error.message : "Failed to upload image"
      );
    } finally {
      setUploading(false);
    }
  };

  /* ─────────────────────────────────────────────
     Remove avatar
     ───────────────────────────────────────────── */

  const handleRemoveAvatar = async () => {
    if (!user || !avatarUrl || uploading) {
      return;
    }

    setUploading(true);

    try {
      /* Pass the complete public URL; deleteAvatar() extracts the path. */
      await deleteAvatar(avatarUrl);

      /* Remove avatar from Auth metadata. */
      const success = await updateUserProfile({
        avatar_url: "",
      });

      if (!success) {
        notify("Avatar deleted but profile update failed");
        return;
      }

      setAvatarUrl(null);
      setAvatarLoadFailed(false);

      setUser((current) =>
        current ? { ...current, avatar_url: undefined } : current
      );

      notify("Profile picture removed");
    } catch (error) {
      console.error("Error removing avatar:", error);

      notify(
        error instanceof Error
          ? error.message
          : "Failed to remove profile picture"
      );
    } finally {
      setUploading(false);
    }
  };

  /* ─────────────────────────────────────────────
     Save profile
     ───────────────────────────────────────────── */

  const handleSave = async () => {
    if (!user || saving) return;

    setSaving(true);

    try {
      const success = await updateUserProfile({
        first_name: first.trim(),
        last_name: last.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl || undefined,
      });

      if (!success) {
        notify("Failed to save profile");
        return;
      }

      setUser({
        ...user,
        first_name: first.trim(),
        last_name: last.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl || undefined,
      });

      notify("Profile saved");
    } catch (error) {
      console.error("Error saving profile:", error);

      notify(
        error instanceof Error ? error.message : "Failed to save profile"
      );
    } finally {
      setSaving(false);
    }
  };

  /* ─────────────────────────────────────────────
     Loading
     ───────────────────────────────────────────── */

  if (loading) {
    return (
      <SectionCard
        title="Profile"
        description="This information is visible to your teammates."
        tokens={tokens}
      >
        <div className="flex items-center justify-center py-8">
          <div className={`text-[13px] ${tokens.body}`}>
            Loading profile...
          </div>
        </div>
      </SectionCard>
    );
  }

  /* ─────────────────────────────────────────────
     Not signed in
     ───────────────────────────────────────────── */

  if (!user) {
    return (
      <SectionCard
        title="Profile"
        description="This information is visible to your teammates."
        tokens={tokens}
      >
        <div className="flex items-center justify-center py-8">
          <div className={`text-[13px] ${tokens.body}`}>
            Please sign in to view your profile
          </div>
        </div>
      </SectionCard>
    );
  }

  const initials =
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "U";

  const showImage = Boolean(avatarUrl) && !avatarLoadFailed;

  return (
    <SectionCard
      title="Profile"
      description="This information is visible to your teammates."
      tokens={tokens}
    >
      {/* Avatar */}

      <div className="flex flex-col gap-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {showImage ? (
            <img
              key={avatarUrl}
              src={avatarUrl!}
              alt="Profile"
              className={`h-14 w-14 shrink-0 rounded-full object-cover ring-1 ${tokens.avatarRing}`}
              onError={() => setAvatarLoadFailed(true)}
            />
          ) : (
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[17px] font-semibold ${tokens.primaryBg}`}
            >
              {initials}
            </div>
          )}

          <div>
            <p className={`text-[13px] font-medium ${tokens.heading}`}>
              Profile picture
            </p>

            <p className={`mt-0.5 text-[11.5px] ${tokens.body}`}>
              PNG, JPG, GIF or WebP, up to 2 MB.
            </p>
          </div>
        </div>

        {/* Avatar buttons */}

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={handleFileUpload}
            className="hidden"
            id="avatar-upload"
            disabled={uploading}
          />

          <label
            htmlFor="avatar-upload"
            className={[
              "rounded-[9px] px-3.5 py-2 text-[12.5px] font-medium transition",
              uploading ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              tokens.secondaryBg,
            ].join(" ")}
          >
            {uploading ? "Uploading..." : avatarUrl ? "Change" : "Upload"}
          </label>

          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={uploading}
              className={`rounded-[9px] px-3.5 py-2 text-[12.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${tokens.secondaryBg}`}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Name */}

      <div className="grid gap-3 pt-4 sm:grid-cols-2">
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

      {/* Bio */}

      <div className="pt-4">
        <label className="block">
          <span
            className={`mb-1.5 block text-[clamp(11.5px,0.95vw,13px)] font-medium ${tokens.labelText}`}
          >
            Bio
          </span>

          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={3}
            maxLength={160}
            placeholder="A short line about you"
            className={`w-full resize-none rounded-[9px] border px-3.5 py-2.5 text-[13px] outline-none transition ${tokens.inputBg} ${tokens.inputText} ${tokens.inputPlaceholder} ${tokens.inputFocus} ${tokens.inputBorder}`}
          />

          <span className={`mt-1 block text-[11px] ${tokens.subtle}`}>
            {bio.length}/160
          </span>
        </label>
      </div>

      {/* Save */}

      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploading}
          className={`rounded-[9px] px-4 py-2.5 text-[12.5px] font-semibold transition ${
            saving || uploading
              ? "cursor-not-allowed opacity-50"
              : tokens.primaryBg
          }`}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </SectionCard>
  );
}

/* ──────────────────────────────────────────────────────────────
   Account (Security)
   ────────────────────────────────────────────────────────────── */

function AccountSection({
  tokens,
  notify,
}: {
  tokens: Tokens;
  notify: (m: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [verified, setVerified] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  /* Provider d'authentification ("email" | "google" | "github"…). */
  const [provider, setProvider] = useState<string>("email");

  /*
   * Le compte a-t-il déjà un mot de passe ?
   *  - true  → formulaire "Change password" (mot de passe actuel requis)
   *  - false → compte OAuth : formulaire "Set a password" (nouveau seulement)
   */
  const [hasPassword, setHasPassword] = useState(true);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNext, setConfirmNext] = useState("");
  const [show, setShow] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadAccount = async () => {
      try {
        const userData = await getCurrentUser();

        if (!mounted) return;

        if (userData) {
          setEmail(userData.email || "");
          setVerified(Boolean(userData.email_confirmed_at));
          setProvider(userData.provider ?? "email");
          setHasPassword(
            userData.hasPassword !== undefined ? userData.hasPassword : true
          );
        }
      } catch (error) {
        console.error("Error loading account details:", error);

        if (mounted) {
          notify("Failed to load account details");
        }
      } finally {
        if (mounted) {
          setLoadingAccount(false);
        }
      }
    };

    loadAccount();

    return () => {
      mounted = false;
    };
  }, [notify]);

  /* ─────────────────────────────────────────────
     Resend verification email
     ───────────────────────────────────────────── */

  const handleSendVerification = async () => {
    if (loadingAccount || verified || sendingVerification) {
      return;
    }

    setSendingVerification(true);

    try {
      const success = await resendVerificationEmail();

      notify(
        success
          ? "Verification email sent"
          : "Failed to send verification email"
      );
    } catch (error) {
      console.error("Error sending verification email:", error);

      notify(
        error instanceof Error
          ? error.message
          : "Failed to send verification email"
      );
    } finally {
      setSendingVerification(false);
    }
  };

  /* ─────────────────────────────────────────────
     Update / set password
     ───────────────────────────────────────────── */

  const handleUpdatePassword = async () => {
    if (updatingPassword || loadingAccount) {
      return;
    }

    if (hasPassword && !current) {
      notify("Enter your current password");
      return;
    }

    if (!next) {
      notify(hasPassword ? "Enter a new password" : "Enter a password");
      return;
    }

    if (next.length < 8) {
      notify("Password must be at least 8 characters");
      return;
    }

    if (hasPassword && next === current) {
      notify("New password must be different from the current one");
      return;
    }

    if (!hasPassword && next !== confirmNext) {
      notify("Passwords do not match");
      return;
    }

    setUpdatingPassword(true);

    try {
      /* Compte OAuth : pas de mot de passe actuel à envoyer. */
      await updatePassword(hasPassword ? current : null, next);

      const wasSetting = !hasPassword;

      setCurrent("");
      setNext("");
      setConfirmNext("");

      /* Après la définition, le compte a maintenant un mot de passe. */
      setHasPassword(true);

      notify(wasSetting ? "Password set" : "Password updated");
    } catch (error) {
      console.error("Error updating password:", error);

      notify(
        error instanceof Error ? error.message : "Failed to update password"
      );
    } finally {
      setUpdatingPassword(false);
    }
  };

  const trailing = (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => setShow((value) => !value)}
      aria-label={show ? "Hide password" : "Show password"}
      title={show ? "Hide password" : "Show password"}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${tokens.eyeHover}`}
    >
      {show ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );

  const providerLabel =
    provider === "google"
      ? "Google"
      : provider === "github"
      ? "GitHub"
      : null;

  const isOAuthOnly = !hasPassword;

  return (
    <>
      <SectionCard
        title="Email"
        description="We'll send confirmation links and important notices here."
        tokens={tokens}
      >
        <div className="pt-4">
          <Field
            label="Email address"
            type="email"
            value={loadingAccount ? "Loading..." : email}
            onChange={setEmail}
            autoComplete="email"
            tokens={tokens}
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-4">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              verified ? tokens.badgeVerified : tokens.badgePending
            }`}
          >
            {loadingAccount
              ? "Checking..."
              : verified
              ? "Verified"
              : "Unverified"}
          </span>

          <button
            type="button"
            disabled={loadingAccount || verified || sendingVerification}
            onClick={handleSendVerification}
            className={`rounded-[9px] px-3.5 py-2 text-[12.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${tokens.secondaryBg}`}
          >
            {sendingVerification ? "Sending..." : "Send verification email"}
          </button>
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
      >
        <div className="flex flex-col gap-3 pt-4">
          {!loadingAccount && !isOAuthOnly && (
            <Field
              label="Current password"
              type={show ? "text" : "password"}
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
              placeholder="••••••••"
              tokens={tokens}
            />
          )}

          <Field
            label={isOAuthOnly ? "Password" : "New password"}
            type={show ? "text" : "password"}
            value={next}
            onChange={setNext}
            autoComplete="new-password"
            placeholder="••••••••"
            hint="Must be at least 8 characters."
            tokens={tokens}
            trailing={trailing}
          />

          {!loadingAccount && isOAuthOnly && (
            <Field
              label="Confirm password"
              type={show ? "text" : "password"}
              value={confirmNext}
              onChange={setConfirmNext}
              autoComplete="new-password"
              placeholder="••••••••"
              tokens={tokens}
            />
          )}
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={handleUpdatePassword}
            disabled={updatingPassword || loadingAccount}
            className={`rounded-[9px] px-4 py-2.5 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${tokens.primaryBg}`}
          >
            {updatingPassword
              ? isOAuthOnly
                ? "Saving..."
                : "Updating..."
              : isOAuthOnly
              ? "Set password"
              : "Update password"}
          </button>
        </div>

        {isOAuthOnly && providerLabel && (
          <p className={`pt-4 text-[12px] leading-relaxed ${tokens.body}`}>
            You can still sign in with {providerLabel}. To manage that
            account, open your{" "}
            <a
              href={
                provider === "google"
                  ? "https://myaccount.google.com/security"
                  : "https://github.com/settings/security"
              }
              target="_blank"
              rel="noreferrer noopener"
              className={`font-medium underline underline-offset-2 ${tokens.link}`}
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

/* ──────────────────────────────────────────────────────────────
   Appearance
   ────────────────────────────────────────────────────────────── */

function AppearanceSection({
  tokens,
  isDark,
  setTheme,
}: {
  tokens: Tokens;
  isDark: boolean;
  setTheme: (t: "light" | "dark", origin?: { x: number; y: number }) => void;
}) {
  const options: {
    key: "light" | "dark";
    label: string;
  }[] = [
    { key: "light", label: "Light" },
    { key: "dark", label: "Dark" },
  ];

  const selected: "light" | "dark" = isDark ? "dark" : "light";

  return (
    <SectionCard
      title="Appearance"
      description="Customize how the interface looks on this device."
      tokens={tokens}
    >
      <div className="pt-4">
        <p className={`mb-2 text-[12.5px] font-medium ${tokens.labelText}`}>
          Theme
        </p>

        <div
          role="radiogroup"
          aria-label="Theme"
          className="grid gap-3 sm:grid-cols-2"
        >
          {options.map((option) => {
            const isActive = selected === option.key;
            const isDarkPreview = option.key === "dark";

            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={(event) =>
                  setTheme(option.key, {
                    x: event.clientX,
                    y: event.clientY,
                  })
                }
                className={[
                  "relative flex flex-col overflow-hidden rounded-[12px] border p-3 text-left transition",
                  isActive
                    ? "border-neutral-400 ring-2 ring-neutral-400/30"
                    : tokens.cardBorder,
                  tokens.cardBg,
                ].join(" ")}
              >
                <div
                  className={`h-20 w-full overflow-hidden rounded-[8px] border ${
                    isDarkPreview
                      ? tokens.previewDarkFrame
                      : tokens.previewLightFrame
                  }`}
                >
                  <div
                    className={`m-2 h-3 w-16 rounded-full ${
                      isDarkPreview ? "bg-white/20" : "bg-neutral-400/40"
                    }`}
                  />

                  <div
                    className={`mx-2 h-2 w-24 rounded-full ${
                      isDarkPreview ? "bg-white/10" : "bg-neutral-400/25"
                    }`}
                  />

                  <div
                    className={`mx-2 mt-1.5 h-2 w-20 rounded-full ${
                      isDarkPreview ? "bg-white/10" : "bg-neutral-400/25"
                    }`}
                  />
                </div>

                <span
                  className={`mt-2.5 text-[12.5px] font-medium ${
                    isActive ? tokens.heading : tokens.body
                  }`}
                >
                  {option.label}
                </span>

                {isActive && (
                  <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-2.5 w-2.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m5 12.5 4.2 4.2L19 7" />
                    </svg>
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
          checked={false}
          onChange={() => undefined}
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
          checked={false}
          onChange={() => undefined}
          label="Compact mode"
          tokens={tokens}
        />
      </Row>
    </SectionCard>
  );
}

/* ──────────────────────────────────────────────────────────────
   Notifications
   ────────────────────────────────────────────────────────────── */

function NotificationsSection({
  tokens,
  notify,
}: {
  tokens: Tokens;
  notify: (m: string) => void;
}) {
  const [prefs, setPrefs] = useState({
    productUpdates: true,
    securityAlerts: true,
    weeklyDigest: false,
    mentions: true,
    marketing: false,
  });

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <SectionCard
      title="Notifications"
      description="Choose what we should email you about."
      tokens={tokens}
    >
      <Row
        title="Product updates"
        description="New features, improvements, and release notes."
        tokens={tokens}
      >
        <Toggle
          checked={prefs.productUpdates}
          onChange={() => toggle("productUpdates")}
          label="Product updates"
          tokens={tokens}
        />
      </Row>

      <Row
        title="Security alerts"
        description="Sign-ins from new devices and password changes. Recommended."
        tokens={tokens}
      >
        <Toggle
          checked={prefs.securityAlerts}
          onChange={() => toggle("securityAlerts")}
          label="Security alerts"
          tokens={tokens}
        />
      </Row>

      <Row
        title="Mentions"
        description="When someone mentions you in a comment or thread."
        tokens={tokens}
      >
        <Toggle
          checked={prefs.mentions}
          onChange={() => toggle("mentions")}
          label="Mentions"
          tokens={tokens}
        />
      </Row>

      <Row
        title="Weekly digest"
        description="A summary of activity in your workspace, every Monday."
        tokens={tokens}
      >
        <Toggle
          checked={prefs.weeklyDigest}
          onChange={() => toggle("weeklyDigest")}
          label="Weekly digest"
          tokens={tokens}
        />
      </Row>

      <Row
        title="Marketing"
        description="Tips, offers, and occasional product news."
        tokens={tokens}
      >
        <Toggle
          checked={prefs.marketing}
          onChange={() => toggle("marketing")}
          label="Marketing emails"
          tokens={tokens}
        />
      </Row>

      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={() => notify("Preferences saved")}
          className={`rounded-[9px] px-4 py-2.5 text-[12.5px] font-semibold transition ${tokens.primaryBg}`}
        >
          Save preferences
        </button>
      </div>
    </SectionCard>
  );
}

/* ──────────────────────────────────────────────────────────────
   Billing
   ────────────────────────────────────────────────────────────── */

function BillingSection({ tokens }: { tokens: Tokens }) {
  return (
    <>
      <SectionCard
        title="Plan"
        description="You're currently on a free trial."
        tokens={tokens}
      >
        <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={`text-[13.5px] font-medium ${tokens.heading}`}>
              Pro trial
            </p>

            <p className={`mt-0.5 text-[12px] ${tokens.body}`}>
              Ends on Oct 19, 2026. No card on file.
            </p>
          </div>

          <button
            type="button"
            className={`rounded-[9px] px-4 py-2.5 text-[12.5px] font-semibold transition ${tokens.primaryBg}`}
          >
            Upgrade plan
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Payment method"
        description="Cards are only charged when a paid plan is active."
        tokens={tokens}
      >
        <div className="flex items-center justify-between gap-3 pt-4">
          <p className={`text-[12.5px] ${tokens.body}`}>
            No payment method on file.
          </p>

          <button
            type="button"
            className={`rounded-[9px] px-3.5 py-2 text-[12.5px] font-medium transition ${tokens.secondaryBg}`}
          >
            Add card
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Invoices"
        description="Download past receipts."
        tokens={tokens}
      >
        <p className={`py-4 text-[12.5px] ${tokens.body}`}>
          No invoices yet.
        </p>
      </SectionCard>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
   Danger zone
   ────────────────────────────────────────────────────────────── */

function DangerSection({
  tokens,
  notify,
}: {
  tokens: Tokens;
  notify: (m: string) => void;
}) {
  const [confirm, setConfirm] = useState("");

  return (
    <>
      <SectionCard
        title="Export data"
        description="Download a copy of everything tied to your account."
        tokens={tokens}
      >
        <div className="flex items-center justify-between gap-3 pt-4">
          <p className={`text-[12.5px] ${tokens.body}`}>
            You'll receive an email with a download link.
          </p>

          <button
            type="button"
            onClick={() => notify("Export requested")}
            className={`rounded-[9px] px-3.5 py-2 text-[12.5px] font-medium transition ${tokens.secondaryBg}`}
          >
            Request export
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Delete account"
        description="This permanently removes your account, workspace, and all data. This cannot be undone."
        tokens={tokens}
        danger
      >
        <div className="flex flex-col gap-3 pt-4">
          <Field
            label='Type "delete" to confirm'
            value={confirm}
            onChange={setConfirm}
            placeholder="delete"
            tokens={tokens}
          />
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="button"
            disabled={confirm.trim().toLowerCase() !== "delete"}
            onClick={() =>
              notify("Account deletion is disabled in this demo")
            }
            className={`rounded-[9px] px-4 py-2.5 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${tokens.dangerSolid}`}
          >
            Delete my account
          </button>
        </div>
      </SectionCard>
    </>
  );
}