import { Router, Response } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import {
  GetTemplateSchema,
  UpdateTemplateSchema,
  UpdateTemplateSpecificationSchema,
} from "@projectscribe/shared";
import { validate } from "../middleware/validate.js";
import { enforceLimit, checkTemplateLimit } from "../services/limits.js";
import { auditLog } from "../services/audit.js";
import {
  storageAdmin,
  uploadFile,
  ensureBucket,
  type StorageBucket,
} from "../lib/storage.js";
import { parseDocxTemplate } from "../services/templates.js";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB for templates
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/pdf",
    ]);
    const looksAllowed = /\.(docx|pdf)$/i.test(file.originalname);
    if (allowed.has(file.mimetype) || looksAllowed) {
      cb(null, true);
    } else {
      const error = new Error("Only DOCX and PDF templates are allowed") as Error & {
        status?: number;
      };
      error.status = 400;
      cb(error);
    }
  },
});

type IdBodyReq = AuthRequest & {
  validated?: {
    params: { id: string };
    body: Record<string, unknown>;
  };
};

// GET /api/v1/public/templates
// Unauthenticated listing for the public template library. Only templates the
// owner explicitly made public are exposed; private/unlisted rows never appear.
router.get(
  "/public/templates",
  async (req: AuthRequest & { query: Record<string, any> }, res: Response) => {
    const {
      document_type,
      academic_year,
      search,
      page = 1,
      page_size = 24,
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(48, Math.max(1, Number(page_size) || 24));

    let query = supabaseAdmin
      .from("templates")
      .select(
        "id, title, description, document_type, academic_year, verification_status, created_at, updated_at",
        { count: "exact" },
      )
      .eq("visibility", "public")
      // Only reviewed templates are published in the library.
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .range((pageNum - 1) * pageSize, pageNum * pageSize - 1);

    if (document_type) query = query.eq("document_type", document_type);
    if (academic_year) query = query.eq("academic_year", academic_year);
    if (search) query = query.ilike("title", `%${search}%`);

    const { data: templates, error, count } = await query;

    if (error) {
      logger.error({ error }, "list public templates failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to list templates",
      });
      return;
    }

    res.json({
      templates: templates ?? [],
      page: pageNum,
      page_size: pageSize,
      total: count ?? templates?.length ?? 0,
    });
  },
);

// GET /api/v1/templates
router.get(
  "/templates",
  authenticate,
  async (req: AuthRequest & { query: Record<string, any> }, res: Response) => {
    const userId = req.user!.id;
    const {
      college,
      department,
      document_type,
      academic_year,
      visibility,
      search,
      page = 1,
      page_size = 20,
    } = req.query;

    let query = supabaseAdmin
      .from("templates")
      .select(
        "id, title, description, document_type, academic_year, visibility, verification_status, owner_id, college_id, department_id, created_at, updated_at",
      )
      // Owners see everything of theirs. Other users only see public templates
      // that are not awaiting moderation or rejected. Unlisted templates are
      // link-only and must not be listed.
      .or(
        `owner_id.eq.${userId},and(visibility.eq.public,verification_status.eq.verified)`,
      )
      .order("created_at", { ascending: false })
      .range(
        (Math.max(1, Number(page) || 1) - 1) *
          Math.min(100, Math.max(1, Number(page_size) || 20)),
        Math.max(1, Number(page) || 1) *
          Math.min(100, Math.max(1, Number(page_size) || 20)) -
          1,
      );

    if (college) query = query.eq("college_id", college);
    if (department) query = query.eq("department_id", department);
    if (document_type) query = query.eq("document_type", document_type);
    if (academic_year) query = query.eq("academic_year", academic_year);
    if (visibility) query = query.eq("visibility", visibility);
    if (search) {
      query = query.ilike("title", `%${search}%`);
    }

    const { data: templates, error } = await query;

    if (error) {
      logger.error({ error, userId }, "list templates failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to list templates",
      });
      return;
    }

    res.json({ templates: templates ?? [], page, page_size });
  },
);

