import {describe,expect,it}from"vitest";
import {automaticAcceptanceThreshold,confidenceBand,VERY_SAFE_CONFIDENCE}from"./confidence";

describe("Sicherheitsgrenzen der Kategorisierung",()=>{
  it("stuft erst ab 95 Prozent als sehr sicher ein",()=>{
    expect(confidenceBand(.949)).toBe("likely");
    expect(confidenceBand(.95)).toBe("very-safe");
  });

  it("erlaubt automatische Übernahme ausschließlich bei bewusster 95-Prozent-Freigabe",()=>{
    expect(automaticAcceptanceThreshold("very_safe")).toBe(VERY_SAFE_CONFIDENCE);
    expect(automaticAcceptanceThreshold("none")).toBe(Number.POSITIVE_INFINITY);
    expect(automaticAcceptanceThreshold("likely")).toBe(Number.POSITIVE_INFINITY);
  });
});
