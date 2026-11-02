import crypto from "node:crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import { PLAN_LIMITS, type PlanCode } from "./limits.js";

/**
 * Billing provider abstraction.
 *
 * Razorpay is used for Indian customers (INR). When Razorpay credentials are
 * absent, a safe mock mode is used that CANNOT grant real production
 * entitlements.
 */
export interface BillingProvider {
  readonly id: string;
  readonly name: string;
  readonly isMock: boolean;

  /**
   * Create a subscription order for a user upgrading to a plan.
   * Returns an order object that the frontend can use to complete payment.
   */
  createOrder(input: {
    userId: string;
    planCode: PlanCode;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<{
    orderId: string;
    amount: number; // in minor currency units (paise for INR)
    currency: string;
    key?: string; // publishable key, only for non-mock
  }>;

  /**
   * Verify a payment signature from the frontend.
   * Returns the payment result if valid.
   */
  verifyPayment(input: {
    userId: string;
    orderId: string;
    paymentId: string;
    signature: string;
    amount: number;
    currency: string;
  }): Promise<{
    valid: boolean;
    planCode: PlanCode;
  }>;

  /**
   * Handle a webhook from the provider.
   * Must be idempotent — repeated deliveries must not grant duplicate
   * credits or subscriptions.
   */
  handleWebhook(input: {
    body: string; // raw request body
    signature: string;
  }): Promise<WebhookResult>;

  /**
   * Cancel a user's subscription.
   */
  cancelSubscription(userId: string): Promise<{ success: boolean }>;
}

export interface WebhookPayment {
  userId?: string;
  orderId: string;
  paymentId?: string;
  amount?: number;
  currency?: string;
  planCode?: PlanCode;
}

export interface WebhookResult {
  event: string;
  processed: boolean;
  payment?: WebhookPayment;
}

/**
 * Constant-time comparison that tolerates malformed/short signatures instead
 * of throwing a RangeError from crypto.timingSafeEqual.
 */
function safeEqualHex(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Grant a paid plan after a verified payment. This is the only place where a
 * subscription becomes active from billing. It is idempotent: replaying the
 * same payment (webhook + browser callback) does not extend the period twice.
 */
export async function grantPaidPlan(input: {
  userId?: string;
  provider: string;
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
  planCode?: PlanCode;
}): Promise<{ granted: boolean; alreadyProcessed: boolean }> {
  const planCode = input.planCode ?? "pro";
  const plan = PLAN_LIMITS[planCode];
  if (planCode !== "pro") {
    throw new Error("Only the Student Pro plan can be purchased");
  }
  if (input.currency !== "INR" || input.amount !== plan.price * 100) {
    throw new Error("Payment amount does not match the selected plan");
  }

  // Resolve the user from the payment intent created at checkout when the
  // webhook does not carry notes (Razorpay does not always copy them).
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("payments")
    .select("user_id")
    .eq("provider_order_id", input.orderId)
    .maybeSingle();

  if (existingErr) throw existingErr;

  const userId = input.userId ?? (existing as any)?.user_id;
  if (!userId) throw new Error("No matching payment order found");
  if (existing && (existing as any).user_id !== userId) {
    throw new Error("Payment order belongs to a different user");
  }

  // The database function locks the order row, extends the subscription, and
  // marks the payment granted in one transaction. Concurrent callbacks and
  // webhook retries are therefore both safe.
  const { data, error } = await supabaseAdmin.rpc("grant_pro_pass", {
    p_user_id: userId,
    p_provider: input.provider,
    p_order_id: input.orderId,
    p_payment_id: input.paymentId,
    p_amount_minor_units: input.amount,
    p_currency: input.currency,
  });

  if (error) throw error;

  const result = (data ?? {}) as {
    granted?: boolean;
    alreadyProcessed?: boolean;
  };
  if (!result.granted) {
    throw new Error("Payment could not be granted");
  }

  if (result.alreadyProcessed) {
    return { granted: true, alreadyProcessed: true };
  }

  logger.info(
    { userId, orderId: input.orderId, paymentId: input.paymentId },
    "paid plan granted",
  );

  return { granted: true, alreadyProcessed: false };
}

/**
 * Razorpay provider implementation.
 * Uses the official Razorpay API via HTTP (no official Node SDK needed for
 * the operations we need).
 */
export class RazorpayProvider implements BillingProvider {
  readonly id = "razorpay";
  readonly name = "Razorpay";
  readonly isMock = false;

  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor() {
    const env = getEnvForBilling();
    if (!env.keyId || !env.keySecret) {
      throw new Error("Razorpay credentials not configured");
    }
    this.keyId = env.keyId;
    this.keySecret = env.keySecret;
    this.webhookSecret = env.webhookSecret ?? "";
  }

  async createOrder(input: {
    userId: string;
    planCode: PlanCode;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    key?: string;
  }> {
    const plan = PLAN_LIMITS[input.planCode];
    const amount = plan.price * 100; // INR -> paise

    // Create order via Razorpay API
    const orderData = {
      amount,
      currency: "INR",
      receipt: `order_${input.userId}_${Date.now()}`,
      notes: {
        user_id: input.userId,
        plan_code: input.planCode,
      },
    };

    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString(
      "base64",
    );

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error({ status: res.status, error: errorText }, "Razorpay order creation failed");
      throw new Error("Failed to create payment order");
    }

    const order = (await res.json()) as { id: string };
    return {
      orderId: order.id,
      amount,
      currency: "INR",
      key: this.keyId,
    };
  }

  async verifyPayment(input: {
    userId: string;
    orderId: string;
    paymentId: string;
    signature: string;
    amount: number;
    currency: string;
  }): Promise<{ valid: boolean; planCode: PlanCode }> {
    // Razorpay signature verification:
    // signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
    const expected = crypto
      .createHmac("sha256", this.keySecret)
      .update(`${input.orderId}|${input.paymentId}`)
      .digest("hex");

    const valid = safeEqualHex(expected, input.signature);

    if (!valid) {
      return { valid: false, planCode: "free" };
    }

    // Verify amount matches a known plan
    let planCode: PlanCode = "free";
    for (const [code, limits] of Object.entries(
      PLAN_LIMITS,
    ) as [PlanCode, (typeof PLAN_LIMITS)[PlanCode]][]) {
      if (limits.price * 100 === input.amount) {
        planCode = code;
        break;
      }
    }

    return { valid: true, planCode };
  }

  async handleWebhook(input: {
    body: string;
    signature: string;
  }): Promise<WebhookResult> {
    if (!this.webhookSecret) {
      logger.warn(
        "Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured",
      );
      return { event: "unconfigured", processed: false };
    }

    // Verify webhook signature
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(input.body)
      .digest("hex");

    if (!safeEqualHex(expected, input.signature)) {
      logger.warn("Razorpay webhook signature verification failed");
      return { event: "unknown", processed: false };
    }

    const event = JSON.parse(input.body) as { event?: string; payload?: any };
    const eventName = event.event ?? "unknown";
    logger.info({ event: eventName }, "Razorpay webhook received");

    const paymentEntity =
      event.payload?.payment?.entity ?? event.payload?.order?.entity ?? null;
    const orderEntity = event.payload?.order?.entity ?? null;

    if (!paymentEntity && !orderEntity) {
      return { event: eventName, processed: false };
    }

    const orderId =
      paymentEntity?.order_id ?? orderEntity?.id ?? paymentEntity?.id ?? null;
    const paymentId = paymentEntity?.id ?? null;
    const notes = paymentEntity?.notes ?? orderEntity?.notes ?? {};

    if (!orderId) {
      return { event: eventName, processed: false };
    }

    const amount =
      typeof paymentEntity?.amount === "number"
        ? paymentEntity.amount
        : typeof orderEntity?.amount === "number"
          ? orderEntity.amount
          : undefined;

    return {
      event: eventName,
      processed: true,
      payment: {
        userId: typeof notes.user_id === "string" ? notes.user_id : undefined,
        orderId,
        paymentId: paymentId ?? undefined,
        amount,
        currency:
          paymentEntity?.currency ?? orderEntity?.currency ?? undefined,
        planCode: notes.plan_code === "pro" ? "pro" : undefined,
      },
    };
  }

  async cancelSubscription(userId: string): Promise<{ success: boolean }> {
    // Find the user's subscription and cancel it at Razorpay
    const { data: subscription, error } = await supabaseAdmin
      .from("subscriptions")
      .select("provider_subscription_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error) return { success: false };
    // Nothing active means there is no entitlement left to cancel.
    if (!subscription) return { success: true };

    // Pro access purchased through a one-time Razorpay order has no recurring
    // provider subscription to cancel. Ending local access is sufficient.
    if (!subscription?.provider_subscription_id) {
      return { success: true };
    }

    try {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
      const res = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${subscription.provider_subscription_id}/cancel`,
        {
          method: "POST",
          headers: { Authorization: `Basic ${auth}` },
        },
      );
      if (!res.ok) {
        const body = await res.text();
        logger.error(
          { status: res.status, body, userId },
          "Razorpay subscription cancellation rejected",
        );
        return { success: false };
      }
    } catch (err) {
      logger.error({ err, userId }, "Razorpay subscription cancellation failed");
      return { success: false };
    }

    return { success: true };
  }
}

/**
 * Mock billing provider — used when Razorpay credentials are absent.
 * Cannot grant real production entitlements. All operations return safe
 * defaults that keep the user on the free tier.
 */
export class MockBillingProvider implements BillingProvider {
  readonly id = "mock";
  readonly name = "Mock Billing (Test)";
  readonly isMock = true;

  async createOrder(): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    key?: string;
  }> {
    return {
      orderId: `mock_order_${Date.now()}`,
      amount: 0,
      currency: "INR",
    };
  }

  async verifyPayment(): Promise<{ valid: boolean; planCode: PlanCode }> {
    // Mock never upgrades to paid — always returns free
    return { valid: false, planCode: "free" };
  }

  async handleWebhook(): Promise<WebhookResult> {
    return { event: "mock", processed: false };
  }

  async cancelSubscription(): Promise<{ success: boolean }> {
    return { success: true };
  }
}

interface BillingEnv {
  keyId: string | undefined;
  keySecret: string | undefined;
  webhookSecret: string | undefined;
}

function getEnvForBilling(): BillingEnv {
  return {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  };
}

/**
 * Factory: returns the configured billing provider.
 * Falls back to mock mode when Razorpay credentials are absent.
 */
export function createBillingProvider(): BillingProvider {
  const env = getEnvForBilling();
  if (env.keyId && env.keySecret) {
    return new RazorpayProvider();
  }
  logger.info({ provider: "mock" }, "Billing provider initialized (mock mode — no real entitlements)");
  return new MockBillingProvider();
}
