import "express-async-errors";
import { createHash } from "node:crypto";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import apiRouter from "./routes/index.js";
import { ensureBucket } from "./lib/storage.js";
import { getEnv } from "./config/env.js";
import { logger } from "./lib/logger.js";

export function createApp() {
  const env = getEnv();
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // custom CSP can be added later
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS - restrict to allowlisted origins
  const allowedOrigins = env.CORS_ORIGINS.split(",").map((o) => o.trim());
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, X-Requested-With",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // Body parsing with size limits
  // Raw body parser for webhook routes — must come BEFORE express.json()
  // so Razorpay webhook signature verification can access the raw body.
  app.use("/api/v1/billing/webhooks/razorpay", express.raw({ type: "*/*" }));

  app.use(express.json({ limit: "2mb" }));

  // Request logging + request id
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      logger.info(
        { method: req.method, path: req.path, status: res.statusCode, ms },
        "http request",
      );
    });
    next();
  });

  // Global rate limit
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 600,
      standardHeaders: true,
      legacyHeaders: false,
      // Students in a college often share one NAT address. Key signed-in
      // traffic by a hash of the access token so one busy user cannot throttle
      // everyone else on the same network.
      keyGenerator: (req) => {
        const auth = req.headers.authorization;
        if (auth?.startsWith("Bearer ")) {
          return `token:${createHash("sha256")
            .update(auth.slice(7))
            .digest("hex")}`;
        }
        return req.ip ?? "unknown";
      },
      message: { error: "too_many_requests", message: "Rate limit exceeded" },
    }),
  );

  // Health check
  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "scribe-api" });
  });

  app.get("/api/v1/healthz", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // API routes
  app.use(env.API_PREFIX, apiRouter);

  // Ensure private storage buckets exist on startup (idempotent)
  ensureBucket("project-resources").catch((err) =>
    logger.warn({ err }, "failed to ensure project-resources bucket"),
  );
  ensureBucket("templates").catch((err) =>
    logger.warn({ err }, "failed to ensure templates bucket"),
  );
  ensureBucket("generated-documents").catch((err) =>
    logger.warn({ err }, "failed to ensure generated-documents bucket"),
  );

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "not_found", message: "Route not found" });
  });

  // Multer error handler — convert upload/validation errors to 400
  app.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      if (err instanceof multer.MulterError) {
        logger.warn({ err }, "multer upload error");
        res.status(400).json({
          error: "validation_failed",
          message: err.message || "File upload failed",
        });
        return;
      }
      const status =
        typeof (err as any)?.status === "number"
          ? (err as any).status
          : 500;
      if (status < 500) {
        logger.warn({ err }, "request validation error");
        res.status(status).json({
          error: "validation_failed",
          message:
            (err as Error)?.message || "The request could not be processed",
        });
        return;
      }
      logger.error({ err }, "unhandled error");
      res.status(500).json({
        error: "internal_server_error",
        message:
          process.env.NODE_ENV === "development"
            ? (err as Error)?.message || String(err)
            : "An unexpected error occurred",
      });
    },
  );

  return app;
}
