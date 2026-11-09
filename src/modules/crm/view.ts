import { timeAgo } from "@/lib/activity";
import type { NoteRow } from "@/server/crm/notes";
import type { NoteView } from "./notes-ui";

/** Notes as plain data for the client component. */
export function noteViews(notes: NoteRow[], now = new Date()): NoteView[] {
  return notes.map((n) => ({ id: n.id, body: n.body, author: n.author, mine: n.mine, at: n.createdAt.toISOString(), ago: timeAgo(n.createdAt, now) }));
}
