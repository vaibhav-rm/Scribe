import { Router, Response } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import {
  GetDocumentSchema,
  UpdateDocumentSectionSchema,
  ExportDocumentSchema,
  RegenerateDocumentSectionSchema,
  RestoreDocumentVersionSchema,
} from "@projectscribe/shared";
import {
  deleteFile,
  getSignedUrl,
  uploadFile,
} from "../lib/storage.js";
import { createConverter, createTempDir } from "../services/conversion.js";
import {
  enforceLimit,
  checkSectionRegenerationLimit,
  getUserPlan,
  PLAN_LIMITS,
} from "../services/limits.js";
import { reserveCredits } from "../services/generation.js";
import { generateSection } from "../services/ai/pipeline/stageD_sections.js";
import { extractProjectKnowledge } from "../services/ai/pipeline/stageA_knowledge.js";
import {
  loadProjectContext,
  loadProjectResources,
} from "../services/resources.js";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { validate } from "../middleware/validate.js";
import { auditLog } from "../services/audit.js";
import { logger } from "../lib/logger.js";

const router = Router();
const converter = createConverter();

type IdReq = AuthRequest & {
  validated?: { params: { id: string } };
};

type IdSectionReq = AuthRequest & {
  validated?: {
    params: { id: string; sectionId: string };
    body: { content: string };
  };
};

type ExportReq = AuthRequest & {
  validated?: {
    params: { id: string };
    query: { format: "docx" | "pdf" };
  };
};

type RegenerateReq = AuthRequest & {
  validated?: {
    params: { id: string; sectionId: string };
    body: { instructions?: string };
  };
};

type RestoreReq = AuthRequest & {
  validated?: {
    params: { id: string; versionNumber: number };
  };
};

/**
 * Persist a snapshot of a document's content. Snapshots make edits
 * non-destructive: users can inspect and restore earlier versions.
 * Failures are logged but never block the edit itself.
 */
async function snapshotVersion(params: {
  documentId: string;
  ownerId: string;
  versionNumber: number;
  contentJson: unknown;
  source: "generation" | "edit" | "regenerate" | "restore";
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("document_versions")
    .upsert(
      {
        document_id: params.documentId,
        owner_id: params.ownerId,
        version_number: params.versionNumber,
        content_json: params.contentJson,
        source: params.source,
      },
      { onConflict: "document_id,version_number" },
    );

  if (error) {
    logger.warn(
      { error, documentId: params.documentId, version: params.versionNumber },
      "document version snapshot failed",
    );
  }
}

/**
 * GET /api/v1/documents
 * List the authenticated user's generated documents.
 */
router.get(
  "/documents",
  authenticate,
  async (
    req: AuthRequest & { query: Record<string, any> },
    res: Response,
  ) => {
    const userId = req.user!.id;
    const {
      project_id,
      generation_job_id,
      search,
      page = 1,
      page_size = 20,
    } = req.query;

    const pageNumber = Math.max(1, Math.floor(Number(page) || 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(page_size) || 20)));
    const searchTerm =
      typeof search === "string" ? search.trim().slice(0, 100) : "";

    let query = supabaseAdmin
      .from("generated_documents")
      .select(
        "id, project_id, generation_job_id, title, version_number, status, docx_storage_path, pdf_storage_path, created_at, updated_at",
        { count: "exact" },
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .range((pageNumber - 1) * pageSize, pageNumber * pageSize - 1);

    if (project_id) {
      query = query.eq("project_id", project_id);
    }
    if (generation_job_id) {
      query = query.eq("generation_job_id", generation_job_id);
    }
    if (searchTerm) {
      query = query.ilike("title", `%${searchTerm}%`);
    }

    const { data: documents, error, count } = await query;

    if (error) {
      logger.error({ error, userId }, "list documents failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to list documents",
      });
      return;
    }

    res.json({
      documents: documents ?? [],
      page: pageNumber,
      page_size: pageSize,
      total: count ?? documents?.length ?? 0,
    });
  },
);

/**
 * GET /api/v1/documents/:id
 * Get a single document with its content.
 */
