import { describe, expect, it } from "vitest";
import { DEVICE_LINK_TTL_MS, DeviceLinks } from "../server/deviceLink";
import { deviceCodeFromUrl, deviceLinkUrl } from "../src/lib/deviceTransfer";

describe("moving to a new device", () => {
  it("trades a code for the key once, and only for a few minutes", () => {
    let now = 1_000_000;
    const links = new DeviceLinks(() => now);
    const { code } = links.create({ key: "key-1234567890abcdef", profile: { name: "Niklas" } });
    expect(code).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(links.claim(code)).toEqual({ key: "key-1234567890abcdef", profile: { name: "Niklas" } });
    expect(links.claim(code)).toBeNull();

    const late = links.create({ key: "key-1234567890abcdef", profile: {} }).code;
    now += DEVICE_LINK_TTL_MS + 1;
    expect(links.claim(late)).toBeNull();
  });

  it("keeps only the newest code of a device", () => {
    const links = new DeviceLinks();
    const first = links.create({ key: "key-1234567890abcdef", profile: {} }).code;
    const second = links.create({ key: "key-1234567890abcdef", profile: {} }).code;
    expect(links.claim(first)).toBeNull();
    expect(links.claim(second)).not.toBeNull();
  });

  it("finds the code in the link from the QR code", () => {
    const url = deviceLinkUrl("abcdefghijklmnopqrstuvwx", "https://billsplit.example/#/profile");
    expect(url).toBe("https://billsplit.example/#/geraet/abcdefghijklmnopqrstuvwx");
    expect(deviceCodeFromUrl(url)).toBe("abcdefghijklmnopqrstuvwx");
    expect(deviceCodeFromUrl("https://billsplit.example/#/b/abcdefgh")).toBeNull();
  });
});
