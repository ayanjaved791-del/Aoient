/** Formatting shared by server pages and client components. */
export const hours = (min: number | null) => (min === null ? "—" : `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`);
