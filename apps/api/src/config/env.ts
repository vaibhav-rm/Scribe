import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from the current working directory (apps/api when started through
// npm workspaces) and fall back to the repository-root .env. dotenv does not
// override variables that are already set, so the closest file wins. Tests
// skip file loading entirely to stay hermetic.
if (process.env.NODE_ENV !== "test") {
  dotenv.config();
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(moduleDir, "../../../../.env") });
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_URL: z.string().url().default("http://localhost:4000"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  API_PREFIX: z.string().default("/api/v1"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // AI providers
  AI_PROVIDER: z.enum(["gemini", "xai", "anthropic"]).default("gemini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  XAI_API_KEY: z.string().optional(),
  XAI_MODEL: z.string().default("grok-3"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-3-haiku-20240307"),

  // Billing (Razorpay)
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_PLAN_ID_FREE: z.string().optional(),
  RAZORPAY_PLAN_ID_PRO: z.string().optional(),

  // File limits
  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(15),

  // CORS
  CORS_ORIGINS: z.string().default("http://localhost:5173"),

  // Logging
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Document conversion
  LIBREOFFICE_PATH: z.string().default("libreoffice"),
  DOC_CONVERSION_ENABLED: z
    .preprocess(
      (val) => (typeof val === "string" ? val === "true" : Boolean(val)),
      z.boolean().default(false),
    ),

  // Generation execution model:
  //   inline — run the pipeline in the API process right after enqueueing
  //   worker — leave jobs queued for `npm run dev:worker` to claim
  GENERATION_MODE: z.enum(["inline", "worker"]).default("inline"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  CONCURRENT_JOBS: z.coerce.number().int().positive().default(2),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables. Re-parses on every call so that
 * tests can set process.env before calling. No module-level caching.
 */
export function getEnv(): Env {
  return envSchema.parse(process.env);
}
