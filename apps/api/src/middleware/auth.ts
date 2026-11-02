import { Request, Response, NextFunction } from "express";
import { supabaseUser, supabaseAdmin } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string | null;
    role: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "Missing token" });
    return;
  }

  const token = authHeader.slice(7);

  const userClient = supabaseUser(token);
  const { data, error } = await userClient.auth.getUser();

  if (error || !data?.user) {
    logger.warn({ error: error?.message }, "auth verification failed");
    res.status(401).json({ error: "unauthorized", message: "Invalid token" });
    return;
  }

  const user = data.user;

  // Fetch role from profiles (server-side, bypasses RLS)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  req.user = {
    id: user.id,
    email: user.email ?? null,
    role: profile?.role ?? "user",
  };

  next();
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    res.status(401).json({ error: "unauthorized", message: "Missing token" });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "forbidden", message: "Admin required" });
    return;
  }
  next();
};
