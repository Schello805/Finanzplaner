import { z } from "zod";

export const categorizationResponseSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    category: z.string(),
    subcategory: z.string().optional(),
    normalizedMerchant: z.string().optional(),
    confidence: z.number().min(0).max(1),
    reason: z.string().max(240),
  })),
});
export type CategorizationResponse = z.infer<typeof categorizationResponseSchema>;

export interface AiTransactionInput { id: string; date: string; amount: number; currency: string; bookingType?: string; merchant?: string; purpose?: string }
export interface AiUsageResult { inputTokens: number; outputTokens: number }
export interface AiResult<T> { data: T; usage: AiUsageResult }
export interface AiConfig { provider: "openai" | "gemini"; apiKey: string; model: string }
