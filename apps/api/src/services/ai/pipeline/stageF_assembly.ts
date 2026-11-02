import { Packer, Paragraph, TextRun, Document, HeadingLevel } from "docx";

export interface StageFInput {
  documentTitle: string;
  sections: Array<{ id: string; heading: string; content: string; warnings?: string[] }>;
  templateSpec: Record<string, unknown>;
  outputFormat: "docx" | "pdf";
}

export interface Margins {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

/**
 * Stage F: Assemble validated content into a DOCX document using the docx
 * package, preserving template styles where possible.
 */
export async function assembleDocument(
  input: StageFInput,
): Promise<{ buffer: Buffer; warnings: string[] }> {
  const warnings: string[] = [];
  const spec = input.templateSpec || {};

  const pageSize = (spec.page_size ?? spec.pageSize ?? "A4") as string;
  const margins = (spec.margins ?? { top: 1, bottom: 1, left: 1, right: 1 }) as Margins;
  const fonts = (spec.fonts ?? { body: "Times New Roman", heading: "Arial" }) as Record<string, string>;

  const doc = new Document({
    title: input.documentTitle,
    sections: [{
      properties: {
        page: {
          size: getPageSize(pageSize),
          margin: {
            top: inchesToTwips(margins.top ?? 1),
            bottom: inchesToTwips(margins.bottom ?? 1),
            left: inchesToTwips(margins.left ?? 1),
            right: inchesToTwips(margins.right ?? 1),
          },
        },
      },
      children: [
        // Title paragraph
        new Paragraph({
          children: [new TextRun({ text: input.documentTitle, bold: true, size: 28 })],
          alignment: "center",
          spacing: { after: 200 },
        }),
        ...buildSections(input.sections, fonts),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return { buffer, warnings };
}

/**
 * Build document content paragraphs from sections.
 */
function buildSections(
  sections: Array<{ id: string; heading: string; content: string; warnings?: string[] }>,
  fonts: Record<string, string>,
): any[] {
  const children: any[] = [];

  for (const section of sections) {
    // Heading
    children.push(
      new Paragraph({
        children: [new TextRun({ text: section.heading, bold: true, size: 24 })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
      }),
    );

    // Content (split into paragraphs by double newlines)
    const paragraphs = section.content.split(/\n\n+/);
    for (const para of paragraphs) {
      if (para.trim()) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: para.trim(), font: fonts.body })],
            spacing: { after: 100 },
          }),
        );
      }
    }

    // Warnings as italic notes
    if (section.warnings?.length) {
      for (const w of section.warnings) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `[WARNING] ${w}`, italics: true, size: 20 })],
            spacing: { after: 100 },
          }),
        );
      }
    }
  }

  return children;
}

/**
 * Map page size string to docx package page dimensions (in twips).
 */
function getPageSize(size: string): { width: number; height: number; orientation?: "portrait" | "landscape" } {
  const sizes: Record<string, { width: number; height: number }> = {
    a4: { width: 11906, height: 16838 }, // twips (210mm x 297mm)
    letter: { width: 12240, height: 15840 },
  };
  const key = size.toLowerCase().replace(/\s/g, "");
  return sizes[key] ?? sizes.a4;
}

function inchesToTwips(inches: number): number {
  return Math.round(inches * 1440); // 1 inch = 1440 twips
}
