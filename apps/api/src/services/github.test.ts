import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchGitHubRepoText, ingestGitHubResource } from "./github.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchGitHubRepoText", () => {
  it("includes the README and text files but skips binaries and ignored paths", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.endsWith("/repos/owner/repo")) {
          return jsonResponse({ default_branch: "main", language: "TypeScript" });
        }
        if (url.endsWith("/repos/owner/repo/readme")) {
          return jsonResponse({
            content: Buffer.from("# Smart Irrigation\nA soil moisture project.").toString(
              "base64",
            ),
            encoding: "base64",
          });
        }
        if (url.includes("/git/trees/main")) {
          return jsonResponse({
            tree: [
              { path: "README.md", type: "blob", size: 10 },
              { path: "src/app.ts", type: "blob", size: 20 },
              { path: "logo.png", type: "blob", size: 30 },
              { path: "node_modules/pkg/index.js", type: "blob", size: 40 },
              { path: "package-lock.json", type: "blob", size: 50 },
            ],
          });
        }
        if (url.includes("/src/app.ts")) {
          return textResponse("export const moisture = 42;");
        }
        return textResponse("unexpected", 404);
      }),
    );

    const result = await fetchGitHubRepoText("owner/repo");

    expect(result.text).toContain("# Smart Irrigation");
    expect(result.text).toContain("### src/app.ts");
    expect(result.text).toContain("export const moisture = 42;");
    expect(result.text).not.toContain("logo.png");
    expect(result.text).not.toContain("node_modules");
    expect(result.fileCount).toBe(2);
  });

  it("fails clearly when the repository is missing or private", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "Not Found" }, 404)),
    );

    await expect(fetchGitHubRepoText("owner/missing")).rejects.toThrow(
      /private or missing/i,
    );
  });

  it("fails when the repository contains no readable text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: any) => {
        const url = String(input);
        if (url.endsWith("/repos/owner/repo")) {
          return jsonResponse({ default_branch: "main" });
        }
        if (url.endsWith("/readme")) {
          return jsonResponse({ message: "Not Found" }, 404);
        }
        if (url.includes("/git/trees/")) {
          return jsonResponse({
            tree: [{ path: "image.png", type: "blob", size: 10 }],
          });
        }
        return textResponse("", 404);
      }),
    );

    await expect(fetchGitHubRepoText("owner/repo")).rejects.toThrow(
      /no readable text/i,
    );
  });
});

describe("ingestGitHubResource", () => {
  it("records a failed status when fetching throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "boom" }, 500)),
    );

    const updateRow = vi.fn(
      async (_id: string, _patch: Record<string, unknown>) => {},
    );
    const readMetadata = vi.fn(async () => ({ name: "owner/repo" }));

    await ingestGitHubResource("resource-1", "owner/repo", updateRow, readMetadata);

    expect(updateRow).toHaveBeenCalledTimes(1);
    const patch = updateRow.mock.calls[0][1] as any;
    expect(patch.processing_status).toBe("failed");
    expect(patch.metadata).toMatchObject({ name: "owner/repo" });
    expect(patch.metadata.ingestion_error).toBeTruthy();
  });
});
