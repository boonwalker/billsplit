import { mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BACKUP_DAYS, dailyBackup, openPersistence } from "../server/persistence";
import { BillStore } from "../server/store";
import type { BillData } from "../src/lib/bill";

const data: BillData = {
  title: "Trattoria",
  date: "",
  currency: "EUR",
  tipPercent: 0,
  payment: { paypalMe: "nik" },
  items: [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }],
};

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  );

for (const sqlite of [true, false]) {
  describe(`storage (${sqlite ? "SQLite" : "JSON file"})`, () => {
    it("keeps bills and settlement payments across restarts", async () => {
      const dir = await mkdtemp(join(tmpdir(), "billsplit-"));
      const file = join(dir, "bills.json");
      const store = new BillStore(file, { sqlite });
      await store.load();
      expect(store.storage).toBe(sqlite ? "sqlite" : "json");
      const id = store.createBill(data, "owner", "Niklas");
      store.join(id, "anna", "Anna");
      store.setClaims(id, "anna", { pizza: [0] });
      store.createTransfer("anna", { toId: "owner", amount: 950, currency: "EUR", allocations: [{ billId: id, debtorId: "anna", creditorId: "owner", amount: 950 }] });
      await store.flush();
      store.close();

      const again = new BillStore(file, { sqlite });
      await again.load();
      expect(again.snapshot(id, "owner").debtors?.[0]).toMatchObject({ name: "Anna", creditPending: 950 });
      expect(again.listTransfers("owner")).toHaveLength(1);
      expect(await exists(join(dir, "billsplit.db"))).toBe(sqlite);
      again.close();
    });
  });
}

describe("moving from the JSON file to SQLite", () => {
  it("imports bills.json once and keeps it as bills.json.imported", async () => {
    const dir = await mkdtemp(join(tmpdir(), "billsplit-"));
    const file = join(dir, "bills.json");
    const old = new BillStore(file, { sqlite: false });
    await old.load();
    const id = old.createBill(data, "owner", "Niklas");
    await old.flush();

    const store = new BillStore(file);
    await store.load();
    expect(store.snapshot(id, "owner").data.title).toBe("Trattoria");
    expect(await exists(file)).toBe(false);
    expect(await exists(`${file}.imported`)).toBe(true);
    store.close();
  });
});

describe("backups", () => {
  it("writes one copy per day and keeps two weeks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "billsplit-"));
    const persistence = await openPersistence(join(dir, "bills.json"));
    const backups = join(dir, "backups");
    for (let day = 1; day <= BACKUP_DAYS + 3; day++) {
      await writeFile(join(dir, "marker"), String(day));
      await dailyBackup(persistence, backups, new Date(Date.UTC(2026, 9, day, 12)));
    }
    expect(await dailyBackup(persistence, backups, new Date(Date.UTC(2026, 9, BACKUP_DAYS + 3, 18)))).toBeNull();
    const files = (await readdir(backups)).sort();
    expect(files).toHaveLength(BACKUP_DAYS);
    expect(files[0]).toBe("billsplit-2026-10-04.db");
    expect(files.at(-1)).toBe(`billsplit-2026-10-${BACKUP_DAYS + 3}.db`);
    persistence.close();
  });
});
