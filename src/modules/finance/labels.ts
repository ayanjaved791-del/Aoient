/** Plain module (no "use client") so server pages and client components can both use these. */
type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

export const INVOICE_STATE_LABELS: Record<string, string> = { draft: "Draft", open: "Open", partial: "Partly paid", paid: "Paid", overdue: "Overdue", void: "Void" };
export const INVOICE_STATE_TONE: Record<string, Tone> = { draft: "neutral", open: "primary", partial: "warning", paid: "success", overdue: "danger", void: "neutral" };
export const ESTIMATE_STATE_LABELS: Record<string, string> = { draft: "Draft", sent: "Sent", accepted: "Accepted", declined: "Declined" };
export const ESTIMATE_STATE_TONE: Record<string, Tone> = { draft: "neutral", sent: "primary", accepted: "success", declined: "danger" };
export const stateLabel = (kind: string, s: string) => (kind === "estimate" ? ESTIMATE_STATE_LABELS : INVOICE_STATE_LABELS)[s] ?? s;
export const stateTone = (kind: string, s: string): Tone => (kind === "estimate" ? ESTIMATE_STATE_TONE : INVOICE_STATE_TONE)[s] ?? "neutral";

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer", cash: "Cash", card: "Card", cheque: "Cheque", online: "Online payment", other: "Other",
};
export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  travel: "Travel", meals: "Meals", software: "Software", equipment: "Equipment", office: "Office", marketing: "Marketing",
  contractors: "Contractors", utilities: "Utilities", rent: "Rent", other: "Other",
};
export const EXPENSE_STATUS_LABELS: Record<string, string> = { pending: "Waiting for approval", approved: "Approved", rejected: "Rejected", paid: "Paid out" };
export const EXPENSE_STATUS_TONE: Record<string, Tone> = { pending: "warning", approved: "primary", rejected: "danger", paid: "success" };

export const CURRENCIES = ["USD", "EUR", "GBP", "PKR", "AED", "SAR", "INR", "CAD", "AUD"];

/** "$1,250.00": finance always shows cents. */
export function amount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
