import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Pencil, Plus } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { getDocument, listDocumentLinkOptions, listDocuments } from "@/server/finance/documents";
import { NotFoundError } from "@/lib/errors";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListFilters } from "@/modules/crm/notes-ui";
import { DocumentForm } from "@/modules/finance/document-form";
import {
  DeleteDocumentButton, DeletePaymentButton, EstimateActions, IssueInvoiceButton, PaymentDialog, PrintButton, VoidInvoiceButton,
} from "@/modules/finance/forms";
import { PAYMENT_METHOD_LABELS, amount, day, stateLabel, stateTone } from "@/modules/finance/labels";
import { cn } from "@/lib/utils";

type Kind = "invoice" | "estimate";
const PLURAL = { invoice: "invoices", estimate: "estimates" } as const;
const todayIn = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

const FILTERS: Record<Kind, { value: string; label: string }[]> = {
  invoice: [
    { value: "", label: "All invoices" }, { value: "unpaid", label: "Unpaid" }, { value: "overdue", label: "Overdue" }, { value: "partial", label: "Partly paid" },
    { value: "paid", label: "Paid" }, { value: "draft", label: "Drafts" }, { value: "void", label: "Void" },
  ],
  estimate: [
    { value: "", label: "All estimates" }, { value: "draft", label: "Drafts" }, { value: "sent", label: "Sent" }, { value: "accepted", label: "Accepted" }, { value: "declined", label: "Declined" },
  ],
};

