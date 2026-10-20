import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { navigate } from "../hooks/useHashRoute";
import { useTheme, type Theme } from "../hooks/useTheme";
import {
  deleteAvatar,
  getCurrentUser,
  resendVerificationEmail,
  updatePassword,
  updateUserProfile,
  uploadAvatar,
  type UserProfile,
} from "../services/supabase";

/**
 * Settings page.
 *
 * Existing integrations used here:
 * - getCurrentUser
 * - updateUserProfile
 * - uploadAvatar / deleteAvatar
 * - resendVerificationEmail
 * - updatePassword
 * - useTheme
 *
 * Preferences, tags, saved replies and billing cannot be made persistent or
 * production-ready from this component alone unless the corresponding backend
 * service methods / Stripe endpoints exist. This page deliberately does not
 * pretend those operations succeeded: unavailable operations show a clear
 * message. See the implementation notes accompanying this file.
 */

type SectionId =
  | "profile"
  | "security"
  | "appearance"
  | "notifications"
  | "billing"
  | "tags"
  | "replies"
  | "danger";

type Notice = { kind: "success" | "error" | "info"; message: string };
type ToggleValue = boolean;

type LocalPreferences = {
  emailProduct: boolean;
  emailSecurity: boolean;
  pushMentions: boolean;
  pushReplies: boolean;
  compactMode: boolean;
  reduceMotion: boolean;
};

type Tag = { id: string; name: string; color: string };
type SavedReply = { id: string; title: string; body: string };

const SECTIONS: { id: SectionId; label: string; description: string; icon: string }[] = [
  { id: "profile", label: "Profil", description: "Informations personnelles", icon: "◉" },
  { id: "security", label: "Sécurité", description: "Mot de passe et vérification", icon: "⌑" },
  { id: "appearance", label: "Apparence", description: "Thème et confort visuel", icon: "◐" },
  { id: "notifications", label: "Notifications", description: "E-mails et alertes", icon: "♧" },
  { id: "billing", label: "Facturation", description: "Abonnement et paiements", icon: "▤" },
  { id: "tags", label: "Tags", description: "Organiser vos conversations", icon: "◇" },
  { id: "replies", label: "Réponses enregistrées", description: "Réponses réutilisables", icon: "☷" },
  { id: "danger", label: "Zone sensible", description: "Export et suppression", icon: "⚠" },
];

const DEFAULT_PREFERENCES: LocalPreferences = {
  emailProduct: true,
  emailSecurity: true,
  pushMentions: true,
  pushReplies: true,
  compactMode: false,
  reduceMotion: false,
};

const LOCAL_PREFS_KEY = "app-settings-preferences-v1";
const LOCAL_TAGS_KEY = "app-settings-tags-v1";
const LOCAL_REPLIES_KEY = "app-settings-replies-v1";

const DEFAULT_TAGS: Tag[] = [
  { id: "tag-work", name: "Travail", color: "#6366f1" },
  { id: "tag-personal", name: "Personnel", color: "#0d9488" },
];

const DEFAULT_REPLIES: SavedReply[] = [
  {
    id: "reply-welcome",
    title: "Bienvenue",
    body: "Bonjour ! Merci pour votre message. Je reviens vers vous rapidement.",
  },
];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persistLocal<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing / storage restrictions: the UI still remains usable.
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Une erreur inattendue est survenue.";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function initials(name: string, email: string): string {
  const source = name.trim() || email.trim() || "U";
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center text-base leading-none">
      {children}
    </span>
  );
}

