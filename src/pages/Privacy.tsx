// src/pages/Privacy.tsx
import DashboardSidebar from "../components/Navbar";
import { useUser } from "../contexts/UserContext";
import { navigate } from "../hooks/useHashRoute";
import { useTheme } from "../hooks/useTheme";

type Section = {
  id: string;
  title: string;
  paragraphs: string[];
  list?: string[];
};

const LAST_UPDATED = "November 17, 2026";

const SECTIONS: Section[] = [
  {
    id: "intro",
    title: "Introduction",
    paragraphs: [
      "This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website, platform, products, and services (collectively, the “Service”).",
      "Important: this notice is incomplete. The controller’s full legal identity and postal address, the complete retention schedule, provider locations and the dedicated privacy contact still need to be verified and published. Use of the Service does not, by itself, constitute consent to optional processing.",
    ],
  },
  {
    id: "data-we-collect",
    title: "Information We Collect",
    paragraphs: [
      "We collect information that you provide directly to us, information collected automatically when you use the Service, and information from third-party sources.",
    ],
    list: [
      "Account data: name, email address, password, company name, and billing details.",
      "Usage data: pages visited, features used, session duration, IP address, browser type, and device information.",
      "Content data: any data you submit, upload, or generate through the Service.",
      "Communication data: messages you send to our support team or via in-app chat.",
    ],
  },
  {
    id: "how-we-use",
    title: "How We Use Your Information",
    paragraphs: [
      "We use the information we collect to operate, maintain, and improve the Service, and to communicate with you.",
    ],
    list: [
      "Provide, operate, and maintain the Service.",
      "Process transactions and send related information, including invoices and receipts.",
      "Respond to your comments, questions, and customer support requests.",
      "Send technical notices, updates, security alerts, and administrative messages.",
      "Detect, prevent, and address technical issues, fraud, or abuse.",
      "Comply with legal obligations and enforce our Terms of Service.",
    ],
  },
  {
    id: "legal-basis",
    title: "Legal Basis for Processing (GDPR)",
    paragraphs: [
      "If you are located in the European Economic Area (EEA), we process your personal data on the following legal bases:",
    ],
    list: [
      "Performance of a contract — to provide the Service you have requested.",
      "Legitimate interests — to improve the Service, prevent fraud, and ensure security.",
      "Consent — where you have given explicit consent (for example, for marketing emails).",
      "Legal obligation — to comply with applicable laws and regulations.",
    ],
  },
  {
    id: "sharing",
    title: "How We Share Your Information",
    paragraphs: [
      "Stone may disclose personal data to providers and platforms where this is necessary to deliver features requested by you or to meet legal obligations. The complete provider contract and international-transfer inventory is still being verified:",
    ],
    list: [
      "Service providers — hosting, authentication, database, storage and payment providers. Their precise contractual status, locations and sub-processors must be confirmed before this notice is final.",
      "Business transfers — in connection with a merger, acquisition, or sale of assets, in which case we will notify you.",
      "Legal requirements — when required by law, court order, or to protect our rights, property, or safety.",
      "With your consent — when you explicitly authorize us to share your information.",
    ],
  },
  {
    id: "data-storage",
    title: "Data Storage and Security",
    paragraphs: [
      "Stone encrypts OAuth credentials stored by its backend using AES-256-GCM when the production encryption key is configured. This statement does not mean that every category of data or every provider storage system has been independently verified as encrypted at rest. Hosting regions and provider-side security settings depend on the actual configuration of each provider and must be confirmed before they can be stated.",
      "We maintain administrative, technical, and physical safeguards designed to protect your information. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.",
    ],
  },
  {
    id: "retention",
    title: "Data Retention",
    paragraphs: [
      "We retain your personal data for as long as your account is active or as needed to provide the Service. We may also retain certain information as necessary to comply with legal obligations, resolve disputes, and enforce our agreements.",
      "A complete self-service account deletion process is not yet available. Do not rely on this notice as confirmation that deletion has been completed. The deletion process, including connected services, storage objects, backups and legally required records, must be completed and verified before a deletion period can be promised.",
    ],
  },
  {
    id: "your-rights",
    title: "Your Rights",
    paragraphs: [
      "Depending on your jurisdiction, you may have the following rights regarding your personal data:",
    ],
    list: [
      "Access — request a copy of the personal data we hold about you.",
      "Rectification — request correction of inaccurate or incomplete data.",
      "Erasure — request deletion of your personal data (“right to be forgotten”).",
      "Restriction — request that we limit the processing of your data.",
      "Portability — receive your data in a structured, machine-readable format.",
      "Objection — object to processing based on legitimate interests or for direct marketing.",
      "Withdraw consent — withdraw any consent you have previously given, at any time.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies and Tracking",
    paragraphs: [
      "The Service uses browser storage and session mechanisms required for authentication and operation. A complete production inventory of cookies, local storage, SDKs and third-party traceurs has not yet been verified. Browser settings alone may not provide all the controls required for optional traceurs.",
      "No analytics or advertising tracker integration was identified in the source-code review. This does not exclude scripts or cookies configured outside the repository. Optional analytics or advertising traceurs must not be activated until an effective consent mechanism blocks them before consent and allows withdrawal.",
    ],
  },
  {
    id: "third-party",
    title: "Third-Party Services",
    paragraphs: [
      "Depending on the features used, Stone can connect to Supabase, Render, Vercel, Stripe, Meta services, Google services, TikTok, Pinterest, Threads, Dropbox and Canva. The exact roles, processing locations, contractual terms and international transfers for each provider are still being verified. Each connected platform also processes data under its own privacy terms.",
      "We encourage you to review the privacy policies of any third-party service you connect to or visit.",
    ],
  },
  {
    id: "children",
    title: "Children's Privacy",
    paragraphs: [
      "The Service is not directed to individuals under the age of 18. We do not knowingly collect personal data from children. If you believe we have collected data from a child, please contact us and we will take steps to delete it.",
    ],
  },
  {
    id: "international",
    title: "International Data Transfers",
    paragraphs: [
      "Some providers may process data outside the European Economic Area. The countries, recipients and transfer mechanisms applicable to Stone have not yet been fully verified. We will identify the actual transfers and applicable safeguards before making a compliance statement about them.",
    ],
  },
  {
    id: "changes",
    title: "Changes to This Policy",
    paragraphs: [
      "We may update this notice when the Service or applicable requirements change. We will communicate material changes through an appropriate channel where required by law. Continued use of the Service is not a substitute for consent where consent is legally required.",
      "Your continued use of the Service after the effective date of the revised policy constitutes your acceptance of the changes.",
    ],
  },
  {
    id: "contact",
    title: "Contact Us",
    paragraphs: [
      "A dedicated privacy request contact channel is not currently published. The controller must add a working privacy email address and postal address before this notice can be considered complete. No Data Protection Officer is identified here unless one has formally been appointed.",
    ],
  },
];

export default function Privacy() {
  const { user, loading } = useUser();
  const { theme, toggle } = useTheme();

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`privacy-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* Connecté → flèche retour vers /home. Non connecté → navbar.
          Pendant le chargement de la session, on n'affiche rien
          pour éviter un flash de la navbar. */}
      {!loading && !user && <DashboardSidebar theme={theme} onToggleTheme={toggle} />}

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
            Privacy Policy
          </h1>

          <p className="mx-auto mt-[clamp(10px,1.4vw,18px)] max-w-[560px] text-center text-[clamp(12px,1.25vw,14.5px)] leading-relaxed text-neutral-500">
            Comment nous collectons, utilisons et protégeons vos données
            personnelles.
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
                id={`privacy-${section.id}`}
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
            <p className="text-center text-[clamp(11.5px,1.2vw,13.5px)] text-neutral-500">
              Privacy contact details are not yet published. This notice is incomplete.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}