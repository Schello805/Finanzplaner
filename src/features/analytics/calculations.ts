export interface MonthlyCategoryTotal { month: string; categoryId: string; categoryName: string; amount: number; bookedOn?: string }

export interface AnalysisTransaction { id:string;bookedOn:string;amount:number|string;specialType:string;categoryId:string|null;categoryName:string|null }
export interface AnalysisSplit { transactionId:string;categoryId:string;categoryName:string|null;amount:number|string }

export function hasTrustedAnalysisCategory(
  categorizedBy: string | null | undefined,
  confidence: number | string | null | undefined,
) {
  return !categorizedBy?.startsWith("ai:") || Number(confidence ?? 0) >= 0.95;
}

export function normalizeAnalysisTransactions(rows:AnalysisTransaction[],splits:AnalysisSplit[]):MonthlyCategoryTotal[]{
  const splitMap=new Map<string,AnalysisSplit[]>();
  for(const split of splits)splitMap.set(split.transactionId,[...(splitMap.get(split.transactionId)??[]),split]);
  return rows.flatMap(row=>{
    if(row.specialType==="transfer")return [];
    const ownSplits=splitMap.get(row.id)??[];
    if(ownSplits.length){
      const splitCents=ownSplits.reduce((sum,split)=>sum+Math.round(Math.abs(Number(split.amount))*100),0);
      const transactionCents=Math.round(Math.abs(Number(row.amount))*100);
      if(splitCents!==transactionCents)throw new Error(`Aufteilung von Umsatz ${row.id} stimmt nicht mit dem Buchungsbetrag überein.`);
      return ownSplits.map(split=>({bookedOn:row.bookedOn,month:row.bookedOn.slice(0,7),categoryId:split.categoryId,categoryName:split.categoryName??"Nicht zugeordnet",amount:row.specialType==="refund"?Math.abs(Number(split.amount)):-Math.abs(Number(split.amount))}));
    }
    return[{bookedOn:row.bookedOn,month:row.bookedOn.slice(0,7),categoryId:row.categoryId??"uncategorized",categoryName:row.categoryName??"Nicht zugeordnet",amount:row.specialType==="refund"?Math.abs(Number(row.amount)):-Math.abs(Number(row.amount))}];
  });
}

export function categoryComparison(rows: MonthlyCategoryTotal[], lastCompleteMonth: string, currentMonth: string) {
  const historyMonths = [...new Set(rows.map(r => r.month).filter(m => m < lastCompleteMonth))].sort().slice(-12);
  const names = new Map(rows.map(r => [r.categoryId, r.categoryName]));
  return [...names].map(([categoryId, categoryName]) => {
    const last = netSpending(rows.filter(r => r.categoryId === categoryId && r.month === lastCompleteMonth));
    const current = netSpending(rows.filter(r => r.categoryId === categoryId && r.month === currentMonth));
    const historyValues = historyMonths.map(month => netSpending(rows.filter(r => r.categoryId === categoryId && r.month === month)));
    const average = historyValues.length ? historyValues.reduce((a,b)=>a+b,0) / historyValues.length : null;
    return { categoryId, categoryName, last, current, average, historyMonths: historyValues.length,
      delta: average === null ? null : last-average,
      deltaPercent: average ? (last-average)/average*100 : null,
      currentUsagePercent: average ? current/average*100 : null };
  }).sort((a,b)=>b.last-a.last);
}
export function comparisonTotals(rows:ReturnType<typeof categoryComparison>){
  return{
    last:Math.max(0,Math.round(rows.reduce((sum,row)=>sum+row.last*100,0))/100),
    current:Math.max(0,Math.round(rows.reduce((sum,row)=>sum+row.current*100,0))/100),
    average:Math.max(0,Math.round(rows.reduce((sum,row)=>sum+(row.average??0)*100,0))/100),
  };
}
export function spendingTotal(rows:MonthlyCategoryTotal[]){return Math.max(0,netSpending(rows))}
const netSpending = (rows: MonthlyCategoryTotal[]) => -rows.reduce((total,row)=>total+Math.round(row.amount*100),0)/100;

