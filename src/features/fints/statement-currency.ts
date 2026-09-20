type BalanceLike = { currency?: string } | null | undefined;
type StatementLike = {
  openingBalance?: BalanceLike;
  closingBalance?: BalanceLike;
  availableBalance?: BalanceLike;
  forwardBalances?: BalanceLike[];
};

const normalize = (value?: string) => value?.trim().toUpperCase();

export function resolveStatementCurrency(statement: StatementLike, accountCurrency?: string) {
  const balanceCurrencies = [
    statement.openingBalance,
    statement.closingBalance,
    statement.availableBalance,
    ...(statement.forwardBalances ?? []),
  ].map(balance => normalize(balance?.currency)).filter((currency): currency is string => Boolean(currency));
  const currencies = [...new Set(balanceCurrencies)];
  if (currencies.length > 1) {
    throw new Error(`Der Kontoauszug enthält widersprüchliche Währungen: ${currencies.join(", ")}.`);
  }
  const currency = currencies[0] ?? normalize(accountCurrency);
  if (!currency || !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Die Währung des Sparkassenkontos konnte nicht sicher ermittelt werden.");
  }
  if (currency !== "EUR") {
    throw new Error(`Nicht unterstützte Währung: ${currency}. Auswertungen sind derzeit ausschließlich in EUR möglich.`);
  }
  return currency;
}
