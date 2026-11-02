import { Router, Response } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import {
  CreateGenerationSchema,
  GenerateOutlineSchema,
  GetGenerationSchema,
  CancelGenerationSchema,
  RegenerateSectionSchema,
} from "@projectscribe/shared";
import { validate } from "../middleware/validate.js";
import { enforceLimit, checkGenerationLimit } from "../services/limits.js";
import { auditLog } from "../services/audit.js";
import {
  createGenerationJob,
  getJob,
  cancelJob,
  reserveCredits,
  failJob,
} from "../services/generation.js";
import { runGeneration } from "../services/ai/pipeline/index.js";
import { getRequiredAIProvider } from "../services/ai/index.js";
import { extractProjectKnowledge } from "../services/ai/pipeline/stageA_knowledge.js";
import {
  interpretTemplate,
  type TemplateInterpretation,
} from "../services/ai/pipeline/stageB_template.js";
import { generateOutline } from "../services/ai/pipeline/stageC_outline.js";
import type { DocumentOutline } from "../services/ai/schemas.js";
import {
  loadProjectContext,
  loadProjectResources,
  loadAccessibleTemplateVersion,
  type LoadedResource,
  type AccessibleTemplateVersion,
} from "../services/resources.js";
import { getEnv } from "../config/env.js";
import { logger } from "../lib/logger.js";

const router = Router();

type IdReq = AuthRequest & {
  validated?: { params: { id: string } };
};

type IdSectionReq = AuthRequest & {
  validated?: {
    params: { id: string; sectionId: string };
  };
};

const DEFAULT_INTERPRETATION: TemplateInterpretation = {
  requiredSections: ["Introduction", "Methodology", "Conclusion"],
  requiredMetadata: ["title"],
  formattingRules: {},
  sectionDependencies: {},
  requiredTablesOrAppendices: [],
  outputFormats: ["docx", "pdf"],
};

/**
 * A reviewed outline may only be used for the exact template version and
 * document type it was generated against. Export so this rule can be tested
 * without recreating the whole generation route.
 */
export function outlineMatchesRequest(
  saved: {
    template_version_id: string | null;
    document_type: string;
  },
  requested: {
    templateVersionId: string | null;
    documentType: string;
  },
): boolean {
  return (
    (saved.template_version_id ?? null) === (requested.templateVersionId ?? null) &&
    saved.document_type === requested.documentType
  );
}

function providerOrDefaultTemplate(
  templateVersion: AccessibleTemplateVersion | null,
): Promise<TemplateInterpretation> {
  return templateVersion
    ? interpretTemplate(templateVersion)
    : Promise.resolve(DEFAULT_INTERPRETATION);
}

/**
 * Resolve a project and its resources for generation, enforcing ownership.
 * Returns null when the project does not exist or belongs to someone else.
 */
async function resolveProject(
  projectId: string,
  ownerId: string,
): Promise<{ title: string; description: string | null; resources: LoadedResource[] } | null> {
  const project = await loadProjectContext(projectId, ownerId);
  if (!project) return null;
  const resources = await loadProjectResources(projectId, ownerId);
  return {
    title: project.title,
    description: project.description,
    resources,
  };
}

/**
 * Resolve a template version the user is allowed to use.
 */
async function resolveTemplateVersion(
  templateVersionId: string | null | undefined,
  ownerId: string,
): Promise<
  | { ok: true; version: AccessibleTemplateVersion | null }
  | { ok: false }
> {
  if (!templateVersionId) return { ok: true, version: null };
  const version = await loadAccessibleTemplateVersion(templateVersionId, ownerId);
  if (!version) return { ok: false };
  return { ok: true, version };
}