router.get(
  "/documents/:id",
  authenticate,
  validate(GetDocumentSchema),
  async (req: IdReq, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.validated!.params;

    const { data: document, error } = await supabaseAdmin
      .from("generated_documents")
      .select("*")
      .eq("id", id)
      .eq("owner_id", userId)
      .single();

    if (error || !document) {
      res.status(404).json({ error: "not_found", message: "Document not found" });
      return;
    }

    res.json({ document });
  },
);

/**
 * PATCH /api/v1/documents/:id/sections/:sectionId
 * Update a single section's content (autosave-friendly).
 */
router.patch(
  "/documents/:id/sections/:sectionId",
  authenticate,
  validate(UpdateDocumentSectionSchema),
  async (req: IdSectionReq, res: Response) => {
    const userId = req.user!.id;
    const { id, sectionId } = req.validated!.params;
    const { content } = req.validated!.body;

    const { data: document, error } = await supabaseAdmin
      .from("generated_documents")
      .select("content_json, title, version_number")
      .eq("id", id)
      .eq("owner_id", userId)
      .single();

    if (error || !document) {
      res.status(404).json({ error: "not_found", message: "Document not found" });
      return;
    }

    const contentJson = (document.content_json as any) ?? {
      title: document.title,
      sections: [],
    };

    const sectionIndex = contentJson.sections.findIndex(
      (s: any) => s.id === sectionId,
    );

    if (sectionIndex === -1) {
      res.status(404).json({
        error: "not_found",
        message: "Section not found in document",
      });
      return;
    }

    contentJson.sections[sectionIndex] = {
      ...contentJson.sections[sectionIndex],
      content,
      updated_at: new Date().toISOString(),
    };

    const newVersion = (document.version_number as number) + 1;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("generated_documents")
      .update({
        content_json: contentJson,
        version_number: newVersion,
        updated_at: new Date().toISOString(),
        status: "draft",
        // Exports are snapshots of the previous version. Invalidate them so
        // the next DOCX/PDF download reflects the edit.
        docx_storage_path: null,
        pdf_storage_path: null,
      })
      .eq("id", id)
      .eq("owner_id", userId)
      .select()
      .single();

    if (updateErr || !updated) {
      logger.error({ error: updateErr, userId, documentId: id }, "update section failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to update section",
      });
      return;
    }

    await snapshotVersion({
      documentId: id,
      ownerId: userId,
      versionNumber: newVersion,
      contentJson,
      source: "edit",
    });

    res.json({ document: updated, sectionId, version: newVersion });
  },
);

/**
 * Return a cached DOCX path, or rebuild it from the current section content
 * using the template spec that was applied at generation time.
 */
async function ensureDocxExport(
  document: {
    id: string;
    title: string;
    content_json: any;
    template_spec?: Record<string, unknown> | null;
    docx_storage_path?: string | null;
  },
  userId: string,
): Promise<{ path: string; generated: boolean }> {
  if (document.docx_storage_path) {
    return { path: document.docx_storage_path, generated: false };
  }

  const { assembleDocument } = await import(
    "../services/ai/pipeline/stageF_assembly.js"
  );
  const spec = document.template_spec ?? {};
  const sections = document.content_json?.sections ?? [];
  const result = await assembleDocument({
    documentTitle: document.title,
    sections: sections.map((section: any) => ({
      id: section.id,
      heading: section.heading,
      content: section.content,
      warnings: section.warnings,
    })),
    templateSpec: spec,
    outputFormat: "docx",
  });

  const newPath = `documents/${userId}/${document.id}/${randomUUID()}.docx`;
  await uploadFile(
    "generated-documents",
    newPath,
    result.buffer,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );

  const { error } = await supabaseAdmin
    .from("generated_documents")
    .update({ docx_storage_path: newPath })
    .eq("id", document.id)
    .eq("owner_id", userId);

  if (error) {
    logger.error(
      { error, userId, documentId: document.id },
      "cache rebuilt docx path failed",
    );
    await deleteFile("generated-documents", newPath).catch(() => {});
    throw new Error("Failed to save the DOCX export");
  }

  return { path: newPath, generated: true };
}

