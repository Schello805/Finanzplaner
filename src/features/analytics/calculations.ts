export interface MonthlyCategoryTotal { month: string; categoryId: string; categoryName: string; amount: number }

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
