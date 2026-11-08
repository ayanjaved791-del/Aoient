import type { Metadata } from "next";
import { FaqBrowser } from "@/modules/marketing/faq-browser";
import { InnerHero, SlimCta } from "@/modules/marketing/inner";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Straight answers about Aoient: what works today, how your team signs in, the free trial, plans and limits, billing, cancelling and data security.",
};

export default function FaqPage() {
  return (
    <>
      <InnerHero crumb="FAQ" title="Questions, answered plainly" faces={["curly", "spiky", "bob"]}
        body="What works today, how your team signs in, how the trial and plans work, and how your data is protected. Search, or pick a topic." />
      <FaqBrowser />
      <SlimCta title="Still deciding?" body="The easiest answer is to try it: 14 days free, no card needed." />
    </>
  );
}