/**
 * GET /api/v1/documents/:id/export?format=docx|pdf
 * Download a document export via short-lived signed URL.
 */
router.get(
  "/documents/:id/export",
  authenticate,
  validate(ExportDocumentSchema),
  async (req: ExportReq, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.validated!.params;
    const { format } = req.validated!.query;

    const { data: document, error } = await supabaseAdmin
      .from("generated_documents")
      .select("*")
      .eq("id", id)
      .eq("owner_id", userId)
      .single();

    if (error || !document) {
      res.status(404).json({ error: "not_found", message: "Document not found" });
      return;
    }

    if (format === "docx") {
      let exportResult: { path: string; generated: boolean };
      try {
        exportResult = await ensureDocxExport(document as any, userId);
      } catch (exportErr: any) {
        logger.error(
          { error: exportErr, userId, documentId: id },
          "docx assembly failed",
        );
        res.status(500).json({
          error: "internal_server_error",
          message: exportErr.message || "Failed to build DOCX export",
        });
        return;
      }

      const signedUrl = await getSignedUrl(
        "generated-documents",
        exportResult.path,
        300,
      );
      res.json({ downloadUrl: signedUrl, format: "docx", expiresIn: 300 });

      auditLog({
        user_id: userId,
        event_type: "document.export",
        target_type: "document",
        target_id: id,
        metadata: { format: "docx", generated: exportResult.generated },
        ip_address: req.ip ?? null,
        user_agent: req.get("User-Agent") ?? null,
      }).catch(() => {});
      return;
    }

    if (format === "pdf") {
      // PDF export is a paid feature.
      const plan = await getUserPlan(userId);
      if (!PLAN_LIMITS[plan].pdfExport) {
        res.status(403).json({
          error: "upgrade_required",
          message:
            "PDF export is available on the Student Pro plan. DOCX export is available on your current plan.",
          plan,
        });
        return;
      }

      if (!converter.isAvailable()) {
        res.status(503).json({
          error: "pdf_export_unavailable",
          message:
            "PDF export is not available in this deployment. Install LibreOffice and set DOC_CONVERSION_ENABLED=true. DOCX export remains functional.",
        });
        return;
      }

      const pdfPath = document.pdf_storage_path as string | null;
      if (pdfPath) {
        const signedUrl = await getSignedUrl("generated-documents", pdfPath, 300);
        res.json({ downloadUrl: signedUrl, format: "pdf", expiresIn: 300 });

        auditLog({
          user_id: userId,
          event_type: "document.export",
          target_type: "document",
          target_id: id,
          metadata: { format: "pdf", generated: false },
          ip_address: req.ip ?? null,
          user_agent: req.get("User-Agent") ?? null,
        }).catch(() => {
          // ignore
        });
        return;
      }

      let docxExport: { path: string; generated: boolean };
      try {
        docxExport = await ensureDocxExport(document as any, userId);
      } catch (exportErr: any) {
        logger.error(
          { error: exportErr, userId, documentId: id },
          "docx assembly for pdf failed",
        );
        res.status(500).json({
          error: "internal_server_error",
          message: exportErr.message || "Failed to build the DOCX source for PDF",
        });
        return;
      }

      const { data: fileData, error: dErr } = await supabaseAdmin.storage
        .from("generated-documents")
        .download(docxExport.path);

      if (dErr || !fileData) {
        res.status(500).json({
          error: "internal_server_error",
          message: "Failed to retrieve DOCX for PDF conversion",
        });
        return;
      }

      const tempDir = await createTempDir();
      const inputPath = path.join(tempDir, `${randomUUID()}.docx`);
      await fs.writeFile(inputPath, Buffer.from(await fileData.arrayBuffer()));

      try {
        const result = await converter.convert(inputPath, "pdf");

        const pdfBuffer = await fs.readFile(result.outputPath);
        const pdfStoragePath = `documents/${userId}/${id}/${randomUUID()}.pdf`;
        await uploadFile(
          "generated-documents",
          pdfStoragePath,
          pdfBuffer,
          "application/pdf",
        );
        await supabaseAdmin
          .from("generated_documents")
          .update({ pdf_storage_path: pdfStoragePath })
          .eq("id", id);

        const signedUrl = await getSignedUrl("generated-documents", pdfStoragePath, 300);
        res.json({ downloadUrl: signedUrl, format: "pdf", expiresIn: 300 });

        auditLog({
          user_id: userId,
          event_type: "document.export",
          target_type: "document",
          target_id: id,
          metadata: { format: "pdf", generated: true },
          ip_address: req.ip ?? null,
          user_agent: req.get("User-Agent") ?? null,
        }).catch(() => {
          // ignore
        });
      } catch (convErr: any) {
        logger.error({ error: convErr, userId, documentId: id }, "PDF conversion failed");
        res.status(500).json({
          error: "conversion_failed",
          message: convErr.message || "PDF conversion failed",
        });
      } finally {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
      return;
    }

    res.status(400).json({ error: "validation_failed", message: "Invalid format" });
  },
);

/**
 * Resolve the document type and template requirements from the generation job
 * that produced the document. Used to keep regenerated sections consistent
 * with the original document.
 */
async function resolveJobContext(document: {
  generation_job_id?: string | null;
}): Promise<{
  documentType: string;
  templateRequirements: Record<string, unknown>;
}> {
  if (!document.generation_job_id) {
    return { documentType: "academic document", templateRequirements: {} };
  }

  const { data: job } = await supabaseAdmin
    .from("generation_jobs")
    .select("document_type, template_version_id")
    .eq("id", document.generation_job_id)
    .single();

  const documentType = (job as any)?.document_type ?? "academic document";
  const templateVersionId = (job as any)?.template_version_id as
    | string
    | null
    | undefined;

  let templateRequirements: Record<string, unknown> = {};
  if (templateVersionId) {
    const { data: version } = await supabaseAdmin
      .from("template_versions")
      .select("parsed_specification")
      .eq("id", templateVersionId)
      .single();
    templateRequirements =
      ((version as any)?.parsed_specification as Record<string, unknown>) ?? {};
  }

  return { documentType, templateRequirements };
}

/**
 * POST /api/v1/documents/:id/sections/:sectionId/regenerate
 * Regenerate exactly one section using the project's sources. Other sections
 * are never touched. Enforces the per-plan section-regeneration limit.
 */
router.post(
  "/documents/:id/sections/:sectionId/regenerate",
  authenticate,
  enforceLimit(checkSectionRegenerationLimit),
  validate(RegenerateDocumentSectionSchema),
  async (req: RegenerateReq, res: Response) => {
    const userId = req.user!.id;
    const { id, sectionId } = req.validated!.params;

    const { data: document, error } = await supabaseAdmin
      .from("generated_documents")
      .select("*")
      .eq("id", id)
      .eq("owner_id", userId)
      .single();

    if (error || !document) {
      res.status(404).json({ error: "not_found", message: "Document not found" });
      return;
    }

    const contentJson = ((document as any).content_json as any) ?? {
      title: (document as any).title,
      sections: [],
    };
    const sectionIndex = contentJson.sections?.findIndex(
      (s: any) => s.id === sectionId,
    );
    if (sectionIndex === undefined || sectionIndex === -1) {
      res.status(404).json({
        error: "not_found",
        message: "Section not found in document",
      });
      return;
    }

    const project = await loadProjectContext(
      (document as any).project_id,
      userId,
    );
    if (!project) {
      res.status(404).json({
        error: "not_found",
        message: "Source project not found or not accessible",
      });
      return;
    }

    const resources = await loadProjectResources(project.id, userId);

    const knowledge = await extractProjectKnowledge({
      projectTitle: project.title,
      projectDescription: project.description,
      resources,
    });

    const existingSections = contentJson.sections.filter(
      (s: any) => s.id !== sectionId,
    );
    const existingApprovedSections: Record<string, string> = Object.fromEntries(
      existingSections.map((s: any) => [s.id, s.content]),
    );

    const instructionSuffix = req.validated!.body.instructions
      ? `\n\nAdditional user instructions for this regeneration:\n${req.validated!.body.instructions}`
      : "";

    const jobContext = await resolveJobContext(document as any);

    const generated = await generateSection({
      sectionId,
      sectionHeading: contentJson.sections[sectionIndex].heading,
      projectKnowledge: {
        ...knowledge,
        ...(instructionSuffix ? { user_instructions: instructionSuffix } : {}),
      },
      templateRequirements: jobContext.templateRequirements,
      relevantResources: resources.map((r) => ({
        name: r.name,
        content: r.content,
      })),
      existingApprovedSections,
      documentType: jobContext.documentType,
    });

    // generateSection degrades to a visible placeholder on provider errors.
    // Do not overwrite the user's existing text with that placeholder.
    if (generated.content.startsWith("[SECTION GENERATION FAILED")) {
      res.status(502).json({
        error: "generation_failed",
        message:
          "The AI provider could not regenerate this section. Your existing content was kept.",
        warnings: generated.warnings ?? [],
      });
      return;
    }

    contentJson.sections[sectionIndex] = {
      ...contentJson.sections[sectionIndex],
      content: generated.content,
      source_references:
        generated.source_references ??
        contentJson.sections[sectionIndex].source_references ??
        [],
      warnings: generated.warnings ?? [],
      updated_at: new Date().toISOString(),
    };

    const newVersion = ((document as any).version_number as number) + 1;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("generated_documents")
      .update({
        content_json: contentJson,
        version_number: newVersion,
        status: "draft",
        updated_at: new Date().toISOString(),
        docx_storage_path: null,
        pdf_storage_path: null,
      })
      .eq("id", id)
      .eq("owner_id", userId)
      .select()
      .single();

    if (updateErr || !updated) {
      logger.error(
        { error: updateErr, userId, documentId: id, sectionId },
        "section regeneration update failed",
      );
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to save regenerated section",
      });
      return;
    }

    await snapshotVersion({
      documentId: id,
      ownerId: userId,
      versionNumber: newVersion,
      contentJson,
      source: "regenerate",
    });

    await reserveCredits(
      userId,
      "section_regenerate",
      0,
      `doc_regen_${id}_${sectionId}_${newVersion}`,
      null,
      { documentId: id, sectionId },
    ).catch((err: any) => {
      logger.warn({ err, documentId: id }, "section regeneration credit record failed");
    });

    res.json({
      document: updated,
      sectionId,
      version: newVersion,
      warnings: generated.warnings ?? [],
    });

    auditLog({
      user_id: userId,
      event_type: "document.regenerate_section",
      target_type: "document",
      target_id: id,
      metadata: { sectionId, version: newVersion },
      ip_address: req.ip ?? null,
      user_agent: req.get("User-Agent") ?? null,
    }).catch(() => {});
  },
);

