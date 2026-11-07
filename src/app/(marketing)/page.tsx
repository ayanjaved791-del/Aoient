import { Hero } from "@/modules/marketing/hero";
import { TechStack } from "@/modules/marketing/brand-logos";
import { FeatureBento } from "@/modules/marketing/bento";
import { PricingTeaser } from "@/modules/marketing/pricing-teaser";
import {
  CtaSection,
  FaqSection,
  IntegrationMarquee,
  ModulesSection,
  MoreLink,
  SectionHeading,
  SecuritySection,
  StepsSection,
  WorkflowSection,
} from "@/modules/marketing/sections";

/** The overview. Each section links to its own page with the full story. */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <IntegrationMarquee />
      <TechStack />

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <SectionHeading
          eyebrow="Features"
          title="Built on a foundation you can trust"
          body="Tiles marked Live work today. The rest are on the way, and we label them honestly."
        />
        <div className="mt-14">
          <FeatureBento />
        </div>
        <MoreLink href="/features">Explore all features</MoreLink>
      </section>

      <WorkflowSection />
      <ModulesSection more={<MoreLink href="/modules">See every module</MoreLink>} />
      <SecuritySection more={<MoreLink href="/security">How we protect your data</MoreLink>} />
      <StepsSection />

      <section className="border-t border-neutral-200 bg-neutral-50 dark:border-neutral-900 dark:bg-neutral-950/40">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <SectionHeading eyebrow="Pricing" title="Simple plans that grow with you" body="Every plan is available monthly or yearly." />
          <div className="mt-12">
            <PricingTeaser />
          </div>
          <MoreLink href="/pricing">Compare plans in detail</MoreLink>
        </div>
      </section>

      <FaqSection limit={4} more={<MoreLink href="/faq">Read all questions</MoreLink>} />
      <CtaSection />
    </>
  );
}
