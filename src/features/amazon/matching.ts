export function amazonMatchScore(orderTotal: number, orderDate: string, transactionAmount: number, transactionDate: string) {
  const amountDifference = Math.abs(Math.abs(transactionAmount) - Math.abs(orderTotal));
  const days = Math.abs(Date.parse(`${transactionDate}T12:00:00Z`) - Date.parse(`${orderDate}T12:00:00Z`)) / 86_400_000;
  if (amountDifference > 0.01 || days > 21) return null;
  const score = Math.max(0.7, Math.min(0.99, 0.99 - days * 0.01));
  return { score: Math.round(score * 100) / 100, days: Math.round(days), reason: days === 0 ? "Betrag und Datum stimmen überein" : `Betrag stimmt überein · ${Math.round(days)} Tage Abstand` };
}
