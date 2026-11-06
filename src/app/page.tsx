import Link from "next/link";
import { BriefcaseBusiness, Clock3, FolderKanban, Handshake, Receipt, Users } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

const flow = [
  { icon: Handshake, title: "Win the deal", body: "Leads become customers and deals in Aoient CRM." },
  { icon: FolderKanban, title: "Start the project", body: "A won deal becomes a project without re-entering data." },
  { icon: Users, title: "Staff the work", body: "Assign people from Aoient People and track their tasks." },
  { icon: Clock3, title: "Capture time", body: "Billable and non-billable hours flow into project totals." },
  { icon: Receipt, title: "Invoice it", body: "Finance prepares invoices from the work that was delivered." },
  { icon: BriefcaseBusiness, title: "See the business", body: "Analytics reads from the same records — nothing invented." },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild><Link href="/sign-in">Sign in</Link></Button>
          <Button asChild><Link href="/sign-up">Get started</Link></Button>
        </nav>
      </header>
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <p className="text-sm font-medium text-primary">Business Operating System</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">One platform. Your entire business.</h1>
          <p className="mt-5 max-w-2xl text-lg text-secondary-foreground">
            Aoient connects your people, customers, projects, time and finances for agencies, studios and consultancies — so sales hands off to delivery without the spreadsheet in between.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild><Link href="/sign-up">Create your workspace</Link></Button>
            <Button size="lg" variant="secondary" asChild><Link href="/sign-in">Sign in</Link></Button>
          </div>
        </section>
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-xl font-semibold tracking-tight">Built around one connected workflow</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {flow.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary"><step.icon className="size-5" aria-hidden /></span>
                  <div>
                    <p className="text-sm font-semibold"><span className="mr-1.5 text-muted-foreground">{i + 1}.</span>{step.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-[13px] text-muted-foreground sm:px-6">© {/* static year avoids a request-time Date in the static shell */}2026 Aoient</footer>
    </div>
  );
}
