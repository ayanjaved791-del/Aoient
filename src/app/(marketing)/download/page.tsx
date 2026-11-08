import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Download } from "lucide-react";
import { getDesktopRelease, type DesktopAsset, type DesktopRelease } from "@/server/desktop/releases";
import { InstallAppButton } from "@/components/pwa/install-app";
import { PrimaryDownload } from "@/modules/marketing/download/primary-download";
import { SlimCta } from "@/modules/marketing/inner";

export const metadata: Metadata = {
  title: "Download",
  description: "Download the Aoient desktop app for Windows, macOS and Linux, or install it on your phone from the browser.",
};

const mb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;
const date = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

/* ---------------------------------------------------------------- hero */

function AppWindowMock() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-100 px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
        <span className="size-3 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <span className="size-3 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <span className="size-3 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <span className="mx-auto text-xs font-medium text-neutral-500">Aoient</span>
        <span className="w-12" />
      </div>
      <div className="grid grid-cols-[150px_1fr] sm:grid-cols-[190px_1fr]">
        <div className="hidden border-r border-neutral-200 p-4 dark:border-neutral-800 min-[420px]:block">
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-md bg-black dark:bg-white" />
            <span className="h-2.5 w-16 rounded bg-neutral-300 dark:bg-neutral-700" />
          </div>
          <div className="mt-6 grid gap-2.5">
            {[70, 56, 64, 48, 60].map((w, i) => (
              <span key={i} className={`h-2.5 rounded ${i === 0 ? "bg-black dark:bg-white" : "bg-neutral-200 dark:bg-neutral-800"}`} style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
        <div className="col-span-2 p-5 min-[420px]:col-span-1 sm:p-7">
          <span className="block h-3.5 w-40 rounded bg-neutral-800 dark:bg-neutral-200" />
          <span className="mt-2 block h-2.5 w-56 max-w-full rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="mt-6 grid grid-cols-3 gap-3">
            {["12", "3", "98%"].map((n) => (
              <div key={n} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                <span className="block h-2 w-10 rounded bg-neutral-200 dark:bg-neutral-800" />
                <span className="mt-2 block text-lg font-bold tracking-tight">{n}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
                <span className="size-6 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                <span className="h-2.5 flex-1 rounded bg-neutral-200 dark:bg-neutral-800" />
                <span className="h-2.5 w-12 rounded bg-neutral-300 dark:bg-neutral-700" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

async function Hero() {
  const release = await getDesktopRelease();
  return (
    <section className="border-b border-neutral-200 dark:border-neutral-900">
      <div className="mx-auto max-w-6xl px-4 pt-14 sm:px-6 sm:pt-20">
        <nav aria-label="Breadcrumb" className="animate-fade-up text-center text-sm text-neutral-500">
          <Link href="/" className="hover:text-black dark:hover:text-white">Aoient</Link>
          <span className="mx-2">/</span>
          <span className="text-black dark:text-white">Download</span>
        </nav>
        <h1 className="animate-fade-up mx-auto mt-5 max-w-3xl text-balance text-center text-4xl font-bold tracking-tighter sm:text-6xl" style={{ animationDelay: "60ms" }}>
          Aoient on your desktop
        </h1>
        <p className="animate-fade-up mx-auto mt-5 max-w-2xl text-pretty text-center text-lg text-neutral-600 dark:text-neutral-400" style={{ animationDelay: "120ms" }}>
          A real app for Windows, macOS and Linux. Its own window and icon, one click to your workspace, and Google sign-in through your browser.
        </p>
        <div className="animate-fade-up mt-8 flex flex-col items-center gap-3" style={{ animationDelay: "180ms" }}>
          {release ? (
            <>
              <PrimaryDownload assets={release.assets} />
              <p className="text-center text-sm text-neutral-500">
                Version {release.version} · Free{release.publishedAt ? ` · Released ${date(release.publishedAt)}` : ""} · <a href="#desktop" className="underline underline-offset-4 hover:text-black dark:hover:text-white">All downloads</a>
              </p>
            </>
          ) : (
            <NotPublishedNotice />
          )}
        </div>
        <div className="animate-fade-up mt-14 -mb-px" style={{ animationDelay: "240ms" }}>
          <AppWindowMock />
        </div>
      </div>
    </section>
  );
}

function NotPublishedNotice() {
  return (
    <div className="max-w-lg rounded-xl border border-dashed border-neutral-300 px-5 py-4 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
      The first desktop build hasn&apos;t been published yet, so there&apos;s nothing to download today. Until then you can install Aoient from your browser.
      <div className="mt-3 flex justify-center">
        <InstallAppButton label="Install from the browser" className="rounded-lg bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200" />
      </div>
    </div>
  );
}

function HeroFallback() {
  return (
    <section className="border-b border-neutral-200 dark:border-neutral-900">
      <div className="mx-auto max-w-6xl px-4 pt-14 text-center sm:px-6 sm:pt-20">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tighter sm:text-6xl">Aoient on your desktop</h1>
        <div className="mx-auto mt-8 h-12 w-56 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- platforms */

function FileLink({ asset, label }: { asset?: DesktopAsset; label: string }) {
  if (!asset) return null;
  return (
    <a href={asset.url} className="group flex items-center justify-between gap-3 rounded-lg border border-neutral-300 px-4 py-3 text-sm transition-colors hover:border-black hover:bg-neutral-50 dark:border-neutral-700 dark:hover:border-white dark:hover:bg-neutral-900">
      <span className="grid min-w-0">
        <span className="font-semibold">{label}</span>
        <span className="truncate font-mono text-xs text-neutral-500">{asset.name} · {mb(asset.size)}</span>
      </span>
      <Download className="size-4 shrink-0 transition-transform group-hover:translate-y-0.5" aria-hidden />
    </a>
  );
}

function Platform({ name, needs, files, first, missing }: { name: string; needs: string; files: ReactNode; first: ReactNode; missing: boolean }) {
  return (
    <article className="flex flex-col border-t border-neutral-200 py-8 md:border-l md:border-t-0 md:px-8 md:first:border-l-0 md:first:pl-0 md:last:pr-0 dark:border-neutral-900">
      <h3 className="text-2xl font-bold tracking-tight">{name}</h3>
      <p className="mt-1 text-sm text-neutral-500">{needs}</p>
      <div className="mt-6 grid gap-2">
        {missing ? (
          <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-500 dark:border-neutral-700">Not published yet</p>
        ) : files}
      </div>
      <div className="mt-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-neutral-400">First time you open it</p>
        <div className="mt-2">{first}</div>
      </div>
    </article>
  );
}

function Platforms({ release }: { release: DesktopRelease | null }) {
  const a = release?.assets ?? {};
  return (
    <section id="desktop" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-neutral-500">Desktop</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Every download</h2>
          </div>
          {release && (
            <a href={release.pageUrl} className="text-sm text-neutral-600 underline underline-offset-4 hover:text-black dark:text-neutral-400 dark:hover:text-white">
              Release notes for {release.version}
            </a>
          )}
        </div>
        <div className="mt-10 grid md:grid-cols-3">
          <Platform
            name="Windows"
            needs="Windows 10 or 11, 64-bit"
            missing={!a.windows}
            files={<FileLink asset={a.windows} label="Installer (.exe)" />}
            first={<>Windows may show <b>&ldquo;Windows protected your PC&rdquo;</b>. Click <b>More info</b>, then <b>Run anyway</b>. It installs in seconds, with no admin password needed, and adds Aoient to the Start menu.</>}
          />
          <Platform
            name="macOS"
            needs="macOS 11 Big Sur or newer"
            missing={!a.macArm && !a.macIntel}
            files={<>
              <FileLink asset={a.macArm} label="Apple silicon (M1 and newer)" />
              <FileLink asset={a.macIntel} label="Intel processor" />
            </>}
            first={<>Open the .dmg and drag Aoient into <b>Applications</b>. If macOS says it can&apos;t check the app, open <b>System Settings → Privacy &amp; Security</b> and click <b>Open Anyway</b>.</>}
          />
          <Platform
            name="Linux"
            needs="64-bit (x86_64)"
            missing={!a.linuxAppImage && !a.linuxDeb}
            files={<>
              <FileLink asset={a.linuxDeb} label="Ubuntu / Debian (.deb)" />
              <FileLink asset={a.linuxAppImage} label="Any distribution (AppImage)" />
            </>}
            first={<>For the .deb, run <code className="rounded bg-neutral-100 px-1 font-mono text-xs dark:bg-neutral-900">sudo apt install ./Aoient-*.deb</code>. For the AppImage, mark it executable and open it. Google sign-in in the app needs the .deb version.</>}
          />
        </div>
        <p className="mt-8 max-w-3xl text-sm text-neutral-500">
          Why the warnings? The installers aren&apos;t signed with a paid Apple or Microsoft certificate yet, so your computer can&apos;t confirm who made them. They are built automatically from Aoient&apos;s public source code on GitHub.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ features */

const ADDS = [
  ["Its own window and icon", "Start menu, Dock or app launcher, with no browser tabs or address bar around your work."],
  ["One window, always", "Opening Aoient again brings back the window you already have, right where you left it."],
  ["Google sign-in through your browser", "Google doesn't allow sign-in inside desktop apps, so it opens in your browser and returns you to the app."],
  ["Always the latest Aoient", "The app shows live Aoient, so new features arrive instantly. On Windows and Linux (AppImage) the app also updates itself."],
  ["A clear offline screen", "If the connection drops you see a calm offline page that reconnects on its own."],
  ["Only Aoient inside", "Other links open in your normal browser. No camera, microphone or location access, and no workspace data saved on the computer."],
];

function Adds() {
  return (
    <section className="border-t border-neutral-200 bg-[#f7f7f5] dark:border-neutral-900 dark:bg-neutral-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_2fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-neutral-500">The app</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">What you get over a browser tab</h2>
        </div>
        <ol className="grid gap-x-10 sm:grid-cols-2">
          {ADDS.map(([t, b], i) => (
            <li key={t} className="border-t border-neutral-300 py-5 dark:border-neutral-800">
              <span className="font-mono text-xs text-neutral-400 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-1 font-semibold">{t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{b}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- phone */

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-4 grid gap-3">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 font-mono text-[11px] dark:border-neutral-700">{i + 1}</span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
}

function Phone() {
  return (
    <section id="phone" className="scroll-mt-20 border-t border-neutral-200 dark:border-neutral-900">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-neutral-500">Phone &amp; tablet</p>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Add it to your home screen</h2>
          <InstallAppButton label="Install on this device" className="rounded-lg bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200" />
        </div>
        <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
          There&apos;s no App Store or Play Store app yet. Your phone&apos;s browser can install Aoient with its own icon instead.
        </p>
        <div className="mt-10 grid gap-10 md:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
            <h3 className="text-lg font-semibold">Android</h3>
            <p className="text-sm text-neutral-500">Chrome, Edge or Samsung Internet</p>
            <Steps items={[<>Open this page in <b>Chrome</b> and tap the menu (⋮).</>, <>Tap <b>Install app</b> or <b>Add to Home screen</b>.</>, <>Tap <b>Install</b>. Aoient appears with your other apps.</>]} />
          </div>
          <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
            <h3 className="text-lg font-semibold">iPhone &amp; iPad</h3>
            <p className="text-sm text-neutral-500">Safari</p>
            <Steps items={[<>Open this page in <b>Safari</b> and tap <b>Share</b>.</>, <>Scroll down and tap <b>Add to Home Screen</b>.</>, <>Tap <b>Add</b>. Aoient appears on your home screen.</>]} />
          </div>
        </div>
      </div>
    </section>
  );
}

async function DesktopSections() {
  const release = await getDesktopRelease();
  return <Platforms release={release} />;
}

export default function DownloadPage() {
  return (
    <>
      <Suspense fallback={<HeroFallback />}>
        <Hero />
      </Suspense>
      <Suspense fallback={<div className="h-96" />}>
        <DesktopSections />
      </Suspense>
      <Adds />
      <Phone />
      <SlimCta title="New to Aoient?" body="Create a free workspace first, then sign in from the app." />
    </>
  );
}
