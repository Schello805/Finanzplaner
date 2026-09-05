import { describe, expect, it } from "vitest";
import { decodeBankCsv } from "./decode";

describe("CSV-Zeichenkodierung", () => {
  it("erkennt einen Windows-1252-Sparkassenexport trotz UTF-8-Vorlage", () => {
    expect(decodeBankCsv(new Uint8Array([0x66, 0xfc, 0x72]), "utf-8-sig")).toBe("für");
  });

  it("behält gültiges UTF-8 unverändert bei", () => {
    expect(decodeBankCsv(new TextEncoder().encode("Kontoführungsgebühr"), "utf-8-sig")).toBe("Kontoführungsgebühr");
  });
});
