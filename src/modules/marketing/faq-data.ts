/** FAQ content, shared by the home page (first few) and the FAQ page (all, by topic). */
export type FaqTopic = "product" | "team" | "billing" | "security";

export const FAQ_TOPICS: { id: FaqTopic; label: string }[] = [
  { id: "product", label: "Product" },
  { id: "team", label: "Team & accounts" },
  { id: "billing", label: "Trial & billing" },
  { id: "security", label: "Security & data" },
];

export const FAQ: { q: string; a: string; topic: FaqTopic }[] = [
  {
    topic: "product",
    q: "What can I use today?",
    a: "Organizations, members, invitations, built-in and custom roles, the audit log and the /api/v1 organization API. People is live too: employee directory, departments, managers, private HR details and leave with approvals. Each role gets its own live dashboard, and the Ask Aoient assistant answers questions from your records. CRM, Projects and the other modules are in development and are released one at a time.",
  },
  {
    topic: "product",
    q: "Who is Aoient for?",
    a: "Service businesses such as agencies, studios, clinics and consultancies that want their people, customers, delivery, time and billing in one place instead of five disconnected tools.",
  },
  {
    topic: "security",
    q: "Can people from another company see my data?",
    a: "No. Every request checks on the server that you're an active member of the organization, the database blocks direct browser access, and automated tests try cross-company access on every change.",
  },
  {
    topic: "billing",
    q: "How does billing work?",
    a: "Every new workspace gets a 14-day free trial, no card needed. Each plan is offered monthly or yearly, with yearly priced at ten months, and checkout runs through Paddle. A plan switches on automatically once Paddle confirms it to our server, and plan limits are checked on the server.",
  },
  {
    topic: "billing",
    q: "Is there a free trial?",
    a: "Yes. Every new workspace gets 14 days with the Medisea plan's limits, no card needed. Buying Medisea monthly starts with Paddle's 14-day free trial too, so the first payment covers you until 44 days after you subscribe.",
  },
  {
    topic: "billing",
    q: "What happens when my trial ends?",
    a: "The workspace becomes read-only: your data stays and is still visible, but changes are paused until a plan is active. Nothing is deleted.",
  },
  {
    topic: "billing",
    q: "Can I cancel at any time?",
    a: "Yes. Owners open Settings → Billing & plan → Manage subscription, which takes you to Paddle's customer portal. After cancelling you keep access until the end of the period you paid for.",
  },
  {
    topic: "billing",
    q: "What limits does each plan have?",
    a: "Medisea: 5 users and 1 admin seat. Indiana: 15 users, 3 admin seats and custom roles. Pacfic-DeepDive: 40 users, 10 admin seats and custom roles. These are checked on the server today; project and automation limits apply when those modules are released.",
  },
  {
    topic: "team",
    q: "How do my employees sign in?",
    a: "Either send them an invite link (they create their own account), or give them a login yourself from People: an email and a temporary password. With a temporary password they're asked to choose their own the first time, so only they know it. They can also sign in with Google.",
  },
  {
    topic: "team",
    q: "What does an employee see?",
    a: "Their own dashboard: their profile, their leave, who's out today and the team directory. They don't see members, roles, billing or other people's private details. Custom roles see exactly the permissions you give them.",
  },
  {
    topic: "team",
    q: "Can I invite clients or contractors?",
    a: "You can invite anyone with the Client / Guest role, which has no permissions by default. A proper client portal for sharing specific items is planned for a later release.",
  },
  {
    topic: "product",
    q: "Does Aoient use AI?",
    a: "No outside AI service is used. The Ask Aoient assistant works with our own rules: it recognises common questions in English and Roman Urdu and answers from your workspace's records, limited to what your role can see.",
  },
  {
    topic: "product",
    q: "Does Aoient connect to Gmail, Slack or my other tools?",
    a: "Not yet. Integrations are planned and we won't show one as working until it is.",
  },
  {
    topic: "product",
    q: "Can I install it as an app?",
    a: "Yes. Aoient can be installed from the browser on Windows, Mac, Android and iPhone, and opens in its own window. See the Download page for the steps.",
  },
  {
    topic: "security",
    q: "Is my password stored by Aoient?",
    a: "No. Sign-in is handled by Supabase Auth. Temporary passwords that an admin sets are passed straight to Supabase and never stored or logged by Aoient.",
  },
  {
    topic: "product",
    q: "Is there a dark mode?",
    a: "Yes. Aoient starts in the light theme, and you can switch to dark from the header or your account menu.",
  },
];