// POST /api/v1/generations/outline
// Generate a document outline (Stages A-C) for review before the full,
// expensive document generation runs.
router.post(
  "/generations/outline",
  authenticate,
  // Do not spend AI tokens on an outline the user cannot turn into a
  // document because they have already used this month's generations.
  enforceLimit(checkGenerationLimit),
  validate(GenerateOutlineSchema),
  async (req: AuthRequest & { validated?: { body: any } }, res: Response) => {
    const ownerId = req.user!.id;
    const { project_id: projectId, template_version_id: templateVersionId, document_type: documentType } =
      req.validated!.body;

    try {
      getRequiredAIProvider();
    } catch (err: any) {
      res.status(503).json({
        error: "provider_unavailable",
        message: err.message || "No AI provider configured",
      });
      return;
    }

    const project = await resolveProject(projectId, ownerId);
    if (!project) {
      res.status(404).json({
        error: "not_found",
        message: "Project not found or not accessible",
      });
      return;
    }

    const templateResult = await resolveTemplateVersion(templateVersionId, ownerId);
    if (!templateResult.ok) {
      res.status(404).json({
        error: "not_found",
        message: "Template version not found or not accessible",
      });
      return;
    }

    const templateInterp = await providerOrDefaultTemplate(templateResult.version);

    const knowledge = await extractProjectKnowledge({
      projectTitle: project.title,
      projectDescription: project.description,
      resources: project.resources,
    });

    const outline = await generateOutline({
      projectKnowledge: knowledge,
      templateInterpretation: templateInterp,
      documentType,
    });

    // Persist so the approved outline can be reused exactly.
    const { data: saved, error: saveErr } = await supabaseAdmin
      .from("document_outlines")
      .insert({
        owner_id: ownerId,
        project_id: projectId,
        template_version_id: templateVersionId ?? null,
        document_type: documentType,
        outline_json: outline,
      })
      .select("id")
      .single();

    if (saveErr || !saved) {
      logger.error({ error: saveErr, ownerId }, "persist outline failed");
      res.status(500).json({
        error: "outline_persist_failed",
        message:
          "The outline was generated but could not be saved. Please try again.",
      });
      return;
    }

    res.json({
      outlineId: (saved as any).id,
      outline,
      resourcesUsed: project.resources.length,
      knowledgeWarnings: knowledge.missing_facts ?? [],
    });

    auditLog({
      user_id: ownerId,
      event_type: "generation.outline",
      target_type: "document_outline",
      target_id: (saved as any).id,
      metadata: { projectId, documentType, sections: outline.sections.length },
      ip_address: req.ip ?? null,
      user_agent: req.get("User-Agent") ?? null,
    }).catch(() => {});
  },
);

