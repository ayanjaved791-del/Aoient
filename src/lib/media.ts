/**
 * Image URLs carry the picture's version, so a new picture shows at once and
 * an unchanged one can be cached. Null means "no picture": show initials.
 */
const v = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : null);

export function orgLogoUrl(organizationId: string, updatedAt: Date | string | null | undefined): string | null {
  const ver = v(updatedAt);
  return ver ? `/api/media/org-logo/${organizationId}?v=${ver}` : null;
}

export function avatarUrl(userId: string, updatedAt: Date | string | null | undefined): string | null {
  const ver = v(updatedAt);
  return ver ? `/api/media/avatar/${userId}?v=${ver}` : null;
}
