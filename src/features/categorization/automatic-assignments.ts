import { applyMerchantRules } from "./merchant-rules";

/**
 * Gemeinsamer Einstiegspunkt für alle zweifelsfreien Bankumsatz-Zuordnungen.
 * Die Implementierung schützt bereits kategorisierte, aufgeteilte, ausgeschlossene
 * und zurückgestellte Buchungen. Neue deterministische Verfahren werden nur hier
 * in die Reihenfolge aufgenommen, damit Import, FinTS und manueller Lauf identisch
 * arbeiten.
 */
export async function applyAutomaticAssignments(input:{
  householdId:string;
  ownerMemberId:string;
  visibleAccountIds:string[];
}){
  return applyMerchantRules(input);
}
