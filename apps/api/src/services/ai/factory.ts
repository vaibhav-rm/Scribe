import { AIProvider, loadAIConfig } from "./provider.js";
import { GeminiProvider } from "./gemini.js";
import { logger } from "../../lib/logger.js";

/**
 * Extension point: add GrokProvider and ClaudeProvider here when those
 * providers are configured. Only instantiate providers that have API keys.
 */
export function createAIProvider(): AIProvider | null {
  const config = loadAIConfig();

  if (config.provider === "gemini") {
    if (!config.gemini) {
      logger.warn("AI_PROVIDER=gemini but GEMINI_API_KEY is not set");
      return null;
    }
    return new GeminiProvider(config.gemini);
  }

  if (config.provider === "xai") {
    if (!config.xai) {
      logger.warn("AI_PROVIDER=xai but XAI_API_KEY is not set");
      return null;
    }
    // Placeholder: Grok provider not yet implemented
    logger.warn("xAI Grok provider is not yet implemented; returning null");
    return null;
  }

  if (config.provider === "anthropic") {
    if (!config.anthropic) {
      logger.warn("AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set");
      return null;
    }
    // Placeholder: Claude provider not yet implemented
    logger.warn("Anthropic Claude provider is not yet implemented; returning null");
    return null;
  }

  logger.warn(`Unknown AI provider: ${config.provider}`);
  return null;
}

/**
 * Get the configured provider, throwing a clear error if unavailable.
 * Use this in generation paths where a provider is required.
 */
export function getRequiredAIProvider(): AIProvider {
  const provider = createAIProvider();
  if (!provider) {
    throw new Error(
      "No AI provider is configured. Set AI_PROVIDER=gemini and GEMINI_API_KEY, " +
        "or configure xAI/Anthropic.",
    );
  }
  return provider;
}

export { GeminiProvider };
export type { AIProvider };
