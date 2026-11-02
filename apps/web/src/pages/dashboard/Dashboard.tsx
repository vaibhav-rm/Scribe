"use client";

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Banknote,
  File,
  FileText,
  FolderOpen,
  Plus,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";

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
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-32 w-full" />
          ))}
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 w-full lg:col-span-2" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (dashboardQ.error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
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

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.09] via-card to-card p-6 shadow-soft">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">
              Welcome back, {user?.display_name || "there"}.
            </h2>
            <Badge variant={plan === "pro" ? "default" : "outline"}>
              {planLabel}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick up where you left off, or start a new document from your project
            sources.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
      </div>

      {plan === "free" &&
        (projectsCount >= maxProjects || generationsUsed >= maxGenerations) && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-amber-900">
              {projectsCount >= maxProjects
                ? `You have used all ${maxProjects} project slots on the ${planLabel} plan.`
                : `You have used all ${maxGenerations} generations included this month.`}{" "}
              Upgrade to Student Pro to keep going.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
            <Link to="/app/billing">Compare plans</Link>
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={FolderOpen}
          label="Projects"
          value={projectsCount}
          detail={`${maxProjects} allowed on ${planLabel}`}
          progress={maxProjects > 0 ? (projectsCount / maxProjects) * 100 : 0}
          href="/app/projects"
        />
        <StatCard
          icon={TrendingUp}
          label="Generations this month"
          value={generationsUsed}
          detail={`${maxGenerations} per month on ${planLabel}`}
          progress={maxGenerations > 0 ? (generationsUsed / maxGenerations) * 100 : 0}
          href="/app/generate"
        />
        <StatCard
          icon={File}
          label="Documents"
          value={documentsCount}
          detail="Drafts and completed"
          href="/app/documents"
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plan</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{planLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {plan === "pro"
                ? "₹149 · 30-day access pass"
                : "Free · 3 generations per month"}
            </p>
          </CardContent>
          <CardFooter className="pt-0">
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link to="/app/billing">
                {plan === "pro" ? "Manage access" : "Upgrade plan"}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Recent projects */}
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
                <FolderOpen className="h-8 w-8 text-muted-foreground/60" />
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
              <div className="divide-y divide-input">
                {recentProjects.map((project: any) => (
                  <Link
                    key={project.id}
                    to={`/app/projects/${project.id}`}
                    className="flex items-center gap-4 py-3 transition-colors hover:bg-accent/50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FolderOpen className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {project.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {project.description || "No description"} ·{" "}
                        {new Date(project.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {/* Quick actions */}
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

          {/* Recent documents */}
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
                      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {document.title}
                        </p>
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
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  detail: string;
  progress?: number;
  href: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-lift">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        <Link to={href} className="block">
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          {typeof progress === "number" && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          )}
        </Link>
      </CardContent>
    </Card>
  );
}
