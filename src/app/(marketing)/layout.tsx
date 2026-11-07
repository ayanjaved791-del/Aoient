import { LandingEffects } from "@/modules/marketing/landing-effects";
import { LandingFooter, LandingHeader } from "@/modules/marketing/sections";

/** Shared frame for the public site: header with page links, footer, motion effects. */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="landing min-h-dvh overflow-x-clip bg-white text-black dark:bg-black dark:text-white">
      <LandingEffects />
      <LandingHeader />
      <main>{children}</main>
      <LandingFooter />
    </div>
  );
}
