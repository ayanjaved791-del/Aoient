import type { CSSProperties, ReactNode } from "react";
import { PLANS, priceFor } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/**
 * Feature bento: black and white, no icons. Each tile shows a small typed
 * illustration of the real feature. One column on phones, two on tablets and
 * a six-column grid on desktop. "Live" means it works today.
 */
type Status = "live" | "soon";

function StatusPill({ status, dark }: { status: Status; dark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        status === "live"
          ? dark ? "border-white/25 text-white" : "border-neutral-300 text-black dark:border-neutral-700 dark:text-white"
          : dark ? "border-dashed border-white/25 text-white/60" : "border-dashed border-neutral-300 text-neutral-500 dark:border-neutral-700",
      )}
    >
      {status === "live" ? "Live" : "In development"}
    </span>
  );
}

function Tile({
  title, body, status, className, dark, compact, delay = 0, children,
}: { title: string; body: string; status: Status; className?: string; dark?: boolean; compact?: boolean; delay?: number; children: ReactNode }) {
  return (
    <li data-reveal="scale" className={cn("reveal min-w-0", className)} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>
      <article
        className={cn(
          "group flex h-full flex-col overflow-hidden rounded-2xl border transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5",
          dark
            ? "border-neutral-900 bg-black text-white hover:shadow-[0_24px_48px_-24px_rgb(0_0_0/0.6)] dark:border-neutral-700 dark:bg-white dark:text-black"
            : "border-neutral-200 bg-[#f7f7f5] text-black hover:shadow-[0_24px_48px_-28px_rgb(0_0_0/0.25)] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white",
        )}
      >
        <div className="flex items-start justify-between gap-3 p-6 pb-0">
          <h3 className="text-lg font-semibold leading-snug tracking-tight">{title}</h3>
          <StatusPill status={status} dark={dark} />
        </div>
        <p className={cn("px-6 pt-2 text-sm leading-relaxed", dark ? "text-white/65 dark:text-black/60" : "text-neutral-600 dark:text-neutral-400")}>{body}</p>
        <div aria-hidden className={cn("mt-auto flex items-end overflow-hidden px-6 pb-6", compact ? "pt-5" : "min-h-40 pt-6")}>{children}</div>
      </article>
    </li>
  );
}

/* ── Illustrations (typography and shapes only) ── */

const card = "rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-black";