function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  loading,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const variants: Record<NonNullable<typeof variant>, string> = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:ring-indigo-500",
    secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    danger: "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-500",
    ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-950",
        variants[variant],
        className,
      )}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  required,
  autoComplete,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
}) {
  const id = useMemo(() => `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, [label]);
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}{required ? <span className="ml-1 text-red-500">*</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
      />
      {hint ? <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
        {description ? <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
          checked ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700",
        )}
      >
        <span className={cx("mt-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="space-y-5 p-5 sm:p-6">{children}</div>
    </section>
  );
}

function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const color =
    notice.kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
      : notice.kind === "error"
        ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
        : "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200";
  return (
    <div role={notice.kind === "error" ? "alert" : "status"} className={cx("flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm", color)}>
      <p>{notice.message}</p>
      <button onClick={onDismiss} aria-label="Fermer le message" className="rounded p-1 opacity-70 hover:opacity-100">×</button>
    </div>
  );
}

function UnavailableFeature({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      {children}
    </div>
  );
}

export default function Settings() {
  const themeApi = useTheme();
  const theme = themeApi.theme as Theme;
  const toggleTheme = themeApi.toggleTheme;
  const [activeSection, setActiveSection] = useState<SectionId>("profile");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [passwordNew, setPasswordNew] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [preferences, setPreferences] = useState<LocalPreferences>(() => readJson(LOCAL_PREFS_KEY, DEFAULT_PREFERENCES));
  const [tags, setTags] = useState<Tag[]>(() => readJson(LOCAL_TAGS_KEY, DEFAULT_TAGS));
  const [replies, setReplies] = useState<SavedReply[]>(() => readJson(LOCAL_REPLIES_KEY, DEFAULT_REPLIES));
  const [newTag, setNewTag] = useState("");
  const [newReplyTitle, setNewReplyTitle] = useState("");
  const [newReplyBody, setNewReplyBody] = useState("");
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((kind: Notice["kind"], message: string) => setNotice({ kind, message }), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await getCurrentUser();
        if (!mounted) return;
        // Accepte les formes courantes renvoyées par l'intégration existante.
        const raw = result as unknown as {
          profile?: UserProfile;
          user?: { email?: string; user_metadata?: Record<string, unknown> };
          email?: string;
          full_name?: string;
          display_name?: string;
          bio?: string;
          avatar_url?: string;
          name?: string;
        } | null;
        const candidate = (raw?.profile ?? raw) as (UserProfile & Record<string, unknown>) | null;
        const user = raw?.user;
        const metadata = user?.user_metadata ?? {};
        const initialEmail = String(user?.email ?? raw?.email ?? candidate?.email ?? "");
        const initialName = String(
          candidate?.display_name ??
          candidate?.full_name ??
          candidate?.name ??
          metadata.full_name ??
          metadata.name ??
          "",
        );
        setEmail(initialEmail);
        setDisplayName(initialName);
        setBio(String(candidate?.bio ?? metadata.bio ?? ""));
        setAvatarUrl(String(candidate?.avatar_url ?? metadata.avatar_url ?? ""));
      } catch (error) {
        if (mounted) notify("error", `Impossible de charger le profil : ${getErrorMessage(error)}`);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [notify]);

  useEffect(() => persistLocal(LOCAL_PREFS_KEY, preferences), [preferences]);
  useEffect(() => persistLocal(LOCAL_TAGS_KEY, tags), [tags]);
  useEffect(() => persistLocal(LOCAL_REPLIES_KEY, replies), [replies]);

  useEffect(() => {
    if (preferences.reduceMotion) document.documentElement.dataset.reduceMotion = "true";
    else delete document.documentElement.dataset.reduceMotion;
    return () => {
      delete document.documentElement.dataset.reduceMotion;
    };
  }, [preferences.reduceMotion]);

  const currentSection = SECTIONS.find((section) => section.id === activeSection) ?? SECTIONS[0];
  const profileName = displayName.trim() || email || "Votre profil";

  const changePreference = (key: keyof LocalPreferences, value: ToggleValue) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (displayName.trim().length < 2) {
      notify("error", "Le nom doit contenir au moins 2 caractères.");
      return;
    }
    if (email.trim() && !isValidEmail(email)) {
      notify("error", "Veuillez saisir une adresse e-mail valide.");
      return;
    }
    setSavingProfile(true);
    try {
      // Signature conservée : utilise la fonction déjà présente dans le projet.
      await updateUserProfile({
        display_name: displayName.trim(),
        full_name: displayName.trim(),
        bio: bio.trim(),
      } as Partial<UserProfile>);
      notify("success", "Profil enregistré.");
    } catch (error) {
      notify("error", `Enregistrement impossible : ${getErrorMessage(error)}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("error", "Choisissez un fichier image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify("error", "L’image ne doit pas dépasser 5 Mo.");
      return;
    }
    setUploadingAvatar(true);
    try {
      const result = await uploadAvatar(file);
      const url = typeof result === "string"
        ? result
        : String((result as { publicUrl?: string; url?: string; avatar_url?: string } | null)?.publicUrl ??
          (result as { url?: string } | null)?.url ??
          (result as { avatar_url?: string } | null)?.avatar_url ??
          "");
      if (!url) throw new Error("La fonction uploadAvatar n’a pas retourné d’URL exploitable.");
      setAvatarUrl(url);
      await updateUserProfile({ avatar_url: url } as Partial<UserProfile>);
      notify("success", "Photo de profil mise à jour.");
    } catch (error) {
      notify("error", `Échec de l’envoi de l’avatar : ${getErrorMessage(error)}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!window.confirm("Retirer votre photo de profil ?")) return;
    try {
      await deleteAvatar();
      setAvatarUrl("");
      await updateUserProfile({ avatar_url: null } as Partial<UserProfile>);
      notify("success", "Photo de profil retirée.");
    } catch (error) {
      notify("error", `Impossible de retirer l’avatar : ${getErrorMessage(error)}`);
    }
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordNew.length < 12) {
      notify("error", "Le nouveau mot de passe doit contenir au moins 12 caractères.");
      return;
    }
    if (!/[A-Z]/.test(passwordNew) || !/[a-z]/.test(passwordNew) || !/[0-9]/.test(passwordNew)) {
      notify("error", "Utilisez au moins une majuscule, une minuscule et un chiffre.");
      return;
    }
    if (passwordNew !== passwordConfirm) {
      notify("error", "Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    setSavingPassword(true);
    try {
      // La signature actuelle du service est conservée : nouveau mot de passe.
      await updatePassword(passwordNew);
      setPasswordNew("");
      setPasswordConfirm("");
      notify("success", "Mot de passe mis à jour.");
    } catch (error) {
      notify("error", `Mise à jour impossible : ${getErrorMessage(error)}`);
    } finally {
      setSavingPassword(false);
    }
  };

  const resendVerification = async () => {
    try {
      await resendVerificationEmail();
      notify("success", "E-mail de vérification envoyé si le compte le permet.");
    } catch (error) {
      notify("error", `Envoi impossible : ${getErrorMessage(error)}`);
    }
  };

  const addTag = () => {
    const name = newTag.trim();
    if (!name) return;
    if (tags.some((tag) => tag.name.toLowerCase() === name.toLowerCase())) {
      notify("error", "Ce tag existe déjà.");
      return;
    }
    setTags((current) => [...current, { id: `tag-${Date.now()}`, name, color: "#6366f1" }]);
    setNewTag("");
    notify("info", "Tag ajouté sur cet appareil. La synchronisation Supabase nécessite le service indiqué dans les notes.");
  };

  const addReply = () => {
    const title = newReplyTitle.trim();
    const body = newReplyBody.trim();
    if (!title || !body) {
      notify("error", "Renseignez le titre et le contenu de la réponse.");
      return;
    }
    setReplies((current) => [...current, { id: `reply-${Date.now()}`, title, body }]);
    setNewReplyTitle("");
    setNewReplyBody("");
    notify("info", "Réponse enregistrée sur cet appareil. La synchronisation Supabase nécessite le service indiqué dans les notes.");
  };

  const exportLocalData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      preferences,
      tags,
      savedReplies: replies,
      profile: { displayName, email, bio, avatarUrl },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "settings-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
    notify("success", "Export local téléchargé. Les données serveur non chargées ne sont pas incluses.");
  };

  const billingAction = () => {
    notify("info", "La facturation réelle nécessite une route serveur sécurisée créant une session du portail Stripe. Aucun endpoint de facturation n’est présent dans les intégrations fournies.");
  };

  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return (
          <div className="space-y-5">
            <SectionCard title="Profil" description="Gérez les informations visibles sur votre compte.">
              {loadingProfile ? (
                <div className="flex items-center gap-3 py-6 text-sm text-slate-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />Chargement du profil…</div>
              ) : (
                <>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-indigo-100 text-xl font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                      {avatarUrl ? <img src={avatarUrl} alt={`Avatar de ${profileName}`} className="h-full w-full object-cover" /> : initials(displayName, email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white">{profileName}</p>
                      <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">{email || "Aucune adresse e-mail chargée"}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="secondary" loading={uploadingAvatar} onClick={() => avatarInputRef.current?.click()}>Changer la photo</Button>
                        {avatarUrl ? <Button variant="ghost" onClick={handleDeleteAvatar}>Retirer</Button> : null}
                        <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleAvatarChange} aria-label="Choisir une photo de profil" />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">PNG, JPG, WEBP ou GIF · 5 Mo maximum.</p>
                    </div>
                  </div>
                  <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveProfile}>
                    <Field label="Nom affiché" value={displayName} onChange={setDisplayName} required autoComplete="name" />
                    <Field label="Adresse e-mail" value={email} onChange={setEmail} type="email" required autoComplete="email" hint="La modification de l’e-mail nécessite un flux Auth dédié ; cette page ne tente pas de la modifier." disabled />
                    <div className="sm:col-span-2">
                      <label htmlFor="profile-bio" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Présentation</label>
                      <textarea id="profile-bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={500} rows={4} placeholder="Quelques mots à propos de vous…" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                      <p className="mt-1 text-right text-xs text-slate-500">{bio.length}/500</p>
                    </div>
                    <div className="sm:col-span-2"><Button type="submit" loading={savingProfile}>Enregistrer le profil</Button></div>
                  </form>
                </>
              )}
            </SectionCard>
            <SectionCard title="Vérification du compte" description="Renforcez la sécurité de votre compte.">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div><p className="text-sm font-medium text-slate-800 dark:text-slate-100">Vérification de l’adresse e-mail</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Un e-mail de vérification peut être renvoyé à l’adresse du compte.</p></div>
                <Button variant="secondary" onClick={resendVerification}>Renvoyer l’e-mail</Button>
              </div>
            </SectionCard>
          </div>
        );
      case "security":
        return (
          <div className="space-y-5">
            <SectionCard title="Mot de passe" description="Utilisez un mot de passe long et unique.">
              <form onSubmit={savePassword} className="space-y-4">
                <Field label="Nouveau mot de passe" value={passwordNew} onChange={setPasswordNew} type={showPassword ? "text" : "password"} required autoComplete="new-password" hint="12 caractères minimum, avec majuscule, minuscule et chiffre." />
                <Field label="Confirmer le nouveau mot de passe" value={passwordConfirm} onChange={setPasswordConfirm} type={showPassword ? "text" : "password"} required autoComplete="new-password" />
                <Toggle label="Afficher les mots de passe" checked={showPassword} onChange={setShowPassword} />
                {passwordNew && passwordConfirm && passwordNew !== passwordConfirm ? <p className="text-sm text-red-600">Les mots de passe ne correspondent pas.</p> : null}
                <Button type="submit" loading={savingPassword}>Mettre à jour le mot de passe</Button>
              </form>
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Le service actuel updatePassword est utilisé. Le champ « mot de passe actuel » n’est pas envoyé car la signature du service fourni ne le prend pas en charge ; si une réauthentification est requise, ajoutez-la au service.</p>
            </SectionCard>
            <SectionCard title="Session et authentification" description="Quelques bonnes pratiques pour protéger votre compte.">
              <ul className="list-inside list-disc space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                <li>N’utilisez pas le même mot de passe sur plusieurs services.</li>
                <li>Ne partagez jamais vos codes de vérification.</li>
                <li>Activez l’authentification multifacteur dans votre fournisseur Auth si elle est configurée.</li>
              </ul>
              <UnavailableFeature>La gestion des sessions actives et l’authentification multifacteur ne sont pas exposées par les fonctions Supabase fournies. Elles nécessitent des méthodes Auth dédiées et, pour le MFA, une configuration côté projet.</UnavailableFeature>
            </SectionCard>
          </div>
        );
      case "appearance":
        return (
          <SectionCard title="Apparence" description="Personnalisez l’interface selon vos préférences.">
            <div className="grid gap-3 sm:grid-cols-2">
              {(["light", "dark"] as Theme[]).map((choice) => (
                <button key={choice} onClick={() => { if (theme !== choice) toggleTheme(); }} aria-pressed={theme === choice} className={cx("rounded-2xl border-2 p-4 text-left transition duration-200 hover:-translate-y-0.5", theme === choice ? "border-indigo-500 ring-2 ring-indigo-500/10" : "border-slate-200 dark:border-slate-700")}>
                  <div className={cx("mb-3 h-20 rounded-xl border p-3", choice === "dark" ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-100")}>
                    <div className={cx("h-2 w-1/3 rounded", choice === "dark" ? "bg-slate-600" : "bg-slate-300")} />
                    <div className="mt-3 grid grid-cols-3 gap-2"><div className={cx("h-8 rounded", choice === "dark" ? "bg-slate-800" : "bg-white")} /><div className={cx("h-8 rounded", choice === "dark" ? "bg-slate-800" : "bg-white")} /><div className={cx("h-8 rounded", choice === "dark" ? "bg-slate-800" : "bg-white")} /></div>
                  </div>
                  <span className="font-medium text-slate-900 dark:text-white">{choice === "light" ? "Clair" : "Sombre"}</span>
                  <span className="mt-1 block text-xs text-slate-500">{theme === choice ? "Thème actif" : "Cliquer pour appliquer"}</span>
                </button>
              ))}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <Toggle label="Mode compact" description="Réduit légèrement les espacements de l’interface." checked={preferences.compactMode} onChange={(value) => changePreference("compactMode", value)} />
              <Toggle label="Réduire les animations" description="Désactive les transitions décoratives sur cette page." checked={preferences.reduceMotion} onChange={(value) => changePreference("reduceMotion", value)} />
            </div>
          </SectionCard>
        );
      case "notifications":
        return (
          <SectionCard title="Notifications" description="Choisissez les alertes que vous souhaitez recevoir.">
            <UnavailableFeature>Pour l’instant, ces préférences sont enregistrées dans le stockage local de ce navigateur. La synchronisation Supabase nécessite une table et des fonctions de service dédiées ; l’interface ne prétend pas les avoir synchronisées.</UnavailableFeature>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <Toggle label="Actualités et nouveautés par e-mail" description="Informations sur les nouvelles fonctionnalités." checked={preferences.emailProduct} onChange={(value) => changePreference("emailProduct", value)} />
              <Toggle label="E-mails de sécurité" description="Alertes liées à la sécurité du compte." checked={preferences.emailSecurity} onChange={(value) => changePreference("emailSecurity", value)} />
              <Toggle label="Mentions" description="Être averti lorsque quelqu’un vous mentionne." checked={preferences.pushMentions} onChange={(value) => changePreference("pushMentions", value)} />
              <Toggle label="Réponses" description="Être averti lorsqu’une réponse est reçue." checked={preferences.pushReplies} onChange={(value) => changePreference("pushReplies", value)} />
            </div>
            <p className="text-xs text-slate-500">Les e-mails de sécurité essentiels peuvent être envoyés indépendamment de cette préférence, selon la politique de votre application.</p>
          </SectionCard>
        );
      case "billing":
        return (
          <div className="space-y-5">
            <SectionCard title="Abonnement et paiements" description="Consultez votre abonnement et gérez votre moyen de paiement.">
              <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-sm text-slate-500 dark:text-slate-400">Abonnement actuel</p><p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">Statut indisponible</p></div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">À connecter</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Aucune donnée d’abonnement ou de paiement n’est chargée, car aucun service de facturation n’a été fourni. Aucun statut, tarif ou paiement fictif n’est affiché.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={billingAction}>Gérer mon abonnement</Button>
                <Button variant="secondary" onClick={billingAction}>Voir les factures</Button>
              </div>
              <UnavailableFeature>La gestion réelle exige un fournisseur de paiement (par exemple Stripe), une route serveur authentifiée qui crée une session de portail client, des webhooks vérifiés et une table d’abonnements synchronisée. Ne créez jamais de session de portail avec une clé secrète côté navigateur.</UnavailableFeature>
            </SectionCard>
          </div>
        );
      case "tags":
        return (
          <SectionCard title="Tags" description="Créez des tags pour organiser votre contenu.">
            <UnavailableFeature>Les tags ci-dessous sont conservés localement dans ce navigateur. Pour les synchroniser entre appareils, ajoutez le service et la migration décrits dans les notes techniques.</UnavailableFeature>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); addTag(); }}>
              <input value={newTag} onChange={(event) => setNewTag(event.target.value)} maxLength={40} placeholder="Nom du nouveau tag" aria-label="Nom du nouveau tag" className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
              <Button type="submit">Ajouter le tag</Button>
            </form>
            {tags.length ? <div className="flex flex-wrap gap-2">{tags.map((tag) => <span key={tag.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />{tag.name}<button type="button" aria-label={`Supprimer le tag ${tag.name}`} onClick={() => setTags((current) => current.filter((item) => item.id !== tag.id))} className="ml-1 rounded-full px-1.5 text-slate-500 hover:bg-slate-200 hover:text-red-600 dark:hover:bg-slate-800">×</button></span>)}</div> : <p className="text-sm text-slate-500">Aucun tag pour le moment.</p>}
          </SectionCard>
        );
      case "replies":
        return (
          <SectionCard title="Réponses enregistrées" description="Préparez des réponses que vous réutilisez souvent.">
            <UnavailableFeature>Les réponses sont enregistrées localement dans ce navigateur. La persistance Supabase nécessite le service et la table décrits dans les notes techniques.</UnavailableFeature>
            <form className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800" onSubmit={(event) => { event.preventDefault(); addReply(); }}>
              <Field label="Titre" value={newReplyTitle} onChange={setNewReplyTitle} placeholder="Ex. : Première réponse" required />
              <div><label htmlFor="reply-body" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Contenu</label><textarea id="reply-body" value={newReplyBody} onChange={(event) => setNewReplyBody(event.target.value)} rows={4} maxLength={5000} required placeholder="Écrivez votre réponse…" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div>
              <Button type="submit">Enregistrer la réponse</Button>
            </form>
            <div className="space-y-3">{replies.map((reply) => <article key={reply.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-slate-900 dark:text-white">{reply.title}</h3><button onClick={() => setReplies((current) => current.filter((item) => item.id !== reply.id))} className="text-sm text-red-600 hover:underline">Supprimer</button></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{reply.body}</p><Button variant="secondary" className="mt-3" onClick={() => { void navigator.clipboard?.writeText(reply.body).then(() => notify("success", "Réponse copiée."), () => notify("error", "Copie impossible dans ce navigateur.")); }}>Copier le texte</Button></article>)}</div>
          </SectionCard>
        );
      case "danger":
        return (
          <div className="space-y-5">
            <SectionCard title="Exporter vos données" description="Téléchargez un export JSON des données actuellement disponibles dans cette page.">
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">L’export comprend les préférences locales, tags, réponses enregistrées et champs de profil chargés. Il ne remplace pas une demande d’accès exhaustive aux données côté serveur.</p>
              <Button variant="secondary" onClick={exportLocalData}>Télécharger mon export</Button>
            </SectionCard>
            <SectionCard title="Supprimer le compte" description="Cette action doit être irréversible uniquement après confirmation côté serveur.">
              <UnavailableFeature>La suppression réelle nécessite une fonction serveur sécurisée (Supabase Edge Function ou API protégée) utilisant le contexte de l’utilisateur et supprimant les données associées. Le client ne supprime pas directement un utilisateur Auth.</UnavailableFeature>
              <label htmlFor="delete-confirm" className="block text-sm font-medium text-slate-700 dark:text-slate-200">Tapez SUPPRIMER pour confirmer votre intention</label>
              <input id="delete-confirm" value={confirmDeleteText} onChange={(event) => setConfirmDeleteText(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
              <Button variant="danger" disabled={confirmDeleteText !== "SUPPRIMER"} onClick={() => notify("info", "Aucun compte n’a été supprimé : le service serveur de suppression n’est pas présent.")}>Supprimer mon compte</Button>
            </SectionCard>
          </div>
        );
      default:
        return null;
    }
  };

  const selectSection = (id: SectionId) => {
    setActiveSection(id);
    setMobileNavOpen(false);
    document.getElementById("settings-content")?.scrollIntoView({ behavior: preferences.reduceMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className={cx("min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-900 dark:text-slate-100", preferences.compactMode && "[&_section>div:last-child]:!space-y-3")} style={preferences.reduceMotion ? { scrollBehavior: "auto" } : undefined}>
      <style>{`
        [data-reduce-motion="true"] *, [data-reduce-motion="true"] *::before, [data-reduce-motion="true"] *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-duration: 0.01ms !important;
        }
      `}</style>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div><button onClick={() => navigate("/")} className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-indigo-600 dark:text-slate-400"><span aria-hidden="true">←</span> Retour</button><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Paramètres</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gérez votre profil, votre sécurité et vos préférences.</p></div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(displayName, email)}</div>
            <div className="max-w-40"><p className="truncate text-sm font-semibold">{profileName}</p><p className="truncate text-xs text-slate-500">{email}</p></div>
          </div>
        </div>

        {notice ? <div className="mb-5"><NoticeBanner notice={notice} onDismiss={() => setNotice(null)} /></div> : null}

        <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-6">
            <div className="lg:hidden">
              <Button variant="secondary" className="w-full justify-between" onClick={() => setMobileNavOpen((open) => !open)}><span className="flex items-center gap-2"><Icon>☰</Icon>{currentSection.label}</span><span aria-hidden="true">{mobileNavOpen ? "⌃" : "⌄"}</span></Button>
              {mobileNavOpen ? <nav aria-label="Sections des paramètres" className="mt-2 grid gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-950">{SECTIONS.map((section) => <button key={section.id} onClick={() => selectSection(section.id)} className={cx("flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition", activeSection === section.id ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900")}><Icon>{section.icon}</Icon>{section.label}</button>)}</nav> : null}
            </div>
            <nav aria-label="Sections des paramètres" className="hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:block dark:border-slate-800 dark:bg-slate-950">
              <p className="px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Préférences</p>
              {SECTIONS.map((section) => <button key={section.id} onClick={() => selectSection(section.id)} aria-current={activeSection === section.id ? "page" : undefined} className={cx("group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition duration-200", activeSection === section.id ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900")}><span className={cx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition", activeSection === section.id ? "bg-indigo-100 dark:bg-indigo-900" : "bg-slate-100 group-hover:bg-white dark:bg-slate-900 dark:group-hover:bg-slate-800")}><Icon>{section.icon}</Icon></span><span className="min-w-0"><span className="block text-sm font-medium">{section.label}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{section.description}</span></span></button>)}
            </nav>
            <div className="mt-4 hidden rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 lg:block">Les modifications de profil utilisent les services existants. Les préférences, tags et réponses restent locales tant que la couche de persistance Supabase n’a pas été ajoutée.</div>
          </aside>

          <main id="settings-content" className="min-w-0 space-y-4" key={activeSection}>
            <div className="mb-1 animate-[settings-enter_180ms_ease-out]">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">Paramètres du compte</p>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">{currentSection.label}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{currentSection.description}</p>
            </div>
            {renderSection()}
          </main>
        </div>
      </div>
      <style>{`@keyframes settings-enter { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
