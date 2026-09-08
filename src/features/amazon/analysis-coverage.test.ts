import { describe, expect, it } from "vitest";
import { amazonAnalysisCoverage, isWithinAmazonCoverage } from "./analysis-coverage";

describe("Amazon-KI-Analysezeitraum", () => {
  it("startet ohne importierte Amazon-Bankbuchung keine Analyse", () => {
    expect(amazonAnalysisCoverage([])).toBeNull();
  });

  it("begrenzt den Zeitraum auf Bankbuchungen plus Abgleichtoleranz", () => {
    expect(amazonAnalysisCoverage(["2026-08-31", "2026-06-03", "2026-07-15"])).toEqual({
      from: "2026-05-13",
      to: "2026-09-21",
      bankTransactions: 3,
    });
  });

  it("berechnet Monats- und Jahresgrenzen korrekt", () => {
    expect(amazonAnalysisCoverage(["2026-01-05"], 21)).toMatchObject({
      from: "2025-12-15",
      to: "2026-01-26",
    });
  });

  it("verwendet für alle Ansichten dieselben inklusiven Grenzen", () => {
    const coverage = amazonAnalysisCoverage(["2026-06-03"], 21);
    expect(isWithinAmazonCoverage("2026-05-13", coverage)).toBe(true);
    expect(isWithinAmazonCoverage("2026-06-24", coverage)).toBe(true);
    expect(isWithinAmazonCoverage("2026-05-12", coverage)).toBe(false);
    expect(isWithinAmazonCoverage("2026-06-25", coverage)).toBe(false);
    expect(isWithinAmazonCoverage("2026-06-03", null)).toBe(false);
  });
});
