import pino from "pino";

export const logger = pino({
  level: (process.env.LOG_LEVEL as string) || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:mm:ss" } }
      : undefined,
  redact: ["req.headers.authorization", "req.headers.cookie", "*.apiKey", "*.secret", "*.token"],
});

export type Logger = typeof logger;
