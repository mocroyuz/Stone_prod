import type { ComponentType } from "react";

import {
  FacebookIcon,
  InstagramIcon,
  PinterestIcon,
  ThreadsIcon,
  TikTokIcon,
  YouTubeIcon,
  LinkedInIcon,
  XIcon,
  BlueskyIcon,
  MastodonIcon,
  GoogleBusinessIcon,
  RedditIcon,
} from "../components/IntegrationIcons";
import type { Connection } from "../services/channelsCache";

export type ChannelKey =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "threads"
  | "linkedin"
  | "x"
  | "bluesky"
  | "mastodon"
  | "google_business"
  | "reddit";

export type IconComponent = ComponentType<{
  className?: string;
  size?: number;
}>;

export type Channel = {
  key: ChannelKey;
  name: string;
  subtitle: string;
  accountLabel: string;
  icon: IconComponent;
};

export type ConnectionState = Record<ChannelKey, Connection>;

export const PLAN = {
  name: "Free",
  maxChannels: 3,
};

export const CHANNELS: Channel[] = [
  {
    key: "instagram",
    name: "Instagram",
    subtitle: "Business or Creator",
    accountLabel: "Instagram Account",
    icon: InstagramIcon,
  },
  {
    key: "facebook",
    name: "Facebook",
    subtitle: "Page",
    accountLabel: "Facebook Page",
    icon: FacebookIcon,
  },
  {
    key: "threads",
    name: "Threads",
    subtitle: "Profile",
    accountLabel: "Threads Profile",
    icon: ThreadsIcon,
  },
  {
    key: "youtube",
    name: "YouTube Shorts",
    subtitle: "Channel",
    accountLabel: "YouTube Shorts Channel",
    icon: YouTubeIcon,
  },
  {
    key: "tiktok",
    name: "TikTok",
    subtitle: "Business or Personal",
    accountLabel: "TikTok Account",
    icon: TikTokIcon,
  },
  {
    key: "pinterest",
    name: "Pinterest",
    subtitle: "Business or Profile",
    accountLabel: "Pinterest Account",
    icon: PinterestIcon,
  },
  { key: "linkedin", name: "LinkedIn", subtitle: "Page or profile · Bientôt disponible", accountLabel: "LinkedIn Account", icon: LinkedInIcon },
  { key: "x", name: "X", subtitle: "Profile · Bientôt disponible", accountLabel: "X Account", icon: XIcon },
  { key: "bluesky", name: "Bluesky", subtitle: "Profile · Bientôt disponible", accountLabel: "Bluesky Account", icon: BlueskyIcon },
  { key: "mastodon", name: "Mastodon", subtitle: "Profile · Bientôt disponible", accountLabel: "Mastodon Account", icon: MastodonIcon },
  { key: "google_business", name: "Google Business Profile", subtitle: "Business listing · Bientôt disponible", accountLabel: "Business Profile", icon: GoogleBusinessIcon },
  { key: "reddit", name: "Reddit", subtitle: "Community · Bientôt disponible", accountLabel: "Reddit Account", icon: RedditIcon },
];
