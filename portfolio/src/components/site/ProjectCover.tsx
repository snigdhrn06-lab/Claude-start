/** Cover for a project: the cover image, else the first gallery image, else its illustrative visual. */
import { MediaImage } from "@/components/shared/MediaImage";
import { ProjectVisual } from "@/components/shared/ProjectVisual";
import type { PublicMedia } from "@/lib/media-url";
import { cn } from "@/lib/utils";

type P = { coverMediaId: string | null; gallery: { mediaId: string }[]; visual: string; accent: string; title: string };

export function coverMediaFor(p: P, media: Record<string, PublicMedia>) {
  return (p.coverMediaId && media[p.coverMediaId]) || (p.gallery[0] && media[p.gallery[0].mediaId]) || null;
}

export function ProjectCover({ project, media, sizes, className, priority }: { project: P; media: Record<string, PublicMedia>; sizes: string; className?: string; priority?: boolean }) {
  const img = coverMediaFor(project, media);
  if (img) return <MediaImage media={img} sizes={sizes} priority={priority} alt={img.alt || project.title} className={cn("h-full w-full object-cover object-top", className)} />;
  return <ProjectVisual visual={project.visual} accent={project.accent} className={cn("h-full w-full", className)} />;
}
