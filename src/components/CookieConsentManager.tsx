import { useEffect, useState } from "react";

type CookieConsent = {
  version: 1;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

const STORAGE_KEY = "stone:cookie-consent";
const CONSENT_VERSION = 1;

function readConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CookieConsent>;
    if (
      value.version !== CONSENT_VERSION ||
      typeof value.analytics !== "boolean" ||
      typeof value.marketing !== "boolean"
    ) return null;
    return {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: value.analytics,
      marketing: value.marketing,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    };
  } catch {
    return null;
  }
}

function isFrench(): boolean {
  try {
    return window.localStorage.getItem("stone:language") === "fr";
  } catch {
    return false;
  }
}

export default function CookieConsentManager() {
  const [consent, setConsent] = useState<CookieConsent | null>(() => readConsent());
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [analytics, setAnalytics] = useState(() => readConsent()?.analytics ?? false);
  const [marketing, setMarketing] = useState(() => readConsent()?.marketing ?? false);
  const [french, setFrench] = useState(false);

  useEffect(() => {
    setFrench(isFrench());
    const onLanguageChange = () => setFrench(isFrench());
    const onOpenSettings = () => {
      const current = readConsent();
      setAnalytics(current?.analytics ?? false);
      setMarketing(current?.marketing ?? false);
      setPreferencesOpen(true);
    };
    window.addEventListener("stone:language-changed", onLanguageChange);
    window.addEventListener("stone:open-cookie-settings", onOpenSettings);
    return () => {
      window.removeEventListener("stone:language-changed", onLanguageChange);
      window.removeEventListener("stone:open-cookie-settings", onOpenSettings);
    };
  }, []);

  const save = (nextAnalytics: boolean, nextMarketing: boolean) => {
    const next: CookieConsent = {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: nextAnalytics,
      marketing: nextMarketing,
      updatedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The current choice remains active for this page view if storage is unavailable.
    }
    setConsent(next);
    setPreferencesOpen(false);
    window.dispatchEvent(new CustomEvent("stone:cookie-consent-changed", {
      detail: next,
    }));
  };

  const copy = french
    ? {
        title: "Vos choix en matière de cookies",
        body: "Les cookies nécessaires assurent le fonctionnement et la sécurité de Stone. Les catégories facultatives restent désactivées tant que vous ne les autorisez pas.",
        necessary: "Nécessaires",
        necessaryHelp: "Toujours actifs — connexion et sécurité.",
        analytics: "Mesure d’audience",
        analyticsHelp: "Autoriser les traceurs de mesure d’audience, s’ils sont activés.",
        marketing: "Marketing",
        marketingHelp: "Autoriser les traceurs publicitaires, s’ils sont activés.",
        accept: "Tout accepter",
        reject: "Tout refuser",
        customize: "Personnaliser",
        save: "Enregistrer mes choix",
        manage: "Gérer les cookies",
        privacy: "Politique de confidentialité",
      }
    : {
        title: "Your cookie choices",
        body: "Necessary storage supports Stone’s operation and security. Optional categories remain disabled unless you choose to allow them.",
        necessary: "Necessary",
        necessaryHelp: "Always active — authentication and security.",
        analytics: "Analytics",
        analyticsHelp: "Allow analytics trackers, if enabled.",
        marketing: "Marketing",
        marketingHelp: "Allow advertising trackers, if enabled.",
        accept: "Accept all",
        reject: "Reject all",
        customize: "Customize",
        save: "Save my choices",
        manage: "Manage cookies",
        privacy: "Privacy policy",
      };

  return (
    <>
      {!consent && !preferencesOpen && (
        <section
          aria-label={copy.title}
          className="fixed inset-x-3 bottom-3 z-[120] mx-auto max-w-[680px] rounded-2xl border border-black/10 bg-white p-4 text-neutral-900 shadow-[0_18px_60px_rgba(0,0,0,0.2)] dark:border-white/10 dark:bg-[#111] dark:text-white sm:inset-x-5 sm:bottom-5 sm:p-5"
        >
          <h2 className="text-sm font-semibold">{copy.title}</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
            {copy.body}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => save(false, false)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium transition hover:bg-neutral-100 dark:border-white/20 dark:hover:bg-white/10">
              {copy.reject}
            </button>
            <button type="button" onClick={() => setPreferencesOpen(true)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium transition hover:bg-neutral-100 dark:border-white/20 dark:hover:bg-white/10">
              {copy.customize}
            </button>
            <button type="button" onClick={() => save(true, true)} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
              {copy.accept}
            </button>
            <a href="#/privacy" className="ml-auto text-xs text-neutral-500 underline underline-offset-2 dark:text-neutral-400">
              {copy.privacy}
            </a>
          </div>
        </section>
      )}

      {consent && !preferencesOpen && (
        <button
          type="button"
          onClick={() => {
            setAnalytics(consent.analytics);
            setMarketing(consent.marketing);
            setPreferencesOpen(true);
          }}
          className="fixed bottom-3 left-3 z-[110] rounded-full border border-black/10 bg-white/95 px-3 py-2 text-[11px] font-medium text-neutral-700 shadow-md backdrop-blur transition hover:bg-white dark:border-white/10 dark:bg-[#171717]/95 dark:text-neutral-200 dark:hover:bg-[#222]"
        >
          {copy.manage}
        </button>
      )}

      {preferencesOpen && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-5">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="stone-cookie-title"
            className="w-full max-w-[520px] rounded-2xl border border-black/10 bg-white p-5 text-neutral-900 shadow-2xl dark:border-white/10 dark:bg-[#111] dark:text-white"
          >
            <h2 id="stone-cookie-title" className="text-base font-semibold">{copy.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">{copy.body}</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-start justify-between gap-4 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
                <div>
                  <p className="text-sm font-medium">{copy.necessary}</p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{copy.necessaryHelp}</p>
                </div>
                <input type="checkbox" checked disabled aria-label={copy.necessary} className="mt-1 h-4 w-4 accent-neutral-900" />
              </div>
              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
                <span>
                  <span className="block text-sm font-medium">{copy.analytics}</span>
                  <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">{copy.analyticsHelp}</span>
                </span>
                <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className="mt-1 h-4 w-4 accent-neutral-900" />
              </label>
              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
                <span>
                  <span className="block text-sm font-medium">{copy.marketing}</span>
                  <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">{copy.marketingHelp}</span>
                </span>
                <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="mt-1 h-4 w-4 accent-neutral-900" />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => save(false, false)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium dark:border-white/20">
                {copy.reject}
              </button>
              <button type="button" onClick={() => save(analytics, marketing)} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900">
                {copy.save}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
