import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/modules/legal/legal-page";

export const metadata: Metadata = { title: "Privacy Policy", description: "What personal data Aoient collects, why, who processes it, how long it's kept and your rights." };

const SECTIONS: LegalSection[] = [
  { id: "who", title: "Who this covers", body: <>
    <p>This policy explains how Aoient handles personal data when you visit the website, use the app, or are invited to a workspace. For data a company puts into its workspace, that company decides what is stored and why; we process it on their behalf.</p>
  </> },
  { id: "collect", title: "What we collect", body: <>
    <ul>
      <li><strong>Account details:</strong> your name, email address, a securely hashed password (held by our authentication provider) and whether your email is verified.</li>
      <li><strong>Workspace details:</strong> workspace name, address (URL), time zone and currency; your membership, role and join date; invitations (the invited email and role; links are stored only as a one-way hash).</li>
      <li><strong>Activity records:</strong> an audit log of changes such as invitations, role changes and settings updates, with who made them and when.</li>
      <li><strong>Billing details:</strong> your plan, its status and dates, and Paddle&apos;s customer and subscription IDs. <strong>We never receive or store your card number</strong>; Paddle collects payment details directly.</li>
      <li><strong>Agreements:</strong> when you agreed to these documents and which version.</li>
      <li><strong>Technical data:</strong> sign-in cookies that keep you logged in. Rate limits are counted per account. Our hosting provider keeps standard request logs (such as IP address) for security and operations.</li>
    </ul>
  </> },
  { id: "why", title: "Why we use it", body: <>
    <ul>
      <li>To provide the Service: accounts, workspaces, roles, dashboards and the assistant (which answers from your workspace&apos;s records with rules in our code; no AI service receives your data).</li>
      <li>To process subscriptions with Paddle and enforce plan limits.</li>
      <li>To keep the Service secure: verifying sign-ins, preventing abuse and keeping each workspace&apos;s data separate.</li>
      <li>To meet legal obligations, such as tax records kept by Paddle.</li>
    </ul>
    <p>We rely on performing our contract with you, our legitimate interest in running a secure service, and legal obligations. We do not sell personal data and do not use it for advertising.</p>
  </> },
  { id: "processors", title: "Who processes it for us", body: <>
    <ul>
      <li><strong>Supabase:</strong> authentication and database hosting.</li>
      <li><strong>Vercel:</strong> hosting of the website and app.</li>
      <li><strong>Paddle:</strong> checkout, payments, invoices and tax, as merchant of record (Paddle is also responsible for the data it collects at checkout under its own privacy notice).</li>
    </ul>
    <p>They process data only to provide their services to us. Data may be processed outside your country; where required, appropriate safeguards such as standard contractual clauses apply.</p>
  </> },
  { id: "device", title: "Cookies and data on your device", body: <>
    <ul>
      <li>Essential cookies keep you signed in. We do not use advertising or cross-site tracking cookies.</li>
      <li>Your browser stores small preferences locally, such as light/dark theme and which dashboard cards you hid.</li>
      <li>If you install the app, it caches only an offline page and icons. Workspace data is not stored on your device.</li>
    </ul>
  </> },
  { id: "retention", title: "How long we keep it", body: <>
    <p>Account and workspace data is kept while your account or workspace exists. Deleting a workspace is done on request by its Owner, and its data is then deleted with it, except where we must keep records (for example billing and tax records, which Paddle retains as required by law). Rate-limit records are short-lived.</p>
  </> },
  { id: "rights", title: "Your rights", body: <>
    <p>Depending on where you live, you can ask to access, correct, export or delete your personal data, or object to or restrict how it is used. You can leave a workspace yourself at any time. For data inside a company&apos;s workspace, contact that company&apos;s Owner first; we will help them respond. You may also complain to your data protection authority.</p>
  </> },
  { id: "security", title: "Security", body: <>
    <p>Every request checks on the server that you belong to the workspace you are accessing; database tables are locked down with row-level security; passwords and invitation links are never stored in plain text; payments are confirmed by Paddle&apos;s signed messages or its API. See <Link href="/security" className="underline underline-offset-4">Security</Link> for details, including what isn&apos;t built yet.</p>
  </> },
  { id: "children", title: "Children", body: <p>Aoient is a business tool and is not intended for anyone under 16.</p> },
  { id: "changes", title: "Changes", body: <p>If we change this policy meaningfully, we will update the date above and ask you to agree again before you create a workspace or buy a plan.</p> },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={<p>We collect only what Aoient needs to work, never see your card details, don&apos;t sell data, and keep every company&apos;s workspace separate.</p>}
      sections={SECTIONS}
      other={{ href: "/terms", label: "Read the Terms of Service" }}
    />
  );
}
