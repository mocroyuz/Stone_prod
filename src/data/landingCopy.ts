/**
 * Tous les textes de la landing page, en français, au même endroit.
 * Persona : créateurs de contenu et community managers qui gèrent plusieurs
 * réseaux. Objectif unique : faire créer un compte (/signup).
 *
 * Chaque affirmation correspond à une fonctionnalité présente dans le code
 * (publication, calendrier, comptes, idées, Insights). Rien n'est promis
 * qui ne soit pas opérationnel.
 */

export const SIGNUP_HREF = "/signup";
export const SIGNIN_HREF = "/signin";
export const CTA_LABEL = "Créer mon compte";

/* ---------- Hero : variantes prêtes pour un test A/B ---------- */

export type HeroVariantKey = "a" | "b";

export type HeroVariant = {
  chip: string;
  eyebrow: string;
  titleLines: [string, string];
  subtitle: string;
};

export const HERO_VARIANTS: Record<HeroVariantKey, HeroVariant> = {
  a: {
    chip: "Réseaux sociaux",
    eyebrow: "Pensé pour les créateurs et les community managers",
    titleLines: ["Vos réseaux sociaux,", "enfin simples à gérer."],
    subtitle:
      "Stone réunit vos publications, votre calendrier et vos statistiques au même endroit. Vous planifiez plus vite et vous gardez votre temps pour créer.",
  },
  b: {
    chip: "Réseaux sociaux",
    eyebrow: "Pensé pour les créateurs et les community managers",
    titleLines: ["Moins d'onglets,", "plus de création."],
    subtitle:
      "Arrêtez de passer d'une application à l'autre. Avec Stone, vous créez, programmez et suivez vos contenus depuis un seul espace.",
  },
};

export const DEFAULT_HERO_VARIANT: HeroVariantKey = "a";

/**
 * Variante affichée. Pour l'instant, aucune répartition aléatoire : la
 * variante par défaut est servie, et `?hero=b` permet de prévisualiser l'autre.
 * Le test A/B réel (répartition + mesure) reste à brancher sur un outil
 * d'analytics ; l'identifiant de variante est déjà joint à chaque événement.
 */
export function resolveHeroVariant(search: string): HeroVariantKey {
  const requested = new URLSearchParams(search).get("hero");
  return requested === "a" || requested === "b"
    ? requested
    : DEFAULT_HERO_VARIANT;
}

/* ---------- Navigation ---------- */

export type NavItem = { label: string; section: string };

export const NAV_LINKS: NavItem[] = [
  { label: "Accueil", section: "top" },
  { label: "Pourquoi Stone", section: "problems" },
  { label: "Fonctionnement", section: "how" },
  { label: "Fonctionnalités", section: "features" },
  { label: "Insights", section: "insights" },
];

export const SPY_SECTIONS = ["problems", "how", "features", "insights"];

/* ---------- Réseaux compatibles ---------- */

export const NETWORKS_COPY = {
  title: "Tous vos réseaux, au même endroit",
  text: "Connectez vos comptes une fois, puis publiez et suivez vos contenus depuis Stone.",
  available: "Disponibles aujourd'hui",
  soon: "Bientôt disponibles",
};

/* ---------- Problèmes → bénéfices ---------- */

export const PROBLEMS_COPY = {
  title: "Gérer plusieurs réseaux ne devrait pas occuper toute votre semaine.",
  text: "Si vous vous reconnaissez ici, Stone est fait pour vous.",
  painLabel: "Aujourd'hui",
  gainLabel: "Avec Stone",
  items: [
    {
      pain: "Vous passez d'une application à l'autre pour publier sur chaque réseau.",
      gain: "Un seul espace pour tous vos comptes. Vous ouvrez Stone, tout est là.",
    },
    {
      pain: "Vos publications se préparent en urgence, au dernier moment.",
      gain: "Vous programmez à l'avance, à l'heure qui vous convient.",
    },
    {
      pain: "Impossible de voir d'un coup d'œil ce qui sort cette semaine.",
      gain: "Un calendrier clair de tous vos contenus à venir.",
    },
    {
      pain: "Vos idées se perdent dans des notes et des messages.",
      gain: "Un espace pour ranger vos idées en groupes et les retrouver.",
    },
    {
      pain: "Analyser vos résultats demande d'ouvrir chaque plateforme.",
      gain: "Vos statistiques réunies, avec le meilleur moment pour publier.",
    },
  ],
};

