import {describe,expect,it} from "vitest";
import {finTsProductVersion} from "./product-version";

describe("FinTS-Produktversion",()=>{
 it("belässt kurze Versionsangaben unverändert",()=>{
  expect(finTsProductVersion("1.2.3")).toBe("1.2.3");
  expect(finTsProductVersion("dev")).toBe("dev");
 });

 it("entfernt das Release-Präfix und verdichtet lange Semver-Versionen",()=>{
  expect(finTsProductVersion("v0.11.1")).toBe("0111");
  expect(finTsProductVersion("12.34.56")).toBe("12345");
 });

 it("liefert auch für ungültige oder leere Angaben einen gültigen Wert",()=>{
  expect(finTsProductVersion("  ")).toBe("0.5");
  expect(finTsProductVersion("release-v0.11.1\n")).toHaveLength(5);
 });
});
