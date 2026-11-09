import type { Metadata } from "next";
import { Suspense } from "react";
import { Pencil, Plus, Receipt } from "lucide-react";
import { getPageOrgContext } from "@/server/tenancy/page-context";
import { can } from "@/server/tenancy/context";
import { listExpenses } from "@/server/finance/expenses";
import { listVendors } from "@/server/finance/vendors";
import { listDocumentLinkOptions } from "@/server/finance/documents";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionDenied } from "@/components/layout/permission-denied";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ListFilters } from "@/modules/crm/notes-ui";
import { DeleteExpenseButton, ExpenseDialog, MarkExpensePaid, ReviewExpense } from "@/modules/finance/forms";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_STATUS_LABELS, EXPENSE_STATUS_TONE, amount, day } from "@/modules/finance/labels";

export const metadata: Metadata = { title: "Expenses" };

const FILTERS = [
  { value: "", label: "All expenses" }, { value: "pending", label: "Waiting for approval" }, { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid out" }, { value: "rejected", label: "Rejected" },
];

async function Expenses({ params, searchParams }: PageProps<"/[organizationSlug]/finance/expenses">) {
  const [{ organizationSlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getPageOrgContext(organizationSlug);
  if (!can(ctx, "finance.expense.read") && !can(ctx, "finance.expense.manage") && !can(ctx, "finance.expense.approve")) return <PermissionDenied what="expenses" />;
  const query = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const status = typeof sp.status === "string" && FILTERS.some((f) => f.value === sp.status) ? sp.status : undefined;
  const canManage = can(ctx, "finance.expense.manage");
  const canApprove = can(ctx, "finance.expense.approve");
  const [rows, vendors, links] = await Promise.all([
    listExpenses(ctx, { status, query }),
    canManage ? listVendors(ctx) : [],
    canManage ? listDocumentLinkOptions(ctx) : { projects: [] as { id: string; name: string }[] },
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.organization.timezone }).format(new Date());
  const vendorOpts = vendors.map((v) => ({ id: v.id, name: v.name }));
  const projectOpts = links.projects.map((p) => ({ id: p.id, name: p.name }));
  const add = canManage ? <ExpenseDialog slug={ctx.organization.slug} currency={ctx.organization.currency} today={today} vendors={vendorOpts} projects={projectOpts} trigger={<Button><Plus />New expense</Button>} /> : undefined;
  const filtered = Boolean(query || status);
  const sums = new Map<string, number>();
  for (const r of rows) if (r.status === "approved" || r.status === "paid") sums.set(r.currency, (sums.get(r.currency) ?? 0) + r.amount);

  return (
    <>
      <PageHeader title="Expenses" description={canApprove ? "What the business spent. Approve or reject what's waiting, then mark it paid once it's paid out." : "What the business spent, and where each expense is in approval."} actions={add} />
      <ListFilters placeholder="Search expenses or vendors" select={{ key: "status", label: "Filter expenses", options: FILTERS }} />
      {rows.length === 0 ? (
        <Card><EmptyState icon={Receipt} title={filtered ? "No expenses match" : "No expenses yet"} description={filtered ? "Try a different search or filter." : canManage ? "Add what the business spends: software, travel, equipment and more." : "Expenses your team adds show up here."} action={!filtered ? add : undefined} /></Card>
      ) : (
        <Card className="min-w-0 overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-surface-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Expense</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Vendor</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => (
                  <tr key={r.id} className="motion-safe:animate-rise align-top hover:bg-surface-muted/50" style={{ animationDelay: `${Math.min(i, 14) * 25}ms` }}>
                    <td className="max-w-72 px-4 py-3">
                      <p className="truncate font-medium">{r.description}</p>
                      <p className="truncate text-xs text-muted-foreground">{EXPENSE_CATEGORY_LABELS[r.category] ?? r.category}{r.project ? ` · ${r.project.name}` : ""}{r.submittedBy ? ` · added by ${r.submittedBy.name}` : ""}</p>
                      {r.reviewNote && <p className="mt-1 truncate text-xs text-muted-foreground">“{r.reviewNote}”{r.reviewedBy ? ` — ${r.reviewedBy}` : ""}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{day(r.spentOn)}</td>
                    <td className="max-w-40 truncate px-4 py-3 text-muted-foreground">{r.vendor?.name ?? "—"}</td>
                    <td className="px-4 py-3"><Badge tone={EXPENSE_STATUS_TONE[r.status]}>{EXPENSE_STATUS_LABELS[r.status]}</Badge></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{amount(r.amount, r.currency)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.status === "pending" && r.canReview && <ReviewExpense slug={ctx.organization.slug} id={r.id} description={r.description} />}
                        {r.status === "pending" && canApprove && !r.canReview && <span className="whitespace-nowrap text-xs text-muted-foreground">Needs another approver</span>}
                        {r.status === "approved" && canApprove && <MarkExpensePaid slug={ctx.organization.slug} id={r.id} />}
                        {canManage && (r.status === "pending" || r.status === "rejected") && (
                          <>
                            <ExpenseDialog slug={ctx.organization.slug} currency={ctx.organization.currency} today={today} vendors={vendorOpts} projects={projectOpts}
                              expense={{ id: r.id, description: r.description, category: r.category, amount: r.amount, currency: r.currency, spentOn: r.spentOn, vendorId: r.vendor?.id ?? null, projectId: r.project?.id ?? null, notes: r.notes }}
                              trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.description}`}><Pencil /></Button>} />
                            <DeleteExpenseButton slug={ctx.organization.slug} id={r.id} description={r.description} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sums.size > 0 && (
            <div className="flex flex-wrap justify-end gap-x-6 border-t border-border bg-surface-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
              {[...sums].map(([cur, s]) => <span key={cur}>Approved and paid: <span className="font-semibold text-foreground tabular-nums">{amount(s, cur)}</span></span>)}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

export default function ExpensesPage(props: PageProps<"/[organizationSlug]/finance/expenses">) {
  return <Suspense fallback={<div className="grid gap-6"><Skeleton className="h-9 w-40" /><Skeleton className="h-10" /><Skeleton className="h-72" /></div>}><Expenses {...props} /></Suspense>;
}
