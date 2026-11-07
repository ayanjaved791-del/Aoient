import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { AppWindow, PackageCheck, Laptop, RefreshCw, ShieldCheck, Smartphone, Tablet, WifiOff, Zap } from "lucide-react";
import { CtaSection, PageHero, SectionHeading } from "@/modules/marketing/sections";
import { InstallAppButton, AndroidSteps, DesktopSteps, IosSteps } from "@/components/pwa/install-app";

export const metadata: Metadata = {
  title: "Download the app",
  description: "Install Aoient on Windows, macOS, Linux, Android, iPhone and iPad straight from your browser. No app store, always up to date.",
};

const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

const PLATFORMS = [
  { icon: Laptop, title: "Windows, macOS & Linux", note: "Chrome or Edge", steps: <DesktopSteps /> },
  { icon: Smartphone, title: "Android", note: "Chrome, Edge or Samsung Internet", steps: <AndroidSteps /> },
  { icon: Tablet, title: "iPhone & iPad", note: "Safari", steps: <IosSteps /> },
];

const BENEFITS = [
  { icon: AppWindow, title: "Its own window and icon", body: "Opens like any app from your Start menu, Dock, desktop or home screen, without browser tabs and bars." },
  { icon: Zap, title: "Opens straight to your workspace", body: "Lands on your workspaces, so you're one tap from your dashboard." },
  { icon: RefreshCw, title: "Always up to date", body: "Updates arrive automatically the moment we release them. Nothing to download again." },
  { icon: WifiOff, title: "Clear offline screen", body: "If the connection drops, you get a friendly screen that reconnects on its own instead of a browser error." },
  { icon: ShieldCheck, title: "Same security as the website", body: "Same sign-in and server checks. Workspace data isn't stored on the device, so nothing is left behind on a shared computer." },
  { icon: PackageCheck, title: "No app store, no extra cost", body: "Installed from the browser in seconds, takes almost no space, and you can remove it any time like any other app." },
];

export default function DownloadPage() {
  return (
    <>
      <PageHero
        eyebrow="Download"
        title="Aoient on every device"
        body="Install Aoient as an app on your computer, phone or tablet, straight from the browser. One click where your browser supports it, a few taps everywhere else."
      >
        <InstallAppButton size="lg" label="Install Aoient" className="rounded-full px-6" />
      </PageHero>

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionHeading eyebrow="How to install" title="Pick your device" body="If the button above says your browser can't install in one click, follow the steps for your device." />
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {PLATFORMS.map((p, i) => (
            <article key={p.title} data-reveal="up" className="reveal rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950" style={delay(i * 90)}>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-orange-400 text-white"><p.icon className="size-5" aria-hidden /></span>
                <div>
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="text-xs text-neutral-500">{p.note}</p>
                </div>
              </div>
              <div className="mt-6">{p.steps}</div>
            </article>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-neutral-500">
          Firefox doesn&apos;t install web apps on desktop; use Chrome or Edge there. On a Mac with Safari 17 or newer, choose File → Add to Dock.
        </p>
      </section>

      <section className="border-t border-neutral-200 bg-neutral-50 dark:border-neutral-900 dark:bg-neutral-950/40">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading eyebrow="Why install" title="Everything the website does, in an app" body="Same account, same data, same security. Just quicker to reach." />
          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <li key={b.title} data-reveal="up" className="reveal rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950" style={delay((i % 3) * 90)}>
                <b.icon className="size-5 text-violet-500" aria-hidden />
                <h3 className="mt-3 font-semibold">{b.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{b.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <CtaSection />
    </>
  );
}
