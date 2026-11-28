import PricingSection from "../components/PricingSection";
import { navigate } from "../hooks/useHashRoute";
import { useUser } from "../contexts/UserContext";

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
    </main>
  );
}