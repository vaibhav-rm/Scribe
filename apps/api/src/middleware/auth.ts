import { createHash } from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string | null;
    role: string;
  };
}

type CachedAuth = {
  user: NonNullable<AuthRequest["user"]>;
  expiresAt: number;
};

const AUTH_CACHE_TTL_MS = 60_000;
const AUTH_CACHE_LIMIT = 2_000;
const authCache = new Map<string, CachedAuth>();

function cacheKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readCache(key: string): CachedAuth["user"] | null {
  const cached = authCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    authCache.delete(key);
    return null;
  }
  return cached.user;
}

function writeCache(key: string, user: CachedAuth["user"]): void {
  if (authCache.size >= AUTH_CACHE_LIMIT) {
    const oldest = authCache.keys().next().value;
    if (oldest) authCache.delete(oldest);
  }
  authCache.set(key, { user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
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
  const key = cacheKey(token);

  // A dashboard view fans out into several API calls at once. Verifying the
  // same access token against Supabase for every request added a visible
  // waterfall on every page load, so keep a short-lived server cache.
  const cached = readCache(key);
  if (cached) {
    req.user = cached;
    next();
    return;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

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

  const resolvedUser = {
    id: user.id,
    email: user.email ?? null,
    role: profile?.role ?? "user",
  };
  req.user = resolvedUser;
  writeCache(key, resolvedUser);

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