// POST /api/v1/templates
router.post(
  "/templates",
  authenticate,
  enforceLimit(checkTemplateLimit),
  upload.single("file"),
  async (req: AuthRequest & { file?: Express.Multer.File }, res: Response) => {
    const userId = req.user!.id;
    const {
      title,
      description,
      document_type,
      college_id,
      department_id,
      academic_year,
      visibility = "private",
    } = req.body;

    if (!title || !document_type) {
      res.status(400).json({
        error: "validation_failed",
        message: "Title and document_type are required",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: "validation_failed",
        message: "A DOCX or PDF template file is required",
      });
      return;
    }

    if (!["private", "unlisted", "public"].includes(visibility)) {
      res.status(400).json({
        error: "validation_failed",
        message: "visibility must be private, unlisted, or public",
      });
      return;
    }

    await ensureBucket("templates");

    let storagePath: string | null = null;
    let specification: any = null;
    let parsingStatus: "pending" | "completed" | "failed" = "pending";
    const warnings: string[] = [];

    if (req.file) {
      const safeName = req.file.originalname
        .replace(/[^a-zA-Z0-9.\-_]/g, "_")
        .slice(0, 120);
      storagePath = `templates/${userId}/${randomUUID()}-${safeName}`;

      try {
        const uploadResult = await uploadFile(
          "templates",
          storagePath,
          req.file.buffer,
          req.file.mimetype,
        );
        storagePath = uploadResult.path;
      } catch (err: any) {
        res.status(500).json({
          error: "upload_failed",
          message: err.message || "Failed to store template file",
        });
        return;
      }

      // Parse the template
      if (
        req.file.mimetype.includes("wordprocessingml.document") ||
        req.file.originalname.toLowerCase().endsWith(".docx")
      ) {
        try {
          const parseResult = await parseDocxTemplate(req.file.buffer);
          specification = parseResult.specification;
          parsingStatus = "completed";
          warnings.push(...parseResult.warnings);
        } catch (err: any) {
          logger.error({ err, userId }, "template parsing failed");
          parsingStatus = "failed";
          warnings.push(err.message || "Failed to parse template");
        }
      } else {
        parsingStatus = "failed";
        warnings.push(
          "PDF templates cannot be parsed automatically. Open the specification editor and enter the requirements manually.",
        );
      }
    }

    const { data: template, error } = await supabaseAdmin
      .from("templates")
      .insert({
        owner_id: userId,
        college_id: college_id ?? null,
        department_id: department_id ?? null,
        title,
        description: description ?? null,
        document_type,
        academic_year: academic_year ?? null,
        visibility,
        // Public uploads enter moderation; private/unlisted templates are
        // usable immediately by their owner.
        verification_status: visibility === "public" ? "pending" : "unverified",
        current_version_id: null,
      })
      .select()
      .single();

    if (error || !template) {
      if (storagePath) {
        await deleteFileSafe("templates", storagePath);
      }
      logger.error({ error, userId }, "create template failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to create template",
      });
      return;
    }

    // Create template version if file was uploaded
    let version: any = null;
    if (storagePath) {
      const { data: verData, error: verErr } = await supabaseAdmin
        .from("template_versions")
        .insert({
          template_id: template.id,
          version_number: 1,
          storage_path: storagePath,
          parsed_specification: specification,
          parsing_status: parsingStatus,
          validation_warnings: warnings.length ? warnings : null,
        })
        .select()
        .single();

      if (verErr || !verData) {
        logger.error({ error: verErr, userId }, "create template version failed");
        await deleteFileSafe("templates", storagePath);
        await supabaseAdmin.from("templates").delete().eq("id", template.id);
        res.status(500).json({
          error: "internal_server_error",
          message: "Failed to save the template file. Please try again.",
        });
        return;
      }

      version = verData;
      // Update template with current_version_id
      await supabaseAdmin
        .from("templates")
        .update({ current_version_id: verData.id })
        .eq("id", template.id);
      (template as any).current_version_id = verData.id;
    }

    res.status(201).json({ template, version, warnings });

    auditLog({
      user_id: userId,
      event_type: "template.create",
      target_type: "template",
      target_id: template.id,
      metadata: {
        title,
        document_type,
        college_id,
        department_id,
        academic_year,
        visibility,
        has_file: !!req.file,
      },
      ip_address: req.ip ?? null,
      user_agent: req.get("User-Agent") ?? null,
    }).catch(() => {
      // ignore
    });
  },
);

