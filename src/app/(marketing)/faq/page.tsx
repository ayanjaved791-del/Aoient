import type { Metadata } from "next";
import { CtaSection, FaqSection, PageHero } from "@/modules/marketing/sections";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Straight answers about Aoient: what works today, the free trial, plans and limits, billing, cancelling and data security.",
};

export default function FaqPage() {
  return (
    <>
      <PageHero eyebrow="FAQ" title="Everything you might ask" body="What works today, how the trial and plans work, and how your data is protected. Still unsure? Start the free trial, no card needed." />
      <FaqSection />
      <CtaSection />
    </>
  );
}
