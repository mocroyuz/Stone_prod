// src/components/insights/PostRow.tsx
// Vignette de post (image réelle ou pictogramme du type de média).

import { FileText, Image as ImageIcon, Play } from "lucide-react";
import type { PostRow } from "./copy";
import type { Ink } from "./theme";

export function PostThumb({
  post,
  ink,
  size = 40,
}: {
  post: PostRow;
  ink: Ink;
  size?: number;
}) {
  const Icon = post.media === "video" ? Play : post.media === "image" ? ImageIcon : FileText;
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border ${ink.well} ${ink.muted}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {post.thumbnailUrl ? (
        <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
    </span>
  );
}