// POST /api/v1/generations
router.post(
  "/generations",
  authenticate,
  enforceLimit(checkGenerationLimit),
  validate(CreateGenerationSchema),
  async (req: AuthRequest & { validated?: { body: any } }, res: Response) => {
    const ownerId = req.user!.id;
    const {
      project_id: projectId,
      template_version_id: templateVersionId,
      document_type: documentType,
      outline_id: outlineId,
    } = req.validated!.body;

    const project = await resolveProject(projectId, ownerId);
    if (!project) {
      res.status(404).json({
        error: "not_found",
        message: "Project not found or not accessible",
      });
      return;
    }

    let providerInstance;
    try {
      providerInstance = getRequiredAIProvider();
    } catch (err: any) {
      res.status(503).json({
        error: "provider_unavailable",
        message: err.message || "No AI provider configured",
      });
      return;
    }

    const templateResult = await resolveTemplateVersion(templateVersionId, ownerId);
    if (!templateResult.ok) {
      res.status(404).json({
        error: "not_found",
        message: "Template version not found or not accessible",
      });
      return;
    }
    const templateVersion = templateResult.version;

    // Optional reviewed outline. Must belong to this user and project.
    let approvedOutline: DocumentOutline | null = null;
    if (outlineId) {
      const { data: savedOutline, error: outlineErr } = await supabaseAdmin
        .from("document_outlines")
        .select("outline_json, template_version_id, document_type")
        .eq("id", outlineId)
        .eq("owner_id", ownerId)
        .eq("project_id", projectId)
        .single();

      if (outlineErr || !savedOutline) {
        res.status(404).json({
          error: "not_found",
          message: "Outline not found or not accessible",
        });
        return;
      }

      // Never let a stale outline be applied to a different template or
      // document type than the one it was reviewed against.
      if (
        !outlineMatchesRequest(
          {
            template_version_id:
              (savedOutline as any).template_version_id ?? null,
            document_type: (savedOutline as any).document_type,
          },
          { templateVersionId: templateVersionId ?? null, documentType },
        )
      ) {
        res.status(400).json({
          error: "outline_mismatch",
          message:
            "This outline was produced for a different template or document type. Regenerate the outline and review it again.",
        });
        return;
      }

      approvedOutline = (savedOutline as any).outline_json as DocumentOutline;
    }

    // Estimate cost (rough)
    const estimatedCost = providerInstance.estimateCost(1000, 2000);

    let job;
    try {
      job = await createGenerationJob({
        ownerId,
        projectId,
        templateVersionId: templateVersionId ?? null,
        documentType,
        provider: providerInstance.id,
        model: providerInstance.model,
        estimatedCost,
      });

      await reserveCredits(
        ownerId,
        "generation_start",
        -estimatedCost,
        `gen_${job.id}`,
        job.id,
        { documentType, projectId },
      );
    } catch (err: any) {
      logger.error({ err, ownerId, projectId }, "failed to enqueue generation");
      // If the job was created but credits could not be reserved, fail it so
      // a worker does not process unpaid work.
      if (job?.id) {
        await failJob(
          job.id,
          "credit_reservation_failed",
          "Could not reserve credits for this generation",
        ).catch(() => {});
      }
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to start generation. Please try again.",
      });
      return;
    }

    // Persist the reviewed outline on the job so a worker (not just inline
    // execution) generates from exactly what the user approved.
    if (approvedOutline) {
      const { error: outlineSaveErr } = await supabaseAdmin
        .from("generation_jobs")
        .update({ outline_json: approvedOutline })
        .eq("id", job.id);
      if (outlineSaveErr) {
        logger.error(
          { error: outlineSaveErr, jobId: job.id },
          "failed to store approved outline on job",
        );
        await failJob(
          job.id,
          "outline_persist_failed",
          "The approved outline could not be saved. Please try again.",
        ).catch(() => {});
        res.status(500).json({
          error: "outline_persist_failed",
          message: "The approved outline could not be saved. Please try again.",
        });
        return;
      }
    }

    const generationInput = {
      jobId: job.id,
      projectId,
      ownerId,
      templateVersion,
      documentType,
      resources: project.resources,
      outline: approvedOutline,
    };

    // In worker mode the job stays queued and is claimed by the worker
    // process. In inline mode it runs in this process (single-instance
    // development default).
    if (getEnv().GENERATION_MODE === "inline") {
      runGeneration(generationInput).catch((err: any) => {
        logger.error({ err, jobId: job.id }, "Background generation failed");
      });
    }

    res.status(202).json({
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        documentType,
        provider: job.provider,
        model: job.model,
        estimatedCost: job.estimated_cost,
      },
    });

    auditLog({
      user_id: ownerId,
      event_type: "generation.create",
      target_type: "generation_job",
      target_id: job.id,
      metadata: {
        documentType,
        projectId,
        provider: job.provider,
        resources: project.resources.length,
        usedReviewedOutline: !!approvedOutline,
      },
      ip_address: req.ip ?? null,
      user_agent: req.get("User-Agent") ?? null,
    }).catch(() => {
      // ignore
    });
  },
);

// GET /api/v1/generations/:id
router.get(
  "/generations/:id",
  authenticate,
  validate(GetGenerationSchema),
  async (req: IdReq, res: Response) => {
    const ownerId = req.user!.id;
    const { id } = req.validated!.params;

    const job = await getJob(id, ownerId);
    if (!job) {
      res.status(404).json({ error: "not_found", message: "Generation job not found" });
      return;
    }

    res.json({ job });
  },
);

