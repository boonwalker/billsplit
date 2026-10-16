import { describe, expect, it } from "vitest";
import { operatorFromEnv, operatorMeta } from "../server/operator";

describe("operator for imprint and privacy policy", () => {
  it("reads name, address lines and e-mail from the environment", () => {
    expect(operatorFromEnv({ OPERATOR_NAME: " Niklas Muster ", OPERATOR_ADDRESS: "Musterstraße 1, 12345 Berlin", OPERATOR_EMAIL: "hallo@klicksplit.de" })).toEqual({
      name: "Niklas Muster",
      address: ["Musterstraße 1", "12345 Berlin"],
      email: "hallo@klicksplit.de",
    });
    expect(operatorFromEnv({ OPERATOR_ADDRESS: "c/o Muster | Weg 2 | 10115 Berlin" })?.address).toEqual(["c/o Muster", "Weg 2", "10115 Berlin"]);
    expect(operatorFromEnv({})).toBeNull();
  });

  it("escapes the meta tag", () => {
    const tag = operatorMeta({ name: 'A "B" <script>', address: [], email: "" });
    expect(tag).not.toContain("<script>");
    expect(tag).toContain("&quot;");
  });
});
