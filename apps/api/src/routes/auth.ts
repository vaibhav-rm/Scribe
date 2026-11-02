import { Router, Response } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import { UpdateMeSchema } from "@projectscribe/shared";
import { validate } from "../middleware/validate.js";
import { auditLog } from "../services/audit.js";

const router = Router();

// GET /api/v1/me
router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, avatar_url, role, created_at, updated_at")
    .eq("id", userId)
    .single();

  // The trigger in migration 005 normally creates this row on signup. Create it
  // lazily as well so accounts that predate the migration keep working.
  let resolvedProfile = profile;
  if (error || !profile) {
    const fallbackName = req.user!.email?.split("@")[0] ?? null;
    const { data: created, error: createError } = await supabaseAdmin
      .from("profiles")
      .insert({ id: userId, display_name: fallbackName })
      .select("id, display_name, avatar_url, role, created_at, updated_at")
      .single();

    if (createError || !created) {
      res
        .status(404)
        .json({ error: "not_found", message: "Profile not found" });
      return;
    }
    resolvedProfile = created;
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    { data: subscription },
    { count: projectsCount },
    { count: generationsUsed },
    { count: documentsCount },
  ] = await Promise.all([
    supabaseAdmin
      .from("subscriptions")
      .select("plan_code, status, current_period_end")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .is("deleted_at", null),
    supabaseAdmin
      .from("generation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .gte("created_at", monthStart.toISOString()),
    supabaseAdmin
      .from("generated_documents")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId),
  ]);

  res.json({
    profile: resolvedProfile,
    subscription: subscription ?? null,
    projects_count: projectsCount ?? 0,
    generations_used: generationsUsed ?? 0,
    documents_count: documentsCount ?? 0,
  });
});

// PATCH /api/v1/me
router.patch(
  "/me",
  authenticate,
  validate(UpdateMeSchema),
  async (req: AuthRequest & { validated?: { body: { display_name?: string } } }, res: Response) => {
    const userId = req.user!.id;
    const { display_name } = req.validated!.body;

    if (display_name === undefined) {
      res.status(400).json({
        error: "validation_failed",
        message: "Provide a display_name to update",
      });
      return;
    }

    // Upsert so accounts created before the profile trigger still work.
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          display_name:
            display_name.trim() || req.user!.email?.split("@")[0] || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    if (error || !profile) {
      res.status(404).json({ error: "not_found", message: "Profile not found" });
      return;
    }

    res.json({ profile });

    auditLog({
      user_id: userId,
      event_type: "user.profile_update",
      target_type: "profile",
      target_id: userId,
      metadata: { fields: Object.keys(req.validated!.body) },
      ip_address: req.ip ?? null,
      user_agent: req.get("User-Agent") ?? null,
    }).catch(() => {});
  },
);

export default router;
