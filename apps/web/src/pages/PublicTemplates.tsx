"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { DOCUMENT_TYPES, documentTypeLabel } from "@/lib/document-types";

export function PublicTemplatesPage() {
  const { isAuthenticated } = useAuth();
  const { fetchJson } = useApi();
  const [documentType, setDocumentType] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Any filter change starts from the first page of results.
  useEffect(() => {
    setPage(1);
  }, [documentType, academicYear, appliedSearch]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "public-templates",
      documentType,
      academicYear,
      appliedSearch,
      page,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (documentType) params.set("document_type", documentType);
      if (academicYear) params.set("academic_year", academicYear);
      if (appliedSearch) params.set("search", appliedSearch);
      const res = await fetchJson(`/api/v1/public/templates?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load the template library");
      return res.json();
    },
  });

  const templates = (data?.templates ?? []) as any[];
  const total = Number(data?.total ?? templates.length);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(documentType || academicYear || appliedSearch);

  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <Badge
              variant="outline"
              className="gap-1.5 border-primary/30 bg-primary/5 text-primary"
            >
              <ShieldCheck className="h-3 w-3" /> Public library
            </Badge>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              Template library
            </h1>
            <p className="mt-3 text-muted-foreground">
              Browse templates other students have chosen to share publicly.
              Private and unlisted templates are never shown here.
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link to={isAuthenticated ? "/app/templates" : "/signup"}>
              <Sparkles className="h-4 w-4" />
              {isAuthenticated ? "Manage my templates" : "Upload your template"}
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="mt-8 grid gap-3 rounded-xl border border-input bg-muted/30 p-4 md:grid-cols-[1fr_220px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search templates by title…"
              className="bg-background pl-9"
              aria-label="Search templates"
            />
          </div>
          <select
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-foreground transition-colors hover:border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            aria-label="Document type"
          >
            <option value="">All document types</option>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <select
            value={academicYear}
            onChange={(event) => setAcademicYear(event.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-foreground transition-colors hover:border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            aria-label="Academic year"
          >
            <option value="">All academic years</option>
            <option value="2026-27">2026-27</option>
            <option value="2025-26">2025-26</option>
            <option value="2024-25">2024-25</option>
            <option value="2023-24">2023-24</option>
          </select>
        </div>

        {isLoading ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
              <Card key={item}>
                <CardContent className="space-y-3 p-5">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="mt-8">
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-medium">Could not load the library</p>
              <p className="text-sm text-muted-foreground">
                {(error as Error).message}
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Try again
              </Button>
            </CardContent>
          </Card>
        ) : templates.length === 0 ? (
          <Card className="mt-8">
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm font-medium">
                {hasFilters ? "No matching templates" : "The library is empty"}
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                {hasFilters
                  ? "Try removing a filter or searching for a different title."
                  : "No one has shared a public template yet. Be the first — upload your college's DOCX format."}
              </p>
              {hasFilters ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setDocumentType("");
                    setAcademicYear("");
                    setSearch("");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button asChild>
                  <Link to={isAuthenticated ? "/app/templates" : "/signup"}>
                    Upload a template
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="flex flex-col transition-shadow hover:shadow-lift"
              >
                <CardContent className="flex-1 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </span>
                    <Badge variant="success">Reviewed</Badge>
                  </div>
                  <h3 className="mt-4 line-clamp-2 text-sm font-semibold">
                    {template.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {documentTypeLabel(template.document_type)}
                    {template.academic_year
                      ? ` · ${template.academic_year}`
                      : ""}
                  </p>
                  <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {template.description || "No description provided."}
                  </p>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link
                      to={
                        isAuthenticated
                          ? `/app/templates/${template.id}`
                          : "/signup"
                      }
                    >
                      {isAuthenticated ? "Open in app" : "Use this template"}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && !error && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-input pt-4">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {total} templates
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages}
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
