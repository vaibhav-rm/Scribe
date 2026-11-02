import { Router, Response } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import { AddTextResourceSchema } from "@projectscribe/shared";
import { validate } from "../middleware/validate.js";
import { storageAdmin, uploadFile, ensureBucket, type StorageBucket } from "../lib/storage.js";
import { extractTextFromBuffer, detectKind } from "../services/ingestion.js";
import { ingestGitHubResource } from "../services/github.js";
import { getEnv } from "../config/env.js";
import { logger } from "../lib/logger.js";
import multer from "multer";
import { randomUUID } from "node:crypto";
import path from "node:path";

const router = Router();

// Cap on stored extracted text. Generation prompts only use the first few
// thousand characters per source, so storing more than this wastes space.
const MAX_STORED_TEXT_CHARS = 500_000;

// Columns safe to return to clients. extracted_text is private: it is only
// read by the server-side generation pipeline, never by the HTTP API.
const PUBLIC_RESOURCE_COLUMNS =
  "id, project_id, resource_type, original_filename, storage_path, external_url, processing_status, metadata, created_at";

// In-memory multer storage (buffer) — files are immediately written to
// Supabase Storage and the temporary buffer is discarded.
const ALLOWED_SOURCE_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".rst", ".adoc",
  ".py", ".java", ".js", ".jsx", ".ts", ".tsx", ".c", ".h", ".cpp", ".hpp",
  ".cs", ".go", ".rb", ".php", ".kt", ".swift", ".rs", ".sql",
  ".json", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".xml",
  ".html", ".css", ".scss", ".sh", ".ipynb",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: getEnv().MAX_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
      "text/x-markdown",
      "application/javascript",
      "text/javascript",
      "application/typescript",
      "text/typescript",
      "text/x-python",
      "text/x-java",
      "text/x-c",
      "text/x-csrc",
      "text/x-c++src",
      "text/html",
      "text/css",
      "application/json",
      "application/xml",
      "text/xml",
      "application/yaml",
      "text/yaml",
      "text/x-toml",
    ]);
    // Browsers frequently report an empty or application/octet-stream MIME
    // type for source files, so fall back to the extension.
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowed.has(file.mimetype) || ALLOWED_SOURCE_EXTENSIONS.has(extension)) {
      cb(null, true);
    } else {
      const error = new Error(
        `Unsupported file type: ${file.originalname}. Allowed: PDF, DOCX, TXT, Markdown, and common source-code files.`,
      ) as Error & { status?: number };
      error.status = 400;
      cb(error);
    }
  },
});

type TextResourceReq = AuthRequest & {
  validated?: {
    params: { id: string };
    body: {
      name: string;
      content: string;
      source_type?:
        | "abstract"
        | "problem_statement"
        | "notes"
        | "methodology"
        | "results"
        | "other";
    };
  };
};

// POST /api/v1/projects/:id/resources/text
router.post(
  "/projects/:id/resources/text",
  authenticate,
  validate(AddTextResourceSchema),
  async (req: TextResourceReq, res: Response) => {
    const userId = req.user!.id;
    const { id: projectId } = req.validated!.params;
    const { name, content, source_type } = req.validated!.body;

    // Verify project ownership
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .single();

    if (projErr || !project) {
      res.status(404).json({
        error: "not_found",
        message: "Project not found or not accessible",
      });
      return;
    }

    // Enforce free-tier project limit is checked at project creation;
    // here we just record the resource.

    const { data: resource, error } = await supabaseAdmin
      .from("project_resources")
      .insert({
        project_id: projectId,
        owner_id: userId,
        resource_type: "text",
        original_filename: null,
        storage_path: null,
        external_url: null,
        processing_status: "completed",
        extracted_text: content.slice(0, MAX_STORED_TEXT_CHARS),
        metadata: {
          name,
          source_type: source_type ?? "other",
          extracted_text_length: content.length,
          word_count: content.trim().split(/\s+/).filter(Boolean).length,
          truncated: content.length > MAX_STORED_TEXT_CHARS,
        },
      })
      .select(PUBLIC_RESOURCE_COLUMNS)
      .single();

    if (error || !resource) {
      logger.error({ error, userId, projectId }, "create text resource failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to create text resource",
      });
      return;
    }

    res.status(201).json({ resource });
  },
);

