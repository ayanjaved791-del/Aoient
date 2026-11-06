import "server-only";
import type { EmailMessage } from "./provider";

export function verifyEmailMessage(to: string, name: string, url: string): EmailMessage {
  return {
    to,
    subject: "Verify your email for Aoient",
    text: `Hi ${name},\n\nConfirm your email address to finish setting up your Aoient account:\n${url}\n\nThis link expires in 1 hour. If you did not sign up, you can ignore this email.`,
  };
}

export function resetPasswordMessage(to: string, url: string): EmailMessage {
  return {
    to,
    subject: "Reset your Aoient password",
    text: `We received a request to reset your password.\n\nReset it here:\n${url}\n\nThis link expires in 1 hour and can only be used once. If you did not request this, you can ignore this email — your password will not change.`,
  };
}

export function invitationMessage(params: {
  to: string;
  organizationName: string;
  inviterName: string;
  roleName: string;
  url: string;
  expiresAt: Date;
}): EmailMessage {
  return {
    to: params.to,
    subject: `${params.inviterName} invited you to ${params.organizationName} on Aoient`,
    text: `${params.inviterName} invited you to join ${params.organizationName} on Aoient as ${params.roleName}.\n\nAccept the invitation:\n${params.url}\n\nThis invitation expires on ${params.expiresAt.toUTCString()} and can only be used once.`,
  };
}
