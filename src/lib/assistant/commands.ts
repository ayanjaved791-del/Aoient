/**
 * Rule-based understanding of "do something" requests for the assistant
 * (English and Roman Urdu). Pure: it only reads the words. Nothing happens
 * until the person confirms the proposal the server builds from this.
 */
import { parseDuration } from "@/lib/validation/time";

export type CommandEntity =
  | "lead" | "company" | "project" | "task" | "vendor" | "department" | "expense" | "invitation" | "time" | "timer" | "employee"
  | "invoice" | "estimate";
export type CommandOp = "create" | "delete" | "start" | "stop";

export interface ParsedCommand {
  op: CommandOp;
  entity: CommandEntity;
  /** Main name or title the person typed, in their own casing. */
  name: string | null;
  email: string | null;
  /** A project (or other parent) named after "in" / "on" / "mein". */
  parent: string | null;
  /** A role named after "as" (invitations). */
  role: string | null;
  minutes: number | null;
  amount: number | null;
  /** Days back for time ("yesterday" → 1). */
  daysAgo: number;
}

const CREATE = String.raw`(?:create|add|new|make|open|register|banao|bana\s+do|bnao|add\s+karo|daal\s+do|dalo)`;
const DELETE = String.raw`(?:delete|remove|archive|cancel|revoke|trash|erase|hatao|hata\s+do|delete\s+karo|mita\s+do|khatam\s+karo|nikal\s+do)`;
const ENTITY: Record<string, CommandEntity> = {
  lead: "lead", leads: "lead", company: "company", client: "company", customer: "company", project: "project", task: "task", todo: "task", kaam: "task",
  vendor: "vendor", supplier: "vendor", department: "department", dept: "department", expense: "expense", kharcha: "expense", kharch: "expense",
  invitation: "invitation", invite: "invitation", invoice: "invoice", bill: "invoice", estimate: "estimate", quote: "estimate", quotation: "estimate",
  employee: "employee", employees: "employee", staff: "employee", mulazim: "employee", worker: "employee", "team member": "employee", "staff member": "employee",
};

/** Words that must never be "corrected" into an entity. */
const KEEP = new Set(["please", "create", "delete", "remove", "archive", "invoice", "project", "projects"]);

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}

/** Fixes a typo in the entity word near the start ("employe", "taks", "projct", "vender"). */
function fixEntityTypo(text: string): string {
  const words = text.split(" ");
  for (let i = 0; i < Math.min(words.length, 4); i++) {
    const w = words[i].toLowerCase().replace(/[^a-z]/g, "");
    if (w.length < 4 || ENTITY[w] || KEEP.has(w)) continue;
    const best = Object.keys(ENTITY).filter((k) => !k.includes(" ") && Math.abs(k.length - w.length) <= 2)
      .map((k) => ({ k, d: editDistance(w, k) })).sort((a, b) => a.d - b.d)[0];
    if (best && best.d <= (w.length >= 7 ? 2 : 1)) { words[i] = best.k; return words.join(" "); }
  }
  return text;
}

/** "can u please create…", "kya aap … bana do", "I want to add…" → the request itself. */
export function stripPolite(text: string): string {
  let t = text.trim().replace(/[?!.]+$/, "").trim();
  for (let i = 0; i < 3; i++) {
    const before = t;
    t = t
      .replace(/^(?:hey|hi|hello|ok|okay|so)?\s*,?\s*(?:ant|aoient)\s*[,:]?\s+/i, "")
      .replace(/^(?:can|could|would|will)\s+(?:you|u|ya)\s+(?:please\s+|pls\s+|plz\s+|kindly\s+)?/i, "")
      .replace(/^(?:please|pls|plz|kindly|just)\s+/i, "")
      .replace(/^i\s+(?:want|need|would\s+like|wanna)\s+(?:you\s+)?(?:to\s+)?/i, "")
      .replace(/^(?:kya\s+)?(?:aap|ap|tum|tu)\s+/i, "")
      .replace(/^(?:mujhe|mere\s+liye|hamare\s+liye)\s+/i, "")
      .replace(/\s+(?:for\s+me|please|pls|plz|sakte\s+ho|sakte\s+hain|sakti\s+ho|de\s+sakte\s+ho)$/i, "")
      .trim();
    if (t === before) break;
  }
  return t;
}
const ENTITY_WORDS = Object.keys(ENTITY).sort((a, b) => b.length - a.length).join("|");
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const DOC = /\b(inv|est)-?\s*0*(\d{1,6})\b/i;

