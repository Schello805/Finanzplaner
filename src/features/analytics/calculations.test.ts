import { describe, expect, it } from "vitest";
import { categoryComparison, spendingProjection } from "./calculations";

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
  it("zieht Erstattungen von den Ausgaben derselben Kategorie ab",()=>{
    const result=categoryComparison([{month:"2026-08",categoryId:"food",categoryName:"Lebensmittel",amount:-100},{month:"2026-08",categoryId:"food",categoryName:"Lebensmittel",amount:25}],"2026-08","2026-09")[0];
    expect(result.last).toBe(75);
  });
  it("rechnet den laufenden Monat anhand des historischen Ausgabenverlaufs hoch",()=>{
    const rows = [
      {month:"2026-07",bookedOn:"2026-07-03",categoryId:"x",categoryName:"X",amount:-600},
      {month:"2026-07",bookedOn:"2026-07-20",categoryId:"x",categoryName:"X",amount:-400},
      {month:"2026-08",bookedOn:"2026-08-04",categoryId:"x",categoryName:"X",amount:-500},
      {month:"2026-08",bookedOn:"2026-08-20",categoryId:"x",categoryName:"X",amount:-500},
      {month:"2026-09",bookedOn:"2026-09-04",categoryId:"x",categoryName:"X",amount:-550},
      {month:"2026-09",bookedOn:"2026-09-07",categoryId:"x",categoryName:"X",amount:-999},
    ];
    const result=spendingProjection(rows,"2026-09","2026-09-05");
    expect(result.current).toBe(550);
    expect(result.historicalSharePercent).toBeCloseTo(55);
    expect(result.projected).toBe(1000);
  });
});
