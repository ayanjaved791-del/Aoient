import type { Metadata } from "next";
import { CtaSection, ModulesSection, PageHero, StepsSection } from "@/modules/marketing/sections";

export const metadata: Metadata = {
  title: "Modules",
  description: "People, CRM, Projects, Time, Finance and more, sharing one set of customers, people and projects. See what's live and what's coming.",
};

export default function ModulesPage() {
  return (
    <>
      <PageHero
        eyebrow="Modules"
        title="One platform, every part of your business"
        body="Each module shares the same people, customers and projects, so work flows from a won deal to a project, to tracked time, to an invoice. Organization & access is live today; the rest are released one by one."
      />
      <ModulesSection />
      <StepsSection />
      <CtaSection />
    </>
  );
}
