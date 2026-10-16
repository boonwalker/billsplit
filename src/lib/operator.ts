/** Who runs klicksplit (imprint, privacy policy): set on the server, see server/operator.ts. */
export interface Operator {
  name: string;
  address: string[];
  email: string;
}

export function loadOperator(): Operator | null {
  const raw = typeof document === "undefined" ? null : document.querySelector<HTMLMetaElement>('meta[name="klicksplit-operator"]')?.content;
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<Operator>;
    return { name: o.name ?? "", address: Array.isArray(o.address) ? o.address : [], email: o.email ?? "" };
  } catch {
    return null;
  }
}
