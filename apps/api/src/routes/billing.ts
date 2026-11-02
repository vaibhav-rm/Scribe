import { Router, Response } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  CheckoutSchema,
  BillingCancelSchema,
  VerifyPaymentSchema,
} from "@projectscribe/shared";
import {
  createBillingProvider,
  grantPaidPlan,
} from "../services/billing.js";
import { PLAN_LIMITS, type PlanCode } from "../services/limits.js";
import { auditLog } from "../services/audit.js";
import { logger } from "../lib/logger.js";

const router = Router();
const billing = createBillingProvider();

/**
 * GET /api/v1/billing/plans
 * List available subscription plans.
 */
router.get("/billing/plans", (_req: AuthRequest, res: Response) => {
  res.json({
    plans: [
      {
        code: "free",
        name: "Free",
        price: 0,
        currency: "INR",
        interval: "month",
        limits: {
          maxProjects: 1,
          maxTemplates: 1,
          maxGenerationsPerMonth: 3,
          maxSectionRegenerations: 1,
          pdfExport: false,
          priority: "low",
        },
      },
      {
        code: "pro",
        name: "Student Pro",
        price: 149,
        currency: "INR",
        interval: "month",
        limits: {
          maxProjects: 10,
          maxTemplates: 5,
          maxGenerationsPerMonth: 50,
          maxSectionRegenerations: 20,
          pdfExport: true,
          priority: "standard",
        },
      },
    ],
  });
});

/**
 * GET /api/v1/billing/usage
 * Get the authenticated user's current usage and plan.
 */
router.get("/billing/usage", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_code, status, current_period_start, current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isActive =
    subscription &&
    (!subscription.current_period_end ||
      new Date(subscription.current_period_end) > new Date());

  const planCode: PlanCode =
    subscription &&
    isActive &&
    (subscription.plan_code === "pro" || subscription.plan_code === "free")
      ? subscription.plan_code
      : "free";

  // Count usage. `head: true` requests report the total in `count`, not in
  // `data` (which is always null), so use the count field.
  const { count: projectCount, error: pErr } = await supabaseAdmin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .is("deleted_at", null);

  const { count: generationCount, error: gErr } = await supabaseAdmin
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .gte(
      "created_at",
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    );

  if (pErr || gErr) {
    logger.warn(
      { pErr, gErr, userId },
      "billing usage count failed; reporting zero usage",
    );
  }

  const limits = PLAN_LIMITS[planCode];

  res.json({
    plan: planCode,
    planActive: isActive,
    usage: {
      projects: projectCount ?? 0,
      generationsThisMonth: generationCount ?? 0,
    },
    limits: {
      maxProjects: limits.maxProjects,
      maxTemplates: limits.maxTemplates,
      maxGenerationsPerMonth: limits.maxGenerationsPerMonth,
      maxSectionRegenerations: limits.maxSectionRegenerations,
      pdfExport: limits.pdfExport,
    },
    currentPeriodEnd: subscription?.current_period_end ?? null,
    billingProvider: billing.isMock ? "mock" : billing.id,
  });
});

/**
 * POST /api/v1/billing/checkout
 * Create a payment order for plan upgrade.
 */
router.post(
  "/billing/checkout",
  authenticate,
  validate(CheckoutSchema),
  async (req: AuthRequest & { validated?: { body: any } }, res: Response) => {
    const userId = req.user!.id;
    const body = req.validated!.body as {
      plan_code: PlanCode;
      success_url?: string;
      cancel_url?: string;
    };
    const planCode = body.plan_code;
    const successUrl = body.success_url;
    const cancelUrl = body.cancel_url;

    if (planCode !== "pro") {
      res.status(400).json({
        error: "validation_failed",
        message: "Only the Student Pro plan can be purchased",
      });
      return;
    }

    try {
      const order = await billing.createOrder({
        userId,
        planCode,
        successUrl,
        cancelUrl,
      });

      // Record the payment intent (idempotent)
      const idempotencyKey = `order_${order.orderId}`;
      const { error } = await supabaseAdmin
        .from("payments")
        .insert({
          user_id: userId,
          provider: billing.id,
          provider_order_id: order.orderId,
          provider_payment_id: null,
          amount_minor_units: order.amount,
          currency: order.currency,
          status: "created",
          idempotency_key: idempotencyKey,
        });

      if (error) {
        logger.error({ error, userId }, "payment intent record failed");
        res.status(500).json({
          error: "checkout_failed",
          message: "Could not record the payment order. Please try again.",
        });
        return;
      }

      res.json({
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        key: order.key,
        isMock: billing.isMock,
      });

      auditLog({
        user_id: userId,
        event_type: "billing.checkout",
        target_type: "payment",
        target_id: order.orderId,
        metadata: { planCode, amount: order.amount, currency: order.currency, isMock: billing.isMock },
        ip_address: req.ip ?? null,
        user_agent: req.get("User-Agent") ?? null,
      }).catch(() => {
        // ignore
      });
    } catch (err: any) {
      logger.error({ err, userId }, "checkout failed");
      res.status(500).json({
        error: "checkout_failed",
        message: err.message || "Failed to create payment order",
      });
    }
  },
);

/**
 * POST /api/v1/billing/verify
 * Verify a Razorpay checkout signature from the browser callback and grant
 * the paid plan immediately. The webhook uses the same idempotent grant path,
 * so whichever arrives first wins and the second is a no-op.
 */
