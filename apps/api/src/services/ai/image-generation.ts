import { getEnv } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import type { TemplateImagePlaceholder } from "../docx-template.js";
import type { ProjectKnowledge } from "./schemas.js";

export interface GeneratedImage {
  index: number;
  buffer: Buffer;
  mimeType: string;
  caption: string;
  altText: string;
}

export interface GenerateTemplateImagesInput {
  placeholders: TemplateImagePlaceholder[];
  projectTitle: string;
  projectDescription?: string | null;
  documentType: string;
  knowledge: ProjectKnowledge;
  sections: Array<{ heading: string; content: string }>;
  resources: Array<{ name: string; content?: string }>;
}

export interface ImageGenerationResult {
  /** One entry per template placeholder; null keeps the visible placeholder. */
  images: Array<GeneratedImage | null>;
  warnings: string[];
}

const IMAGE_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function relevantSectionContext(
  input: GenerateTemplateImagesInput,
  placeholder: TemplateImagePlaceholder,
): string {
  if (!placeholder.sectionHeading) return "";
  const target = normalize(placeholder.sectionHeading);
  const exact = input.sections.find(
    (section) => normalize(section.heading) === target,
  );
  const section =
    exact ??
    input.sections.find((candidate) => {
      const heading = normalize(candidate.heading);
      return heading.includes(target) || target.includes(heading);
    });

  if (!section) return "";
  return `Section heading: ${section.heading}\nSection content:\n${section.content.slice(0, 3500)}`;
}

function knowledgeContext(knowledge: ProjectKnowledge): string {
  const facts: Array<[string, unknown]> = [
    ["Abstract", knowledge.abstract],
    ["Problem statement", knowledge.problem_statement],
    ["Motivation", knowledge.motivation],
    ["Objectives", knowledge.objectives],
    ["Existing system", knowledge.existing_system],
    ["Proposed system", knowledge.proposed_system],
    ["Architecture", knowledge.architecture],
    ["Methodology", knowledge.methodology],
    ["Technology stack", knowledge.technology_stack],
    ["Implementation details", knowledge.implementation_details],
    ["Testing approach", knowledge.testing_approach],
    ["Actual results", knowledge.actual_results],
    ["Limitations", knowledge.limitations],
    ["Future work", knowledge.future_work],
  ];

  return facts
    .map(([label, value]) => {
      if (value === undefined || value === null) return "";
      if (Array.isArray(value)) {
        return value.length ? `${label}: ${value.join("; ")}` : "";
      }
      const text = String(value).trim();
      return text ? `${label}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);
}

function resourceContext(
  resources: Array<{ name: string; content?: string }>,
): string {
  let remaining = 5000;
  const excerpts: string[] = [];

  for (const resource of resources) {
    if (!resource.content || remaining <= 0) continue;
    const excerpt = resource.content.slice(0, Math.min(1800, remaining));
    remaining -= excerpt.length;
    excerpts.push(
      `[${resource.name}]\n${excerpt}${resource.content.length > excerpt.length ? "\n[... truncated ...]" : ""}`,
    );
  }

  return excerpts.join("\n\n---\n\n");
}

function buildImagePrompt(
  input: GenerateTemplateImagesInput,
  placeholder: TemplateImagePlaceholder,
): string {
  const section = relevantSectionContext(input, placeholder);
  const facts = knowledgeContext(input.knowledge);
  const sources = resourceContext(input.resources);

  return `Create a publication-ready technical figure for an academic document.

Project title: ${input.projectTitle}
Document type: ${input.documentType}
Figure caption: ${placeholder.caption}
Template instruction: ${placeholder.prompt}
Section: ${placeholder.sectionHeading ?? "(general)"}

Project facts (from the student's attached sources):
${facts || "(no structured facts available)"}

${section}

Source excerpts (use these to keep labels accurate):
${sources || "(no additional excerpts)"}

Visual direction:
- Draw a clean, logical diagram or explanatory illustration that matches the caption and section.
- Use only components, labels, and relationships that are supported by the context. If a detail is missing, use a generic label such as "Component" rather than inventing a specific name, number, or result.
- Use a white background, dark ink-blue lines and text, and a restrained safety-orange accent for emphasis.
- Use legible sans-serif labels, clear boxes, and directional arrows.
- Keep generous margins and a landscape composition suitable for an A4 report.
- Do not include the figure caption, a title, a watermark, or decorative background in the image.
- Do not add logos, photographs, or unrelated decoration.`;
}

interface GeminiImageResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType?: string; data?: string };
        inline_data?: { mime_type?: string; data?: string };
      }>;
    };
  }>;
}

async function requestImage(
  prompt: string,
  model: string,
  apiKey: string,
  timeoutMs: number,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${IMAGE_ENDPOINT}/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: { aspectRatio: "16:9" },
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Gemini image request failed (${response.status}): ${body.slice(0, 400)}`,
      );
    }

    const json = (await response.json()) as GeminiImageResponse;
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      (part) => part.inlineData?.data || part.inline_data?.data,
    );
    if (!imagePart) {
      const text = parts
        .map((part) => part.text)
        .filter(Boolean)
        .join(" ")
        .slice(0, 400);
      throw new Error(
        `Gemini returned no image${text ? `: ${text}` : ""}`,
      );
    }

    const data =
      imagePart.inlineData?.data ?? imagePart.inline_data?.data ?? "";
    const mimeType =
      imagePart.inlineData?.mimeType ??
      imagePart.inline_data?.mime_type ??
      "image/png";
    const buffer = Buffer.from(data, "base64");
    if (buffer.length === 0) {
      throw new Error("Gemini returned an empty image");
    }

    return { buffer, mimeType };
  } finally {
    clearTimeout(timeout);
  }
}

