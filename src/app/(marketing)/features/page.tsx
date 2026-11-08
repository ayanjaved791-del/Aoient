import type { Metadata } from "next";
import Link from "next/link";
import { FeatureBento } from "@/modules/marketing/bento";
import { TechStack } from "@/modules/marketing/brand-logos";
import { CtaSection, PageHero, WorkflowSection } from "@/modules/marketing/sections";

export const metadata: Metadata = {
  title: "Features",
  description: "What Aoient does today and what's coming: organizations, roles, invitations, audit log, plans and the connected modules.",
};

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Everything in one connected workspace"
        body="Tiles marked Live work today. The rest are being built and are labelled honestly, so you always know what you're getting."
      >
        <Link href="/sign-up" className="inline-flex h-11 items-center rounded-full bg-black px-6 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200">
          Start your free trial
        </Link>
        <Link href="/modules" className="inline-flex h-11 items-center rounded-full border border-neutral-300 px-6 text-sm font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900">
          See the modules
        </Link>
      </PageHero>

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <FeatureBento />
      </section>

      <WorkflowSection />
      <TechStack />

      <CtaSection />
    </>
  );
}
