export interface MonthlyCategoryTotal { month: string; categoryId: string; categoryName: string; amount: number; bookedOn?: string }

export function spendingProjection(rows: MonthlyCategoryTotal[], currentMonth: string, asOfDate: string) {
  const asOfDay = Number(asOfDate.slice(8, 10));
  const historyMonths = [...new Set(rows.map((row) => row.month).filter((month) => month < currentMonth))].sort().slice(-12);
  const current = sum(rows.filter((row) => row.month === currentMonth && (!row.bookedOn || row.bookedOn <= asOfDate)));
  const historicalFull = historyMonths.reduce((total, month) => total + sum(rows.filter((row) => row.month === month)), 0);
  const historicalToDay = historyMonths.reduce((total, month) => total + sum(rows.filter((row) => row.month === month && Number((row.bookedOn ?? `${month}-01`).slice(8, 10)) <= asOfDay)), 0);
  const historicalShare = historicalFull > 0 ? historicalToDay / historicalFull : 0;
  return {
    current,
    projected: historyMonths.length >= 2 && historicalShare > 0 ? Math.round((current / historicalShare) * 100) / 100 : null,
    historicalSharePercent: historicalShare * 100,
    historyMonths: historyMonths.length,
    asOfDay,
  };
}

export function categoryComparison(rows: MonthlyCategoryTotal[], lastCompleteMonth: string, currentMonth: string) {
  const historyMonths = [...new Set(rows.map(r => r.month).filter(m => m < lastCompleteMonth))].sort().slice(-12);
  const names = new Map(rows.map(r => [r.categoryId, r.categoryName]));
  return [...names].map(([categoryId, categoryName]) => {
    const last = sum(rows.filter(r => r.categoryId === categoryId && r.month === lastCompleteMonth));
    const current = sum(rows.filter(r => r.categoryId === categoryId && r.month === currentMonth));
    const historyValues = historyMonths.map(month => sum(rows.filter(r => r.categoryId === categoryId && r.month === month)));
    const average = historyValues.length ? historyValues.reduce((a,b)=>a+b,0) / historyValues.length : null;
    return { categoryId, categoryName, last, current, average, historyMonths: historyValues.length,
      delta: average === null ? null : last-average,
      deltaPercent: average ? (last-average)/average*100 : null,
      currentUsagePercent: average ? current/average*100 : null };
  }).sort((a,b)=>b.last-a.last);
}
const sum = (rows: MonthlyCategoryTotal[]) => Math.max(0,-rows.reduce((total,row)=>total+row.amount,0));
