import { z } from "zod";
import { PlanCode } from "./constants";

// Common
export const IDSchema = z.string().uuid();
export type ID = string;

export const TimestampedSchema = z.object({
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Profiles
export const ProfileSchema = z.object({
  id: IDSchema,
  display_name: z.string().min(1).max(100).nullable(),
  avatar_url: z.string().url().nullable(),
  role: z.enum(["user", "admin"] as const),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Profile = z.infer<typeof ProfileSchema>;

// Colleges
export const CollegeSchema = z.object({
  id: IDSchema,
  name: z.string().min(1).max(200),
  normalized_name: z.string().min(1).max(200),
  location: z.string().max(200).nullable(),
  website: z.string().url().nullable(),
  verification_status: z.enum(["unverified", "verified"] as const),
  created_at: z.string().datetime(),
});
export type College = z.infer<typeof CollegeSchema>;

// Departments
export const DepartmentSchema = z.object({
  id: IDSchema,
  college_id: IDSchema,
  name: z.string().min(1).max(200),
  normalized_name: z.string().min(1).max(200),
});
export type Department = z.infer<typeof DepartmentSchema>;

// Projects
export const ProjectSchema = z.object({
  id: IDSchema,
  owner_id: IDSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  department_id: IDSchema.nullable(),
  academic_year: z.string().max(20).nullable(),
  metadata: z.record(z.unknown()).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable(),
});
export type Project = z.infer<typeof ProjectSchema>;

// Project resources
export const ProjectResourceSchema = z.object({
  id: IDSchema,
  project_id: IDSchema,
  owner_id: IDSchema,
  resource_type: z.enum(["text", "file", "github"] as const),
  original_filename: z.string().nullable(),
  storage_path: z.string().nullable(),
  external_url: z.string().url().nullable(),
  processing_status: z.enum(
    ["pending", "processing", "completed", "failed"] as const,
  ),
  metadata: z.record(z.unknown()).nullable(),
  created_at: z.string().datetime(),
});
export type ProjectResource = z.infer<typeof ProjectResourceSchema>;

// Templates
export const TemplateSchema = z.object({
  id: IDSchema,
  owner_id: IDSchema.nullable(),
  college_id: IDSchema.nullable(),
  department_id: IDSchema.nullable(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
  document_type: z.enum(
    [
      "project_synopsis",
      "final_year_report",
      "srs",
      "system_design",
      "project_proposal",
      "abstract",
      "literature_review",
      "progress_report",
    ] as const,
  ),
  academic_year: z.string().max(20).nullable(),
  visibility: z.enum(["private", "unlisted", "public"] as const),
  verification_status: z.enum(
    ["unverified", "pending", "verified", "rejected"] as const,
  ),
  current_version_id: IDSchema.nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Template = z.infer<typeof TemplateSchema>;

// Template versions
export const TemplateVersionSchema = z.object({
  id: IDSchema,
  template_id: IDSchema,
  version_number: z.number().int().positive(),
  storage_path: z.string(),
  parsed_specification: z.record(z.unknown()).nullable(),
  parsing_status: z.enum(["pending", "completed", "failed"] as const),
  validation_warnings: z.array(z.string()).nullable(),
  created_at: z.string().datetime(),
});
export type TemplateVersion = z.infer<typeof TemplateVersionSchema>;

// Generation jobs
export const GenerationJobSchema = z.object({
  id: IDSchema,
  owner_id: IDSchema,
  project_id: IDSchema,
  template_version_id: IDSchema.nullable(),
  document_type: z.string(),
  status: z.enum(
    ["queued", "processing", "completed", "failed", "cancelled"] as const,
  ),
  progress: z.number().int().min(0).max(100),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  provider: z.string(),
  model: z.string(),
  estimated_cost: z.number().nonnegative().nullable(),
  actual_cost: z.number().nonnegative().nullable(),
  created_at: z.string().datetime(),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
});
export type GenerationJob = z.infer<typeof GenerationJobSchema>;

// Generated documents
export const GeneratedDocumentSchema = z.object({
  id: IDSchema,
  owner_id: IDSchema,
  project_id: IDSchema,
  generation_job_id: IDSchema,
  title: z.string().min(1).max(200),
  version_number: z.number().int().positive(),
  content_json: z.record(z.unknown()).nullable(),
  docx_storage_path: z.string().nullable(),
  pdf_storage_path: z.string().nullable(),
  status: z.enum(["draft", "completed", "failed"] as const),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type GeneratedDocument = z.infer<typeof GeneratedDocumentSchema>;

// Usage ledger
export const UsageLedgerSchema = z.object({
  id: IDSchema,
  user_id: IDSchema,
  event_type: z.string(),
  credits_delta: z.number().int(),
  idempotency_key: z.string(),
  generation_job_id: IDSchema.nullable(),
  metadata: z.record(z.unknown()).nullable(),
  created_at: z.string().datetime(),
});
export type UsageLedger = z.infer<typeof UsageLedgerSchema>;

// Subscriptions
export const SubscriptionSchema = z.object({
  id: IDSchema,
  user_id: IDSchema,
  provider: z.string(),
  provider_customer_id: z.string().nullable(),
  provider_subscription_id: z.string().nullable(),
  plan_code: z.enum(["free", "pro"] as const),
  status: z.string(),
  current_period_start: z.string().datetime().nullable(),
  current_period_end: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

// Payments
export const PaymentSchema = z.object({
  id: IDSchema,
  user_id: IDSchema,
  provider: z.string(),
  provider_order_id: z.string(),
  provider_payment_id: z.string().nullable(),
  amount_minor_units: z.number().int().nonnegative(),
  currency: z.string().min(3).max(3),
  status: z.string(),
  idempotency_key: z.string(),
  created_at: z.string().datetime(),
});
export type Payment = z.infer<typeof PaymentSchema>;

// Document content structure (domain model)
export const DocumentSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  content: z.string(),
  source_references: z.array(z.string()).optional().default([]),
  warnings: z.array(z.string()).optional().default([]),
});
export type DocumentSection = z.infer<typeof DocumentSectionSchema>;

export const DocumentContentSchema = z.object({
  title: z.string(),
  sections: z.array(DocumentSectionSchema),
});
export type DocumentContent = z.infer<typeof DocumentContentSchema>;

// AI
export const AIUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative().optional(),
  output_tokens: z.number().int().nonnegative().optional(),
});
export type AIUsage = z.infer<typeof AIUsageSchema>;

export const AIResultSchema = z.object({
  data: z.unknown(),
  usage: AIUsageSchema.optional(),
  model: z.string(),
  provider: z.string(),
});
export type AIResult<T = unknown> = z.infer<typeof AIResultSchema> & {
  data: T;
};

export type PlanLimits = {
  maxProjects: number;
  maxTemplates: number;
  maxGenerationsPerMonth: number;
  maxSectionRegenerations: number;
  pdfExport: boolean;
  priority: "low" | "standard";
};

export type PlanDefinition = {
  id: PlanCode;
  name: string;
  price: number;
  currency: string;
  interval: string;
  limits: PlanLimits;
};
