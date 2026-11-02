import { desc } from "drizzle-orm";
import { MessagesInbox } from "@/components/admin/MessagesInbox";
import { getDb, schema } from "@/lib/db/client";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const rows = await getDb().select().from(schema.contactMessages).orderBy(desc(schema.contactMessages.createdAt)).limit(500);
  return <MessagesInbox initial={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))} emailConfigured={!!(process.env.RESEND_API_KEY && process.env.CONTACT_FROM_EMAIL)} />;
}