const clean = (s: string | undefined | null) => {
  const v = (s ?? "")
    .replace(/^[\s"'“”:,-]+|[\s"'“”.,!?]+$/g, "")
    .replace(/^(?:a|an|the|new|called|named|naam|for)\s+/i, "")
    .replace(/\s+(?:please|plz|pls|karo|kar\s+do|do)$/i, "")
    .trim();
  return v || null;
};

function blank(op: CommandOp, entity: CommandEntity): ParsedCommand {
  return { op, entity, name: null, email: null, parent: null, role: null, minutes: null, amount: null, daysAgo: 0 };
}

/** Splits "Homepage in Hunza booking site" into title + parent. */
function splitParent(text: string): { name: string | null; parent: string | null } {
  const m = text.match(/^(.*?)\s+(?:in|on|for|under|to|mein|me|par|pe|ke\s+liye)\s+(?:the\s+)?(?:project\s+)?(.+?)(?:\s+project)?$/i);
  return m ? { name: clean(m[1]), parent: clean(m[2]) } : { name: clean(text), parent: null };
}

export function parseCommand(raw: string): ParsedCommand | null {
  const plain = stripPolite(raw.trim().replace(/\s+/g, " "));
  // Only when the words as typed don't work, try fixing a misspelt entity ("employe", "taks").
  return parseExact(plain) ?? (fixEntityTypo(plain) !== plain ? parseExact(fixEntityTypo(plain)) : null);
}

function parseExact(text: string): ParsedCommand | null {
  if (text.length < 4) return null;
  const lower = text.toLowerCase();

  // Timer
  if (/\b(start|chalao|shuru)\b.*\btimer\b|\btimer\b.*\b(start|chalao|shuru|on)\b/i.test(text)) {
    const c = blank("start", "timer");
    const m = text.match(/timer\s+(?:for|on|par|pe)\s+(.+)$/i) ?? text.match(/start\s+(?:a\s+)?timer\s+(.+)$/i);
    if (m) { const sp = splitParent(m[1]); c.name = sp.name; c.parent = sp.parent; }
    return c;
  }
  if (/\b(stop|band|rok|roko|end)\b.*\btimer\b|\btimer\b.*\b(stop|band|rok|roko|end)\b/i.test(text)) return blank("stop", "timer");

  // Time: "log 2h on X", "add 1:30 hours to X", "2 ghante log karo X par"
  const dur = String.raw`(\d{1,2}:[0-5]\d|\d+(?:[.,]\d+)?\s*(?:h|hr|hrs|hour|hours|ghante|ghanta|m|min|mins|minutes)?(?:\s*\d{1,2}\s*m(?:in)?)?)`;
  const t1 = text.match(new RegExp(String.raw`^(?:log|add|track|record|enter)\s+${dur}(?:\s+(?:of\s+)?(?:time|work))?(?:\s+(?:on|to|for|in|par|pe)\s+(.+?))?(?:\s+(yesterday|today|kal|aaj))?$`, "i"))
    ?? text.match(new RegExp(String.raw`^${dur}\s+(?:log|add|track)\s*(?:karo|kar\s+do)?(?:\s+(.+?)\s+(?:par|pe|on))?(?:\s+(yesterday|today|kal|aaj))?$`, "i"));
  if (t1) {
    const minutes = parseDuration(t1[1].replace(/\s*(ghante|ghanta)$/i, "h").replace(/\s+/g, " "));
    if (minutes) {
      const c = blank("create", "time");
      c.minutes = minutes;
      if (t1[2]) { const sp = splitParent(t1[2]); c.parent = sp.parent ?? sp.name; c.name = sp.parent ? sp.name : null; }
      c.daysAgo = /yesterday|kal/i.test(t1[3] ?? "") ? 1 : 0;
      return c;
    }
  }

  // Invitations: "invite a@b.com as admin", "a@b.com ko invite karo"
  const email = text.match(EMAIL)?.[0] ?? null;
  const namesOther = new RegExp(String.raw`\b(?:${ENTITY_WORDS})\b`, "i").test(text.replace(/\bas\s+.+$/i, "").replace(/\binvit\w*/gi, ""));
  if (email && !namesOther && /\b(invite|invitation|bulao|add)\b/i.test(text) && !new RegExp(String.raw`\b${DELETE}\b`, "i").test(text)) {
    const c = blank("create", "invitation");
    c.email = email.toLowerCase();
    c.role = clean(text.match(/\bas\s+(?:an?\s+)?(.+?)$/i)?.[1] ?? text.match(/\b(?:role|ka role)\s+(.+?)(?:\s+(?:ke saath|with))?$/i)?.[1]);
    return c;
  }

  const verbOf = (op: "create" | "delete") => (op === "create" ? CREATE : DELETE);
  for (const op of ["delete", "create"] as const) {
    const V = verbOf(op);
    // English order: VERB [a/the] ENTITY REST     ·     Urdu order: ENTITY REST VERB  /  REST (ka|ki|naam ka) ENTITY VERB
    const en = text.match(new RegExp(String.raw`^(?:please\s+|plz\s+)?${V}\s+(?:a\s+|an\s+|the\s+|new\s+|this\s+)?(?:draft\s+)?(${ENTITY_WORDS})\b[:\s]*(.*)$`, "i"));
    const ur1 = text.match(new RegExp(String.raw`^(?:naya\s+|nayi\s+)?(${ENTITY_WORDS})\s+(.+?)\s+${V}$`, "i"));
    const ur2 = text.match(new RegExp(String.raw`^(.+?)\s+(?:ka|ki|ke|naam\s+ka|naam\s+ki|wala|wali)\s+(${ENTITY_WORDS})\s+${V}$`, "i"));
    const ur3 = text.match(new RegExp(String.raw`^(?:naya\s+|nayi\s+)?(${ENTITY_WORDS})\s+${V}\s*:?\s*(.*)$`, "i"));
    let ent: string | null = null, rest = "";
    if (en) { ent = en[1]; rest = en[2]; }
    else if (ur1) { ent = ur1[1]; rest = ur1[2]; }
    else if (ur2) { ent = ur2[2]; rest = ur2[1]; }
    else if (ur3) { ent = ur3[1]; rest = ur3[2]; }
    if (!ent) continue;
    const entity = ENTITY[ent.toLowerCase()];
    if (!entity) continue;
    if (op === "create" && (entity === "invoice" || entity === "estimate")) return null; // made in the editor, not by chat
    const c = blank(op, entity);
    c.email = email?.toLowerCase() ?? null;
    if (entity === "invoice" || entity === "estimate") {
      const d = rest.match(DOC) ?? text.match(DOC);
      c.name = d ? `${d[1].toUpperCase()}-${d[2].padStart(4, "0")}` : clean(rest);
      return c;
    }
    if (entity === "expense" && op === "create") {
      const amt = rest.match(/(\d[\d,]*(?:\.\d{1,2})?)/);
      c.amount = amt ? Number(amt[1].replace(/,/g, "")) : null;
      c.name = clean(rest.replace(/(?:of\s+|rs\.?\s*|pkr\s*|\$|usd\s*)?\d[\d,]*(?:\.\d{1,2})?\s*(?:rs|rupees|pkr|usd|dollars)?/i, "").replace(/^\s*(?:for|on|ka|ki|ke liye)\s+/i, ""));
      return c;
    }
    if (entity === "invitation") { c.email = email?.toLowerCase() ?? null; c.name = c.email ?? clean(rest); return c; }
    if (entity === "employee") {
      let body = email ? rest.replace(email, " ").replace(/\s+/g, " ") : rest;
      const dept = body.match(/\s+(?:in|into|to)\s+(?:the\s+)?(.+?)(?:\s+(?:department|dept|team))?$/i);
      if (dept && op === "create") { c.parent = clean(dept[1]); body = body.slice(0, dept.index); }
      const job = body.match(/\s+(?:as|role)\s+(?:an?\s+)?(.+)$/i);
      if (job && op === "create") { c.role = clean(job[1]); body = body.slice(0, job.index); }
      c.name = clean(body.replace(/\s+(?:with|email)\s*$/i, ""));
      return c;
    }
    if (entity === "task" || (entity === "lead" && op === "create")) {
      const body = email ? rest.replace(email, "").replace(/\s+(?:with|email|,)\s*$/i, "") : rest;
      const sp = entity === "task" ? splitParent(body) : { name: clean(body.replace(/\s+(?:from|at|of)\s+.+$/i, "")), parent: clean(body.match(/\s+(?:from|at|of)\s+(.+)$/i)?.[1]) };
      c.name = sp.name; c.parent = sp.parent;
      return c;
    }
    c.name = clean(email ? rest.replace(email, "") : rest);
    return c;
  }
  void lower;
  return null;
}

/** "yes", "haan", "confirm", "ok do it" → true; "no", "cancel", "nahi" → false; anything else → null. */
export function parseConfirmation(raw: string): boolean | null {
  const q = raw.trim().toLowerCase().replace(/[.!]+$/, "");
  if (/^(yes|y|yeah|yep|sure|ok|okay|confirm|confirmed|do it|go ahead|proceed|haan|han|ha|ji|ji haan|jee|theek hai|thik hai|kar do|kardo)$/.test(q)) return true;
  if (/^(no|n|nope|cancel|stop|don't|dont|nahi|nahin|na|mat karo|rehne do|chhoro|chhodo)$/.test(q)) return false;
  return null;
}

/** "create a spaceship" / "delete everything": a do-something request Ant can't map to a record type. */
export function looksLikeCommand(raw: string): boolean {
  return new RegExp(String.raw`^(?:${CREATE}|${DELETE})\b`, "i").test(stripPolite(raw)) || new RegExp(String.raw`\b(?:${CREATE}|${DELETE})$`, "i").test(stripPolite(raw));
}
