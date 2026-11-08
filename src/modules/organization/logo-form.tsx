"use client";
import { ImageUpload } from "@/components/media/image-upload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { removeOrganizationLogoAction, uploadOrganizationLogoAction } from "./actions";

export function OrganizationLogoForm({ slug, name, currentUrl, canEdit }: { slug: string; name: string; currentUrl: string | null; canEdit: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo</CardTitle>
        <CardDescription>Shown to your members in the workspace header and switcher. Only members can see it.</CardDescription>
      </CardHeader>
      <CardContent>
        <ImageUpload
          currentUrl={currentUrl}
          fallback={name.slice(0, 1).toUpperCase()}
          shape="square"
          label="Logo"
          hint="PNG, JPG or WebP. A square logo with a little space around it looks best."
          disabled={!canEdit}
          disabledReason="Only people who can edit organization settings can change the logo."
          upload={(form) => uploadOrganizationLogoAction(slug, form)}
          remove={() => removeOrganizationLogoAction(slug)}
        />
      </CardContent>
    </Card>
  );
}
