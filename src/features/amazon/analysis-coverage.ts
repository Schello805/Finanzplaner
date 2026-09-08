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
