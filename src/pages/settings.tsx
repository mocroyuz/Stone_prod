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
import { useUser } from "../contexts/UserContext";
import { notifyMfaStatusChanged, useMfaNudge } from "../hooks/useMfaNudge";
import {
  CHANNELS,
  PLAN,
  type Channel,
  type ChannelKey,
  type ConnectionState,
} from "../data/channelConfig";
import Modal from "../components/Modal";
import {
  ConfirmAccountModal,
  openFrequencyOnboarding,
  type OnboardingAccount,
} from "../components/OnboardingModals";
import {
  getTikTokStatus,
  startTikTokLogin,
  disconnectTikTok,
} from "../services/tiktok";
import {
  getPinterestStatus,
  startPinterestLogin,
  disconnectPinterest,
  connectPinterestWithToken,
} from "../services/pinterest";
import {
  getYouTubeStatus,
  startYouTubeLogin,
  disconnectYouTube,
} from "../services/youtube";
import {
  CHANNELS_CHANGED_EVENT,
  CACHE_MAX_AGE_MS,
  clearCache,
  readCache,
  writeCache,
  type CacheProvider,
  type Connection,
} from "../services/channelsCache";
import {
  getCurrentUser,
  updateUserProfile,
  uploadAvatar,
  deleteAvatar,
  resendVerificationEmail,
  updatePassword,
  // ── MFA (app ou email) ──
  getMfaStatus,
  listMfaFactors,
  startMfaEnrollment,
  confirmMfaEnrollment,
  cancelMfaEnrollment,
  disableMfa,
  verifyMfaFactorCode,
  sendEmailMfaCode,
  confirmEmailMfaEnrollment,
  verifyEmailMfaCode,
  disableEmailMfa,
  revokeOtherSessions,
  isMfaRequiredError,
  isRateLimitError,
  type UserProfile,
  type MfaFactor,
  type MfaMethod,
  // ── Tags ──
  listTags,
  createTag,
  updateTag,
  deleteTag,
  isDuplicateError,
  type Tag,
  // ── Saved replies ──
  listSavedReplies,
  createSavedReply,
  updateSavedReply,
  deleteSavedReply,
  type SavedReply,
} from "../services/supabase";

/* ── Language ── */

type Lang = "fr" | "en";

const LANGUAGE_STORAGE_KEY = "stone:language";
const LANGUAGE_CHANGED_EVENT = "stone:language-changed";

function detectLanguage(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* stockage indisponible */
  }
  return "en";
}

function useLanguage(): Lang {
  const [lang, setLang] = useState<Lang>(() => detectLanguage());

  useEffect(() => {
    const refresh = () => setLang(detectLanguage());
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    window.addEventListener("hashchange", refresh);
    window.addEventListener(LANGUAGE_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("hashchange", refresh);
      window.removeEventListener(LANGUAGE_CHANGED_EVENT, refresh);
    };
  }, []);

  return lang;
}

const intlLocale = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-GB");

/* ── Copy (translations) ── */

type SidebarGroupKey = "account" | "organization" | "utils" | "other";

type Copy = {
  sidebar: {
    title: string;
    backHome: string;
    navAria: string;
    groups: Record<SidebarGroupKey, string>;
    sections: Record<
      | "profile"
      | "account"
      | "mfa"
      | "appearance"
      | "preferences"
      | "billing"
      | "channels"
      | "tags"
      | "savedReplies"
      | "danger",
      string
    >;
    newBadge: string;
  };
  sectionTitles: Record<
    | "profile"
    | "account"
    | "mfa"
    | "appearance"
    | "preferences"
    | "billing"
    | "channels"
    | "tags"
    | "savedReplies"
    | "danger",
    string
  >;
  common: {
    cancel: string;
    close: string;
    save: string;
    saving: string;
    updating: string;
    verifying: string;
    sending: string;
    remove: string;
    edit: string;
    delete: string;
    loading: string;
    unsavedChanges: string;
    tooManyAttempts: (wait: string) => string;
    formatWaitUnit: (seconds: number) => string;
  };
  profile: {
    title: string;
    description: string;
    loadingFailed: string;
    signIn: string;
    goHome: string;
    profilePicture: string;
    fileHint: string;
    uploading: string;
    change: string;
    upload: string;
    remove: string;
    saveChanges: string;
    savingLabel: string;
    firstName: string;
    lastName: string;
    fileSizeError: string;
    fileTypeError: string;
    uploadFailed: string;
    profileUpdateFailed: string;
    pictureUpdated: string;
    pictureRemoved: string;
    removeFailed: string;
    saveFailed: string;
    saved: string;
  };
  account: {
    email: {
      title: string;
      description: string;
      label: string;
      checking: string;
      verified: string;
      unverified: string;
      twoFaOn: string;
      sendEmail: string;
      sending: string;
      sent: string;
      sendFailed: string;
      hint: string;
    };
    password: {
      title: string;
      titleSet: string;
      descDefault: string;
      descLoading: string;
      descOauth: (provider: string) => string;
      descMfa: string;
      current: string;
      currentPlaceholder: string;
      new: string;
      newPlaceholder: string;
      password: string;
      confirm: string;
      mismatch: string;
      update: string;
      set: string;
      updating: string;
      saving: string;
      setSuccess: string;
      updateSuccess: string;
      enterCurrent: string;
      enterNew: string;
      enterPassword: string;
      tooShort: string;
      different: string;
      mismatchNotify: string;
      updateFailed: string;
      show: string;
      hide: string;
    };
    oauthFootnote: (provider: string) => string;
    oauthSettingsLink: (provider: string) => string;
    strength: [string, string, string, string, string];
    mfaGate: {
      title: string;
      description: string;
    };
  };
  mfa: {
    title: string;
    description: string;
    loadFailed: string;
    nudge: {
      text: string;
      skip: string;
    };
    authenticator: {
      title: string;
      description: string;
      active: string;
      addedOn: (date: string) => string;
      disable: string;
      notEnabled: string;
      blockedByEmail: string;
      enable: string;
      starting: string;
    };
    email: {
      title: string;
      description: string;
      active: string;
      yourEmail: string;
      codesSentHint: string;
      disable: string;
      notEnabled: string;
      blockedByTotp: string;
      enable: string;
      sending: string;
    };
    setup: {
      title: string;
      description: string;
      cantScan: string;
      copy: string;
      codeHint: string;
      verifyEnable: string;
    };
    emailSetup: {
      title: string;
      description: (email: string) => string;
      codeHint: string;
      resendIn: (wait: string) => string;
      resend: string;
      verifyEnable: string;
    };
    disableModal: {
      title: string;
      description: string;
      confirm: string;
    };
    notifs: {
      enabled: string;
      disabled: string;
      copyOk: string;
      copyFailed: string;
      newCode: string;
      invalidCode: string;
      enterCode: string;
      failedStart: string;
      failedSend: string;
      failedDisable: string;
    };
    challenge: {
      titleDefault: string;
      descriptionDefault: string;
      authenticatorLabel: string;
      authenticatorN: (n: number) => string;
      codeAccepted: string;
      enterCode: string;
      tooManyAttempts: (wait: string) => string;
      resendIn: (wait: string) => string;
      resend: string;
      cancel: string;
      verifying: string;
      retry: string;
      verifyContinue: string;
      emailDescription: (sentTo: string | null) => string;
      expired: string;
      invalidRetry: string;
      noMethodError: string;
      noFactorError: string;
    };
  };
  appearance: {
    title: string;
    description: string;
    theme: string;
    light: string;
    dark: string;
    reduceMotion: string;
    reduceMotionDesc: string;
    compact: string;
    compactDesc: string;
  };
  preferences: {
    title: string;
    description: string;
    language: string;
    languageDesc: string;
    languageUpdated: string;
    saved: string;
    save: string;
    notifications: Record<
      "productUpdates" | "securityAlerts" | "mentions" | "weeklyDigest" | "marketing",
      { title: string; description: string }
    >;
  };
  billing: {
    plan: {
      title: string;
      description: string;
      proTrial: string;
      endsOn: string;
      noCard: string;
      upgrade: string;
    };
    payment: {
      title: string;
      description: string;
      noMethod: string;
      addCard: string;
    };
    invoices: {
      title: string;
      description: string;
      none: string;
    };
    notAvailable: string;
  };
  channels: {
    intro: string;
    plan: {
      title: (name: string) => string;
      description: (name: string, max: number) => string;
      slotsLeft: (n: number) => string;
      limitReached: string;
      upgrade: string;
    };
    connected: string;
    reconnect: string;
    disconnect: string;
    optionsFor: (name: string) => string;
    dismiss: string;
    secureOAuth: string;
    connectedToast: (name: string) => string;
    disconnectedToast: (name: string) => string;
    limitError: (plan: string, max: number) => string;
    oauthError: (provider: string, raw: string) => string;
    serverError: string;
    pinterestTokenPrompt: string;
    verifyFailed: (provider: string) => string;
  };
  tags: {
    visible: string;
    learnMore: string;
    newTag: string;
    search: string;
    noTags: string;
    noMatch: string;
    edit: (label: string) => string;
    delete: (label: string) => string;
    more: (label: string) => string;
    duplicate: string;
    modalCreate: { title: string; description: string };
    modalEdit: { title: string; description: string };
    tagName: string;
    tagNamePlaceholder: string;
    color: string;
    create: string;
    saveChanges: string;
    enterName: string;
    alreadyExists: string;
    updated: string;
    created: string;
    deleted: string;
    duplicated: string;
    copyExists: string;
    duplicateFailed: string;
    saveFailed: string;
    loadFailed: string;
    deleteFailed: string;
    useColorAria: (c: string) => string;
  };
  savedReplies: {
    intro: string;
    emptyHint: string;
    newReply: string;
    edit: (name: string) => string;
    delete: (name: string) => string;
    modalCreate: { title: string; description: string };
    modalEdit: { title: string; description: string };
    name: string;
    namePlaceholder: string;
    content: string;
    contentPlaceholder: string;
    saveReply: string;
    saveChanges: string;
    enterName: string;
    enterContent: string;
    updated: string;
    created: string;
    deleted: string;
    saveFailed: string;
    deleteFailed: string;
    loadFailed: string;
  };
  danger: {
    exportTitle: string;
    exportDescription: string;
    exportHint: string;
    requestExport: string;
    exportRequested: string;
    deleteTitle: string;
    deleteDescription: string;
    deleteButton: string;
    typeToConfirm: (word: string) => string;
    deleteWord: string;
    disabledDemo: string;
  };
  toast: {
    successUpdated: string;
  };
};