// GET /api/v1/templates/:id
router.get(
  "/templates/:id",
  authenticate,
  validate(GetTemplateSchema),
  async (req: IdBodyReq, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.validated!.params;

    const { data: template, error } = await supabaseAdmin
      .from("templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !template) {
      res.status(404).json({ error: "not_found", message: "Template not found" });
      return;
    }

    // Authorization: owners and admins see everything. Everyone else can see
    // public/unlisted templates only after they leave the moderation queue.
    const isOwner = template.owner_id === userId;
    const isAdmin = (req.user!.role ?? "user") === "admin";
    if (!isOwner && !isAdmin) {
      if (template.visibility === "private") {
        res.status(403).json({ error: "forbidden", message: "Private template" });
        return;
      }
      if (
        template.visibility === "public" &&
        template.verification_status !== "verified"
      ) {
        res.status(403).json({
          error: "forbidden",
          message: "This public template is still being reviewed",
        });
        return;
      }
    }

    // Fetch current version
    let version: any = null;
    if (template.current_version_id) {
      const { data: verData } = await supabaseAdmin
        .from("template_versions")
        .select("*")
        .eq("id", template.current_version_id)
        .single();
      version = verData;
    }

    res.json({ template, version });
  },
);

// POST /api/v1/templates/:id/versions
router.post(
  "/templates/:id/versions",
  authenticate,
  upload.single("file"),
  async (req: AuthRequest & { file?: Express.Multer.File }, res: Response) => {
    const userId = req.user!.id;
    const { id: templateId } = req.params;

    // Verify ownership
    const { data: template, error: tErr } = await supabaseAdmin
      .from("templates")
      .select("id, owner_id, visibility")
      .eq("id", templateId)
      .single();

    if (tErr || !template || template.owner_id !== userId) {
      res.status(404).json({ error: "not_found", message: "Template not found" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "validation_failed", message: "No file provided" });
      return;
    }

    await ensureBucket("templates");

    // Get current max version number
    const { data: versions } = await supabaseAdmin
      .from("template_versions")
      .select("version_number")
      .eq("template_id", templateId)
      .order("version_number", { ascending: false })
      .limit(1);
    const nextVersion = (versions?.[0]?.version_number ?? 0) + 1;

    const safeName = req.file.originalname
      .replace(/[^a-zA-Z0-9.\-_]/g, "_")
      .slice(0, 120);
    const storagePath = `templates/${userId}/${templateId}/v${nextVersion}-${randomUUID()}-${safeName}`;

    let specification: any = null;
    let parsingStatus: "pending" | "completed" | "failed" = "pending";
    const warnings: string[] = [];

    try {
      await uploadFile(
        "templates",
        storagePath,
        req.file.buffer,
        req.file.mimetype,
      );
    } catch (err: any) {
      res.status(500).json({
        error: "upload_failed",
        message: err.message || "Failed to store template file",
      });
      return;
    }

    if (
      req.file.mimetype.includes("wordprocessingml.document") ||
      req.file.originalname.toLowerCase().endsWith(".docx")
    ) {
      try {
        const parseResult = await parseDocxTemplate(req.file.buffer);
        specification = parseResult.specification;
        parsingStatus = "completed";
        warnings.push(...parseResult.warnings);
      } catch (err: any) {
        parsingStatus = "failed";
        warnings.push(err.message || "Failed to parse template");
      }
    } else {
      parsingStatus = "failed";
      warnings.push(
        "PDF templates cannot be parsed automatically. Open the specification editor and enter the requirements manually.",
      );
    }

    const { data: version, error: vErr } = await supabaseAdmin
      .from("template_versions")
      .insert({
        template_id: templateId,
        version_number: nextVersion,
        storage_path: storagePath,
        parsed_specification: specification,
        parsing_status: parsingStatus,
        validation_warnings: warnings.length ? warnings : null,
      })
      .select()
      .single();

    if (vErr || !version) {
      await deleteFileSafe("templates", storagePath);
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to create template version",
      });
      return;
    }

    // Update the current version. A new file changes what was reviewed, so a
    // public template goes back into moderation.
    await supabaseAdmin
      .from("templates")
      .update({
        current_version_id: version.id,
        updated_at: new Date().toISOString(),
        ...(template.visibility === "public"
          ? { verification_status: "pending", review_notes: null }
          : {}),
      })
      .eq("id", templateId);

    res.status(201).json({ version, warnings });
  },
);

