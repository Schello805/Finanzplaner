import { describe, expect, it } from "vitest";
import { sanitizeTransaction } from "./privacy";

describe("KI-Datenschutz",()=>{it("entfernt IBAN und lange Referenzen",()=>{const result=sanitizeTransaction({id:"1",date:"2026-08-01",amount:-10,currency:"EUR",purpose:"Max Mustermann DE89370400440532013000 MANDAT ABCDE123456789"},"minimal");expect(result.purpose).not.toContain("DE8937");expect(result.purpose).not.toContain("ABCDE123456789");})});
