// src/pages/Faq.tsx
import DashboardSidebar from "../components/Navbar";
import { useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "../hooks/useHashRoute";
import { useTheme } from "../hooks/useTheme";
// ⚠️ À adapter : `useUser` doit exposer `user` et `loading`
import { useUser } from "../contexts/UserContext";

/* Clé partagée avec HelpChatButton pour transmettre l'item à ouvrir. */
const PENDING_FAQ_KEY = "faq:pending";

/** Récupère (et consomme) la clé d'item demandée depuis le widget d'aide. */
function consumePendingFaqKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = sessionStorage.getItem(PENDING_FAQ_KEY);
    if (key) sessionStorage.removeItem(PENDING_FAQ_KEY);
    return key;
  } catch {
    return null;
  }
}

function scrollToSupport() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.getElementById("faq-support")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
  });
}

type FaqItem = { q: string; a: string };
type Category = { id: string; label: string; items: FaqItem[] };

const CATEGORIES: Category[] = [
  {
    id: "general",
    label: "General",
    items: [
      {
        q: "What industries do you work with?",
        a: "We partner with SaaS, e-commerce, fintech, healthcare, and creative agencies. Our tools are industry-agnostic — if your team ships digital products, we can help you move faster.",
      },
      {
        q: "Do you offer a free trial?",
        a: "We offer a 14-day free trial on every plan — no credit card required. You get full access to all features so you can evaluate the product on real use cases.",
      },
      {
        q: "How long does implementation take?",
        a: "Project timelines typically range from 2 to 6 weeks, depending on complexity.\n\nSmaller automation systems — such as AI chatbots with CRM integration — can often be deployed within 2–3 weeks.\n\nMore advanced projects involving multi-platform integrations, custom AI logic, internal workflow automation, and reporting dashboards may take 4–6 weeks or longer.",
      },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    items: [
      {
        q: "Can I cancel my subscription anytime?",
        a: "Yes. All plans are month-to-month with no long-term commitment. You can upgrade, downgrade, or cancel directly from your dashboard at any time.",
      },
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit cards (Visa, Mastercard, Amex), PayPal, and bank transfers for annual Enterprise plans. Invoicing is available on request.",
      },
      {
        q: "What kind of ROI can we expect?",
        a: "Most clients see a 30–50% reduction in manual workload within the first three months. We define clear success metrics together before kickoff so ROI is measurable from day one.",
      },
      {
        q: "Do you offer refunds?",
        a: "Yes, we offer a 30-day money-back guarantee on all first-time subscriptions. If the product doesn't fit your needs, contact support and we'll issue a full refund — no questions asked.",
      },
    ],
  },
  {
    id: "technical",
    label: "Technical",
    items: [
      {
        q: "Do we need technical knowledge to work with you?",
        a: "Not at all. We handle the technical side end-to-end and provide a clear, no-jargon handoff. Your team only needs to know how to use the final product — we take care of the rest.",
      },
      {
        q: "Can I integrate with my existing tools?",
        a: "Yes. We provide native integrations with Slack, Notion, HubSpot, Zapier, and 40+ other tools, plus a REST API and webhooks for anything custom.",
      },
    ],
  },
  {
    id: "security",
    label: "Security & Privacy",
    items: [
      {
        q: "Is AI automation secure?",
        a: "Yes. All data is encrypted in transit and at rest, we never train models on your private data, and we comply with GDPR and SOC 2 standards. You stay in full control of your information.",
      },
      {
        q: "Is my data stored in the EU?",
        a: "Yes. Data is stored in EU-based data centers by default, with regional options available on Enterprise plans. We are fully GDPR compliant.",
      },
    ],
  },
  {
    id: "support",
    label: "Support",
    items: [
      {
        q: "How does support work?",
        a: "Every plan includes email support with a 24h response time. Growth and Enterprise plans include priority chat support and a dedicated account manager.",
      },
      {
        q: "Do you provide onboarding assistance?",
        a: "Yes. Every new customer gets a guided onboarding session and access to our help center, video tutorials, and templates to get up and running quickly.",
      },
    ],
  },
];

/* ──────────────────────────────────────────────────────────────
   Tokens de thème (clair / sombre)
   Les couleurs sombres reprennent celles du dashboard (Home) :
   fond #09090a, cartes #141416, hover #19191c, bordures white/10.
   ────────────────────────────────────────────────────────────── */

