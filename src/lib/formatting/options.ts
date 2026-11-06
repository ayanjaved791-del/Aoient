/** Common ISO-4217 currencies for selects (any valid 3-letter code is accepted server-side). */
export const CURRENCIES = ["USD", "EUR", "GBP", "AED", "AUD", "CAD", "CHF", "INR", "JPY", "NZD", "PKR", "SAR", "SGD", "ZAR"] as const;

export function timezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}
