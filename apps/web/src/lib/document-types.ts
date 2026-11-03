/**
 * Keep the UI's document-type options aligned with the shared backend
 * constants in packages/shared/src/constants.ts.
 */
export const DOCUMENT_TYPES = [
  { value: "project_synopsis", label: "Project Synopsis" },
  { value: "final_year_report", label: "Final Year Project Report" },
  { value: "srs", label: "Software Requirements Specification (SRS)" },
  { value: "system_design", label: "System Design Document" },
  { value: "project_proposal", label: "Project Proposal" },
  { value: "abstract", label: "Abstract" },
  { value: "literature_review", label: "Literature Review" },
  { value: "progress_report", label: "Progress Report" },
] as const;

export function documentTypeLabel(value: string): string {
  return DOCUMENT_TYPES.find((type) => type.value === value)?.label ?? value;
}