/**
 * DELETE /api/v1/documents/:id
 * Owner-only permanent delete. Cached DOCX/PDF exports and version history are
 * removed with the document.
 */
router.delete(
  "/documents/:id",
  authenticate,
  validate(GetDocumentSchema),
  async (req: IdReq, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.validated!.params;

    const { data: document, error } = await supabaseAdmin
      .from("generated_documents")
      .select("id, owner_id, title, docx_storage_path, pdf_storage_path")
      .eq("id", id)
      .eq("owner_id", userId)
      .single();

    if (error || !document) {
      res.status(404).json({ error: "not_found", message: "Document not found" });
      return;
    }

    const { error: deleteError } = await supabaseAdmin
      .from("generated_documents")
      .delete()
      .eq("id", id)
      .eq("owner_id", userId);

    if (deleteError) {
      logger.error({ error: deleteError, userId, documentId: id }, "delete document failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to delete document",
      });
      return;
    }

    for (const storagePath of [
      (document as any).docx_storage_path,
      (document as any).pdf_storage_path,
    ]) {
      if (storagePath) {
        await deleteFile("generated-documents", storagePath).catch((err: any) =>
          logger.warn({ err, storagePath }, "delete document export failed"),
        );
      }
    }

    res.status(204).send();

    auditLog({
      user_id: userId,
      event_type: "document.delete",
      target_type: "document",
      target_id: id,
      metadata: { title: (document as any).title },
      ip_address: req.ip ?? null,
      user_agent: req.get("User-Agent") ?? null,
    }).catch(() => {});
  },
);

