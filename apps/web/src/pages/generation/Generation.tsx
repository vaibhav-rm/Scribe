"use client";

import * as React from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  FolderOpen,
  ListChecks,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { DOCUMENT_TYPES } from "@/lib/document-types";

function stageLabel(progress: number, status: string): string {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  if (status === "queued") return "Queued";
  if (progress < 15) return "Reading project resources";
  if (progress < 30) return "Extracting project knowledge";
  if (progress < 45) return "Interpreting template requirements";
  if (progress < 55) return "Planning the document outline";
  if (progress < 82) return "Writing sections";
  if (progress < 95) return "Validating content";
  return "Assembling the DOCX";
}

export function GenerationPage() {
  const { id } = useParams<{ id?: string }>();
  if (id) return <GenerationJobPage jobId={id} />;
  return <GenerationWizard />;
}

function StepBadge({
  number,
  title,
  active,
  complete,
}: {
  number: number;
  title: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
          complete
            ? "border-primary bg-primary text-primary-foreground"
            : active
              ? "border-primary text-primary"
              : "border-input text-muted-foreground",
        )}
      >
        {complete ? <CheckCircle2 className="h-4 w-4" /> : number}
      </span>
      <span
        className={cn(
          "text-sm font-medium",
          active || complete ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {title}
      </span>
    </div>
  );
}

