"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast";
import { AlertTriangle, ShieldCheck, FileCheck, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function AdminPage() {
  const { user } = useAuth();
  const { fetchJson } = useApi();
  const [overview, setOverview] = useState<any>(null);
  const [pendingTemplates, setPendingTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewingTemplate, setReviewingTemplate] = useState<any>(null);
  const [reviewStatus, setReviewStatus] = useState<"verified" | "rejected" | "">("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const loadData = useCallback(async () => {
    const [overviewResult, templatesResult] = await Promise.allSettled([
      fetchJson("/api/v1/admin/overview"),
      fetchJson("/api/v1/admin/templates/pending"),
    ]);

    let failed = false;

    if (overviewResult.status === "fulfilled" && overviewResult.value.ok) {
      setOverview(await overviewResult.value.json());
    } else {
      failed = true;
    }

    if (templatesResult.status === "fulfilled" && templatesResult.value.ok) {
      setPendingTemplates((await templatesResult.value.json()).templates ?? []);
    } else {
      failed = true;
    }

    if (failed) toast.error("Some admin data could not be loaded");
    setLoading(false);
  }, [fetchJson]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingTemplate || !reviewStatus) return;
    if (reviewStatus === "rejected" && rejectionReason.trim().length < 5) {
      toast.error("Please give the owner a short reason (at least 5 characters).");
      return;
    }
    setReviewing(true);
    try {
      const res = await fetchJson(
        `/api/v1/admin/templates/${reviewingTemplate.id}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            status: reviewStatus,
            rejection_reason: reviewStatus === "rejected" ? rejectionReason : undefined,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Review failed");
      }
      toast.success(`Template ${reviewStatus}`);
      setReviewOpen(false);
      setReviewStatus("");
      setRejectionReason("");
      loadData();
    } catch (error: any) {
      toast.error(error?.message || "Review failed");
    } finally {
      setReviewing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 w-full animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-44 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">Failed to load admin data</p>
          <p className="text-sm text-muted-foreground">
            Check that the API is running and you still have admin access.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              loadData();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Admin dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            System overview and template moderation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Admin: {user?.display_name || user?.email}
          </span>
          <Badge variant="destructive">ADMIN</Badge>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-bold">{overview.users.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Admins</span>
              <span className="text-xl font-bold">{overview.users.admins}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pro subscribers</span>
              <span className="text-xl font-bold">{overview.users.pro}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-bold">{overview.projects.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active</span>
              <span className="text-xl font-bold">{overview.projects.active}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generations</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-bold">{overview.generations.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Completed</span>
              <span className="text-xl font-bold">{overview.generations.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Failed</span>
              <span className="text-xl font-bold text-destructive">{overview.generations.failed}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Templates pending review */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Template Moderation</h2>
          <Badge variant={pendingTemplates.length > 0 ? "default" : "secondary"}>
            {pendingTemplates.length} pending
          </Badge>
        </div>

        {pendingTemplates.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                No pending template submissions.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingTemplates.map((template: any) => (
              <Card key={template.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{template.title}</h3>
                      <p className="text-xs capitalize text-muted-foreground">
                        {String(template.document_type ?? "").replaceAll("_", " ")} •{" "}
                        {template.academic_year || "Year not set"} • {template.visibility}
                      </p>
                    </div>
                    <Badge variant="outline">Pending</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {template.description || "No description"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        setReviewingTemplate(template);
                        setReviewStatus("verified");
                        setRejectionReason("");
                        setReviewOpen(true);
                      }}
                    >
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReviewingTemplate(template);
                        setReviewStatus("rejected");
                        setRejectionReason("");
                        setReviewOpen(true);
                      }}
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent generations & system health */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent generations</CardTitle>
          </CardHeader>
          <CardContent>
            {(overview.recentGenerations ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No generations have run yet.
              </p>
            ) : (
              <div className="divide-y divide-input">
                {(overview.recentGenerations as any[]).map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {job.document_type?.replaceAll("_", " ") ?? "Document"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {job.provider ?? "—"} ·{" "}
                        {new Date(job.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        job.status === "completed"
                          ? "success"
                          : job.status === "failed"
                            ? "destructive"
                            : job.status === "processing"
                              ? "warning"
                              : "outline"
                      }
                    >
                      {job.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">System health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">API status</span>
              <Badge variant="success">Online</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                PDF conversion
              </span>
              <Badge
                variant={overview.health?.pdfConversion ? "success" : "outline"}
              >
                {overview.health?.pdfConversion ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">AI provider</span>
              <span className="text-sm font-medium capitalize">
                {overview.health?.aiProvider ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Generation mode</span>
              <span className="text-sm font-medium capitalize">
                {overview.health?.generationMode ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Billing</span>
              <span className="text-sm font-medium capitalize">
                {overview.health?.billingProvider ?? "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <form onSubmit={handleReview}>
            <DialogHeader>
              <DialogTitle>
                {reviewStatus === "verified" ? "Approve Template" : "Reject Template"}
              </DialogTitle>
              <DialogDescription>
                {reviewingTemplate?.title}
              </DialogDescription>
            </DialogHeader>
            {reviewStatus === "rejected" && (
              <div className="mb-4">
                <Textarea
                  label="Reason for rejection"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Tell the owner what needs to change"
                  maxLength={500}
                  rows={4}
                />
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReviewOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={reviewing}>
                {reviewing
                  ? "Reviewing…"
                  : reviewStatus === "verified"
                    ? "Approve template"
                    : "Reject template"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
