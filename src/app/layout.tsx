import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { NetworkStatus } from "@/components/network/network-status";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Aoient — One Platform. Your Entire Business.", template: "%s · Aoient" },
  description: "Aoient is the business operating system for service companies: people, CRM, projects, time, finance and operations in one connected workspace.",
  applicationName: "Aoient",
  appleWebApp: { capable: true, title: "Aoient", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full">
        {/* Before first paint: keep the workspace sidebar closed if the person closed it. */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("aoient-nav")==="closed")document.documentElement.dataset.nav="closed"}catch(e){}` }} />
        <ThemeProvider>
          {children}
          <Toaster />
          <PwaRegister />
          <NetworkStatus />
        </ThemeProvider>
      </body>
    </html>
  );
}
