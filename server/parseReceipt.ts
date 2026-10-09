import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ParsedReceipt } from "../src/lib/receipt.ts";

const DEFAULT_MODEL = "claude-opus-5-5";

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type ReceiptMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export function isSupportedMediaType(type: string): type is ReceiptMediaType {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(type);
}

const ReceiptSchema = z.object({
  merchant: z.string(),
  date: z.string(),
  currency: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().int(),
      line_total: z.number(),
    }),
  ),
  receipt_total: z.number(),
});

type ReceiptOutput = z.infer<typeof ReceiptSchema>;

/** JSON schema for structured outputs; mirrors ReceiptSchema above. */
const RECEIPT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["merchant", "date", "currency", "items", "receipt_total"],
  properties: {
    merchant: { type: "string", description: "Name of the restaurant or shop, empty if not printed." },
    date: { type: "string", description: "Date of the receipt as YYYY-MM-DD, empty if not printed." },
    currency: { type: "string", description: "ISO 4217 currency code, e.g. EUR." },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "line_total"],
        properties: {
          name: { type: "string", description: "Item name as printed, without quantity or price." },
          quantity: { type: "integer", description: "Number of units on this line (at least 1)." },
          line_total: { type: "number", description: "Price of the whole line (quantity × unit price), negative for discounts." },
        },
      },
    },
    receipt_total: { type: "number", description: "Grand total printed on the receipt, 0 if not readable." },
  },
} as const;

const INSTRUCTIONS = `This is a photo of a restaurant or shop receipt. Extract every purchased line item so that a group can split the bill.

- One entry per receipt line. Keep the item name as printed, but remove quantity prefixes ("2x", "3 x") and unit-price annotations ("à 4,50", "@ 4.50") from the name.
- quantity is the number of units on the line. Receipts show it in many ways: "3 Bier 13,50", "3x Bier", "Bier 3 x 4,50 13,50", or a separate line like "3 x 4,50" above or below the item. If no quantity is shown, use 1.
- line_total is the price of the whole line (all units together). If only a unit price is printed, multiply it by the quantity.
- Include discounts, vouchers and deposit refunds as items with a negative line_total. Include service charges that are part of the total.
- Do not include subtotals, totals, taxes/VAT breakdowns, payment method lines, change given, tips written after payment, or table/waiter/date information.
- Use a dot as decimal separator in numbers, regardless of how the receipt prints them.
- If the image is not a receipt or is unreadable, return an empty items list.`;

export class ReceiptParseError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let client: Anthropic | null = null;

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function toParsedReceipt(out: ReceiptOutput): ParsedReceipt {
  return {
    merchant: out.merchant.trim(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(out.date) ? out.date : "",
    currency: /^[A-Z]{3}$/.test(out.currency) ? out.currency : "EUR",
    items: out.items
      .filter((it) => it.name.trim() && Number.isFinite(it.line_total))
      .map((it) => ({ name: it.name.trim(), qty: Math.max(1, it.quantity), total: toCents(it.line_total) })),
    total: out.receipt_total > 0 ? toCents(out.receipt_total) : null,
    engine: "ai",
  };
}

/** Reads a receipt photo with Claude and returns its line items. */
export async function parseReceiptImage(base64: string, mediaType: ReceiptMediaType): Promise<ParsedReceipt> {
  client ??= new Anthropic();

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: process.env.BILLSPLIT_MODEL || DEFAULT_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: RECEIPT_JSON_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: INSTRUCTIONS },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new ReceiptParseError("Der API-Schlüssel für die Belegerkennung ist ungültig.", 503);
    } else if (error instanceof Anthropic.RateLimitError) {
      throw new ReceiptParseError("Die Belegerkennung ist gerade ausgelastet. Bitte gleich nochmal versuchen.", 429);
    } else if (error instanceof Anthropic.BadRequestError) {
      throw new ReceiptParseError("Das Bild konnte nicht verarbeitet werden.", 400);
    } else if (error instanceof Anthropic.APIError) {
      throw new ReceiptParseError(`Belegerkennung fehlgeschlagen (${error.status ?? "Netzwerk"}).`, 502);
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new ReceiptParseError("Das Bild wurde von der Belegerkennung abgelehnt.", 422);
  }
  if (response.stop_reason === "max_tokens") {
    throw new ReceiptParseError("Der Beleg ist zu lang für die automatische Erkennung.", 422);
  }

  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ReceiptParseError("Die Belegerkennung lieferte keine gültige Antwort.", 502);
  }
  const parsed = ReceiptSchema.safeParse(json);
  if (!parsed.success) {
    throw new ReceiptParseError("Die Belegerkennung lieferte keine gültige Antwort.", 502);
  }
  return toParsedReceipt(parsed.data);
}
