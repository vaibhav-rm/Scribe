import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { getEnv } from "../config/env.js";
import { logger } from "../lib/logger.js";

const execFileAsync = promisify(execFile);

/**
 * Result of a document conversion.
 */
export interface ConversionResult {
  outputPath: string;
  outputMimeType: string;
  sizeBytes: number;
}

/**
 * Document conversion adapter interface.
 *
 * Implementations convert a DOCX file to another format (e.g. PDF).
 * The interface is replaceable so the app works whether or not LibreOffice
 * is installed on the host.
 */
export interface DocumentConverter {
  readonly name: string;
  readonly supportedFormats: string[];

  /**
   * Check if this converter is available on the current host.
   */
  isAvailable(): boolean;

  /**
   * Convert a DOCX file at `inputPath` to `targetFormat` (e.g. "pdf").
   * Returns the path to the converted file.
   */
  convert(inputPath: string, targetFormat: string): Promise<ConversionResult>;
}

/**
 * LibreOffice headless converter.
 *
 * Converts DOCX to PDF using `libreoffice --headless --convert-to pdf`.
 * Requires LibreOffice to be installed on the host and DOC_CONVERSION_ENABLED=true.
 */
export class LibreOfficeConverter implements DocumentConverter {
  readonly name = "libreoffice";
  readonly supportedFormats = ["pdf"];

  private readonly libreOfficePath: string;
  private readonly enabled: boolean;

  constructor() {
    const e = getEnv();
    this.libreOfficePath = e.LIBREOFFICE_PATH;
    this.enabled = e.DOC_CONVERSION_ENABLED;
  }

  isAvailable(): boolean {
    if (!this.enabled) {
      return false;
    }
    try {
      // Synchronously probe for the executable
      require("node:child_process").execFileSync(this.libreOfficePath, [
        "--version",
      ]);
      return true;
    } catch {
      return false;
    }
  }

  async convert(inputPath: string, targetFormat: string): Promise<ConversionResult> {
    if (!this.isAvailable()) {
      throw new Error(
        "LibreOffice is not available or DOC_CONVERSION_ENABLED is false. PDF export is disabled.",
      );
    }

    if (!this.supportedFormats.includes(targetFormat)) {
      throw new Error(
        `LibreOffice converter does not support target format: ${targetFormat}`,
      );
    }

    const outDir = path.dirname(inputPath);

    try {
      await execFileAsync(
        this.libreOfficePath,
        [
          "--headless",
          "--convert-to",
          targetFormat,
          "--outdir",
          outDir,
          inputPath,
        ],
        { timeout: 120_000 }, // 2 minute timeout
      );
    } catch (err: any) {
      logger.error({ err, inputPath, targetFormat }, "LibreOffice conversion failed");
      throw new Error(
        `Document conversion failed: ${err?.message ?? String(err)}`,
      );
    }

    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(outDir, `${baseName}.${targetFormat}`);

    // Verify output exists
    try {
      await fs.access(outputPath);
    } catch {
      throw new Error(`Conversion produced no output file: ${outputPath}`);
    }

    const stat = await fs.stat(outputPath);

    return {
      outputPath,
      outputMimeType: targetFormat === "pdf" ? "application/pdf" : `application/${targetFormat}`,
      sizeBytes: stat.size,
    };
  }
}

/**
 * No-op converter used when LibreOffice is unavailable.
 * All export calls will fail with a clear message explaining PDF is unavailable.
 */
export class NoOpConverter implements DocumentConverter {
  readonly name = "noop";
  readonly supportedFormats = [];

  isAvailable(): boolean {
    return false;
  }

  async convert(_inputPath: string, _targetFormat: string): Promise<ConversionResult> {
    throw new Error(
      "PDF export is not available in this deployment. DOCX export is still functional. " +
        "Install LibreOffice and set DOC_CONVERSION_ENABLED=true to enable PDF export.",
    );
  }
}

/**
 * Factory: returns the best available converter.
 */
export function createConverter(): DocumentConverter {
  const libreOffice = new LibreOfficeConverter();
  if (libreOffice.isAvailable()) {
    logger.info({ converter: "libreoffice" }, "Document converter initialized");
    return libreOffice;
  }
  logger.info({ converter: "noop" }, "Document converter initialized (PDF export disabled)");
  return new NoOpConverter();
}

/**
 * Create a temporary directory for conversion work.
 */
export async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scribe-"));
  return dir;
}
