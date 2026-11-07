/** Settings pages are reached from the workspace sidebar (or the drawer on phones). */
export default function SettingsLayout({ children }: LayoutProps<"/[organizationSlug]/settings">) {
  return <div className="min-w-0">{children}</div>;
}
