// src/components/insights/copy.ts
// Langue, types partagés et textes (fr/en) de la page Insights.

import { useEffect, useState } from "react";

export type Lang = "fr" | "en";

export const LANGUAGE_STORAGE_KEY = "stone:language";

export function detectLanguage(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* stockage indisponible */
  }
  return "en";
}

export function useLanguage(): Lang {
  const [lang, setLang] = useState<Lang>(() => detectLanguage());
  useEffect(() => {
    const refresh = () => setLang(detectLanguage());
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    window.addEventListener("hashchange", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("hashchange", refresh);
    };
  }, []);
  return lang;
}

export const intlLocale = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-GB");
export const numLocale = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-US");

export type Range = "7d" | "30d" | "mtd" | "custom";
export type ChartView = "this" | "comparison" | "both";
export type PostsPeriod = "this" | "previous";
export type SortKey = "reactions" | "comments" | "engRate" | "videoViews";
export type NumKey = "posts" | "reactions" | "comments" | "followers" | "profileViews";
export type SummaryBoxKey =
  | "followers"
  | "posts"
  | "reactions"
  | "comments"
  | "engRate"
  | "videoViews";

export type Point = {
  date: Date;
  posts: number;
  reactions: number;
  comments: number;
  followers: number;
  profileViews: number;
};

export type Summary = {
  followers: number;
  posts: number;
  reactions: number;
  comments: number;
  engRate: number;
  videoViews: number;
  shares: number;
  reach: number;
  watchMin: number;
  avgWatchSec: number;
};

export type PostRow = {
  id: string;
  label: string;
  date: Date;
  media: "image" | "video" | "text";
  thumbnailUrl?: string;
  status?: string;
  reactions: number;
  comments: number;
  engRate: number;
  videoViews: number;
  platform?: string;
};

export type InsightsData = {
  current: Point[];
  previous: Point[];
  summary: Summary;
  posts: PostRow[];
  previousPosts: PostRow[];
};

export type SeriesDef = {
  key: NumKey;
  label: string;
  tone: 0 | 1;
  agg: "sum" | "last";
};

export type ChartRow = {
  date: string;
  fullDate: string;
  left_this: number;
  left_prev: number;
  right_this?: number;
  right_prev?: number;
};

export type ChartSeries = {
  label: string;
  color: string;
  values: number[];
  prev: number[];
};

export type ComposerContext = {
  scheduledAt?: Date;
  channelKey?: string;
  duplicateFrom?: PostRow;
  reason?: "heatmap" | "duplicate" | "insight" | "manual";
};

