import { Router, Response } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  GetProjectSchema,
  DeleteProjectSchema,
} from "@projectscribe/shared";
import { validate } from "../middleware/validate.js";
import { enforceLimit, checkProjectLimit } from "../services/limits.js";
import { auditLog } from "../services/audit.js";
import { logger } from "../lib/logger.js";
import { storageAdmin } from "../lib/storage.js";


const router = Router();

type IdReq = AuthRequest & {
  validated?: { params: { id: string } };
};
type IdBodyReq = AuthRequest & {
  validated?: { params: { id: string }; body: Record<string, unknown> };
};
type CreateReq = AuthRequest & {
  validated?: { body: { title: string; description?: string; department_id?: string | null; academic_year?: string | null } };
};

// GET /api/v1/projects
router.get("/projects", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const { data: projects, error } = await supabaseAdmin
    .from("projects")
    .select(
      "id, title, description, department_id, academic_year, metadata, created_at, updated_at, deleted_at",
    )
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    logger.error({ error, userId }, "list projects failed");
    res.status(500).json({
      error: "internal_server_error",
      message: "Failed to list projects",
    });
    return;
  }

  res.json({ projects: projects ?? [] });
});

// POST /api/v1/projects
router.post(
  "/projects",
  authenticate,
  enforceLimit(checkProjectLimit),
  validate(CreateProjectSchema),
  async (req: CreateReq, res: Response) => {
    const userId = req.user!.id;
    const { title, description, department_id, academic_year } =
      req.validated!.body;

    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .insert({
        owner_id: userId,
        title,
        description: description ?? null,
        department_id: department_id ?? null,
        academic_year: academic_year ?? null,
        metadata: {},
      })
      .select()
      .single();

    if (error || !project) {
      logger.error({ error, userId }, "create project failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to create project",
      });
      return;
    }

    res.status(201).json({ project });

    auditLog({
      user_id: userId,
      event_type: "project.create",
      target_type: "project",
      target_id: project.id,
      metadata: { title, department_id, academic_year },
      ip_address: req.ip ?? null,
      user_agent: req.get("User-Agent") ?? null,
    }).catch(() => {
      // ignore
    });
  },
);

// GET /api/v1/projects/:id
router.get(
  "/projects/:id",
  authenticate,
  validate(GetProjectSchema),
  async (req: IdReq, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.validated!.params;

    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .single();

    if (error || !project) {
      res.status(404).json({ error: "not_found", message: "Project not found" });
      return;
    }

    res.json({ project });
  },
);

// PATCH /api/v1/projects/:id
router.patch(
  "/projects/:id",
  authenticate,
  validate(UpdateProjectSchema),
  async (req: IdBodyReq, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.validated!.params;
    const body = (req.validated!.body ?? {}) as {
      title?: string;
      description?: string | null;
      department_id?: string | null;
      academic_year?: string | null;
    };
    const { title, description, department_id, academic_year } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (department_id !== undefined) updates.department_id = department_id;
    if (academic_year !== undefined) updates.academic_year = academic_year;

    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .update(updates)
      .eq("id", id)
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !project) {
      res.status(404).json({ error: "not_found", message: "Project not found" });
      return;
    }

    res.json({ project });

    auditLog({
      user_id: userId,
      event_type: "project.update",
      target_type: "project",
      target_id: id,
      metadata: { title, description, department_id, academic_year },
      ip_address: req.ip ?? null,
      user_agent: req.get("User-Agent") ?? null,
    }).catch(() => {
      // ignore
    });
  },
);

// DELETE /api/v1/projects/:id (soft delete)
router.delete(
  "/projects/:id",
  authenticate,
  validate(DeleteProjectSchema),
  async (req: IdReq, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.validated!.params;

    const { data: resources, error: resourcesErr } = await supabaseAdmin
      .from("project_resources")
      .select("id, storage_path")
      .eq("project_id", id)
      .eq("owner_id", userId);

    if (resourcesErr) {
      logger.warn({ error: resourcesErr, userId, projectId: id }, "list project resources for delete failed");
    }

    // Remove uploaded source files from private storage before hiding the
    // project. The project row itself is soft-deleted so generated documents
    // and their history remain accessible.
    const paths = (resources ?? [])
      .map((resource: any) => resource.storage_path)
      .filter((path: string | null): path is string => !!path);
    if (paths.length > 0) {
      const { error: storageErr } = await storageAdmin()
        .storage.from("project-resources")
        .remove(paths);
      if (storageErr) {
        logger.warn({ error: storageErr, userId, projectId: id }, "project resource storage cleanup failed");
      }
    }

    if (resources && resources.length > 0) {
      await supabaseAdmin
        .from("project_resources")
        .delete()
        .eq("project_id", id)
        .eq("owner_id", userId);
    }

    const { data: deleted, error } = await supabaseAdmin
      .from("projects")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      logger.error({ error, userId, projectId: id }, "delete project failed");
      res.status(500).json({
        error: "internal_server_error",
        message: "Failed to delete project",
      });
      return;
    }

    if (!deleted) {
      res.status(404).json({ error: "not_found", message: "Project not found" });
      return;
    }

    res.json({ ok: true });

    auditLog({
      user_id: userId,
      event_type: "project.delete",
      target_type: "project",
      target_id: id,
      metadata: {},
      ip_address: req.ip ?? null,
      user_agent: req.get("User-Agent") ?? null,
    }).catch(() => {
      // ignore
    });
  },
);

export default router;
