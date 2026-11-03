import { supabaseAdmin } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import { type PlanCode } from "@projectscribe/shared";

export type { PlanCode };

/**
 * Plan limits configuration.
 * These are the source of truth for enforcement — clients cannot override.
 */
export const PLAN_LIMITS: Record<PlanCode, {
  maxProjects: number;
  maxTemplates: number;
  maxGenerationsPerMonth: number;
  maxSectionRegenerations: number;
  pdfExport: boolean;
  price: number; // in INR (₹)
}> = {
  free: {
    maxProjects: 1,
    maxTemplates: 1,
    maxGenerationsPerMonth: 3,
    maxSectionRegenerations: 1,
    pdfExport: false,
    price: 0,
  },
  pro: {
    maxProjects: 10,
    maxTemplates: 5,
    maxGenerationsPerMonth: 50,
    maxSectionRegenerations: 20,
    pdfExport: true,
    price: 149,
  },
};

/**
 * Get the user's current plan code from their subscription.
 * Defaults to "free" if no active subscription.
 */
export async function getUserPlan(userId: string): Promise<PlanCode> {
  const { data: subscription, error } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_code, status, current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !subscription) {
    return "free";
  }

  // Check if the subscription period has expired
  if (subscription.current_period_end) {
    const end = new Date(subscription.current_period_end);
    if (end < new Date()) {
      return "free";
    }
  }

  return (subscription.plan_code as PlanCode) ?? "free";
}

/**
 * Count the user's projects (excluding soft-deleted).
 */
export async function countUserProjects(userId: string): Promise<number> {
  const { data, count, error } = await supabaseAdmin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .is("deleted_at", null);

  if (error) {
    logger.error({ error, userId }, "count user projects failed");
    return 0;
  }

  if (typeof count === "number") return count;
  return Array.isArray(data) ? data.length : 0;
}

/**
 * Count the user's templates.
 */
export async function countUserTemplates(userId: string): Promise<number> {
  const { data, count, error } = await supabaseAdmin
    .from("templates")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);

  if (error) {
    logger.error({ error, userId }, "count user templates failed");
    return 0;
  }

  if (typeof count === "number") return count;
  return Array.isArray(data) ? data.length : 0;
}

/**
 * Count the user's generations in the current month.
 */
export async function countUserGenerationsThisMonth(
  userId: string,
): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, count, error } = await supabaseAdmin
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    // Failed and cancelled attempts should not consume the monthly allowance.
    .in("status", ["queued", "processing", "completed"])
    .gte("created_at", monthStart.toISOString());

  if (error) {
    logger.error({ error, userId }, "count user generations failed");
    return 0;
  }

  if (typeof count === "number") return count;
  return Array.isArray(data) ? data.length : 0;
}

/**
 * Count the user's section regenerations in the current month.
 */
export async function countUserSectionRegenerationsThisMonth(
  userId: string,
): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, count, error } = await supabaseAdmin
    .from("usage_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "section_regenerate")
    .gte("created_at", monthStart.toISOString());

  if (error) {
    logger.error({ error, userId }, "count section regenerations failed");
    return 0;
  }

  if (typeof count === "number") return count;
  return Array.isArray(data) ? data.length : 0;
}

/**
 * Limit check result.
 */
export interface LimitCheck {
  allowed: boolean;
  plan: PlanCode;
  limit: number;
  current: number;
  message?: string;
}

/**
 * Check if the user can create a new project.
 */
export async function checkProjectLimit(userId: string): Promise<LimitCheck> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const current = await countUserProjects(userId);

  if (current >= limits.maxProjects) {
    return {
      allowed: false,
      plan,
      limit: limits.maxProjects,
      current,
      message:
        plan === "pro"
          ? `Student Pro allows ${limits.maxProjects} active projects. Delete an old project to create another.`
          : `You have reached the Free plan limit of ${limits.maxProjects} active project. Upgrade to Student Pro for up to ${PLAN_LIMITS.pro.maxProjects}.`,
    };
  }

  return { allowed: true, plan, limit: limits.maxProjects, current };
}

/**
 * Check if the user can create a new template.
 */
export async function checkTemplateLimit(userId: string): Promise<LimitCheck> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const current = await countUserTemplates(userId);

  if (current >= limits.maxTemplates) {
    return {
      allowed: false,
      plan,
      limit: limits.maxTemplates,
      current,
      message:
        plan === "pro"
          ? `Student Pro allows ${limits.maxTemplates} templates. Remove an old template to upload another.`
          : `You have reached the Free plan limit of ${limits.maxTemplates} custom template. Upgrade to Student Pro for up to ${PLAN_LIMITS.pro.maxTemplates}.`,
    };
  }

  return { allowed: true, plan, limit: limits.maxTemplates, current };
}

/**
 * Check if the user can start a new generation.
 */
export async function checkGenerationLimit(userId: string): Promise<LimitCheck> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const current = await countUserGenerationsThisMonth(userId);

  if (current >= limits.maxGenerationsPerMonth) {
    return {
      allowed: false,
      plan,
      limit: limits.maxGenerationsPerMonth,
      current,
      message:
        plan === "pro"
          ? `You have used all ${limits.maxGenerationsPerMonth} generations included this month.`
          : `You have reached the Free plan limit of ${limits.maxGenerationsPerMonth} generations per month. Upgrade to Student Pro for ${PLAN_LIMITS.pro.maxGenerationsPerMonth} per month.`,
    };
  }

  return { allowed: true, plan, limit: limits.maxGenerationsPerMonth, current };
}

/**
 * Check if the user can regenerate a document section.
 */
export async function checkSectionRegenerationLimit(
  userId: string,
): Promise<LimitCheck> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const current = await countUserSectionRegenerationsThisMonth(userId);

  if (current >= limits.maxSectionRegenerations) {
    return {
      allowed: false,
      plan,
      limit: limits.maxSectionRegenerations,
      current,
      message:
        plan === "pro"
          ? `You have used all ${limits.maxSectionRegenerations} section regenerations included this month.`
          : `You have reached the Free plan section regeneration limit of ${limits.maxSectionRegenerations} per month. Upgrade to Student Pro for ${PLAN_LIMITS.pro.maxSectionRegenerations} per month.`,
    };
  }

  return { allowed: true, plan, limit: limits.maxSectionRegenerations, current };
}

/**
 * Middleware factory: enforce a limit check before allowing a request.
 * `checkFn` takes the userId and returns a LimitCheck; if not allowed,
 * returns 403.
 */
export function enforceLimit(checkFn: (userId: string) => Promise<LimitCheck>) {
  return async (req: any, res: any, next: any) => {
    const userId = req.user!.id;
    try {
      const check = await checkFn(userId);
      if (!check.allowed) {
        res.status(403).json({
          error: "limit_exceeded",
          message: check.message,
          plan: check.plan,
          limit: check.limit,
          current: check.current,
        });
        return;
      }
      next();
    } catch (err: any) {
      logger.error({ err }, "limit check failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to check usage limits",
      });
    }
  };
}