// PATCH /api/v1/templates/:id
// Owner-only metadata edit, including visibility. Making a template public
// enters the moderation queue; changing it back to private clears the queue.
router.patch(
  "/templates/:id",
  authenticate,
  validate(UpdateTemplateSchema),
  async (
    req: AuthRequest & {
      validated?: {
        params: { id: string };
        body: {
          title?: string;
          description?: string | null;
          academic_year?: string | null;
          visibility?: "private" | "unlisted" | "public";
        };
      };
    },
    res: Response,
  ) => {
    const userId = req.user!.id;
    const { id } = req.validated!.params;
    const body = req.validated!.body;

    const { data: existing, error: findErr } = await supabaseAdmin
      .from("templates")
      .select("id, owner_id, visibility, verification_status")
      .eq("id", id)
      .single();

    if (findErr || !existing || (existing as any).owner_id !== userId) {
      res.status(404).json({ error: "not_found", message: "Template not found" });
      return;
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.academic_year !== undefined) updates.academic_year = body.academic_year;
    if (body.visibility !== undefined) {
      updates.visibility = body.visibility;
    }

    const willBePublic =
      (body.visibility ?? (existing as any).visibility) === "public";
    if (willBePublic) {
      // Every change to a published template (metadata, file, spec, or
      // visibility) re-enters moderation before it is shown to others again.
      updates.verification_status = "pending";
      updates.review_notes = null;
    } else if ((existing as any).verification_status === "pending") {
      // Leaving the public library withdraws a pending submission.
      updates.verification_status = "unverified";
    }

    const { data: template, error } = await supabaseAdmin
      .from("templates")
      .update(updates)
      .eq("id", id)
      .eq("owner_id", userId)
      .select(
        "id, title, description, document_type, academic_year, visibility, verification_status, review_notes, updated_at",
      )
      .single();

    if (error || !template) {
      logger.error({ error, userId, templateId: id }, "update template failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to update template",
      });
      return;
    }

    res.json({ template });

    auditLog({
      user_id: userId,
      event_type: "template.update",
      target_type: "template",
      target_id: id,
      metadata: { ...body },
      ip_address: req.ip ?? null,
      user_agent: req.get("User-Agent") ?? null,
    }).catch(() => {});
  },
);

/**
 * DELETE /api/v1/templates/:id
 * Owner-only. Removes the template row (cascading its versions) and every
 * stored file. Generation jobs that referenced a version keep working because
 * their template_version_id is set to null by the FK.
 */
router.delete(
  "/templates/:id",
  authenticate,
  validate(GetTemplateSchema),
  async (req: IdBodyReq, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.validated!.params;

    const { data: template, error } = await supabaseAdmin
      .from("templates")
      .select("id, owner_id, title")
      .eq("id", id)
      .eq("owner_id", userId)
      .single();

    if (error || !template) {
      res.status(404).json({ error: "not_found", message: "Template not found" });
      return;
    }

    const { data: versions } = await supabaseAdmin
      .from("template_versions")
      .select("storage_path")
      .eq("template_id", id);

    const { error: deleteError } = await supabaseAdmin
      .from("templates")
      .delete()
      .eq("id", id)
      .eq("owner_id", userId);

    if (deleteError) {
      logger.error({ error: deleteError, userId, templateId: id }, "delete template failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to delete template",
      });
      return;
    }

    for (const version of versions ?? []) {
      if ((version as any).storage_path) {
        await deleteFileSafe("templates", (version as any).storage_path);
      }
    }

    res.status(204).send();

    auditLog({
      user_id: userId,
      event_type: "template.delete",
      target_type: "template",
      target_id: id,
      metadata: { title: (template as any).title },
      ip_address: req.ip ?? null,
      user_agent: req.get("User-Agent") ?? null,
    }).catch(() => {});
  },
);

