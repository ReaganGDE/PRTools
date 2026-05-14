import type { Contact } from "@/lib/db/schema";

export type Platform = "instagram" | "tiktok" | "reddit" | "youtube";

export interface DeepLinkResult {
  url: string | null;
  /** Whether the URL pre-fills the message (so user just clicks send). */
  prefilled: boolean;
  /** What user sees as the action label. */
  label: string;
  /** Reason URL is null, when applicable. */
  unavailableReason?: string;
}

export function deepLinkFor(
  platform: Platform,
  contact: Contact,
  options: { subject?: string; body: string },
): DeepLinkResult {
  switch (platform) {
    case "instagram": {
      const h = (contact.handleInstagram ?? "").trim().replace(/^@/, "");
      if (!h)
        return {
          url: null,
          prefilled: false,
          label: "No Instagram handle",
          unavailableReason: "Contact has no Instagram handle",
        };
      return {
        url: `https://ig.me/m/${encodeURIComponent(h)}`,
        prefilled: false,
        label: "Open Instagram DM",
      };
    }
    case "tiktok": {
      const h = (contact.handleTiktok ?? "").trim().replace(/^@/, "");
      if (!h)
        return {
          url: null,
          prefilled: false,
          label: "No TikTok handle",
          unavailableReason: "Contact has no TikTok handle",
        };
      return {
        url: `https://www.tiktok.com/@${encodeURIComponent(h)}`,
        prefilled: false,
        label: "Open TikTok profile",
      };
    }
    case "reddit": {
      const h = (contact.handleReddit ?? "")
        .trim()
        .replace(/^u\//, "")
        .replace(/^@/, "");
      if (!h)
        return {
          url: null,
          prefilled: false,
          label: "No Reddit handle",
          unavailableReason: "Contact has no Reddit handle",
        };
      const params = new URLSearchParams({
        to: h,
        message: options.body,
      });
      if (options.subject) params.set("subject", options.subject);
      return {
        url: `https://www.reddit.com/message/compose/?${params.toString()}`,
        prefilled: true,
        label: "Open Reddit compose (pre-filled)",
      };
    }
    case "youtube": {
      const h = (contact.handleYoutube ?? "").trim().replace(/^@/, "");
      if (!h && !contact.email)
        return {
          url: null,
          prefilled: false,
          label: "No YouTube handle or email",
          unavailableReason: "YouTube has no DMs. Need either a channel handle or email.",
        };
      if (h) {
        return {
          url: `https://www.youtube.com/@${encodeURIComponent(h)}/about`,
          prefilled: false,
          label: "Open YouTube channel (find email)",
        };
      }
      return {
        url: `mailto:${contact.email}`,
        prefilled: true,
        label: "Email (YouTube has no DMs)",
      };
    }
  }
}
