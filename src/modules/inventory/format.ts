/** Formatting shared by server pages and client components. */
export const qty = (q: number) => (Number.isInteger(q) ? q.toLocaleString("en-US") : q.toLocaleString("en-US", { maximumFractionDigits: 2 }));
