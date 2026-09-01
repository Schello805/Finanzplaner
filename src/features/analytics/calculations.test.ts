import { describe, expect, it } from "vitest";
import { categoryComparison } from "./calculations";

describe("Kategorievergleich",()=>{
  it("vergleicht den letzten Monat mit verfügbaren vollständigen Monaten",()=>{
    const result=categoryComparison([
      {month:"2026-06",categoryId:"food",categoryName:"Lebensmittel",amount:-400},
      {month:"2026-07",categoryId:"food",categoryName:"Lebensmittel",amount:-600},
      {month:"2026-08",categoryId:"food",categoryName:"Lebensmittel",amount:-550},
      {month:"2026-09",categoryId:"food",categoryName:"Lebensmittel",amount:-250},
    ],"2026-08","2026-09")[0];
    expect(result.average).toBe(500);
    expect(result.delta).toBe(50);
    expect(result.deltaPercent).toBe(10);
    expect(result.currentUsagePercent).toBe(50);
  });
});