const COPY: Record<Lang, Copy> = {
  en: {
    sidebar: {
      title: "Settings",
      backHome: "Back to home",
      navAria: "Settings sections",
      groups: {
        account: "Account",
        organization: "Organization",
        utils: "Utils",
        other: "Other",
      },
      sections: {
        profile: "Profile",
        account: "Security",
        mfa: "Two-factor auth",
        appearance: "Appearance",
        preferences: "Preferences",
        billing: "Billing",
        channels: "Channels",
        tags: "Tags",
        savedReplies: "Saved replies",
        danger: "Danger zone",
      },
      newBadge: "New",
    },
    sectionTitles: {
      profile: "Profile",
      account: "Security",
      mfa: "Two-factor authentication",
      appearance: "Appearance",
      preferences: "Preferences",
      billing: "Billing",
      channels: "Channels",
      tags: "Tags",
      savedReplies: "Saved Replies",
      danger: "Danger zone",
    },
    common: {
      cancel: "Cancel",
      close: "Close",
      save: "Save",
      saving: "Saving…",
      updating: "Updating…",
      verifying: "Verifying…",
      sending: "Sending…",
      remove: "Remove",
      edit: "Edit",
      delete: "Delete",
      loading: "Loading…",
      unsavedChanges: "Unsaved changes",
      tooManyAttempts: (wait) => `Too many attempts. Try again in ${wait}.`,
      formatWaitUnit: (s) =>
        s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`,
    },
    profile: {
      title: "Profile",
      description: "This information is visible to your teammates.",
      loadingFailed: "Failed to load profile",
      signIn: "Please sign in to view your profile.",
      goHome: "Go to home",
      profilePicture: "Profile picture",
      fileHint: "PNG, JPG, GIF or WebP, up to 2 MB.",
      uploading: "Uploading…",
      change: "Change",
      upload: "Upload",
      remove: "Remove",
      saveChanges: "Save changes",
      savingLabel: "Saving…",
      firstName: "First name",
      lastName: "Last name",
      fileSizeError: "File size must be less than 2MB",
      fileTypeError: "File must be an image",
      uploadFailed: "Failed to upload image",
      profileUpdateFailed: "Image uploaded but profile update failed",
      pictureUpdated: "Profile picture updated",
      pictureRemoved: "Profile picture removed",
      removeFailed: "Failed to remove profile picture",
      saveFailed: "Failed to save profile",
      saved: "Profile saved",
    },
    account: {
      email: {
        title: "Email",
        description:
          "We'll send confirmation links and important notices here.",
        label: "Email address",
        checking: "Checking…",
        verified: "Verified",
        unverified: "Unverified",
        twoFaOn: "2FA enabled",
        sendEmail: "Send verification email",
        sending: "Sending…",
        sent: "Verification email sent",
        sendFailed: "Failed to send verification email",
        hint: "Contact support to change your email address.",
      },
      password: {
        title: "Password",
        titleSet: "Set a password",
        descDefault:
          "Use at least 8 characters. Mix letters, numbers, and symbols.",
        descLoading: "Loading your account details…",
        descOauth: (provider) =>
          `You signed in with ${provider}. Set a password to also sign in with your email.`,
        descMfa:
          "Two-factor authentication is on. Changing your password requires a verification code.",
        current: "Current password",
        currentPlaceholder: "••••••••",
        new: "New password",
        newPlaceholder: "••••••••",
        password: "Password",
        confirm: "Confirm password",
        mismatch: "Passwords do not match",
        update: "Update password",
        set: "Set password",
        updating: "Updating…",
        saving: "Saving…",
        setSuccess: "Password set",
        updateSuccess: "Password updated",
        enterCurrent: "Enter your current password",
        enterNew: "Enter a new password",
        enterPassword: "Enter a password",
        tooShort: "Password must be at least 8 characters",
        different: "New password must be different from the current one",
        mismatchNotify: "Passwords do not match",
        updateFailed: "Failed to update password",
        show: "Show password",
        hide: "Hide password",
      },
      oauthFootnote: (provider) =>
        `You can still sign in with ${provider}. To manage that account, open your`,
      oauthSettingsLink: (provider) => `${provider} security settings`,
      strength: ["Too weak", "Weak", "Fair", "Good", "Strong"],
      mfaGate: {
        title: "Two-factor verification required",
        description: "Enter a verification code to change your password.",
      },
    },
    mfa: {
      title: "Two-factor authentication",
      description: "Add an extra layer of security to your account.",
      loadFailed: "Failed to load security settings",
      nudge: {
        text: "Protect your account by enabling two-factor authentication.",
        skip: "Skip",
      },
      authenticator: {
        title: "Authenticator app",
        description:
          "Use an app (Google Authenticator, 1Password, Authy…) to generate a one-time code at sign-in.",
        active: "Active",
        addedOn: (date) => `Added on ${date}`,
        disable: "Disable",
        notEnabled: "Not enabled.",
        blockedByEmail:
          "Disable email verification first to switch to an authenticator app.",
        enable: "Enable authenticator app",
        starting: "Starting…",
      },
      email: {
        title: "Email code",
        description:
          "We email you a 6-digit code every time you sign in.",
        active: "Active",
        yourEmail: "Your email address",
        codesSentHint: "Codes are sent to the email on your account.",
        disable: "Disable",
        notEnabled: "Not enabled.",
        blockedByTotp:
          "Disable the authenticator app first to switch to email codes.",
        enable: "Enable email code",
        sending: "Sending…",
      },
      setup: {
        title: "Set up authenticator",
        description:
          "Scan the QR code with your authenticator app, then enter the 6-digit code it shows.",
        cantScan: "Can't scan? Enter this key manually:",
        copy: "Copy",
        codeHint: "Enter the 6-digit code from your authenticator app.",
        verifyEnable: "Verify & enable",
      },
      emailSetup: {
        title: "Verify your email",
        description: (email) =>
          `We sent a 6-digit code to ${email}. Enter it to turn on email verification.`,
        codeHint: "The code expires in 10 minutes.",
        resendIn: (wait) => `Resend code in ${wait}`,
        resend: "Resend code",
        verifyEnable: "Verify & enable",
      },
      disableModal: {
        title: "Disable two-factor authentication?",
        description:
          "Your account will be protected by your password only. You'll need to verify with a code to continue.",
        confirm: "Disable 2FA",
      },
      notifs: {
        enabled: "Two-factor authentication enabled",
        disabled: "Two-factor authentication disabled",
        copyOk: "Secret copied",
        copyFailed: "Copy failed",
        newCode: "A new code was sent",
        invalidCode: "Invalid code",
        enterCode: "Enter the 6-digit code",
        failedStart: "Failed to start setup",
        failedSend: "Failed to send the code",
        failedDisable: "Failed to disable 2FA",
      },
      challenge: {
        titleDefault: "Verify it's you",
        descriptionDefault: "Enter a verification code to continue.",
        authenticatorLabel: "Authenticator",
        authenticatorN: (n) => `Authenticator ${n}`,
        codeAccepted: "Code accepted. Retry to finish the action.",
        enterCode: "Enter the 6-digit code",
        tooManyAttempts: (wait) =>
          `Too many attempts. Try again in ${wait}.`,
        resendIn: (wait) => `Resend code in ${wait}`,
        resend: "Resend code",
        cancel: "Cancel",
        verifying: "Verifying…",
        retry: "Retry",
        verifyContinue: "Verify & continue",
        emailDescription: (sentTo) =>
          `Enter the 6-digit code we emailed${sentTo ? ` to ${sentTo}` : ""}.`,
        expired: "Verification expired. Enter a new code.",
        invalidRetry: "Invalid code. Try again.",
        noMethodError:
          "Two-factor authentication is enabled but no method was found. Set it up again and retry.",
        noFactorError:
          "No authenticator was found. Set up 2FA again and retry.",
      },
    },
    appearance: {
      title: "Appearance",
      description: "Customize how the interface looks on this device.",
      theme: "Theme",
      light: "Light",
      dark: "Dark",
      reduceMotion: "Reduce motion",
      reduceMotionDesc: "Disable non-essential animations across the app.",
      compact: "Compact mode",
      compactDesc: "Show more content with tighter spacing.",
    },
    preferences: {
      title: "Preferences",
      description:
        "Choose your display language and what we email you about.",
      language: "Language",
      languageDesc: "Language used across the interface.",
      languageUpdated: "Language updated",
      saved: "Preferences saved",
      save: "Save preferences",
      notifications: {
        productUpdates: {
          title: "Product updates",
          description: "New features, improvements, and release notes.",
        },
        securityAlerts: {
          title: "Security alerts",
          description:
            "Sign-ins from new devices and password changes. Recommended.",
        },
        mentions: {
          title: "Mentions",
          description: "When someone mentions you in a comment or thread.",
        },
        weeklyDigest: {
          title: "Weekly digest",
          description:
            "A summary of activity in your workspace, every Monday.",
        },
        marketing: {
          title: "Marketing",
          description: "Tips, offers, and occasional product news.",
        },
      },
    },
    billing: {
      plan: {
        title: "Plan",
        description: "You're currently on a free trial.",
        proTrial: "Pro trial",
        endsOn: "Ends Oct 19, 2026",
        noCard: "No card on file.",
        upgrade: "Upgrade plan",
      },
      payment: {
        title: "Payment method",
        description: "Cards are only charged when a paid plan is active.",
        noMethod: "No payment method on file.",
        addCard: "Add card",
      },
      invoices: {
        title: "Invoices",
        description: "Download past receipts.",
        none: "No invoices yet.",
      },
      notAvailable: "Billing isn't available yet",
    },
    channels: {
      intro:
        "Your connected accounts at a glance. Click on a channel to connect it.",
      plan: {
        title: (name) => `${name} Plan`,
        description: (name, max) =>
          `You are currently on the ${name} plan. You can connect up to ${max} channels.`,
        slotsLeft: (n) => `${n} slots remaining.`,
        limitReached: "Limit reached.",
        upgrade: "Upgrade Plan",
      },
      connected: "Connected",
      reconnect: "Reconnect",
      disconnect: "Disconnect",
      optionsFor: (name) => `Options for ${name}`,
      dismiss: "Dismiss",
      secureOAuth: "Secure OAuth connections",
      connectedToast: (name) => `${name} connected successfully!`,
      disconnectedToast: (name) => `${name} disconnected successfully!`,
      limitError: (plan, max) =>
        `Your ${plan} plan allows up to ${max} channels. Upgrade to connect more.`,
      oauthError: (provider, raw) =>
        raw
          ? `Unable to connect to ${provider}. ${raw}`
          : `Unable to connect to ${provider}.`,
      serverError:
        "Unable to reach the server. Check that the backend is running and VITE_API_URL is correct.",
      pinterestTokenPrompt: "Pinterest access token:",
      verifyFailed: (provider) =>
        `Unable to verify the ${provider} connection. Try again.`,
    },
    tags: {
      visible: "Tags are visible to everyone in your organization.",
      learnMore: "Learn more ↗",
      newTag: "+ New Tag",
      search: "Search tags…",
      noTags: "No tags yet.",
      noMatch: "No tags found.",
      edit: (label) => `Edit ${label}`,
      delete: (label) => `Delete ${label}`,
      more: (label) => `More options for ${label}`,
      duplicate: "Duplicate",
      modalCreate: {
        title: "New Tag",
        description:
          "Create a tag to organize and filter your items.",
      },
      modalEdit: {
        title: "Edit Tag",
        description: "Update this tag's name or color.",
      },
      tagName: "Tag name",
      tagNamePlaceholder: "e.g. Design",
      color: "Color",
      create: "Create tag",
      saveChanges: "Save changes",
      enterName: "Enter a tag name",
      alreadyExists: "Tag already exists",
      updated: "Tag updated",
      created: "Tag created",
      deleted: "Tag deleted",
      duplicated: "Tag duplicated",
      copyExists: "A copy already exists",
      duplicateFailed: "Failed to duplicate tag",
      saveFailed: "Failed to save tag",
      loadFailed: "Failed to load tags",
      deleteFailed: "Failed to delete tag",
      useColorAria: (c) => `Use color ${c}`,
    },
    savedReplies: {
      intro: "Saved Replies are visible to everyone in your organization.",
      emptyHint:
        "Save information you share often to quickly insert it to your replies.",
      newReply: "+ New Saved Reply",
      edit: (name) => `Edit ${name}`,
      delete: (name) => `Delete ${name}`,
      modalCreate: {
        title: "New Saved Reply",
        description: "Create a quick reply to use in your messages.",
      },
      modalEdit: {
        title: "Edit Saved Reply",
        description: "Update this saved reply.",
      },
      name: "Name",
      namePlaceholder: "e.g. Welcome message",
      content: "Content",
      contentPlaceholder: "Write your saved reply",
      saveReply: "Save reply",
      saveChanges: "Save changes",
      enterName: "Enter a name",
      enterContent: "Enter the reply content",
      updated: "Saved reply updated",
      created: "Saved reply created",
      deleted: "Saved reply deleted",
      saveFailed: "Failed to save reply",
      deleteFailed: "Failed to delete saved reply",
      loadFailed: "Failed to load saved replies",
    },
    danger: {
      exportTitle: "Export data",
      exportDescription:
        "Download a copy of everything tied to your account.",
      exportHint: "You'll receive an email with a download link.",
      requestExport: "Request export",
      exportRequested: "Export requested",
      deleteTitle: "Delete account",
      deleteDescription:
        "This permanently removes your account, workspace, and all data. This cannot be undone.",
      deleteButton: "Delete my account",
      typeToConfirm: (word) => `Type "${word}" to confirm`,
      deleteWord: "delete",
      disabledDemo: "Account deletion is disabled in this demo",
    },
    toast: {
      successUpdated: "Saved",
    },
  },
  fr: {
    sidebar: {
      title: "Paramètres",
      backHome: "Retour à l'accueil",
      navAria: "Sections des paramètres",
      groups: {
        account: "Compte",
        organization: "Organisation",
        utils: "Utilitaires",
        other: "Autre",
      },
      sections: {
        profile: "Profil",
        account: "Sécurité",
        mfa: "2FA",
        appearance: "Apparence",
        preferences: "Préférences",
        billing: "Facturation",
        channels: "Canaux",
        tags: "Tags",
        savedReplies: "Réponses enregistrées",
        danger: "Zone de danger",
      },
      newBadge: "Nouveau",
    },
    sectionTitles: {
      profile: "Profil",
      account: "Sécurité",
      mfa: "Authentification à deux facteurs",
      appearance: "Apparence",
      preferences: "Préférences",
      billing: "Facturation",
      channels: "Canaux",
      tags: "Tags",
      savedReplies: "Réponses enregistrées",
      danger: "Zone de danger",
    },
    common: {
      cancel: "Annuler",
      close: "Fermer",
      save: "Enregistrer",
      saving: "Enregistrement…",
      updating: "Mise à jour…",
      verifying: "Vérification…",
      sending: "Envoi…",
      remove: "Retirer",
      edit: "Modifier",
      delete: "Supprimer",
      loading: "Chargement…",
      unsavedChanges: "Modifications non enregistrées",
      tooManyAttempts: (wait) =>
        `Trop de tentatives. Réessayez dans ${wait}.`,
      formatWaitUnit: (s) =>
        s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`,
    },
    profile: {
      title: "Profil",
      description:
        "Ces informations sont visibles par les membres de votre équipe.",
      loadingFailed: "Impossible de charger le profil",
      signIn: "Connectez-vous pour voir votre profil.",
      goHome: "Aller à l'accueil",
      profilePicture: "Photo de profil",
      fileHint: "PNG, JPG, GIF ou WebP, jusqu'à 2 Mo.",
      uploading: "Envoi…",
      change: "Changer",
      upload: "Envoyer",
      remove: "Retirer",
      saveChanges: "Enregistrer",
      savingLabel: "Enregistrement…",
      firstName: "Prénom",
      lastName: "Nom",
      fileSizeError: "La taille du fichier doit être inférieure à 2 Mo",
      fileTypeError: "Le fichier doit être une image",
      uploadFailed: "Impossible de charger l'image",
      profileUpdateFailed:
        "Image envoyée mais la mise à jour du profil a échoué",
      pictureUpdated: "Photo de profil mise à jour",
      pictureRemoved: "Photo de profil retirée",
      removeFailed: "Impossible de retirer la photo de profil",
      saveFailed: "Impossible d'enregistrer le profil",
      saved: "Profil enregistré",
    },
    account: {
      email: {
        title: "E-mail",
        description:
          "Nous envoyons ici les liens de confirmation et les notifications importantes.",
        label: "Adresse e-mail",
        checking: "Vérification…",
        verified: "Vérifiée",
        unverified: "Non vérifiée",
        twoFaOn: "2FA activée",
        sendEmail: "Envoyer l'e-mail de vérification",
        sending: "Envoi…",
        sent: "E-mail de vérification envoyé",
        sendFailed: "Impossible d'envoyer l'e-mail de vérification",
        hint: "Contactez le support pour changer votre adresse e-mail.",
      },
      password: {
        title: "Mot de passe",
        titleSet: "Définir un mot de passe",
        descDefault:
          "Utilisez au moins 8 caractères. Mélangez lettres, chiffres et symboles.",
        descLoading: "Chargement des informations du compte…",
        descOauth: (provider) =>
          `Vous vous êtes connecté avec ${provider}. Définissez un mot de passe pour aussi vous connecter par e-mail.`,
        descMfa:
          "L'authentification à deux facteurs est active. Changer votre mot de passe nécessite un code de vérification.",
        current: "Mot de passe actuel",
        currentPlaceholder: "••••••••",
        new: "Nouveau mot de passe",
        newPlaceholder: "••••••••",
        password: "Mot de passe",
        confirm: "Confirmer le mot de passe",
        mismatch: "Les mots de passe ne correspondent pas",
        update: "Mettre à jour",
        set: "Définir le mot de passe",
        updating: "Mise à jour…",
        saving: "Enregistrement…",
        setSuccess: "Mot de passe défini",
        updateSuccess: "Mot de passe mis à jour",
        enterCurrent: "Saisissez votre mot de passe actuel",
        enterNew: "Saisissez un nouveau mot de passe",
        enterPassword: "Saisissez un mot de passe",
        tooShort: "Le mot de passe doit faire au moins 8 caractères",
        different:
          "Le nouveau mot de passe doit être différent de l'actuel",
        mismatchNotify: "Les mots de passe ne correspondent pas",
        updateFailed: "Impossible de mettre à jour le mot de passe",
        show: "Afficher le mot de passe",
        hide: "Masquer le mot de passe",
      },
      oauthFootnote: (provider) =>
        `Vous pouvez toujours vous connecter avec ${provider}. Pour gérer ce compte, ouvrez vos`,
      oauthSettingsLink: (provider) => `paramètres de sécurité ${provider}`,
      strength: ["Très faible", "Faible", "Moyen", "Bon", "Fort"],
      mfaGate: {
        title: "Vérification à deux facteurs requise",
        description:
          "Saisissez un code de vérification pour changer votre mot de passe.",
      },
    },
    mfa: {
      title: "Authentification à deux facteurs",
      description:
        "Ajoutez une couche de sécurité supplémentaire à votre compte.",
      loadFailed: "Impossible de charger les paramètres de sécurité",
      nudge: {
        text: "Protégez votre compte en activant l'authentification à deux facteurs.",
        skip: "Ignorer",
      },
      authenticator: {
        title: "Application d'authentification",
        description:
          "Utilisez une app (Google Authenticator, 1Password, Authy…) pour générer un code à usage unique à la connexion.",
        active: "Active",
        addedOn: (date) => `Ajoutée le ${date}`,
        disable: "Désactiver",
        notEnabled: "Non activée.",
        blockedByEmail:
          "Désactivez d'abord la vérification par e-mail pour passer à une application d'authentification.",
        enable: "Activer l'application",
        starting: "Démarrage…",
      },
      email: {
        title: "Code par e-mail",
        description:
          "Nous vous envoyons un code à 6 chiffres à chaque connexion.",
        active: "Actif",
        yourEmail: "Votre adresse e-mail",
        codesSentHint:
          "Les codes sont envoyés à l'adresse e-mail de votre compte.",
        disable: "Désactiver",
        notEnabled: "Non activé.",
        blockedByTotp:
          "Désactivez d'abord l'application d'authentification pour passer aux codes par e-mail.",
        enable: "Activer le code par e-mail",
        sending: "Envoi…",
      },
      setup: {
        title: "Configurer l'application",
        description:
          "Scannez le QR code avec votre application d'authentification, puis saisissez le code à 6 chiffres affiché.",
        cantScan:
          "Impossible de scanner ? Saisissez cette clé manuellement :",
        copy: "Copier",
        codeHint:
          "Saisissez le code à 6 chiffres de votre application d'authentification.",
        verifyEnable: "Vérifier & activer",
      },
      emailSetup: {
        title: "Vérifiez votre e-mail",
        description: (email) =>
          `Nous avons envoyé un code à 6 chiffres à ${email}. Saisissez-le pour activer la vérification par e-mail.`,
        codeHint: "Le code expire dans 10 minutes.",
        resendIn: (wait) => `Renvoyer le code dans ${wait}`,
        resend: "Renvoyer le code",
        verifyEnable: "Vérifier & activer",
      },
      disableModal: {
        title: "Désactiver l'authentification à deux facteurs ?",
        description:
          "Votre compte sera protégé uniquement par votre mot de passe. Vous devrez vérifier avec un code pour continuer.",
        confirm: "Désactiver la 2FA",
      },
      notifs: {
        enabled: "Authentification à deux facteurs activée",
        disabled: "Authentification à deux facteurs désactivée",
        copyOk: "Secret copié",
        copyFailed: "Échec de la copie",
        newCode: "Un nouveau code a été envoyé",
        invalidCode: "Code invalide",
        enterCode: "Saisissez le code à 6 chiffres",
        failedStart: "Impossible de démarrer la configuration",
        failedSend: "Impossible d'envoyer le code",
        failedDisable: "Impossible de désactiver la 2FA",
      },
      challenge: {
        titleDefault: "Vérifions que c'est bien vous",
        descriptionDefault:
          "Saisissez un code de vérification pour continuer.",
        authenticatorLabel: "Authentificateur",
        authenticatorN: (n) => `Authentificateur ${n}`,
        codeAccepted:
          "Code accepté. Réessayez pour terminer l'action.",
        enterCode: "Saisissez le code à 6 chiffres",
        tooManyAttempts: (wait) =>
          `Trop de tentatives. Réessayez dans ${wait}.`,
        resendIn: (wait) => `Renvoyer le code dans ${wait}`,
        resend: "Renvoyer le code",
        cancel: "Annuler",
        verifying: "Vérification…",
        retry: "Réessayer",
        verifyContinue: "Vérifier & continuer",
        emailDescription: (sentTo) =>
          `Saisissez le code à 6 chiffres que nous avons envoyé${
            sentTo ? ` à ${sentTo}` : ""
          }.`,
        expired: "Vérification expirée. Saisissez un nouveau code.",
        invalidRetry: "Code invalide. Réessayez.",
        noMethodError:
          "L'authentification à deux facteurs est activée mais aucune méthode n'a été trouvée. Reconfigurez-la et réessayez.",
        noFactorError:
          "Aucun authentificateur trouvé. Reconfigurez la 2FA et réessayez.",
      },
    },
    appearance: {
      title: "Apparence",
      description:
        "Personnalisez l'apparence de l'interface sur cet appareil.",
      theme: "Thème",
      light: "Clair",
      dark: "Sombre",
      reduceMotion: "Réduire les animations",
      reduceMotionDesc:
        "Désactive les animations non essentielles dans l'application.",
      compact: "Mode compact",
      compactDesc:
        "Affiche plus de contenu avec un espacement plus serré.",
    },
    preferences: {
      title: "Préférences",
      description:
        "Choisissez la langue d'affichage et les e-mails que vous recevez.",
      language: "Langue",
      languageDesc: "Langue utilisée dans toute l'interface.",
      languageUpdated: "Langue mise à jour",
      saved: "Préférences enregistrées",
      save: "Enregistrer les préférences",
      notifications: {
        productUpdates: {
          title: "Mises à jour produit",
          description:
            "Nouvelles fonctionnalités, améliorations et notes de version.",
        },
        securityAlerts: {
          title: "Alertes de sécurité",
          description:
            "Connexions depuis de nouveaux appareils et changements de mot de passe. Recommandé.",
        },
        mentions: {
          title: "Mentions",
          description:
            "Quand quelqu'un vous mentionne dans un commentaire ou un fil.",
        },
        weeklyDigest: {
          title: "Résumé hebdomadaire",
          description:
            "Un résumé de l'activité de votre espace de travail, chaque lundi.",
        },
        marketing: {
          title: "Marketing",
          description:
            "Conseils, offres et actualités produit occasionnelles.",
        },
      },
    },
    billing: {
      plan: {
        title: "Offre",
        description: "Vous êtes actuellement en période d'essai gratuite.",
        proTrial: "Essai Pro",
        endsOn: "Se termine le 19 oct. 2026",
        noCard: "Aucune carte enregistrée.",
        upgrade: "Mettre à niveau",
      },
      payment: {
        title: "Moyen de paiement",
        description:
          "Les cartes ne sont débitées que lorsqu'une offre payante est active.",
        noMethod: "Aucun moyen de paiement enregistré.",
        addCard: "Ajouter une carte",
      },
      invoices: {
        title: "Factures",
        description: "Téléchargez vos reçus passés.",
        none: "Aucune facture pour l'instant.",
      },
      notAvailable: "La facturation n'est pas encore disponible",
    },
    channels: {
      intro:
        "Vos comptes connectés en un coup d'œil. Cliquez sur un canal pour le connecter.",
      plan: {
        title: (name) => `Offre ${name}`,
        description: (name, max) =>
          `Vous êtes actuellement sur l'offre ${name}. Vous pouvez connecter jusqu'à ${max} canaux.`,
        slotsLeft: (n) =>
          `${n} place${n === 1 ? "" : "s"} restante${n === 1 ? "" : "s"}.`,
        limitReached: "Limite atteinte.",
        upgrade: "Mettre à niveau",
      },
      connected: "Connecté",
      reconnect: "Reconnecter",
      disconnect: "Déconnecter",
      optionsFor: (name) => `Options pour ${name}`,
      dismiss: "Fermer",
      secureOAuth: "Connexions OAuth sécurisées",
      connectedToast: (name) => `${name} connecté avec succès !`,
      disconnectedToast: (name) => `${name} déconnecté avec succès !`,
      limitError: (plan, max) =>
        `Votre offre ${plan} autorise jusqu'à ${max} canaux. Passez à une offre supérieure pour en connecter davantage.`,
      oauthError: (provider, raw) =>
        raw
          ? `Impossible de connecter ${provider}. ${raw}`
          : `Impossible de connecter ${provider}.`,
      serverError:
        "Impossible de joindre le serveur. Vérifiez que le backend est démarré et que VITE_API_URL est correcte.",
      pinterestTokenPrompt: "Jeton d'accès Pinterest :",
      verifyFailed: (provider) =>
        `Impossible de vérifier la connexion ${provider}. Réessayez.`,
    },
    tags: {
      visible: "Les tags sont visibles par tous les membres de votre organisation.",
      learnMore: "En savoir plus ↗",
      newTag: "Nouveau tag",
      search: "Rechercher des tags…",
      noTags: "Aucun tag pour l'instant.",
      noMatch: "Aucun tag trouvé.",
      edit: (label) => `Modifier ${label}`,
      delete: (label) => `Supprimer ${label}`,
      more: (label) => `Plus d'options pour ${label}`,
      duplicate: "Dupliquer",
      modalCreate: {
        title: "Nouveau tag",
        description:
          "Créez un tag pour organiser et filtrer vos éléments.",
      },
      modalEdit: {
        title: "Modifier le tag",
        description: "Mettez à jour le nom ou la couleur de ce tag.",
      },
      tagName: "Nom du tag",
      tagNamePlaceholder: "ex. Design",
      color: "Couleur",
      create: "Créer le tag",
      saveChanges: "Enregistrer",
      enterName: "Saisissez un nom de tag",
      alreadyExists: "Le tag existe déjà",
      updated: "Tag mis à jour",
      created: "Tag créé",
      deleted: "Tag supprimé",
      duplicated: "Tag dupliqué",
      copyExists: "Une copie existe déjà",
      duplicateFailed: "Impossible de dupliquer le tag",
      saveFailed: "Impossible d'enregistrer le tag",
      loadFailed: "Impossible de charger les tags",
      deleteFailed: "Impossible de supprimer le tag",
      useColorAria: (c) => `Utiliser la couleur ${c}`,
    },
    savedReplies: {
      intro:
        "Les réponses enregistrées sont visibles par tous les membres de votre organisation.",
      emptyHint:
        "Enregistrez les informations que vous partagez souvent pour les insérer rapidement dans vos réponses.",
      newReply: "+ Nouvelle réponse enregistrée",
      edit: (name) => `Modifier ${name}`,
      delete: (name) => `Supprimer ${name}`,
      modalCreate: {
        title: "Nouvelle réponse enregistrée",
        description:
          "Créez une réponse rapide à utiliser dans vos messages.",
      },
      modalEdit: {
        title: "Modifier la réponse enregistrée",
        description: "Mettez à jour cette réponse enregistrée.",
      },
      name: "Nom",
      namePlaceholder: "ex. Message de bienvenue",
      content: "Contenu",
      contentPlaceholder: "Rédigez votre réponse enregistrée",
      saveReply: "Enregistrer la réponse",
      saveChanges: "Enregistrer",
      enterName: "Saisissez un nom",
      enterContent: "Saisissez le contenu de la réponse",
      updated: "Réponse enregistrée mise à jour",
      created: "Réponse enregistrée créée",
      deleted: "Réponse enregistrée supprimée",
      saveFailed: "Impossible d'enregistrer la réponse",
      deleteFailed: "Impossible de supprimer la réponse enregistrée",
      loadFailed: "Impossible de charger les réponses enregistrées",
    },
    danger: {
      exportTitle: "Exporter les données",
      exportDescription:
        "Téléchargez une copie de tout ce qui est lié à votre compte.",
      exportHint:
        "Vous recevrez un e-mail avec un lien de téléchargement.",
      requestExport: "Demander l'export",
      exportRequested: "Export demandé",
      deleteTitle: "Supprimer le compte",
      deleteDescription:
        "Cela supprime définitivement votre compte, votre espace de travail et toutes les données. Cette action est irréversible.",
      deleteButton: "Supprimer mon compte",
      typeToConfirm: (word) => `Saisissez « ${word} » pour confirmer`,
      deleteWord: "supprimer",
      disabledDemo: "La suppression de compte est désactivée dans cette démo",
    },
    toast: {
      successUpdated: "Enregistré",
    },
  },
};

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
const LockIcon = mkIcon(
  <>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>
);
const SunIcon = mkIcon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
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
const SlidersIcon = mkIcon(
  <>
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </>
);
const ChannelsIcon = mkIcon(
  <>
    <circle cx="7.5" cy="7.5" r="2.5" />
    <circle cx="16.5" cy="7.5" r="2.5" />
    <circle cx="7.5" cy="16.5" r="2.5" />
    <circle cx="16.5" cy="16.5" r="2.5" />
  </>
);
const DisconnectIcon = mkIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
  </>,
  "h-4 w-4"
);
const RefreshIcon = mkIcon(
  <>
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21v-5h5" />
  </>,
  "h-4 w-4"
);
const CloseIcon = mkIcon(
  <>
    <path d="m6 6 12 12" />
    <path d="m18 6-12 12" />
  </>,
  "h-4 w-4"
);
const ChevronRightIcon = mkIcon(<path d="m9 18 6-6-6-6" />, "h-4 w-4");
const ChevronDownIcon = mkIcon(<path d="m6 9 6 6 6-6" />, "h-4 w-4");
const BoltIcon = mkIcon(
  <path d="M13 2.5 5 13.2h5.6L9.5 21.5l8-10.7h-5.6L13 2.5Z" />,
  "h-6 w-6"
);
const GlobeIcon = mkIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
  </>,
  "h-4 w-4"
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
  inputMode,
  autoCapitalize,
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
  inputMode?: "numeric" | "text";
  autoCapitalize?: "none" | "characters";
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
          inputMode={inputMode}
          autoCapitalize={autoCapitalize}
          spellCheck={false}
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
  | "mfa"
  | "appearance"
  | "preferences"
  | "billing"
  | "channels"
  | "tags"
  | "savedReplies"
  | "danger";

