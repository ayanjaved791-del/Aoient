import type { CSSProperties, ReactNode } from "react";
import { PLANS, priceFor } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import type { SimpleIcon } from "simple-icons";
import { Check, Lock } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { BrandTile, PLANNED_INTEGRATIONS } from "./brand-logos";

type Status = "live" | "soon";

function StatusPill({ status }: { status: Status }) {
  return status === "live" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-black dark:border-neutral-700 dark:text-white">
      <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgb(16_185_129/0.8)]" /> Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-500 dark:border-neutral-700">
      In development
    </span>
  );
}

function Tile({
  title,
  body,
  status,
  className,
  delay = 0,
  children,
}: {
  title: string;
  body: string;
  status: Status;
  className?: string;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <li className={cn("reveal", className)} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>
      <article
        data-spotlight
        className="group flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white transition-[border-color,box-shadow] duration-500 hover:border-neutral-400 hover:shadow-[0_24px_48px_-24px_rgb(0_0_0/0.25)] dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600"
      >
        <div aria-hidden className="relative flex min-h-44 flex-1 items-center justify-center overflow-hidden p-6">
          {children}
        </div>
        <div className="border-t border-neutral-100 p-6 dark:border-neutral-900">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-black dark:text-white">{title}</h3>
            <StatusPill status={status} />
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{body}</p>
        </div>
      </article>
    </li>
  );
}

const INNER = PLANNED_INTEGRATIONS.slice(0, 4);
const OUTER = PLANNED_INTEGRATIONS.slice(4, 12);

function Orbit() {
  const ring = (icons: SimpleIcon[], size: number, duration: string, reverse = false) => (
    <div
      className="absolute rounded-full border border-dashed border-neutral-300 motion-safe:animate-orbit dark:border-neutral-700"
      style={{ width: size, height: size, animationDuration: duration, animationDirection: reverse ? "reverse" : "normal" }}
    >
      {icons.map((icon, i) => {
        const angle = (i / icons.length) * Math.PI * 2;
        return (
          <span
            key={icon.slug}
            className="absolute -ml-5 -mt-5 motion-safe:animate-orbit"
            style={{
              left: `${50 + 50 * Math.cos(angle)}%`,
              top: `${50 + 50 * Math.sin(angle)}%`,
              animationDuration: duration,
              animationDirection: reverse ? "normal" : "reverse",
            }}
          >
            <BrandTile icon={icon} />
          </span>
        );
      })}
    </div>
  );
  return (
    <div className="relative flex h-[280px] w-full scale-[0.8] items-center justify-center sm:h-[340px] sm:scale-100">
      {ring(OUTER, 320, "80s", true)}
      {ring(INNER, 180, "50s")}
      <span className="relative flex size-16 items-center justify-center rounded-2xl border border-neutral-200 bg-white shadow-[0_16px_40px_-12px_rgb(124_58_237/0.45)] dark:border-neutral-800 dark:bg-neutral-900">
        <Logo withWordmark={false} className="[&_svg]:size-10" />
      </span>
    </div>
  );
}

const PERMS = ["View members", "Invite members", "Manage roles", "Edit organization", "Read audit log"];

