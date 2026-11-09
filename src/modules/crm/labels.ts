/** Plain module (no "use client") so server pages and client components can both use these. */
export const LEAD_SOURCE_LABELS: Record<string, string> = {
  website: "Website", referral: "Referral", event: "Event", social: "Social media", outbound: "Outreach", other: "Other",
};
export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified", disqualified: "Not a fit", converted: "Converted",
};
export const LEAD_STATUS_TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  new: "primary", contacted: "neutral", qualified: "success", disqualified: "danger", converted: "success",
};
export const STAGE_KIND_LABELS: Record<string, string> = { open: "Open", won: "Won", lost: "Lost" };

/** "$12,500" — whole amounts without cents, otherwise two decimals. */
export function money(amount: number, currency: string, compact = false): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, notation: compact && amount >= 100_000 ? "compact" : "standard",
      maximumFractionDigits: Number.isInteger(amount) || compact ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US")}`;
  }
}

export const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
