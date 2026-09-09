export const BANK_DIRECTORY_URL =
  "https://raw.githubusercontent.com/hbci4j/hbci4java/master/src/main/resources/blz.properties";

export type FinTsBank = {
  blz: string;
  name: string;
  city: string;
  bic: string;
  endpoint: string;
};

export function isTrustedSparkasseEndpoint(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
    const host = url.hostname.toLowerCase();
    return (
      /(^|\.)s-fints-pt-[a-z]{2}\.de$/.test(host) ||
      /(^|\.)s-hbci\.de$/.test(host) ||
      host === "fints2.atruvia.de"
    );
  } catch {
    return false;
  }
}

export function findSparkasseByBlz(directory: string, blz: string): FinTsBank | null {
  if (!/^\d{8}$/.test(blz)) return null;
  const prefix = `${blz}=`;
  const line = directory.split(/\r?\n/).find((entry) => entry.startsWith(prefix));
  if (!line) return null;
  const [name = "", city = "", bic = "", , , endpoint = ""] = line.slice(prefix.length).split("|");
  if (!/sparkasse/i.test(name) || !isTrustedSparkasseEndpoint(endpoint)) return null;
  return { blz, name, city, bic, endpoint };
}
