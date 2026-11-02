/**
 * Background generation worker.
 *
 * Claims queued generation jobs from the database-backed queue using the
 * `claim_next_job` RPC (SELECT ... FOR UPDATE SKIP LOCKED) and runs the AI
 * pipeline for each one.
 *
 * Run the API with GENERATION_MODE=worker and start this process separately:
 *   npm --workspace apps/api run dev:worker
 *
 * Multiple workers can run concurrently; the RPC guarantees each job is
 * claimed by exactly one consumer.
 */
import { claimNextJob, failJob } from "./services/generation.js";
import { runGeneration } from "./services/ai/pipeline/index.js";
import {
  loadProjectResources,
  loadAccessibleTemplateVersion,
} from "./services/resources.js";
import { getEnv } from "./config/env.js";
import { logger } from "./lib/logger.js";

const consumerId = `worker-${process.pid}-${Date.now()}`;
let stopping = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processNextJob(): Promise<boolean> {
  const job = await claimNextJob(consumerId);
  if (!job) return false;

  logger.info(
    { jobId: job.id, ownerId: job.owner_id, documentType: job.document_type },
    "worker claimed job",
  );

  try {
    const resources = await loadProjectResources(job.project_id, job.owner_id);
    const templateVersion = job.template_version_id
      ? await loadAccessibleTemplateVersion(job.template_version_id, job.owner_id)
      : null;

    await runGeneration({
      jobId: job.id,
      projectId: job.project_id,
      ownerId: job.owner_id,
      templateVersion,
      documentType: job.document_type,
      resources,
      // The approved outline (if the user reviewed one) is stored on the job.
      outline: ((job as any).outline_json ?? null) as any,
    });
  } catch (err: any) {
    logger.error({ err, jobId: job.id }, "worker job failed");
    await failJob(
      job.id,
      err?.code ?? "worker_failure",
      err?.message ?? "Generation failed in worker",
    ).catch(() => {});
  }

  return true;
}

async function workerLoop(slot: number, pollInterval: number): Promise<void> {
  logger.info({ consumerId, slot }, "worker slot started");

  while (!stopping) {
    let processed = false;
    try {
      processed = await processNextJob();
    } catch (err: any) {
      logger.error({ err, slot }, "worker loop error");
    }

    if (!processed) {
      await sleep(pollInterval);
    }
  }
}

async function main(): Promise<void> {
  const env = getEnv();
  const pollInterval = env.WORKER_POLL_INTERVAL_MS;
  const slots = env.CONCURRENT_JOBS;

  logger.info(
    { consumerId, pollInterval, slots },
    "generation worker starting",
  );

  process.on("SIGINT", () => {
    logger.info("worker received SIGINT; finishing current jobs");
    stopping = true;
  });
  process.on("SIGTERM", () => {
    logger.info("worker received SIGTERM; finishing current jobs");
    stopping = true;
  });

  await Promise.all(
    Array.from({ length: slots }, (_, index) => workerLoop(index, pollInterval)),
  );

  logger.info("generation worker stopped");
  process.exit(0);
}

main().catch((err) => {
  logger.fatal({ err }, "generation worker crashed");
  process.exit(1);
});