const SECTION_SLUGS: Record<SectionKey, string> = {
  profile: "profile",
  account: "security",
  mfa: "two-factor",
  appearance: "appearance",
  preferences: "preferences",
  billing: "billing",
  channels: "channels",
  tags: "tags",
  savedReplies: "saved-replies",
  danger: "danger-zone",
};

export const settingsPath = (key: SectionKey) =>
  `settings/${SECTION_SLUGS[key]}`;

export function sectionFromSlug(slug?: string | null): SectionKey | undefined {
  return (Object.keys(SECTION_SLUGS) as SectionKey[]).find(
    (key) => SECTION_SLUGS[key] === slug
  );
}

function buildSidebarGroups(
  c: Copy
): {
  key: SidebarGroupKey;
  items: { key: SectionKey; label: string; icon: ReactNode; badge?: string }[];
}[] {
  return [
    {
      key: "account",
      items: [
        { key: "profile", label: c.sidebar.sections.profile, icon: <UserIcon /> },
        { key: "account", label: c.sidebar.sections.account, icon: <ShieldIcon /> },
        { key: "mfa", label: c.sidebar.sections.mfa, icon: <LockIcon /> },
        {
          key: "preferences",
          label: c.sidebar.sections.preferences,
          icon: <SlidersIcon />,
        },
      ],
    },
    {
      key: "organization",
      items: [
        { key: "billing", label: c.sidebar.sections.billing, icon: <CardIcon /> },
      ],
    },
    {
      key: "utils",
      items: [
        { key: "channels", label: c.sidebar.sections.channels, icon: <ChannelsIcon /> },
        { key: "tags", label: c.sidebar.sections.tags, icon: <TagIcon /> },
        {
          key: "savedReplies",
          label: c.sidebar.sections.savedReplies,
          icon: <ClipboardIcon />,
        },
      ],
    },
    {
      key: "other",
      items: [
        {
          key: "appearance",
          label: c.sidebar.sections.appearance,
          icon: <SunIcon />,
          badge: c.sidebar.newBadge,
        },
        { key: "danger", label: c.sidebar.sections.danger, icon: <AlertIcon /> },
      ],
    },
  ];
}

