import { msg, translateMsg, type Lang } from "../src/i18n/index.ts";

/**
 * Link previews (WhatsApp, iMessage, Telegram, …): Open Graph tags in the page. Bill links
 * (`/b/<id>`, see billUrl) show the bill's title and who paid – no amounts, nothing more than
 * opening the link shows anyway. The picture is public/og.png (made with e2e/ogimage.mjs).
 */
export interface PreviewBill {
  title: string;
  ownerName: string;
}

const escapeAttr = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The bill id of a shared bill link's path, or null. */
export function previewBillId(pathname: string): string | null {
  return pathname.match(/^\/b\/([A-Za-z0-9_-]{6,40})\/?$/)?.[1] ?? null;
}

export function previewMeta(origin: string, path: string, lang: Lang, bill: PreviewBill | null): string {
  const title = bill
    ? translateMsg(lang, bill.ownerName.trim() ? msg("{title} · {name} hat bezahlt", { title: bill.title, name: bill.ownerName.trim() }) : msg("{title} · klicksplit", { title: bill.title }))
    : translateMsg(lang, msg("klicksplit – Einer zahlt. Alle splitten."));
  const description = bill
    ? translateMsg(lang, msg("Hake ab, was Du hattest, und begleiche Deinen Anteil mit einem Tipp – mit klicksplit."))
    : translateMsg(lang, msg("Beleg fotografieren, per QR-Code teilen – jeder hakt ab, was er hatte, und zahlt seinen Anteil per PayPal."));
  const tags: [string, string, string][] = [
    ["property", "og:type", "website"],
    ["property", "og:site_name", "klicksplit"],
    ["property", "og:title", title],
    ["property", "og:description", description],
    ["property", "og:url", `${origin}${path}`],
    ["property", "og:image", `${origin}/og.png`],
    ["property", "og:image:width", "1200"],
    ["property", "og:image:height", "630"],
    ["name", "twitter:card", "summary_large_image"],
  ];
  return tags.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeAttr(value)}">`).join("");
}
