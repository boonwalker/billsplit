import { describe, expect, it } from "vitest";
import { parseEcbXml, RateService } from "../server/rates";
import { mergeBalances, type Balances } from "../src/lib/balances";
import { convert, type Rates } from "../src/lib/currency";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <gesmes:subject>Reference rates</gesmes:subject>
  <Cube>
    <Cube time='2026-10-15'>
      <Cube currency='USD' rate='1.0800'/>
      <Cube currency='GBP' rate='0.8500'/>
      <Cube currency='CHF' rate='0.9400'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

const rates: Rates = { date: "2026-10-15", source: "ECB", rates: { EUR: 1, USD: 1.08, GBP: 0.85 } };

describe("exchange rates", () => {
  it("reads the ECB's daily reference rates", () => {
    expect(parseEcbXml(XML)).toEqual({ date: "2026-10-15", source: "ECB", rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.94 } });
    expect(parseEcbXml("<html>Fehler</html>")).toBeNull();
  });

  it("fetches once and keeps the last rates when the ECB is not reachable", async () => {
    let now = 0;
    let calls = 0;
    let fail = false;
    const service = new RateService(
      null,
      async () => {
        calls++;
        if (fail) throw new Error("offline");
        return XML;
      },
      () => now,
    );
    expect((await service.get())?.rates.USD).toBe(1.08);
    await service.get();
    expect(calls).toBe(1);
    now += 5 * 60 * 60 * 1000;
    fail = true;
    expect((await service.get())?.date).toBe("2026-10-15");
    expect(calls).toBe(2);
  });

  it("converts through the euro", () => {
    expect(convert(1080, "USD", "EUR", rates)).toBe(1000);
    expect(convert(1000, "EUR", "GBP", rates)).toBe(850);
    expect(convert(1080, "USD", "GBP", rates)).toBe(850);
    expect(convert(500, "XYZ", "EUR", rates)).toBeNull();
  });

  it("adds up the balances of all currencies in the home currency", () => {
    const list: Balances[] = [
      { currency: "EUR", lent: 1000, owed: 0, unassigned: 0, people: [{ id: "anna", name: "Anna", lent: 1000, owed: 0, bills: 1, entries: [] }] },
      {
        currency: "USD",
        lent: 0,
        owed: 2160,
        unassigned: 0,
        people: [
          { id: "anna", name: "Anna", lent: 0, owed: 540, bills: 1, entries: [] },
          { id: "ben", name: "Ben", lent: 0, owed: 1620, bills: 1, entries: [] },
        ],
      },
    ];
    const merged = mergeBalances(list, "EUR", rates)!;
    expect([merged.currency, merged.lent, merged.owed, merged.ratesDate]).toEqual(["EUR", 1000, 2000, "2026-10-15"]);
    expect(merged.people.map((p) => [p.name, p.lent, p.owed])).toEqual([
      ["Ben", 0, 1500],
      ["Anna", 1000, 500],
    ]);
    // Settling happens in a bill's own currency: Anna mostly in euro.
    expect(merged.mainCurrency).toEqual({ anna: "EUR", ben: "USD" });
    // Only the home currency: nothing to add up.
    expect(mergeBalances([list[0]], "EUR", rates)).toBeNull();
  });
});
