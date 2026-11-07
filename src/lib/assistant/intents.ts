/**
 * Rule-based question understanding for the workspace assistant. No AI service:
 * the question is normalised, scored against keyword patterns (English and
 * Roman Urdu), and turned into an intent plus a few parameters. Pure module so
 * it can be unit tested.
 */

export type Intent =
  | "help"
  | "greeting"
  | "me"
  | "my_permissions"
  | "my_activity"
  | "summary"
  | "member_count"
  | "members_list"
  | "member_lookup"
  | "recent_members"
  | "suspended_members"
  | "invites_pending"
  | "invites_stats"
  | "roles_list"
  | "role_detail"
  | "plan"
  | "usage"
  | "activity"
  | "top_people"
  | "workspace"
  | "howto_invite"
  | "howto_role"
  | "howto_install"
  | "howto_billing"
  | "unknown";

export interface ParsedQuestion {
  intent: Intent;
  /** Days to look back when the question names a period; null when it doesn't. */
  days: number | null;
  /** Human label for that period ("today", "the last 7 days"). */
  periodLabel: string | null;
  /** A role the question names, matched against the workspace's role names. */
  role: string | null;
  /** An email address or a person's name to look up. */
  person: string | null;
  /** Confidence 0..1, for "did you mean" fallbacks. */
  score: number;
}