export function verifyAnalyticsIntegrity(input:{
  rows:MonthlyCategoryTotal[];
  comparisons:ReturnType<typeof categoryComparison>;
  totals:ReturnType<typeof comparisonTotals>;
  lastMonth:string;
  currentMonth:string;
}){
  const invalid=input.rows.find(row=>!Number.isFinite(row.amount)||!/^\d{4}-\d{2}$/.test(row.month));
  if(invalid)throw new Error("Interne Summenprüfung fehlgeschlagen: Ungültiger Monats- oder Betragswert.");
  const expectedLast=spendingTotal(input.rows.filter(row=>row.month===input.lastMonth));
  const expectedCurrent=spendingTotal(input.rows.filter(row=>row.month===input.currentMonth));
  const historyMonths=[...new Set(input.rows.map(row=>row.month).filter(month=>month<input.lastMonth))].sort().slice(-12);
  const expectedAverage=historyMonths.length?historyMonths.reduce((sum,month)=>sum+spendingTotal(input.rows.filter(row=>row.month===month)),0)/historyMonths.length:0;
  const comparisonLast=comparisonTotals(input.comparisons).last;
  const comparisonCurrent=comparisonTotals(input.comparisons).current;
  const equalCents=(left:number,right:number)=>Math.round(left*100)===Math.round(right*100);
  if(!equalCents(input.totals.last,expectedLast)||!equalCents(input.totals.last,comparisonLast))throw new Error("Interne Summenprüfung fehlgeschlagen: Monatswert und Kategoriesumme stimmen nicht überein.");
  if(!equalCents(input.totals.current,expectedCurrent)||!equalCents(input.totals.current,comparisonCurrent))throw new Error("Interne Summenprüfung fehlgeschlagen: Laufender Monat und Kategoriesumme stimmen nicht überein.");
  if(!equalCents(input.totals.average,expectedAverage))throw new Error("Interne Summenprüfung fehlgeschlagen: Monatsdurchschnitt und historische Buchungssummen stimmen nicht überein.");
  return {status:"passed" as const,checks:["Monatswert = Buchungssumme","Monatswert = Kategoriesumme","Durchschnitt = historische Monatssummen","Aufteilungen centgenau"]};
}

export function categoryTrendAnalysis(
  rows: MonthlyCategoryTotal[],
  completeMonths: string[],
  categoryRows: ReturnType<typeof categoryComparison>,
) {
  if (completeMonths.length < 3) return [];
  return categoryRows.flatMap((category) => {
    if (category.categoryId === "uncategorized") return [];
    const series = completeMonths.map((month) => ({
      month,
      value: spendingTotal(
        rows.filter(
          (row) => row.categoryId === category.categoryId && row.month === month,
        ),
      ),
    }));
    const recent = series.slice(-4);
    const changes = recent
      .slice(1)
      .map((point, index) => point.value - recent[index].value);
    const rising = changes.length >= 2 && changes.every((value) => value > 0);
    const falling = changes.length >= 2 && changes.every((value) => value < 0);
    const change = recent.at(-1)!.value - recent[0].value;
    if ((!rising && !falling) || Math.abs(change) < 10) return [];
    return [{
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      direction: rising ? "rising" as const : "falling" as const,
      change: Math.round(change * 100) / 100,
      months: recent.length,
      series,
    }];
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

export function spendingOpportunities(
  comparisons: ReturnType<typeof categoryComparison>,
) {
  return comparisons
    .flatMap((category) => {
      if (category.categoryId === "uncategorized" || category.average === null) return [];
      const increase = category.last - category.average;
      return increase >= 5 ? [{
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        monthlyIncrease: Math.round(increase * 100) / 100,
        annualImpact: Math.round(increase * 12 * 100) / 100,
      }] : [];
    })
    .sort((a, b) => b.annualImpact - a.annualImpact)
    .slice(0, 3);
}
