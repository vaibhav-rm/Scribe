/**
 * Build a human-readable filename for a generated document download.
 *
 * Storage object keys stay UUID-based (they are private implementation
 * details), but the signed URL is created with this name so the browser
 * saves something the user can recognise.
 */
export function safeDownloadFilename(
  input: string | null | undefined,
  fallback = "Scribe document",
): string {
  const cleaned = (input ?? "")
    .normalize("NFKD")
    // Keep filenames portable across Windows, macOS, and Linux. Strip
    // combining marks and anything outside printable ASCII.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/[\\/:*?"<>|\r\n]+/g, " ")
    .replace(/\.(docx|pdf)$/i, "")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .trim()
    .slice(0, 120)
    .trim();

  return cleaned || fallback;
}

export function documentExportFilename(
  title: string | null | undefined,
  versionNumber: number | null | undefined,
  format: "docx" | "pdf",
): string {
  const base = safeDownloadFilename(title, "Scribe document");
  const version =
    typeof versionNumber === "number" && Number.isFinite(versionNumber) && versionNumber > 1
      ? ` v${Math.floor(versionNumber)}`
      : "";
  return `${base}${version}.${format}`;
}
