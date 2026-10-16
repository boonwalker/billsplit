/**
 * Who runs klicksplit, for the imprint and the privacy policy (src/pages/Legal.tsx): from the
 * environment, so name and address are set on Railway and never stored in the repository.
 * - OPERATOR_NAME: e.g. "Niklas Muster"
 * - OPERATOR_ADDRESS: lines separated by "|" or ",", e.g. "Musterstraße 1, 12345 Berlin"
 * - OPERATOR_EMAIL: contact address
 */
export interface Operator {
  name: string;
  address: string[];
  email: string;
}

export function operatorFromEnv(env: Record<string, string | undefined> = process.env): Operator | null {
  const name = env.OPERATOR_NAME?.trim() ?? "";
  const email = env.OPERATOR_EMAIL?.trim() ?? "";
  const address = (env.OPERATOR_ADDRESS ?? "")
    .split(/[|,]/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!name && !email && !address.length) return null;
  return { name, address, email };
}

const escapeAttr = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The operator as a meta tag in every page (read by src/lib/operator.ts). */
export const operatorMeta = (operator: Operator): string => `<meta name="klicksplit-operator" content="${escapeAttr(JSON.stringify(operator))}">`;
