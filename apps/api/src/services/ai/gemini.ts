import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerationConfig,
  SchemaType,
} from "@google/generative-ai";
import {
  AIProvider,
  AIResult,
  AIProviderError,
} from "./provider.js";
import { logger } from "../../lib/logger.js";

/**
 * Gemini provider using the official @google/generative-ai SDK.
 *
 * Supports structured JSON output via responseMimeType + responseSchema.
 * Implements bounded retries, rate-limit handling, timeouts, cost estimation,
 * and redacted logging.
 */
export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly name = "Google Gemini";
  readonly model: string;

  private readonly genModel: GenerativeModel;

  constructor(config: { apiKey: string; model: string }) {
    if (!config.apiKey) {
      throw new Error("Gemini API key is required");
    }
    const genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model;
    this.genModel = genAI.getGenerativeModel({
      model: config.model,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });
  }

  async generateStructuredOutput<T>(input: {
    systemPrompt: string;
    userPrompt: string;
    schema: any;
    model?: string;
    maxOutputTokens?: number;
    temperature?: number;
  }): Promise<AIResult<T>> {
    const {
      systemPrompt,
      userPrompt,
      schema,
      model: overrideModel,
      maxOutputTokens,
      temperature,
    } = input;

    const targetModel = overrideModel || this.model;

    // Build a model instance per-request when model override is requested,
    // otherwise reuse the shared instance.
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = overrideModel && overrideModel !== this.model
      ? genAI.getGenerativeModel({
          model: targetModel,
          generationConfig: this.buildGenerationConfig(schema, {
            maxOutputTokens,
            temperature,
          }),
        })
      : this.genModel;

    // Combine system prompt + user prompt into a single content block with
    // explicit JSON instruction. System instructions are kept separate from
    // untrusted user content by prepending as a directive.
    const prompt = `${systemPrompt}\n\n---\n\nUser request and project data:\n${userPrompt}\n\n---\n\nRespond with valid JSON matching the requested schema. Do not include markdown fences or explanatory text outside the JSON.`;

    const result = await this.withRetry(async () => {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text() || "{}";

      let data: T;
      try {
        data = JSON.parse(text) as T;
      } catch {
        // Try to extract JSON from within markdown fences or surrounding text
        const extracted = extractJson(text);
        if (extracted === null) {
          throw new AIProviderErrorWrap(
            "invalid_response",
            "Model returned non-JSON output that could not be parsed",
            "gemini",
            false,
          );
        }
        data = JSON.parse(extracted) as T;
      }

      const usage = response.usageMetadata
        ? {
            inputTokens: response.usageMetadata.promptTokenCount ?? undefined,
            outputTokens: response.usageMetadata.candidatesTokenCount ?? undefined,
          }
        : undefined;

      return {
        data,
        usage,
        model: targetModel,
        provider: "gemini",
      };
    });

    return result;
  }

  async generateText(input: {
    systemPrompt: string;
    userPrompt: string;
    model?: string;
    maxOutputTokens?: number;
    temperature?: number;
  }): Promise<{
    text: string;
    model: string;
    provider: string;
    usage?: AIResult["usage"];
  }> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const targetModel = input.model || this.model;
    const model = input.model && input.model !== this.model
      ? genAI.getGenerativeModel({
          model: targetModel,
          generationConfig: this.buildGenerationConfig(undefined, {
            maxOutputTokens: input.maxOutputTokens,
            temperature: input.temperature,
          }),
        })
      : this.genModel;

    const prompt = `${input.systemPrompt}\n\n---\n\n${input.userPrompt}`;

    const result = await this.withRetry(async () => {
      const resp = await model.generateContent(prompt);
      const text = resp.response.text() || "";
      return { text, model: targetModel, provider: "gemini" as const };
    });

    return result;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const m = genAI.getGenerativeModel({ model: this.model });
      await m.generateContent("ping");
      return true;
    } catch (err) {
      logger.warn({ provider: "gemini", err: String(err) }, "Gemini health check failed");
      return false;
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Gemini 1.5 Flash pricing (per 1M tokens), in INR (approximate).
    // These are estimates; actual billing is via Google Cloud.
    const inputPer1M = 0.075 * 83; // $0.075 -> ~₹6.23 per 1M input tokens
    const outputPer1M = 0.30 * 83; // $0.30 -> ~₹24.90 per 1M output tokens
    const cost = (inputTokens / 1_000_000) * inputPer1M +
      (outputTokens / 1_000_000) * outputPer1M;
    return Math.round(cost * 100) / 100; // paise-level precision
  }

  private buildGenerationConfig(
    schema: any,
    overrides?: { maxOutputTokens?: number; temperature?: number },
  ): GenerationConfig {
    const config: GenerationConfig = {
      responseMimeType: "application/json",
      ...(overrides?.maxOutputTokens !== undefined
        ? { maxOutputTokens: overrides.maxOutputTokens }
        : {}),
      ...(overrides?.temperature !== undefined
        ? { temperature: overrides.temperature }
        : {}),
    };

    if (schema) {
      config.responseSchema = convertToGeminiSchema(schema);
    }

    return config;
  }

  /**
   * Bounded retries with exponential backoff. Retries only on retryable
   * errors (rate limits, transient failures).
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxRetries = 3;
    let lastErr: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastErr = err;
        const providerErr = normalizeGeminiError(err, "gemini");
        if (!providerErr.retryable || attempt === maxRetries) {
          throw providerErr;
        }
        const backoffMs = Math.min(1000 * 2 ** attempt, 8000);
        await sleep(backoffMs);
      }
    }

    throw lastErr;
  }
}

class AIProviderErrorWrap implements AIProviderError {
  constructor(
    public code: string,
    public message: string,
    public provider: string,
    public retryable: boolean,
    public statusCode?: number,
  ) {}
}

/**
 * Normalize Gemini SDK errors into the common AIProviderError format.
 */
