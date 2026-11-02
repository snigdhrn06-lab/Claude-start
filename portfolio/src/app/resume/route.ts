/** Stable /resume URL that redirects to the current résumé file (Admin → Site settings → Résumé). */
import { getSiteData } from "@/lib/content/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const data = await getSiteData();
  const id = data.settings.resumeMediaId;
  const file = id ? data.media[id] : undefined;
  if (!file) return new Response("Résumé not available", { status: 404 });
  return Response.redirect(new URL(file.url, request.url), 302);
}
