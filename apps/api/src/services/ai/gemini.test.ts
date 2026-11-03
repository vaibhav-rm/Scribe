import { describe, it, expect } from "vitest";
import { SchemaType } from "@google/generative-ai";
import { convertToGeminiSchema } from "./gemini.js";
import {
  DocumentSectionSchema,
  ProjectKnowledgeSchema,
} from "./schemas.js";

describe("convertToGeminiSchema", () => {
  it("preserves required strings and array defaults for section output", () => {
    const schema = convertToGeminiSchema(DocumentSectionSchema);

    expect(schema.type).toBe(SchemaType.OBJECT);
    expect(schema.required).toEqual(
      expect.arrayContaining(["id", "heading", "content"]),
    );
    expect(schema.properties.id.type).toBe(SchemaType.STRING);
    expect(schema.properties.content.type).toBe(SchemaType.STRING);

    // `.optional().default([])` must stay an array, not become a string.
    expect(schema.properties.source_references.type).toBe(SchemaType.ARRAY);
    expect(schema.properties.source_references.items.type).toBe(
      SchemaType.STRING,
    );
    expect(schema.properties.warnings.type).toBe(SchemaType.ARRAY);
    expect(schema.properties.word_count.type).toBe(SchemaType.NUMBER);
  });

  it("handles nested objects and omits unsupported arbitrary maps", () => {
    const schema = convertToGeminiSchema(ProjectKnowledgeSchema);

    expect(schema.required).toEqual(
      expect.arrayContaining(["title", "abstract"]),
    );
    expect(schema.properties.objectives.type).toBe(SchemaType.ARRAY);
    expect(schema.properties.references.type).toBe(SchemaType.ARRAY);
    expect(schema.properties.references.items.type).toBe(SchemaType.OBJECT);
    expect(schema.properties.references.items.properties.title.type).toBe(
      SchemaType.STRING,
    );

    // Gemini's responseSchema has no string-map type, so the optional
    // source_references record is omitted rather than mistyped as a string.
    expect(schema.properties.source_references).toBeUndefined();
  });
});
