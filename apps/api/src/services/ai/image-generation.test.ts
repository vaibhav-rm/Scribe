import { afterEach, describe, expect, it, vi } from "vitest";
import { generateTemplateImages } from "./image-generation.js";
import type { ProjectKnowledge } from "./schemas.js";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const knowledge: ProjectKnowledge = {
  title: "Smart Irrigation System",
  abstract: "A sensor-driven irrigation controller for small farms.",
  architecture: "Soil sensors feed an ESP32 controller that opens valves.",
  technology_stack: ["ESP32", "Soil moisture sensor"],
  objectives: [],
  limitations: [],
  future_work: [],
  references: [],
  missing_facts: [],
  source_references: {},
};

const input = {
  placeholders: [
    {
      index: 0,
      caption: "Figure 1: System architecture",
      prompt: "[Insert system architecture diagram here]",
      sectionHeading: "System Architecture",
    },
  ],
  projectTitle: "Smart Irrigation System",
  documentType: "project_synopsis",
  knowledge,
  sections: [
    {
      heading: "System Architecture",
      content: "Soil sensors connect to an ESP32 that controls water valves.",
    },
  ],
  resources: [{ name: "project-notes.txt", content: "ESP32 and valve driver." }],
};

process.env.SUPABASE_URL =
  process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";
process.env.LOG_LEVEL = "error";

const originalKey = process.env.GEMINI_API_KEY;
const originalEnabled = process.env.GEMINI_IMAGE_ENABLED;
const originalModel = process.env.GEMINI_IMAGE_MODEL;

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [key, value] of [
    ["GEMINI_API_KEY", originalKey],
    ["GEMINI_IMAGE_ENABLED", originalEnabled],
    ["GEMINI_IMAGE_MODEL", originalModel],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("template figure generation", () => {
  it("returns a null image for every placeholder when image generation is disabled", async () => {
    process.env.GEMINI_IMAGE_ENABLED = "false";
    process.env.GEMINI_API_KEY = "test-key";

    const result = await generateTemplateImages(input);

    expect(result.images).toEqual([null]);
    expect(result.warnings.join(" ")).toContain("disabled");
  });

  it("keeps a null image when no Gemini key is configured", async () => {
    process.env.GEMINI_IMAGE_ENABLED = "true";
    delete process.env.GEMINI_API_KEY;

    const result = await generateTemplateImages(input);

    expect(result.images).toEqual([null]);
    expect(result.warnings.join(" ")).toContain("No Gemini API key");
  });

  it("requests a figure with project context and returns the image bytes", async () => {
    process.env.GEMINI_IMAGE_ENABLED = "true";
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_IMAGE_MODEL = "test-image-model";

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: ONE_PIXEL_PNG.toString("base64"),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateTemplateImages(input);

    expect(result.warnings).toEqual([]);
    expect(result.images).toHaveLength(1);
    expect(result.images[0]?.mimeType).toBe("image/png");
    expect(result.images[0]?.buffer.equals(ONE_PIXEL_PNG)).toBe(true);
    expect(result.images[0]?.caption).toBe("Figure 1: System architecture");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("test-image-model:generateContent");
    const body = JSON.parse(String(init.body));
    const prompt = body.contents[0].parts[0].text as string;
    expect(prompt).toContain("Smart Irrigation System");
    expect(prompt).toContain("Figure 1: System architecture");
    expect(prompt).toContain("Soil sensors connect to an ESP32");
    expect(prompt).toContain("ESP32 and valve driver.");
  });

  it("stops early when the image provider quota is exhausted", async () => {
    process.env.GEMINI_IMAGE_ENABLED = "true";
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_IMAGE_MODEL = "test-image-model";

    const fetchMock = vi.fn(async () =>
      new Response(
        "RESOURCE_EXHAUSTED: quota exceeded for this model",
        { status: 429, headers: { "Content-Type": "text/plain" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateTemplateImages({
      ...input,
      placeholders: [
        input.placeholders[0],
        { ...input.placeholders[0], index: 1, caption: "Figure 2: Flow" },
      ],
    });

    expect(result.images).toEqual([null, null]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.warnings.join(" ")).toContain("quota is exhausted");
  });

  it("keeps the placeholder and reports a warning when the provider fails", async () => {
    process.env.GEMINI_IMAGE_ENABLED = "true";
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_IMAGE_MODEL = "test-image-model";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("model unavailable", {
          status: 404,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await generateTemplateImages(input);

    expect(result.images).toEqual([null]);
    expect(result.warnings.join(" ")).toContain("placeholder was kept");
    expect(result.warnings.join(" ")).toContain("404");
  });
});
