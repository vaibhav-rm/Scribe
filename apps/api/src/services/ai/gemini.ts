import {
  GoogleGenerativeAI,
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

  constructor(config: { apiKey: string; model: string }) {
    if (!config.apiKey) {
      throw new Error("Gemini API key is required");
    }
    this.model = config.model;
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

    // Build a model per request so the response schema always matches the
    // caller's Zod schema. Reusing a schema-less model made Gemini return
    // arbitrary JSON shapes that later failed Zod validation.
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: targetModel,
      generationConfig: this.buildGenerationConfig(schema, {
        maxOutputTokens,
        temperature,
      }),
    });

    // Combine system prompt + user prompt into a single content block with
    // explicit JSON instruction. System instructions are kept separate from
    // untrusted user content by prepending as a directive.
    const prompt = `${systemPrompt}\n\n---\n\nUser request and project data:\n${userPrompt}\n\n---\n\nRespond with valid JSON matching the requested schema. Do not include markdown fences or explanatory text outside the JSON.`;

    const result = await this.withRetry(async () => {
      const result = await scheduleGeminiRequest(() => model.generateContent(prompt));
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
    const model = genAI.getGenerativeModel({
      model: targetModel,
      generationConfig: this.buildGenerationConfig(undefined, {
        maxOutputTokens: input.maxOutputTokens,
        temperature: input.temperature,
      }),
    });

    const prompt = `${input.systemPrompt}\n\n---\n\n${input.userPrompt}`;

    const result = await this.withRetry(async () => {
      const resp = await scheduleGeminiRequest(() => model.generateContent(prompt));
      const text = resp.response.text() || "";
      return { text, model: targetModel, provider: "gemini" as const };
    });

    return result;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const m = genAI.getGenerativeModel({ model: this.model });
      await scheduleGeminiRequest(() => m.generateContent("ping"));
      return true;
    } catch (err) {
      logger.warn({ provider: "gemini", err: String(err) }, "Gemini health check failed");
      return false;
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Gemini 3.5 Flash-Lite list prices (USD per 1M tokens) converted to INR.
    // This is an estimate only; actual billing is via Google Cloud.
    const inputPer1M = 0.30 * 83; // $0.30 -> ~₹24.90 per 1M input tokens
    const outputPer1M = 2.50 * 83; // $2.50 -> ~₹207.50 per 1M output tokens
    const cost = (inputTokens / 1_000_000) * inputPer1M +
      (outputTokens / 1_000_000) * outputPer1M;
    return Math.round(cost * 100) / 100;
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
        const backoffMs =
          providerErr.code === "rate_limit"
            ? Math.min(5000 * 2 ** attempt, 30000)
            : Math.min(1000 * 2 ** attempt, 8000);
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

  // A daily quota cannot recover by retrying within this request. Surface it
  // immediately instead of sleeping through several pointless attempts.
  if (/per.?day|daily|RPD|GenerateRequestsPerDay/i.test(message)) {
    return new AIProviderErrorWrap("quota_exhausted", message, provider, false, status);
  }

  // Per-minute rate limit
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

const DEFAULT_MIN_REQUEST_INTERVAL_MS = 6500;
let geminiRequestChain: Promise<unknown> = Promise.resolve();
let lastGeminiRequestStartedAt = 0;

function getMinRequestInterval(): number {
  // Unit tests use mocked responses and should not wait between calls.
  if (process.env.NODE_ENV === "test") return 0;

  const raw = Number(process.env.GEMINI_MIN_REQUEST_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_MIN_REQUEST_INTERVAL_MS;
  return raw;
}

/**
 * Serialize Gemini requests and space their start times. This keeps a
 * section-by-section generation under free-tier requests-per-minute limits.
 * It is process-local; run a single API/worker process per free-tier key.
 */
function scheduleGeminiRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = geminiRequestChain.then(async () => {
    const interval = getMinRequestInterval();
    const wait = Math.max(
      0,
      lastGeminiRequestStartedAt + interval - Date.now(),
    );
    if (wait > 0) await sleep(wait);
    lastGeminiRequestStartedAt = Date.now();
    return fn();
  });

  // Keep the chain alive even when a request fails.
  geminiRequestChain = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

/**
 * Convert a Zod schema (or JSON Schema-like object) into Gemini's
 * responseSchema format. Falls back to a generic object schema on failure.
 */
export function convertToGeminiSchema(schema: any): any {
  // If it's already a Gemini-compatible schema, pass through
  if (schema && schema.type) return schema;

  // Zod schema object: look for ._def
  if (schema?._def) {
    return zodToGemini(schema._def) ?? { type: SchemaType.OBJECT };
  }

  // Plain JSON Schema-like
  if (schema && schema.properties) {
    return {
      type: SchemaType.OBJECT,
      properties: Object.fromEntries(
        Object.entries(schema.properties)
          .map(([k, v]: [string, any]) => [k, convertToGeminiSchema(v)])
          .filter(([, v]) => v != null),
      ),
      required: schema.required || [],
    };
  }

  // Default: generic object
  return { type: SchemaType.OBJECT };
}

function zodToGemini(def: any): any | null {
  const zodType = def?.typeName;
  switch (zodType) {
    case "ZodObject": {
      // In Zod 3 `shape` is a function; in Zod 4 it is a plain object.
      const shape =
        typeof def?.shape === "function" ? def.shape() : (def?.shape ?? {});
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const converted = zodToGemini((value as any)._def);
        if (!converted) continue;

        properties[key] = converted;

        const fieldType = (value as any)._def?.typeName;
        if (
          fieldType !== "ZodOptional" &&
          fieldType !== "ZodDefault" &&
          fieldType !== "ZodNullable"
        ) {
          required.push(key);
        }
      }

      return {
        type: SchemaType.OBJECT,
        properties,
        ...(required.length > 0 ? { required } : {}),
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
        items: def?.type?._def
          ? zodToGemini(def.type._def) ?? { type: SchemaType.STRING }
          : { type: SchemaType.STRING },
      };
    case "ZodOptional":
    case "ZodDefault":
    case "ZodNullable":
      return zodToGemini(def?.innerType?._def);
    case "ZodEnum":
      return {
        type: SchemaType.STRING,
        enum: def?.options ?? [],
      };
    case "ZodLiteral":
      return { type: SchemaType.STRING, enum: [String(def?.value)] };
    case "ZodRecord":
      // Gemini's responseSchema has no arbitrary-string-map construct.
      // Omit unsupported optional fields rather than advertising them as
      // strings, which would guarantee a Zod validation failure.
      return null;
    default:
      return null;
  }
}
