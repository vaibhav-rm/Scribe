import { logger } from "../lib/logger.js";

/**
 * GitHub repository text ingestion.
 *
 * Only public github.com repositories are supported. We fetch a bounded set
 * of text files (README plus up to a dozen source/doc files) through the
 * GitHub API and raw.githubusercontent.com. Code is read as text and is never
 * executed. This is deliberately not a full clone: large repositories are
 * truncated, and the fact is recorded in the resource metadata.
 */

const API_BASE = "https://api.github.com";
const RAW_BASE = "https://raw.githubusercontent.com";

const MAX_FILES = 15;
const MAX_FILE_CHARS = 8_000;
const MAX_TOTAL_CHARS = 60_000;

const TEXT_EXTENSIONS = new Set([
  ".md", ".markdown", ".txt", ".rst", ".adoc",
  ".py", ".java", ".js", ".jsx", ".ts", ".tsx", ".c", ".h", ".cpp", ".hpp",
  ".cs", ".go", ".rb", ".php", ".kt", ".swift", ".rs", ".sql",
  ".json", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".xml",
  ".html", ".css", ".scss", ".sh", ".ipynb",
]);

const IGNORED_SEGMENTS = [
  "node_modules/", ".git/", "dist/", "build/", "out/", "vendor/",
  "coverage/", "__pycache__/", ".next/", "target/",
];

function isMeaningfulFile(path: string): boolean {
  const lower = path.toLowerCase();
  if (lower.split("/").some((part) => part.startsWith("."))) return false;
  if (IGNORED_SEGMENTS.some((seg) => lower.includes(seg))) return false;
  if (lower.endsWith(".min.js") || lower.endsWith(".min.css")) return false;
  if (lower.endsWith(".lock") || lower.endsWith("-lock.json")) return false;
  const dot = lower.lastIndexOf(".");
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(lower.slice(dot));
}

async function githubJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Scribe",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(
      `GitHub API request failed (${res.status}). The repository may be private or missing.`,
    );
  }

  return (await res.json()) as T;
}

interface GitHubRepoInfo {
  default_branch?: string;
  description?: string | null;
  language?: string | null;
}

interface GitHubTree {
  tree?: Array<{ path: string; type: string; size?: number }>;
}

/**
 * Fetch a public repository's README and a bounded selection of text files.
 * Returns the combined text plus a count of files that were included.
 */
export async function fetchGitHubRepoText(
  repoPath: string,
): Promise<{ text: string; fileCount: number; truncated: boolean }> {
  const [owner, repo] = repoPath.split("/");
  if (!owner || !repo) {
    throw new Error("Expected a repository in owner/repo form");
  }

  const repoInfo = await githubJson<GitHubRepoInfo>(
    `${API_BASE}/repos/${owner}/${repo}`,
  );
  const branch = repoInfo.default_branch || "main";

  let readme = "";
  try {
    const readmeJson = await githubJson<{ content?: string; encoding?: string }>(
      `${API_BASE}/repos/${owner}/${repo}/readme`,
    );
    if (readmeJson.content) {
      readme = Buffer.from(
        readmeJson.content,
        readmeJson.encoding === "base64" ? "base64" : "utf8",
      ).toString("utf8");
    }
  } catch {
    // A repository without a README is still usable.
  }

  const tree = await githubJson<GitHubTree>(
    `${API_BASE}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );

  const candidates = (tree.tree ?? [])
    .filter((node) => node.type === "blob" && isMeaningfulFile(node.path))
    // Prefer smaller, documentation-ish files first so the budget is spent
    // on readable source rather than one generated bundle.
    .sort((a, b) => (a.size ?? 0) - (b.size ?? 0))
    .slice(0, MAX_FILES);

  const parts: string[] = [];
  let total = 0;
  let truncated = false;

  if (readme.trim()) {
    const take = readme.slice(0, MAX_FILE_CHARS);
    truncated = truncated || readme.length > take.length;
    parts.push(`### README.md\n${take}`);
    total += take.length;
  }

  for (const node of candidates) {
    if (total >= MAX_TOTAL_CHARS) {
      truncated = true;
      break;
    }

    try {
      const res = await fetch(
        `${RAW_BASE}/${owner}/${repo}/${branch}/${node.path}`,
        {
          headers: { "User-Agent": "Scribe" },
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!res.ok) continue;

      const raw = await res.text();
      const budget = Math.min(MAX_FILE_CHARS, MAX_TOTAL_CHARS - total);
      const take = raw.slice(0, budget);
      truncated = truncated || raw.length > take.length;

      if (take.trim()) {
        parts.push(`### ${node.path}\n${take}`);
        total += take.length;
      }
    } catch {
      // Skip unreadable files rather than failing the whole ingestion.
    }
  }

  if (parts.length === 0) {
    throw new Error(
      "No readable text files were found in this repository. Add a README or documentation files.",
    );
  }

  return {
    text: parts.join("\n\n"),
    fileCount: parts.length,
    truncated,
  };
}

/**
 * Ingest a queued GitHub resource into its `extracted_text` column.
 * Failures are recorded on the resource instead of being silently hidden.
 */
export async function ingestGitHubResource(
  resourceId: string,
  repoPath: string,
  updateRow: (id: string, patch: Record<string, unknown>) => Promise<void>,
  readMetadata: (id: string) => Promise<Record<string, unknown>>,
): Promise<void> {
  try {
    const { text, fileCount, truncated } = await fetchGitHubRepoText(repoPath);
    const metadata = await readMetadata(resourceId);

    await updateRow(resourceId, {
      extracted_text: text,
      processing_status: "completed",
      metadata: {
        ...metadata,
        ingested_file_count: fileCount,
        ingested_at: new Date().toISOString(),
        truncated,
        status_note: truncated
          ? "Repository ingested with truncation (size limit)"
          : "Repository ingested",
      },
    });

    logger.info({ resourceId, repoPath, fileCount }, "github ingestion complete");
  } catch (err: any) {
    logger.warn({ err, resourceId, repoPath }, "github ingestion failed");

    try {
      const metadata = await readMetadata(resourceId);
      await updateRow(resourceId, {
        processing_status: "failed",
        metadata: {
          ...metadata,
          ingestion_error: err?.message ?? "GitHub ingestion failed",
          status_note: "GitHub ingestion failed",
        },
      });
    } catch (updateErr) {
      logger.error(
        { err: updateErr, resourceId },
        "failed to record github ingestion failure",
      );
    }
  }
}
