export const DOCUMENT_TYPES = [
  { id: "project_synopsis", label: "Project Synopsis" },
  { id: "final_year_report", label: "Final Year Project Report" },
  { id: "srs", label: "Software Requirements Specification (SRS)" },
  { id: "system_design", label: "System Design Document" },
  { id: "project_proposal", label: "Project Proposal" },
  { id: "abstract", label: "Abstract" },
  { id: "literature_review", label: "Literature Review" },
  { id: "progress_report", label: "Progress Report" },
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number]["id"];

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    currency: "INR",
    interval: "month",
    limits: {
      maxProjects: 1,
      maxTemplates: 1,
      maxGenerationsPerMonth: 3,
      maxSectionRegenerations: 1,
      pdfExport: false,
      priority: "low",
    },
  },
  pro: {
    id: "pro",
    name: "Student Pro",
    price: 149,
    currency: "INR",
    interval: "month",
    limits: {
      maxProjects: 10,
      maxTemplates: 5,
      maxGenerationsPerMonth: 50,
      maxSectionRegenerations: 20,
      pdfExport: true,
      priority: "standard",
    },
  },
} as const;

export type PlanCode = keyof typeof PLANS;

export const DEFAULT_AI_PROVIDER = "gemini";
export const AI_PROVIDERS = ["gemini", "xai", "anthropic"] as const;
export type AIProviderId = (typeof AI_PROVIDERS)[number];

export const UPLOAD_LIMITS = {
  maxFileSizeBytes: 15 * 1024 * 1024, // 15 MB
  allowedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
  ],
  allowedExtensions: [".pdf", ".docx", ".txt", ".md"],
} as const;

export const JOB_STATUS = [
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUS)[number];

export const TEMPLATE_VISIBILITY = ["private", "unlisted", "public"] as const;
export type TemplateVisibility = (typeof TEMPLATE_VISIBILITY)[number];

export const TEMPLATE_VERIFICATION_STATUS = [
  "unverified",
  "pending",
  "verified",
  "rejected",
] as const;
export type TemplateVerificationStatus = (typeof TEMPLATE_VERIFICATION_STATUS)[number];

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const STORAGE_BUCKETS = {
  PROJECT_RESOURCES: "project-resources",
  TEMPLATES: "templates",
  GENERATED_DOCUMENTS: "generated-documents",
} as const;

export const API_PREFIX = "/api/v1";
