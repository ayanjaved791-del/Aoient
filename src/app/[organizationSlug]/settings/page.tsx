import { redirect } from "next/navigation";

export default async function SettingsIndex({ params }: PageProps<"/[organizationSlug]/settings">) {
  const { organizationSlug } = await params;
  redirect(`/${organizationSlug}/settings/general`);
}
