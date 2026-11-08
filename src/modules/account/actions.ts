"use server";
import { requireUser } from "@/server/auth/session";
import { runAction } from "@/server/actions/run";
import { changeEmail, changeName, changePassword } from "@/server/account/account";
import { enforceRateLimit } from "@/server/rate-limit/limiter";
import { removeMyAvatar, setMyAvatar } from "@/server/media/media";

export async function changePasswordAction(input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    await enforceRateLimit(`account-password:${user.id}`, { max: 10, windowSeconds: 900 });
    await changePassword(user, input);
  });
}
export async function changeNameAction(input: unknown) {
  return runAction(async () => changeName(await requireUser(), input));
}
export async function changeEmailAction(input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    await enforceRateLimit(`account-email:${user.id}`, { max: 5, windowSeconds: 3600 });
    return changeEmail(user, input);
  });
}

/** Profile picture: always your own; the user comes from the session, never the form. */
export async function uploadAvatarAction(form: FormData) {
  return runAction(async () => setMyAvatar((await requireUser()).id, form.get("file")));
}
export async function removeAvatarAction() {
  return runAction(async () => removeMyAvatar((await requireUser()).id));
}