/** Sidebar desktop (232px, sticky). Jamais rendue sur mobile. */
function SettingsSidebar({
  active,
  onSelect,
  onBack,
  tokens,
  c,
}: {
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  onBack: () => void;
  tokens: Tokens;
  c: Copy;
}) {
  const groups = buildSidebarGroups(c);
  const { show: showMfaNudge } = useMfaNudge();
  return (
    <aside
      className={cx(
        "sticky top-0 flex h-screen w-[232px] shrink-0 flex-col overflow-y-auto border-r transition-colors duration-300",
        tokens.sidebarBg,
        tokens.cardBorder
      )}
    >
      <div className="flex items-center gap-2.5 px-3 pt-5 pb-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={c.sidebar.backHome}
          title={c.sidebar.backHome}
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
          {c.sidebar.title}
        </h2>
      </div>
      <nav aria-label={c.sidebar.navAria} className="px-3 pb-4">
        {groups.map((group, index) => (
          <div key={group.key} className={index === 0 ? "mt-1" : "mt-5"}>
            <p className={cx("mb-1.5 px-3 text-[12px]", tokens.group)}>
              {c.sidebar.groups[group.key]}
            </p>
            <ul className="flex flex-col gap-0.5">
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
                      {item.key === "mfa" && showMfaNudge && (
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
                        />
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

/* ── Détection mobile + deep-link ── */

const MOBILE_QUERY = "(max-width: 767px)";

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(() =>
    typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
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

/**
 * Y a-t-il une section explicite dans l'URL (deep link, retour OAuth…) ?
 * Sert à décider si sur mobile on ouvre directement le contenu ou le menu.
 */
function hasSectionInUrl(): boolean {
  try {
    // Hash : #/settings/profile
    const hash = window.location.hash.replace(/^#\/?/, "");
    const hashParts = hash.split("/").filter(Boolean);
    if (hashParts[0] === "settings" && hashParts[1]) {
      if (sectionFromSlug(hashParts[1])) return true;
    }
    // Chemin : /settings/profile
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const idx = pathParts.lastIndexOf("settings");
    if (idx >= 0 && pathParts[idx + 1]) {
      if (sectionFromSlug(pathParts[idx + 1])) return true;
    }
    // Query string : ?section=channels
    const params = new URLSearchParams(window.location.search);
    if (params.get("section")) return true;
    // Retour OAuth → on présume la section Channels
    if (
      [
        "tiktok",
        "tiktok_error",
        "pinterest",
        "pinterest_error",
        "youtube",
        "youtube_error",
      ].some((k) => params.has(k))
    ) {
      return true;
    }
    try {
      const parsed = JSON.parse(
        sessionStorage.getItem("stone:oauth-returned") ?? "[]"
      );
      if (Array.isArray(parsed) && parsed.length > 0) return true;
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Écran « menu » mobile : liste groupée type iOS Réglages. */
function MobileSettingsMenu({
  active,
  onSelect,
  onBack,
  tokens,
  c,
}: {
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  onBack: () => void;
  tokens: Tokens;
  c: Copy;
}) {
  const groups = buildSidebarGroups(c);
  const { show: showMfaNudge } = useMfaNudge();

  return (
    <div
      className={cx(
        "flex min-h-screen w-full flex-col transition-colors duration-300",
        tokens.pageBg
      )}
    >
      {/* Header avec retour vers home */}
      <header
        className={cx(
          "sticky top-0 z-10 flex items-center gap-2 px-4 pb-2",
          "pt-[calc(12px+env(safe-area-inset-top))]"
        )}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label={c.sidebar.backHome}
          title={c.sidebar.backHome}
          className={cx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
            tokens.item,
            tokens.itemHover,
            tokens.ring
          )}
        >
          <ArrowLeftIcon />
        </button>
        <h1
          className={cx(
            "font-display text-[20px] font-semibold tracking-[-0.01em]",
            tokens.heading
          )}
        >
          {c.sidebar.title}
        </h1>
      </header>

      {/* Liste groupée des sections */}
      <div className="flex-1 px-4 pt-4 pb-[calc(24px+env(safe-area-inset-bottom))]">
        {groups.map((group) => (
          <div key={group.key} className="mb-6">
            <p
              className={cx(
                "mb-2 px-1 text-[12px] font-semibold tracking-wide",
                tokens.group
              )}
            >
              {c.sidebar.groups[group.key]}
            </p>
            <ul
              className={cx(
                "divide-y overflow-hidden rounded-xl border bg-transparent",
                tokens.cardBorder,
                tokens.divide
              )}
            >
              {group.items.map((item) => {
                const isActive = active === item.key;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.key)}
                      aria-current={isActive ? "page" : undefined}
                      className={cx(
                        "flex min-h-[50px] w-full items-center gap-3 px-4 text-left text-[16px] transition-colors",
                        tokens.ring,
                        isActive
                          ? tokens.itemActive
                          : `${tokens.item} ${tokens.itemHover}`
                      )}
                    >
                      <span className={cx("shrink-0", tokens.subtle)}>
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span
                          className={cx(
                            "rounded-full px-2 py-0.5 text-[12px] font-medium",
                            tokens.badgeNew
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                      {item.key === "mfa" && showMfaNudge && (
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
                        />
                      )}
                      <ChevronRightIcon className="h-5 w-5 shrink-0 text-neutral-300 dark:text-neutral-600" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Page ── */
type SettingsProps = {
  theme?: Theme;
  onToggleTheme?: () => void;
  initialSection?: SectionKey;
};
type Notify = (message: string, kind?: "success" | "error") => void;

function initialSection(): SectionKey {
  try {
    const hash = window.location.hash.replace(/^#\/?/, "");
    const hashParts = hash.split("/").filter(Boolean);
    if (hashParts[0] === "settings" && hashParts[1]) {
      const fromSlug = sectionFromSlug(hashParts[1]);
      if (fromSlug) return fromSlug;
    }
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const idx = pathParts.lastIndexOf("settings");
    if (idx >= 0 && pathParts[idx + 1]) {
      const fromSlug = sectionFromSlug(pathParts[idx + 1]);
      if (fromSlug) return fromSlug;
    }
  } catch {
    /* ignore */
  }
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("section") === "channels") return "channels";
    const fromUrl = [
      "tiktok",
      "tiktok_error",
      "pinterest",
      "pinterest_error",
      "youtube",
      "youtube_error",
    ].some((key) => params.has(key));
    const parsed = JSON.parse(sessionStorage.getItem(RETURN_KEY) ?? "[]");
    const pending = Array.isArray(parsed) && parsed.length > 0;
    if (fromUrl || pending) return "channels";
  } catch {
    /* ignore */
  }
  return "profile";
}

export default function Settings(_props: SettingsProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const tokens = useMemo<Tokens>(() => (isDark ? DARK : LIGHT), [isDark]);
  const lang = useLanguage();
  const c = COPY[lang];
  const isMobile = useIsMobile();

  const returning =
    typeof window !== "undefined" &&
    (() => {
      try {
        const parsed = JSON.parse(sessionStorage.getItem(RETURN_KEY) ?? "[]");
        return Array.isArray(parsed) && parsed.length > 0;
      } catch {
        return false;
      }
    })();
  const active: SectionKey = returning
    ? "channels"
    : _props.initialSection ?? initialSection();

  /**
   * Navigation mobile : soit le menu (liste), soit le contenu d'une section.
   * Au mount, on affiche directement le contenu si l'URL pointe déjà sur
   * une section (deep link, retour OAuth, etc.).
   */
  const [mobileView, setMobileView] = useState<"menu" | "content">(() => {
    if (_props.initialSection) return "content";
    if (typeof window === "undefined") return "menu";
    return hasSectionInUrl() ? "content" : "menu";
  });

  const [toast, setToast] = useState<{
    message: string;
    kind: "success" | "error";
  } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  const notify = useCallback<Notify>((message, kind) => {
    const resolved =
      kind ??
      (/fail|error|must|enter|do not|different|impossible|échoué|erreur|requis|saisissez|différent/i.test(
        message
      )
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

  /* Synchronise la vue mobile si l'URL change (back navigateur, retour OAuth…) */
  useEffect(() => {
    if (!isMobile) return;
    const onHashChange = () => {
      setMobileView(hasSectionInUrl() ? "content" : "menu");
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [isMobile]);

  const handleSelectTheme = useCallback(
    (next: "light" | "dark", origin?: { x: number; y: number }) => {
      if (next !== theme) toggle(origin);
    },
    [theme, toggle]
  );

  const handleSelect = useCallback(
    (key: SectionKey) => {
      navigate(settingsPath(key));
      window.scrollTo({ top: 0 });
      if (isMobile) setMobileView("content");
      titleRef.current?.focus();
    },
    [isMobile]
  );

  const handleBack = useCallback(() => navigate("home"), []);

  const handleBackToMenu = useCallback(() => {
    setMobileView("menu");
    window.scrollTo({ top: 0 });
  }, []);

  /* Toast partagé entre les deux vues mobile et la vue desktop */
  const toastNode = (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-[110] -translate-x-1/2 px-4"
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
  );

  /* ─── Vue MOBILE : écran menu ─── */
  if (isMobile && mobileView === "menu") {
    return (
      <main className={cx("min-h-screen w-full", tokens.pageBg)}>
        <MobileSettingsMenu
          active={active}
          onSelect={handleSelect}
          onBack={handleBack}
          tokens={tokens}
          c={c}
        />
        {toastNode}
      </main>
    );
  }

  /* ─── Vue DESKTOP ou MOBILE contenu ─── */
  return (
    <main
      className={cx(
        "min-h-screen w-full transition-colors duration-500",
        tokens.pageBg
      )}
    >
      <div className="flex w-full">
        {!isMobile && (
          <SettingsSidebar
            active={active}
            onSelect={handleSelect}
            onBack={handleBack}
            tokens={tokens}
            c={c}
          />
        )}

        <div
          className={cx(
            "mx-auto w-full min-w-0 flex-1 px-[clamp(16px,4vw,48px)]",
            isMobile
              ? "pt-[calc(12px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))]"
              : "py-[clamp(24px,4vw,56px)]",
            active === "channels" ? "max-w-[1100px]" : "max-w-[840px]"
          )}
        >
          {/* En-tête mobile : retour au menu + fil d'ariane "Settings" */}
          {isMobile && (
            <div className="mb-4 flex items-center gap-1">
              <button
                type="button"
                onClick={handleBackToMenu}
                className={cx(
                  "flex h-10 items-center gap-1 text-[17px] font-medium transition-opacity active:opacity-50",
                  tokens.item
                )}
              >
                <ArrowLeftIcon className="h-5 w-5" />
                {c.sidebar.title}
              </button>
            </div>
          )}

          <h1
            ref={titleRef}
            tabIndex={-1}
            className={cx(
              "mb-[clamp(18px,2.4vw,28px)] font-display text-[clamp(26px,2.6vw,34px)] font-semibold tracking-[-0.02em] outline-none",
              tokens.heading
            )}
          >
            {c.sectionTitles[active]}
          </h1>
          <div className="flex flex-col gap-5">
            {active === "profile" && (
              <ProfileSection tokens={tokens} notify={notify} c={c} />
            )}
            {active === "account" && (
              <AccountSection
                tokens={tokens}
                notify={notify}
                isDark={isDark}
                c={c}
                lang={lang}
              />
            )}
            {active === "mfa" && (
              <MfaSection
                tokens={tokens}
                notify={notify}
                isDark={isDark}
                c={c}
                lang={lang}
              />
            )}
            {active === "appearance" && (
              <AppearanceSection
                tokens={tokens}
                isDark={isDark}
                setTheme={handleSelectTheme}
                c={c}
              />
            )}
            {active === "preferences" && (
              <PreferencesSection
                tokens={tokens}
                notify={notify}
                c={c}
                lang={lang}
              />
            )}
            {active === "billing" && (
              <BillingSection tokens={tokens} notify={notify} c={c} />
            )}
            {active === "channels" && (
              <ChannelsSection
                tokens={tokens}
                notify={notify}
                isDark={isDark}
                c={c}
              />
            )}
            {active === "tags" && (
              <TagsSection
                tokens={tokens}
                notify={notify}
                isDark={isDark}
                c={c}
              />
            )}
            {active === "savedReplies" && (
              <SavedRepliesSection
                tokens={tokens}
                notify={notify}
                isDark={isDark}
                c={c}
              />
            )}
            {active === "danger" && (
              <DangerSection tokens={tokens} notify={notify} c={c} />
            )}
          </div>
        </div>
      </div>

      {toastNode}
    </main>
  );
}

/* ── Profile ── */
function ProfileSection({
  tokens,
  notify,
  c,
}: {
  tokens: Tokens;
  notify: Notify;
  c: Copy;
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
        if (mounted) notify(c.profile.loadingFailed, "error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [notify, c]);

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
      notify(c.profile.fileSizeError, "error");
      return;
    }
    if (!file.type.startsWith("image/")) {
      notify(c.profile.fileTypeError, "error");
      return;
    }
    setUploading(true);
    const previous = avatarUrl;
    try {
      const publicUrl = await uploadAvatar(file, user.id);
      if (!publicUrl) {
        notify(c.profile.uploadFailed, "error");
        return;
      }
      setAvatarUrl(publicUrl);
      setAvatarLoadFailed(false);
      const ok = await updateUserProfile({ avatar_url: publicUrl });
      if (!ok) {
        setAvatarUrl(previous);
        notify(c.profile.profileUpdateFailed, "error");
        return;
      }
      if (previous && previous !== publicUrl) {
        try {
          await deleteAvatar(previous);
        } catch (e) {
          console.warn("Old avatar could not be deleted:", e);
        }
      }
      setUser((cur) => (cur ? { ...cur, avatar_url: publicUrl } : cur));
      notify(c.profile.pictureUpdated);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      setAvatarUrl(previous);
      notify(
        error instanceof Error ? error.message : c.profile.uploadFailed,
        "error"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || !avatarUrl || uploading) return;
    setUploading(true);
    const previous = avatarUrl;
    try {
      const ok = await updateUserProfile({ avatar_url: "" });
      if (!ok) {
        notify(c.profile.removeFailed, "error");
        return;
      }
      setAvatarUrl(null);
      setAvatarLoadFailed(false);
      setUser((cur) => (cur ? { ...cur, avatar_url: undefined } : cur));
      notify(c.profile.pictureRemoved);
      try {
        await deleteAvatar(previous);
      } catch (e) {
        console.warn("Storage cleanup failed (non-blocking):", e);
      }
    } catch (error) {
      console.error("Error removing avatar:", error);
      notify(
        error instanceof Error ? error.message : c.profile.removeFailed,
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
        notify(c.profile.saveFailed, "error");
        return;
      }
      setUser({ ...user, ...next, avatar_url: avatarUrl || undefined });
      notify(c.profile.saved);
    } catch (error) {
      console.error("Error saving profile:", error);
      notify(
        error instanceof Error ? error.message : c.profile.saveFailed,
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SectionCard
        title={c.profile.title}
        description={c.profile.description}
        tokens={tokens}
      >
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
      <SectionCard
        title={c.profile.title}
        description={c.profile.description}
        tokens={tokens}
      >
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className={cx("text-[13.5px]", tokens.body)}>
            {c.profile.signIn}
          </p>
          <Button tokens={tokens} onClick={() => navigate("home")}>
            {c.profile.goHome}
          </Button>
        </div>
      </SectionCard>
    );
  }

  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "U";
  const showImage = Boolean(avatarUrl) && !avatarLoadFailed;

  return (
    <SectionCard
      title={c.profile.title}
      description={c.profile.description}
      tokens={tokens}
      footer={
        <>
          {dirty && (
            <span className={cx("text-[12.5px]", tokens.subtle)}>
              {c.common.unsavedChanges}
            </span>
          )}
          <Button
            tokens={tokens}
            onClick={handleSave}
            disabled={!dirty || saving || uploading}
          >
            {saving ? c.profile.savingLabel : c.profile.saveChanges}
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
              {c.profile.profilePicture}
            </p>
            <p className={cx("mt-0.5 text-[12.5px]", tokens.body)}>
              {c.profile.fileHint}
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
            {uploading
              ? c.profile.uploading
              : avatarUrl
              ? c.profile.change
              : c.profile.upload}
          </label>
          {avatarUrl && (
            <Button
              tokens={tokens}
              variant="secondary"
              onClick={handleRemoveAvatar}
              disabled={uploading}
              className="!px-3.5 !py-2 !font-medium"
            >
              {c.profile.remove}
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-3 pt-5 sm:grid-cols-2">
        <Field
          label={c.profile.firstName}
          value={first}
          onChange={setFirst}
          autoComplete="given-name"
          tokens={tokens}
        />
        <Field
          label={c.profile.lastName}
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

/* ── 2FA : garde MFA + modale de challenge ── */
type MfaGate = {
  method: MfaMethod;
  factors: MfaFactor[];
  run: () => Promise<void>;
};

const TOTP_RE = /^\d{6}$/;
const formatWait = (seconds: number) =>
  seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} s`;
const formatDate = (iso: string | null | undefined, lang: Lang): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(intlLocale(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

function MfaChallengeModal({
  gate,
  onClose,
  onDone,
  title,
  description,
  tokens,
  isDark,
  c,
  lang,
}: {
  gate: MfaGate | null;
  onClose: () => void;
  onDone: () => void;
  title: string;
  description: string;
  tokens: Tokens;
  isDark: boolean;
  c: Copy;
  lang: Lang;
}) {
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const verified = useRef(false);
  const sentFor = useRef<MfaGate | null>(null);
  const method: MfaMethod = gate?.method ?? "totp";

  const sendCode = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const sent = await sendEmailMfaCode("challenge", { force: true });
      setSentTo(sent.sentTo);
      setResendAt(Date.now() + sent.resendIn * 1000);
      setNow(Date.now());
    } catch (e) {
      if (isRateLimitError(e)) {
        setResendAt(Date.now() + e.retryAfterSeconds * 1000);
        setNow(Date.now());
      } else {
        setError(
          e instanceof Error ? e.message : c.mfa.notifs.failedSend
        );
      }
    } finally {
      setSending(false);
    }
  }, [c]);

  useEffect(() => {
    setFactorId(gate?.factors[0]?.id ?? "");
    setCode("");
    setError(null);
    setLockedUntil(0);
    setResendAt(0);
    setSentTo(null);
    verified.current = false;
    if (gate?.method === "email" && sentFor.current !== gate) {
      sentFor.current = gate;
      void sendCode();
    }
    if (!gate) sentFor.current = null;
  }, [gate, sendCode]);

  useEffect(() => {
    if (Math.max(lockedUntil, resendAt) <= Date.now()) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= Math.max(lockedUntil, resendAt)) window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [lockedUntil, resendAt]);

  const waitLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const resendLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const ready = verified.current || TOTP_RE.test(code);

  const submit = async () => {
    if (!gate || busy || waitLeft > 0) return;
    if (!ready) {
      setError(c.mfa.challenge.enterCode);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!verified.current) {
        if (method === "email") await verifyEmailMfaCode(code);
        else await verifyMfaFactorCode(factorId, code);
        verified.current = true;
      }
      await gate.run();
      onDone();
    } catch (e) {
      if (isRateLimitError(e)) {
        setLockedUntil(Date.now() + e.retryAfterSeconds * 1000);
        setNow(Date.now());
      } else if (isMfaRequiredError(e)) {
        verified.current = false;
        setError(c.mfa.challenge.expired);
      } else {
        const msg =
          e instanceof Error ? e.message : c.mfa.notifs.invalidCode;
        setError(
          verified.current
            ? msg
            : /invalid|code|expired/i.test(msg)
            ? c.mfa.challenge.invalidRetry
            : msg
        );
      }
      if (!verified.current) setCode("");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (code.length === 6 && !busy && waitLeft === 0 && !verified.current) {
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const factors = gate?.factors ?? [];

  return (
    <Modal
      open={!!gate}
      onClose={busy ? () => undefined : onClose}
      title={title}
      description={
        method === "email"
          ? c.mfa.challenge.emailDescription(sentTo)
          : description
      }
      dark={isDark}
    >
      <div className="flex flex-col gap-4">
        {method === "totp" && factors.length > 1 && (
          <label className="block">
            <span
              className={cx("mb-1.5 block text-[13px] font-medium", tokens.label)}
            >
              {c.mfa.challenge.authenticatorLabel}
            </span>
            <select
              value={factorId}
              onChange={(e) => setFactorId(e.target.value)}
              className={cx(
                "w-full rounded-[10px] border px-3 py-2.5 text-[14px] outline-none",
                tokens.inputBg,
                tokens.inputText,
                tokens.inputBorder,
                tokens.inputFocus
              )}
            >
              {factors.map((f, i) => (
                <option key={f.id} value={f.id}>
                  {f.friendlyName &&
                  !/^Authenticator \d+$/.test(f.friendlyName)
                    ? f.friendlyName
                    : c.mfa.challenge.authenticatorN(i + 1)}
                  {formatDate(f.createdAt, lang)
                    ? ` · ${formatDate(f.createdAt, lang)}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {verified.current ? (
          <p className={cx("text-[13px]", tokens.body)}>
            {c.mfa.challenge.codeAccepted}
          </p>
        ) : (
          <Field
            label={c.mfa.setup.codeHint}
            value={code}
            onChange={(v) => {
              setCode(v.replace(/\D/g, "").slice(0, 6));
              setError(null);
            }}
            placeholder="000000"
            autoComplete="one-time-code"
            inputMode="numeric"
            error={error ?? undefined}
            onEnter={submit}
            autoFocus
            tokens={tokens}
          />
        )}
        {verified.current && error && (
          <span className="text-[12px] text-red-500">{error}</span>
        )}
        {waitLeft > 0 && (
          <p
            role="alert"
            className={cx("rounded-[10px] px-3 py-2 text-[12.5px]", tokens.warn)}
          >
            {c.common.tooManyAttempts(formatWait(waitLeft))}
          </p>
        )}
        {method === "email" && !verified.current && (
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={sending || resendLeft > 0}
            className={cx(
              "self-start text-[12.5px] font-medium underline underline-offset-2 disabled:no-underline disabled:opacity-60",
              tokens.link,
              tokens.ring
            )}
          >
            {sending
              ? c.common.sending
              : resendLeft > 0
              ? c.mfa.challenge.resendIn(formatWait(resendLeft))
              : c.mfa.challenge.resend}
          </button>
        )}
        <div
          className={cx("flex justify-end gap-2 border-t pt-4", tokens.cardBorder)}
        >
          <Button
            tokens={tokens}
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            {c.common.cancel}
          </Button>
          <Button
            tokens={tokens}
            onClick={submit}
            disabled={busy || waitLeft > 0 || !ready}
          >
            {busy
              ? c.common.verifying
              : verified.current
              ? c.mfa.challenge.retry
              : c.mfa.challenge.verifyContinue}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function useMfaGate({
  tokens,
  notify,
  isDark,
  c,
  lang,
  title,
  description,
}: {
  tokens: Tokens;
  notify: Notify;
  isDark: boolean;
  c: Copy;
  lang: Lang;
  title?: string;
  description?: string;
}) {
  const [gate, setGate] = useState<MfaGate | null>(null);
  const guard = useCallback(
    async (run: () => Promise<void>) => {
      try {
        await run();
      } catch (error) {
        if (!isMfaRequiredError(error)) throw error;
        const status = await getMfaStatus();
        const method = status?.method;
        if (!method) {
          notify(c.mfa.challenge.noMethodError, "error");
          return;
        }
        const factors = method === "totp" ? await listMfaFactors() : [];
        if (method === "totp" && factors.length === 0) {
          notify(c.mfa.challenge.noFactorError, "error");
          return;
        }
        setGate({ method, factors, run });
      }
    },
    [notify, c]
  );
  const modal = (
    <MfaChallengeModal
      gate={gate}
      onClose={() => setGate(null)}
      onDone={() => setGate(null)}
      title={title ?? c.mfa.challenge.titleDefault}
      description={description ?? c.mfa.challenge.descriptionDefault}
      tokens={tokens}
      isDark={isDark}
      c={c}
      lang={lang}
    />
  );
  return { guard, modal };
}

/* ── Security (AccountSection) ── */
function AccountSection({
  tokens,
  notify,
  isDark,
  c,
  lang,
}: {
  tokens: Tokens;
  notify: Notify;
  isDark: boolean;
  c: Copy;
  lang: Lang;
}) {
  const [email, setEmail] = useState("");
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [verified, setVerified] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [provider, setProvider] = useState<string>("email");
  const [hasPassword, setHasPassword] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNext, setConfirmNext] = useState("");
  const [show, setShow] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const { guard, modal: mfaModal } = useMfaGate({
    tokens,
    notify,
    isDark,
    c,
    lang,
    title: c.account.mfaGate.title,
    description: c.account.mfaGate.description,
  });

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
        setMfaEnabled(Boolean(data.mfa_enabled));
      } catch (error) {
        console.error("Error loading account details:", error);
        if (mounted) notify(c.mfa.loadFailed, "error");
      } finally {
        if (mounted) setLoadingAccount(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [notify, c]);

  const handleSendVerification = async () => {
    if (loadingAccount || verified || sendingVerification) return;
    setSendingVerification(true);
    try {
      const ok = await resendVerificationEmail();
      notify(
        ok ? c.account.email.sent : c.account.email.sendFailed,
        ok ? "success" : "error"
      );
    } catch (error) {
      console.error("Error sending verification email:", error);
      notify(
        error instanceof Error ? error.message : c.account.email.sendFailed,
        "error"
      );
    } finally {
      setSendingVerification(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (updatingPassword || loadingAccount) return;
    if (hasPassword && !current)
      return notify(c.account.password.enterCurrent);
    if (!next)
      return notify(
        hasPassword
          ? c.account.password.enterNew
          : c.account.password.enterPassword
      );
    if (next.length < 8) return notify(c.account.password.tooShort);
    if (hasPassword && next === current)
      return notify(c.account.password.different);
    if (next !== confirmNext)
      return notify(c.account.password.mismatchNotify);
    setUpdatingPassword(true);
    const currentPassword = hasPassword ? current : null;
    const newPassword = next;
    const wasSetting = !hasPassword;
    try {
      await guard(async () => {
        await updatePassword(currentPassword, newPassword);
        setCurrent("");
        setNext("");
        setConfirmNext("");
        setHasPassword(true);
        notify(
          wasSetting
            ? c.account.password.setSuccess
            : c.account.password.updateSuccess
        );
      });
    } catch (error) {
      console.error("Error updating password:", error);
      notify(
        isRateLimitError(error)
          ? c.common.tooManyAttempts(formatWait(error.retryAfterSeconds))
          : error instanceof Error
          ? error.message
          : c.account.password.updateFailed,
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
      aria-label={show ? c.account.password.hide : c.account.password.show}
      title={show ? c.account.password.hide : c.account.password.show}
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

  const passwordDescription = loadingAccount
    ? c.account.password.descLoading
    : isOAuthOnly
    ? c.account.password.descOauth(providerLabel ?? "an external provider")
    : mfaEnabled
    ? c.account.password.descMfa
    : c.account.password.descDefault;

  return (
    <>
      <SectionCard
        title={c.account.email.title}
        description={c.account.email.description}
        tokens={tokens}
        footer={
          <Button
            tokens={tokens}
            variant="secondary"
            disabled={loadingAccount || verified || sendingVerification}
            onClick={handleSendVerification}
            className="!px-3.5 !py-2 !font-medium"
          >
            {sendingVerification
              ? c.account.email.sending
              : c.account.email.sendEmail}
          </Button>
        }
      >
        <Field
          label={c.account.email.label}
          type="email"
          value={email}
          placeholder={loadingAccount ? c.common.loading : undefined}
          onChange={() => undefined}
          readOnly
          autoComplete="email"
          hint={c.account.email.hint}
          tokens={tokens}
        />
        <div className="flex items-center gap-2 pt-4">
          <span
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
              verified ? tokens.ok : tokens.warn
            )}
          >
            {verified && <CheckIcon className="h-3 w-3" />}
            {loadingAccount
              ? c.account.email.checking
              : verified
              ? c.account.email.verified
              : c.account.email.unverified}
          </span>
          {mfaEnabled && (
            <span
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
                tokens.ok
              )}
            >
              <LockIcon className="h-3 w-3" />
              {c.account.email.twoFaOn}
            </span>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title={
          isOAuthOnly ? c.account.password.titleSet : c.account.password.title
        }
        description={passwordDescription}
        tokens={tokens}
        footer={
          <Button
            tokens={tokens}
            onClick={handleUpdatePassword}
            disabled={updatingPassword || loadingAccount}
          >
            {updatingPassword
              ? isOAuthOnly
                ? c.account.password.saving
                : c.account.password.updating
              : isOAuthOnly
              ? c.account.password.set
              : c.account.password.update}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {!loadingAccount && !isOAuthOnly && (
            <Field
              label={c.account.password.current}
              type={pwType}
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
              placeholder={c.account.password.currentPlaceholder}
              onEnter={handleUpdatePassword}
              tokens={tokens}
            />
          )}
          <div>
            <Field
              label={
                isOAuthOnly ? c.account.password.password : c.account.password.new
              }
              type={pwType}
              value={next}
              onChange={setNext}
              autoComplete="new-password"
              placeholder={c.account.password.newPlaceholder}
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
                  {c.account.strength[score]}
                </span>
              </div>
            )}
          </div>
          <Field
            label={c.account.password.confirm}
            type={pwType}
            value={confirmNext}
            onChange={setConfirmNext}
            autoComplete="new-password"
            placeholder={c.account.password.newPlaceholder}
            error={mismatch ? c.account.password.mismatch : undefined}
            onEnter={handleUpdatePassword}
            tokens={tokens}
          />
        </div>
        {isOAuthOnly && providerLabel && (
          <p className={cx("pt-4 text-[12.5px] leading-relaxed", tokens.body)}>
            {c.account.oauthFootnote(providerLabel)}{" "}
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
              {c.account.oauthSettingsLink(providerLabel)}
            </a>
            .
          </p>
        )}
      </SectionCard>
      {mfaModal}
    </>
  );
}

/* ── MFA ── */
function MfaSection({
  tokens,
  notify,
  isDark,
  c,
  lang,
}: {
  tokens: Tokens;
  notify: Notify;
  isDark: boolean;
  c: Copy;
  lang: Lang;
}) {
  const [method, setMethod] = useState<MfaMethod | null>(null);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<null | "totp" | "email">(null);

  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [emailEnroll, setEmailEnroll] = useState<{
    sentTo: string | null;
  } | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [disableTarget, setDisableTarget] = useState<
    null | { type: "totp"; id: string } | { type: "email" }
  >(null);
  const [disabling, setDisabling] = useState(false);

  const { show: showMfaNudge, skip: skipMfaNudge } = useMfaNudge();

  const { guard, modal: mfaModal } = useMfaGate({
    tokens,
    notify,
    isDark,
    c,
    lang,
  });

  const enrollmentRef = useRef<typeof enrollment>(null);
  useEffect(() => {
    enrollmentRef.current = enrollment;
  }, [enrollment]);

  useEffect(
    () => () => {
      const pending = enrollmentRef.current;
      if (pending) void cancelMfaEnrollment(pending.factorId).catch(() => {});
    },
    []
  );

  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= resendAt) window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  const loadAll = useCallback(async () => {
    const status = await getMfaStatus();
    const current = status?.method ?? null;
    setMethod(current);
    setEmailHint(status?.email_hint ?? null);
    setFactors(current === "totp" ? await listMfaFactors() : []);
    // Synchronise la notification (rond jaune) avec l'état réel de la 2FA.
    if (status) notifyMfaStatusChanged(current !== null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadAll();
      } catch (e) {
        console.error("Error loading MFA settings:", e);
        notify(c.mfa.loadFailed, "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadAll, notify, c]);

  const errorMessage = (e: unknown, fallback: string) =>
    isRateLimitError(e)
      ? c.common.tooManyAttempts(formatWait(e.retryAfterSeconds))
      : e instanceof Error
      ? e.message
      : fallback;

  const resendLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const handleStartTotp = async () => {
    if (starting) return;
    setStarting("totp");
    try {
      const data = await startMfaEnrollment();
      enrollmentRef.current = data;
      setEnrollment(data);
      setCode("");
    } catch (e) {
      console.error("Error starting MFA enrollment:", e);
      notify(errorMessage(e, c.mfa.notifs.failedStart), "error");
    } finally {
      setStarting(null);
    }
  };

  const sendEnrollEmail = async () => {
    const sent = await sendEmailMfaCode("enroll", { force: true });
    setEmailEnroll({ sentTo: sent.sentTo ?? emailHint });
    setResendAt(Date.now() + sent.resendIn * 1000);
    setNow(Date.now());
    setCode("");
  };

  const handleStartEmail = async () => {
    if (starting) return;
    setStarting("email");
    try {
      await sendEnrollEmail();
    } catch (e) {
      console.error("Error starting email MFA:", e);
      notify(errorMessage(e, c.mfa.notifs.failedSend), "error");
    } finally {
      setStarting(null);
    }
  };

  const handleResendEnroll = async () => {
    if (resendLeft > 0 || confirming) return;
    try {
      await sendEnrollEmail();
      notify(c.mfa.notifs.newCode);
    } catch (e) {
      notify(errorMessage(e, c.mfa.notifs.failedSend), "error");
    }
  };

  const handleCancel = async () => {
    const pending = enrollment;
    enrollmentRef.current = null;
    setEnrollment(null);
    setEmailEnroll(null);
    setCode("");
    if (pending) {
      try {
        await cancelMfaEnrollment(pending.factorId);
      } catch (e) {
        console.warn("Error cancelling enrollment:", e);
      }
    }
  };

  const handleConfirm = async () => {
    if ((!enrollment && !emailEnroll) || confirming) return;
    if (!TOTP_RE.test(code)) {
      notify(c.mfa.notifs.enterCode, "error");
      return;
    }
    setConfirming(true);
    try {
      if (enrollment) {
        await confirmMfaEnrollment(enrollment.factorId, code);
        enrollmentRef.current = null;
        setEnrollment(null);
      } else {
        await confirmEmailMfaEnrollment(code);
        setEmailEnroll(null);
      }
      setCode("");
      await loadAll();
      void revokeOtherSessions();
      notify(c.mfa.notifs.enabled);
    } catch (e) {
      console.error("Error confirming MFA enrollment:", e);
      notify(errorMessage(e, c.mfa.notifs.invalidCode), "error");
      setCode("");
    } finally {
      setConfirming(false);
    }
  };

  useEffect(() => {
    if ((enrollment || emailEnroll) && code.length === 6 && !confirming) {
      void handleConfirm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleDisable = async () => {
    const target = disableTarget;
    if (!target || disabling) return;
    setDisableTarget(null);
    setDisabling(true);
    try {
      await guard(async () => {
        if (target.type === "email") await disableEmailMfa();
        else await disableMfa(target.id);
        await loadAll();
        void revokeOtherSessions();
        notify(c.mfa.notifs.disabled);
      });
    } catch (e) {
      console.error("Error disabling MFA:", e);
      notify(errorMessage(e, c.mfa.notifs.failedDisable), "error");
    } finally {
      setDisabling(false);
    }
  };

  const factorLabel = (f: MfaFactor) => {
    const n = f.friendlyName;
    if (!n || /^Authenticator \d+$/.test(n))
      return c.mfa.authenticator.title;
    return n;
  };

  const copySecret = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      notify(c.mfa.notifs.copyOk);
    } catch {
      notify(c.mfa.notifs.copyFailed, "error");
    }
  };

  if (loading) {
    return (
      <SectionCard
        title={c.mfa.title}
        description={c.mfa.description}
        tokens={tokens}
      >
        <div className="animate-pulse space-y-3 py-2" aria-busy="true">
          <div className={cx("h-11 rounded-[10px]", tokens.track)} />
        </div>
      </SectionCard>
    );
  }

  if (enrollment) {
    return (
      <>
        <SectionCard
          title={c.mfa.setup.title}
          description={c.mfa.setup.description}
          tokens={tokens}
        >
          <div className="flex flex-col gap-5 py-1">
            <div className="flex flex-col items-center gap-3">
              <img
                src={enrollment.qrCode}
                alt="QR"
                className="h-48 w-48 rounded-lg bg-white p-2"
              />
              <p className={cx("text-center text-[12.5px]", tokens.body)}>
                {c.mfa.setup.cantScan}
              </p>
              <div className="flex items-center gap-2">
                <code
                  className={cx(
                    "rounded-md px-2.5 py-1.5 font-mono text-[12px] tracking-wider break-all",
                    tokens.muted,
                    tokens.heading
                  )}
                >
                  {enrollment.secret}
                </code>
                <Button
                  tokens={tokens}
                  variant="secondary"
                  onClick={copySecret}
                  className="!px-2.5 !py-1.5 !text-[12px]"
                >
                  {c.mfa.setup.copy}
                </Button>
              </div>
            </div>
            <Field
              label={c.mfa.setup.codeHint}
              type="text"
              value={code}
              onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              autoComplete="one-time-code"
              inputMode="numeric"
              onEnter={handleConfirm}
              tokens={tokens}
              hint={c.mfa.setup.codeHint}
            />
            <div className="flex justify-end gap-2">
              <Button
                tokens={tokens}
                variant="secondary"
                onClick={handleCancel}
                disabled={confirming}
              >
                {c.common.cancel}
              </Button>
              <Button
                tokens={tokens}
                onClick={handleConfirm}
                disabled={confirming || code.length !== 6}
              >
                {confirming
                  ? c.common.verifying
                  : c.mfa.setup.verifyEnable}
              </Button>
            </div>
          </div>
        </SectionCard>
        {mfaModal}
      </>
    );
  }

  if (emailEnroll) {
    return (
      <>
        <SectionCard
          title={c.mfa.emailSetup.title}
          description={c.mfa.emailSetup.description(
            emailEnroll.sentTo ?? "your email address"
          )}
          tokens={tokens}
        >
          <div className="flex flex-col gap-4 py-1">
            <Field
              label={c.mfa.emailSetup.codeHint}
              value={code}
              onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              autoComplete="one-time-code"
              inputMode="numeric"
              onEnter={handleConfirm}
              autoFocus
              tokens={tokens}
              hint={c.mfa.emailSetup.codeHint}
            />
            <button
              type="button"
              onClick={() => void handleResendEnroll()}
              disabled={resendLeft > 0 || confirming}
              className={cx(
                "self-start text-[12.5px] font-medium underline underline-offset-2 disabled:no-underline disabled:opacity-60",
                tokens.link,
                tokens.ring
              )}
            >
              {resendLeft > 0
                ? c.mfa.emailSetup.resendIn(formatWait(resendLeft))
                : c.mfa.emailSetup.resend}
            </button>
            <div className="flex justify-end gap-2">
              <Button
                tokens={tokens}
                variant="secondary"
                onClick={handleCancel}
                disabled={confirming}
              >
                {c.common.cancel}
              </Button>
              <Button
                tokens={tokens}
                onClick={handleConfirm}
                disabled={confirming || code.length !== 6}
              >
                {confirming
                  ? c.common.verifying
                  : c.mfa.emailSetup.verifyEnable}
              </Button>
            </div>
          </div>
        </SectionCard>
        {mfaModal}
      </>
    );
  }

  const otherActive = (self: MfaMethod) => method !== null && method !== self;

  return (
    <>
      {showMfaNudge && method === null && (
        <div
          className={cx(
            "flex flex-col gap-3 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
            tokens.card,
            tokens.cardBorder
          )}
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400"
            />
            <p className={cx("text-[13px]", tokens.body)}>
              {c.mfa.nudge.text}
            </p>
          </div>
          <Button
            tokens={tokens}
            variant="secondary"
            onClick={skipMfaNudge}
            className="!px-3 !py-1.5 !text-[12.5px] sm:shrink-0"
          >
            {c.mfa.nudge.skip}
          </Button>
        </div>
      )}

      <SectionCard
        title={c.mfa.authenticator.title}
        description={c.mfa.authenticator.description}
        tokens={tokens}
      >
        {method === "totp" ? (
          <div className="flex flex-col gap-3 py-1">
            {factors.map((f) => {
              const added = formatDate(f.createdAt, lang);
              return (
                <div
                  key={f.id}
                  className={cx(
                    "flex items-center justify-between gap-3 rounded-[10px] border px-4 py-3",
                    tokens.cardBorder
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={cx(
                          "text-[13.5px] font-medium",
                          tokens.heading
                        )}
                      >
                        {factorLabel(f)}
                      </p>
                      <span
                        className={cx(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          tokens.ok
                        )}
                      >
                        {c.mfa.authenticator.active}
                      </span>
                    </div>
                    {added && (
                      <p className={cx("mt-0.5 text-[12px]", tokens.subtle)}>
                        {c.mfa.authenticator.addedOn(added)}
                      </p>
                    )}
                  </div>
                  <Button
                    tokens={tokens}
                    variant="secondary"
                    onClick={() => setDisableTarget({ type: "totp", id: f.id })}
                    disabled={disabling}
                    className="!px-3 !py-1.5 !text-[12.5px]"
                  >
                    {c.mfa.authenticator.disable}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
            <p className={cx("text-[12.5px]", tokens.body)}>
              {otherActive("totp")
                ? c.mfa.authenticator.blockedByEmail
                : c.mfa.authenticator.notEnabled}
            </p>
            <Button
              tokens={tokens}
              onClick={handleStartTotp}
              disabled={!!starting || otherActive("totp")}
              className="sm:shrink-0"
            >
              {starting === "totp"
                ? c.mfa.authenticator.starting
                : c.mfa.authenticator.enable}
            </Button>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={c.mfa.email.title}
        description={c.mfa.email.description}
        tokens={tokens}
      >
        {method === "email" ? (
          <div
            className={cx(
              "flex items-center justify-between gap-3 rounded-[10px] border px-4 py-3",
              tokens.cardBorder
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className={cx("text-[13.5px] font-medium", tokens.heading)}>
                  {emailHint ?? c.mfa.email.yourEmail}
                </p>
                <span
                  className={cx(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    tokens.ok
                  )}
                >
                  {c.mfa.email.active}
                </span>
              </div>
              <p className={cx("mt-0.5 text-[12px]", tokens.subtle)}>
                {c.mfa.email.codesSentHint}
              </p>
            </div>
            <Button
              tokens={tokens}
              variant="secondary"
              onClick={() => setDisableTarget({ type: "email" })}
              disabled={disabling}
              className="!px-3 !py-1.5 !text-[12.5px]"
            >
              {c.mfa.email.disable}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
            <p className={cx("text-[12.5px]", tokens.body)}>
              {otherActive("email")
                ? c.mfa.email.blockedByTotp
                : c.mfa.email.notEnabled}
            </p>
            <Button
              tokens={tokens}
              onClick={handleStartEmail}
              disabled={!!starting || otherActive("email")}
              className="sm:shrink-0"
            >
              {starting === "email" ? c.mfa.email.sending : c.mfa.email.enable}
            </Button>
          </div>
        )}
      </SectionCard>

      <Modal
        open={!!disableTarget}
        onClose={() => setDisableTarget(null)}
        title={c.mfa.disableModal.title}
        description={c.mfa.disableModal.description}
        dark={isDark}
      >
        <div
          className={cx("flex justify-end gap-2 border-t pt-4", tokens.cardBorder)}
        >
          <Button
            tokens={tokens}
            variant="secondary"
            onClick={() => setDisableTarget(null)}
          >
            {c.common.cancel}
          </Button>
          <Button tokens={tokens} variant="danger" onClick={handleDisable}>
            {c.mfa.disableModal.confirm}
          </Button>
        </div>
      </Modal>
      {mfaModal}
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
  c,
}: {
  tokens: Tokens;
  isDark: boolean;
  setTheme: (t: "light" | "dark", origin?: { x: number; y: number }) => void;
  c: Copy;
}) {
  const options: { key: "light" | "dark"; label: string }[] = [
    { key: "light", label: c.appearance.light },
    { key: "dark", label: c.appearance.dark },
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
      title={c.appearance.title}
      description={c.appearance.description}
      tokens={tokens}
    >
      <div className="pb-5">
        <p className={cx("mb-2.5 text-[13px] font-medium", tokens.label)}>
          {c.appearance.theme}
        </p>
        <div
          role="radiogroup"
          aria-label={c.appearance.theme}
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
        title={c.appearance.reduceMotion}
        description={c.appearance.reduceMotionDesc}
        tokens={tokens}
      >
        <Toggle
          checked={reduceMotion}
          onChange={setReduceMotion}
          label={c.appearance.reduceMotion}
          tokens={tokens}
        />
      </Row>
      <Row
        title={c.appearance.compact}
        description={c.appearance.compactDesc}
        tokens={tokens}
      >
        <Toggle
          checked={compact}
          onChange={setCompact}
          label={c.appearance.compact}
          tokens={tokens}
        />
      </Row>
    </SectionCard>
  );
}

/* ── Preferences ── */
const LANGUAGES: { value: "fr" | "en"; native: string; short: string }[] = [
  { value: "fr", native: "Français", short: "FR" },
  { value: "en", native: "English", short: "EN" },
];

function LanguagePicker({
  value,
  onChange,
  tokens,
  ariaLabel,
}: {
  value: "fr" | "en";
  onChange: (value: "fr" | "en") => void;
  tokens: Tokens;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.value === value) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "group flex h-10 min-w-[170px] items-center gap-2.5 rounded-full border px-3.5 text-[13px] font-medium transition-all duration-200",
          "hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
          tokens.inputBg,
          tokens.inputText,
          tokens.inputBorder,
          tokens.inputFocus,
          tokens.ring
        )}
      >
        <span className={cx("shrink-0 transition-colors", tokens.subtle)}>
          <GlobeIcon className="h-[15px] w-[15px]" />
        </span>
        <span className="flex-1 text-left">{current.native}</span>
        <ChevronDownIcon
          className={cx(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
            tokens.subtle,
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={cx(
            "absolute top-[calc(100%+6px)] right-0 z-50 w-[210px] overflow-hidden rounded-xl border shadow-xl",
            tokens.card,
            tokens.cardBorder
          )}
          style={{ animation: "fadeSlideIn 150ms ease-out" }}
        >
          <ul className="p-1">
            {LANGUAGES.map((lang) => {
              const isActive = lang.value === value;
              return (
                <li key={lang.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      onChange(lang.value);
                      setOpen(false);
                    }}
                    className={cx(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                      tokens.ring,
                      isActive
                        ? tokens.itemActive
                        : `${tokens.item} ${tokens.itemHover}`
                    )}
                  >
                    <span
                      className={cx(
                        "w-6 shrink-0 text-center text-[10.5px] font-semibold tracking-[0.06em] uppercase",
                        isActive ? "opacity-80" : tokens.subtle
                      )}
                    >
                      {lang.short}
                    </span>
                    <span className="flex-1">{lang.native}</span>
                    {isActive && (
                      <CheckIcon className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function PreferencesSection({
  tokens,
  notify,
  c,
  lang,
}: {
  tokens: Tokens;
  notify: Notify;
  c: Copy;
  lang: Lang;
}) {
  const [language, setLanguageState] = useState<"fr" | "en">(lang);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    productUpdates: true,
    securityAlerts: true,
    weeklyDigest: false,
    mentions: true,
    marketing: false,
  });

  useEffect(() => {
    setLanguageState(lang);
  }, [lang]);

  const savedPrefs = useRef(prefs);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(savedPrefs.current);

  const setLanguage = (next: "fr" | "en") => {
    if (next === language) return;
    setLanguageState(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      /* stockage indisponible */
    }
    try {
      document.documentElement.lang = next;
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(LANGUAGE_CHANGED_EVENT));
    notify(COPY[next].preferences.languageUpdated, "success");
  };

  const save = () => {
    savedPrefs.current = prefs;
    setPrefs((prev) => ({ ...prev }));
    notify(c.preferences.saved);
  };

  const NOTIFICATION_KEYS = [
    "productUpdates",
    "securityAlerts",
    "mentions",
    "weeklyDigest",
    "marketing",
  ] as const;

  return (
    <SectionCard
      title={c.preferences.title}
      description={c.preferences.description}
      tokens={tokens}
      footer={
        <>
          {dirty && (
            <span className={cx("text-[12.5px]", tokens.subtle)}>
              {c.common.unsavedChanges}
            </span>
          )}
          <Button tokens={tokens} onClick={save} disabled={!dirty}>
            {c.preferences.save}
          </Button>
        </>
      }
    >
      <Row
        title={c.preferences.language}
        description={c.preferences.languageDesc}
        tokens={tokens}
      >
        <LanguagePicker
          value={language}
          onChange={setLanguage}
          tokens={tokens}
          ariaLabel={c.preferences.language}
        />
      </Row>
      {NOTIFICATION_KEYS.map((key) => {
        const item = c.preferences.notifications[key];
        return (
          <Row
            key={key}
            title={item.title}
            description={item.description}
            tokens={tokens}
          >
            <Toggle
              checked={prefs[key]}
              onChange={(value) =>
                setPrefs((prev) => ({ ...prev, [key]: value }))
              }
              label={item.title}
              tokens={tokens}
            />
          </Row>
        );
      })}
    </SectionCard>
  );
}

/* ── Billing ── */
function BillingSection({
  tokens,
  notify,
  c,
}: {
  tokens: Tokens;
  notify: Notify;
  c: Copy;
}) {
  const soon = () => notify(c.billing.notAvailable, "error");
  return (
    <>
      <SectionCard
        title={c.billing.plan.title}
        description={c.billing.plan.description}
        tokens={tokens}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className={cx("text-[14px] font-medium", tokens.heading)}>
                {c.billing.plan.proTrial}
              </p>
              <span
                className={cx(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  tokens.warn
                )}
              >
                {c.billing.plan.endsOn}
              </span>
            </div>
            <p className={cx("mt-0.5 text-[12.5px]", tokens.body)}>
              {c.billing.plan.noCard}
            </p>
          </div>
          <Button tokens={tokens} onClick={soon}>
            {c.billing.plan.upgrade}
          </Button>
        </div>
      </SectionCard>
      <SectionCard
        title={c.billing.payment.title}
        description={c.billing.payment.description}
        tokens={tokens}
      >
        <div className="flex items-center justify-between gap-3">
          <p className={cx("text-[13px]", tokens.body)}>
            {c.billing.payment.noMethod}
          </p>
          <Button
            tokens={tokens}
            variant="secondary"
            onClick={soon}
            className="!px-3.5 !py-2 !font-medium"
          >
            {c.billing.payment.addCard}
          </Button>
        </div>
      </SectionCard>
      <SectionCard
        title={c.billing.invoices.title}
        description={c.billing.invoices.description}
        tokens={tokens}
      >
        <p className={cx("text-[13px]", tokens.body)}>
          {c.billing.invoices.none}
        </p>
      </SectionCard>
    </>
  );
}

/* ── Utils · Channels ── */
type StatusResponse = {
  connected: boolean;
  account:
    | {
        display_name?: string | null;
        avatar_url?: string | null;
        avatarUrl?: string | null;
      }
    | null
    | undefined;
};

type ChannelTokens = {
  text: string;
  muted: string;
  icon: string;
  iconConnected: string;
  ring: string;
  avatarBadgeBg: string;
};

export const INSIGHT_ROUTE = "insights";

const initialConnections: ConnectionState = {
  instagram: { connected: false },
  facebook: { connected: false },
  tiktok: { connected: false },
  youtube: { connected: false },
  pinterest: { connected: false },
  threads: { connected: false },
};

function formatOAuthError(provider: string, error: unknown, c: Copy): string {
  const raw = error instanceof Error ? error.message : "";
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return c.channels.serverError;
  }
  return c.channels.oauthError(provider, raw);
}

function mockHandleFor(key: ChannelKey): string {
  const handles: Record<ChannelKey, string> = {
    instagram: "@ronan.studio",
    facebook: "Ronan Studio",
    threads: "@ronan.studio",
    tiktok: "",
    youtube: "",
    pinterest: "",
  };
  return handles[key];
}

function toConnection(status: StatusResponse): Connection {
  if (!status.connected) {
    return { connected: false };
  }
  const account = status.account;
  return {
    connected: true,
    handle: account?.display_name ?? undefined,
    avatarUrl: account?.avatar_url ?? account?.avatarUrl ?? undefined,
  };
}

const RETURN_KEY = "stone:oauth-returned";

function readReturned(): CacheProvider[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(RETURN_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as CacheProvider[]) : [];
  } catch {
    return [];
  }
}

function writeReturned(list: CacheProvider[]) {
  try {
    if (list.length === 0) sessionStorage.removeItem(RETURN_KEY);
    else sessionStorage.setItem(RETURN_KEY, JSON.stringify(list));
  } catch {
    /* storage indisponible */
  }
}

function markReturning(provider: CacheProvider) {
  writeReturned(Array.from(new Set([...readReturned(), provider])));
}

function buildAccount(
  channel: Channel,
  connection: Connection
): OnboardingAccount {
  return {
    key: channel.key,
    name: channel.name,
    accountLabel: channel.accountLabel,
    handle: connection.handle,
    avatarUrl: connection.avatarUrl,
  };
}

const channelTokens = (isDark: boolean): ChannelTokens =>
  isDark
    ? {
        text: "text-white",
        muted: "text-neutral-500",
        icon: "border-white/[0.08] bg-white/[0.04] text-neutral-300",
        iconConnected: "border-white/20 bg-white/10 text-white",
        ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
        avatarBadgeBg: "bg-[#0f0f11] text-white ring-[#0f0f11]",
      }
    : {
        text: "text-neutral-900",
        muted: "text-neutral-500",
        icon: "border-black/[0.06] bg-[#f6f4f0] text-neutral-600",
        iconConnected: "border-black/10 bg-black/[0.04] text-neutral-900",
        ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25",
        avatarBadgeBg: "bg-white text-black ring-white",
      };

function ChannelAvatar({
  channel,
  connection,
  t,
}: {
  channel: Channel;
  connection: Connection;
  t: ChannelTokens;
}) {
  const Icon = channel.icon;
  const [imageFailed, setImageFailed] = useState(false);
  const hasAvatar = Boolean(connection.avatarUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [connection.avatarUrl]);

  if (connection.connected && hasAvatar) {
    return (
      <span className="relative h-11 w-11 shrink-0">
        <img
          src={connection.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="h-11 w-11 rounded-[14px] object-cover select-none"
        />
        <span
          className={cx(
            "absolute -right-1 -bottom-1 flex h-[18px] w-[18px] items-center justify-center",
            "rounded-[5px] text-black ring-2",
            t.avatarBadgeBg
          )}
        >
          <Icon className="h-[11px] w-[11px]" size={11} />
        </span>
      </span>
    );
  }
  return (
    <div
      className={cx(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border",
        connection.connected ? t.iconConnected : t.icon
      )}
    >
      <Icon className="h-[21px] w-[21px]" size={21} />
    </div>
  );
}

function ChannelRow({
  channel,
  connection,
  pending,
  disabled,
  t,
  isDark,
  onToggle,
  onReconnect,
  c,
}: {
  channel: Channel;
  connection: Connection;
  pending: boolean;
  disabled: boolean;
  t: ChannelTokens;
  isDark: boolean;
  onToggle: () => void;
  onReconnect: () => void;
  c: Copy;
}) {
  const isConnected = connection.connected;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div
      onClick={() => !isConnected && !disabled && !pending && onToggle()}
      className={cx(
        "group relative flex items-center gap-4 rounded-xl px-4 py-4 transition-colors",
        !isConnected && !disabled
          ? isDark
            ? "cursor-pointer hover:bg-white/[0.04]"
            : "cursor-pointer hover:bg-black/[0.03]"
          : "",
        disabled ? "opacity-50" : ""
      )}
    >
      <ChannelAvatar channel={channel} connection={connection} t={t} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cx("text-[14px] font-semibold", t.text)}>
          {isConnected ? connection.handle || channel.name : channel.name}
        </span>
        <span className="truncate text-[12.5px] text-neutral-400">
          {isConnected ? c.channels.connected : channel.subtitle}
        </span>
      </div>
      {isConnected ? (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            aria-label={c.channels.optionsFor(channel.name)}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((value) => !value);
            }}
            className={cx(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
              t.muted,
              isDark
                ? "hover:bg-white/[0.06] hover:text-white"
                : "hover:bg-black/[0.05] hover:text-neutral-900",
              t.ring
            )}
          >
            <MoreIcon className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div
              className={cx(
                "absolute top-10 right-0 z-50 w-44 rounded-xl border p-1 shadow-xl",
                isDark
                  ? "border-white/[0.08] bg-[#16161a]"
                  : "border-black/[0.06] bg-white"
              )}
            >
              <button
                type="button"
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onReconnect();
                }}
                className={cx(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] font-medium disabled:opacity-40",
                  isDark
                    ? "text-neutral-200 hover:bg-white/[0.06] hover:text-white"
                    : "text-neutral-700 hover:bg-black/[0.04] hover:text-neutral-900"
                )}
              >
                <RefreshIcon />
                {c.channels.reconnect}
              </button>
              <div
                className={cx(
                  "my-1 h-px",
                  isDark ? "bg-white/[0.06]" : "bg-black/[0.06]"
                )}
              />
              <button
                type="button"
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onToggle();
                }}
                className={cx(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] font-medium disabled:opacity-40",
                  isDark
                    ? "text-rose-400 hover:bg-rose-500/[0.07]"
                    : "text-rose-600 hover:bg-rose-500/[0.07]"
                )}
              >
                <DisconnectIcon />
                {c.channels.disconnect}
              </button>
            </div>
          )}
        </div>
      ) : (
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5" />
      )}
    </div>
  );
}

/* ── Channels section ── */
function ChannelsSection({
  tokens,
  notify,
  isDark,
  c,
}: {
  tokens: Tokens;
  notify: Notify;
  isDark: boolean;
  c: Copy;
}) {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const t = useMemo(() => channelTokens(isDark), [isDark]);

  const [connections, setConnections] = useState<ConnectionState>(() => {
    if (!userId) return initialConnections;
    const tiktok = readCache(userId, "tiktok");
    const pinterest = readCache(userId, "pinterest");
    const youtube = readCache(userId, "youtube");
    return {
      ...initialConnections,
      ...(tiktok ? { tiktok: tiktok.connection } : {}),
      ...(pinterest ? { pinterest: pinterest.connection } : {}),
      ...(youtube ? { youtube: youtube.connection } : {}),
    };
  });
  const [pendingKey, setPendingKey] = useState<ChannelKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [onboardingAccount, setOnboardingAccount] =
    useState<OnboardingAccount | null>(null);
  const [confirming, setConfirming] = useState(false);
  const tiktokBusy = useRef(false);
  const pinterestBusy = useRef(false);
  const youtubeBusy = useRef(false);

  const startOnboarding = (key: ChannelKey, connection: Connection) => {
    const channel = CHANNELS.find((ch) => ch.key === key);
    if (!channel) return;
    setConfirming(false);
    setOnboardingAccount(buildAccount(channel, connection));
    notify(c.channels.connectedToast(channel.name), "success");
  };

  const handleConfirmAccount = () => {
    if (!onboardingAccount || confirming) return;
    const account = onboardingAccount;
    setConfirming(true);
    window.setTimeout(() => {
      setOnboardingAccount(null);
      setConfirming(false);
      navigate(`${INSIGHT_ROUTE}?channel=${encodeURIComponent(account.key)}`);
      window.setTimeout(() => openFrequencyOnboarding(account, isDark), 150);
    }, 300);
  };

  const handleRejectAccount = () => {
    if (!onboardingAccount) return;
    const key = onboardingAccount.key;
    setOnboardingAccount(null);
    handleToggle(key);
  };

  const handleCloseOnboarding = () => {
    setOnboardingAccount(null);
    setConfirming(false);
  };

  const connectedCount = useMemo(
    () => CHANNELS.filter((ch) => connections[ch.key].connected).length,
    [connections]
  );
  const limitReached = connectedCount >= PLAN.maxChannels;
  const slotsLeft = Math.max(0, PLAN.maxChannels - connectedCount);

  useEffect(() => {
    if (!userId) return;
    const basePath = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const tiktokError = params.get("tiktok_error");
    const pinterestError = params.get("pinterest_error");
    const youtubeError = params.get("youtube_error");
    const fromUrl: Record<CacheProvider, boolean> = {
      tiktok: params.has("tiktok") || Boolean(tiktokError),
      pinterest: params.has("pinterest") || Boolean(pinterestError),
      youtube: params.has("youtube") || Boolean(youtubeError),
    };
    const oauthErrors: Record<CacheProvider, string | null> = {
      tiktok: tiktokError,
      pinterest: pinterestError,
      youtube: youtubeError,
    };
    const providers: CacheProvider[] = ["tiktok", "pinterest", "youtube"];
    const pendingReturn = new Set<CacheProvider>(readReturned());
    providers.forEach((p) => {
      if (fromUrl[p]) pendingReturn.add(p);
      if (oauthErrors[p]) pendingReturn.delete(p);
    });
    writeReturned([...pendingReturn]);
    const returned: Record<CacheProvider, boolean> = {
      tiktok: pendingReturn.has("tiktok"),
      pinterest: pendingReturn.has("pinterest"),
      youtube: pendingReturn.has("youtube"),
    };
    if (tiktokError)
      setErrorMessage(c.channels.oauthError("TikTok", tiktokError));
    if (pinterestError)
      setErrorMessage(c.channels.oauthError("Pinterest", pinterestError));
    if (youtubeError)
      setErrorMessage(c.channels.oauthError("YouTube Shorts", youtubeError));

    if (returned.tiktok) clearCache(userId, "tiktok");
    if (returned.pinterest) clearCache(userId, "pinterest");
    if (returned.youtube) clearCache(userId, "youtube");

    if (fromUrl.tiktok || fromUrl.pinterest || fromUrl.youtube) {
      [
        "tiktok",
        "tiktok_error",
        "pinterest",
        "pinterest_error",
        "youtube",
        "youtube_error",
      ].forEach((key) => params.delete(key));
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        `${basePath}${qs ? `?${qs}` : ""}${window.location.hash}`
      );
    }
    let cancelled = false;
    const sync = (
      provider: CacheProvider,
      justReturned: boolean,
      fetchStatus: () => Promise<StatusResponse>
    ) => {
      const cached = justReturned ? null : readCache(userId, provider);
      if (cached) {
        setConnections((current) => ({
          ...current,
          [provider]: cached.connection,
        }));
        if (Date.now() - cached.savedAt < CACHE_MAX_AGE_MS) return;
      }
      void (async () => {
        try {
          const status = await fetchStatus();
          if (cancelled) return;
          if (justReturned) {
            writeReturned(readReturned().filter((p) => p !== provider));
          }
          const connection = toConnection(status);
          if (connection.connected) writeCache(userId, connection, provider);
          else clearCache(userId, provider);
          setConnections((current) => ({
            ...current,
            [provider]: connection,
          }));
          if (justReturned && connection.connected) {
            startOnboarding(provider, connection);
          }
        } catch (error) {
          console.warn(`Could not load ${provider} status:`, error);
          if (justReturned && !cancelled) {
            setErrorMessage(c.channels.verifyFailed(provider));
          }
        }
      })();
    };
    sync("tiktok", returned.tiktok, getTikTokStatus);
    sync("pinterest", returned.pinterest, getPinterestStatus);
    sync("youtube", returned.youtube, getYouTubeStatus);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, c]);

  useEffect(() => {
    if (!userId) return;
    const refreshConnections = () => {
      setConnections((current) => ({
        ...current,
        tiktok:
          readCache(userId, "tiktok")?.connection ?? { connected: false },
        pinterest:
          readCache(userId, "pinterest")?.connection ?? { connected: false },
        youtube:
          readCache(userId, "youtube")?.connection ?? { connected: false },
      }));
    };
    window.addEventListener(CHANNELS_CHANGED_EVENT, refreshConnections);
    return () =>
      window.removeEventListener(CHANNELS_CHANGED_EVENT, refreshConnections);
  }, [userId]);

  const handleTikTokToggle = async (isReconnect = false) => {
    if (tiktokBusy.current) return;
    tiktokBusy.current = true;
    setPendingKey("tiktok");
    let redirecting = false;
    try {
      if (connections.tiktok.connected) {
        await disconnectTikTok();
        if (userId) clearCache(userId, "tiktok");
        setConnections((current) => ({
          ...current,
          tiktok: { connected: false },
        }));
        if (!isReconnect) {
          notify(c.channels.disconnectedToast("TikTok"), "success");
          return;
        }
      }
      markReturning("tiktok");
      await startTikTokLogin();
      redirecting = true;
    } catch (error) {
      console.error("TikTok OAuth error:", error);
      setErrorMessage(formatOAuthError("TikTok", error, c));
    } finally {
      if (!redirecting) {
        setPendingKey(null);
        tiktokBusy.current = false;
      }
    }
  };

  const handlePinterestToggle = async (isReconnect = false) => {
    if (pinterestBusy.current) return;
    pinterestBusy.current = true;
    setPendingKey("pinterest");
    let redirecting = false;
    try {
      if (connections.pinterest.connected) {
        await disconnectPinterest();
        if (userId) clearCache(userId, "pinterest");
        setConnections((current) => ({
          ...current,
          pinterest: { connected: false },
        }));
        if (!isReconnect) {
          notify(c.channels.disconnectedToast("Pinterest"), "success");
          return;
        }
      }
      if (import.meta.env.VITE_PINTEREST_MANUAL_TOKEN === "true") {
        const token = window.prompt(c.channels.pinterestTokenPrompt);
        if (!token?.trim()) {
          setPendingKey(null);
          return;
        }
        const account = await connectPinterestWithToken(token.trim());
        const connection: Connection = {
          connected: true,
          handle: account?.display_name ?? undefined,
          avatarUrl: account?.avatar_url ?? undefined,
        };
        if (userId) writeCache(userId, connection, "pinterest");
        setConnections((current) => ({ ...current, pinterest: connection }));
        startOnboarding("pinterest", connection);
      } else {
        markReturning("pinterest");
        await startPinterestLogin();
        redirecting = true;
      }
    } catch (error) {
      console.error("Pinterest OAuth error:", error);
      setErrorMessage(formatOAuthError("Pinterest", error, c));
    } finally {
      if (!redirecting) {
        setPendingKey(null);
        pinterestBusy.current = false;
      }
    }
  };

  const handleYouTubeToggle = async (isReconnect = false) => {
    if (youtubeBusy.current) return;
    youtubeBusy.current = true;
    setPendingKey("youtube");
    let redirecting = false;
    try {
      if (connections.youtube.connected) {
        await disconnectYouTube();
        if (userId) clearCache(userId, "youtube");
        setConnections((current) => ({
          ...current,
          youtube: { connected: false },
        }));
        if (!isReconnect) {
          notify(c.channels.disconnectedToast("YouTube Shorts"), "success");
          return;
        }
      }
      markReturning("youtube");
      await startYouTubeLogin();
      redirecting = true;
    } catch (error) {
      console.error("YouTube OAuth error:", error);
      setErrorMessage(formatOAuthError("YouTube Shorts", error, c));
    } finally {
      if (!redirecting) {
        setPendingKey(null);
        youtubeBusy.current = false;
      }
    }
  };

  const handlePlaceholderToggle = (key: ChannelKey) => {
    const wasConnected = connections[key].connected;
    const name = CHANNELS.find((ch) => ch.key === key)?.name ?? key;
    setPendingKey(key);
    window.setTimeout(() => {
      if (wasConnected) {
        setConnections((current) => ({
          ...current,
          [key]: { connected: false },
        }));
        notify(c.channels.disconnectedToast(name), "success");
      } else {
        const connection: Connection = {
          connected: true,
          handle: mockHandleFor(key),
        };
        setConnections((current) => ({ ...current, [key]: connection }));
        startOnboarding(key, connection);
      }
      setPendingKey(null);
    }, 450);
  };

  const handlePlaceholderReconnect = (key: ChannelKey) => {
    setPendingKey(key);
    window.setTimeout(() => {
      const connection: Connection = {
        connected: true,
        handle: mockHandleFor(key),
      };
      setConnections((current) => ({ ...current, [key]: connection }));
      startOnboarding(key, connection);
      setPendingKey(null);
    }, 450);
  };

  function handleToggle(key: ChannelKey) {
    setErrorMessage(null);
    if (!connections[key].connected && limitReached) {
      setErrorMessage(c.channels.limitError(PLAN.name, PLAN.maxChannels));
      return;
    }
    if (key === "tiktok") return void handleTikTokToggle();
    if (key === "pinterest") return void handlePinterestToggle();
    if (key === "youtube") return void handleYouTubeToggle();
    handlePlaceholderToggle(key);
  }

  function handleReconnect(key: ChannelKey) {
    setErrorMessage(null);
    if (key === "tiktok") return void handleTikTokToggle(true);
    if (key === "pinterest") return void handlePinterestToggle(true);
    if (key === "youtube") return void handleYouTubeToggle(true);
    handlePlaceholderReconnect(key);
  }

  const handleUpgrade = () => console.log("[Stone] Upgrade clicked");

  const panelSurface = isDark
    ? "border-white/[0.07] bg-white/[0.03]"
    : "border-black/[0.06] bg-[#f6f4f0]";
  const mutedText = isDark ? "text-neutral-500" : "text-neutral-400";
  const strongText = isDark ? "text-white" : "text-neutral-900";

  return (
    <>
      <p className={cx("text-[13px]", mutedText)}>{c.channels.intro}</p>

      <div
        className={cx(
          "relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl border p-6 md:flex-row md:items-center md:p-8",
          panelSurface
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cx(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
              isDark
                ? "bg-white/[0.06] text-white"
                : "bg-white text-black shadow-sm ring-1 ring-black/[0.05]"
            )}
          >
            <BoltIcon />
          </div>
          <div>
            <h2 className={cx("text-lg font-bold tracking-tight", strongText)}>
              {c.channels.plan.title(PLAN.name)}
            </h2>
            <p className={cx("mt-1 text-[13px]", mutedText)}>
              {c.channels.plan.description(PLAN.name, PLAN.maxChannels)}{" "}
              {slotsLeft > 0
                ? c.channels.plan.slotsLeft(slotsLeft)
                : c.channels.plan.limitReached}
            </p>
          </div>
        </div>
        <Button tokens={tokens} onClick={handleUpgrade} className="shrink-0">
          {c.channels.plan.upgrade}
        </Button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex shrink-0 items-center gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 text-[12px] text-rose-600 dark:text-rose-400"
          style={isDark ? { color: "#fb7185" } : undefined}
        >
          <span className="flex-1">{errorMessage}</span>
          <button
            type="button"
            aria-label={c.channels.dismiss}
            onClick={() => setErrorMessage(null)}
            className="rounded-md p-1 hover:bg-rose-500/10"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:gap-4">
        {CHANNELS.map((channel) => (
          <ChannelRow
            key={channel.key}
            channel={channel}
            connection={connections[channel.key]}
            pending={pendingKey === channel.key}
            disabled={false}
            t={t}
            isDark={isDark}
            onToggle={() => handleToggle(channel.key)}
            onReconnect={() => handleReconnect(channel.key)}
            c={c}
          />
        ))}
      </div>

      <div className={cx("flex items-center justify-between text-[11px]", mutedText)}>
        <span>{c.channels.secureOAuth}</span>
      </div>

      {onboardingAccount && (
        <ConfirmAccountModal
          account={onboardingAccount}
          isDark={isDark}
          loading={confirming}
          onConfirm={handleConfirmAccount}
          onReject={handleRejectAccount}
          onClose={handleCloseOnboarding}
        />
      )}
    </>
  );
}

/* ── Tags ── */
const TAG_COLORS = [
  "bg-[#6366f1]",
  "bg-[#ec4899]",
  "bg-[#ef4444]",
  "bg-[#f97316]",
  "bg-[#eab308]",
  "bg-[#84cc16]",
  "bg-[#14b8a6]",
  "bg-[#0ea5e9]",
  "bg-[#6b7280]",
  "bg-[#4c1d95]",
  "bg-[#701a75]",
  "bg-[#7f1d1d]",
  "bg-[#7c2d12]",
  "bg-[#713f12]",
  "bg-[#14532d]",
  "bg-[#134e4a]",
  "bg-[#1e3a8a]",
  "bg-[#171717]",
];

function TagsSection({
  tokens,
  notify,
  isDark,
  c,
}: {
  tokens: Tokens;
  notify: Notify;
  isDark: boolean;
  c: Copy;
}) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [draft, setDraft] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await listTags();
        if (mounted) setTags(data);
      } catch (e) {
        console.error("Error loading tags:", e);
        if (mounted) notify(c.tags.loadFailed, "error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [notify, c]);

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

  const handleSave = async () => {
    if (busy) return;
    const label = draft.trim();
    if (!label) return notify(c.tags.enterName, "error");
    const duplicate = tags.some(
      (t) =>
        t.label.toLowerCase() === label.toLowerCase() && t.id !== editing?.id
    );
    if (duplicate) return notify(c.tags.alreadyExists, "error");
    setBusy(true);
    try {
      if (editing) {
        const updated = await updateTag(editing.id, { label, color });
        setTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        notify(c.tags.updated);
      } else {
        const created = await createTag(label, color);
        setTags((prev) => [...prev, created]);
        notify(c.tags.created);
      }
      closeModal();
    } catch (e) {
      console.error("Error saving tag:", e);
      notify(
        isDuplicateError(e)
          ? c.tags.alreadyExists
          : e instanceof Error
          ? e.message
          : c.tags.saveFailed,
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setMenuOpenId(null);
    const previous = tags;
    setTags((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteTag(id);
      notify(c.tags.deleted);
    } catch (e) {
      console.error("Error deleting tag:", e);
      setTags(previous);
      notify(c.tags.deleteFailed, "error");
    }
  };

  const duplicateTag = async (tag: Tag) => {
    setMenuOpenId(null);
    try {
      const created = await createTag(`${tag.label} copy`, tag.color);
      setTags((prev) => [...prev, created]);
      notify(c.tags.duplicated);
    } catch (e) {
      notify(
        isDuplicateError(e) ? c.tags.copyExists : c.tags.duplicateFailed,
        "error"
      );
    }
  };

  const iconBtn = cx(
    "flex h-8 w-8 items-center justify-center rounded-md transition",
    tokens.subtle,
    tokens.ghostHover,
    tokens.ring
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={cx("text-[13.5px] leading-relaxed", tokens.body)}>
          {c.tags.visible}{" "}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className={cx(
              "font-medium underline underline-offset-2 transition-opacity hover:opacity-80",
              tokens.link
            )}
          >
            {c.tags.learnMore}
          </a>
        </p>
        <div className="sm:shrink-0">
          <Button tokens={tokens} onClick={openCreate}>
            {c.tags.newTag}
          </Button>
        </div>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-neutral-500">
          <SearchIcon className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={c.tags.search}
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

      {loading ? (
        <div className="animate-pulse space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cx("h-12 rounded-[10px]", tokens.track)} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className={cx(
            "rounded-2xl border py-8 text-center text-[13px]",
            tokens.card,
            tokens.cardBorder,
            tokens.body
          )}
        >
          {tags.length === 0 ? c.tags.noTags : c.tags.noMatch}
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
            <div key={tag.id} className="flex items-center gap-3 px-4 py-3.5">
              <span
                className={cx("h-3.5 w-3.5 shrink-0 rounded-full", tag.color)}
              />
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
                aria-label={c.tags.edit(tag.label)}
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(tag.id)}
                className={cx(iconBtn, "hover:!text-red-400")}
                aria-label={c.tags.delete(tag.label)}
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
                  aria-label={c.tags.more(tag.label)}
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
                        {c.tags.duplicate}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={
          editing ? c.tags.modalEdit.title : c.tags.modalCreate.title
        }
        description={
          editing
            ? c.tags.modalEdit.description
            : c.tags.modalCreate.description
        }
        dark={isDark}
      >
        <div className="flex flex-col gap-4">
          <Field
            label={c.tags.tagName}
            value={draft}
            onChange={setDraft}
            placeholder={c.tags.tagNamePlaceholder}
            onEnter={handleSave}
            autoFocus
            tokens={tokens}
          />
          <div>
            <p className={cx("mb-2 text-[13px] font-medium", tokens.label)}>
              {c.tags.color}
            </p>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((cColor) => (
                <button
                  key={cColor}
                  type="button"
                  aria-label={c.tags.useColorAria(cColor)}
                  aria-pressed={color === cColor}
                  onClick={() => setColor(cColor)}
                  className={cx(
                    "flex h-8 w-8 items-center justify-center rounded-full transition",
                    cColor,
                    color === cColor
                      ? "scale-110 ring-2 ring-white/70 ring-offset-2 ring-offset-transparent"
                      : "opacity-70 hover:opacity-100"
                  )}
                >
                  {color === cColor && (
                    <CheckIcon className="h-3.5 w-3.5 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div
            className={cx(
              "flex justify-end gap-2 border-t pt-4",
              tokens.cardBorder
            )}
          >
            <Button tokens={tokens} variant="secondary" onClick={closeModal}>
              {c.common.cancel}
            </Button>
            <Button
              tokens={tokens}
              onClick={handleSave}
              disabled={!draft.trim() || busy}
            >
              {busy
                ? c.common.saving
                : editing
                ? c.tags.saveChanges
                : c.tags.create}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ── Saved replies ── */
function SavedRepliesSection({
  tokens,
  notify,
  isDark,
  c,
}: {
  tokens: Tokens;
  notify: Notify;
  isDark: boolean;
  c: Copy;
}) {
  const [replies, setReplies] = useState<SavedReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SavedReply | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await listSavedReplies();
        if (mounted) setReplies(data);
      } catch (e) {
        console.error("Error loading saved replies:", e);
        if (mounted) notify(c.savedReplies.loadFailed, "error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [notify, c]);

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
    if (busy) return;
    setModalOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (busy) return;
    const cleanName = name.trim();
    const cleanContent = content.trim();
    if (!cleanName) return notify(c.savedReplies.enterName, "error");
    if (!cleanContent) return notify(c.savedReplies.enterContent, "error");
    setBusy(true);
    try {
      if (editing) {
        const updated = await updateSavedReply(editing.id, {
          name: cleanName,
          content: cleanContent,
        });
        setReplies((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        );
        notify(c.savedReplies.updated);
      } else {
        const created = await createSavedReply(cleanName, cleanContent);
        setReplies((prev) => [...prev, created]);
        notify(c.savedReplies.created);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      console.error("Error saving saved reply:", e);
      notify(
        e instanceof Error ? e.message : c.savedReplies.saveFailed,
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    const previous = replies;
    setReplies((prev) => prev.filter((r) => r.id !== id));
    try {
      await deleteSavedReply(id);
      notify(c.savedReplies.deleted);
    } catch (e) {
      console.error("Error deleting saved reply:", e);
      setReplies(previous);
      notify(c.savedReplies.deleteFailed, "error");
    }
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
        {c.savedReplies.intro}
      </p>

      {loading ? (
        <div className="animate-pulse space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cx("h-16 rounded-[10px]", tokens.track)} />
          ))}
        </div>
      ) : replies.length === 0 ? (
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
            {c.savedReplies.emptyHint}
          </p>
          <Button tokens={tokens} onClick={openCreate}>
            {c.savedReplies.newReply}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button tokens={tokens} onClick={openCreate}>
              {c.savedReplies.newReply}
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
                  <p className={cx("text-[14px] font-medium", tokens.heading)}>
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
                    aria-label={c.savedReplies.edit(reply.name)}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(reply.id)}
                    className={cx(iconBtn, "hover:!text-red-400")}
                    aria-label={c.savedReplies.delete(reply.name)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={
          editing
            ? c.savedReplies.modalEdit.title
            : c.savedReplies.modalCreate.title
        }
        description={
          editing
            ? c.savedReplies.modalEdit.description
            : c.savedReplies.modalCreate.description
        }
        dark={isDark}
      >
        <div className="flex flex-col gap-4">
          <Field
            label={c.savedReplies.name}
            value={name}
            onChange={setName}
            placeholder={c.savedReplies.namePlaceholder}
            autoFocus
            tokens={tokens}
          />
          <div className="flex flex-col gap-1.5">
            <span className={cx("text-[13px] font-medium", tokens.label)}>
              {c.savedReplies.content}
            </span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={c.savedReplies.contentPlaceholder}
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
              <span className={cx("text-[12px] tabular-nums", tokens.subtle)}>
                {content.length}/1000
              </span>
            </div>
          </div>
          <div
            className={cx(
              "flex justify-end gap-2 border-t pt-4",
              tokens.cardBorder
            )}
          >
            <Button
              tokens={tokens}
              variant="secondary"
              onClick={closeModal}
              disabled={busy}
            >
              {c.common.cancel}
            </Button>
            <Button
              tokens={tokens}
              onClick={handleSave}
              disabled={!name.trim() || !content.trim() || busy}
            >
              {busy
                ? c.common.saving
                : editing
                ? c.savedReplies.saveChanges
                : c.savedReplies.saveReply}
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
  c,
}: {
  tokens: Tokens;
  notify: Notify;
  c: Copy;
}) {
  const [confirm, setConfirm] = useState("");
  const canDelete = confirm.trim().toLowerCase() === c.danger.deleteWord;
  const handleDelete = () => {
    if (!canDelete) return;
    notify(c.danger.disabledDemo, "error");
  };
  return (
    <>
      <SectionCard
        title={c.danger.exportTitle}
        description={c.danger.exportDescription}
        tokens={tokens}
      >
        <div className="flex items-center justify-between gap-3">
          <p className={cx("text-[13px]", tokens.body)}>
            {c.danger.exportHint}
          </p>
          <Button
            tokens={tokens}
            variant="secondary"
            onClick={() => notify(c.danger.exportRequested)}
            className="!px-3.5 !py-2 !font-medium"
          >
            {c.danger.requestExport}
          </Button>
        </div>
      </SectionCard>
      <SectionCard
        title={c.danger.deleteTitle}
        description={c.danger.deleteDescription}
        tokens={tokens}
        danger
        footer={
          <Button
            tokens={tokens}
            variant="danger"
            disabled={!canDelete}
            onClick={handleDelete}
          >
            {c.danger.deleteButton}
          </Button>
        }
      >
        <Field
          label={c.danger.typeToConfirm(c.danger.deleteWord)}
          value={confirm}
          onChange={setConfirm}
          placeholder={c.danger.deleteWord}
          onEnter={handleDelete}
          tokens={tokens}
        />
      </SectionCard>
    </>
  );
}