router.post(
  "/billing/verify",
  authenticate,
  validate(VerifyPaymentSchema),
  async (req: AuthRequest & { validated?: { body: any } }, res: Response) => {
    const userId = req.user!.id;
    const { order_id, payment_id, signature } = req.validated!.body;

    try {
      const { data: intent, error: intentErr } = await supabaseAdmin
        .from("payments")
        .select("user_id, amount_minor_units, currency, provider_order_id")
        .eq("provider_order_id", order_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (intentErr || !intent) {
        res.status(404).json({
          error: "not_found",
          message: "Payment order not found for this account",
        });
        return;
      }

      const result = await billing.verifyPayment({
        userId,
        orderId: order_id,
        paymentId: payment_id,
        signature,
        amount: (intent as any).amount_minor_units,
        currency: (intent as any).currency,
      });

      if (!result.valid) {
        res.status(400).json({
          error: "invalid_signature",
          message: "Payment signature verification failed",
        });
        return;
      }

      const grant = await grantPaidPlan({
        userId,
        provider: billing.id,
        orderId: order_id,
        paymentId: payment_id,
        amount: (intent as any).amount_minor_units,
        currency: (intent as any).currency,
        planCode: "pro",
      });

      res.json({ success: true, ...grant });

      auditLog({
        user_id: userId,
        event_type: "billing.verify",
        target_type: "payment",
        target_id: order_id,
        metadata: { paymentId: payment_id, ...grant },
        ip_address: req.ip ?? null,
        user_agent: req.get("User-Agent") ?? null,
      }).catch(() => {
        // ignore
      });
    } catch (err: any) {
      logger.error({ err, userId }, "payment verification failed");
      res.status(500).json({
        error: "verification_failed",
        message: err.message || "Failed to verify payment",
      });
    }
  },
);

/**
 * POST /api/v1/billing/cancel
 * Cancel the user's subscription.
 */
router.post(
  "/billing/cancel",
  authenticate,
  validate(BillingCancelSchema),
  async (req: AuthRequest & { validated?: { body: any } }, res: Response) => {
    const userId = req.user!.id;
    const { reason } = req.validated!.body;

    try {
      const result = await billing.cancelSubscription(userId);

      if (result.success) {
        // Mark subscription as cancelled in our DB
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("user_id", userId)
          .eq("status", "active");

        logger.info({ userId, reason }, "subscription cancelled");
        res.json({ success: true });

        auditLog({
          user_id: userId,
          event_type: "billing.cancel",
          target_type: "subscription",
          target_id: userId,
          metadata: { reason },
          ip_address: req.ip ?? null,
          user_agent: req.get("User-Agent") ?? null,
        }).catch(() => {
          // ignore
        });
      } else {
        res.status(400).json({
          error: "cancel_failed",
          message: "Failed to cancel subscription",
        });
      }
    } catch (err: any) {
      logger.error({ err, userId }, "cancel subscription failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to cancel subscription",
      });
    }
  },
);

/**
 * POST /api/v1/billing/webhooks/razorpay
 * Razorpay webhook endpoint. Must receive the raw body for signature verification.
 */
router.post(
  "/billing/webhooks/razorpay",
  async (req: any, res: Response) => {
    const signature = req.headers["x-razorpay-signature"] as string | undefined;

    if (!signature) {
      res.status(400).json({ error: "missing_signature" });
      return;
    }

    // express.raw() runs before express.json() for this path, so req.body is a Buffer.
    // Fall back to JSON-stringified body for other cases.
    const rawBody =
      req.body instanceof Buffer
        ? req.body.toString()
        : typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body ?? {});

    if (billing.isMock) {
      res.status(503).json({
        error: "billing_not_configured",
        message: "Razorpay webhooks are not configured",
      });
      return;
    }

    try {
      const result = await billing.handleWebhook({ body: rawBody, signature });
      if (!result.processed || !result.payment) {
        res.json({ processed: false, event: result.event });
        return;
      }

      // Only payment/order success events grant an entitlement.
      if (!["payment.captured", "order.paid"].includes(result.event)) {
        res.json({ processed: false, event: result.event, ignored: true });
        return;
      }

      const payment = result.payment;
      if (
        typeof payment.amount !== "number" ||
        typeof payment.currency !== "string"
      ) {
        res.json({ processed: false, event: result.event, reason: "missing_amount" });
        return;
      }
      // An order.paid payload without an embedded payment entity is not enough
      // to identify the captured payment. payment.captured (or the browser
      // verification callback) will carry the real payment id; using the order
      // id here would make the later real id look like a different payment.
      if (!payment.paymentId) {
        res.json({ processed: false, event: result.event, reason: "missing_payment_id" });
        return;
      }

      const grant = await grantPaidPlan({
        userId: payment.userId,
        provider: billing.id,
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        amount: payment.amount,
        currency: payment.currency,
        planCode: payment.planCode ?? "pro",
      });

      res.json({ processed: true, event: result.event, ...grant });
    } catch (err: any) {
      logger.error({ err }, "webhook handling failed");
      // Return 500 so Razorpay retries transient database failures.
      res.status(500).json({ error: "webhook_failed" });
    }
  },
);

export default router;
