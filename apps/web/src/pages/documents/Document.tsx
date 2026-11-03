"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  File,
  FileText,
  History,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DocumentVersionSummary {
  id: string;
  version_number: number;
  source: "generation" | "edit" | "regenerate" | "restore";
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  generation: "Generated",
  edit: "Manual edit",
  regenerate: "Section regenerated",
  restore: "Restored",
};

export function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { fetchJson } = useApi();

  const usageQ = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const res = await fetchJson("/api/v1/billing/usage");
      if (!res.ok) throw new Error("Failed to load plan");
      return res.json();
    },
  });

  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [unsaved, setUnsaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(
    null,
  );
  const [regenTarget, setRegenTarget] = useState<{
    id: string;
    heading: string;
  } | null>(null);
  const [regenInstructions, setRegenInstructions] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<DocumentVersionSummary[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [pendingRestore, setPendingRestore] = useState<number | null>(null);
  const [previewVersion, setPreviewVersion] = useState<{
    number: number;
    content: any;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savingBeforeLeave, setSavingBeforeLeave] = useState(false);

  // Working copy of the document content. Section edits update this ref and
  // mark only that section dirty, so autosave never rewrites untouched text.
  const draftContent = useRef<any>(null);
  const dirtySections = useRef<Set<string>>(new Set());
  // Bumping this forces a render after a ref-only edit; without it the
  // controlled textareas can show stale text after the first keystroke.
  const [, setContentRevision] = useState(0);

  const loadDocument = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetchJson(`/api/v1/documents/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDocument(data.document);
        draftContent.current = JSON.parse(
          JSON.stringify(data.document.content_json ?? { sections: [] }),
        );
        dirtySections.current.clear();
        setUnsaved(false);
      } else {
        toast.error("Failed to load document");
      }
    } catch {
      toast.error("Failed to load document");
    } finally {
      setLoading(false);
    }
  }, [fetchJson, id]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const handleSectionChange = (sectionId: string, content: string) => {
    if (!draftContent.current) return;
    const sections = [...draftContent.current.sections];
    const idx = sections.findIndex((s: any) => s.id === sectionId);
    if (idx >= 0) {
      sections[idx] = { ...sections[idx], content };
      draftContent.current = { ...draftContent.current, sections };
      dirtySections.current.add(sectionId);
      setContentRevision((revision) => revision + 1);
      setUnsaved(true);
    }
  };

  const autosave = useCallback(async (): Promise<boolean> => {
    if (!document || !draftContent.current) return false;
    const ids = Array.from(dirtySections.current);
    if (ids.length === 0) {
      setUnsaved(false);
      return true;
    }
    // Two saves racing can interleave versions and lose text. A second caller
    // can retry after the current request settles.
    if (savingRef.current) return false;

    savingRef.current = true;
    setSaving(true);
    try {
      let latestDocument = document;
      for (const sectionId of ids) {
        const section = draftContent.current.sections.find(
          (s: any) => s.id === sectionId,
        );
        if (!section) continue;

        // Remember exactly what is being sent. If the user keeps typing while
        // the request is in flight, the section stays dirty and is saved again.
        const sentContent = section.content;

        const res = await fetchJson(
          `/api/v1/documents/${document.id}/sections/${sectionId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ content: sentContent }),
          },
        );

        if (!res.ok) {
          throw new Error("Autosave failed");
        }

        const data = await res.json();
        if (data.document) latestDocument = data.document;

        const current = draftContent.current.sections.find(
          (s: any) => s.id === sectionId,
        );
        if (current?.content === sentContent) {
          dirtySections.current.delete(sectionId);
        }
      }

      setDocument(latestDocument);
      const stillDirty = dirtySections.current.size > 0;
      setUnsaved(stillDirty);
      return !stillDirty;
    } catch {
      toast.error("Autosave failed");
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [document, fetchJson]);

  useEffect(() => {
    if (!unsaved) return;
    const timer = setTimeout(() => autosave(), 2000);
    return () => clearTimeout(timer);
  }, [unsaved, autosave]);
  const blocker = useBlocker(unsaved && !!token);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!unsaved) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const handleExport = async (format: "docx" | "pdf") => {
    if (!document) return;
    // Open the tab synchronously while still inside the click event; opening it
    // after an await is blocked by most browsers' popup blockers.
    const downloadWindow = window.open("", "_blank");
    setExporting(true);
    try {
      // Export snapshots the stored document. Flush pending edits first so the
      // download does not silently omit what is on screen.
      if (dirtySections.current.size > 0) {
        const saved = await autosave();
        if (!saved) {
          downloadWindow?.close();
          toast.error("Please save your changes before exporting.");
          return;
        }
      }
      const res = await fetchJson(
        `/api/v1/documents/${document.id}/export?format=${format}`,
      );
      if (!res.ok) {
        downloadWindow?.close();
        if (res.status === 503) {
          toast.error(
            "PDF export is not available in this deployment. DOCX export remains functional.",
          );
        } else if (res.status === 403) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.message || "Upgrade required for PDF export");
        } else {
          toast.error("Export failed");
        }
        return;
      }
      const data = await res.json();
      // The signed URL is short-lived; send the pre-opened tab to it.
      if (downloadWindow) {
        downloadWindow.location.href = data.downloadUrl;
      } else {
        window.location.href = data.downloadUrl;
      }
      toast.success(`${format.toUpperCase()} export ready`);
    } catch {
      downloadWindow?.close();
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleRegenerate = async (
    sectionId: string,
    instructions?: string,
  ) => {
    if (!document) return;
    if (dirtySections.current.size > 0) {
      toast.info("Saving your edits before regenerating…");
      const saved = await autosave();
      if (!saved) {
        toast.error("Please save your changes before regenerating.");
        return;
      }
    }

    setRegeneratingSection(sectionId);
    try {
      const res = await fetchJson(
        `/api/v1/documents/${document.id}/sections/${sectionId}/regenerate`,
        {
          method: "POST",
          body: JSON.stringify(
            instructions?.trim() ? { instructions: instructions.trim() } : {},
          ),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(
          err.message ||
            "Section regeneration failed. Your existing content was kept.",
        );
        return;
      }

      const data = await res.json();
      setDocument(data.document);
      draftContent.current = JSON.parse(
        JSON.stringify(data.document.content_json ?? { sections: [] }),
      );
      dirtySections.current.clear();
      setUnsaved(false);
      toast.success("Section regenerated");

      if (data.warnings?.length) {
        toast.warning(`${data.warnings.length} warning(s) in this section`);
      }
    } catch {
      toast.error("Section regeneration failed");
    } finally {
      setRegeneratingSection(null);
    }
  };

  const loadVersions = async () => {
    if (!document) return;
    setVersionsLoading(true);
    try {
      const res = await fetchJson(`/api/v1/documents/${document.id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions ?? []);
      } else {
        toast.error("Failed to load version history");
      }
    } catch {
      toast.error("Failed to load version history");
    } finally {
      setVersionsLoading(false);
    }
  };

  const openHistory = () => {
    setHistoryOpen(true);
    setPendingRestore(null);
    loadVersions();
  };
  const openPreview = async (versionNumber: number) => {
    if (!document) return;
    setPreviewVersion({ number: versionNumber, content: null });
    setPreviewLoading(true);
    try {
      const res = await fetchJson(
        `/api/v1/documents/${document.id}/versions/${versionNumber}`,
      );
      if (!res.ok) {
        toast.error("Failed to load that version");
        setPreviewVersion(null);
        return;
      }
      const data = await res.json();
      setPreviewVersion({
        number: versionNumber,
        content: data.version?.content_json ?? { sections: [] },
      });
    } catch {
      toast.error("Failed to load that version");
      setPreviewVersion(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRestore = async (versionNumber: number) => {
    if (!document) return;
    if (dirtySections.current.size > 0) {
      const saved = await autosave();
      if (!saved) {
        toast.error("Please save your changes before restoring a version.");
        return;
      }
    }
    setRestoring(versionNumber);
    try {
      const res = await fetchJson(
        `/api/v1/documents/${document.id}/versions/${versionNumber}/restore`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Failed to restore version");
        return;
      }

      const data = await res.json();
      setDocument(data.document);
      draftContent.current = JSON.parse(
        JSON.stringify(data.document.content_json ?? { sections: [] }),
      );
      dirtySections.current.clear();
      setUnsaved(false);
      setPendingRestore(null);
      toast.success(`Restored version ${versionNumber}`);
      await loadVersions();
    } catch {
      toast.error("Failed to restore version");
    } finally {
      setRestoring(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-64 w-full animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!document) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
          <p className="text-sm font-medium text-destructive">
            Document not found or not accessible.
          </p>
          <Button onClick={() => navigate("/app/documents")}>
            Back to documents
          </Button>
        </CardContent>
      </Card>
    );
  }

  const sections = draftContent.current?.sections ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/app/documents")}
            aria-label="Back to documents"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {document.title}
              </h1>
              <Badge variant="outline">{document.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Version {document.version_number} ·{" "}
              {unsaved ? "unsaved changes" : "all changes saved"}
              {document.project_id ? (
                <>
                  {" · "}
                  <Link
                    to={`/app/projects/${document.project_id}`}
                    className="text-primary hover:underline"
                  >
                    View project
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={openHistory}>
            <History className="mr-2 h-4 w-4" />
            History
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => handleExport("docx")}
          >
            <FileText className="mr-2 h-4 w-4" />
            DOCX
          </Button>
          {usageQ.data?.limits?.pdfExport === false ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toast.info("PDF export is included in Student Pro.");
                navigate("/app/billing");
              }}
            >
              <Lock className="mr-2 h-4 w-4" />
              PDF · Pro
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExport("pdf")}
            >
              <File className="mr-2 h-4 w-4" />
              PDF
            </Button>
          )}
          <Button disabled={saving || !unsaved} onClick={() => autosave()}>
            {saving ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Section navigation */}
        <div className="flex-none lg:sticky lg:top-4 lg:w-1/4 lg:self-start">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-semibold">Sections</CardTitle>
              <CardDescription className="text-xs">
                {sections.length} sections
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {sections.map((section: any) => (
                  <a
                    key={section.id}
                    href={`#section-${section.id}`}
                    className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <span className="truncate">{section.heading}</span>
                    {section.warnings?.length ? (
                      <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
                    ) : null}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Editor */}
        <div className="flex-1">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-8">
                {sections.map((section: any) => (
                  <div
                    key={section.id}
                    id={`section-${section.id}`}
                    className="space-y-3 scroll-mt-24"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-input pb-2">
                      <h3 className="text-lg font-bold text-foreground">
                        {section.heading}
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRegenTarget({ id: section.id, heading: section.heading });
                          setRegenInstructions("");
                        }}
                        disabled={regeneratingSection === section.id}
                      >
                        <RefreshCw
                          className={`h-3 w-3 mr-1 ${
                            regeneratingSection === section.id
                              ? "animate-spin"
                              : ""
                          }`}
                        />
                        {regeneratingSection === section.id
                          ? "Regenerating…"
                          : "Regenerate"}
                      </Button>
                    </div>

                    <div className="relative">
                      <textarea
                        value={section.content ?? ""}
                        onChange={(e) =>
                          handleSectionChange(section.id, e.target.value)
                        }
                        className="w-full min-h-[200px] rounded-lg border border-input bg-background p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary transition-colors resize-y"
                        placeholder="Write your section content here…"
                        disabled={regeneratingSection === section.id}
                      />
                      {regeneratingSection === section.id && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur z-10">
                          <div className="flex flex-col items-center gap-2">
                            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            <span className="text-sm text-muted-foreground">
                              Regenerating…
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="text-right text-[11px] tabular-nums text-muted-foreground">
                      {(section.content ?? "").trim()
                        ? (section.content as string)
                            .trim()
                            .split(/\s+/).length.toLocaleString()
                        : 0}{" "}
                      words
                    </p>

                    {Array.isArray(section.tables) &&
                    section.tables.length > 0 ? (
                      <div className="space-y-3">
                        {section.tables.map((table: any, tableIndex: number) => (
                          <div
                            key={tableIndex}
                            className="overflow-x-auto rounded-lg border border-input"
                          >
                            <table className="w-full border-collapse text-left text-xs">
                              <thead className="bg-muted/60">
                                <tr>
                                  {(table.headers ?? []).map(
                                    (header: string, index: number) => (
                                      <th
                                        key={index}
                                        className="border-b border-input px-3 py-2 font-semibold"
                                      >
                                        {header}
                                      </th>
                                    ),
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {(table.rows ?? []).map(
                                  (row: string[], rowIndex: number) => (
                                    <tr key={rowIndex}>
                                      {(row ?? []).map(
                                        (cell: string, cellIndex: number) => (
                                          <td
                                            key={cellIndex}
                                            className="border-b border-input/60 px-3 py-2 align-top"
                                          >
                                            {cell}
                                          </td>
                                        ),
                                      )}
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        ))}
                        <p className="text-[11px] text-muted-foreground">
                          Generated from the uploaded template&apos;s table
                          layout. Regenerate this section to refresh its rows.
                        </p>
                      </div>
                    ) : null}

                    {section.warnings?.length ? (
                      <div className="flex items-start gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{section.warnings.join("; ")}</span>
                      </div>
                    ) : null}

                    {section.source_references?.length ? (
                      <p className="text-xs text-muted-foreground">
                        Sources:{" "}
                        {section.source_references
                          .map((r: any) => r.name ?? r.title ?? r.id)
                          .join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="pt-4">
              {unsaved ? (
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Unsaved changes — autosaving in 2 seconds
                  </span>
                  <Button
                    size="sm"
                    onClick={() => autosave()}
                    disabled={saving}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    {saving ? "Saving…" : "Save now"}
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  All changes saved
                </span>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Regenerate section dialog */}
      <Dialog
        open={!!regenTarget}
        onOpenChange={(open) => {
          if (!open) setRegenTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate section</DialogTitle>
            <DialogDescription>
              {regenTarget?.heading}. The AI will rewrite this section from your
              project sources. Your current text is replaced only if generation
              succeeds.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <label
                htmlFor="regen-instructions"
                className="text-sm font-medium"
              >
                Optional instructions
              </label>
              <Textarea
                id="regen-instructions"
                value={regenInstructions}
                onChange={(event) => setRegenInstructions(event.target.value)}
                placeholder="e.g. Focus on the testing methodology and keep it under 300 words."
                className="min-h-[110px]"
                maxLength={2000}
              />
              <p className="text-right text-[11px] text-muted-foreground">
                {regenInstructions.length}/2000
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRegenTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!regenTarget) return;
                const target = regenTarget;
                setRegenTarget(null);
                void handleRegenerate(target.id, regenInstructions);
              }}
              disabled={regeneratingSection !== null}
            >
              <Sparkles className="mr-2 h-4 w-4" /> Regenerate section
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Read a previous version before deciding to restore it. */}
      <Dialog
        open={!!previewVersion}
        onOpenChange={(open) => !open && setPreviewVersion(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Version {previewVersion?.number} preview</DialogTitle>
            <DialogDescription>
              This is a read-only snapshot. Restoring it will create a new
              version.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
            {previewLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading version…
              </p>
            ) : (previewVersion?.content?.sections ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                This version has no section content.
              </p>
            ) : (
              (previewVersion?.content?.sections ?? []).map(
                (section: any, index: number) => (
                  <div key={section.id ?? index}>
                    <h3 className="text-sm font-semibold">
                      {section.heading || `Section ${index + 1}`}
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {section.content}
                    </p>
                  </div>
                ),
              )
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setPreviewVersion(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* In-app navigation guard for unsaved edits. */}
      <Dialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave with unsaved changes?</DialogTitle>
            <DialogDescription>
              Your latest edits have not been saved yet. Save them first, or
              leave and discard them.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => blocker.state === "blocked" && blocker.reset()}
            >
              Stay
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => blocker.state === "blocked" && blocker.proceed()}
            >
              Leave without saving
            </Button>
            <Button
              disabled={savingBeforeLeave}
              onClick={async () => {
                setSavingBeforeLeave(true);
                const saved = await autosave();
                setSavingBeforeLeave(false);
                if (saved && blocker.state === "blocked") {
                  blocker.proceed();
                } else if (!saved) {
                  toast.error("Could not save. Please try again.");
                }
              }}
            >
              {savingBeforeLeave ? "Saving…" : "Save and leave"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Version history */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Version history</DialogTitle>
            <DialogDescription>
              Restoring an earlier version creates a new version, so nothing is
              lost.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[360px] overflow-y-auto">
            {versionsLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Loading versions…
              </p>
            ) : versions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No saved versions yet.
              </p>
            ) : (
              <div className="divide-y divide-input">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          Version {version.version_number}
                        </span>
                        <Badge variant="outline">
                          {SOURCE_LABELS[version.source] ?? version.source}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(version.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openPreview(version.version_number)}
                        aria-label={`Preview version ${version.version_number}`}
                      >
                        <Eye className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Preview</span>
                      </Button>
                      {pendingRestore === version.version_number ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPendingRestore(null)}
                            disabled={restoring !== null}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleRestore(version.version_number)}
                            disabled={restoring !== null}
                          >
                            {restoring === version.version_number
                              ? "Restoring…"
                              : "Confirm"}
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPendingRestore(version.version_number)}
                          disabled={
                            restoring !== null ||
                            version.version_number === document.version_number
                          }
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          {version.version_number === document.version_number
                            ? "Current"
                            : "Restore"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