/* ---------- Comment ça marche ---------- */

export const HOW_COPY = {
  title: "Prêt en trois étapes",
  text: "Pas de configuration compliquée : vous connectez, vous créez, vous suivez.",
  note: "Illustrations : exemples fictifs.",
  steps: [
    {
      title: "Connectez vos réseaux sociaux",
      text: "Ajoutez vos comptes depuis Stone. Vous les retrouvez ensuite tous au même endroit.",
    },
    {
      title: "Créez et programmez vos publications",
      text: "Rédigez, ajoutez vos médias, choisissez les réseaux et l'heure de publication.",
    },
    {
      title: "Suivez vos résultats",
      text: "Consultez vos statistiques et repérez ce qui fonctionne pour publier au bon moment.",
    },
  ],
};

/* ---------- Fonctionnalités (feature = tag, bénéfice = titre) ---------- */

export const FEATURES_COPY = {
  title: "Tout ce qu'il faut pour publier sereinement.",
  text: "Quelques outils simples, pensés pour le quotidien de celles et ceux qui gèrent plusieurs comptes.",
  items: [
    {
      tag: "Publications",
      title: "Préparez vos contenus sans changer d'outil",
      text: "Rédigez votre publication, importez vos médias depuis Canva, Dropbox ou Google Drive et choisissez où elle part.",
    },
    {
      tag: "Calendrier",
      title: "Voyez ce qui part, quand et où",
      text: "Programmez à l'avance et gardez une vue claire sur tous vos contenus à venir.",
    },
    {
      tag: "Comptes sociaux",
      title: "Tous vos comptes dans un seul espace",
      text: "Connectez vos comptes une fois et passez de l'un à l'autre sans vous reconnecter.",
    },
    {
      tag: "Idées",
      title: "Ne perdez plus une bonne idée",
      text: "Rangez vos idées en groupes, repérez-les avec des tags et retrouvez-les quand vous en avez besoin.",
    },
  ],
};

/* ---------- Insights ---------- */

export const INSIGHTS_COPY = {
  tag: "Insights",
  title: "Comprenez ce qui fonctionne, sans ouvrir cinq applications.",
  text: "Insights rassemble les statistiques de vos comptes connectés pour vous aider à décider quoi publier, et quand.",
  points: [
    "Vos chiffres clés au même endroit : abonnés, publications, réactions, commentaires, engagement.",
    "Une comparaison avec la période précédente pour voir si vous progressez.",
    "Le meilleur moment pour publier, d'après l'activité de votre audience.",
    "Un export CSV pour garder vos chiffres.",
  ],
  chartTitle: "Activité par jour",
  chartBadge: "Exemple",
  chartLegend: { reactions: "Réactions", comments: "Commentaires" },
  chartFooter: (day: string, reactions: number, comments: number) =>
    `${day} · ${reactions} réactions · ${comments} commentaires`,
  demoNote:
    "Données de démonstration. Dans Stone, vous voyez les statistiques de vos propres comptes connectés.",
  days: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
};

/* ---------- CTA final ---------- */

export const FINAL_CTA_COPY = {
  title: "Reprenez la main sur votre temps.",
  text: "Un seul espace pour créer, programmer et suivre vos réseaux sociaux.",
};

/* ---------- Footer ---------- */

export const FOOTER_COPY = {
  tagline:
    "Créez, programmez et suivez vos réseaux sociaux depuis un seul espace.",
  signin: "Se connecter",
  columns: [
    {
      title: "Produit",
      links: [
        { label: "Pourquoi Stone", section: "problems" },
        { label: "Fonctionnement", section: "how" },
        { label: "Fonctionnalités", section: "features" },
        { label: "Insights", section: "insights" },
      ],
    },
    {
      title: "Ressources",
      links: [
        { label: "Questions fréquentes", href: "/faq" },
        { label: "Se connecter", href: SIGNIN_HREF },
      ],
    },
    {
      title: "Légal",
      links: [
        { label: "Politique de confidentialité", href: "/privacy" },
        { label: "Conditions d'utilisation", href: "/tos" },
      ],
    },
  ] as Array<{
    title: string;
    links: Array<{ label: string; section?: string; href?: string }>;
  }>,
  rights: "Tous droits réservés 2026",
  privacy: "Confidentialité",
  terms: "Conditions d'utilisation",
};
