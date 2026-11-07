"use server";
import { requireUser } from "@/server/auth/session";
import { assertPermission, resolveOrgContext } from "@/server/tenancy/context";
import { runAction } from "@/server/actions/run";
import { getDb, transaction } from "@/server/database/client";
import { signCheckout } from "@/server/billing/checkout-token";
import { hasLivePaidSubscription, loadLicense } from "@/server/billing/license";
import { recordAcceptance } from "@/server/legal/acceptance";
import { ConflictError, ValidationError } from "@/lib/errors";

/**
 * Step before payment: the buyer agrees to the Terms and Privacy Policy, we
 * record it, and only then hand out the signed checkout token. Without that
 * token a Paddle subscription can't be attached to the workspace, so the
 * agreement is enforced on the server, not just by the checkbox.
 */
export async function startCheckoutAction(slug: string, acceptTerms: boolean) {
  return runAction(async () => {
    if (acceptTerms !== true) throw new ValidationError("Please agree to the Terms of Service and Privacy Policy before paying.");
    const user = await requireUser();
    const ctx = await resolveOrgContext(user.id, { slug: String(slug) });
    assertPermission(ctx, "billing.manage");
    if (hasLivePaidSubscription(await loadLicense(getDb(), ctx.organizationId))) {
      throw new ConflictError("This workspace already has an active subscription. Manage it from Billing & plan.");
    }
    const token = signCheckout(ctx.organizationId, user.id);
    if (!token) throw new ConflictError("Checkout isn't configured on the server yet.");
    await transaction((tx) => recordAcceptance(tx, { userId: user.id, organizationId: ctx.organizationId, context: "checkout" }));
    return { checkoutToken: token };
  });
}
