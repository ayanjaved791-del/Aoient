import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/modules/legal/legal-page";
import { TRIAL_DAYS } from "@/lib/billing/entitlements";

export const metadata: Metadata = { title: "Terms of Service", description: "The terms for using Aoient: accounts, workspaces, plans and payments, acceptable use and liability." };

const SECTIONS: LegalSection[] = [
  { id: "agreement", title: "Agreeing to these terms", body: <>
    <p>These Terms of Service (&quot;Terms&quot;) govern your use of Aoient, the website and the installable app (together, the &quot;Service&quot;). By creating an account, creating a workspace or buying a plan, you agree to these Terms and to our <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>.</p>
    <p>If you use the Service for a company or other organization, you confirm that you are authorised to accept these Terms for it, and &quot;you&quot; includes that organization.</p>
  </> },
  { id: "accounts", title: "Accounts and workspaces", body: <>
    <ul>
      <li>You must give accurate information, verify your email address and keep your password secure. You are responsible for activity under your account.</li>
      <li>A workspace (&quot;organization&quot;) belongs to the organization that created it. Its Owner controls who is invited, which role each member has and the subscription.</li>
      <li>Members only see what their role allows. Owners and Admins are responsible for giving people appropriate roles.</li>
      <li>Tell us promptly if you believe your account has been accessed without permission.</li>
    </ul>
  </> },
  { id: "plans", title: "Plans, trials and payments", body: <>
    <ul>
      <li>Each new workspace starts with a {TRIAL_DAYS}-day free trial on Medisea limits. No card is needed for that trial. When it ends without a plan, the workspace becomes read-only; your data is not deleted.</li>
      <li>Paid plans are sold by <strong>Paddle.com</strong>, our merchant of record. Paddle processes your payment, issues invoices and receipts, and handles sales tax and VAT. Paddle&apos;s own buyer terms also apply to the purchase.</li>
      <li>Some plans include a free trial at checkout. Your first payment is taken when that trial ends unless you cancel before then.</li>
      <li>Subscriptions renew automatically each month or year until cancelled. You can cancel at any time from Billing &amp; plan; access continues until the end of the period you have paid for.</li>
      <li>A plan becomes active only after Paddle confirms the payment to our servers. Prices are shown before you pay; we will tell you in advance before changing the price of an existing subscription.</li>
      <li>Refunds are handled by Paddle according to its refund policy and applicable consumer law.</li>
      <li>Each plan has limits (for example users and admin seats) that the Service enforces.</li>
    </ul>
  </> },
  { id: "your-data", title: "Your data", body: <>
    <p>You keep all rights to the content and data you put into a workspace (&quot;Customer Data&quot;). You give us permission to store and process Customer Data only to provide and secure the Service, as described in the Privacy Policy. Each workspace&apos;s data is kept separate from every other workspace&apos;s.</p>
    <p>You are responsible for having the right to add the data you put in, including personal data about your team members or clients.</p>
  </> },
  { id: "acceptable-use", title: "Acceptable use", body: <>
    <p>You agree not to:</p>
    <ul>
      <li>break the law, infringe others&apos; rights or store unlawful content;</li>
      <li>try to access another workspace&apos;s data, other accounts, or parts of the Service you are not permitted to use;</li>
      <li>probe, scan or test the Service&apos;s security without our written permission, or disrupt it (for example with excessive automated requests);</li>
      <li>reverse engineer the Service except where the law allows it, or resell it without our agreement;</li>
      <li>send spam or malware, including through invitation links.</li>
    </ul>
  </> },
  { id: "availability", title: "Availability and changes", body: <>
    <p>We work to keep the Service available and secure but do not promise it will be uninterrupted or error-free. Features marked &quot;Coming soon&quot; are not part of your plan until they are released. We may improve or change the Service; if a change materially reduces what a paid plan includes, we will tell you in advance.</p>
  </> },
  { id: "termination", title: "Suspension and ending", body: <>
    <p>You can stop using the Service and cancel your subscription at any time. We may suspend or close an account or workspace that seriously or repeatedly breaks these Terms, or where required by law, and will tell you why unless the law prevents it. After a workspace is closed, you can ask us for a copy of your Customer Data for a reasonable period.</p>
  </> },
  { id: "liability", title: "Disclaimers and liability", body: <>
    <p>To the extent the law allows, the Service is provided &quot;as is&quot; and we are not liable for indirect or consequential losses, or for lost profits, revenue or data. Our total liability for any claim is limited to the amount you paid us for the Service in the 12 months before the claim. Nothing in these Terms limits liability that cannot be limited by law, or your statutory rights as a consumer.</p>
  </> },
  { id: "changes", title: "Changes to these terms", body: <>
    <p>If we change these Terms in a meaningful way, we will update the date above and ask you to agree again before you create a workspace or buy a plan. Continuing to use the Service after a change means you accept it.</p>
  </> },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={<p>The rules for using Aoient, written to be read. The short version: your data is yours, plans are billed through Paddle and can be cancelled any time, and you shouldn&apos;t misuse the Service.</p>}
      sections={SECTIONS}
      other={{ href: "/privacy", label: "Read the Privacy Policy" }}
    />
  );
}
