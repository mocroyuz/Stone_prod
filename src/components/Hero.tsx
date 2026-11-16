import { navigate } from "../hooks/useHashRoute";
import { img1, img2, img3 } from "../data/images";

type HeroCard = {
  src: string;
  alt: string;
  /** Largeur de la carte (clamp responsive). */
  width: string;
  /** Rotation / décalage vertical : léger éventail, comme sur la maquette. */
  transform: string;
  delay: number;
  z: number;
};

const CARDS: HeroCard[] = [
  {
    src: img1,
    alt: "Black liquid sculpture",
    width: "clamp(96px,17vw,236px)",
    transform: "translateY(-3%) rotate(-4deg)",
    delay: 180,
    z: 10,
  },
  {
    src: img2,
    alt: "White glossy sculpture",
    width: "clamp(112px,20.5vw,280px)",
    transform: "translateY(5%) scale(1.02)",
    delay: 300,
    z: 20,
  },
  {
    src: img3,
    alt: "Chrome knot sculpture",
    width: "clamp(96px,17vw,236px)",
    transform: "translateY(9%) rotate(4deg)",
    delay: 420,
    z: 10,
  },
];

function scrollToWork() {
  document.getElementById("our-work")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });
}

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-[clamp(16px,4vw,56px)] pt-[clamp(90px,10vw,140px)] pb-[clamp(40px,6vw,90px)]"
    >
      {/* wordmark, en haut à gauche (masqué sur mobile pour ne pas toucher la pill) */}
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate("");
        }}
        aria-label="Stone"
        className="absolute left-[clamp(20px,4vw,64px)] top-[clamp(14px,1.9vw,26px)] z-20 hidden items-center gap-1 md:flex"
      >
        <img
          src="/images/icon.png"
          alt=""
          className="h-9 w-auto object-contain dark:invert"
          draggable={false}
        />
        <span className="font-display text-[19px] font-bold tracking-[-0.03em] text-neutral-900 dark:text-white">
          Stone
        </span>
      </a>

      <div className="relative z-10 flex w-full max-w-[1100px] flex-col items-center text-center">
        {/* sur-titre en script */}
        <p
          className="hero-rise font-script text-[clamp(30px,4.6vw,60px)] leading-none text-neutral-700 dark:text-neutral-200"
          style={{ animationDelay: "0ms" }}
        >
          all your socials,
        </p>

        {/* titre */}
        <h1
          className="hero-rise mt-[clamp(4px,0.8vw,10px)] font-display text-[clamp(40px,7.4vw,104px)] font-bold leading-[1.02] tracking-[-0.04em] text-neutral-900 dark:text-white"
          style={{ animationDelay: "90ms" }}
        >
          Post once, everywhere
        </h1>

        {/* trois cartes verticales */}
        <div className="mt-[clamp(26px,4.4vw,64px)] flex items-center justify-center gap-[clamp(8px,1.7vw,24px)]">
          {CARDS.map((card) => (
            <div
              key={card.src}
              className="hero-rise"
              style={{
                width: card.width,
                zIndex: card.z,
                animationDelay: `${card.delay}ms`,
              }}
            >
              <div
                className={[
                  "group relative aspect-[3/5] w-full overflow-hidden",
                  "rounded-[clamp(16px,2.1vw,30px)] bg-neutral-200 dark:bg-[#141416]",
                  "ring-1 ring-black/10 dark:ring-white/[0.12]",
                  "shadow-[0_30px_60px_-24px_rgba(0,0,0,0.45),0_10px_22px_-10px_rgba(0,0,0,0.3)]",
                  "dark:shadow-[0_34px_70px_-22px_rgba(0,0,0,0.95),0_10px_24px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.08)]",
                  "transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "hover:!-translate-y-2 hover:shadow-[0_44px_80px_-24px_rgba(0,0,0,0.55),0_14px_28px_-10px_rgba(0,0,0,0.35)]",
                  "dark:hover:shadow-[0_48px_90px_-22px_rgba(0,0,0,1),0_14px_30px_-10px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.1)]",
                ].join(" ")}
                style={{ transform: card.transform }}
              >
                <img
                  src={card.src}
                  alt={card.alt}
                  draggable={false}
                  className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                />
              </div>
            </div>
          ))}
        </div>

        {/* actions */}
        <div
          className="hero-rise mt-[clamp(40px,6vw,84px)] flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "540ms" }}
        >
          <a
            href="/signup"
            onClick={(e) => {
              e.preventDefault();
              navigate("signup");
            }}
            className="group inline-flex items-center gap-2 rounded-full bg-neutral-900 px-[clamp(20px,2.1vw,32px)] py-[clamp(11px,1.15vw,16px)] text-[clamp(12px,1.05vw,15px)] font-medium text-white shadow-[0_18px_30px_-18px_rgba(0,0,0,0.8)] transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Start your 7-day free trial
            <svg
              viewBox="0 0 12 12"
              className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-[2px]"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2.5 6h7M6.6 2.8 9.8 6l-3.2 3.2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          <button
            type="button"
            onClick={scrollToWork}
            className="inline-flex items-center rounded-full border border-black/10 px-[clamp(20px,2.1vw,32px)] py-[clamp(11px,1.15vw,16px)] text-[clamp(12px,1.05vw,15px)] font-medium text-neutral-900 shadow-[0_10px_24px_-16px_rgba(0,0,0,0.35)] transition hover:bg-black/[0.04] dark:border-white/[0.14] dark:text-white dark:shadow-[0_10px_24px_-16px_rgba(0,0,0,0.9)] dark:hover:bg-white/[0.07]"
          >
            See our work
          </button>
        </div>
      </div>
    </section>
  );
}
