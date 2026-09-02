import { z } from "zod";

export const categorizationResponseSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    category: z.string(),
    subcategory: z.string().nullable().optional(),
    normalizedMerchant: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1),
    reason: z.string().max(240),
  })),
});
export type CategorizationResponse = z.infer<typeof categorizationResponseSchema>;

export const insightResponseSchema = z.object({
  summary: z.string().min(1).max(600),
  observations: z.array(z.string().min(1).max(300)).max(5),
  savingIdeas: z.array(z.string().min(1).max(300)).max(5),
});
export type InsightResponse = z.infer<typeof insightResponseSchema>;

export interface AiTransactionInput { id: string; date: string; amount: number; currency: string; bookingType?: string; merchant?: string; purpose?: string }
export interface AiUsageResult { inputTokens: number; outputTokens: number }
export interface AiResult<T> { data: T; usage: AiUsageResult }
export interface AiConfig { provider: "openai" | "gemini"; apiKey: string; model: string }
