import { HomeHero } from "@/modules/marketing/home/hero";
import { BuiltOn, FinalCta, Heading, HowItWorks, ModulesBand, TextLink } from "@/modules/marketing/home/sections";
import { FeatureBento } from "@/modules/marketing/bento";
import { PricingTeaser } from "@/modules/marketing/pricing-teaser";
import { FaqSection, MoreLink } from "@/modules/marketing/sections";

/** The overview, in black and white. Each section links to its own page with the full story. */
export default function LandingPage() {
  return (
    <>
      <HomeHero />
      <BuiltOn />

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <Heading title="Everything your team needs. Nothing pretend." body="Tiles marked Live work today. Anything else is labelled as in development." />
        <div className="mt-14">
          <FeatureBento />
        </div>
        <MoreLink href="/features">Explore all features</MoreLink>
      </section>

      <ModulesBand more={<TextLink href="/modules" invert>See every module</TextLink>} />
      <HowItWorks />

      <section className="border-t border-neutral-200 bg-[#f7f7f5] dark:border-neutral-900 dark:bg-neutral-950">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <Heading title="Simple plans that grow with you" body="Every plan is available monthly or yearly, after a 14-day free trial." />
          <div className="mt-12">
            <PricingTeaser />
          </div>
          <MoreLink href="/pricing">Compare plans in detail</MoreLink>
        </div>
      </section>

      <FaqSection limit={4} more={<MoreLink href="/faq">Read all questions</MoreLink>} />
      <FinalCta />
    </>
  );
}