function Directory() {
  const rows = [
    ["Laila Shah", "Head nurse", "Nursing", "In"],
    ["Wasi Khan", "Nurse", "Nursing", "On leave"],
    ["Hina Noor", "Receptionist", "Front desk", "In"],
    ["Omar Ali", "Accountant", "Finance", "In"],
  ];
  return (
    <div className={cn(card, "w-full overflow-hidden text-left")}>
      <div className="grid grid-cols-[1.3fr_1fr_4.75rem] gap-3 border-b border-neutral-200 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-neutral-500 sm:grid-cols-[1.3fr_1fr_1fr_4.75rem] dark:border-neutral-800">
        <span>Name</span><span>Role</span><span className="hidden sm:block">Department</span><span>Today</span>
      </div>
      {rows.map(([n, r, d, s], i) => (
        <div key={n} className="grid grid-cols-[1.3fr_1fr_4.75rem] items-center gap-3 border-b border-neutral-100 px-4 py-2.5 text-sm last:border-0 sm:grid-cols-[1.3fr_1fr_1fr_4.75rem] dark:border-neutral-900" style={{ animationDelay: `${i * 80}ms` }}>
          <span className="truncate font-medium">{n}</span>
          <span className="truncate text-neutral-500">{r}</span>
          <span className="hidden truncate text-neutral-500 sm:block">{d}</span>
          <span className={cn("justify-self-start whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", s === "In" ? "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300" : "bg-black text-white dark:bg-white dark:text-black")}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function RoleViews() {
  return (
    <div className="grid w-full gap-2">
      {[
        ["Owner", "Team, activity, billing, people"],
        ["HR Manager", "People, leave approvals"],
        ["Employee", "My profile, my leave"],
      ].map(([role, sees], i) => (
        <div key={role} className={cn("flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm", i === 2 ? "bg-white text-black dark:bg-black dark:text-white" : "border border-white/15 dark:border-black/15")}>
          <span className="font-semibold">{role}</span>
          <span className={cn("truncate text-xs", i === 2 ? "text-neutral-500" : "text-white/60 dark:text-black/60")}>{sees}</span>
        </div>
      ))}
    </div>
  );
}

function LiveSync() {
  return (
    <div className="relative w-full">
      <div className={cn(card, "flex items-center justify-between px-4 py-3 text-sm")}>
        <span className="font-medium">Leave approved</span>
        <span className="text-xs text-neutral-500">just now</span>
      </div>
      <div className="mx-auto h-6 w-px border-l border-dashed border-neutral-400" />
      <div className={cn(card, "flex items-center justify-between px-4 py-3 text-sm")}>
        <span className="font-medium">Every open tab</span>
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="relative flex size-2"><span className="absolute inset-0 rounded-full bg-black motion-safe:animate-ping dark:bg-white" /><span className="relative size-2 rounded-full bg-black dark:bg-white" /></span>
          updated
        </span>
      </div>
    </div>
  );
}

function Permissions() {
  const perms: [string, boolean][] = [["View people", true], ["Approve leave", true], ["See salaries", false], ["Manage billing", false]];
  return (
    <ul className={cn(card, "w-full divide-y divide-neutral-100 text-sm dark:divide-neutral-900")}>
      {perms.map(([p, on]) => (
        <li key={p} className="flex items-center justify-between px-4 py-2.5">
          <span>{p}</span>
          <span className={cn("relative h-5 w-9 rounded-full transition-colors", on ? "bg-black dark:bg-white" : "bg-neutral-200 dark:bg-neutral-800")}>
            <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow-sm dark:bg-black", on ? "left-[18px]" : "left-0.5")} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Assistant() {
  return (
    <div className="grid w-full gap-2 text-sm">
      <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-black px-4 py-2.5 text-white dark:bg-white dark:text-black">Who is on leave today?</p>
      <p className={cn(card, "max-w-[90%] rounded-2xl rounded-bl-md px-4 py-2.5")}>2 people are on leave today: Wasi Khan and Omar Ali.</p>
    </div>
  );
}

function Isolation() {
  return (
    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
      <div className="rounded-xl border border-white/20 p-4 dark:border-black/20">
        <p className="font-semibold">Acme Clinic</p>
        <p className="mt-1 text-xs text-white/60 dark:text-black/60">24 people</p>
      </div>
      <span className="font-mono text-xs text-white/60 dark:text-black/60">404</span>
      <div className="rounded-xl border border-dashed border-white/20 p-4 dark:border-black/20">
        <p className="font-semibold">Other company</p>
        <p className="mt-1 text-xs text-white/60 dark:text-black/60">not found</p>
      </div>
    </div>
  );
}

function Logins() {
  return (
    <div className={cn(card, "grid w-full gap-2 p-4 text-sm")}>
      <div className="flex justify-between gap-3"><span className="text-neutral-500">Email</span><span className="truncate font-medium">wasi@acme.co</span></div>
      <div className="flex justify-between gap-3"><span className="text-neutral-500">Temporary password</span><span className="font-mono">••••••••••</span></div>
      <p className="mt-1 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">They choose their own password at first sign-in.</p>
    </div>
  );
}

function Install() {
  return (
    <div className="flex w-full items-end justify-center gap-3">
      <div className={cn(card, "h-28 w-44 p-2")}><div className="h-full rounded-md bg-neutral-100 dark:bg-neutral-900" /></div>
      <div className={cn(card, "h-32 w-16 rounded-2xl p-1.5")}><div className="h-full rounded-xl bg-neutral-100 dark:bg-neutral-900" /></div>
    </div>
  );
}

function AuditFeed() {
  return (
    <ul className="grid w-full gap-1.5 font-mono text-xs">
      {["member.invited", "role.updated", "leave.approved", "employee.created"].map((a, i) => (
        <li key={a} className={cn(card, "flex items-center justify-between px-3 py-2")} style={{ opacity: 1 - i * 0.18 }}>
          <span>{a}</span><span className="text-neutral-500">{["2m", "1h", "3h", "1d"][i]}</span>
        </li>
      ))}
    </ul>
  );
}

function Plans() {
  const plan = PLANS.find((p) => p.featured) ?? PLANS[0];
  const yearly = priceFor(plan, "yearly");
  const monthly = priceFor(plan, "monthly");
  return (
    <div className="flex w-full items-end justify-between gap-4">
      <div>
        <p className="text-xs text-neutral-500">{plan.name}</p>
        <p className="text-4xl font-bold tracking-tight tabular-nums">${monthly.amount}<span className="text-sm font-normal text-neutral-500"> / mo</span></p>
      </div>
      <p className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700">${yearly.amount.toLocaleString("en-US")} / year</p>
    </div>
  );
}

function Integrations() {
  return (
    <div className="flex w-full flex-wrap gap-2">
      {["Gmail", "Calendar", "Stripe", "QuickBooks", "Slack", "HubSpot"].map((n) => (
        <span key={n} className="rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs text-neutral-500 dark:border-neutral-700">{n}</span>
      ))}
    </div>
  );
}

export function FeatureBento() {
  return (
    <ul className="grid auto-rows-auto grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <Tile className="sm:col-span-2 lg:col-span-4" status="live" title="People, in one directory"
        body="Departments, managers and private HR details that only the right people can see. Leave requests go to approval with weekends left out.">
        <Directory />
      </Tile>
      <Tile className="sm:col-span-2 lg:col-span-2" dark status="live" delay={80} title="A dashboard for every role"
        body="Owners see the business. Employees see their own profile and leave. Custom roles see what you switch on.">
        <RoleViews />
      </Tile>

      <Tile className="lg:col-span-2" status="live" title="Live without refreshing" body="Changes show up on every open screen within seconds.">
        <LiveSync />
      </Tile>
      <Tile className="lg:col-span-2" status="live" delay={80} title="Roles & permissions" body="Built-in roles plus custom ones. Nobody can grant more than they hold.">
        <Permissions />
      </Tile>
      <Tile className="sm:col-span-2 lg:col-span-2" status="live" delay={160} title="Ask Aoient" body="Plain questions, answered from your own records and limited to your role.">
        <Assistant />
      </Tile>

      <Tile className="sm:col-span-2 lg:col-span-3" dark status="live" title="Your data stays yours"
        body="Every request proves membership on the server. Another company's records simply don't exist for you.">
        <Isolation />
      </Tile>
      <Tile className="sm:col-span-2 lg:col-span-3" status="live" delay={80} title="Logins for your staff"
        body="Give someone an email and a temporary password, or invite them with a link. Either way, only they know their final password.">
        <Logins />
      </Tile>

      <Tile className="lg:col-span-2" status="live" title="Install it like an app" body="On a computer or phone, straight from the browser.">
        <Install />
      </Tile>
      <Tile className="lg:col-span-2" status="live" delay={80} title="Every change on record" body="Who did what, and when, for roles, members, people and leave.">
        <AuditFeed />
      </Tile>
      <Tile className="sm:col-span-2 lg:col-span-2" status="live" delay={160} title="Monthly or yearly" body="Three plans. Yearly gets two months free. 14-day trial first.">
        <Plans />
      </Tile>

      <Tile className="sm:col-span-2 lg:col-span-6" compact status="soon" title="Connect the tools you already use"
        body="Planned integrations for Aoient Connect. None are connected yet, and we'll say so until they are.">
        <Integrations />
      </Tile>
    </ul>
  );
}
