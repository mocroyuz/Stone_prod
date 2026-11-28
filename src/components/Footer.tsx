import BrandMark from "./BrandMark";

const serviceLinks = ["ui/ux design", "web design", "webflow design", "framer design"];
const quickLinks = [
  { label: "Home", href: "/" },
  { label: "FAQs", href: "/faq" },
  { label: "Blogs", href: "#" },
];

const socialLinks = [
  {
    label: "X",
    href: "https://x.com",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M18.9 2.5h3.1l-6.8 7.8L22.5 21h-6.2l-4.9-7.1L6.1 21H3l7.2-8.3L3 2.5h6.4l4.4 6.5 5.1-6.5Zm-1.1 16.6h1.7L7.3 4.1H5.4l12.4 15Z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://instagram.com",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
        <circle cx="12" cy="12" r="4.1" />
        <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M6.5 8.5A1.8 1.8 0 1 1 6.5 4a1.8 1.8 0 0 1 0 4.5ZM4.6 10.5h3.8V20H4.6v-9.5Zm6.3 0h3.7v1.3h.1c.5-.9 1.8-1.9 3.7-1.9 3.9 0 4.6 2.6 4.6 5.9V20h-3.8v-18.6c0-1.2-.1-2.7-1.6-2.7-1.7 0-1.9 1.2-1.9 2.5V20h-3.8v-9.5Z" />
      </svg>
    ),
  },
  {
    label: "GitHub",
    href: "https://github.com",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M12 2.3A9.7 9.7 0 0 0 2.4 12.2c0 4.3 2.8 7.9 6.7 9.2.5.1.7-.2.7-.5v-1.8c-2.7.6-3.3-1.3-3.3-1.3-.4-1.1-1-1.4-1-1.4-.9-.6.1-.6.1-.6.9.1 1.5 1 1.5 1 .8 1.4 2.2 1 2.7.8.1-.6.3-1.1.6-1.3-2.2-.3-4.5-1.1-4.5-4.9 0-1.1.4-2 1.1-2.7-.1-.3-.5-1.3.1-2.7 0 0 .9-.3 2.8 1a9.5 9.5 0 0 1 5.1 0c1.9-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7.7.7 1.1 1.6 1.1 2.7 0 3.8-2.3 4.6-4.5 4.9.4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5a9.8 9.8 0 0 0 6.7-9.2A9.7 9.7 0 0 0 12 2.3Z" />
      </svg>
    ),
  },
] as const;

function FooterLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="text-[13px] leading-relaxed text-neutral-600 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
    >
      {label}
    </a>
  );
}

export default function Footer() {
  return (
    <footer className="w-full">
      <div className="w-full bg-white px-5 py-8 dark:bg-[#050505] sm:px-8 lg:px-[clamp(48px,8vw,120px)] lg:py-12">
        <form
          className="mx-auto flex w-full max-w-[700px] flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const email = String(form.get("email") ?? "").trim();
            window.location.href = `/signup?email=${encodeURIComponent(email)}`;
          }}
        >
          <label className="flex min-h-12 flex-1 items-center gap-3 rounded-lg border border-black/10 px-4 text-sm text-neutral-400 dark:border-white/10">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m4 7 8 6 8-6" />
            </svg>
            <input name="email" type="email" required placeholder="Your email here" aria-label="Your email" className="w-full bg-transparent outline-none placeholder:text-neutral-400" />
          </label>
          <button type="submit" className="min-h-12 rounded-lg bg-neutral-900 px-7 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
            Let&apos;s Go&nbsp; → 
          </button>
        </form>

        <div className="mx-auto mt-16 grid max-w-[1400px] gap-12 md:grid-cols-[1.25fr_2fr] md:items-start lg:mt-20">
          <div>
            <BrandMark name="Stone" />
            <p className="mt-4 max-w-[23rem] text-xs leading-5 text-neutral-600 dark:text-neutral-400">
              Design systems, product storytelling, and conversion-focused experiences built to help modern teams ship with clarity.
            </p>
            <div className="my-6 h-px w-24 bg-neutral-300 dark:bg-neutral-700" />
            <div className="flex items-center gap-2">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  aria-label={link.label}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-100 text-neutral-700 transition hover:bg-neutral-200 hover:text-neutral-900 dark:bg-white/[0.08] dark:text-neutral-300 dark:hover:bg-white/[0.14] dark:hover:text-white"
                >
                  {link.icon}
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h3 className="text-base font-semibold">
                Services
              </h3>
              <nav aria-label="Services links" className="mt-5 flex flex-col gap-3">
                {serviceLinks.map((link) => (
                  <FooterLink key={link} label={link} href="#" />
                ))}
              </nav>
            </div>

            <div>
              <h3 className="text-base font-semibold">
                Quick link
              </h3>
              <nav aria-label="Quick links" className="mt-5 flex flex-col gap-3">
                {quickLinks.map((link) => (
                  <FooterLink key={link.label} label={link.label} href={link.href} />
                ))}
              </nav>
            </div>

            <div>
              <h3 className="text-base font-semibold">
                Contact
              </h3>
              <div className="mt-5 space-y-4 text-[13px] text-neutral-600 dark:text-neutral-400">
                <a href="tel:+78767823876" className="block transition hover:text-neutral-900 dark:hover:text-white">◉ &nbsp;+78767823876</a>
                <p>⌖ &nbsp; Dhaka, Bangladesh</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-[1400px] border-t border-black/10 pt-5 dark:border-white/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">© 2025 Nexteeb. All rights reserved.</p>

            <nav aria-label="Legal links" className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
              <a href="/privacy" className="transition hover:text-neutral-900 dark:hover:text-white">
                Privacy Policy
              </a>
              <a href="/tos" className="transition hover:text-neutral-900 dark:hover:text-white">
                Terms of Service
              </a>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}