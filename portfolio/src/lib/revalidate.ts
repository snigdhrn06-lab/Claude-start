import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { CONTENT_TAG } from "@/lib/content/queries";

/**
 * Called after every admin mutation. Public data is read fresh per request (see content/queries.ts);
 * this additionally clears Next's router/full-route caches so client navigations never show stale pages.
 */
export function revalidateContent() {
  revalidateTag(CONTENT_TAG);
  revalidatePath("/", "layout");
}