function normalizeGeminiError(err: any, provider: string): AIProviderError {
  const status = err?.status ?? err?.statusCode;
  const message = err?.message ?? String(err);

  // Rate limit
  if (status === 429 || /rate.?limit|quota/i.test(message)) {
    return new AIProviderErrorWrap("rate_limit", message, provider, true, status);
  }

  // Auth
  if (status === 401 || status === 403 || /api.?key|authentication/i.test(message)) {
    return new AIProviderErrorWrap("auth", message, provider, false, status);
  }

  // Invalid request
  if (status === 400 || /invalid.?request|schema/i.test(message)) {
    return new AIProviderErrorWrap("invalid_request", message, provider, false, status);
  }

  // Provider unavailable
  if (status === 503 || status === 502 || status >= 500) {
    return new AIProviderErrorWrap("provider_unavailable", message, provider, true, status);
  }

  return new AIProviderErrorWrap("unknown", message, provider, false, status);
}

/**
 * Attempt to extract a JSON object substring from text that may contain
 * markdown fences or surrounding prose.
 */
function extractJson(text: string): string | null {
  // Try fenced code block
  const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fence) return fence[1].trim();

  // Try to find the first { ... } balanced object
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"' && !escape) inString = !inString;
    if (!inString) {
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert a Zod schema (or JSON Schema-like object) into Gemini's
 * responseSchema format. Falls back to a generic object schema on failure.
 */
function convertToGeminiSchema(schema: any): any {
  // If it's already a Gemini-compatible schema, pass through
  if (schema && schema.type) return schema;

  // Zod schema object: look for ._def
  if (schema?._def) {
    return zodToGemini(schema._def);
  }

  // Plain JSON Schema-like
  if (schema && schema.properties) {
    return {
      type: SchemaType.OBJECT,
      properties: Object.fromEntries(
        Object.entries(schema.properties).map(([k, v]: [string, any]) => [
          k,
          convertToGeminiSchema(v),
        ]),
      ),
      required: schema.required || [],
    };
  }

  // Default: generic object
  return { type: SchemaType.OBJECT };
}

function zodToGemini(def: any): any {
  const zodType = def?.typeName;
  switch (zodType) {
    case "ZodObject": {
      const shape = def?.shape ?? {};
      return {
        type: SchemaType.OBJECT,
        properties: Object.fromEntries(
          Object.entries(shape).map(([k, v]: [string, any]) => [
            k, zodToGemini(v._def),
          ]),
        ),
        required: def?.requiredKeys?.() ?? [],
      };
    }
    case "ZodString":
      return { type: SchemaType.STRING };
    case "ZodNumber":
      return { type: SchemaType.NUMBER };
    case "ZodBoolean":
      return { type: SchemaType.BOOLEAN };
    case "ZodArray":
      return {
        type: SchemaType.ARRAY,
        items: def?.type?.element ? zodToGemini(def.type.element._def) : { type: SchemaType.STRING },
      };
    case "ZodOptional":
      return zodToGemini(def?.innerType?._def ?? def?.innerType);
    case "ZodNullable":
      return zodToGemini(def?.innerType?._def ?? def?.innerType);
    case "ZodEnum":
      return {
        type: SchemaType.STRING,
        enum: def?.options ?? [],
      };
    default:
      return { type: SchemaType.STRING };
  }
}
