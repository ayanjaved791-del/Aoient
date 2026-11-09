"use server";
/**
 * Projects server actions. Each re-authenticates, re-resolves the workspace from
 * the slug (membership verified on the server), then calls the service, which
 * checks the permission and that the project is visible to this person.
 */
import { refresh } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { resolveOrgContext } from "@/server/tenancy/context";
import { runAction } from "@/server/actions/run";
import { createMilestone, createProject, createProjectFromDeal, deleteMilestone, setMilestoneDone, setProjectArchived, updateMilestone, updateProject } from "@/server/projects/projects";
import { addComment, createTask, deleteComment, deleteTask, moveTask, updateTask } from "@/server/projects/tasks";

async function ctxFor(slug: string) {
  const user = await requireUser();
  return resolveOrgContext(user.id, { slug: String(slug) });
}
const done = <T>(v: T) => { refresh(); return v; };

export async function createProjectAction(slug: string, input: unknown) {
  return runAction(async () => done(await createProject(await ctxFor(slug), input)));
}
export async function updateProjectAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateProject(await ctxFor(slug), String(id), input)));
}
export async function setProjectArchivedAction(slug: string, id: string, archived: boolean) {
  return runAction(async () => done(await setProjectArchived(await ctxFor(slug), String(id), archived === true)));
}
export async function createProjectFromDealAction(slug: string, dealId: string) {
  return runAction(async () => done(await createProjectFromDeal(await ctxFor(slug), String(dealId))));
}
export async function createMilestoneAction(slug: string, projectId: string, input: unknown) {
  return runAction(async () => done(await createMilestone(await ctxFor(slug), String(projectId), input)));
}
export async function updateMilestoneAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateMilestone(await ctxFor(slug), String(id), input)));
}
export async function setMilestoneDoneAction(slug: string, id: string, isDone: boolean) {
  return runAction(async () => done(await setMilestoneDone(await ctxFor(slug), String(id), isDone === true)));
}
export async function deleteMilestoneAction(slug: string, id: string) {
  return runAction(async () => done(await deleteMilestone(await ctxFor(slug), String(id))));
}
export async function createTaskAction(slug: string, projectId: string, input: unknown) {
  return runAction(async () => done(await createTask(await ctxFor(slug), String(projectId), input)));
}
export async function updateTaskAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await updateTask(await ctxFor(slug), String(id), input)));
}
export async function moveTaskAction(slug: string, id: string, input: unknown) {
  return runAction(async () => done(await moveTask(await ctxFor(slug), String(id), input)));
}
export async function deleteTaskAction(slug: string, id: string) {
  return runAction(async () => done(await deleteTask(await ctxFor(slug), String(id))));
}
export async function addCommentAction(slug: string, taskId: string, input: unknown) {
  return runAction(async () => done(await addComment(await ctxFor(slug), String(taskId), input)));
}
export async function deleteCommentAction(slug: string, id: string) {
  return runAction(async () => done(await deleteComment(await ctxFor(slug), String(id))));
}
