"use client";

declare global {
  interface Window {
    Razorpay: any;
  }
}

import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import {
  AlertCircle,
  Check,
  Clock,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BillingPage() {
  const { user } = useAuth();
  const { fetchJson } = useApi();
  const queryClient = useQueryClient();
  const [plans, setPlans] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [plansRes, usageRes] = await Promise.all([
        fetchJson("/api/v1/billing/plans"),
        fetchJson("/api/v1/billing/usage"),
      ]);
      if (!plansRes.ok || !usageRes.ok) {
        throw new Error("Failed to load billing data");
      }
      setPlans((await plansRes.json()).plans ?? []);
      setUsage(await usageRes.json());
    } catch (error: any) {
      setLoadError(error?.message || "Failed to load billing data");
      toast.error("Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Dynamically load Razorpay checkout script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    // The checkout global is the source of truth; no extra state is needed.
    script.onerror = () =>
      toast.error("Could not load the Razorpay checkout script.");
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const handleUpgrade = async (planCode: string) => {
    setCreatingOrder(true);
    try {
      const res = await fetchJson("/api/v1/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan_code: planCode as "free" | "pro" }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create payment order");
      }

      const data = await res.json();

      if (data.isMock) {
        toast.info(
          "Test mode: Razorpay credentials not configured. No real payment will be processed. Contact support to upgrade.",
        );
        return;
      }

      // Open Razorpay checkout
      if (window.Razorpay) {
        const options: any = {
          key: data.key,
          amount: data.amount,
          currency: data.currency,
          name: "Scribe",
          description: `Student Pro 30-day access pass - ₹${data.amount / 100}`,
          order_id: data.orderId,
          handler: async (response: any) => {
            // Verify the Razorpay signature server-side. The webhook uses the
            // same idempotent grant path, so either confirmation activates Pro
            // exactly once.
            try {
              const verifyRes = await fetchJson("/api/v1/billing/verify", {
                method: "POST",
                body: JSON.stringify({
                  order_id: response.razorpay_order_id,
                  payment_id: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                }),
              });
              if (!verifyRes.ok) {
                const err = await verifyRes.json().catch(() => ({}));
                throw new Error(err.message || "Payment verification failed");
              }
              toast.success("Payment verified. Student Pro is active.");
              await loadData();
              queryClient.invalidateQueries({ queryKey: ["usage"] });
              queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            } catch (error: any) {
              toast.error(
                error?.message ||
                  "Payment received, but verification is still pending. Refresh in a moment.",
              );
              await loadData();
            }
          },
          prefill: {
            name: user?.display_name || "",
            email: user?.email || "",
          },
          theme: { color: "#4f46e5" },
          modal: { ondismiss: () => toast.info("Payment cancelled") },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        toast.error("Razorpay checkout is not available. Please try again later.");
      }
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleCancel = async (reason: string) => {
    setCreatingOrder(true);
    try {
      const res = await fetchJson("/api/v1/billing/cancel", {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to cancel subscription");
      }
      toast.success("Pro access ended");
      setCancelOpen(false);
      await loadData();
      queryClient.invalidateQueries({ queryKey: ["usage"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel subscription");
    } finally {
      setCreatingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">Could not load billing</p>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button variant="outline" onClick={() => loadData()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const plan = usage?.plan ?? "free";
  const planActive = plan === "free" ? true : (usage?.planActive ?? false);
  const isMock = usage?.billingProvider === "mock";
  const proPlan = plans.find((p) => p.code === "pro");
  const freePlan = plans.find((p) => p.code === "free");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Billing &amp; usage</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your 30-day Pro access pass and view usage.
          </p>
        </div>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current access</CardTitle>
          <CardDescription>
            Your entitlement and usage this month.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-6">
          <div className="bg-muted rounded-xl p-6">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Plan
            </div>
            <div className="text-2xl font-bold">
              {plan === "pro" ? "Student Pro" : "Free"}{" "}
              <Badge
                variant={planActive ? "default" : "outline"}
                className="ml-2"
              >
                {planActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            {plan === "pro" && usage?.currentPeriodEnd && (
              <p className="mt-2 text-sm text-muted-foreground">
                Access until{" "}
                {new Date(usage.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="bg-muted rounded-xl p-6">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Projects
            </div>
            <div className="text-2xl font-bold">
              {usage?.usage?.projects ?? 0} /{" "}
              {usage?.limits?.maxProjects ?? (plan === "pro" ? 10 : 1)}
            </div>
          </div>
          <div className="bg-muted rounded-xl p-6">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Generations (this month)
            </div>
            <div className="text-2xl font-bold">
              {usage?.usage?.generationsThisMonth ?? 0} /{" "}
              {usage?.limits?.maxGenerationsPerMonth ??
                (plan === "pro" ? 50 : 3)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Plan selection */}
      <div className="grid md:grid-cols-2 gap-6">
        {freePlan && (
          <Card
            className={`${
              plan === "free" ? "ring-1 ring-muted" : ""
            } hover:border-muted`}
          >
            <CardHeader>
              <CardTitle>Free</CardTitle>
              <CardDescription className="text-2xl font-bold">
                ₹0<span className="text-sm font-normal text-muted-foreground ml-1">
                  / month
                </span></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "1 project workspace",
                "3 draft generations per month",
                "1 custom template",
                "1 section regeneration per month",
                "DOCX export",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground shrink-0" />
                  {f}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {proPlan && (
          <Card className="ring-1 ring-primary bg-primary/5 border-primary">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Student Pro</CardTitle>
                <Badge variant="secondary">Most popular</Badge>
              </div>
              <CardDescription className="text-2xl font-bold text-primary">
                ₹149
                <span className="ml-1 text-sm font-normal text-primary/70">
                  / 30 days
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "Multiple project workspaces",
                "50 generations per month",
                "5 custom templates",
                "20 section regenerations per month",
                "DOCX and PDF export",
                "Standard processing priority",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  {f}
                </div>
              ))}
            </CardContent>
            <CardFooter className="flex flex-col pt-0 pb-6">
              <Button
                className="w-full"
                disabled={creatingOrder}
                onClick={() => handleUpgrade("pro")}
              >
                {creatingOrder ? (
                  "Creating order…"
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    {plan === "pro" && planActive
                      ? "Extend 30 days — ₹149"
                      : "Get Student Pro — ₹149 / 30 days"}
                  </>
                )}
              </Button>
              {plan === "pro" && planActive && (
                <Button
                  variant="outline"
                  className="mt-3 w-full text-destructive hover:text-destructive"
                  disabled={creatingOrder}
                  onClick={() => setCancelOpen(true)}
                >
                  End Pro access
                </Button>
              )}
              <p className="mt-3 text-center text-xs text-muted-foreground">
                One-time payment. {plan === "pro" && planActive
                  ? "Buying again adds another 30 days to your active pass."
                  : "There is no automatic renewal or stored card."}
              </p>
              {isMock && (
                <p className="mt-2 flex items-center justify-center text-xs text-muted-foreground">
                  <Clock className="mr-1 h-3 w-3" />
                  Test mode active — no real payment processed
                </p>
              )}
            </CardFooter>
          </Card>
        )}
      </div>

      <Separator className="my-8" />

      {/* Razorpay info */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Pro access?</DialogTitle>
            <DialogDescription>
              This immediately ends your current 30-day pass. Remaining days are
              not refunded, and PDF export, extra projects, and higher generation
              limits will be unavailable until you buy another pass.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep Pro access
            </Button>
            <Button
              variant="destructive"
              disabled={creatingOrder}
              onClick={() => handleCancel("user_requested")}
            >
              {creatingOrder ? "Ending…" : "End Pro access"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isMock && (
        <Card>
          <CardHeader>
            <CardTitle>Test Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Razorpay credentials are not configured, so the backend is running
              in mock billing mode. No real payments can be processed and no
              paid entitlements will be granted. To enable live payments, set
              <code className="font-mono text-xs">RAZORPAY_KEY_ID</code> and{" "}
              <code className="font-mono text-xs">RAZORPAY_KEY_SECRET</code> on
              the server and restart it.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
