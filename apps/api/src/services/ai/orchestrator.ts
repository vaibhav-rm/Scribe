import { supabaseAdmin } from "../../lib/supabase.js";
import { logger } from "../../lib/logger.js";
import {
  updateJobProgress,
  completeJob,
  failJob,
  isJobCancelled,
} from "../generation.js";
import {
  extractProjectKnowledge,
} from "./pipeline/stageA_knowledge.js";
import { interpretTemplate, type TemplateInterpretation } from "./pipeline/stageB_template.js";
import { generateOutline } from "./pipeline/stageC_outline.js";
import type { DocumentOutline } from "./schemas.js";
import { generateSection } from "./pipeline/stageD_sections.js";
import { validateDocument } from "./pipeline/stageE_validation.js";
import { assembleDocument } from "./pipeline/stageF_assembly.js";
import { finalValidation } from "./pipeline/stageG_final.js";
import { downloadFile, uploadFile } from "../../lib/storage.js";
import {
  contentTablesForHeading,
  extractTemplateLayout,
  type GeneratedImageAsset,
  type RenderImage,
  type TemplateLayout,
} from "../docx-template.js";
import { generateTemplateImages } from "./image-generation.js";
import { randomUUID } from "node:crypto";

export interface RunGenerationInput {
  jobId: string;
  projectId: string;
  ownerId: string;
  templateVersion: {
    id: string;
    template_id: string;
    storage_path: string;
    parsed_specification: Record<string, unknown> | null;
    parsing_status: string;
    validation_warnings: string[] | null;
  } | null;
  documentType: string;
  resources: Array<{
    id: string;
    type: "text" | "file" | "github";
    name: string;
    content?: string;
    metadata?: Record<string, unknown>;
  }>;
  /**
   * A previously generated and user-reviewed outline. When provided, Stage C
   * is skipped and the approved outline is used verbatim.
   */
  outline?: DocumentOutline | null;
  /**
   * Optional values for title-page / signature placeholders. Empty values are
   * ignored so the template keeps its visible placeholders.
   */
  placeholderValues?: Record<string, string> | null;
}

/**
 * Build a human-readable document title from the document type and project
 * title, e.g. "Smart Irrigation — Project Synopsis".
 */
function buildDocumentTitle(
  documentType: string,
  projectTitle: string | null | undefined,
): string {
  const label = documentType
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return projectTitle ? `${projectTitle} — ${label}` : label;
}

function normalizePlaceholderValues(
  values: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!values || typeof values !== "object") return {};
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, 200);
    if (!trimmed) continue;
    normalized[key.slice(0, 80)] = trimmed;
  }
  return normalized;
}