function GenerationWizard() {
  const { token, loading: authLoading } = useAuth();
  const { fetchJson } = useApi();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const [projectId, setProjectId] = React.useState(searchParams.get("project") ?? "");
  const [templateId, setTemplateId] = React.useState(
    searchParams.get("template") ?? "",
  );
  const [documentType, setDocumentType] = React.useState("project_synopsis");
  const [outlineResult, setOutlineResult] = React.useState<any>(null);
  const [limitError, setLimitError] = React.useState("");
  const [placeholderValues, setPlaceholderValues] = React.useState<
    Record<string, string>
  >({});

  const projectsQ = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetchJson("/api/v1/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      return res.json();
    },
    enabled: !authLoading && !!token,
  });

  const templatesQ = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await fetchJson("/api/v1/templates?page_size=100");
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
    enabled: !authLoading && !!token,
  });

  const templateDetailQ = useQuery({
    queryKey: ["template", templateId],
    queryFn: async () => {
      const res = await fetchJson(`/api/v1/templates/${templateId}`);
      if (!res.ok) throw new Error("Failed to load template version");
      return res.json();
    },
    enabled: !!token && !!templateId,
  });

  const templateVersionId =
    templateDetailQ.data?.template?.id === templateId
      ? (templateDetailQ.data?.version?.id as string | undefined)
      : undefined;

  const placeholdersQ = useQuery({
    queryKey: ["template-placeholders", templateVersionId],
    queryFn: async () => {
      const res = await fetchJson(
        `/api/v1/templates/${templateId}/placeholders?version_id=${templateVersionId}`,
      );
      if (!res.ok) throw new Error("Failed to load template placeholders");
      return res.json();
    },
    enabled: !!token && !!templateId && !!templateVersionId,
  });

  const resourcesQ = useQuery({
    queryKey: ["resources", projectId],
    queryFn: async () => {
      const res = await fetchJson(`/api/v1/projects/${projectId}/resources`);
      if (!res.ok) throw new Error("Failed to load project resources");
      return res.json();
    },
    enabled: !!token && !!projectId,
  });

  const outlineMut = useMutation({
    mutationFn: async () => {
      const res = await fetchJson("/api/v1/generations/outline", {
        method: "POST",
        body: JSON.stringify({
          project_id: projectId,
          template_version_id: templateVersionId ?? null,
          document_type: documentType,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const failure = new Error(err.message || "Failed to generate outline");
        (failure as any).status = res.status;
        throw failure;
      }
      return res.json();
    },
    onSuccess: (data) => {
      setOutlineResult(data);
      setLimitError("");
      toast.success("Outline ready for review");
    },
    onError: (error: any) => {
      if (error?.status === 403) setLimitError(error.message);
      toast.error(error.message || "Failed to generate outline");
    },
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const res = await fetchJson("/api/v1/generations", {
        method: "POST",
        body: JSON.stringify({
          project_id: projectId,
          template_version_id: templateVersionId ?? null,
          document_type: documentType,
          outline_id: outlineResult?.outlineId ?? null,
          placeholder_values: Object.fromEntries(
            Object.entries(placeholderValues).filter(([, value]) =>
              value.trim(),
            ),
          ),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const failure = new Error(err.message || "Failed to start generation");
        (failure as any).status = res.status;
        throw failure;
      }
      return res.json();
    },
    onSuccess: (data) => {
      setLimitError("");
      toast.success("Generation started");
      navigate(`/app/generations/${data.job.id}`);
    },
    onError: (error: any) => {
      if (error?.status === 403) setLimitError(error.message);
      toast.error(error.message || "Failed to start generation");
    },
  });

  const projects = (projectsQ.data?.projects ?? []) as any[];
  const templates = (templatesQ.data?.templates ?? []) as any[];
  const selectedTemplate = templateDetailQ.data;
  const resources = (resourcesQ.data?.resources ?? []) as any[];
  const templateReady = !templateId || !!selectedTemplate?.version;
  const canGenerate = !!projectId && templateReady && !!outlineResult;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Drafting studio"
        title="Generate a document"
        description="Pick a project and template, review the outline, then generate."
      />

      {limitError && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100/90 sm:flex-row sm:items-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="flex-1">{limitError}</span>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-amber-400/20 text-amber-100 hover:border-amber-400/35 hover:bg-amber-400/10 hover:text-amber-50"
          >
            <Link to="/app/billing">Upgrade plan</Link>
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-input bg-muted/30 px-4 py-3">
        <StepBadge
          number={1}
          title="Project & template"
          active={!outlineResult}
          complete={!!outlineResult}
        />
        <StepBadge
          number={2}
          title="Review outline"
          active={!!outlineResult}
          complete={!!outlineResult}
        />
        <StepBadge number={3} title="Generate" active={false} complete={false} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Project &amp; template</CardTitle>
          <CardDescription>
            The generator only uses sources you added to the selected project.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Project</label>
            <Select
              value={projectId}
              onValueChange={(value) => {
                setProjectId(value);
                setOutlineResult(null);
              }}
            >
              <SelectTrigger aria-label="Project">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projectsQ.isLoading && <Skeleton className="h-4 w-32" />}
            {!projectsQ.isLoading && projects.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No projects yet.{" "}
                <Link to="/app/projects" className="text-primary hover:underline">
                  Create one
                </Link>{" "}
                and add resources first.
              </p>
            )}
            {projectId && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FolderOpen className="h-3.5 w-3.5" />
                {resourcesQ.isLoading
                  ? "Loading resources…"
                  : `${resources.length} source resource(s)`}
                {!resourcesQ.isLoading && resources.length === 0 && (
                  <>
                    {" · "}
                    <Link
                      to={`/app/projects/${projectId}`}
                      className="text-primary hover:underline"
                    >
                      Add resources
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Template (optional)</label>
            <Select
              value={templateId || "none"}
              onValueChange={(value) => {
                setTemplateId(value === "none" ? "" : value);
                setOutlineResult(null);
                setPlaceholderValues({});
              }}
            >
              <SelectTrigger aria-label="Template">
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  No template (default sections)
                </SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate?.version && (
              <p className="text-xs text-muted-foreground">
                Using version {selectedTemplate.version.version_number}
                {selectedTemplate.version.parsed_specification?.requiredSections?.length
                  ? ` · ${selectedTemplate.version.parsed_specification.requiredSections.length} detected sections`
                  : ""}
                {placeholdersQ.data?.imagePlaceholders?.length
                  ? ` · ${placeholdersQ.data.imagePlaceholders.length} figure space(s) will be illustrated`
                  : ""}
              </p>
            )}
            {templateId && !templateReady && !templateDetailQ.isLoading && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" /> This template has no usable
                version yet.
              </p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Document type</label>
            <Select
              value={documentType}
              onValueChange={(value) => {
                setDocumentType(value);
                setOutlineResult(null);
              }}
            >
              <SelectTrigger aria-label="Document type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            variant="outline"
            onClick={() => outlineMut.mutate()}
            disabled={!projectId || !templateReady || outlineMut.isPending}
          >
            {outlineMut.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating
                outline…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" /> Generate outline
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {outlineResult && (
        <Card className="paper-surface corner-marks">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" /> 2. Review outline
            </CardTitle>
            <CardDescription>
              {outlineResult.outline?.sections?.length ?? 0} sections ·{" "}
              {outlineResult.resourcesUsed ?? 0} source resource(s) used
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(outlineResult.outline?.sections ?? []).map((section: any) => (
              <div
                key={`${section.id}-${section.order}`}
                className="flex items-center justify-between rounded-sm border border-input bg-transparent px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-xs text-muted-foreground">
                    {section.order}.
                  </span>
                  <span className="text-sm font-medium">{section.heading}</span>
                </div>
                {section.required ? (
                  <Badge variant="outline">Required</Badge>
                ) : (
                  <Badge variant="secondary">Optional</Badge>
                )}
              </div>
            ))}
            {outlineResult.knowledgeWarnings?.length > 0 && (
              <div className="rounded-sm border border-amber-600/25 bg-amber-500/10 p-3 text-xs text-amber-900">
                {outlineResult.knowledgeWarnings.length} missing fact(s) noted in
                sources — visible placeholders will be used instead of invented
                content.
              </div>
            )}
          </CardContent>
          {(placeholdersQ.data?.fields ?? []).length > 0 && (
            <CardContent className="border-t border-input pt-4">
              <div className="mb-3">
                <p className="text-sm font-medium">Optional title-page details</p>
                <p className="text-xs text-muted-foreground">
                  Fill in any values you want in the template. Blank fields keep
                  the visible placeholder or use your project/profile defaults.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(placeholdersQ.data.fields as any[]).map((field) => (
                  <Input
                    key={field.key}
                    id={`placeholder-${field.key}`}
                    label={field.label}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    value={placeholderValues[field.key] ?? ""}
                    onChange={(event) =>
                      setPlaceholderValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                  />
                ))}
              </div>
            </CardContent>
          )}
          <CardFooter className="justify-end">
            <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button
              variant="outline"
              onClick={() => {
                setOutlineResult(null);
                outlineMut.mutate();
              }}
              disabled={outlineMut.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Regenerate outline
            </Button>
            <Button onClick={() => generateMut.mutate()} disabled={!canGenerate || generateMut.isPending}>
              {generateMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" /> Approve &amp; generate document
                </>
              )}
            </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

function GenerationJobPage({ jobId }: { jobId: string }) {
  const { token, loading: authLoading } = useAuth();
  const { fetchJson } = useApi();
  const navigate = useNavigate();

  const jobQ = useQuery({
    queryKey: ["generation", jobId],
    queryFn: async () => {
      const res = await fetchJson(`/api/v1/generations/${jobId}`);
      if (!res.ok) throw new Error("Generation job not found");
      return res.json();
    },
    enabled: !authLoading && !!token,
    refetchInterval: (query) => {
      if (query.state.status === "error") return false;
      const job = query.state.data?.job;
      if (!job) return 2000;
      return ["queued", "processing"].includes(job.status) ? 2000 : false;
    },
  });

  const job = jobQ.data?.job;
  const finished = job && ["completed", "failed", "cancelled"].includes(job.status);

  const documentsQ = useQuery({
    queryKey: ["documents", "job", jobId],
    queryFn: async () => {
      const res = await fetchJson(
        `/api/v1/documents?generation_job_id=${jobId}`,
      );
      if (!res.ok) throw new Error("Failed to load the generated document");
      return res.json();
    },
    enabled: !!token && job?.status === "completed",
  });

  const document = (documentsQ.data?.documents ?? [])[0];

  const cancelMut = useMutation({
    mutationFn: async () => {
      const res = await fetchJson(`/api/v1/generations/${jobId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to cancel generation");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Generation cancelled");
      jobQ.refetch();
    },
    onError: (error: any) => toast.error(error.message || "Failed to cancel generation"),
  });

  if (jobQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (jobQ.error || !job) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">
            {(jobQ.error as Error)?.message ?? "Generation job not found"}
          </p>
          <Button onClick={() => navigate("/app/generate")}>
            Start a new generation
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate("/app/generate")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> New generation
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                {job.status === "completed"
                  ? "Document ready"
                  : job.status === "failed"
                    ? "Generation failed"
                    : job.status === "cancelled"
                      ? "Generation cancelled"
                      : "Generating document"}
              </CardTitle>
              <CardDescription>
                {job.provider} / {job.model}
              </CardDescription>
            </div>
            <JobStatusBadge status={job.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>{stageLabel(job.progress ?? 0, job.status)}</span>
              <span className="tabular-nums text-muted-foreground">
                {job.progress ?? 0}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={
                  job.status === "failed"
                    ? "h-full bg-destructive transition-all"
                    : "h-full bg-primary transition-all"
                }
                style={{ width: `${job.progress ?? 0}%` }}
              />
            </div>
          </div>

          {job.error_message && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {job.error_message}
            </div>
          )}

          {job.status === "completed" && (
            <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4 text-sm text-primary">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" /> Generation complete
              </div>
              <p className="mt-1 text-xs">
                Your document is ready. Open it to edit sections and export.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          {!finished && (
            <Button
              variant="outline"
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending}
            >
              <XCircle className="mr-2 h-4 w-4" />
              {cancelMut.isPending ? "Cancelling…" : "Cancel"}
            </Button>
          )}
          {job.status === "completed" && (
            <Button
              onClick={() =>
                document
                  ? navigate(`/app/documents/${document.id}`)
                  : documentsQ.refetch()
              }
              disabled={documentsQ.isLoading}
            >
              <FileText className="mr-2 h-4 w-4" />
              {document
                ? "Open document"
                : documentsQ.isLoading
                  ? "Loading document…"
                  : "Refresh documents"}
            </Button>
          )}
          {finished && job.status !== "completed" && (
            <Button onClick={() => navigate("/app/generate")}>Try again</Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  if (status === "completed") return <Badge variant="success">Completed</Badge>;
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
  if (status === "cancelled") return <Badge variant="secondary">Cancelled</Badge>;
  if (status === "processing")
    return (
      <Badge variant="warning" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Processing
      </Badge>
    );
  return <Badge variant="outline">Queued</Badge>;
}
