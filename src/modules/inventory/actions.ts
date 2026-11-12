"use server";
/**
 * Inventory server actions. Each re-authenticates, re-resolves the workspace
 * from the slug (membership verified on the server), then calls the service,
 * which checks the permission and scopes every id to the verified organization.
 */
import { refresh } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { resolveOrgContext } from "@/server/tenancy/context";
import { runAction } from "@/server/actions/run";
import {
  createLocation, createProduct, recordMovement, setLocationArchived, setProductArchived, transferStock, updateLocation, updateProduct,
} from "@/server/inventory/inventory";

async function ctxFor(slug: string) {
  const user = await requireUser();
  return resolveOrgContext(user.id, { slug: String(slug) });
}
const done = <T>(v: T) => { refresh(); return v; };

export async function createProductAction(slug: string, input: unknown) {
  return runAction(async () => done(await createProduct(await ctxFor(slug), input)));
}
export async function updateProductAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateProduct(await ctxFor(slug), String(id), input)));
}
export async function setProductArchivedAction(slug: string, id: string, archived: boolean) {
  return runAction(async () => done(await setProductArchived(await ctxFor(slug), String(id), archived === true)));
}
export async function createLocationAction(slug: string, input: unknown) {
  return runAction(async () => done(await createLocation(await ctxFor(slug), input)));
}
export async function updateLocationAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateLocation(await ctxFor(slug), String(id), input)));
}
export async function setLocationArchivedAction(slug: string, id: string, archived: boolean) {
  return runAction(async () => done(await setLocationArchived(await ctxFor(slug), String(id), archived === true)));
}
export async function recordMovementAction(slug: string, input: unknown) {
  return runAction(async () => done(await recordMovement(await ctxFor(slug), input)));
}
export async function transferStockAction(slug: string, input: unknown) {
  return runAction(async () => done(await transferStock(await ctxFor(slug), input)));
}