type FaqTokens = {
  page: string;
  title: string;
  subtitle: string;
  muted: string;
  divider: string;
  searchIcon: string;
  searchInput: string;
  clearBtn: string;
  emptyBox: string;
  backBtn: string;
  itemClosed: string;
  itemOpen: string;
  question: string;
  answer: string;
  indexNum: string;
  iconClosed: string;
  iconOpen: string;
  footerText: string;
  footerLink: string;
  footerArrow: string;
};

function buildTokens(isDark: boolean): FaqTokens {
  return isDark
    ? {
        page: "bg-[#09090a] text-white",
        title: "text-white",
        subtitle: "text-neutral-400",
        muted: "text-neutral-500",
        divider: "bg-white/10",
        searchIcon: "text-neutral-500",
        searchInput:
          "border-white/10 bg-[#141416] text-white placeholder:text-neutral-500 focus:border-[#6b8cff]/60 focus:bg-[#19191c] focus:ring-[#6b8cff]/25",
        clearBtn: "bg-white text-neutral-900",
        emptyBox: "border border-white/10 bg-[#141416] text-neutral-400",
        backBtn:
          "border-white/10 bg-[#141416] text-white hover:bg-[#19191c]",
        itemClosed:
          "rounded-full border border-white/10 bg-[#141416] hover:bg-[#19191c]",
        itemOpen:
          "rounded-[clamp(16px,1.8vw,24px)] border border-transparent bg-[#141416] ring-2 ring-[#6b8cff] shadow-[0_18px_40px_-22px_rgba(80,120,255,0.55)]",
        question: "text-white",
        answer: "text-neutral-400",
        indexNum: "text-neutral-500",
        iconClosed: "bg-white text-neutral-900",
        iconOpen: "border border-white/20 bg-transparent text-neutral-400",
        footerText: "text-neutral-400",
        footerLink: "text-white",
        footerArrow: "bg-white text-neutral-900",
      }
    : {
        page: "bg-white text-neutral-900",
        title: "text-neutral-900",
        subtitle: "text-neutral-500",
        muted: "text-neutral-400",
        divider: "bg-black/[0.08]",
        searchIcon: "text-neutral-400",
        searchInput:
          "border-black/[0.08] bg-[#f2f0ec] text-neutral-900 placeholder:text-neutral-400 focus:border-[#6b8cff]/60 focus:bg-white focus:ring-[#6b8cff]/20",
        clearBtn: "bg-neutral-900 text-white",
        emptyBox: "bg-[#f2f0ec] text-neutral-500",
        backBtn:
          "border-black/[0.08] bg-[#f2f0ec] text-neutral-900 hover:bg-[#ebe9e4]",
        itemClosed:
          "rounded-full border border-transparent bg-[#f2f0ec] hover:bg-[#ebe9e4]",
        itemOpen:
          "rounded-[clamp(16px,1.8vw,24px)] border border-transparent bg-white ring-2 ring-[#6b8cff] shadow-[0_18px_40px_-22px_rgba(60,100,220,0.5)]",
        question: "text-neutral-900",
        answer: "text-neutral-500",
        indexNum: "text-neutral-400",
        iconClosed: "bg-neutral-900 text-white",
        iconOpen: "border border-neutral-300 bg-white text-neutral-500",
        footerText: "text-neutral-500",
        footerLink: "text-neutral-900",
        footerArrow: "bg-neutral-900 text-white",
      };
}

/* ──────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────── */

