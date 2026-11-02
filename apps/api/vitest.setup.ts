// Global test setup: set required env vars before any module is loaded.
// ESM imports are hoisted above top-level code, so env vars must be set
// here rather than in individual test files.
process.env.NODE_ENV = "test";
process.env.PORT = "4000";
process.env.API_URL = "http://localhost:4000";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.API_PREFIX = "/api/v1";
process.env.CORS_ORIGINS = "http://localhost:5173";
process.env.LOG_LEVEL = "error";
process.env.DOC_CONVERSION_ENABLED = "false";

import { resetEnv } from "../src/config/env.js";
resetEnv();
