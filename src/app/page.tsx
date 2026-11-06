import { Hero } from "@/modules/marketing/hero";
import { TechStack } from "@/modules/marketing/brand-logos";
import { FeatureBento } from "@/modules/marketing/bento";
import { LandingEffects } from "@/modules/marketing/landing-effects";
import { PricingTeaser } from "@/modules/marketing/pricing-teaser";
import {
  CtaSection,
  FaqSection,
  LandingFooter,
  LandingHeader,
  ModuleMarquee,
  ModulesSection,
  SectionHeading,
  SecuritySection,
  StepsSection,
  WorkflowSection,
} from "@/modules/marketing/sections";

export default function LandingPage() {
  return (
    <div className="landing min-h-dvh bg-white text-black dark:bg-black dark:text-white">
      <LandingEffects />
      <LandingHeader />
      <main>
        <Hero />
        <ModuleMarquee />
        <TechStack />

        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
          <SectionHeading
            eyebrow="Features"
            title="Built on a foundation you can trust"
            body="Tiles marked Live work today. The rest are on the way, and we label them honestly."
          />
          <div className="mt-14">
            <FeatureBento />
          </div>
        </section>

        <WorkflowSection />
        <ModulesSection />
        <SecuritySection />
        <StepsSection />

        <section id="pricing" className="scroll-mt-20 border-t border-neutral-200 bg-neutral-50 dark:border-neutral-900 dark:bg-neutral-950/40">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
            <SectionHeading eyebrow="Pricing" title="Simple plans that grow with you" body="Every plan is available monthly or yearly." />
            <div className="mt-12">
              <PricingTeaser />
            </div>
          </div>
        </section>

        <FaqSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
