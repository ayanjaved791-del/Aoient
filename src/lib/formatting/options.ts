/** Common ISO-4217 currencies for selects (any valid 3-letter code is accepted server-side). */
export const CURRENCIES = ["USD", "EUR", "GBP", "AED", "AUD", "CAD", "CHF", "INR", "JPY", "NZD", "PKR", "SAR", "SGD", "ZAR"] as const;

export function timezones(): string[] {
  try {
    // Chromium leaves "UTC" out of the list even though it is a valid (and the default) choice.
    const list = Intl.supportedValuesOf("timeZone");
    return list.includes("UTC") ? list : ["UTC", ...list];
  } catch {
    return ["UTC"];
  }
}
