import "dotenv/config.js";
import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
import { logger } from "./lib/logger.js";

const app = createApp();
const env = getEnv();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "API server listening");
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error({ reason }, "unhandled rejection");
  process.exit(1);
});

process.on("uncaughtException", (err: Error) => {
  logger.error({ err }, "uncaught exception");
  process.exit(1);
});

export default server;
