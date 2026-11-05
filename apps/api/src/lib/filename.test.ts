import { describe, expect, it } from "vitest";
import { documentExportFilename, safeDownloadFilename } from "./filename.js";

describe("download filenames", () => {
  it("uses the document title instead of a storage UUID", () => {
    expect(
      documentExportFilename(
        "Smart Irrigation System — Project Synopsis",
        2,
        "docx",
      ),
    ).toBe("Smart Irrigation System Project Synopsis v2.docx");
  });

  it("removes characters that are invalid in common filesystems", () => {
    expect(
      safeDownloadFilename('A/B: "Final" <Report>?', "Fallback"),
    ).toBe("A B Final Report");
  });

  it("keeps the first version suffix-free and handles empty titles", () => {
    expect(documentExportFilename("Synopsis", 1, "pdf")).toBe("Synopsis.pdf");
    expect(documentExportFilename("   ", 1, "docx")).toBe(
      "Scribe document.docx",
    );
  });

  it("does not duplicate a file extension that is already in the title", () => {
    expect(documentExportFilename("Report.docx", 3, "docx")).toBe(
      "Report v3.docx",
    );
  });
});