// GET /api/v1/generations/:id/outline
// Return the outline that was actually used for a job.
router.get(
  "/generations/:id/outline",
  authenticate,
  validate(GetGenerationSchema),
  async (req: IdReq, res: Response) => {
    const ownerId = req.user!.id;
    const { id } = req.validated!.params;

    const { data, error } = await supabaseAdmin
      .from("generation_jobs")
      .select("id, status, outline_json")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .single();

    if (error || !data) {
      res.status(404).json({ error: "not_found", message: "Generation job not found" });
      return;
    }

    if (!(data as any).outline_json) {
      res.status(404).json({
        error: "outline_not_ready",
        message: "No outline has been generated for this job yet",
      });
      return;
    }

    res.json({
      jobId: (data as any).id,
      status: (data as any).status,
      outline: (data as any).outline_json,
    });
  },
);

// POST /api/v1/generations/:id/cancel
router.post(
  "/generations/:id/cancel",
  authenticate,
  validate(CancelGenerationSchema),
  async (req: IdReq, res: Response) => {
    const ownerId = req.user!.id;
    const { id } = req.validated!.params;

    const cancelled = await cancelJob(id, ownerId);
    if (!cancelled) {
      res.status(404).json({
        error: "not_found",
        message: "Job not found or cannot be cancelled",
      });
      return;
    }

    res.json({ ok: true, status: "cancelled" });
  },
);

// POST /api/v1/generations/:id/sections/:sectionId/regenerate
router.post(
  "/generations/:id/sections/:sectionId/regenerate",
  authenticate,
  validate(RegenerateSectionSchema),
  async (req: IdSectionReq, res: Response) => {
    const ownerId = req.user!.id;
    const { id, sectionId } = req.validated!.params;

    const job = await getJob(id, ownerId);
    if (!job) {
      res.status(404).json({ error: "not_found", message: "Generation job not found" });
      return;
    }

    if (job.status !== "completed") {
      res.status(400).json({
        error: "invalid_request",
        message: "Can only regenerate sections from completed jobs",
      });
      return;
    }

    // Section regeneration creates a new generation job for just that section
    let regenJob;
    try {
      regenJob = await createGenerationJob({
        ownerId,
        projectId: job.project_id,
        templateVersionId: job.template_version_id,
        documentType: job.document_type,
        provider: job.provider,
        model: job.model,
        estimatedCost: job.estimated_cost ?? 0,
      });

      await reserveCredits(
        ownerId,
        "section_regenerate",
        -(regenJob.estimated_cost ?? 0),
        `regen_${regenJob.id}`,
        regenJob.id,
        { sectionId, parentJobId: job.id },
      );
    } catch (err: any) {
      logger.error({ err, ownerId, jobId: id }, "failed to enqueue section regeneration");
      if (regenJob?.id) {
        await failJob(
          regenJob.id,
          "credit_reservation_failed",
          "Could not reserve credits for this regeneration",
        ).catch(() => {});
      }
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to start section regeneration. Please try again.",
      });
      return;
    }

    if (getEnv().GENERATION_MODE === "inline") {
      const project = await resolveProject(job.project_id, ownerId);
      const templateResult = await resolveTemplateVersion(
        job.template_version_id,
        ownerId,
      );

      runGeneration({
        jobId: regenJob.id,
        projectId: job.project_id,
        ownerId,
        templateVersion: templateResult.ok ? templateResult.version : null,
        documentType: job.document_type,
        resources: project?.resources ?? [],
      }).catch((err: any) => {
        logger.error({ err, jobId: regenJob.id }, "Section regeneration failed");
      });
    }

    res.status(202).json({
      job: {
        id: regenJob.id,
        status: regenJob.status,
        sectionId,
      },
    });
  },
);

export default router;