function Permissions() {
  return (
    <ul className="w-full max-w-64 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white text-sm shadow-sm dark:divide-neutral-900 dark:border-neutral-800 dark:bg-neutral-950">
      {PERMS.map((p, i) => (
        <li key={p} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="text-neutral-700 dark:text-neutral-300">{p}</span>
          <span
            className="relative h-4 w-[30px] shrink-0 rounded-full bg-[var(--track-off)] motion-safe:animate-toggle-track"
            style={{ animationDelay: `${i * 0.45}s` }}
          >
            <span
              className="absolute left-0.5 top-0.5 size-3 rounded-full bg-white shadow motion-safe:animate-toggle-knob dark:bg-neutral-950"
              style={{ animationDelay: `${i * 0.45}s` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Isolation() {
  return (
    <div className="relative flex w-full max-w-72 items-center justify-between">
      {["Org A", "Org B"].map((org) => (
        <div key={org} className="grid w-24 gap-1.5 rounded-2xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs font-semibold text-black dark:text-white">{org}</p>
          <span className="h-1.5 rounded bg-neutral-200 dark:bg-neutral-800" />
          <span className="h-1.5 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
          <span className="h-1.5 w-4/5 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      ))}
      <div className="absolute inset-y-0 left-1/2 -ml-px flex w-0.5 flex-col items-center justify-center bg-[repeating-linear-gradient(to_bottom,rgb(var(--spot)/0.35)_0_4px,transparent_4px_8px)]">
        <span className="flex size-7 items-center justify-center rounded-full border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950">
          <Lock className="size-3.5 text-black dark:text-white" />
        </span>
      </div>
      <span className="absolute right-[86px] top-[22%] size-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgb(244_63_94/0.8)] motion-safe:animate-probe" />
      <span className="absolute left-1/2 top-[6%] -translate-x-1/2 rounded-full bg-rose-500 px-2 py-0.5 font-mono text-[10px] font-semibold text-white opacity-0 shadow-md shadow-rose-500/40 motion-safe:animate-probe-flag">
        404
      </span>
    </div>
  );
}

function Invitation() {
  return (
    <div className="relative w-full max-w-64">
      <div className="absolute inset-x-4 -top-3 h-full rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" />
      <div className="relative rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm motion-safe:animate-invite dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-600 text-xs font-semibold text-white shadow-md shadow-violet-500/30">SK</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-black dark:text-white">Join Acme on Aoient</p>
            <p className="truncate text-xs text-neutral-500">Role: Project manager</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white dark:bg-white dark:text-black">Accept</span>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 opacity-0 ring-1 ring-inset ring-emerald-500/30 motion-safe:animate-invite-badge dark:text-emerald-400">
            <Check className="mr-0.5 inline size-3 -translate-y-px" strokeWidth={3} aria-hidden />
            Joined
          </span>
        </div>
      </div>
    </div>
  );
}

const AUDIT = [
  ["member.role_changed", "Owner → Admin"],
  ["invitation.sent", "sara@studio.co"],
  ["role.created", "Project lead"],
  ["organization.updated", "currency: USD"],
  ["member.suspended", "contractor"],
  ["invitation.accepted", "dev@studio.co"],
];

function AuditFeed() {
  const rows = [...AUDIT, ...AUDIT];
  return (
    <div className="h-48 w-full max-w-72 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]">
      <ul className="grid gap-2 motion-safe:animate-marquee-y">
        {rows.map(([action, detail], i) => (
          <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950">
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn("size-1.5 shrink-0 rounded-full", ["bg-violet-500", "bg-sky-500", "bg-fuchsia-500", "bg-amber-500", "bg-rose-500", "bg-emerald-500"][i % 6])} />
              <span className="truncate font-mono text-[11px] text-black dark:text-white">{action}</span>
            </span>
            <span className="truncate text-[11px] text-neutral-500">{detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const CODE = [
  { text: "$ curl /api/v1/organizations", tone: "text-neutral-500" },
  { text: "HTTP/1.1 200 OK", tone: "text-black dark:text-white" },
  { text: "{", tone: "text-black dark:text-white" },
  { text: '  "data": [{', tone: "text-black dark:text-white" },
  { text: '    "slug": "acme",', tone: "text-neutral-600 dark:text-neutral-400" },
  { text: '    "role": "Owner"', tone: "text-neutral-600 dark:text-neutral-400" },
  { text: "  }]", tone: "text-black dark:text-white" },
  { text: "}", tone: "text-black dark:text-white" },
];

function ApiCode() {
  return (
    <pre className="w-full max-w-72 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-[11px] leading-5 dark:border-neutral-800 dark:bg-neutral-900">
      {CODE.map((line, i) => (
        <span key={i} className={cn("block motion-safe:animate-line-cycle", line.tone)} style={{ animationDelay: `${i * 0.25}s` }}>
          {line.text}
          {i === CODE.length - 1 && <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-black motion-safe:animate-blink dark:bg-white" />}
        </span>
      ))}
    </pre>
  );
}

function Themes() {
  const mini = (dark: boolean) => (
    <div className={cn("grid gap-1.5 rounded-xl border p-3", dark ? "border-neutral-800 bg-black" : "border-neutral-200 bg-white")}>
      <span className={cn("h-2 w-1/2 rounded", dark ? "bg-white" : "bg-black")} />
      <span className={cn("h-1.5 rounded", dark ? "bg-neutral-800" : "bg-neutral-200")} />
      <span className={cn("h-1.5 w-3/4 rounded", dark ? "bg-neutral-800" : "bg-neutral-200")} />
      <span className={cn("mt-1 h-4 w-12 rounded-full", dark ? "bg-white" : "bg-black")} />
    </div>
  );
  return (
    <div className="grid w-full max-w-64 grid-cols-2 gap-3">
      <div className="transition-transform duration-500 group-hover:-rotate-3 group-hover:-translate-y-1">{mini(false)}</div>
      <div className="transition-transform duration-500 group-hover:rotate-3 group-hover:-translate-y-1">{mini(true)}</div>
    </div>
  );
}

function PlanToggle() {
  const plan = PLANS.find((p) => p.featured) ?? PLANS[0];
  const monthly = priceFor(plan, "monthly");
  const yearly = priceFor(plan, "yearly");
  return (
    <div className="grid w-full max-w-60 justify-items-center gap-4">
      <div className="relative grid w-44 grid-cols-2 rounded-full border border-neutral-200 p-1 text-[11px] font-medium dark:border-neutral-800">
        <span className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 motion-safe:animate-knob-slide" />
        <span className="relative z-10 py-1 text-center text-white motion-safe:animate-label-first">Monthly</span>
        <span className="relative z-10 py-1 text-center text-neutral-500 motion-safe:animate-label-second">Yearly</span>
      </div>
      <div className="relative h-12 w-full text-center">
        <p className="absolute inset-0 motion-safe:animate-swap-out">
          <span className="text-4xl font-semibold tracking-tight text-black dark:text-white">${monthly.amount}</span>
          <span className="text-sm text-neutral-500"> / month</span>
        </p>
        <p className="absolute inset-0 opacity-0 motion-safe:animate-swap-in">
          <span className="text-4xl font-semibold tracking-tight text-black dark:text-white">${yearly.amount.toLocaleString("en-US")}</span>
          <span className="text-sm text-neutral-500"> / year</span>
        </p>
      </div>
      <p className="text-xs text-neutral-500">{plan.name} plan</p>
    </div>
  );
}

export function FeatureBento() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <Tile
        className="sm:col-span-2 lg:col-span-4 lg:row-span-2"
        status="soon"
        title="Connect the tools you already use"
        body="Planned integrations for Aoient Connect, such as Gmail, Google Calendar, Stripe, QuickBooks and HubSpot. None are connected yet; they'll be added as Connect is built."
      >
        <Orbit />
      </Tile>
      <Tile
        className="sm:col-span-2 lg:col-span-2 lg:row-span-2"
        status="live"
        delay={100}
        title="Roles & permissions"
        body="Owner, Admin and Member roles out of the box, plus custom roles. Nobody can grant a permission they don't hold."
      >
        <Permissions />
      </Tile>
      <Tile className="lg:col-span-2" status="live" title="Tenant isolation" body="Every request proves membership on the server. Another company's data answers with “not found”.">
        <Isolation />
      </Tile>
      <Tile className="lg:col-span-2" status="live" delay={100} title="Team invitations" body="Invite teammates with a role attached. Invitation links are single-use and expire.">
        <Invitation />
      </Tile>
      <Tile className="sm:col-span-2 lg:col-span-2" status="live" delay={200} title="Audit log" body="Role changes, invitations and settings edits are recorded with who did what.">
        <AuditFeed />
      </Tile>
      <Tile className="lg:col-span-2" status="live" title="Versioned API" body="A JSON API under /api/v1 with the same permission checks as the app.">
        <ApiCode />
      </Tile>
      <li className="reveal lg:col-span-2" style={{ "--reveal-delay": "100ms" } as CSSProperties}>
        <article
          data-spotlight
          className="group flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white transition-[border-color,box-shadow] duration-500 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600"
        >
          <div aria-hidden className="flex min-h-44 flex-1 items-center justify-center p-6">
            <Themes />
          </div>
          <div className="border-t border-neutral-100 p-6 dark:border-neutral-900">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-black dark:text-white">White or black</h3>
              <ThemeToggle label="Try it" className="h-7 px-2 text-xs" />
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">A clean light theme by default, and a true dark theme one click away.</p>
          </div>
        </article>
      </li>
      <Tile className="sm:col-span-2 lg:col-span-2" status="soon" delay={200} title="Monthly or yearly" body="Three plans, each billed monthly or yearly, with two months free on yearly. Plan activation after payment is being built.">
        <PlanToggle />
      </Tile>
    </ul>
  );
}
