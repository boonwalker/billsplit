import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Optional accounts: an e-mail address stands for a device key, so the same person finds
 * their bills on any device. No password – a six-digit code goes to the address and is typed
 * in where the person is (a link in a mail would open Safari, never the home-screen app).
 * Accounts are kept next to the bills (accounts.json); codes only in memory.
 */

export const CODE_TTL_MS = 15 * 60 * 1000;
/** Wrong guesses per code before it stops working. */
const MAX_ATTEMPTS = 5;

export interface Account {
  email: string;
  /** The device key the account stands for (its participant id is derived from it). */
  key: string;
  /** Name and ways to get paid, so a new device gets them back. */
  profile: Record<string, string>;
  createdAt: string;
}

interface PendingCode {
  hash: Buffer;
  expires: number;
  attempts: number;
}

export type VerifyResult = { ok: true } | { ok: false; reason: "expired" | "wrong" };

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const hashCode = (email: string, code: string) => createHash("sha256").update(`${email}:${code}`).digest();

export class AccountStore {
  private byEmail = new Map<string, Account>();
  private codes = new Map<string, PendingCode>();
  private saveTimer: NodeJS.Timeout | null = null;

  /** file: where the accounts are kept (null: in memory only, for tests). */
  constructor(
    private readonly file: string | null,
    private readonly now: () => number = Date.now,
  ) {}

  async load(): Promise<void> {
    if (!this.file) return;
    try {
      const list = JSON.parse(await readFile(this.file, "utf8")) as Account[];
      this.byEmail = new Map(list.map((a) => [a.email, a]));
    } catch {
      // No accounts yet.
    }
  }

  get count(): number {
    return this.byEmail.size;
  }

  /** Every account, newest first (admin page). */
  all(): Account[] {
    return [...this.byEmail.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  byKey(key: string): Account | null {
    for (const account of this.byEmail.values()) if (account.key === key) return account;
    return null;
  }

  get(email: string): Account | null {
    return this.byEmail.get(normalizeEmail(email)) ?? null;
  }

  /** A fresh code for the address (replaces an older one). */
  newCode(email: string): string {
    this.prune();
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const address = normalizeEmail(email);
    this.codes.set(address, { hash: hashCode(address, code), expires: this.now() + CODE_TTL_MS, attempts: 0 });
    return code;
  }

  /** Checks a code; a correct one works once. */
  verify(email: string, code: string): VerifyResult {
    const address = normalizeEmail(email);
    const pending = this.codes.get(address);
    if (!pending || pending.expires < this.now() || pending.attempts >= MAX_ATTEMPTS) {
      this.codes.delete(address);
      return { ok: false, reason: "expired" };
    }
    if (!timingSafeEqual(pending.hash, hashCode(address, code.trim()))) {
      pending.attempts++;
      return { ok: false, reason: pending.attempts >= MAX_ATTEMPTS ? "expired" : "wrong" };
    }
    this.codes.delete(address);
    return { ok: true };
  }

  create(email: string, key: string, profile: Record<string, string>): Account {
    const account: Account = { email: normalizeEmail(email), key, profile, createdAt: new Date(this.now()).toISOString() };
    this.byEmail.set(account.email, account);
    this.scheduleSave();
    return account;
  }

  setProfile(key: string, profile: Record<string, string>): boolean {
    const account = this.byKey(key);
    if (!account) return false;
    account.profile = profile;
    this.scheduleSave();
    return true;
  }

  /** Removes the account (the bills stay with the device key, as before there was an account). */
  remove(key: string): boolean {
    const account = this.byKey(key);
    if (!account) return false;
    this.byEmail.delete(account.email);
    this.scheduleSave();
    return true;
  }

  async flush(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    await this.write();
  }

  private prune(): void {
    const now = this.now();
    for (const [email, pending] of this.codes) if (pending.expires < now) this.codes.delete(email);
  }

  private scheduleSave(): void {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.write();
    }, 300);
  }

  private async write(): Promise<void> {
    if (!this.file) return;
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(`${this.file}.tmp`, JSON.stringify([...this.byEmail.values()]));
    await rename(`${this.file}.tmp`, this.file);
  }
}
