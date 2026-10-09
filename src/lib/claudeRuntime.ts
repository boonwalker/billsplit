/** Minimal typing of the claude.ai artifact runtime used by the demo build. */
export interface SampleError {
  code: string;
  message: string;
  text?: string;
}

export interface SampleFn {
  json<T = unknown>(input: string, options?: { images?: Blob[]; modelTier?: "quick" | "default" | "complex"; cache?: boolean }): Promise<T>;
  limits(): Promise<{ images?: { maxCount: number; mediaTypes: string[] } }>;
}

declare global {
  interface Window {
    claude?: { use(name: "sample"): Promise<SampleFn | null> };
  }
}

export async function getSample(): Promise<SampleFn | null> {
  try {
    return (await window.claude?.use("sample")) ?? null;
  } catch {
    return null;
  }
}
