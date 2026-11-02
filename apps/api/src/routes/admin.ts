import { Router, Response } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth.js";
import {
  AdminReviewTemplateSchema,
} from "@projectscribe/shared";
import { validate } from "../middleware/validate.js";
import { auditLog } from "../services/audit.js";
import { logger } from "../lib/logger.js";
import { getEnv } from "../config/env.js";

const router = Router();

type IdReq = AuthRequest & {
  validated?: {
    params: { id: string };
    body: { status: "verified" | "rejected"; rejection_reason?: string };
  };
};

/**
 * GET /api/v1/admin/overview
 * System overview: user counts, plan distribution, generation stats, errors.
 * Admin only.
 */
router.get(
  "/admin/overview",
  authenticate,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      const [
        { data: profiles },
        { data: subscriptions },
        { data: projects },
        { data: jobs },
        { data: documents },
        { data: templates },
      ] = await Promise.all([
        supabaseAdmin.from("profiles").select("id, role"),
        supabaseAdmin.from("subscriptions").select("plan_code, status, current_period_end"),
        supabaseAdmin.from("projects").select("id, owner_id, deleted_at"),
        supabaseAdmin
          .from("generation_jobs")
          .select("id, status, provider, document_type, progress, error_message, created_at"),
        supabaseAdmin.from("generated_documents").select("id, status"),
        supabaseAdmin.from("templates").select("verification_status, visibility"),
      ]);

      const totalUsers = profiles?.length ?? 0;
      const adminUsers = profiles?.filter((p: any) => p.role === "admin").length ?? 0;
      const now = Date.now();
      const proUsers = subscriptions?.filter(
        (s: any) =>
          s.plan_code === "pro" &&
          s.status === "active" &&
          (!s.current_period_end ||
            new Date(s.current_period_end).getTime() > now),
      ).length ?? 0;

      const totalProjects = projects?.length ?? 0;
      const activeProjects = projects?.filter((p: any) => !p.deleted_at).length ?? 0;

      const totalJobs = jobs?.length ?? 0;
      const completedJobs = jobs?.filter((j: any) => j.status === "completed").length ?? 0;
      const failedJobs = jobs?.filter((j: any) => j.status === "failed").length ?? 0;

      const totalDocuments = documents?.length ?? 0;
      const pendingTemplates = templates?.filter(
        (t: any) => t.verification_status === "pending"
      ).length ?? 0;

      const env = getEnv();
      const recentGenerations = [...(jobs ?? [])]
        .sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 5)
        .map((j: any) => ({
          id: j.id,
          status: j.status,
          provider: j.provider,
          document_type: j.document_type,
          progress: j.progress,
          error_message: j.error_message,
          created_at: j.created_at,
        }));

      res.json({
        users: { total: totalUsers, admins: adminUsers, pro: proUsers },
        projects: { total: totalProjects, active: activeProjects },
        generations: { total: totalJobs, completed: completedJobs, failed: failedJobs },
        documents: { total: totalDocuments },
        templates: { pending: pendingTemplates },
        recentGenerations,
        health: {
          aiProvider: env.AI_PROVIDER,
          pdfConversion: env.DOC_CONVERSION_ENABLED,
          billingProvider: env.RAZORPAY_KEY_ID ? "razorpay" : "mock",
          generationMode: env.GENERATION_MODE,
        },
      });
    } catch (err: any) {
      logger.error({ err }, "admin overview failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to load admin overview",
      });
    }
  },
);

/**
 * GET /api/v1/admin/templates/pending
 * List templates pending verification.
 * Admin only.
 */
router.get(
  "/admin/templates/pending",
  authenticate,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      const { data: templates, error } = await supabaseAdmin
        .from("templates")
        .select(
          "id, title, description, document_type, academic_year, visibility, owner_id, created_at, current_version_id, review_notes",
        )
        .eq("verification_status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        res.status(500).json({
          error: "internal_server_error",
          message: "Failed to load pending templates",
        });
        return;
      }

      res.json({ templates: templates ?? [] });
    } catch (err: any) {
      logger.error({ err }, "admin pending templates failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to load pending templates",
      });
    }
  },
);

/**
 * POST /api/v1/admin/templates/:id/review
 * Approve or reject a template submission.
 * Admin only.
 */
router.post(
  "/admin/templates/:id/review",
  authenticate,
  requireAdmin,
  validate(AdminReviewTemplateSchema),
  async (req: IdReq, res: Response) => {
    const { id } = req.validated!.params;
    const { status, rejection_reason } = req.validated!.body;

    if (!status || !["verified", "rejected"].includes(status)) {
      res.status(400).json({
        error: "validation_failed",
        message: "status must be 'verified' or 'rejected'",
      });
      return;
    }

    try {
      const { data: template, error } = await supabaseAdmin
        .from("templates")
        .update({
          verification_status: status,
          review_notes:
            status === "rejected"
              ? rejection_reason?.trim() || "Template did not meet community guidelines."
              : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("verification_status", "pending")
        .select()
        .single();

      if (error || !template) {
        res.status(404).json({
          error: "not_found",
          message: "Template not found or already reviewed",
        });
        return;
      }

      logger.info(
        { adminId: req.user!.id, templateId: id, status },
        "admin template review",
      );

      res.json({ template, status });

      auditLog({
        user_id: req.user!.id,
        event_type: "admin.template_review",
        target_type: "template",
        target_id: id,
        metadata: { status, rejection_reason },
        ip_address: req.ip ?? null,
        user_agent: req.get("User-Agent") ?? null,
      }).catch(() => {
        // ignore
      });
    } catch (err: any) {
      logger.error({ err, templateId: id }, "admin template review failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to review template",
      });
    }
  },
);

export default router;
