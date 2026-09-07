import { describe, expect, it } from "vitest";
import { categoryComparison, comparisonTotals, normalizeAnalysisTransactions, spendingTotal } from "./calculations";

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
  it("normalisiert direkte Ausgaben, Erstattungen und Aufteilungen identisch",()=>{
    const result=normalizeAnalysisTransactions([
      {id:"expense",bookedOn:"2026-08-01",amount:"-10.00",specialType:"normal",categoryId:"food",categoryName:"Lebensmittel"},
      {id:"refund",bookedOn:"2026-08-02",amount:"5.00",specialType:"refund",categoryId:"food",categoryName:"Lebensmittel"},
      {id:"split",bookedOn:"2026-08-03",amount:"-9.00",specialType:"normal",categoryId:null,categoryName:null},
    ],[{transactionId:"split",categoryId:"a",categoryName:"A",amount:"4.00"},{transactionId:"split",categoryId:"b",categoryName:"B",amount:"5.00"}]);
    expect(result.map(row=>row.amount)).toEqual([-10,5,-4,-5]);
    expect(result.reduce((sum,row)=>sum+row.amount,0)).toBe(-14);
  });
  it("schließt interne Umbuchungen selbst bei einem fehlerhaften Ausschlusskennzeichen aus",()=>{
    const result=normalizeAnalysisTransactions([
      {id:"out",bookedOn:"2026-08-01",amount:"-800.00",specialType:"transfer",categoryId:"transfer",categoryName:"Interne Umbuchung"},
      {id:"in",bookedOn:"2026-08-02",amount:"800.00",specialType:"transfer",categoryId:"transfer",categoryName:"Interne Umbuchung"},
      {id:"expense",bookedOn:"2026-08-03",amount:"-50.00",specialType:"normal",categoryId:"food",categoryName:"Lebensmittel"},
    ],[]);
    expect(result).toHaveLength(1);
    expect(spendingTotal(result)).toBe(50);
  });
  it("verweigert eine Analyse mit nicht centgenauer Aufteilung",()=>{
    expect(()=>normalizeAnalysisTransactions([{id:"split",bookedOn:"2026-08-03",amount:"-9.00",specialType:"normal",categoryId:null,categoryName:null}],[{transactionId:"split",categoryId:"a",categoryName:"A",amount:"4.00"},{transactionId:"split",categoryId:"b",categoryName:"B",amount:"4.99"}])).toThrow("stimmt nicht mit dem Buchungsbetrag überein");
  });
  it("summiert Centbeträge ohne Gleitkommaabweichung",()=>{
    const result=categoryComparison([{month:"2026-08",categoryId:"x",categoryName:"X",amount:-0.1},{month:"2026-08",categoryId:"x",categoryName:"X",amount:-0.2}],"2026-08","2026-09")[0];
    expect(result.last).toBe(0.3);
  });
  it("berechnet Gesamtsummen unabhängig von einer späteren Top-5-Darstellung",()=>{
    const rows=Array.from({length:7},(_,index)=>({month:"2026-08",categoryId:String(index),categoryName:String(index),amount:-(index+1)*100}));
    const comparisons=categoryComparison(rows,"2026-08","2026-09");
    expect(comparisonTotals(comparisons).last).toBe(2800);
    expect(comparisons.slice(0,5).reduce((sum,row)=>sum+row.last,0)).toBe(2500);
  });
  it("verrechnet kategoriefremde Erstattungen in Gesamtwert und Verlauf identisch",()=>{
    const rows=[{month:"2026-08",categoryId:"a",categoryName:"A",amount:-10},{month:"2026-08",categoryId:"b",categoryName:"B",amount:20}];
    const comparisons=categoryComparison(rows,"2026-08","2026-09");
    expect(comparisonTotals(comparisons).last).toBe(0);
    expect(spendingTotal(rows)).toBe(0);
  });
  it("bezieht Monate ohne Umsatz einer Kategorie als Null in den Durchschnitt ein",()=>{
    const rows=[{month:"2026-06",categoryId:"food",categoryName:"Lebensmittel",amount:-100},{month:"2026-07",categoryId:"other",categoryName:"Andere Kategorie",amount:-20},{month:"2026-08",categoryId:"food",categoryName:"Lebensmittel",amount:-50}];
    const food=categoryComparison(rows,"2026-08","2026-09").find(row=>row.categoryId==="food")!;
    expect(food.average).toBe(50);
  });
});
