"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  draft: "outline",
  generated: "success",
  completed: "success",
  published: "default",
  failed: "destructive",
};

const PAGE_SIZE = 20;

export function DocumentsPage() {
  const { token, loading: authLoading } = useAuth();
  const { fetchJson } = useApi();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  // A new search always starts from the first page.
  useEffect(() => {
    setPage(1);
  }, [deferredSearch]);

  const documentsQ = useQuery({
    queryKey: ["documents", page, deferredSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (deferredSearch) params.set("search", deferredSearch);
      const res = await fetchJson(`/api/v1/documents?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    },
    enabled: !authLoading && !!token,
    placeholderData: (previous) => previous,
  });

  const documents = useMemo(
    () => (documentsQ.data?.documents ?? []) as any[],
    [documentsQ.data],
  );
  const total = Number(documentsQ.data?.total ?? documents.length);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasSearch = deferredSearch.length > 0;

  const deleteMut = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetchJson(`/api/v1/documents/${documentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete document");
      }
    },
    onSuccess: async () => {
      toast.success("Document deleted");
      setDeleteTarget(null);
      if (documents.length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete document"),
  });

  if (documentsQ.isLoading && !documentsQ.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (documentsQ.error && !documentsQ.data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">Could not load documents</p>
          <p className="text-sm text-muted-foreground">
            {(documentsQ.error as Error).message}
          </p>
          <Button variant="outline" onClick={() => documentsQ.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Documents</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every generated draft, with its current version and status.
          </p>
        </div>
        <Button asChild>
          <Link to="/app/generate">
            <Sparkles className="mr-2 h-4 w-4" /> Generate a document
          </Link>
        </Button>
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by document title…"
              className="pl-9"
              aria-label="Search documents"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {total} document{total === 1 ? "" : "s"}
            {hasSearch ? " matched" : ""}
          </p>
        </div>
      )}

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="h-7 w-7" />
            </span>
            <p className="text-base font-semibold">
              {hasSearch ? "No matching documents" : "No documents yet"}
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              {hasSearch
                ? "Try a shorter title or clear the search."
                : "Add resources to a project, review an outline, and generate your first document. It will appear here."}
            </p>
            {hasSearch ? (
              <Button variant="outline" onClick={() => setSearch("")}>
                Clear search
              </Button>
            ) : (
              <Button asChild>
                <Link to="/app/generate">Start generating</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((document: any) => (
            <Card
              key={document.id}
              className="transition-shadow hover:shadow-lift"
            >
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">
                        {document.title}
                      </h3>
                      <Badge
                        variant={STATUS_VARIANT[document.status] ?? "outline"}
                      >
                        {document.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Version {document.version_number} · Updated{" "}
                      {new Date(document.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:pl-4">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/documents/${document.id}`}>
                      Open editor <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${document.title}`}
                    onClick={() => setDeleteTarget(document)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-input pt-4">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || documentsQ.isFetching}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages || documentsQ.isFetching}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.title}” and its version history and cached exports
              will be permanently removed. The generation job stays in your
              history, but this document can no longer be opened.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() =>
                deleteTarget && deleteMut.mutate(deleteTarget.id)
              }
            >
              {deleteMut.isPending ? "Deleting…" : "Delete document"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
