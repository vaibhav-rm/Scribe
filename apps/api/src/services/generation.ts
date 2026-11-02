import { supabaseAdmin } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import { GenerationJob } from "@projectscribe/shared";

export type JobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export interface GenerationJobInput {
  ownerId: string;
  projectId: string;
  templateVersionId: string | null;
  documentType: string;
  provider: string;
  model: string;
  estimatedCost?: number | null;
}

/**
 * Create a new generation job in the database.
 */
export async function createGenerationJob(input: GenerationJobInput): Promise<GenerationJob> {
  const { data, error } = await supabaseAdmin
    .from("generation_jobs")
    .insert({
      owner_id: input.ownerId,
      project_id: input.projectId,
      template_version_id: input.templateVersionId,
      document_type: input.documentType,
      status: "queued",
      progress: 0,
      provider: input.provider,
      model: input.model,
      estimated_cost: input.estimatedCost ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    logger.error({ error, ownerId: input.ownerId }, "create generation job failed");
    throw new Error("Failed to create generation job");
  }

  return data as GenerationJob;
}

/**
 * Atomically claim the next queued job for processing.
 * Returns null if no jobs are available.
 */
export async function claimNextJob(consumerId: string): Promise<GenerationJob | null> {
  const { data, error } = await supabaseAdmin.rpc("claim_next_job", {
    p_consumer_id: consumerId,
  });

  if (error) {
    // Fallback: try atomic update directly
    const { data: fallback, error: fbErr } = await supabaseAdmin
      .from("generation_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .select()
      .single();

    if (fbErr || !fallback) return null;
    return fallback as GenerationJob;
  }

  return (data as GenerationJob[])?.[0] ?? null;
}

/**
 * Update job progress and status.
 */
export async function updateJobProgress(
  jobId: string,
  updates: Partial<Pick<GenerationJob, "status" | "progress" | "error_code" | "error_message" | "completed_at" | "actual_cost">>,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("generation_jobs")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    logger.error({ error, jobId }, "update job progress failed");
  }
}

/**
 * Mark a job as completed.
 */
export async function completeJob(
  jobId: string,
  actualCost: number | null,
): Promise<void> {
  await updateJobProgress(jobId, {
    status: "completed",
    progress: 100,
    completed_at: new Date().toISOString(),
    actual_cost: actualCost,
  });
}

/**
 * Mark a job as failed.
 */
export async function failJob(
  jobId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  await updateJobProgress(jobId, {
    status: "failed",
    error_code: errorCode,
    error_message: errorMessage,
    completed_at: new Date().toISOString(),
  });
}

/**
 * Cancel a job if it's still queued or processing.
 */
export async function cancelJob(jobId: string, ownerId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("generation_jobs")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("owner_id", ownerId)
    .in("status", ["queued", "processing"])
    .select("id")
    .single();

  if (error || !data) return false;
  return true;
}

/**
 * Check whether a job was cancelled while a worker or inline process was
 * running it. Long generation loops must stop writing after this flips.
 */
export async function isJobCancelled(jobId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("generation_jobs")
    .select("status")
    .eq("id", jobId)
    .single();
  if (error) return false;
  return (data as any)?.status === "cancelled";
}

/**
 * Get a job by ID with ownership check.
 */
export async function getJob(jobId: string, ownerId: string): Promise<GenerationJob | null> {
  const { data, error } = await supabaseAdmin
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("owner_id", ownerId)
    .single();

  if (error || !data) return null;
  return data as GenerationJob;
}

/**
 * Record a credit reservation in the usage ledger.
 */
export async function reserveCredits(
  userId: string,
  eventType: string,
  creditsDelta: number,
  idempotencyKey: string,
  generationJobId: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  if (!Number.isInteger(creditsDelta)) {
    throw new Error("Credit delta must be an integer usage unit");
  }

  const { error } = await supabaseAdmin.rpc("adjust_credits", {
    p_user_id: userId,
    p_event_type: eventType,
    p_credits_delta: creditsDelta,
    p_idempotency_key: idempotencyKey,
    p_generation_job_id: generationJobId,
    p_metadata: metadata,
  });

  if (error) {
    logger.error({ error, userId, eventType }, "reserve credits failed");
    throw new Error("Failed to reserve credits");
  }
}
