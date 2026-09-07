// Nur Anbieter/Produkte, deren Text eindeutig für ein laufendes Abonnement
// steht. Generische Sammelabrechner wie PayPal, Amazon, Google oder
// apple.com/bill sind absichtlich nicht allein ausreichend.
export const knownSubscriptionPattern = /\b(?:spotify|netflix|dazn|deezer|tidal|audible)\b|disney\s*\+|disneyplus|paramount\s*\+|paramountplus|youtube\s*premium|google\s*one|microsoft\s*365|office\s*365|amazon\s*prime|apple\s*music|icloud(?:\s*\+)?|sky\s*(?:deutschland|ticket)|wow\s*(?:tv|premium|filme|serien|live-sport)|waipu(?:\.tv)?|zattoo|joyn\s*plus|rtl\s*\+|adobe\s*(?:creative\s*cloud|acrobat)|dropbox\s*(?:plus|professional|essentials)|canva\s*(?:pro|teams)/i;

export function isKnownSubscription(text: string | null | undefined) {
  return Boolean(subscriptionProvider(text));
}

export function subscriptionProvider(text: string | null | undefined) {
  return (text ?? "").match(knownSubscriptionPattern)?.[0]?.trim() ?? null;
}