// POST /api/v1/templates/:id/parse
router.post(
  "/templates/:id/parse",
  authenticate,
  validate(GetTemplateSchema),
  async (req: IdBodyReq, res: Response) => {
    const userId = req.user!.id;
    const { id: templateId } = req.validated!.params;

    const { data: template, error: tErr } = await supabaseAdmin
      .from("templates")
      .select("id, owner_id, current_version_id")
      .eq("id", templateId)
      .single();

    if (tErr || !template) {
      res.status(404).json({ error: "not_found", message: "Template not found" });
      return;
    }

    const isOwner = template.owner_id === userId;
    if (!isOwner && (req.user!.role ?? "user") !== "admin") {
      res.status(403).json({ error: "forbidden", message: "Not authorized" });
      return;
    }

    if (!template.current_version_id) {
      res.status(400).json({ error: "validation_failed", message: "No template version to parse" });
      return;
    }

    const { data: version, error: vErr } = await supabaseAdmin
      .from("template_versions")
      .select("storage_path, parsing_status")
      .eq("id", template.current_version_id)
      .single();

    if (vErr || !version || !version.storage_path) {
      res.status(404).json({ error: "not_found", message: "Template file not found" });
      return;
    }

    if (!version.storage_path.toLowerCase().endsWith(".docx")) {
      res.status(415).json({
        error: "unsupported_format",
        message:
          "Only DOCX templates can be re-parsed automatically. Edit the JSON specification for this PDF template instead.",
      });
      return;
    }

    // Download file from storage and re-parse
    const { data: fileData, error: dErr } = await storageAdmin().storage
      .from("templates")
      .download(version.storage_path);

    if (dErr || !fileData) {
      res.status(500).json({ error: "internal_server_error", message: "Failed to download template file" });
      return;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    try {
      const parseResult = await parseDocxTemplate(buffer);
      const { error: uErr } = await supabaseAdmin
        .from("template_versions")
        .update({
          parsed_specification: parseResult.specification,
          parsing_status: "completed",
          validation_warnings: parseResult.warnings.length ? parseResult.warnings : null,
        })
        .eq("id", template.current_version_id);

      if (uErr) {
        res.status(500).json({ error: "internal_server_error", message: "Failed to save specification" });
        return;
      }

      res.json({
        specification: parseResult.specification,
        warnings: parseResult.warnings,
      });
    } catch (err: any) {
      res.status(422).json({
        error: "parsing_failed",
        message: err.message || "Failed to parse template",
      });
    }
  },
);

// PATCH /api/v1/templates/:id/specification
router.patch(
  "/templates/:id/specification",
  authenticate,
  validate(UpdateTemplateSpecificationSchema),
  async (req: IdBodyReq & { validated?: { body: { specification: any } } }, res: Response) => {
    const userId = req.user!.id;
    const { id: templateId } = req.validated!.params;
    const { specification } = req.validated!.body;

    const { data: template, error: tErr } = await supabaseAdmin
      .from("templates")
      .select("id, owner_id, current_version_id, visibility")
      .eq("id", templateId)
      .single();

    if (tErr || !template || template.owner_id !== userId) {
      res.status(404).json({ error: "not_found", message: "Template not found" });
      return;
    }

    if (!template.current_version_id) {
      res.status(400).json({ error: "validation_failed", message: "No template version" });
      return;
    }

    const { error: uErr } = await supabaseAdmin
      .from("template_versions")
      .update({ parsed_specification: specification })
      .eq("id", template.current_version_id);

    if (uErr) {
      res.status(500).json({ error: "internal_server_error", message: "Failed to update specification" });
      return;
    }

    if ((template as any).visibility === "public") {
      await supabaseAdmin
        .from("templates")
        .update({
          verification_status: "pending",
          review_notes: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", templateId);
    }

    res.json({
      ok: true,
      verification_status:
        (template as any).visibility === "public" ? "pending" : "unverified",
    });
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

export default router;