export default function Faq() {
  const { user, loading } = useUser();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = useMemo(() => buildTokens(isDark), [isDark]);

  const [query, setQuery] = useState("");

  // Clé demandée par le widget d'aide (si on vient de cliquer une question suggérée).
  // On la consomme une seule fois, puis on la garde dans un ref pour scroller après montage.
  const pendingKeyRef = useRef<string | null>(null);

  const [open, setOpen] = useState<string | null>(() => {
    const pending = consumePendingFaqKey();
    if (pending) {
      pendingKeyRef.current = pending;
      return pending;
    }
    return "general-2";
  });

  // Après le montage : on scrolle jusqu'à l'item ouvert venant du widget.
  useEffect(() => {
    const key = pendingKeyRef.current;
    if (!key) return;

    const timer = window.setTimeout(() => {
      const el = document.getElementById(`faq-${key}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [query]);

  const toggle = (key: string) =>
    setOpen((cur) => (cur === key ? null : key));

  const totalResults = filtered.reduce((n, c) => n + c.items.length, 0);

  return (
    <>
      {/* Connecté → flèche retour vers /home. Non connecté → navbar.
          Pendant le chargement de la session, on n'affiche rien
          pour éviter un flash de la navbar. */}
      {!loading && !user && <DashboardSidebar />}

      {!loading && user && (
        <button
          type="button"
          onClick={() => navigate("home")}
          aria-label="Retour au dashboard"
          className={[
            "group fixed left-[clamp(12px,2vw,28px)] top-[clamp(12px,2vw,28px)] z-50 inline-flex h-[clamp(34px,3.2vw,42px)] w-[clamp(34px,3.2vw,42px)] items-center justify-center rounded-full border transition",
            t.backBtn,
          ].join(" ")}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[clamp(14px,1.4vw,18px)] w-[clamp(14px,1.4vw,18px)] transition-transform duration-300 group-hover:-translate-x-[2px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M11 6l-6 6 6 6" />
          </svg>
        </button>
      )}

      <main
        className={[
          "relative min-h-screen w-full transition-colors duration-500",
          t.page,
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-[900px] px-[clamp(16px,4vw,40px)] py-[clamp(48px,7vw,110px)]">
          {/* titre */}
          <h1
            className={[
              "text-center text-[clamp(28px,4.6vw,56px)] font-semibold leading-[1.05] tracking-[-0.03em]",
              t.title,
            ].join(" ")}
          >
            Common Questions
          </h1>

          <p
            className={[
              "mx-auto mt-[clamp(10px,1.4vw,18px)] max-w-[560px] text-center text-[clamp(12px,1.25vw,14.5px)] leading-relaxed",
              t.subtitle,
            ].join(" ")}
          >
            Tout ce que vous devez savoir sur nos produits, la facturation, la
            sécurité et le support.
          </p>

          {/* barre de recherche */}
          <div className="mt-[clamp(22px,2.8vw,36px)] flex justify-center">
            <div className="relative w-full max-w-[560px]">
              <svg
                viewBox="0 0 24 24"
                className={[
                  "pointer-events-none absolute left-[clamp(14px,1.5vw,18px)] top-1/2 h-[clamp(13px,1.4vw,16px)] w-[clamp(13px,1.4vw,16px)] -translate-y-1/2",
                  t.searchIcon,
                ].join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.2-3.2" />
              </svg>

              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a question…"
                className={[
                  "w-full rounded-full border px-[clamp(36px,3.8vw,46px)] py-[clamp(10px,1.15vw,14px)] text-[clamp(12.5px,1.25vw,14.5px)] outline-none transition focus:ring-2",
                  t.searchInput,
                ].join(" ")}
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className={[
                    "absolute right-[clamp(10px,1.2vw,14px)] top-1/2 flex h-[clamp(20px,2.2vw,24px)] w-[clamp(20px,2.2vw,24px)] -translate-y-1/2 items-center justify-center rounded-full",
                    t.clearBtn,
                  ].join(" ")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-[10px] w-[10px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12" />
                    <path d="M18 6L6 18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* résultats par catégorie */}
          <div className="mt-[clamp(32px,4.4vw,56px)] flex flex-col gap-[clamp(32px,4vw,52px)]">
            {totalResults === 0 && (
              <div
                className={[
                  "rounded-[clamp(14px,1.6vw,20px)] px-[clamp(14px,1.8vw,22px)] py-[clamp(18px,2.2vw,26px)] text-center text-[clamp(12px,1.2vw,13.5px)]",
                  t.emptyBox,
                ].join(" ")}
              >
                Aucune question ne correspond à « {query} ».
              </div>
            )}

            {filtered.map((cat) => (
              <section
                key={cat.id}
                id={cat.id === "support" ? "faq-support" : undefined}
                className={cat.id === "support" ? "scroll-mt-24" : undefined}
              >
                {/* en-tête catégorie */}
                <div className="mb-[clamp(12px,1.5vw,18px)] flex items-center gap-[clamp(10px,1.4vw,16px)]">
                  <h2
                    className={[
                      "text-[clamp(11px,1.15vw,13px)] font-semibold uppercase tracking-[0.16em]",
                      t.muted,
                    ].join(" ")}
                  >
                    {cat.label}
                  </h2>
                  <span className={["h-[1px] flex-1", t.divider].join(" ")} />
                  <span
                    className={[
                      "text-[clamp(10.5px,1.05vw,12px)] font-medium",
                      t.muted,
                    ].join(" ")}
                  >
                    {cat.items.length}
                  </span>
                </div>

                <ul className="flex flex-col gap-[clamp(8px,1vw,12px)]">
                  {cat.items.map((item, i) => {
                    // Index calculé sur la liste d'origine pour que les clés
                    // restent stables (et compatibles avec le widget d'aide)
                    // même quand la recherche filtre les items.
                    const originalIndex = CATEGORIES.find(
                      (c) => c.id === cat.id
                    )!.items.findIndex((o) => o.q === item.q);
                    const key = `${cat.id}-${originalIndex}`;
                    const isOpen = open === key;

                    return (
                      <li
                        key={item.q}
                        id={`faq-${key}`}
                        className={[
                          "overflow-hidden scroll-mt-24 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          isOpen ? t.itemOpen : t.itemClosed,
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          aria-expanded={isOpen}
                          className={[
                            "flex w-full items-start gap-[clamp(10px,1.3vw,16px)] text-left",
                            isOpen
                              ? "px-[clamp(14px,1.8vw,22px)] pt-[clamp(14px,1.7vw,20px)]"
                              : "px-[clamp(14px,1.8vw,22px)] py-[clamp(10px,1.15vw,14px)]",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "mt-[2px] w-[1.4em] shrink-0 text-[clamp(10.5px,1.05vw,12.5px)] font-medium",
                              t.indexNum,
                            ].join(" ")}
                          >
                            {i + 1}
                          </span>

                          <span
                            className={[
                              "flex-1 text-[clamp(12px,1.2vw,14px)] font-medium tracking-[-0.01em]",
                              t.question,
                            ].join(" ")}
                          >
                            {item.q}
                          </span>

                          <span
                            className={[
                              "flex h-[clamp(22px,2.4vw,28px)] w-[clamp(22px,2.4vw,28px)] shrink-0 items-center justify-center rounded-full transition-colors duration-300",
                              isOpen ? t.iconOpen : t.iconClosed,
                            ].join(" ")}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-[clamp(10px,1.05vw,12px)] w-[clamp(10px,1.05vw,12px)]"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            >
                              {isOpen ? (
                                <>
                                  <path d="M6 6l12 12" />
                                  <path d="M18 6L6 18" />
                                </>
                              ) : (
                                <>
                                  <path d="M12 5v14" />
                                  <path d="M5 12h14" />
                                </>
                              )}
                            </svg>
                          </span>
                        </button>

                        {/* contenu dépliable */}
                        <div
                          className={[
                            "grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                            isOpen
                              ? "grid-rows-[1fr] opacity-100"
                              : "grid-rows-[0fr] opacity-0",
                          ].join(" ")}
                        >
                          <div className="min-h-0">
                            <div
                              className={[
                                "px-[clamp(14px,1.8vw,22px)] pb-[clamp(14px,1.7vw,20px)] pl-[calc(clamp(14px,1.8vw,22px)+1.4em+clamp(10px,1.3vw,16px))] text-[clamp(11.5px,1.2vw,13px)] leading-relaxed whitespace-pre-line",
                                t.answer,
                              ].join(" ")}
                            >
                              {item.a}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {/* footer */}
          <div className="mt-[clamp(40px,5vw,72px)] flex flex-col items-center gap-[clamp(4px,0.6vw,8px)]">
            <p
              className={[
                "text-[clamp(11.5px,1.2vw,13.5px)]",
                t.footerText,
              ].join(" ")}
            >
              Have any other questions?
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                scrollToSupport();
              }}
              className={[
                "group inline-flex items-center gap-[6px] text-[clamp(11.5px,1.2vw,13.5px)] font-medium",
                t.footerLink,
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4",
              ].join(" ")}
            >
              Browse support answers
              <span
                className={[
                  "flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] transition-transform duration-300 group-hover:translate-x-[2px]",
                  t.footerArrow,
                ].join(" ")}
              >
                →
              </span>
            </button>
          </div>
        </div>
      </main>
    </>
  );
}