/**
 * Couche de suivi de conversion, indépendante de tout fournisseur.
 *
 * Aucun service d'analytics n'est installé dans le projet : `track()` ne
 * dépend donc d'aucune clé ni d'aucun script. Chaque événement est :
 *   1. diffusé comme CustomEvent `stone:track` sur `window` (écoutable par
 *      n'importe quel script ajouté plus tard) ;
 *   2. relayé, s'ils existent, vers plausible / gtag / dataLayer / posthog.
 *
 * Tant qu'un fournisseur n'est pas branché, rien n'est enregistré.
 * Entonnoir mesurable :
 *   landing_view → cta_click → signup_started → signup_completed
 * (taux de conversion = signup_completed / landing_view).
 */

export type TrackEventName =
  | "landing_view"
  | "cta_click"
  | "signup_started"
  | "signup_completed";

export type TrackProps = Record<string, string | number | boolean | undefined>;

type AnalyticsWindow = Window & {
  plausible?: (event: string, options?: { props?: TrackProps }) => void;
  gtag?: (command: "event", event: string, props?: TrackProps) => void;
  dataLayer?: Array<Record<string, unknown>>;
  posthog?: { capture?: (event: string, props?: TrackProps) => void };
};

const ATTRIBUTION_KEY = "stone:attribution";

/** Variante du Hero vue par le visiteur, mémorisée pour l'attribuer à l'inscription. */
export function rememberAttribution(props: TrackProps): void {
  try {
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(props));
  } catch {
    /* stockage indisponible : on mesure sans attribution */
  }
}

function readAttribution(): TrackProps {
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_KEY);
    return raw ? (JSON.parse(raw) as TrackProps) : {};
  } catch {
    return {};
  }
}

export function track(event: TrackEventName, props: TrackProps = {}): void {
  if (typeof window === "undefined") return;
  const payload: TrackProps = { ...readAttribution(), ...props };
  const w = window as AnalyticsWindow;

  try {
    window.dispatchEvent(
      new CustomEvent("stone:track", { detail: { event, props: payload } }),
    );
    w.plausible?.(event, { props: payload });
    w.gtag?.("event", event, payload);
    w.dataLayer?.push({ event, ...payload });
    w.posthog?.capture?.(event, payload);
  } catch {
    /* le suivi ne doit jamais casser l'application */
  }
}
