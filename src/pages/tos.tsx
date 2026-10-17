// src/pages/Tos.tsx
import DashboardSidebar from "../components/Navbar";
import { useUser } from "../contexts/UserContext";
import { navigate } from "../hooks/useHashRoute";

type Section = {
  id: string;
  title: string;
  paragraphs: string[];
  list?: string[];
};

const LAST_UPDATED = "January 1, 2025";

const SECTIONS: Section[] = [
  {
    id: "acceptance",
    title: "Acceptance of Terms",
    paragraphs: [
      "These Terms of Service (“Terms”) govern your access to and use of our website, platform, products, and services (collectively, the “Service”). By accessing or using the Service, you agree to be bound by these Terms.",
      "If you do not agree to these Terms, you must not access or use the Service. If you are entering into these Terms on behalf of a company or other legal entity, you represent that you have the authority to bind that entity.",
    ],
  },
  {
    id: "service",
    title: "Description of Service",
    paragraphs: [
      "We provide AI automation, workflow integration, and related digital products designed to help teams ship faster. The Service may include software, APIs, documentation, and support.",
      "We may modify, suspend, or discontinue any part of the Service at any time, with or without notice. We will use reasonable efforts to notify you of material changes that affect your use of the Service.",
    ],
  },
  {
    id: "accounts",
    title: "Eligibility and Accounts",
    paragraphs: [
      "You must be at least 18 years old and capable of entering into a binding contract to use the Service.",
      "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use.",
    ],
  },
  {
    id: "billing",
    title: "Subscriptions and Billing",
    paragraphs: [
      "Paid plans are billed in advance on a monthly or annual basis, depending on the plan you select. By subscribing, you authorize us to charge your selected payment method on a recurring basis until you cancel.",
      "Fees are non-refundable except as described in Section 5. We may change our prices with at least 30 days' notice; continued use of the Service after a price change constitutes your acceptance of the new pricing.",
    ],
  },
  {
    id: "trials",
    title: "Free Trials and Refunds",
    paragraphs: [
      "We offer a 14-day free trial on every plan — no credit card required. You get full access to all features so you can evaluate the product on real use cases.",
      "We also offer a 30-day money-back guarantee on all first-time subscriptions. If the product does not fit your needs, contact support and we will issue a full refund.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use",
    paragraphs: [
      "You agree not to misuse the Service. In particular, you agree not to:",
    ],
    list: [
      "Violate any applicable law, regulation, or third-party right.",
      "Infringe or misappropriate any intellectual property or privacy right.",
      "Upload or transmit malware, spam, or any harmful code.",
      "Reverse engineer, decompile, or attempt to extract the source code of the Service.",
      "Resell, sublicense, or provide the Service to third parties without our prior written consent.",
      "Scrape, overload, or interfere with the integrity or performance of the Service.",
    ],
  },
  {
    id: "ip",
    title: "Intellectual Property",
    paragraphs: [
      "All rights, title, and interest in the Service — including software, design, text, graphics, logos, and trademarks — are owned by us or our licensors and are protected by applicable intellectual property laws.",
      "Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your internal business purposes.",
    ],
  },
  {
    id: "data",
    title: "Customer Data and Privacy",
    paragraphs: [
      "You retain all rights to the data you submit to the Service (“Customer Data”). You grant us a limited license to process Customer Data solely to provide, secure, and improve the Service.",
      "Our collection and use of personal data is described in our Privacy Policy. Data is stored in EU-based data centers by default, and we comply with GDPR and SOC 2 standards.",
    ],
  },
  {
    id: "third-party",
    title: "Third-Party Services",
    paragraphs: [
      "The Service may integrate with third-party tools (for example, Slack, Notion, HubSpot, or Zapier). Your use of those services is governed by their own terms and privacy policies.",
      "We are not responsible for the acts, omissions, or content of any third-party service, and we do not warrant their availability or reliability.",
    ],
  },
  {
    id: "warranties",
    title: "Disclaimer of Warranties",
    paragraphs: [
      "THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.",
      "We do not warrant that the Service will be uninterrupted, error-free, or completely secure, or that any content or results obtained through the Service will be accurate or reliable.",
    ],
  },
  {
    id: "liability",
    title: "Limitation of Liability",
    paragraphs: [
      "To the maximum extent permitted by applicable law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, or goodwill.",
      "Our aggregate liability arising out of or relating to these Terms or the Service shall not exceed the total amount you paid us in the twelve (12) months preceding the event giving rise to the claim.",
    ],
  },
  {
    id: "indemnification",
    title: "Indemnification",
    paragraphs: [
      "You agree to indemnify, defend, and hold harmless us and our officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses arising out of or related to your use of the Service or your violation of these Terms.",
    ],
  },
  {
    id: "termination",
    title: "Termination",
    paragraphs: [
      "You may cancel your subscription at any time directly from your dashboard. Cancellation takes effect at the end of the current billing period.",
      "We may suspend or terminate your access to the Service immediately if you materially breach these Terms or use the Service in a way that may cause harm to us, other users, or third parties.",
    ],
  },
  {
    id: "changes",
    title: "Changes to These Terms",
    paragraphs: [
      "We may update these Terms from time to time. Material changes will be notified by email or in-app at least 14 days before they take effect.",
      "Your continued use of the Service after the effective date of the revised Terms constitutes your acceptance of the changes.",
    ],
  },
  {
    id: "law",
    title: "Governing Law",
    paragraphs: [
      "These Terms are governed by and construed in accordance with the laws of France, without regard to its conflict-of-law principles.",
      "Any dispute arising out of or relating to these Terms or the Service shall be subject to the exclusive jurisdiction of the competent courts of Paris, France.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      "If you have any questions about these Terms, you can reach us at legal@example.com or via our contact page.",
    ],
  },
];

export default function Tos() {
  const { user, loading } = useUser();

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`tos-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
          className="group fixed left-[clamp(12px,2vw,28px)] top-[clamp(12px,2vw,28px)] z-50 inline-flex h-[clamp(34px,3.2vw,42px)] w-[clamp(34px,3.2vw,42px)] items-center justify-center rounded-full border border-black/[0.08] bg-[#f2f0ec] text-neutral-900 transition hover:bg-[#ebe9e4]"
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

      <main className="relative min-h-screen w-full bg-white text-neutral-900">
        <div className="mx-auto w-full max-w-[900px] px-[clamp(16px,4vw,40px)] py-[clamp(48px,7vw,110px)]">
          {/* titre */}
          <h1 className="text-center text-[clamp(28px,4.6vw,56px)] font-semibold leading-[1.05] tracking-[-0.03em] text-neutral-900">
            Terms of Service
          </h1>

          <p className="mx-auto mt-[clamp(10px,1.4vw,18px)] max-w-[560px] text-center text-[clamp(12px,1.25vw,14.5px)] leading-relaxed text-neutral-500">
            Les règles qui encadrent l'utilisation de nos produits et services.
            Merci de les lire attentivement.
          </p>

          <p className="mt-[clamp(10px,1.2vw,16px)] text-center text-[clamp(10.5px,1.05vw,12px)] font-medium uppercase tracking-[0.16em] text-neutral-400">
            Last updated — {LAST_UPDATED}
          </p>

          {/* sommaire */}
          <nav
            aria-label="On this page"
            className="mt-[clamp(22px,2.8vw,36px)] rounded-[clamp(14px,1.6vw,20px)] border border-black/[0.06] bg-[#f2f0ec] p-[clamp(14px,1.8vw,22px)]"
          >
            <p className="mb-[clamp(10px,1.2vw,14px)] text-[clamp(10.5px,1.05vw,12px)] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              On this page
            </p>
            <div className="grid grid-cols-1 gap-x-[clamp(14px,1.8vw,24px)] gap-y-[clamp(4px,0.6vw,8px)] sm:grid-cols-2">
              {SECTIONS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  className="group flex items-baseline gap-[clamp(8px,1vw,12px)] text-left text-[clamp(11.5px,1.2vw,13px)] text-neutral-600 transition hover:text-neutral-900"
                >
                  <span className="tabular-nums text-[clamp(10.5px,1.05vw,12px)] font-medium text-neutral-400 transition-colors group-hover:text-[#6b8cff]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate">{s.title}</span>
                </button>
              ))}
            </div>
          </nav>

          {/* contenu */}
          <div className="mt-[clamp(32px,4.4vw,56px)] flex flex-col gap-[clamp(28px,3.6vw,46px)]">
            {SECTIONS.map((section, i) => (
              <section
                key={section.id}
                id={`tos-${section.id}`}
                className="scroll-mt-24"
              >
                {/* en-tête section */}
                <div className="mb-[clamp(10px,1.3vw,16px)] flex items-center gap-[clamp(10px,1.4vw,16px)]">
                  <span className="text-[clamp(11px,1.15vw,13px)] font-semibold tabular-nums text-[#6b8cff]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-[clamp(14px,1.55vw,17.5px)] font-semibold tracking-[-0.01em] text-neutral-900">
                    {section.title}
                  </h2>
                  <span className="h-[1px] flex-1 bg-black/[0.08]" />
                </div>

                <div className="flex flex-col gap-[clamp(10px,1.2vw,14px)]">
                  {section.paragraphs.map((p, j) => (
                    <p
                      key={j}
                      className="text-[clamp(11.5px,1.2vw,13px)] leading-relaxed text-neutral-500"
                    >
                      {p}
                    </p>
                  ))}

                  {section.list && (
                    <ul className="mt-[2px] flex flex-col gap-[clamp(6px,0.7vw,10px)]">
                      {section.list.map((li, k) => (
                        <li
                          key={k}
                          className="flex items-start gap-[clamp(8px,1vw,12px)] text-[clamp(11.5px,1.2vw,13px)] leading-relaxed text-neutral-500"
                        >
                          <span className="mt-[clamp(6px,0.7vw,8px)] h-[4px] w-[4px] shrink-0 rounded-full bg-neutral-300" />
                          <span>{li}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ))}
          </div>

          {/* footer */}
          <div className="mt-[clamp(40px,5vw,72px)] flex flex-col items-center gap-[clamp(4px,0.6vw,8px)]">
            <p className="text-[clamp(11.5px,1.2vw,13.5px)] text-neutral-500">
              Questions about these Terms?
            </p>
            <button
              type="button"
              onClick={() => navigate("contact")}
              className="group inline-flex items-center gap-[6px] text-[clamp(11.5px,1.2vw,13.5px)] font-medium text-neutral-900"
            >
              Contact Us
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-neutral-900 text-[10px] text-white transition-transform duration-300 group-hover:translate-x-[2px]">
                →
              </span>
            </button>
          </div>
        </div>
      </main>
    </>
  );
}