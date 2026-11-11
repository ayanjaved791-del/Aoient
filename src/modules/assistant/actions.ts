"use server";
import { refresh } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { resolveOrgContext } from "@/server/tenancy/context";
import { runAction } from "@/server/actions/run";
import { enforceRateLimit } from "@/server/rate-limit/limiter";
import { answerQuestion, resolveProposal } from "@/server/assistant/answer";
import { ValidationError } from "@/lib/errors";

/**
 * Ask the workspace assistant. The organization comes from the slug and is
 * re-verified against the signed-in user's membership on every question.
 */
export async function askAssistantAction(slug: string, question: string) {
  return runAction(async () => {
    const user = await requireUser();
    const ctx = await resolveOrgContext(user.id, { slug: String(slug) });
    const q = String(question ?? "").trim();
    if (!q) throw new ValidationError("Type a question first.");
    if (q.length > 300) throw new ValidationError("Keep questions under 300 characters.");
    await enforceRateLimit(`assistant:${user.id}`, { max: 60, windowSeconds: 300 });
    const answer = await answerQuestion(ctx, q);
    // A typed "yes" may have just changed something: refresh the page behind the chat.
    if (answer.done) refresh();
    return answer;
  });
}

/** Confirm or cancel a change the assistant proposed. Only the person who asked, in this workspace, within 10 minutes. */
export async function resolveAssistantProposalAction(slug: string, id: string, confirm: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    const ctx = await resolveOrgContext(user.id, { slug: String(slug) });
    await enforceRateLimit(`assistant:${user.id}`, { max: 60, windowSeconds: 300 });
    const answer = await resolveProposal(ctx, String(id), confirm === true);
    refresh();
    return answer;
  });
}
