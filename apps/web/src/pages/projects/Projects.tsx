"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  FolderOpen,
  Plus,
} from "lucide-react";

const createSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  academic_year: z.string().max(20).optional(),
});

export function ProjectsPage() {
  const { token, loading: authLoading } = useAuth();
  const { fetchJson } = useApi();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const {
    data: projects,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetchJson("/api/v1/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      return res.json();
    },
    enabled: !authLoading && !!token,
  });

  const createMut = useMutation({
    mutationFn: async (data: z.infer<typeof createSchema>) => {
      const res = await fetchJson("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create project");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      reset();
      toast.success("Project created");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create project"),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof createSchema>>({ resolver: zodResolver(createSchema) });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-44 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">Could not load projects</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const list = (projects?.projects ?? []) as any[];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Source workspaces"
        title="Projects"
        description="Each project is a source workspace. One project can generate many document types."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New project
          </Button>
        }
      />

      {list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-14 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-sm font-semibold">No projects yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Create your first workspace, then add notes, files, or a GitHub
              repository so the generator has something to work with.
            </p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create your first project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((project: any) => (
            <Card key={project.id} className="flex flex-col transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderOpen className="h-4 w-4" />
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(project.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <CardTitle className="mt-3 line-clamp-1 text-base">
                  <Link
                    to={`/app/projects/${project.id}`}
                    className="hover:underline"
                  >
                    {project.title}
                  </Link>
                </CardTitle>
                <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                  {project.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to={`/app/projects/${project.id}`}>
                    Open project <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Give your workspace a title. You can add resources right after.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((data) => createMut.mutate(data))}
            className="space-y-4 pt-2"
          >
            <div className="space-y-2">
              <Label htmlFor="title">Project title</Label>
              <Input
                id="title"
                {...register("title")}
                placeholder="e.g. Smart Irrigation System"
                autoFocus
              />
              {errors.title && (
                <span className="text-xs text-destructive">
                  {errors.title.message}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="A short description of your project"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="academic-year">Academic year (optional)</Label>
              <Input
                id="academic-year"
                {...register("academic_year")}
                placeholder="e.g. 2025-26"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? "Creating…" : "Create project"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
