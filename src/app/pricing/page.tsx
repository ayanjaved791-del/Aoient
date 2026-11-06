import type { Metadata } from "next";
import { PricingPage } from "@/modules/billing/pricing-page";

export const metadata: Metadata = { title: "Pricing" };

export default function Pricing() {
  return <PricingPage />;
}
