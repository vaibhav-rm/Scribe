import { z } from "zod";

/**
 * Common result shape for all AI providers.
 * Providers adapt their native responses into this shape.
 */
export interface AIResult<T = unknown> {
  data: T;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  model: string;
  provider: string;
}

/**
 * Structured error from an AI provider, used for consistent error handling
 * and retry/fallback decisions.
 */
export interface AIProviderError {
  code: string;          // e.g. "rate_limit", "invalid_request", "auth", "provider_unavailable"
  message: string;
  provider: string;
  retryable: boolean;
  statusCode?: number;
}

/**
 * Provider-independent interface for structured AI generation.
 *
 * The `schema` parameter is a Zod schema (or JSON Schema-like object) used to
 * validate/constrain the model's JSON output wherever the provider supports it.
 */
export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly model: string;

  /**
   * Generate structured output conforming to `schema`.
   */
  generateStructuredOutput<T>(input: {
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodTypeAny | Record<string, unknown>;
    model?: string;
    maxOutputTokens?: number;
    temperature?: number;
  }): Promise<AIResult<T>>;

  /**
   * Optional plain text generation (used for non-JSON tasks).
   */
  generateText?(input: {
    systemPrompt: string;
    userPrompt: string;
    model?: string;
    maxOutputTokens?: number;
    temperature?: number;
  }): Promise<{ text: string; model: string; provider: string; usage?: AIResult["usage"] }>;

  /**
   * Provider health check. Returns true if the provider is configured and
   * reachable. Should not throw; return false on failure.
   */
  healthCheck?(): Promise<boolean>;

  /**
   * Estimate cost (in minor currency units, e.g. paise for INR) for a
   * generation with the given token counts.
   */
  estimateCost(inputTokens: number, outputTokens: number): number;
}

/**
 * Configuration resolved from environment variables.
 */
export interface AIProviderConfig {
  provider: "gemini" | "xai" | "anthropic";
  gemini?: { apiKey: string; model: string };
  xai?: { apiKey: string; model: string };
  anthropic?: { apiKey: string; model: string };
}

/**
 * Parses env vars into a provider config. Missing keys yield undefined for
 * that provider — the caller decides how to degrade.
 */
export function loadAIConfig(): AIProviderConfig {
  return {
    provider: (process.env.AI_PROVIDER as "gemini" | "xai" | "anthropic") ?? "gemini",
    gemini:
      process.env.GEMINI_API_KEY
        ? { apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite" }
        : undefined,
    xai:
      process.env.XAI_API_KEY
        ? { apiKey: process.env.XAI_API_KEY, model: process.env.XAI_MODEL ?? "grok-3" }
        : undefined,
    anthropic:
      process.env.ANTHROPIC_API_KEY
        ? { apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL ?? "claude-3-haiku-20240307" }
        : undefined,
  };
}
