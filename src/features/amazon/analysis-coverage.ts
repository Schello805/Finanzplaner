const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

function shiftIsoDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function amazonAnalysisCoverage(bankBookingDates: string[], toleranceDays = 21) {
  const sortedDates = [...bankBookingDates].sort();
  if (!sortedDates.length) return null;
  return {
    from: shiftIsoDate(sortedDates[0], -toleranceDays),
    to: shiftIsoDate(sortedDates.at(-1)!, toleranceDays),
    bankTransactions: sortedDates.length,
  };
}

export function isWithinAmazonCoverage(value: string, coverage: { from: string; to: string } | null) {
  return Boolean(coverage && value >= coverage.from && value <= coverage.to);
}

export function countOpenAmazonPaymentGroups(rows:Array<{
  orderIdFingerprint:string;
  orderDate:string;
  shipDate:string|null;
  orderTotal:number|string;
  quantity:number|string;
  matchedTransactionId:string|null;
}>,coverage:{from:string;to:string}|null){
  return new Set(rows.filter(row=>Number(row.quantity)>0&&Number(row.orderTotal)>0&&!row.matchedTransactionId&&isWithinAmazonCoverage(row.shipDate??row.orderDate,coverage)).map(row=>`${row.orderIdFingerprint}|${Number(row.orderTotal).toFixed(2)}|${row.shipDate??row.orderDate}`)).size;
}
