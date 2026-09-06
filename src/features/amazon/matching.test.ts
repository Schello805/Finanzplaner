import { describe, expect, it } from "vitest";
import { amazonMatchScore } from "./matching";

describe("Amazon-Abgleich", () => {
  it("bewertet gleiche Beträge und nahe Daten hoch", () => expect(amazonMatchScore(49.99, "2026-09-01", -49.99, "2026-09-03")?.score).toBe(0.97));
  it("verwirft abweichende Beträge", () => expect(amazonMatchScore(49.99, "2026-09-01", -50.99, "2026-09-03")).toBeNull());
});
