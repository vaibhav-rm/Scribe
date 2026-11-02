import { supabaseAdmin } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

export interface LoadedResource {
  id: string;
  type: "text" | "file" | "github";
  name: string;
  content: string;
  sourceType?: string;
}

/**
 * Load a project's completed resources with their extracted text so they can
 * be supplied to the generation pipeline. Only the owner's resources are
 * returned; callers should already have verified project ownership.
 *
 * Resources with no usable text (for example a GitHub repository that has not
 * finished ingestion) are omitted rather than passed to the model as empty
 * sources.
 */
export async function loadProjectResources(
  projectId: string,
  ownerId: string,
): Promise<LoadedResource[]> {
  const { data, error } = await supabaseAdmin
    .from("project_resources")
    .select(
      "id, resource_type, original_filename, external_url, processing_status, extracted_text, metadata",
    )
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error({ error, projectId, ownerId }, "load project resources failed");
    return [];
  }

  const resources: LoadedResource[] = [];
  for (const row of data ?? []) {
    const raw = (row as any).extracted_text;
    if (typeof raw !== "string" || raw.trim().length === 0) continue;

    const metadata = ((row as any).metadata ?? {}) as Record<string, any>;
    const name =
      (typeof metadata.name === "string" && metadata.name) ||
      (row as any).original_filename ||
      (row as any).external_url ||
      "Resource";

    resources.push({
      id: (row as any).id,
      type: (row as any).resource_type,
      name,
      content: raw,
      sourceType: typeof metadata.source_type === "string" ? metadata.source_type : undefined,
    });
  }

  return resources;
}

export interface ProjectContext {
  id: string;
  title: string;
  description: string | null;
  academicYear: string | null;
}

export async function loadProjectContext(
  projectId: string,
  ownerId: string,
): Promise<ProjectContext | null> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, title, description, academic_year")
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;

  return {
    id: (data as any).id,
    title: (data as any).title,
    description: (data as any).description ?? null,
    academicYear: (data as any).academic_year ?? null,
  };
}

export interface AccessibleTemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  storage_path: string;
  parsed_specification: Record<string, unknown> | null;
  parsing_status: string;
  validation_warnings: string[] | null;
}

/**
 * Load a template version the caller is allowed to use: either they own the
 * template, or the template is shared as public/unlisted. Prevents using a
 * guessed ID to read another user's private template.
 */
export async function loadAccessibleTemplateVersion(
  templateVersionId: string,
  userId: string,
): Promise<AccessibleTemplateVersion | null> {
  const { data, error } = await supabaseAdmin
    .from("template_versions")
    .select(
      "id, template_id, version_number, storage_path, parsed_specification, parsing_status, validation_warnings, templates!inner(owner_id, visibility, verification_status)",
    )
    .eq("id", templateVersionId)
    .single();

  if (error || !data) return null;

  const template = (data as any).templates as
    | {
        owner_id: string | null;
        visibility: string;
        verification_status: string;
      }
    | null;

  if (!template) return null;

  const canUse =
    template.owner_id === userId ||
    template.visibility === "unlisted" ||
    (template.visibility === "public" &&
      template.verification_status === "verified");

  if (!canUse) return null;

  return {
    id: (data as any).id,
    template_id: (data as any).template_id,
    version_number: (data as any).version_number,
    storage_path: (data as any).storage_path,
    parsed_specification: (data as any).parsed_specification ?? null,
    parsing_status: (data as any).parsing_status,
    validation_warnings: (data as any).validation_warnings ?? null,
  };
}