export function normalise(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9@._'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const has = (q: string, re: RegExp) => re.test(q);

/** Period words: today / yesterday / this week / last N days / month / aaj / kal / hafta / mahina. */
export function parsePeriod(q: string): { days: number; label: string } | null {
  const n = q.match(/\b(?:last|past|pichle|pichhle)\s+(\d{1,3})\s*(?:days?|din)\b/) ?? q.match(/\b(\d{1,3})\s*(?:days?|din)\b/);
  if (n) {
    const d = Math.min(365, Math.max(1, Number(n[1])));
    return { days: d, label: `the last ${d} day${d === 1 ? "" : "s"}` };
  }
  if (has(q, /\b(today|aaj|aj)\b/)) return { days: 1, label: "the last 24 hours" };
  if (has(q, /\b(yesterday|kal)\b/)) return { days: 2, label: "the last 2 days" };
  if (has(q, /\b(this|is|last|past|pichle)\s+(week|hafte|hafta)\b|\bweekly\b|\bweek\b|\bhafte\b/)) return { days: 7, label: "the last 7 days" };
  if (has(q, /\b(this|is|last|past|pichle)\s+(month|mahine|mahina)\b|\bmonthly\b|\bmonth\b|\bmahine\b/)) return { days: 30, label: "the last 30 days" };
  if (has(q, /\b(quarter|3 months|teen mahine)\b/)) return { days: 90, label: "the last 90 days" };
  if (has(q, /\b(year|saal)\b/)) return { days: 365, label: "the last year" };
  return null;
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/;

interface Rule { intent: Intent; weight: number; any: RegExp[]; boost?: RegExp[] }

// Order doesn't matter: every rule is scored and the best wins.
const RULES: Rule[] = [
  { intent: "howto_invite", weight: 3, any: [/\bhow\b.*\b(invite|add)\b/, /\b(invite|add)\b.*\b(kaise|kese|how)\b/, /\bkaise\b.*\binvite\b/] },
  { intent: "howto_role", weight: 3, any: [/\bhow\b.*\b(change|assign|give|set)\b.*\brole\b/, /\brole\b.*\b(kaise|kese)\b.*\b(change|badl)/, /\bhow\b.*\bcreate\b.*\brole\b/] },
  { intent: "howto_install", weight: 3, any: [/\b(install|download)\b.*\b(app|aoient)\b/, /\bapp\b.*\b(install|download)\b/, /\bhow\b.*\binstall\b/, /\binstall\b.*\bkaise\b/] },
  { intent: "howto_billing", weight: 3, any: [/\bhow\b.*\b(upgrade|cancel|pay|buy|change plan|subscribe)\b/, /\b(cancel|upgrade)\b.*\b(kaise|plan|subscription)\b/, /\bplan\b.*\b(kaise|kese)\b.*\b(le|kharid)/] },
  { intent: "greeting", weight: 1, any: [/^(hi|hello|hey|salam|assalam|aoa|salaam)\b/] },
  { intent: "help", weight: 2, any: [/\b(help|what can you do|what do you know|commands|madad|kya kar sakte|kya puch)\b/, /^\?$/] },
  { intent: "my_permissions", weight: 3, any: [/\b(my|meri|mere|mera)\b.*\b(permission|permissions|access|rights|ijazat)\b/, /\bwhat can i\b/, /\bmain kya kar sakta\b/, /\bcan i\b/] },
  { intent: "my_activity", weight: 3, any: [/\bwhat (did|have) i\b/, /\b(my|meri|mere|i)\b.*\b(activity|changes|actions|did|history)\b/, /\bmaine\b.*\b(kya|kiya)\b/] },
  { intent: "me", weight: 2, any: [/\b(who am i|my role|my profile|about me|mera role|main kaun|my account|my membership|when did i join)\b/, /\b(mera|meri)\b.*\b(role|profile|account)\b/] },
  { intent: "summary", weight: 2, any: [/\b(summary|overview|report|dashboard|status|how is|how are we|kaisa chal|haal|update|stats|statistics)\b/] },
  { intent: "member_count", weight: 3, any: [/\bhow many\b.*\b(member|members|people|users|team|employees|log)\b/, /\b(kitne|kitnay)\b.*\b(member|members|log|users|employee|employees|banday|bande)\b/, /\b(team size|headcount|member count|total members)\b/] },
  { intent: "recent_members", weight: 3, any: [/\b(new|recent|recently|latest|naye|naya)\b.*\b(member|members|joined|people|join)\b/, /\bwho\b.*\bjoined\b/, /\bkaun\b.*\bjoin\b/] },
  { intent: "suspended_members", weight: 3, any: [/\b(suspended|blocked|disabled|inactive|band)\b/] },
  { intent: "members_list", weight: 2, any: [/\b(list|show|all|sab|saare|sare|dikhao|who are)\b.*\b(member|members|people|team|users|employees|admins|owners|managers)\b/, /\b(members|team members|employees|admins|owners)\b\s*(list)?$/, /\bwho is in\b/] },
  { intent: "member_lookup", weight: 2, any: [EMAIL, /\bwho is\b\s+\w+/, /\b(\w+)\s+(kaun hai|ka role|ki role|ka email)\b/, /\b(find|search|lookup|look up|dhoondo)\b/] },
  { intent: "invites_pending", weight: 3, any: [/\b(pending|open|outstanding|waiting|expiring|expire|baqi)\b.*\b(invite|invites|invitation|invitations)\b/, /\b(invite|invites|invitations)\b.*\b(pending|open|expir)/, /\binvitations?\b$/] },
  { intent: "invites_stats", weight: 3, any: [/\b(accept|accepted|acceptance|conversion)\b/, /\binvit\w*\b.*\b(stats|rate|how many|kitne)\b/] },
  { intent: "role_detail", weight: 2, any: [/\bwhat can\b.*\b(do|access)\b/, /\b(permissions|access)\b.*\b(of|for)\b/, /\brole\b.*\b(kya|permissions)\b/] },
  { intent: "roles_list", weight: 2, any: [/\b(roles|role list|all roles|which roles|kitne roles|custom roles)\b/] },
  { intent: "plan", weight: 3, any: [/\b(plan|subscription|trial|billing|license|paid|renew|renewal|days left|kitne din|payment)\b/] },
  { intent: "usage", weight: 3, any: [/\b(usage|limit|limits|seats|seat|quota|capacity|kitni jagah)\b/] },
  { intent: "top_people", weight: 3, any: [/\b(most active|top|busiest people|who did the most|sab se zyada)\b/] },
  { intent: "activity", weight: 2, any: [/\b(activity|changes|happened|history|audit|log|logs|events|kya hua|recent changes|what changed)\b/] },
  { intent: "workspace", weight: 2, any: [/\b(workspace|organization|organisation|company|timezone|time zone|currency|url|slug)\b/] },
];

/** Picks the best intent for a question. `roleNames` lets "list admins" or "what can HR Manager do" match real roles. */
export function parseQuestion(raw: string, roleNames: string[] = []): ParsedQuestion {
  const q = normalise(raw);
  const period = parsePeriod(q);
  const email = q.match(EMAIL)?.[0] ?? null;

  // Role mentioned? Whole names first (longest wins, so "hr manager" beats "manager"),
  // then distinctive single words ("client", "admins").
  const words = q.split(" ");
  const norm = (name: string) => normalise(name).replace(/\s*\/\s*/g, " ");
  const byLength = [...roleNames].sort((a, b) => b.length - a.length);
  const roleHits = byLength.find((name) => {
    const n = norm(name);
    return n.length > 0 && (q.includes(n) || q.includes(n.endsWith("s") ? n : `${n}s`));
  }) ?? byLength.find((name) => {
    const parts = norm(name).split(" ");
    // Shared words like "manager" are ambiguous on their own; only unique ones count.
    return parts.some((w) => w.length > 4 && (words.includes(w) || words.includes(`${w}s`))
      && roleNames.filter((other) => norm(other).split(" ").includes(w)).length === 1);
  }) ?? null;

  let best: { intent: Intent; score: number } = { intent: "unknown", score: 0 };
  for (const rule of RULES) {
    const hits = rule.any.filter((re) => re.test(q)).length;
    if (!hits) continue;
    const score = rule.weight + hits * 0.5;
    if (score > best.score) best = { intent: rule.intent, score };
  }

  // Refinements that keyword scores can't express on their own.
  let intent = best.intent;
  if (email && (intent === "unknown" || intent === "member_lookup" || intent === "members_list")) intent = "member_lookup";
  if (roleHits && (intent === "members_list" || intent === "member_count" || intent === "unknown") && /\b(who|list|show|all|kaun|dikhao|sab|how many|kitne)\b/.test(q)) intent = "members_list";
  if (roleHits && intent === "unknown") intent = "role_detail";
  if (intent === "role_detail" && !roleHits && /\b(i|me|my|mera|meri)\b/.test(q)) intent = "my_permissions";

  // A name after "who is" / before "kaun hai", unless it's a role or a pronoun.
  let person: string | null = email;
  if (!person && intent === "member_lookup") {
    const m = q.match(/\bwho is\s+([a-z][a-z.'-]*(?:\s+[a-z][a-z.'-]*)?)/) ?? q.match(/\b([a-z][a-z.'-]*(?:\s+[a-z][a-z.'-]*)?)\s+(?:kaun hai|ka role|ki role|ka email)\b/)
      ?? q.match(/\b(?:find|search|lookup|look up|dhoondo)\s+([a-z][a-z.'-]*(?:\s+[a-z][a-z.'-]*)?)/);
    const name = m?.[1]?.replace(/\b(the|a|an|in|on|our|my)\b/g, "").trim();
    if (name && !["i", "me", "my", "we", "you", "online", "here"].includes(name)) person = name;
  }

  const confidence = intent === "unknown" ? 0 : Math.min(1, best.score / 4 + (roleHits ? 0.1 : 0));
  return { intent, days: period?.days ?? null, periodLabel: period?.label ?? null, role: roleHits, person, score: confidence };
}
