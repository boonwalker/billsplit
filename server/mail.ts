/**
 * Sending the sign-in codes. With RESEND_API_KEY and MAIL_FROM (e.g. "klicksplit
 * <code@klicksplit.de>") the mail goes out through Resend; without them the code is only
 * written to the log, so everything can be tried before the mail service is set up (and, for
 * the click tests, to the file MAIL_OUTBOX).
 */

import { appendFile } from "node:fs/promises";

export type SendCode = (email: string, code: string) => Promise<void>;

/** The sender's display name ("klicksplit" in "klicksplit <code@klicksplit.de>"), used in the text too. */
export function senderName(from: string | undefined): string {
  const name = from?.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim();
  return name || "klicksplit";
}

export function codeMail(code: string, from: string | undefined): { subject: string; text: string; html: string } {
  const name = senderName(from);
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  return {
    subject: `Dein ${name}-Code: ${spaced}`,
    text: `Hallo!\n\nDein Code für ${name} lautet: ${spaced}\n\nEr gilt 15 Minuten. Wenn Du keinen Code angefordert hast, kannst Du diese Mail einfach ignorieren.\n`,
    html: `<p>Hallo!</p><p>Dein Code für ${name} lautet:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;font-family:monospace">${spaced}</p><p>Er gilt 15 Minuten. Wenn Du keinen Code angefordert hast, kannst Du diese Mail einfach ignorieren.</p>`,
  };
}

export function mailerFromEnv(): SendCode {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!apiKey || !from) {
    const outbox = process.env.MAIL_OUTBOX;
    return async (email, code) => {
      console.log(`[Mail] Kein Mail-Dienst eingerichtet (RESEND_API_KEY, MAIL_FROM) – Code für ${email}: ${code}`);
      if (outbox) await appendFile(outbox, `${JSON.stringify({ email, code })}\n`);
    };
  }
  return async (email, code) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [email], ...codeMail(code, from) }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  };
}