function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\(429\)|\(5\d\d\)|timeout|aborted|ECONNRESET|ETIMEDOUT/i.test(
    message,
  );
}

async function requestImageWithRetry(
  prompt: string,
  model: string,
  apiKey: string,
  timeoutMs: number,
): Promise<{ buffer: Buffer; mimeType: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await requestImage(prompt, model, apiKey, timeoutMs);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (
        attempt === 2 ||
        !isRetryable(error) ||
        /RESOURCE_EXHAUSTED|quota/i.test(message)
      ) {
        break;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, 2000 * (attempt + 1)),
      );
    }
  }
  throw lastError;
}

/**
 * Generate figures for every image placeholder in a template.
 *
 * Image generation is deliberately best-effort: a provider error must never
 * fail the whole document. The renderer keeps the visible template placeholder
 * for any figure that could not be generated.
 */
export async function generateTemplateImages(
  input: GenerateTemplateImagesInput,
): Promise<ImageGenerationResult> {
  const images: Array<GeneratedImage | null> = input.placeholders.map(
    () => null,
  );
  const warnings: string[] = [];

  if (input.placeholders.length === 0) {
    return { images, warnings };
  }

  const env = getEnv();
  if (!env.GEMINI_IMAGE_ENABLED) {
    warnings.push(
      "Image generation is disabled (GEMINI_IMAGE_ENABLED=false); template figure placeholders were kept.",
    );
    return { images, warnings };
  }
  if (!env.GEMINI_API_KEY) {
    warnings.push(
      "No Gemini API key is configured; template figure placeholders were kept.",
    );
    return { images, warnings };
  }

  const limit = Math.min(
    input.placeholders.length,
    env.GEMINI_IMAGE_MAX_FIGURES,
  );
  if (input.placeholders.length > limit) {
    warnings.push(
      `${input.placeholders.length - limit} figure placeholder(s) were left for manual insertion because GEMINI_IMAGE_MAX_FIGURES is ${limit}.`,
    );
  }

  for (const placeholder of input.placeholders.slice(0, limit)) {
    try {
      const prompt = buildImagePrompt(input, placeholder);
      const generated = await requestImageWithRetry(
        prompt,
        env.GEMINI_IMAGE_MODEL,
        env.GEMINI_API_KEY,
        env.GEMINI_IMAGE_TIMEOUT_MS,
      );

      images[placeholder.index] = {
        index: placeholder.index,
        buffer: generated.buffer,
        mimeType: generated.mimeType,
        caption: placeholder.caption,
        altText: placeholder.caption,
      };
      logger.info(
        {
          figure: placeholder.index,
          caption: placeholder.caption,
          model: env.GEMINI_IMAGE_MODEL,
          bytes: generated.buffer.length,
        },
        "template figure generated",
      );
    } catch (error: any) {
      const message = error?.message ?? String(error);
      logger.warn(
        {
          figure: placeholder.index,
          caption: placeholder.caption,
          error: message,
          model: env.GEMINI_IMAGE_MODEL,
        },
        "template figure generation failed; placeholder kept",
      );
      warnings.push(
        `Could not generate "${placeholder.caption}"; the template placeholder was kept. ${message}`.slice(
          0,
          500,
        ),
      );

      // A quota exhaustion (common on free-tier image models) will fail for
      // every remaining figure too. Stop early instead of waiting through
      // retries for each placeholder.
      if (/RESOURCE_EXHAUSTED|quota/i.test(message)) {
        const remaining =
          input.placeholders.length - (placeholder.index + 1);
        if (remaining > 0) {
          warnings.push(
            `${remaining} remaining figure placeholder(s) were kept because the image provider quota is exhausted.`,
          );
        }
        break;
      }
    }
  }

  return { images, warnings };
}