/**
 * GET /api/v1/documents/:id/versions
 * List content versions (metadata only) for a document.
 */
router.get(
  "/documents/:id/versions",
  authenticate,
  validate(GetDocumentSchema),
  async (req: IdReq, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.validated!.params;

    const { data: document, error: docErr } = await supabaseAdmin
      .from("generated_documents")
      .select("id")
      .eq("id", id)
      .eq("owner_id", userId)
      .single();

    if (docErr || !document) {
      res.status(404).json({ error: "not_found", message: "Document not found" });
      return;
    }

    const { data: versions, error } = await supabaseAdmin
      .from("document_versions")
      .select("id, version_number, source, created_at")
      .eq("document_id", id)
      .eq("owner_id", userId)
      .order("version_number", { ascending: false });

    if (error) {
      logger.error({ error, userId, documentId: id }, "list versions failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to list document versions",
      });
      return;
    }

    res.json({ versions: versions ?? [] });
  },
);

/**
 * GET /api/v1/documents/:id/versions/:versionNumber
 * Fetch one version's content for preview.
 */
router.get(
  "/documents/:id/versions/:versionNumber",
  authenticate,
  validate(RestoreDocumentVersionSchema),
  async (req: RestoreReq, res: Response) => {
    const userId = req.user!.id;
    const { id, versionNumber } = req.validated!.params;

    const { data: version, error } = await supabaseAdmin
      .from("document_versions")
      .select("id, version_number, source, content_json, created_at")
      .eq("document_id", id)
      .eq("owner_id", userId)
      .eq("version_number", versionNumber)
      .single();

    if (error || !version) {
      res.status(404).json({ error: "not_found", message: "Version not found" });
      return;
    }

    res.json({ version });
  },
);

