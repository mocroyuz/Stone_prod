import { useEffect } from "react";
import { useTheme } from "../hooks/useTheme";

const STORAGE_KEY = "instagram_oauth_params";

type CallbackParams = {
  code: string | null;
  state: string | null;
  error: string | null;
  error_description: string | null;
};

function readParams(): CallbackParams | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CallbackParams) : null;
  } catch {
    return null;
  }
}

function goToChannels(query: string) {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.location.replace(`/settings/channels${query}`);
}

export default function InstagramCallback() {
  const { theme } = useTheme();

  useEffect(() => {
    const params = readParams();
    if (!params) {
      goToChannels(`?instagram_error=${encodeURIComponent("Instagram authorization data not found. Please try again.")}`);
      return;
    }

    const { code, state, error, error_description: errorDescription } = params;
    if (error) {
      goToChannels(`?instagram_error=${encodeURIComponent(errorDescription || error)}`);
      return;
    }
    if (!code || !state) {
      goToChannels(`?instagram_error=${encodeURIComponent("Missing authorization code from Instagram.")}`);
      return;
    }

    // Le callback OAuth est traité par le backend GET /api/instagram/callback.
    // Le POST /api/instagram/auth/callback n'existe pas et empêchait
    // l'échange du code puis l'enregistrement du compte dans Supabase.
    const callbackQuery = new URLSearchParams({ code, state });
    window.location.replace(`/api/instagram/callback?${callbackQuery.toString()}`);
  }, []);

  const dark = theme === "dark";
  return (
    <div className={`flex h-full min-h-screen w-full flex-col items-center justify-center gap-4 ${dark ? "bg-[#050506] text-[#f3f3ef]" : "bg-[#faf9f7] text-[#151515]"}`}>
      <span aria-hidden="true" className={`h-8 w-8 animate-spin rounded-full border-2 ${dark ? "border-white/20 border-t-white" : "border-black/15 border-t-black"}`} />
      <p className="text-[14px] font-medium">Connecting your Instagram account...</p>
    </div>
  );
}