export type Copy = {
  header: {
    title: string;
    export: string;
    refresh: string;
    addFavorite: string;
    removeFavorite: string;
  };
  noChannels: {
    title: string;
    description: string;
    connect: string;
  };
  errors: {
    youtube: (msg: string) => string;
    retry: string;
    loading: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  overview: {
    title: string;
    subtitle: string;
    dateRangeAria: string;
  };
  ranges: Record<Range, string>;
  summary: {
    title: string;
    periodSeparator: string;
    comparedTo: (range: string) => string;
    goalProgress: (done: number, goal: number) => string;
    goalAria: (done: number, goal: number) => string;
    glance: (posts: number, reactions: number, comments: number) => string;
    labels: Record<SummaryBoxKey, string>;
    info: Record<SummaryBoxKey, string>;
    vsPreviousShort: string;
    vsPreviousLong: string;
  };
  trends: {
    title: string;
    subtitle: (period: string) => string;
    compareToggle: string;
    metricAria: string;
    thisPeriod: string;
    previousPeriod: string;
    total: string;
    ending: string;
    prevSuffix: string;
  };
  metricOptions: {
    posts: string;
    reactions: string;
    comments: string;
    followers: string;
    profileViews: string;
    channelViews: string;
  };
  bestTime: {
    title: string;
    answerSubline: string;
    scheduleCta: (day: string, hour: string) => string;
    activityByDay: string;
    noteBaseline: string;
    noteEarly: (n: number) => string;
    noteSolid: (n: number) => string;
    scheduleAria: (day: string, hour: string) => string;
    bestOfDay: string;
    pickHour: string;
    low: string;
    high: string;
  };
  recycle: {
    title: string;
    subtitle: string;
    emptyHint: string;
    rank: (n: number) => string;
    duplicate: string;
    engagement: (reactions: number, rate: string) => string;
  };
  performance: {
    title: string;
    periodThis: string;
    periodPrevious: string;
    periodAria: string;
    hiddenScheduled: (n: number) => string;
    postsCount: (n: number) => string;
    sortBy: (label: string) => string;
    emptyLoading: string;
    emptyNoMatch: string;
    emptyNoPost: string;
    emptyLongerPeriod: string;
    showLast30Days: string;
    openYouTube: string;
    duplicatePost: string;
    showMore: (n: number) => string;
    showLess: string;
    columns: Record<SortKey, string>;
    top: string;
  };
  media: {
    video: string;
    image: string;
    text: string;
  };
  days: string[];
  daysLong: string[];
  calendar: {
    from: string;
    to: string;
    helpFrom: string;
    helpTo: string;
    next: string;
    back: string;
    done: string;
    rangeAria: string;
  };
  sheets: {
    channels: string;
    dateRange: string;
  };
  tagsButton: string;
  allNetworks: string;
  demo: {
    tiktok: string[];
    pinterest: string[];
    youtube: string[];
    default: string[];
  };
};

export const COPY: Record<Lang, Copy> = {
  en: {
    header: {
      title: "Insights",
      export: "Export",
      refresh: "Refresh insights",
      addFavorite: "Add to favorites",
      removeFavorite: "Remove from favorites",
    },
    noChannels: {
      title: "Connect a channel to see insights",
      description:
        "Followers, reach, and engagement appear here once a social account is connected.",
      connect: "Connect a channel",
    },
    errors: {
      youtube: (msg) => `Couldn't load YouTube insights: ${msg}`,
      retry: "Retry",
      loading: "Loading YouTube insights…",
    },
    hero: {
      eyebrow: "Insights",
      title: "Know what's working best.",
      subtitle:
        "Insights show which posts, formats, and times perform best, so your next publish is a decision — not a bet.",
    },
    overview: {
      title: "Overview",
      subtitle: "Pick a period — everything below updates",
      dateRangeAria: "Date range",
    },
    ranges: {
      "7d": "7 days",
      "30d": "30 days",
      mtd: "Month to date",
      custom: "Custom",
    },
    summary: {
      title: "Summary",
      periodSeparator: " · ",
      comparedTo: (range) => `Compared to ${range}`,
      goalProgress: (done, goal) => `${done}/${goal} this week`,
      goalAria: (done, goal) => `Goal: ${done} of ${goal} this week`,
      glance: (posts, reactions, comments) => {
        const p = `${posts} post${posts === 1 ? "" : "s"}`;
        const r = `${reactions} reaction${reactions === 1 ? "" : "s"}`;
        const cm = `${comments} comment${comments === 1 ? "" : "s"}`;
        return `You published ${p} and received ${r} and ${cm}.`;
      },
      labels: {
        followers: "Total followers",
        posts: "Posts",
        reactions: "Reactions",
        comments: "Comments",
        engRate: "Eng. rate",
        videoViews: "Video views",
      },
      info: {
        followers: "How many people follow you at the end of the period.",
        posts: "Posts published during the period (scheduled posts excluded).",
        reactions: "Likes and other reactions received on your posts.",
        comments: "Comments received on your posts.",
        engRate:
          "Share of views that turned into a like or comment. Higher is better.",
        videoViews: "How many times your videos were viewed.",
      },
      vsPreviousShort: "vs previous period",
      vsPreviousLong: "vs previous period",
    },
    trends: {
      title: "Trends",
      subtitle: (period) =>
        `Pick a metric to see its day-by-day trend · ${period}`,
      compareToggle: "Compare to previous period",
      metricAria: "Metric to display",
      thisPeriod: "This period",
      previousPeriod: "Previous period",
      total: "total for period",
      ending: "end of period",
      prevSuffix: "(prev.)",
    },
    metricOptions: {
      posts: "Posts",
      reactions: "Reactions",
      comments: "Comments",
      followers: "Followers",
      profileViews: "Profile views",
      channelViews: "Channel views",
    },
    bestTime: {
      title: "Best time to post",
      answerSubline: "When your audience is most active. Publish into it.",
      scheduleCta: (day, hour) => `Schedule for ${day} ${hour}`,
      activityByDay: "Activity by day",
      noteBaseline: "Refines as you publish",
      noteEarly: (n) => `Based on your last ${n} posts`,
      noteSolid: (n) => `Based on your last ${n} posts`,
      scheduleAria: (day, hour) => `Schedule ${day} at ${hour}`,
      bestOfDay: "Best of the day",
      pickHour: "Tap an hour to schedule a post there.",
      low: "Quiet",
      high: "Busy",
    },
    recycle: {
      title: "Posts to recycle",
      subtitle: "Posts that are still outperforming — duplicate the angle",
      emptyHint:
        "After a few published posts, the ones worth redoing will appear here.",
      rank: (n) => `#${n}`,
      duplicate: "Duplicate →",
      engagement: (reactions, rate) =>
        `${reactions} reactions · ${rate}% eng.`,
    },
    performance: {
      title: "All your posts",
      periodThis: "This period",
      periodPrevious: "Previous period",
      periodAria: "Posts period",
      hiddenScheduled: (n) => `${n} scheduled not shown`,
      postsCount: (n) => `Posts · ${n}`,
      sortBy: (label) => `Sort by ${label}`,
      emptyLoading: "Loading videos…",
      emptyNoMatch: "No post matches your search",
      emptyNoPost: "No post in this period",
      emptyLongerPeriod:
        "Pick a longer range to see how your previous posts performed.",
      showLast30Days: "Show last 30 days",
      openYouTube: "Open on YouTube",
      duplicatePost: "Duplicate this post",
      showMore: (n) => `Show all ${n} posts`,
      showLess: "Show fewer posts",
      columns: {
        reactions: "Reactions",
        comments: "Comments",
        engRate: "Eng. rate",
        videoViews: "Video views",
      },
      top: "Top",
    },
    media: {
      video: "video",
      image: "image",
      text: "text",
    },
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    daysLong: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    calendar: {
      from: "From",
      to: "To",
      helpFrom: "Pick the first day of the period.",
      helpTo: "Pick the last day of the period (today max).",
      next: "Next: To",
      back: "Back: From",
      done: "Done",
      rangeAria: "Custom date range",
    },
    sheets: {
      channels: "Channels",
      dateRange: "Date range",
    },
    tagsButton: "Tags",
    allNetworks: "All networks",
    demo: {
      tiktok: [
        "3-second hook",
        "Behind the scenes",
        "Before / after",
        "The sound that stuck",
        "Day in the queue",
      ],
      pinterest: [
        "Moodboard: quiet luxury",
        "The pin that saves",
        "Colors story",
        "Shelf arrangement",
        "Close-up texture",
      ],
      youtube: [
        "Short: one idea",
        "Cut the intro",
        "What I'd redo",
        "90s of proof",
        "The clip that's left",
      ],
      default: [
        "Quiet release",
        "The one people saved",
        "Studio note",
        "Ambition, shorter",
        "Still in progress",
      ],
    },
  },
  fr: {
    header: {
      title: "Insights",
      export: "Exporter",
      refresh: "Rafraîchir les insights",
      addFavorite: "Ajouter aux favoris",
      removeFavorite: "Retirer des favoris",
    },
    noChannels: {
      title: "Connectez un canal pour voir les insights",
      description:
        "Les abonnés, la portée et l'engagement apparaissent ici une fois un compte social connecté.",
      connect: "Connecter un canal",
    },
    errors: {
      youtube: (msg) => `Impossible de charger les insights YouTube : ${msg}`,
      retry: "Réessayer",
      loading: "Chargement des insights YouTube…",
    },
    hero: {
      eyebrow: "Insights",
      title: "Sachez ce qui fonctionne le mieux.",
      subtitle:
        "Les insights montrent quels posts, formats et horaires performent le mieux, pour que votre prochaine publication soit une décision, pas un pari.",
    },
    overview: {
      title: "Aperçu",
      subtitle: "Choisissez une période — tout ci-dessous se met à jour",
      dateRangeAria: "Plage de dates",
    },
    ranges: {
      "7d": "7 jours",
      "30d": "30 jours",
      mtd: "Mois en cours",
      custom: "Personnalisé",
    },
    summary: {
      title: "Résumé",
      periodSeparator: " · ",
      comparedTo: (range) => `Comparé à ${range}`,
      goalProgress: (done, goal) => `${done}/${goal} cette semaine`,
      goalAria: (done, goal) => `Objectif : ${done} sur ${goal} cette semaine`,
      glance: (posts, reactions, comments) => {
        const p = `${posts} post${posts > 1 ? "s" : ""}`;
        const r = `${reactions} réaction${reactions === 1 ? "" : "s"}`;
        const cm = `${comments} commentaire${comments === 1 ? "" : "s"}`;
        return `Vous avez publié ${p} et reçu ${r} et ${cm}.`;
      },
      labels: {
        followers: "Abonnés totaux",
        posts: "Posts",
        reactions: "Réactions",
        comments: "Commentaires",
        engRate: "Taux d'eng.",
        videoViews: "Vues vidéo",
      },
      info: {
        followers: "Combien de personnes vous suivent à la fin de la période.",
        posts:
          "Posts publiés sur la période (les posts programmés ne sont pas comptés).",
        reactions: "Likes et autres réactions reçues sur vos posts.",
        comments: "Commentaires reçus sur vos posts.",
        engRate:
          "Part des vues transformées en like ou commentaire. Plus c'est haut, mieux c'est.",
        videoViews: "Combien de fois vos vidéos ont été vues.",
      },
      vsPreviousShort: "vs période précédente",
      vsPreviousLong: "vs période précédente",
    },
    trends: {
      title: "Tendances",
      subtitle: (period) =>
        `Choisissez un indicateur pour voir son évolution jour par jour · ${period}`,
      compareToggle: "Comparer avec la période précédente",
      metricAria: "Indicateur à afficher",
      thisPeriod: "Cette période",
      previousPeriod: "Période précédente",
      total: "total sur la période",
      ending: "à la fin de la période",
      prevSuffix: "(préc.)",
    },
    metricOptions: {
      posts: "Posts",
      reactions: "Réactions",
      comments: "Commentaires",
      followers: "Abonnés",
      profileViews: "Vues du profil",
      channelViews: "Vues de la chaîne",
    },
    bestTime: {
      title: "Meilleur moment pour publier",
      answerSubline:
        "Quand votre audience est la plus active. Publiez à ce moment-là.",
      scheduleCta: (day, hour) => `Programmer ${day} ${hour}`,
      activityByDay: "Activité par jour",
      noteBaseline: "S'affine au fil de vos publications",
      noteEarly: (n) => `Sur vos ${n} derniers posts`,
      noteSolid: (n) => `Sur vos ${n} derniers posts`,
      scheduleAria: (day, hour) => `Programmer ${day} à ${hour}`,
      bestOfDay: "Meilleur moment du jour",
      pickHour: "Touchez une heure pour y programmer un post.",
      low: "Calme",
      high: "Chargé",
    },
    recycle: {
      title: "Posts à recycler",
      subtitle: "Posts qui surperforment encore — dupliquez l'angle",
      emptyHint:
        "Après quelques posts publiés, ceux qui valent la peine d'être refaits apparaissent ici.",
      rank: (n) => `#${n}`,
      duplicate: "Dupliquer →",
      engagement: (reactions, rate) =>
        `${reactions} réactions · ${rate}% eng.`,
    },
    performance: {
      title: "Tous vos posts",
      periodThis: "Cette période",
      periodPrevious: "Période précédente",
      periodAria: "Période des posts",
      hiddenScheduled: (n) =>
        `${n} programmé${n > 1 ? "s" : ""} non affiché${n > 1 ? "s" : ""}`,
      postsCount: (n) => `Posts · ${n}`,
      sortBy: (label) => `Trier par ${label}`,
      emptyLoading: "Chargement des vidéos…",
      emptyNoMatch: "Aucun post ne correspond à votre recherche",
      emptyNoPost: "Aucun post sur cette période",
      emptyLongerPeriod:
        "Choisissez une plage plus longue pour voir comment vos posts précédents ont performé.",
      showLast30Days: "Afficher les 30 derniers jours",
      openYouTube: "Ouvrir sur YouTube",
      duplicatePost: "Dupliquer ce post",
      showMore: (n) => `Afficher les ${n} posts`,
      showLess: "Afficher moins de posts",
      columns: {
        reactions: "Réactions",
        comments: "Commentaires",
        engRate: "Taux d'eng.",
        videoViews: "Vues vidéo",
      },
      top: "Top",
    },
    media: {
      video: "vidéo",
      image: "image",
      text: "texte",
    },
    days: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
    daysLong: [
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
      "Dimanche",
    ],
    calendar: {
      from: "Du",
      to: "Au",
      helpFrom: "Choisissez le premier jour de la période.",
      helpTo: "Choisissez le dernier jour de la période (aujourd'hui max).",
      next: "Suivant : Au",
      back: "Retour : Du",
      done: "Terminé",
      rangeAria: "Plage de dates personnalisée",
    },
    sheets: {
      channels: "Canaux",
      dateRange: "Plage de dates",
    },
    tagsButton: "Tags",
    allNetworks: "Tous les réseaux",
    demo: {
      tiktok: [
        "Accroche en 3 secondes",
        "Dans les coulisses",
        "Avant / après",
        "Le son qui est resté",
        "Journée dans la file",
      ],
      pinterest: [
        "Moodboard : luxe discret",
        "Le pin qui sauve",
        "Histoire de couleurs",
        "Aménagement d'étagère",
        "Gros plan texture",
      ],
      youtube: [
        "Short : une idée",
        "Coupe l'intro",
        "Ce que je referais",
        "90s de preuve",
        "Le clip restant",
      ],
      default: [
        "Sortie discrète",
        "Celui que les gens ont sauvegardé",
        "Note de studio",
        "Ambition, plus court",
        "Toujours en cours",
      ],
    },
  },
};

/** Bascule mobile/desktop : un seul breakpoint, md (768px). */
const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(
    () =>
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