/**
 * POST /api/v1/documents/:id/versions/:versionNumber/restore
 * Restore a previous version. The restore itself is recorded as a new
 * version, so restoring never destroys history.
 */
router.post(
  "/documents/:id/versions/:versionNumber/restore",
  authenticate,
  validate(RestoreDocumentVersionSchema),
  async (req: RestoreReq, res: Response) => {
    const userId = req.user!.id;
    const { id, versionNumber } = req.validated!.params;

    const { data: document, error: docErr } = await supabaseAdmin
      .from("generated_documents")
      .select("id, version_number")
      .eq("id", id)
      .eq("owner_id", userId)
      .single();

    if (docErr || !document) {
      res.status(404).json({ error: "not_found", message: "Document not found" });
      return;
    }

    const { data: version, error: verErr } = await supabaseAdmin
      .from("document_versions")
      .select("content_json")
      .eq("document_id", id)
      .eq("owner_id", userId)
      .eq("version_number", versionNumber)
      .single();

    if (verErr || !version) {
      res.status(404).json({ error: "not_found", message: "Version not found" });
      return;
    }

    const restoredContent = (version as any).content_json;
    const newVersion = ((document as any).version_number as number) + 1;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("generated_documents")
      .update({
        content_json: restoredContent,
        version_number: newVersion,
        status: "draft",
        updated_at: new Date().toISOString(),
        docx_storage_path: null,
        pdf_storage_path: null,
      })
      .eq("id", id)
      .eq("owner_id", userId)
      .select()
      .single();

    if (updateErr || !updated) {
      logger.error({ error: updateErr, userId, documentId: id }, "restore version failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to restore version",
      });
      return;
    }

    await snapshotVersion({
      documentId: id,
      ownerId: userId,
      versionNumber: newVersion,
      contentJson: restoredContent,
      source: "restore",
    });

    res.json({ document: updated, restoredFrom: versionNumber, version: newVersion });
  },
);

export default router;