// POST /api/v1/projects/:id/resources/upload
router.post(
  "/projects/:id/resources/upload",
  authenticate,
  upload.single("file"),
  async (req: AuthRequest & { file?: Express.Multer.File }, res: Response) => {
    const userId = req.user!.id;
    const { id: projectId } = req.params;

    if (!req.file) {
      res.status(400).json({
        error: "validation_failed",
        message: "No file provided",
      });
      return;
    }

    // Verify project ownership
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .single();

    if (projErr || !project) {
      res.status(404).json({
        error: "not_found",
        message: "Project not found or not accessible",
      });
      return;
    }

    // Ensure bucket exists
    await ensureBucket("project-resources");

    // Safe, unique storage path: resources/<userId>/<projectId>/<uuid>-<sanitizedName>
    const safeName = req.file.originalname
      .replace(/[^a-zA-Z0-9.\-_]/g, "_")
      .slice(0, 120);
    const storagePath = `resources/${userId}/${projectId}/${randomUUID()}-${safeName}`;

    let extraction;
    try {
      extraction = await extractTextFromBuffer(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );
    } catch (err: any) {
      res.status(422).json({
        error: "extraction_failed",
        message: err.message || "Failed to extract text from file",
      });
      return;
    }

    // Store extracted text sources as text/plain so private bucket MIME
    // restrictions do not reject .py/.ts/.json uploads that the browser
    // reported as application/octet-stream. PDFs and DOCX keep their type.
    const storageMime =
      extraction.kind === "pdf" || extraction.kind === "docx"
        ? req.file.mimetype
        : "text/plain";

    let uploadResult;
    try {
      uploadResult = await uploadFile(
        "project-resources",
        storagePath,
        req.file.buffer,
        storageMime,
      );
    } catch (err: any) {
      res.status(500).json({
        error: "upload_failed",
        message: err.message || "Failed to store file",
      });
      return;
    }

    // Extraction has already finished synchronously; empty text is still a
    // completed ingestion with a warning, not a pending job.
    const processingStatus = "completed";

    const { data: resource, error } = await supabaseAdmin
      .from("project_resources")
      .insert({
        project_id: projectId,
        owner_id: userId,
        resource_type: "file",
        original_filename: req.file.originalname,
        storage_path: uploadResult.path,
        external_url: null,
        processing_status: processingStatus,
        extracted_text: extraction.text.slice(0, MAX_STORED_TEXT_CHARS) || null,
        metadata: {
          name: req.file.originalname,
          mime_type: req.file.mimetype,
          size_bytes: req.file.buffer.length,
          kind: detectKind(req.file.mimetype, req.file.originalname),
          extracted_text_length: extraction.text.length,
          word_count: extraction.wordCount,
          page_count: extraction.pageCount,
          warning: extraction.warning,
        },
      })
      .select(PUBLIC_RESOURCE_COLUMNS)
      .single();

    if (error || !resource) {
      // Rollback storage upload if DB insert fails
      await deleteFileSafe("project-resources", uploadResult.path);
      logger.error({ error, userId, projectId }, "create file resource failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to create file resource",
      });
      return;
    }

    res.status(201).json({
      resource,
      extraction: {
        kind: extraction.kind,
        word_count: extraction.wordCount,
        page_count: extraction.pageCount,
        warning: extraction.warning,
        // NOTE: extracted text is NOT returned to the client — it is private
        // and only used server-side for generation.
      },
    });
  },
);

// POST /api/v1/projects/:id/resources/github
router.post(
  "/projects/:id/resources/github",
  authenticate,
  async (req: AuthRequest & { body: { url: string } }, res: Response) => {
    const userId = req.user!.id;
    const { id: projectId } = req.params;
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      res.status(400).json({
        error: "validation_failed",
        message: "GitHub repository URL is required",
      });
      return;
    }

    // Validate and normalize GitHub URL
    let repoPath: string;
    try {
      repoPath = normalizeGitHubUrl(url);
    } catch (err: any) {
      res.status(400).json({
        error: "validation_failed",
        message: err.message || "Invalid GitHub repository URL",
      });
      return;
    }

    // Verify project ownership
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .single();

    if (projErr || !project) {
      res.status(404).json({
        error: "not_found",
        message: "Project not found or not accessible",
      });
      return;
    }

    // Record the GitHub resource (ingestion happens asynchronously; mark pending)
    const { data: resource, error } = await supabaseAdmin
      .from("project_resources")
      .insert({
        project_id: projectId,
        owner_id: userId,
        resource_type: "github",
        original_filename: null,
        storage_path: null,
        external_url: url,
        processing_status: "pending",
        metadata: {
          name: repoPath,
          github_repo: repoPath,
          status_note: "Queued for GitHub ingestion",
        },
      })
      .select(PUBLIC_RESOURCE_COLUMNS)
      .single();

    if (error || !resource) {
      logger.error({ error, userId, projectId }, "create github resource failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to create GitHub resource",
      });
      return;
    }

    res.status(201).json({
      resource,
      note:
        "GitHub ingestion has started. Extracted content will be available once processing completes.",
    });

    // Fire-and-forget ingestion. The HTTP response is not blocked on GitHub,
    // and failures are recorded on the resource row so the UI can show them.
    void ingestGitHubResource(
      (resource as any).id,
      repoPath,
      async (id, patch) => {
        const { error: updateError } = await supabaseAdmin
          .from("project_resources")
          .update(patch)
          .eq("id", id)
          .eq("owner_id", userId);
        if (updateError) throw updateError;
      },
      async (id) => {
        const { data } = await supabaseAdmin
          .from("project_resources")
          .select("metadata")
          .eq("id", id)
          .eq("owner_id", userId)
          .single();
        return ((data as any)?.metadata ?? {}) as Record<string, unknown>;
      },
    );
  },
);

