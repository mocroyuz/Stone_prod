import NetworkLogo, { NETWORK_LABELS, type LandingNetwork } from "./NetworkLogo";
import Reveal from "./Reveal";

/* Réseaux pour lesquels la page « Canaux » propose réellement un bouton de
   connexion. Facebook (connexion des Pages « pas encore disponible ») et les
   réseaux marqués « Bientôt disponible » sont volontairement séparés. */
const AVAILABLE: LandingNetwork[] = ["instagram", "threads", "youtube", "tiktok", "pinterest"];
const COMING_SOON = ["LinkedIn", "X", "Bluesky", "Mastodon", "Google Business Profile", "Reddit"];

export default function NetworksSection() {
  return (
    <section aria-labelledby="reseaux-titre" className="px-5 pt-14 sm:px-8 sm:pt-20">
      <Reveal className="mx-auto w-full max-w-[1200px]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
          <div className="shrink-0 lg:w-[230px] lg:border-r lg:border-black/[0.1] lg:pr-8 dark:lg:border-white/[0.12]">
            <h2 id="reseaux-titre" className="font-display text-[17px] font-bold tracking-[-0.02em]">
              Connectez vos réseaux
            </h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-neutral-600 dark:text-neutral-400">
              Les comptes que vous gérez déjà, reliés à Stone.
            </p>
          </div>

          <ul className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {AVAILABLE.map((network) => (
              <li
                key={network}
                className="flex h-[60px] items-center gap-2.5 rounded-full border border-black/[0.09] bg-white px-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_24px_-16px_rgba(0,0,0,0.3)] dark:border-white/[0.1] dark:bg-[#111113] dark:shadow-none dark:hover:shadow-[0_16px_28px_-16px_rgba(0,0,0,1)]"
              >
                <NetworkLogo network={network} size={34} />
                <span className="truncate text-[13px] font-semibold tracking-[-0.01em]">
                  {NETWORK_LABELS[network]}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 space-y-1.5 text-[12.5px] leading-relaxed text-neutral-500 dark:text-neutral-500">
          <p>
            Bientôt disponibles : {COMING_SOON.join(", ")}. La connexion des Pages Facebook n&rsquo;est pas encore
            ouverte.
          </p>
          <p>
            TikTok : selon l&rsquo;état de validation de l&rsquo;application, vos publications peuvent arriver en
            brouillon dans votre boîte TikTok.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
