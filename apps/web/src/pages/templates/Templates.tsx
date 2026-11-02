"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  File,
  Plus,
  Upload,
  ShieldCheck,
  Clock,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Save,
  Trash2,
  Users,
} from "lucide-react";

const DOCUMENT_TYPES = [
  { value: "project_synopsis", label: "Project Synopsis" },
  { value: "project_report", label: "Project Report" },
  { value: "project_proposal", label: "Project Proposal" },
  { value: "srs", label: "Software Requirements Specification" },
  { value: "internship_report", label: "Internship Report" },
  { value: "research_paper", label: "Research Paper" },
  { value: "case_study", label: "Case Study" },
  { value: "seminar_report", label: "Seminar Report" },
];

function documentTypeLabel(value: string): string {
  return DOCUMENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function TemplatesPage() {
  const { token, user } = useAuth();
  const { fetchJson } = useApi();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [documentType, setDocumentType] = React.useState("project_synopsis");
  const [academicYear, setAcademicYear] = React.useState("");
  const [visibility, setVisibility] = React.useState<"private" | "unlisted" | "public">(
    "private",
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await fetchJson("/api/v1/templates?page_size=100");
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
    enabled: !!token,
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("title", title);
      form.append("description", description);
      form.append("document_type", documentType);
      form.append("visibility", visibility);
      if (academicYear) form.append("academic_year", academicYear);
      if (file) form.append("file", file);

      const res = await fetchJson("/api/v1/templates", {
        method: "POST",
        headers: {}, // let the browser set multipart boundary
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to upload template");
      }
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (result?.template?.verification_status === "pending") {
        toast.success(
          "Template uploaded. Public templates appear in the library after review.",
        );
      } else if (result?.version?.parsing_status === "failed") {
        toast.warning(
          "Template uploaded, but automatic parsing failed. Review the specification manually.",
        );
      } else {
        toast.success("Template uploaded");
      }
      setOpen(false);
      setFile(null);
      setTitle("");
      setDescription("");
      setDocumentType("project_synopsis");
      setAcademicYear("");
      setVisibility("private");
    },
    onError: (e: any) => toast.error(e.message || "Failed to upload template"),
  });

  const allTemplates = (data?.templates ?? []) as any[];
  const templates = allTemplates.filter(
    (template) => template.owner_id && template.owner_id === user?.id,
  );
  const sharedTemplates = allTemplates.filter(
    (template) => !template.owner_id || template.owner_id !== user?.id,
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="h-64 flex items-center justify-center">
          <Skeleton className="h-8 w-40" />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">Could not load templates</p>
          <p className="text-sm text-muted-foreground">
            {(error as Error).message}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Templates</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload and manage your document templates. One template can be reused
            across projects.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Upload template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload template</DialogTitle>
              <DialogDescription>
                Upload your college&rsquo;s DOCX or PDF template. DOCX templates are
                parsed automatically and you can review the detected requirements
                before using them.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4 pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                uploadMut.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="template-title">Title</Label>
                <Input
                  id="template-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. VIT Project Synopsis Format"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-description">Description</Label>
                <Textarea
                  id="template-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional short description"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-document-type">Document type</Label>
                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger id="template-document-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-visibility">Visibility</Label>
                  <Select
                    value={visibility}
                    onValueChange={(v) => setVisibility(v as typeof visibility)}
                  >
                    <SelectTrigger id="template-visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="unlisted">Unlisted (link only)</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-year">Academic year</Label>
                <Input
                  id="template-year"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="e.g. 2025-26"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-file">Template file (DOCX or PDF)</Label>
                <Input
                  id="template-file"
                  type="file"
                  accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={uploadMut.isPending || !title || !file}
                >
                  {uploadMut.isPending ? "Uploading…" : "Upload template"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <File className="mx-auto h-8 w-8 mb-3 text-muted-foreground opacity-60" />
            <p className="text-sm font-medium">No templates of your own yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Upload your college&rsquo;s DOCX format. You can reuse it across every
              project and keep multiple versions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} shared={false} />
          ))}
        </div>
      )}

      {sharedTemplates.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold">Shared with the community</h2>
            <p className="text-sm text-muted-foreground">
              Public templates from other students. You can use these, but only
              the owner can edit them.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {sharedTemplates.map((t) => (
              <TemplateCard key={t.id} template={t} shared />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  shared,
}: {
  template: any;
  shared: boolean;
}) {
  return (
    <Card className="flex flex-col transition-shadow hover:shadow-lift">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">
            <Link
              to={`/app/templates/${template.id}`}
              className="hover:underline"
            >
              {template.title}
            </Link>
          </CardTitle>
          <TemplateStatusBadge status={template.verification_status} />
        </div>
        <CardDescription className="text-xs">
          {documentTypeLabel(template.document_type)}
          {template.academic_year ? ` • ${template.academic_year}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {template.description || "No description"}
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span className="capitalize">{template.visibility}</span>
          {shared && (
            <Badge variant="outline" className="ml-auto">
              Shared
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to={`/app/templates/${template.id}`}>
            {shared ? "View template" : "Review template"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function TemplateStatusBadge({ status }: { status: string }) {
  if (status === "verified") {
    return (
      <Badge variant="default" className="gap-1">
        <ShieldCheck className="h-3 w-3" /> Verified
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" /> Pending
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> Rejected
      </Badge>
    );
  }
  return <Badge variant="outline">Unverified</Badge>;
}

const EXAMPLE_SPECIFICATION = {
  required_sections: [
    "Abstract",
    "Introduction",
    "Literature Review",
    "Methodology",
    "Results",
    "Conclusion",
    "References",
  ],
  required_metadata: [
    "title",
    "student_name",
    "roll_number",
    "guide_name",
    "department",
    "college",
    "academic_year",
  ],
  page_size: "A4",
  margins: { top: 1, bottom: 1, left: 1.25, right: 1 },
  fonts: { body: "Times New Roman", heading: "Arial" },
  line_spacing: 1.5,
  paragraph_spacing: 6,
  page_numbering: true,
  required_tables: ["Comparison of existing systems"],
  output_formats: ["docx", "pdf"],
};

export function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const { fetchJson } = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [specText, setSpecText] = React.useState("");
  const [specLoaded, setSpecLoaded] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editAcademicYear, setEditAcademicYear] = React.useState("");
  const [editVisibility, setEditVisibility] = React.useState<
    "private" | "unlisted" | "public"
  >("private");
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["template", id],
    queryFn: async () => {
      const res = await fetchJson(`/api/v1/templates/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Template not found or not accessible");
      }
      return res.json();
    },
    enabled: !!token && !!id,
  });

  const saveSpecMut = useMutation({
    mutationFn: async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(specText);
      } catch {
        throw new Error("Specification must be valid JSON");
      }
      const res = await fetchJson(`/api/v1/templates/${id}/specification`, {
        method: "PATCH",
        body: JSON.stringify({ specification: parsed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to save specification");
      }
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["template", id] });
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      if (result?.verification_status === "pending") {
        toast.success(
          "Specification saved. This public template is back in review.",
        );
      } else {
        toast.success("Specification saved");
      }
    },
    onError: (e: any) => toast.error(e.message || "Failed to save specification"),
  });

  const parseMut = useMutation({
    mutationFn: async () => {
      const res = await fetchJson(`/api/v1/templates/${id}/parse`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to re-parse template");
      }
      return res.json();
    },
    onSuccess: (result: any) => {
      setSpecText(JSON.stringify(result.specification, null, 2));
      queryClient.invalidateQueries({ queryKey: ["template", id] });
      if (result.warnings?.length) {
        toast.warning(`Re-parsed with ${result.warnings.length} warning(s)`);
      } else {
        toast.success("Template re-parsed");
      }
    },
    onError: (e: any) => toast.error(e.message || "Failed to re-parse template"),
  });

  const newVersionMut = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetchJson(`/api/v1/templates/${id}/versions`, {
        method: "POST",
        headers: {},
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to upload new version");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template", id] });
      setSpecLoaded(false);
      toast.success("New template version uploaded");
    },
    onError: (e: any) => toast.error(e.message || "Failed to upload new version"),
  });

  const updateTemplateMut = useMutation({
    mutationFn: async () => {
      const res = await fetchJson(`/api/v1/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          academic_year: editAcademicYear.trim() || null,
          visibility: editVisibility,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update template");
      }
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["template", id] });
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setEditOpen(false);
      if (result?.template?.verification_status === "pending") {
        toast.success(
          "Template details updated. This template is back in review.",
        );
      } else {
        toast.success("Template details updated");
      }
    },
    onError: (e: any) =>
      toast.error(e.message || "Failed to update template"),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const res = await fetchJson(`/api/v1/templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete template");
      }
    },
    onSuccess: async () => {
      toast.success("Template deleted");
      setDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("/app/templates");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete template"),
  });

  // Reset editor state when navigating between templates.
  React.useEffect(() => {
    setSpecLoaded(false);
    setSpecText("");
  }, [id]);

  // Load the current specification into the editor once per fetch.
  React.useEffect(() => {
    if (!data?.version || specLoaded) return;
    setSpecText(
      data.version.parsed_specification
        ? JSON.stringify(data.version.parsed_specification, null, 2)
        : "",
    );
    setSpecLoaded(true);
  }, [data, specLoaded]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="h-64 flex items-center justify-center">
          <Skeleton className="h-8 w-40" />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <p className="text-sm text-destructive">{(error as Error).message}</p>
        <Button className="mt-4" onClick={() => navigate("/app/templates")}>
          Back to templates
        </Button>
      </div>
    );
  }

  const template = data.template;
  const version = data.version;
  const warnings: string[] = version?.validation_warnings ?? [];
  const isOwner = !!user?.id && template.owner_id === user.id;
  const canReparse = isOwner && Boolean(version?.storage_path?.toLowerCase().endsWith(".docx"));

  const openEdit = () => {
    setEditTitle(template.title);
    setEditDescription(template.description ?? "");
    setEditAcademicYear(template.academic_year ?? "");
    setEditVisibility(template.visibility);
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate("/app/templates")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {version && (
            <Button asChild size="sm">
              <Link to={`/app/generate?template=${template.id}`}>
                Use template <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
          {isOwner && (
            <>
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Save className="h-4 w-4 mr-2" /> Edit details
              </Button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".docx,.pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) newVersionMut.mutate(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={newVersionMut.isPending}
              >
                <Upload className="h-4 w-4 mr-2" />
                {newVersionMut.isPending ? "Uploading…" : "Upload new version"}
              </Button>
              {canReparse && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => parseMut.mutate()}
                  disabled={parseMut.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {parseMut.isPending ? "Parsing…" : "Re-parse"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{template.title}</CardTitle>
              <CardDescription>
                {documentTypeLabel(template.document_type)}
                {template.academic_year ? ` • ${template.academic_year}` : ""} •{" "}
                {template.visibility}
              </CardDescription>
            </div>
            <TemplateStatusBadge status={template.verification_status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {template.description || "No description"}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Version {version?.version_number ?? "—"}</span>
            <span>Parsing: {version?.parsing_status ?? "—"}</span>
          </div>
          {template.review_notes && template.verification_status === "rejected" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Review feedback</p>
              <p className="mt-1 text-muted-foreground">{template.review_notes}</p>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3 w-3" />
                {warnings.length} parsing warning(s)
              </div>
              <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                {warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="my-8" />

      <div className="mb-3">
        <h2 className="text-lg font-bold">Template specification</h2>
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? "Review the requirements detected from your template. You can edit the JSON before using it for generation."
            : "This specification belongs to another student and is read-only. You can still use this template for your own projects."}
        </p>
      </div>

      {version ? (
        <Card>
          <CardContent className="p-4">
            <textarea
              className="min-h-[360px] w-full rounded-lg border border-input bg-muted/30 p-4 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-90"
              value={specText}
              onChange={(e) => setSpecText(e.target.value)}
              spellCheck={false}
              aria-label="Template specification JSON"
              readOnly={!isOwner}
            />
            {isOwner && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Use the section names your college requires. Invalid JSON
                  cannot be saved.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setSpecText(JSON.stringify(EXAMPLE_SPECIFICATION, null, 2))
                    }
                  >
                    Load example
                  </Button>
                  <Button
                    onClick={() => saveSpecMut.mutate()}
                    disabled={saveSpecMut.isPending || !specText.trim()}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveSpecMut.isPending ? "Saving…" : "Save specification"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            This template has no uploaded file version yet.
          </CardContent>
        </Card>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this template?</DialogTitle>
            <DialogDescription>
              This permanently removes “{template.title}”, every uploaded
              version, and its generated specification. Documents that already
              used it are not changed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
            >
              {deleteMut.isPending ? "Deleting…" : "Delete template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit template details</DialogTitle>
            <DialogDescription>
              Public templates are reviewed before they appear in the public
              library. Changes to a public template put it back in the queue.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 pt-2"
            onSubmit={(event) => {
              event.preventDefault();
              updateTemplateMut.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="edit-template-title">Title</Label>
              <Input
                id="edit-template-title"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-template-description">Description</Label>
              <Textarea
                id="edit-template-description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-template-year">Academic year</Label>
                <Input
                  id="edit-template-year"
                  value={editAcademicYear}
                  onChange={(event) => setEditAcademicYear(event.target.value)}
                  placeholder="e.g. 2025-26"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-template-visibility">Visibility</Label>
                <Select
                  value={editVisibility}
                  onValueChange={(value) =>
                    setEditVisibility(value as typeof editVisibility)
                  }
                >
                  <SelectTrigger id="edit-template-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="unlisted">Unlisted (link only)</SelectItem>
                    <SelectItem value="public">Public library</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateTemplateMut.isPending || !editTitle.trim()}
              >
                {updateTemplateMut.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
