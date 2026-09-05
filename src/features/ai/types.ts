import { z } from "zod";

export const categorizationResponseSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    category: z.string().nullable(),
    proposedCategory: z.string().min(2).max(60).nullable(),
    subcategory: z.string().nullable().optional(),
    normalizedMerchant: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1),
    reason: z.string().max(240),
  })),
});
export type CategorizationResponse = z.infer<typeof categorizationResponseSchema>;

export const insightResponseSchema = z.object({
  summary: z.string().min(1).max(240),
  opportunities: z.array(z.object({
    category: z.string().min(1).max(80),
    action: z.string().min(1).max(180),
    reason: z.string().min(1).max(180),
    icon: z.enum(["home", "car", "shopping", "subscription", "bank", "leisure", "general"]),
  })).min(1).max(3),
  watchouts: z.array(z.string().min(1).max(180)).max(2),
});
export type InsightResponse = z.infer<typeof insightResponseSchema>;

export interface AiTransactionInput { id: string; date: string; amount: number; currency: string; bookingType?: string; merchant?: string; purpose?: string }
export interface AiUsageResult { inputTokens: number; outputTokens: number }
export interface AiResult<T> { data: T; usage: AiUsageResult }
export interface AiConfig { provider: "openai" | "gemini"; apiKey: string; model: string }