export async function DocumentList({ slug, kind, sp }: { slug: string; kind: Kind; sp: Record<string, string | string[] | undefined> }) {
  const { ctx } = await getPageOrgContext(slug);
  if (!can(ctx, "finance.invoice.read")) return <PermissionDenied what={PLURAL[kind]} />;
  const base = `/${ctx.organization.slug}/finance/${PLURAL[kind]}`;
  const query = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const state = typeof sp.status === "string" && FILTERS[kind].some((f) => f.value === sp.status) ? sp.status : undefined;
  const docs = await listDocuments(ctx, { kind, state, query });
  const canCreate = can(ctx, "finance.invoice.create");
  const add = canCreate ? <Button asChild><Link href={`${base}/new`}><Plus />New {kind}</Link></Button> : undefined;
  const filtered = Boolean(query || state);
  const totals = new Map<string, { total: number; balance: number }>();
  for (const d of docs) if (d.state !== "void" && d.state !== "draft") {
    const t = totals.get(d.currency) ?? { total: 0, balance: 0 };
    t.total += d.total; t.balance += d.balance; totals.set(d.currency, t);
  }

  return (
    <>
      <PageHeader title={kind === "invoice" ? "Invoices" : "Estimates"}
        description={kind === "invoice" ? "Bills you send to clients, and what they've paid." : "Quotes for clients. An accepted estimate becomes an invoice in one click."} actions={add} />
      <ListFilters placeholder={`Search by client or number`} select={{ key: "status", label: `Filter ${PLURAL[kind]}`, options: FILTERS[kind] }} />
      {docs.length === 0 ? (
        <Card><EmptyState icon={FileText} title={filtered ? `No ${PLURAL[kind]} match` : `No ${PLURAL[kind]} yet`}
          description={filtered ? "Try a different search or filter." : canCreate ? `Create your first ${kind}. It stays a draft until you ${kind === "invoice" ? "issue" : "send"} it.` : `${kind === "invoice" ? "Invoices" : "Estimates"} your team creates show up here.`}
          action={!filtered ? add : undefined} /></Card>
      ) : (
        <Card className="min-w-0 overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Number</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Client</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">{kind === "invoice" ? "Due" : "Valid until"}</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Total</th>
                  {kind === "invoice" && <th scope="col" className="px-4 py-2.5 text-right font-medium">Still owed</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {docs.map((d, i) => (
                  <tr key={d.id} className="motion-safe:animate-rise hover:bg-surface-muted/50" style={{ animationDelay: `${Math.min(i, 14) * 25}ms` }}>
                    <td className="px-4 py-3 font-medium"><Link href={`${base}/${d.id}`} className="hover:underline">{d.number}</Link></td>
                    <td className="max-w-56 truncate px-4 py-3">{d.company?.name ?? d.billToName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{day(d.issueDate)}</td>
                    <td className={cn("whitespace-nowrap px-4 py-3", d.state === "overdue" ? "font-medium text-danger" : "text-muted-foreground")}>{d.dueDate ? day(d.dueDate) : "—"}</td>
                    <td className="px-4 py-3"><Badge tone={stateTone(kind, d.state)}>{stateLabel(kind, d.state)}</Badge></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{amount(d.total, d.currency)}</td>
                    {kind === "invoice" && <td className={cn("whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums", d.balance === 0 && "font-normal text-muted-foreground")}>{d.balance > 0 ? amount(d.balance, d.currency) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totals.size > 0 && (
            <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-border bg-surface-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
              {[...totals].map(([cur, t]) => (
                <span key={cur}>{kind === "invoice" ? "Issued" : "Sent or answered"}: <span className="font-semibold text-foreground tabular-nums">{amount(t.total, cur)}</span>
                  {kind === "invoice" && <> · owed <span className="font-semibold text-foreground tabular-nums">{amount(t.balance, cur)}</span></>}</span>
              ))}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

export async function DocumentEditor({ slug, kind, id }: { slug: string; kind: Kind; id?: string }) {
  const { ctx } = await getPageOrgContext(slug);
  if (!can(ctx, "finance.invoice.create")) return <PermissionDenied what={`${kind} editing`} />;
  const base = `/${ctx.organization.slug}/finance/${PLURAL[kind]}`;
  const [doc, links] = await Promise.all([
    id ? getDocument(ctx, id, kind).catch((e) => { if (e instanceof NotFoundError) notFound(); throw e; }) : null,
    listDocumentLinkOptions(ctx),
  ]);
  const locked = doc && ((kind === "invoice" && doc.status !== "draft") || (kind === "estimate" && doc.status === "accepted"));
  return (
    <>
      <Link href={doc ? `${base}/${doc.id}` : base} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />{doc ? doc.number : kind === "invoice" ? "Invoices" : "Estimates"}
      </Link>
      <PageHeader title={doc ? `Edit ${doc.number}` : `New ${kind}`}
        description={kind === "invoice" ? "Saved as a draft. Issue it when it's ready; after that it can't be changed." : "Saved as a draft. Mark it as sent when you've shared it with the client."} />
      {locked ? (
        <Card className="p-6 text-sm text-muted-foreground">{kind === "invoice" ? "This invoice has been issued, so it can't be changed." : "This estimate was accepted, so it can't be changed."}</Card>
      ) : (
        <DocumentForm slug={ctx.organization.slug} kind={kind} base={base} currency={ctx.organization.currency} today={todayIn(ctx.organization.timezone)}
          companies={links.companies} projects={links.projects}
          doc={doc ? { id: doc.id, billToName: doc.billToName, billToEmail: doc.billToEmail, billToAddress: doc.billToAddress, companyId: doc.company?.id ?? null,
            projectId: doc.project?.id ?? null, issueDate: doc.issueDate, dueDate: doc.dueDate, currency: doc.currency, notes: doc.notes, lines: doc.lines } : undefined} />
      )}
    </>
  );
}

export async function DocumentView({ slug, kind, id }: { slug: string; kind: Kind; id: string }) {
  const { ctx } = await getPageOrgContext(slug);
  if (!can(ctx, "finance.invoice.read")) return <PermissionDenied what={PLURAL[kind]} />;
  const d = await getDocument(ctx, id, kind).catch((e) => { if (e instanceof NotFoundError) notFound(); throw e; });
  const fin = `/${ctx.organization.slug}/finance`;
  const base = `${fin}/${PLURAL[kind]}`;
  const today = todayIn(ctx.organization.timezone);
  const canEdit = can(ctx, "finance.invoice.create");
  const canIssue = can(ctx, "finance.invoice.issue");
  const canPay = can(ctx, "finance.payment.record");
  const editable = canEdit && (kind === "invoice" ? d.status === "draft" : d.status !== "accepted" && !d.convertedTo);
  const deletable = canEdit && (kind === "invoice" ? d.status === "draft" : !d.convertedTo);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={base} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{kind === "invoice" ? "Invoices" : "Estimates"}</Link>
        <div className="flex flex-wrap gap-2">
          {kind === "invoice" && canIssue && d.status === "draft" && <IssueInvoiceButton slug={ctx.organization.slug} id={d.id} number={d.number} />}
          {kind === "invoice" && canPay && d.status === "issued" && d.balance > 0 && (
            <PaymentDialog slug={ctx.organization.slug} invoiceId={d.id} number={d.number} owed={d.balance} currency={d.currency} today={today < d.issueDate ? d.issueDate : today} minDate={d.issueDate} />
          )}
          {kind === "estimate" && <EstimateActions slug={ctx.organization.slug} id={d.id} number={d.number} status={d.status} canIssue={canIssue && !d.convertedTo} canConvert={canEdit && !d.convertedTo} invoicesBase={`${fin}/invoices`} />}
          {editable && <Button asChild variant="secondary"><Link href={`${base}/${d.id}/edit`}><Pencil />Edit</Link></Button>}
          <PrintButton />
          {kind === "invoice" && canIssue && d.status === "issued" && d.amountPaid === 0 && <VoidInvoiceButton slug={ctx.organization.slug} id={d.id} number={d.number} />}
          {deletable && <DeleteDocumentButton slug={ctx.organization.slug} id={d.id} number={d.number} after={base} />}
        </div>
      </div>

      {(d.convertedTo || d.convertedFrom || d.state === "void") && (
        <p className="rounded-lg border border-border bg-surface-muted/60 px-4 py-2.5 text-sm text-muted-foreground print:hidden">
          {d.convertedTo && <>This estimate became <Link className="font-medium text-foreground hover:underline" href={`${fin}/invoices/${d.convertedTo.id}`}>{d.convertedTo.number}</Link>.</>}
          {d.convertedFrom && <>Created from estimate <Link className="font-medium text-foreground hover:underline" href={`${fin}/estimates/${d.convertedFrom.id}`}>{d.convertedFrom.number}</Link>.</>}
          {d.state === "void" && <>Voided{d.voidReason ? `: ${d.voidReason}` : "."} It no longer counts as money owed.</>}
        </p>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] print:block">
        <Card className="motion-safe:animate-rise min-w-0 p-6 sm:p-10 print:border-0 print:p-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{kind === "invoice" ? "Invoice" : "Estimate"}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{d.number}</h1>
              <div className="mt-2 print:hidden"><Badge tone={stateTone(kind, d.state)}>{stateLabel(kind, d.state)}</Badge></div>
            </div>
            <div className="text-right">
              <p className="text-base font-semibold">{ctx.organization.name}</p>
              <dl className="mt-2 grid gap-0.5 text-sm">
                <div className="flex justify-end gap-2"><dt className="text-muted-foreground">Date</dt><dd>{day(d.issueDate)}</dd></div>
                {d.dueDate && <div className="flex justify-end gap-2"><dt className="text-muted-foreground">{kind === "invoice" ? "Due" : "Valid until"}</dt><dd className={cn(d.state === "overdue" && "font-medium text-danger")}>{day(d.dueDate)}</dd></div>}
              </dl>
            </div>
          </div>
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bill to</p>
            <p className="mt-1 font-medium">{d.billToName}</p>
            {d.billToEmail && <p className="text-sm text-muted-foreground">{d.billToEmail}</p>}
            {d.billToAddress && <p className="whitespace-pre-line text-sm text-muted-foreground">{d.billToAddress}</p>}
          </div>
          <div className="scroll-thin mt-8 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b-2 border-foreground text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Item</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Qty</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Price</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Tax</th>
                  <th scope="col" className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-3 pr-4 [overflow-wrap:anywhere]">{l.description}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{l.quantity}</td>
                    <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums">{amount(l.unitPrice, d.currency)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">{l.taxRate ? `${l.taxRate}%` : "—"}</td>
                    <td className="whitespace-nowrap py-3 text-right tabular-nums">{amount(l.amount, d.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto mt-4 grid w-full max-w-xs gap-1.5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{amount(d.subtotal, d.currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{amount(d.taxTotal, d.currency)}</dd></div>
            <div className="flex justify-between text-lg font-semibold"><dt>Total</dt><dd className="tabular-nums">{amount(d.total, d.currency)}</dd></div>
            {kind === "invoice" && d.amountPaid > 0 && (
              <>
                <div className="flex justify-between"><dt className="text-muted-foreground">Paid</dt><dd className="tabular-nums text-success">−{amount(d.amountPaid, d.currency)}</dd></div>
                <div className="flex justify-between font-semibold"><dt>Still owed</dt><dd className="tabular-nums">{amount(d.balance, d.currency)}</dd></div>
              </>
            )}
          </dl>
          {d.notes && <p className="mt-8 whitespace-pre-line border-t border-border pt-4 text-sm text-muted-foreground">{d.notes}</p>}
        </Card>

        <aside className="grid content-start gap-4 print:hidden">
          {kind === "invoice" && d.status !== "draft" && (
            <Card className="motion-safe:animate-rise p-5 [animation-delay:80ms]">
              <h2 className="text-sm font-semibold">Payments</h2>
              {d.total > 0 && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Share paid" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((d.amountPaid / d.total) * 100)}>
                  <div className="h-full origin-left rounded-full bg-success motion-safe:animate-grow-x" style={{ width: `${Math.min(100, (d.amountPaid / d.total) * 100)}%` }} />
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{amount(d.amountPaid, d.currency)} of {amount(d.total, d.currency)} paid</p>
              {d.payments.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <ul className="mt-4 grid gap-3">
                  {d.payments.map((p) => (
                    <li key={p.id} className="flex items-start gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium tabular-nums">{amount(p.amount, d.currency)}</p>
                        <p className="truncate text-xs text-muted-foreground">{day(p.paidOn)} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}{p.reference ? ` · ${p.reference}` : ""}</p>
                        {p.recordedBy && <p className="truncate text-xs text-muted-foreground">Recorded by {p.recordedBy}</p>}
                      </div>
                      {canPay && d.status === "issued" && <DeletePaymentButton slug={ctx.organization.slug} id={p.id} label={amount(p.amount, d.currency)} />}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          <Card className="motion-safe:animate-rise p-5 [animation-delay:120ms]">
            <h2 className="text-sm font-semibold">Details</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Client</dt><dd className="truncate">{d.company ? (can(ctx, "crm.contact.read") ? <Link className="font-medium hover:underline" href={`/${ctx.organization.slug}/crm/companies/${d.company.id}`}>{d.company.name}</Link> : d.company.name) : "Not in the CRM"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Project</dt><dd className="truncate">{d.project ? (can(ctx, "projects.project.read") ? <Link className="font-medium hover:underline" href={`/${ctx.organization.slug}/projects/${d.project.id}`}>{d.project.name}</Link> : d.project.name) : "None"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Currency</dt><dd>{d.currency}</dd></div>
              {d.issuedAt && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{kind === "invoice" ? "Issued" : "Sent"}</dt><dd>{day(d.issuedAt.toISOString().slice(0, 10))}</dd></div>}
            </dl>
          </Card>
        </aside>
      </div>
    </>
  );
}