function currentAcademicYear(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = January
  // Indian academic year starts around June/July.
  return month >= 5
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`;
}

/**
 * Run the full AI generation pipeline (Stages A-G) for a generation job.
 * Updates job progress in the database after each stage.
 * Handles errors gracefully and records credit usage.
 */
export async function runGeneration(input: RunGenerationInput): Promise<void> {
  const { jobId, ownerId, projectId, documentType, resources } = input;
  const placeholderValues = normalizePlaceholderValues(
    input.placeholderValues ??
      (input.outline as any)?.placeholderValues ??
      null,
  );

  try {
    if (await isJobCancelled(jobId)) {
      logger.info({ jobId }, "generation skipped: job was cancelled before start");
      return;
    }
    await updateJobProgress(jobId, { status: "processing", progress: 5 });

    // Stage A: Project knowledge extraction
    await updateJobProgress(jobId, { progress: 15 });
    const project = await supabaseAdmin
      .from("projects")
      .select("title, description")
      .eq("id", projectId)
      .single();

    const knowledge = await extractProjectKnowledge({
      projectTitle: project.data?.title ?? "",
      projectDescription: project.data?.description ?? null,
      resources,
    });
    logger.info({ jobId, stage: "A", knowledgeTitle: knowledge.title }, "Stage A complete");

    // Stage B: Template interpretation
    await updateJobProgress(jobId, { progress: 30 });
    const templateInterp: TemplateInterpretation =
      input.templateVersion
        ? await interpretTemplate(input.templateVersion)
        : {
            requiredSections: ["Introduction", "Methodology", "Conclusion"],
            requiredMetadata: ["title"],
            formattingRules: {},
            sectionDependencies: {},
            requiredTablesOrAppendices: [],
            outputFormats: ["docx", "pdf"] as ("docx" | "pdf")[],
          };
    logger.info({ jobId, stage: "B", sectionCount: templateInterp.requiredSections.length }, "Stage B complete");

    // Load the original DOCX so Stage F can edit it directly instead of
    // recreating a generic document. The layout also tells Stage D which
    // tables need generated rows.
    let templateBuffer: Buffer | undefined;
    let templateLayout: TemplateLayout | undefined;
    if (input.templateVersion) {
      try {
        templateBuffer = await downloadFile(
          "templates",
          input.templateVersion.storage_path,
        );
        templateLayout = await extractTemplateLayout(templateBuffer);
      } catch (err: any) {
        logger.warn(
          { err: err?.message, jobId },
          "template download/parse failed; using generic assembly",
        );
      }
    }

    const ownerProfile = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", ownerId)
      .single();

    const keywords = Array.from(
      new Set(
        [
          ...(knowledge.technology_stack ?? []),
          ...knowledge.title
            .split(/[^A-Za-z0-9+.#-]+/)
            .filter((word) => word.length > 3),
        ].filter(Boolean),
      ),
    ).slice(0, 7);

    const renderMetadata = {
      projectTitle:
        placeholderValues.project_title ??
        project.data?.title ??
        undefined,
      studentName:
        placeholderValues.student_name ??
        ownerProfile.data?.display_name ??
        undefined,
      usn: placeholderValues.usn,
      academicYear:
        placeholderValues.academic_year ?? currentAcademicYear(),
      keywords,
      semester: placeholderValues.semester,
      semesterSection: placeholderValues.semester_section,
      section: placeholderValues.section,
      labBatch: placeholderValues.lab_batch,
      dateOfSubmission: placeholderValues.date_of_submission,
      guideName: placeholderValues.guide_name,
      guideDesignation: placeholderValues.guide_designation,
      nameUsn: placeholderValues.name_usn,
      guideNameDesignation: placeholderValues.guide_name_designation,
      department: placeholderValues.department,
      college: placeholderValues.college,
      course: placeholderValues.course,
      subject: placeholderValues.subject,
      faculty: placeholderValues.faculty,
      placeholderValues,
    };

    // Stage C: Outline generation (or use the outline the user already reviewed)
    await updateJobProgress(jobId, { progress: 45 });
    const outline =
      input.outline ??
      (await generateOutline({
        projectKnowledge: knowledge,
        templateInterpretation: templateInterp,
        documentType,
      }));

    // Persist the outline that was actually used so the UI can display it
    // and it can be audited later.
    await supabaseAdmin
      .from("generation_jobs")
      .update({
        outline_json:
          Object.keys(placeholderValues).length > 0
            ? { ...outline, placeholderValues }
            : outline,
      })
      .eq("id", jobId);

    logger.info(
      { jobId, stage: "C", sectionCount: outline.sections.length, reused: !!input.outline },
      "Stage C complete",
    );

    // Stage D: Section-by-section generation
    await updateJobProgress(jobId, { progress: 55 });
    const generatedSections: Array<{
      id: string;
      heading: string;
      content: string;
      tables?: Array<{ headers: string[]; rows: string[][] }>;
      source_references?: string[];
      warnings?: string[];
    }> = [];

    const totalSections = outline.sections.length;
    for (let i = 0; i < totalSections; i++) {
      if (await isJobCancelled(jobId)) {
        logger.info({ jobId, stage: "D" }, "generation stopped: job was cancelled");
        return;
      }
      const section = outline.sections[i];
      const sectionResult = await generateSection({
        sectionId: section.id,
        sectionHeading: section.heading,
        projectKnowledge: knowledge,
        templateRequirements: templateInterp.formattingRules,
        relevantResources: resources
          .filter((r) => !!r.content)
          .map((r) => ({ name: r.name, content: r.content! })),
        existingApprovedSections: Object.fromEntries(
          generatedSections.map((s) => [s.id, s.content]),
        ),
        documentType,
        templateTables: templateLayout
          ? contentTablesForHeading(templateLayout, section.heading).map(
              (table) => ({
                headers: table.headers,
                rowLabels: table.rowLabels,
              }),
            )
          : undefined,
      });
      generatedSections.push(sectionResult);

      const progress = 55 + Math.round(((i + 1) / totalSections) * 25);
      await updateJobProgress(jobId, { progress: Math.min(progress, 80) });
    }
    logger.info({ jobId, stage: "D", generatedCount: generatedSections.length }, "Stage D complete");

    // Stage E: Validation
    await updateJobProgress(jobId, { progress: 82 });
    const validation = await validateDocument({
      documentTitle: `${documentType} Document`,
      sections: generatedSections,
      templateRequiredSections: templateInterp.requiredSections,
      projectKnowledge: knowledge,
      sourceResources: resources
        .filter((r) => !!r.content)
        .map((r) => ({ name: r.name, content: r.content! })),
    });
    logger.info({ jobId, stage: "E", passed: validation.passed }, "Stage E complete");

    if (await isJobCancelled(jobId)) {
      logger.info({ jobId, stage: "F" }, "generation stopped: job was cancelled");
      return;
    }

    // Figures are generated from the same project knowledge and source
    // excerpts used for the text. A provider failure leaves the template's
    // visible figure placeholder in place instead of failing the document.
    await updateJobProgress(jobId, { progress: 86 });
    const imageWarnings: string[] = [];
    const generatedImageAssets: GeneratedImageAsset[] = [];
    let renderImages: Array<RenderImage | null> = [];

    if (templateLayout?.imagePlaceholders.length) {
      const imageResult = await generateTemplateImages({
        placeholders: templateLayout.imagePlaceholders,
        projectTitle: renderMetadata.projectTitle ?? knowledge.title,
        projectDescription: project.data?.description ?? null,
        documentType,
        knowledge,
        sections: generatedSections.map((section) => ({
          heading: section.heading,
          content: section.content,
        })),
        resources,
      });
      renderImages = imageResult.images;
      imageWarnings.push(...imageResult.warnings);

      for (const image of imageResult.images) {
        if (!image) continue;
        const extension = image.mimeType.includes("jpeg") ? "jpg" : "png";
        const imagePath = `documents/${ownerId}/${jobId}/images/${image.index}-${randomUUID()}.${extension}`;
        try {
          await uploadFile(
            "generated-documents",
            imagePath,
            image.buffer,
            image.mimeType,
          );
          generatedImageAssets.push({
            index: image.index,
            storagePath: imagePath,
            mimeType: image.mimeType,
            caption: image.caption,
            altText: image.altText,
          });
        } catch (uploadError: any) {
          imageWarnings.push(
            `Figure "${image.caption}" was embedded in the DOCX but could not be saved for future re-exports: ${uploadError?.message ?? "storage error"}`,
          );
        }
      }
    }

    const documentMetadata = {
      ...renderMetadata,
      generatedImages: generatedImageAssets,
      imageWarnings,
    };

    // Stage F: Document assembly (DOCX)
    await updateJobProgress(jobId, { progress: 90 });
    const documentTitle = buildDocumentTitle(documentType, project.data?.title);
    const { buffer, warnings: assemblyWarnings } = await assembleDocument({
      documentTitle,
      sections: generatedSections,
      templateSpec: input.templateVersion?.parsed_specification ?? {},
      templateBuffer,
      metadata: documentMetadata,
      images: renderImages,
      outputFormat: "docx",
    });

    // Upload DOCX to storage
    const docxPath = `documents/${ownerId}/${jobId}/${randomUUID()}.docx`;
    await uploadFile(
      "generated-documents",
      docxPath,
      buffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    logger.info({ jobId, stage: "F", bufferSize: buffer.length }, "Stage F complete");

    // Stage G: Final validation
    await updateJobProgress(jobId, { progress: 95 });
    const final = await finalValidation({
      documentTitle,
      sections: generatedSections,
      templateSpec: input.templateVersion?.parsed_specification ?? {},
      outputFormat: "docx",
      docxBuffer: buffer,
    });
    logger.info({ jobId, stage: "G", passed: final.passed }, "Stage G complete");

    if (await isJobCancelled(jobId)) {
      logger.info({ jobId, stage: "save" }, "generation stopped: job was cancelled");
      return;
    }

    // Create the generated document record
    const { data: docData, error: docErr } = await supabaseAdmin
      .from("generated_documents")
      .insert({
        owner_id: ownerId,
        project_id: projectId,
        generation_job_id: jobId,
        title: documentTitle,
        version_number: 1,
        content_json: {
          title: documentTitle,
          sections: generatedSections,
          metadata: documentMetadata,
        },
        // Keep the spec so a later export after editing can rebuild the DOCX
        // with the same formatting instead of reverting to defaults.
        template_spec: input.templateVersion?.parsed_specification ?? {},
        docx_storage_path: docxPath,
        pdf_storage_path: null,
        status: "completed",
      })
      .select()
      .single();

    if (docErr || !docData) {
      logger.error({ error: docErr, jobId }, "create generated document failed");
      throw new Error("The document was assembled but could not be saved. Please retry.");
    } else {
      // Keep the first version so edits never silently discard generated work.
      const { error: versionErr } = await supabaseAdmin
        .from("document_versions")
        .insert({
          document_id: (docData as any).id,
          owner_id: ownerId,
          version_number: 1,
          content_json: {
            title: documentTitle,
            sections: generatedSections,
            metadata: documentMetadata,
          },
          source: "generation",
        });
      if (versionErr) {
        logger.warn({ error: versionErr, jobId }, "initial document version snapshot failed");
      }
    }

    // Complete the job
    const allWarnings = [
      ...assemblyWarnings,
      ...final.warnings,
      ...validation.warnings,
      ...imageWarnings,
    ];
    await completeJob(jobId, 0); // actual cost tracked separately
    await updateJobProgress(jobId, { progress: 100 });

    logger.info({ jobId, status: "completed", warnings: allWarnings.length }, "Generation complete");
  } catch (err: any) {
    logger.error({ err, jobId }, "Generation pipeline failed");
    const errorCode = err?.code ?? "generation_failed";
    const errorMessage = err?.message ?? "Generation failed";
    await failJob(jobId, errorCode, errorMessage);
    throw err;
  }
}