// GET /api/v1/projects/:id/resources
router.get(
  "/projects/:id/resources",
  authenticate,
  async (req: AuthRequest & { params: { id: string } }, res: Response) => {
    const userId = req.user!.id;
    const { id: projectId } = req.params;

    // Verify project ownership
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .single();

    if (projErr || !project) {
      res.status(404).json({
        error: "not_found",
        message: "Project not found or not accessible",
      });
      return;
    }

    const { data: resources, error } = await supabaseAdmin
      .from("project_resources")
      .select(PUBLIC_RESOURCE_COLUMNS)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error({ error, userId, projectId }, "list resources failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to list resources",
      });
      return;
    }

    res.json({ resources: resources ?? [] });
  },
);

// DELETE /api/v1/resources/:id
router.delete(
  "/resources/:id",
  authenticate,
  async (req: AuthRequest & { params: { id: string } }, res: Response) => {
    const userId = req.user!.id;
    const { id: resourceId } = req.params;

    // Fetch resource with ownership check
    const { data: resource, error: fetchErr } = await supabaseAdmin
      .from("project_resources")
      .select("id, storage_path")
      .eq("id", resourceId)
      .eq("owner_id", userId)
      .single();

    if (fetchErr || !resource) {
      res.status(404).json({
        error: "not_found",
        message: "Resource not found or not accessible",
      });
      return;
    }

    // Delete from storage if a file was stored
    if (resource.storage_path) {
      // bucket_hint is not a column we added; infer 'project-resources' for file resources
      await deleteFileSafe("project-resources", resource.storage_path);
    }

    const { error } = await supabaseAdmin
      .from("project_resources")
      .delete()
      .eq("id", resourceId)
      .eq("owner_id", userId);

    if (error) {
      logger.error({ error, userId, resourceId }, "delete resource failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to delete resource",
      });
      return;
    }

    res.json({ ok: true });
  },
);

async function deleteFileSafe(
  bucket: StorageBucket,
  path: string,
): Promise<void> {
  try {
    const { error } = await storageAdmin().storage.from(bucket).remove([path]);
    if (error) {
      logger.warn({ bucket, path, error }, "storage cleanup warning");
    }
  } catch (err) {
    logger.warn({ bucket, path, err }, "storage cleanup exception");
  }
}

/**
 * Validate and normalize a GitHub repository URL to "owner/repo" form.
 * Only github.com is allowed (no SSRF to other hosts).
 */
function normalizeGitHubUrl(url: string): string {
  const trimmed = url.trim();
  // Strip trailing .git and trailing slashes
  const cleaned = trimmed.replace(/\.git\s*$/, "").replace(/\/$/, "");

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    throw new Error("Unable to parse URL");
  }

  if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com") {
    throw new Error("Only github.com repository URLs are supported");
  }

  const pathname = parsed.pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 2);

  if (pathname.length < 2) {
    throw new Error("GitHub URL must include owner and repository name");
  }

  // Reject anything that looks like a subpath (trees, blobs, releases, etc.)
  const fullPath = `${pathname[0]}/${pathname[1]}`;
  if (
    cleaned !== `https://github.com/${fullPath}` &&
    cleaned !== `http://github.com/${fullPath}`
  ) {
    throw new Error(
      "Only top-level repository URLs are supported (no tree/blob/subdirectory paths)",
    );
  }

  return fullPath;
}

export default router;
