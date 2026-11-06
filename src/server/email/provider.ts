import "server-only";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Provider-agnostic interface (spec §21). Add real providers as new adapters. */
export interface EmailProvider {
  readonly name: string;
  /** Whether messages actually leave the server. The console adapter does not. */
  readonly deliversExternally: boolean;
  send(message: EmailMessage): Promise<void>;
}

/**
 * Development adapter: prints the email to the server log instead of sending.
 * Links (verification, reset, invitations) can be copied from the terminal.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  readonly deliversExternally = false;
  async send(message: EmailMessage): Promise<void> {
    if (process.env.NODE_ENV === "test") return;
    console.info(
      [
        "",
        "┌─ ✉  Email (console provider — not delivered) ─────────────",
        `│ To:      ${message.to}`,
        `│ Subject: ${message.subject}`,
        "│",
        ...message.text.split("\n").map((l) => `│ ${l}`),
        "└────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  }
}

let provider: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  const selected = process.env.EMAIL_PROVIDER ?? "console";
  switch (selected) {
    case "console":
      provider = new ConsoleEmailProvider();
      break;
    default:
      throw new Error(`EMAIL_PROVIDER "${selected}" is not supported yet. Supported: console.`);
  }
  return provider;
}

/** Test hook. */
export function setEmailProvider(p: EmailProvider | undefined) {
  provider = p;
}
