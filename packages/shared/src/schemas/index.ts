import { z } from "zod";

export const CreateProjectSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    department_id: z.string().uuid().optional().nullable(),
    academic_year: z.string().max(20).optional().nullable(),
  }),
});

export const UpdateProjectSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    department_id: z.string().uuid().optional().nullable(),
    academic_year: z.string().max(20).optional().nullable(),
  }),
});

export const GetProjectSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const DeleteProjectSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const AddTextResourceSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(100),
    content: z.string().min(1).max(500_000),
    source_type: z
      .enum(["abstract", "problem_statement", "notes", "methodology", "results", "other"])
      .optional(),
  }),
});

export const DeleteResourceSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const GetTemplatesQuerySchema = z.object({
  query: z.object({
    college: z.string().optional(),
    department: z.string().optional(),
    document_type: z.string().optional(),
    academic_year: z.string().optional(),
    visibility: z.enum(["private", "unlisted", "public"]).optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const CreateTemplateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    document_type: z.string(),
    college_id: z.string().uuid().optional().nullable(),
    department_id: z.string().uuid().optional().nullable(),
    academic_year: z.string().max(20).optional().nullable(),
    visibility: z.enum(["private", "unlisted", "public"]).default("private"),
  }),
});

export const GetTemplateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const UpdateTemplateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    academic_year: z.string().max(20).optional().nullable(),
    visibility: z.enum(["private", "unlisted", "public"]).optional(),
  }),
});

export const UpdateTemplateSpecificationSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    specification: z.record(z.unknown()),
  }),
});

export const CreateGenerationSchema = z.object({
  body: z.object({
    project_id: z.string().uuid(),
    template_version_id: z.string().uuid().optional().nullable(),
    document_type: z.string().min(1),
    /** Optional reviewed outline to generate from instead of re-planning. */
    outline_id: z.string().uuid().optional().nullable(),
  }),
});

export const GenerateOutlineSchema = z.object({
  body: z.object({
    project_id: z.string().uuid(),
    template_version_id: z.string().uuid().optional().nullable(),
    document_type: z.string().min(1),
  }),
});

export const GetGenerationSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const CancelGenerationSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const RegenerateSectionSchema = z.object({
  params: z.object({ id: z.string().uuid(), sectionId: z.string() }),
});

export const GetDocumentsQuerySchema = z.object({
  query: z.object({
    project_id: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const GetDocumentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const UpdateDocumentSectionSchema = z.object({
  params: z.object({ id: z.string().uuid(), sectionId: z.string() }),
  body: z.object({
    content: z.string(),
  }),
});

export const RegenerateDocumentSectionSchema = z.object({
  params: z.object({ id: z.string().uuid(), sectionId: z.string() }),
  body: z
    .object({
      instructions: z.string().max(2000).optional(),
    })
    .optional()
    .default({}),
});

export const RestoreDocumentVersionSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    versionNumber: z.coerce.number().int().positive(),
  }),
});

export const ExportDocumentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  query: z.object({ format: z.enum(["docx", "pdf"]) }),
});

export const UpdateMeSchema = z.object({
  body: z.object({
    display_name: z.string().min(1).max(100).optional(),
  }),
});

export const CheckoutSchema = z.object({
  body: z.object({
    plan_code: z.enum(["free", "pro"]),
    success_url: z.string().url().optional(),
    cancel_url: z.string().url().optional(),
  }),
});

export const BillingCancelSchema = z.object({
  body: z.object({
    reason: z.string().optional(),
  }),
});

export const VerifyPaymentSchema = z.object({
  body: z.object({
    order_id: z.string().min(1),
    payment_id: z.string().min(1),
    signature: z.string().min(1),
  }),
});

export const AdminReviewTemplateSchema = z
  .object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      status: z.enum(["verified", "rejected"]),
      rejection_reason: z.string().max(500).optional(),
    }),
  })
  .superRefine((value, ctx) => {
    if (
      value.body.status === "rejected" &&
      !value.body.rejection_reason?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body", "rejection_reason"],
        message: "A rejection reason is required",
      });
    }
  });

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>["body"];
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>["body"];
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>["body"];
export type CreateGenerationInput = z.infer<typeof CreateGenerationSchema>["body"];
export type GenerateOutlineInput = z.infer<typeof GenerateOutlineSchema>["body"];
export type UpdateDocumentSectionInput = z.infer<
  typeof UpdateDocumentSectionSchema
>["body"];
export type CheckoutInput = z.infer<typeof CheckoutSchema>["body"];
