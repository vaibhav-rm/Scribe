import { describe, it, expect } from "vitest";

// Set required env vars before importing modules that load config
process.env.NODE_ENV = "test";
process.env.PORT = "4000";
process.env.API_URL = "http://localhost:4000";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.API_PREFIX = "/api/v1";
process.env.CORS_ORIGINS = "http://localhost:5173";
process.env.LOG_LEVEL = "error";
process.env.DOC_CONVERSION_ENABLED = "false";

import { createConverter, NoOpConverter, LibreOfficeConverter } from "../services/conversion.js";

describe("Document conversion", () => {
  describe("createConverter", () => {
    it("returns a converter instance", () => {
      const converter = createConverter();
      expect(converter).toBeDefined();
      expect(typeof converter.isAvailable).toBe("function");
      expect(typeof converter.convert).toBe("function");
    });
  });

  describe("NoOpConverter", () => {
    const converter = new NoOpConverter();

    it("is not available", () => {
      expect(converter.isAvailable()).toBe(false);
    });

    it("has no supported formats", () => {
      expect(converter.supportedFormats).toEqual([]);
    });

    it("throws a clear error on convert", async () => {
      await expect(converter.convert("/tmp/foo.docx", "pdf")).rejects.toThrow(
        /PDF export is not available/,
      );
    });
  });

  describe("LibreOfficeConverter", () => {
    const converter = new LibreOfficeConverter();

    it("reports availability based on env flag", () => {
      // Without DOC_CONVERSION_ENABLED=true, should be unavailable
      expect(converter.isAvailable()).toBe(false);
    });

    it("reports pdf as supported format", () => {
      expect(converter.supportedFormats).toContain("pdf");
    });
  });
});
