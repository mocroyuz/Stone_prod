export type SectionKey =
  | "profile"
  | "account"
  | "mfa"
  | "appearance"
  | "preferences"
  | "billing"
  | "channels"
  | "tags"
  | "savedReplies"
  | "danger";

const SECTION_SLUGS: Record<SectionKey, string> = {
  profile: "profile",
  account: "security",
  mfa: "two-factor",
  appearance: "appearance",
  preferences: "preferences",
  billing: "billing",
  channels: "channels",
  tags: "tags",
  savedReplies: "saved-replies",
  danger: "danger-zone",
};

export const settingsPath = (key: SectionKey) =>
  `settings/${SECTION_SLUGS[key]}`;

export function sectionFromSlug(slug?: string | null): SectionKey | undefined {
  return (Object.keys(SECTION_SLUGS) as SectionKey[]).find(
    (key) => SECTION_SLUGS[key] === slug
  );
}
