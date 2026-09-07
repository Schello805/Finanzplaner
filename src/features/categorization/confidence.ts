export const VERY_SAFE_CONFIDENCE = 0.95;
export const LIKELY_CONFIDENCE = 0.75;

export type ConfidenceBand = "very-safe" | "likely" | "check";

export function confidenceBand(confidence:number):ConfidenceBand{
  if(confidence>=VERY_SAFE_CONFIDENCE)return "very-safe";
  if(confidence>=LIKELY_CONFIDENCE)return "likely";
  return "check";
}

export function automaticAcceptanceThreshold(level:string|null|undefined){
  return level==="very_safe"?VERY_SAFE_CONFIDENCE:Number.POSITIVE_INFINITY;
}
