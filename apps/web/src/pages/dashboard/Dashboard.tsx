"use client";

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  File,
  FileText,
  FolderOpen,
  LayoutTemplate,
  Plus,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardPage() {
  const { user, token, loading: authLoading } = useAuth();
  const { fetchJson } = useApi();

  const dashboardQ = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [meRes, projectsRes, documentsRes, usageRes] = await Promise.all([
        fetchJson("/api/v1/auth/me"),
        fetchJson("/api/v1/projects"),
        fetchJson("/api/v1/documents"),
        fetchJson("/api/v1/billing/usage"),
      ]);

      if (!meRes.ok) throw new Error("Failed to load your profile");

      return {
        me: await meRes.json(),
        projects: projectsRes.ok ? ((await projectsRes.json()).projects ?? []) : [],
        documents: documentsRes.ok
          ? ((await documentsRes.json()).documents ?? [])
          : [],
        usage: usageRes.ok ? await usageRes.json() : null,
      };
    },
    enabled: !authLoading && !!token,
  });

  if (authLoading || dashboardQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-52 w-full rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 w-full rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (dashboardQ.error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </span>
          <h3 className="font-semibold">Unable to load dashboard</h3>
          <p className="text-sm text-muted-foreground">
            {(dashboardQ.error as Error).message}
          </p>
          <Button onClick={() => dashboardQ.refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const { me, projects, documents, usage } = dashboardQ.data!;
  const plan = usage?.plan ?? (me.subscription?.plan_code === "pro" ? "pro" : "free");
  const planLabel = plan === "pro" ? "Student Pro" : "Free";
  const projectsCount = me.projects_count ?? projects.length;
  const generationsUsed = me.generations_used ?? 0;
  const documentsCount = me.documents_count ?? documents.length;
  const maxProjects = usage?.limits?.maxProjects ?? (plan === "pro" ? 10 : 1);
  const maxGenerations =
    usage?.limits?.maxGenerationsPerMonth ?? (plan === "pro" ? 50 : 3);

  const recentProjects = projects.slice(0, 4);
  const recentDocuments = documents.slice(0, 5);
  const hasProjects = projectsCount > 0;

  return (
    <div className="space-y-6">
      <section className="corner-marks relative overflow-hidden rounded-xl border border-border bg-[linear-gradient(125deg,hsl(var(--primary)/0.09),hsl(var(--card)/0.8)_44%,hsl(var(--electric)/0.045))] p-6 shadow-soft sm:p-8">
        <div className="pointer-events-none absolute inset-0 grid-field opacity-50" />
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary/15 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-electric/10 blur-[90px]" />

        <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Workspace overview</span>
              <Badge variant={plan === "pro" ? "default" : "outline"}>
                {planLabel} plan
              </Badge>
            </div>
            <div className="mt-5 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/55">
              <span>Sheet 01 / workspace</span>
              <span className="h-px flex-1 bg-border" />
              <span>Rev. 2026.11</span>
            </div>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Welcome back,{" "}
              <span className="font-serif font-normal italic text-primary">
                {user?.display_name || "there"}.
              </span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Pick up where you left off, or start a new document from your
              project sources. Your template stays in control of the format.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/app/projects">
                  <FolderOpen className="mr-2 h-4 w-4" /> Projects
                </Link>
              </Button>
              <Button asChild>
                <Link to="/app/generate">
                  <Sparkles className="mr-2 h-4 w-4" /> Generate
                </Link>
              </Button>
            </div>
          </div>

          <div className="paper-surface paper-sheet w-full max-w-sm rounded-lg p-4">
            <div className="flex items-center justify-between border-b border-paper-border pb-2">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Suggested next step
              </p>
              <span className="h-1.5 w-1.5 rounded-[1px] bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
            </div>
            <div className="mt-3 flex items-start gap-3">
              <span className="icon-tile h-10 w-10 shrink-0 rounded-xl">
                {hasProjects ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {hasProjects ? "Generate from a project" : "Create your first project"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {hasProjects
                    ? "Choose a project and a template, review the outline, then write section by section."
                    : "Add a title, your notes or files, and the template your department requires."}
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="mt-4 w-full justify-between">
              <Link to={hasProjects ? "/app/generate" : "/app/projects"}>
                {hasProjects ? "Start a generation" : "Create a project"}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {plan === "free" &&
        (projectsCount >= maxProjects || generationsUsed >= maxGenerations) && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p className="text-amber-100/90">
                {projectsCount >= maxProjects
                  ? `You have used all ${maxProjects} project slots on the ${planLabel} plan.`
                  : `You have used all ${maxGenerations} generations included this month.`}{" "}
                Upgrade to Student Pro to keep going.
              </p>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-400/20 text-amber-100 hover:border-amber-400/35 hover:bg-amber-400/10 hover:text-amber-50"
            >
              <Link to="/app/billing">Compare plans</Link>
            </Button>
          </div>
        )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={FolderOpen}
          label="Projects"
          value={projectsCount}
          detail={`${maxProjects} allowed on ${planLabel}`}
          progress={maxProjects > 0 ? (projectsCount / maxProjects) * 100 : 0}
          href="/app/projects"
          tone="primary"
        />
        <StatCard
          icon={TrendingUp}
          label="Generations this month"
          value={generationsUsed}
          detail={`${maxGenerations} per month on ${planLabel}`}
          progress={maxGenerations > 0 ? (generationsUsed / maxGenerations) * 100 : 0}
          href="/app/generate"
          tone="electric"
        />
        <StatCard
          icon={File}
          label="Documents"
          value={documentsCount}
          detail="Drafts and completed"
          href="/app/documents"
          tone="violet"
        />
        <Card className="group relative overflow-hidden">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-coral/10 blur-2xl" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Plan
            </CardTitle>
            <span className="icon-tile h-8 w-8 rounded-lg text-coral">
              <Banknote className="h-4 w-4" />
            </span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-[-0.03em]">{planLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {plan === "pro"
                ? "₹149 · 30-day access pass"
                : "Free · 3 generations per month"}
            </p>
            <Button asChild size="sm" variant="outline" className="mt-4 w-full">
              <Link to="/app/billing">
                {plan === "pro" ? "Manage access" : "Upgrade plan"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Recent projects</CardTitle>
              <CardDescription>Your active project workspaces</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/app/projects">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
                  <FolderOpen className="h-6 w-6" />
                </span>
                <p className="text-sm font-medium">No projects yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Create a project, add your notes or files, then generate a
                  template-aware document.
                </p>
                <Button asChild size="sm">
                  <Link to="/app/projects">
                    <Plus className="mr-2 h-4 w-4" /> Create a project
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {recentProjects.map((project: any) => (
                  <Link
                    key={project.id}
                    to={`/app/projects/${project.id}`}
                    className="group flex items-center gap-4 rounded-sm px-2 py-3 transition-colors hover:bg-foreground/[0.035]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-primary/10 text-primary">
                      <FolderOpen className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{project.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {project.description || "No description"} ·{" "}
                        {new Date(project.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild className="w-full justify-start">
                <Link to="/app/projects">
                  <Plus className="mr-2 h-4 w-4" /> New project
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link to="/app/generate">
                  <Sparkles className="mr-2 h-4 w-4" /> Generate document
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link to="/app/templates">
                  <Upload className="mr-2 h-4 w-4" /> Upload a template
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link to="/app/billing">
                  <Banknote className="mr-2 h-4 w-4" /> Manage subscription
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Recent documents</CardTitle>
              <Button asChild size="sm" variant="ghost">
                <Link to="/app/documents">All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentDocuments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Generated documents will appear here.
                </p>
              ) : (
                <div className="space-y-1">
                  {recentDocuments.map((document: any) => (
                    <Link
                      key={document.id}
                      to={`/app/documents/${document.id}`}
                      className="group flex items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-foreground/[0.04]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-muted/40 text-muted-foreground group-hover:text-primary">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{document.title}</p>
                        <p className="text-xs text-muted-foreground">
                          v{document.version_number} · {document.status}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="icon-tile h-10 w-10 shrink-0 rounded-xl text-electric">
              <LayoutTemplate className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Bring your college template</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload the DOCX your department requires. Scribe preserves its
                margins, tables, headings, and figure spaces.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link to="/app/templates">
              Open templates <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  progress,
  href,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  detail: string;
  progress?: number;
  href: string;
  tone: "primary" | "electric" | "violet";
}) {
  const toneClass = {
    primary: "text-primary",
    electric: "text-electric",
    violet: "text-violet",
  }[tone];

  return (
    <Card className="group transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span className={cn("icon-tile h-8 w-8 rounded-lg", toneClass)}>
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        <Link to={href} className="block">
          <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          {typeof progress === "number" && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-[1px] bg-foreground/[0.06]">
              <div
                className="h-full rounded-[1px] bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)] transition-all"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          )}
        </Link>
      </CardContent>
    </Card>
  );
}
