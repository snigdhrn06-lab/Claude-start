/** Responsive image from the media library (WebP variants with srcset). */
import type { PublicMedia } from "@/lib/media-url";
import { cn } from "@/lib/utils";

export function MediaImage({
  media,
  sizes = "100vw",
  className,
  alt,
  priority = false,
  style,
}: {
  media: PublicMedia | undefined | null;
  sizes?: string;
  className?: string;
  alt?: string;
  priority?: boolean;
  style?: React.CSSProperties;
}) {
  if (!media || media.kind !== "image") return null;
  return (
    <img
      src={media.url}
      srcSet={media.srcSet || undefined}
      sizes={sizes}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      alt={alt ?? media.alt ?? ""}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      className={cn("block", className)}
      style={style}
    />
  );
}
