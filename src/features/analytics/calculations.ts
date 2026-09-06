export interface MonthlyCategoryTotal { month: string; categoryId: string; categoryName: string; amount: number; bookedOn?: string }

export interface AnalysisTransaction { id:string;bookedOn:string;amount:number|string;specialType:string;categoryId:string|null;categoryName:string|null }
export interface AnalysisSplit { transactionId:string;categoryId:string;categoryName:string|null;amount:number|string }

export function normalizeAnalysisTransactions(rows:AnalysisTransaction[],splits:AnalysisSplit[]):MonthlyCategoryTotal[]{
  const splitMap=new Map<string,AnalysisSplit[]>();
  for(const split of splits)splitMap.set(split.transactionId,[...(splitMap.get(split.transactionId)??[]),split]);
  return rows.flatMap(row=>{
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
