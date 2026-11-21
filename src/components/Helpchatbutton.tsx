import { useState } from "react";
import { navigate } from "../hooks/useHashRoute";

/* ──────────────────────────────────────────────────────────────
   Icônes utilisées uniquement par ce widget
   ────────────────────────────────────────────────────────────── */

function QuestionMarkIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.4 9.2a2.6 2.6 0 0 1 5 1c0 1.7-2.5 2.1-2.5 3.8" />
      <path d="M12 17.2h.01" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function LifebuoyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="4.9" y1="4.9" x2="9.2" y2="9.2" />
      <line x1="14.8" y1="14.8" x2="19.1" y2="19.1" />
      <line x1="14.8" y1="9.2" x2="19.1" y2="4.9" />
      <line x1="4.9" y1="19.1" x2="9.2" y2="14.8" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   Questions suggérées
   Chaque question est liée à un item de la FAQ via `faqKey`.
   Le format de la clé est `${catId}-${index}` (voir Faq.tsx).
   ────────────────────────────────────────────────────────────── */

type SuggestedQuestion = {
  label: string;
  faqKey: string;
};

const suggestedQuestions: SuggestedQuestion[] = [
  {
    label: "Comment fonctionne le planning de publication ?",
    faqKey: "general-2",
  },
  {
    label: "De quoi ai-je besoin pour connecter Instagram ?",
    faqKey: "technical-1",
  },
  {
    label: "Comment programmer un post sur plusieurs canaux ?",
    faqKey: "technical-1",
  },
  {
    label: "Quel format d'image fonctionne le mieux pour chaque réseau ?",
    faqKey: "technical-0",
  },
  {
    label: "Pourquoi mon post Instagram ne s'est pas publié automatiquement ?",
    faqKey: "support-0",
  },
];

/* Clé utilisée pour transmettre l'item FAQ à ouvrir entre les pages. */
export const PENDING_FAQ_KEY = "faq:pending";

/** Navigue vers la page FAQ en demandant l'ouverture d'un item précis. */
function goToFaqItem(faqKey: string) {
  try {
    sessionStorage.setItem(PENDING_FAQ_KEY, faqKey);
  } catch {
    // sessionStorage indisponible : on navigue quand même
  }
  navigate("faq");
}

/* ──────────────────────────────────────────────────────────────
   Widget d'aide : bouton flottant (bas droite) + panneau chatbot
   ────────────────────────────────────────────────────────────── */

export default function HelpChatButton({ isDark }: { isDark: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleQuestionClick = (item: SuggestedQuestion) => {
    setIsOpen(false);
    goToFaqItem(item.faqKey);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Fermer l'aide" : "Ouvrir l'aide"}
        aria-expanded={isOpen}
        className={[
          "fixed bottom-5 right-5 z-30 flex h-10 w-10 items-center justify-center rounded-full border transition",
          isDark
            ? "border-white/10 bg-white text-neutral-900 shadow-[0_12px_32px_rgba(0,0,0,0.4)] hover:bg-neutral-200"
            : "border-black/[0.06] bg-neutral-900 text-white shadow-[0_12px_32px_rgba(0,0,0,0.18)] hover:bg-neutral-800",
        ].join(" ")}
      >
        <QuestionMarkIcon className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          {/* Overlay léger pour fermer au clic en dehors, sans assombrir toute la page */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-label="Assistant d'aide"
            className={[
              "fixed bottom-20 right-5 z-50 flex max-h-[75vh] w-[360px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[22px] border",
              isDark
                ? "border-white/10 bg-[#141416] shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                : "border-black/[0.06] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]",
            ].join(" ")}
          >
            {/* En-tête */}
            <div
              className={[
                "shrink-0 border-b px-5 py-4",
                isDark ? "border-white/10 bg-[#1c1c1e]" : "border-black/[0.06] bg-neutral-100",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <p
                  className={[
                    "text-[15px] font-bold",
                    isDark ? "text-white" : "text-neutral-900",
                  ].join(" ")}
                >
                  Demandez à notre assistant d'aide
                </p>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Fermer"
                  className={[
                    "text-[16px] leading-none transition",
                    isDark ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-neutral-900",
                  ].join(" ")}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Corps scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p
                className={[
                  "mb-3 text-[13px] font-semibold",
                  isDark ? "text-white" : "text-neutral-900",
                ].join(" ")}
              >
                Questions suggérées
              </p>

              <div className="flex flex-col gap-2">
                {suggestedQuestions.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleQuestionClick(item)}
                    className={[
                      "rounded-xl border px-4 py-3 text-left text-[13.5px] transition",
                      isDark
                        ? "border-white/10 bg-[#1c1c1e] text-neutral-300 hover:border-white/20"
                        : "border-black/[0.08] bg-white text-neutral-700 hover:border-black/20",
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className={[
                  "mt-3 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-[13.5px] font-medium transition",
                  isDark
                    ? "border-white/10 bg-[#1c1c1e] text-white hover:border-white/20"
                    : "border-black/[0.08] bg-white text-neutral-900 hover:border-black/20",
                ].join(" ")}
              >
                <span className="flex items-center gap-2.5">
                  <LifebuoyIcon />
                  Contacter notre équipe support
                </span>
                <ExternalLinkIcon />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}