import PricingSection from "../components/PricingSection";
import { navigate } from "../hooks/useHashRoute";
import { useUser } from "../contexts/UserContext";

const FAQ = [
  {
    question: "Can I switch plans at any time?",
    answer:
      "Yes. You can upgrade or downgrade whenever you need to. Upgrades apply right away, and downgrades take effect at the start of your next billing period.",
  },
  {
    question: "How does annual billing work?",
    answer:
      "Annual plans are billed once a year at a 20% discount compared to monthly billing. You can switch back to monthly at renewal.",
  },
  {
    question: "Do you offer a free trial?",
    answer:
      "You can start with any plan and explore the product before committing. Reach out to us if you'd like a guided walkthrough for your team.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit and debit cards. Enterprise customers can also pay by invoice and bank transfer.",
  },
  {
    question: "What does the Enterprise plan include?",
    answer:
      "Everything in Pro, plus a dedicated success manager, SSO and role controls, a custom SLA and security reviews. Talk to sales to tailor it to your organization.",
  },
];

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 transition-transform duration-200"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function Pricing() {
  const { user, loading } = useUser();

  return (
    <main className="w-full bg-white text-neutral-900 dark:bg-[#050505] dark:text-white">
      {/* Flèche retour : uniquement pour un utilisateur connecté */}
      {!loading && user && (
        <button
          type="button"
          onClick={() => navigate("home")}
          aria-label="Retour au dashboard"
          className="group fixed left-[clamp(12px,2vw,28px)] top-[clamp(12px,2vw,28px)] z-50 inline-flex h-[clamp(34px,3.2vw,42px)] w-[clamp(34px,3.2vw,42px)] items-center justify-center rounded-full border border-black/10 bg-white/90 text-neutral-900 backdrop-blur transition hover:bg-neutral-100 dark:border-white/15 dark:bg-[#1c1c1c]/90 dark:text-white dark:hover:bg-[#262626]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[clamp(14px,1.4vw,18px)] w-[clamp(14px,1.4vw,18px)] transition-transform duration-300 group-hover:-translate-x-[2px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5" />
            <path d="M11 6l-6 6 6 6" />
          </svg>
        </button>
      )}

      {/* Plans : connecté → Stripe, non connecté → /signup */}
      <PricingSection />

      {/* FAQ */}
      <section id="faq" className="w-full bg-white pb-24 dark:bg-[#050505]">
        <div className="mx-auto max-w-[760px] px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-display text-[clamp(26px,3vw,40px)] font-bold leading-[1.05] tracking-[-0.04em]">
            Frequently asked questions
          </h2>
          <p className="mx-auto mt-3 max-w-[480px] text-center text-[clamp(14px,1.1vw,16px)] leading-relaxed text-neutral-600 dark:text-neutral-400">
            Everything you need to know about plans and billing.
          </p>

          <div className="mt-10 divide-y divide-black/10 border-y border-black/10 dark:divide-white/10 dark:border-white/10">
            {FAQ.map((item) => (
              <details
                key={item.question}
                className="group py-5 [&[open]_svg]:rotate-180"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span className="text-neutral-500 dark:text-neutral-400">
                    <ChevronIcon />
                  </span>
                </summary>
                <p className="mt-3 max-w-[640px] text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}