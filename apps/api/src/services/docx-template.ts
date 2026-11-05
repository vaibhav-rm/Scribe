import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const W_NS =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_NS = "http://www.w3.org/XML/1998/namespace";
const XMLNS_NS = "http://www.w3.org/2000/xmlns/";
const WP_NS =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture";
const R_NS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export interface TemplateHeading {
  text: string;
  level: number;
}

export interface TemplateMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TemplateTableLayout {
  heading: string | null;
  headers: string[];
  rowLabels: string[];
  rows: string[][];
  columnCount: number;
}

export interface TemplateImagePlaceholder {
  /** Position in the template's render order. */
  index: number;
  caption: string;
  /** The original template instruction, useful as an image prompt. */
  prompt: string;
  sectionHeading: string | null;
}

export interface TemplatePlaceholderField {
  key: string;
  label: string;
  /** Exact bracket token in the template, when there is one. */
  placeholder: string;
  kind: "table-cell" | "inline";
}

export interface TemplateLayout {
  headings: TemplateHeading[];
  tables: TemplateTableLayout[];
  pageSize: string;
  margins: TemplateMargins;
  imagePlaceholders: TemplateImagePlaceholder[];
  placeholderFields: TemplatePlaceholderField[];
}

export interface GeneratedTable {
  headers: string[];
  rows: string[][];
}

export interface RenderSection {
  id: string;
  heading: string;
  content: string;
  tables?: GeneratedTable[];
  warnings?: string[];
}

export interface GeneratedImageAsset {
  index: number;
  storagePath: string;
  mimeType: string;
  caption?: string;
  altText?: string;
}

export interface RenderMetadata {
  projectTitle?: string;
  studentName?: string;
  usn?: string;
  academicYear?: string;
  keywords?: string[];
  semester?: string;
  semesterSection?: string;
  section?: string;
  labBatch?: string;
  dateOfSubmission?: string;
  guideName?: string;
  guideDesignation?: string;
  nameUsn?: string;
  guideNameDesignation?: string;
  department?: string;
  college?: string;
  course?: string;
  subject?: string;
  faculty?: string;
  /** Values the user supplied for template placeholder fields. */
  placeholderValues?: Record<string, string>;
  /** Images persisted for an edited document's next export. */
  generatedImages?: GeneratedImageAsset[];
  imageWarnings?: string[];
}

export interface RenderImage {
  buffer: Buffer;
  mimeType: string;
  caption?: string;
  altText?: string;
}

export interface RenderTemplateInput {
  templateBuffer: Buffer;
  documentTitle: string;
  sections: RenderSection[];
  metadata?: RenderMetadata;
  /**
   * Generated figures in the same order as `TemplateLayout.imagePlaceholders`.
   * A null entry keeps the visible template placeholder for that figure.
   */
  images?: Array<RenderImage | null>;
}

export interface RenderTemplateResult {
  buffer: Buffer;
  warnings: string[];
}

interface HeadingInfo extends TemplateHeading {
  index: number;
  normalized: string;
  section?: RenderSection;
}

interface MediaState {
  nextImageIndex: number;
  nextRelationshipId: number;
  nextDrawingId: number;
  files: Array<{ path: string; buffer: Buffer; mimeType: string }>;
  relationships: Array<{ id: string; target: string }>;
}

interface RenderContext {
  doc: Document;
  bodyParagraph: Element;
  listParagraph: Element | null;
  metadata: RenderMetadata;
  images: Array<RenderImage | null>;
  imageCursor: number;
  media: MediaState;
}

function localName(node: Node): string {
  return (node as Element).localName ?? node.nodeName.split(":").pop() ?? "";
}

function elementChildren(parent: Node): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1) out.push(node as Element);
  }
  return out;
}

function directChild(parent: Element, local: string): Element | null {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1 && localName(node) === local) {
      return node as Element;
    }
  }
  return null;
}

function directChildren(parent: Element, local: string): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1 && localName(node) === local) {
      out.push(node as Element);
    }
  }
  return out;
}

function allElements(parent: Element | Document, local: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS(W_NS, local)) as Element[];
}

function textOf(node: Element): string {
  return allElements(node, "t")
    .map((t) => t.textContent ?? "")
    .join("");
}

function styleId(paragraph: Element): string {
  const pPr = directChild(paragraph, "pPr");
  const style = pPr ? directChild(pPr, "pStyle") : null;
  return style?.getAttributeNS(W_NS, "val") ?? "";
}

function headingLevel(paragraph: Element): number | null {
  const style = styleId(paragraph);
  const match = style.match(/^heading\s*([1-6])$/i);
  if (match) return Number(match[1]);

  const pPr = directChild(paragraph, "pPr");
  const outline = pPr ? directChild(pPr, "outlineLvl") : null;
  const outlineVal = outline?.getAttributeNS(W_NS, "val");
  if (outlineVal !== null && outlineVal !== undefined) {
    const level = Number(outlineVal) + 1;
    if (level >= 1 && level <= 6) return level;
  }

  return null;
}

function normalizeHeading(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .toLowerCase()
    .replace(/^\s*(?:[0-9]{1,2}|[a-z])[.)]\s+/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlaceholderHeading(value: string): boolean {
  return /\[|e\.g\.|sub-theme|insert|write\b/i.test(value);
}

function isStaticSection(value: string): boolean {
  return /declaration|signature|appendix|formatting requirements|academic integrity|ieee format examples/i.test(
    value,
  );
}

function words(value: string): string[] {
  return normalizeHeading(value)
    .split(" ")
    .filter((word) => word.length > 2);
}

function similarity(a: string, b: string): number {
  const aw = new Set(words(a));
  const bw = new Set(words(b));
  if (aw.size === 0 || bw.size === 0) return 0;
  let intersection = 0;
  for (const word of aw) if (bw.has(word)) intersection++;
  return intersection / new Set([...aw, ...bw]).size;
}

function normalizeFieldLabel(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function fieldKeyForLabel(value: string): string {
  const normalized = normalizeFieldLabel(value);

  if (/project\s*(title|name)|title\s*of\s*(the\s*)?project/.test(normalized)) {
    return "project_title";
  }
  if (/name\s*(?:&|and)?\s*usn/.test(normalized)) {
    return "name_usn";
  }
  if (/student\s*name/.test(normalized)) {
    return "student_name";
  }
  if (/semester/.test(normalized) && /section/.test(normalized)) {
    return "semester_section";
  }
  if (/dr\.?\s*\/?\s*prof|guide.*designation|designation.*guide/.test(normalized)) {
    return "guide_name_designation";
  }
  if (/\busn\b|reg(?:istration)?\s*(?:no|number)/.test(normalized)) {
    return "usn";
  }
  if (/semester/.test(normalized)) return "semester";
  if (/section/.test(normalized)) return "section";
  if (/lab\s*batch/.test(normalized)) return "lab_batch";
  if (/date/.test(normalized)) return "date_of_submission";
  if (/guide\s*(?:name)?/.test(normalized)) return "guide_name";
  if (/designation/.test(normalized)) return "guide_designation";
  if (/academic\s*year/.test(normalized)) return "academic_year";
  if (/department/.test(normalized)) return "department";
  if (/college|institution/.test(normalized)) return "college";
  if (/course/.test(normalized)) return "course";
  if (/subject/.test(normalized)) return "subject";
  if (/faculty/.test(normalized)) return "faculty";

  return (
    normalized.replace(/\s+/g, "_").slice(0, 60) || "placeholder"
  );
}

function isContentPlaceholder(value: string): boolean {
  const normalized = normalizeFieldLabel(value);
  if (!normalized) return true;
  if (normalized.length > 80) return true;
  return /insert|write|diagram|figure|table|author|what the|describe|guideline|todo|tbd|placeholder|information not available|not available|task|activity|activities|duration|phase|reference|key contribution|limitation|research gap|e g|example/.test(
    normalized,
  );
}

function isPersonalFieldKey(key: string): boolean {
  return new Set([
    "project_title",
    "student_name",
    "usn",
    "name_usn",
    "semester",
    "semester_section",
    "section",
    "lab_batch",
    "date_of_submission",
    "guide_name",
    "guide_designation",
    "guide_name_designation",
    "academic_year",
    "department",
    "college",
    "course",
    "subject",
    "faculty",
  ]).has(key);
}

function placeholderTextForKey(key: string, label: string): string {
  switch (key) {
    case "project_title":
      return "[Project Title]";
    case "student_name":
      return "[Student Name(s)]";
    case "usn":
      return "[USN / Reg. No.]";
    case "name_usn":
      return "[Name & USN]";
    case "semester":
      return "[Semester]";
    case "semester_section":
      return "[Semester and Section]";
    case "section":
      return "[Section]";
    case "lab_batch":
      return "[Lab Batch]";
    case "date_of_submission":
      return "[Date of Submission]";
    case "guide_name":
      return "[Guide Name]";
    case "guide_designation":
      return "[Guide Designation]";
    case "guide_name_designation":
      return "[Dr./Prof. Name, Designation]";
    case "academic_year":
      return "[Academic Year]";
    case "department":
      return "[Department]";
    case "college":
      return "[College]";
    case "course":
      return "[Course]";
    case "subject":
      return "[Subject]";
    case "faculty":
      return "[Faculty]";
    default:
      return label ? `[${label}]` : "";
  }
}

function metadataValueForField(
  key: string,
  metadata: RenderMetadata,
): string | undefined {
  const supplied = metadata.placeholderValues?.[key];
  if (typeof supplied === "string" && supplied.trim()) {
    return supplied.trim();
  }

  switch (key) {
    case "project_title":
      return metadata.projectTitle;
    case "student_name":
      return metadata.studentName;
    case "usn":
      return metadata.usn;
    case "name_usn":
      return (
        metadata.nameUsn ||
        [metadata.studentName, metadata.usn ? `(${metadata.usn})` : ""]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        undefined
      );
    case "semester":
      return metadata.semester;
    case "semester_section":
      return (
        metadata.semesterSection ||
        [metadata.semester, metadata.section].filter(Boolean).join(" and ") ||
        undefined
      );
    case "section":
      return metadata.section;
    case "lab_batch":
      return metadata.labBatch;
    case "date_of_submission":
      return metadata.dateOfSubmission;
    case "guide_name":
      return metadata.guideName;
    case "guide_designation":
      return metadata.guideDesignation;
    case "guide_name_designation":
      return (
        metadata.guideNameDesignation ||
        [metadata.guideName, metadata.guideDesignation]
          .filter(Boolean)
          .join(", ") ||
        undefined
      );
    case "academic_year":
      return metadata.academicYear;
    case "department":
      return metadata.department;
    case "college":
      return metadata.college;
    case "course":
      return metadata.course;
    case "subject":
      return metadata.subject;
    case "faculty":
      return metadata.faculty;
    default:
      return undefined;
  }
}

/**
 * Find the personal / title-page values a template expects. Content
 * placeholders such as [Author, Year] are deliberately excluded because the
 * generator fills those from project sources.
 */
function collectPlaceholderFields(body: Element): TemplatePlaceholderField[] {
  const fields: TemplatePlaceholderField[] = [];
  const seen = new Set<string>();

  const add = (field: TemplatePlaceholderField) => {
    if (!field.key || seen.has(field.key)) {
      const existing = fields.find((entry) => entry.key === field.key);
      if (existing && !existing.placeholder && field.placeholder) {
        existing.placeholder = field.placeholder;
      }
      return;
    }
    seen.add(field.key);
    fields.push(field);
  };

  for (const table of allElements(body, "tbl")) {
    for (const row of directChildren(table, "tr")) {
      const cells = directChildren(row, "tc");
      if (cells.length < 2) continue;

      const label = textOf(cells[0])
        .replace(/\s+/g, " ")
        .trim()
        .replace(/:\s*$/, "");
      if (!label || label.length > 80) continue;
      if (/signature/i.test(label)) continue;
      if (isContentPlaceholder(label)) continue;

      const value = textOf(cells[1]).replace(/\s+/g, " ").trim();
      const token = value.match(/\[[^\]]{2,80}\]/)?.[0] ?? "";
      // Keep genuinely filled values as-is, but include empty cells and
      // partially broken bracket placeholders (some Word files split a
      // content control so only "[" survives in the text run).
      if (value && !token && !/^\[/.test(value)) continue;

      const key = fieldKeyForLabel(label);
      if (!isPersonalFieldKey(key)) continue;
      add({ key, label, placeholder: token, kind: "table-cell" });
    }
  }

  // Read whole paragraphs rather than individual runs: Word frequently splits
  // a placeholder such as "[Name & USN]" across several <w:t> nodes.
  for (const paragraph of allElements(body, "p")) {
    const text = textOf(paragraph);
    for (const match of text.matchAll(/\[[^\[\]]{2,80}\]/g)) {
      const token = match[0];
      const label = token.slice(1, -1).trim();
      if (isContentPlaceholder(label)) continue;
      const key = fieldKeyForLabel(label);
      if (!isPersonalFieldKey(key)) continue;
      add({ key, label, placeholder: token, kind: "inline" });
    }
  }

  return fields.slice(0, 20);
}

function isParagraph(node: Element): boolean {
  return localName(node) === "p";
}

function isTable(node: Element): boolean {
  return localName(node) === "tbl";
}

function hasDrawingOrShape(node: Element): boolean {
  return (
    allElements(node, "drawing").length > 0 ||
    allElements(node, "pict").length > 0 ||
    allElements(node, "AlternateContent").length > 0
  );
}

function hasSectionBreak(node: Element): boolean {
  if (!isParagraph(node)) return false;
  const pPr = directChild(node, "pPr");
  return !!pPr && !!directChild(pPr, "sectPr");
}

function isImagePlaceholder(node: Element): boolean {
  if (!isParagraph(node)) return false;
  const text = textOf(node);
  return (
    /\[\s*insert\s+[^\]]*(diagram|image)[^\]]*\]/i.test(text) ||
    /block\s+diagram\s+here/i.test(text)
  );
}

function isCaptionParagraph(node: Element): boolean {
  if (!isParagraph(node)) return false;
  return /^\s*(figure|table)\s+\d+/i.test(textOf(node));
}

function isKeywordsParagraph(node: Element): boolean {
  if (!isParagraph(node)) return false;
  return /^\s*keywords\s*:/i.test(textOf(node));
}

function isGuidanceParagraph(node: Element): boolean {
  if (!isParagraph(node)) return false;
  return /guideline\s*:|write\s+\d|length\s*:|cover\s*:|minimum\s+\d+\s+references/i.test(
    textOf(node),
  );
}

/**
 * Template guidance is often inside a floating Word text box that also holds
 * a decorative heading rule. Remove the text box and guidance runs while
 * keeping the rule, so the guidance disappears without losing the layout.
 */
function cleanGuidanceParagraph(node: Element): Element | null {
  let keptDrawing = false;
  for (const child of elementChildren(node)) {
    if (localName(child) === "pPr") continue;

    const hasTextBox = allElements(child, "txbxContent").length > 0;
    const childText = textOf(child).trim();
    const drawing = hasDrawingOrShape(child);

    if (hasTextBox || childText.length > 0) {
      node.removeChild(child);
    } else if (drawing) {
      keptDrawing = true;
    } else {
      node.removeChild(child);
    }
  }

  return keptDrawing ? node : null;
}

function setWAttr(element: Element, name: string, value: string): void {
  element.setAttributeNS(W_NS, `w:${name}`, value);
}

function makeW(doc: Document, name: string): Element {
  return doc.createElementNS(W_NS, `w:${name}`);
}

function setParagraphText(
  doc: Document,
  paragraph: Element,
  text: string,
): void {
  const pPr = directChild(paragraph, "pPr");
  const run =
    elementChildren(paragraph)
      .filter((child) => localName(child) === "r")
      .find((child) => !!directChild(child, "rPr")) ??
    elementChildren(paragraph).find((child) => localName(child) === "r");
  const rPr = run ? directChild(run, "rPr") : null;

  while (paragraph.firstChild) paragraph.removeChild(paragraph.firstChild);
  if (pPr) paragraph.appendChild(pPr);

  const newRun = makeW(doc, "r");
  if (rPr) newRun.appendChild(rPr.cloneNode(true) as Element);

  const lines = text.split("\n");
  lines.forEach((line, index) => {
    if (index > 0) newRun.appendChild(makeW(doc, "br"));
    const t = makeW(doc, "t");
    t.setAttributeNS(XML_NS, "xml:space", "preserve");
    t.appendChild(doc.createTextNode(line));
    newRun.appendChild(t);
  });

  paragraph.appendChild(newRun);
}

function setCellText(doc: Document, cell: Element, text: string): void {
  let paragraph = directChild(cell, "p");
  if (!paragraph) {
    paragraph = makeW(doc, "p");
    cell.appendChild(paragraph);
  }
  setParagraphText(doc, paragraph, text);
}

function findParagraphByStyle(
  children: Element[],
  style: string,
): Element | null {
  return (
    children.find(
      (node) => isParagraph(node) && styleId(node).toLowerCase() === style.toLowerCase(),
    ) ?? null
  );
}

/**
 * Pick a clean body paragraph to copy. The first BodyText paragraph in a
 * template is often a title-page spacer with a larger bold run, so prefer a
 * paragraph whose pPr contains only the style reference.
 */
function findBodyTemplate(children: Element[]): Element | null {
  const candidates = children.filter(
    (node) =>
      isParagraph(node) && styleId(node).toLowerCase() === "bodytext",
  );

  const simple = candidates.find((node) => {
    const pPr = directChild(node, "pPr");
    if (!pPr || directChild(pPr, "rPr")) return false;
    const properties = elementChildren(pPr);
    return (
      properties.length === 1 && localName(properties[0]) === "pStyle"
    );
  });
  if (simple) return simple;

  const clean = candidates.find(
    (node) =>
      !isGuidanceParagraph(node) &&
      !hasDrawingOrShape(node) &&
      textOf(node).trim().length > 0 &&
      !/^\s*\[/.test(textOf(node)),
  );
  return clean ?? candidates[0] ?? null;
}

function extractMargins(sectPr: Element | null): TemplateMargins {
  const defaults = { top: 1, bottom: 1, left: 1, right: 1 };
  if (!sectPr) return defaults;
  const pgMar = directChild(sectPr, "pgMar");
  if (!pgMar) return defaults;

  const twips = (name: string, fallback: number) => {
    const value = Number(pgMar.getAttributeNS(W_NS, name));
    return Number.isFinite(value) && value >= 0
      ? Math.round((value / 1440) * 100) / 100
      : fallback;
  };

  return {
    top: twips("top", defaults.top),
    bottom: twips("bottom", defaults.bottom),
    left: twips("left", defaults.left),
    right: twips("right", defaults.right),
  };
}

function extractPageSize(sectPr: Element | null): string {
  if (!sectPr) return "A4";
  const pgSz = directChild(sectPr, "pgSz");
  if (!pgSz) return "A4";
  const width = Number(pgSz.getAttributeNS(W_NS, "w"));
  const height = Number(pgSz.getAttributeNS(W_NS, "h"));
  if (!Number.isFinite(width) || !Number.isFinite(height)) return "A4";
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  // Letter is 12240 x 15840 twips; A4 is 11906 x 16838.
  if (Math.abs(shortSide - 12240) < 120 && Math.abs(longSide - 15840) < 120) {
    return "Letter";
  }
  return "A4";
}

function describeTable(
  table: Element,
  heading: string | null,
): TemplateTableLayout | null {
  const rows = directChildren(table, "tr");
  if (rows.length < 2) return null;

  const rowCells = rows.map((row) => directChildren(row, "tc"));
  const columnCount = Math.max(...rowCells.map((cells) => cells.length));
  if (columnCount < 2) return null;

  const cellTexts = (cells: Element[]) =>
    Array.from({ length: columnCount }, (_, index) =>
      cells[index] ? textOf(cells[index]).trim() : "",
    );

  const headers = cellTexts(rowCells[0]);
  const dataRows = rowCells.slice(1).map(cellTexts);

  return {
    heading,
    headers,
    rows: dataRows,
    rowLabels: dataRows.map((row) => row[0] ?? ""),
    columnCount,
  };
}

/**
 * Content tables are the ones the AI should populate. Title-page, signature,
 * and formatting-rules tables are part of the template shell and stay intact.
 */
export function isContentTableLayout(table: TemplateTableLayout): boolean {
  if (!table.heading) return false;

  const heading = table.heading.toLowerCase();
  if (
    /declaration|signature|formatting requirements|submission guidelines|academic integrity/i.test(
      heading,
    )
  ) {
    return false;
  }
  if (table.headers.some((header) => /^\s*parameter\s*$/i.test(header))) {
    return false;
  }
  if (table.rows.length === 0) return false;

  const hasPlaceholder = [...table.headers, ...table.rows.flat()].some(
    (cell) => cell.trim() === "" || /\[[^\]]+\]/.test(cell),
  );
  const contentHeading =
    /research gap|implementation plan|tools|technolog|deliverable|dataset|objective|outcome|evaluation|reference|comparison/i.test(
      heading,
    );

  return hasPlaceholder || contentHeading;
}

export async function extractTemplateLayout(
  buffer: Buffer,
): Promise<TemplateLayout> {
  const zip = await JSZip.loadAsync(buffer);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("Template is not a valid DOCX file");

  const doc = new DOMParser().parseFromString(
    await documentFile.async("string"),
    "application/xml",
  );
  const body = allElements(doc, "body")[0];
  if (!body) throw new Error("Template DOCX has no document body");

  const children = elementChildren(body);
  const headings: TemplateHeading[] = [];
  const tables: TemplateTableLayout[] = [];
  const imagePlaceholders: TemplateImagePlaceholder[] = [];
  let currentHeading: string | null = null;
  let currentSectionIsStatic = false;

  for (const child of children) {
    if (isParagraph(child)) {
      const level = headingLevel(child);
      if (level) {
        currentHeading = textOf(child).trim();
        currentSectionIsStatic = isStaticSection(currentHeading);
        headings.push({ text: currentHeading, level });
      } else if (
        currentHeading &&
        !currentSectionIsStatic &&
        isImagePlaceholder(child)
      ) {
        imagePlaceholders.push({
          index: imagePlaceholders.length,
          caption: imageCaption(
            textOf(child),
            imagePlaceholders.length + 1,
            currentHeading,
          ),
          prompt: textOf(child).trim(),
          sectionHeading: currentHeading,
        });
      }
    } else if (isTable(child)) {
      const table = describeTable(child, currentHeading);
      if (table) tables.push(table);
    }
  }

  const sectPr = directChild(body, "sectPr");
  return {
    headings,
    tables,
    pageSize: extractPageSize(sectPr),
    margins: extractMargins(sectPr),
    imagePlaceholders,
    placeholderFields: collectPlaceholderFields(body),
  };
}

export async function extractPlaceholderFields(
  buffer: Buffer,
): Promise<TemplatePlaceholderField[]> {
  const layout = await extractTemplateLayout(buffer);
  return layout.placeholderFields;
}

export function contentTablesForHeading(
  layout: TemplateLayout,
  heading: string,
): TemplateTableLayout[] {
  const normalized = normalizeHeading(heading);
  const exact = layout.tables.filter(
    (table) =>
      isContentTableLayout(table) &&
      table.heading &&
      normalizeHeading(table.heading) === normalized,
  );
  if (exact.length > 0) return exact;

  return layout.tables.filter((table) => {
    if (!isContentTableLayout(table) || !table.heading) return false;
    const tableHeading = normalizeHeading(table.heading);
    return (
      similarity(table.heading, heading) >= 0.55 ||
      (normalized.length >= 5 &&
        (tableHeading.includes(normalized) ||
          normalized.includes(tableHeading)))
    );
  });
}

function mapSections(
  headings: HeadingInfo[],
  sections: RenderSection[],
): void {
  const used = new Set<number>();

  const exactIndex = (heading: HeadingInfo, limit?: number): number => {
    const end = limit ?? sections.length;
    for (let i = 0; i < Math.min(end, sections.length); i++) {
      if (!used.has(i) && normalizeHeading(sections[i].heading) === heading.normalized) {
        return i;
      }
    }
    return -1;
  };

  for (let headingIndex = 0; headingIndex < headings.length; headingIndex++) {
    const heading = headings[headingIndex];

    // Prefer an exact heading match in the next few generated sections. This
    // keeps placeholder sub-theme headings aligned with A1-generated headings.
    let index = -1;
    const lookAhead = Math.min(sections.length, headingIndex + 6);
    index = exactIndex(heading, lookAhead);

    if (index < 0 && isPlaceholderHeading(heading.text)) {
      // Placeholder headings are replaced by the outline heading. Pick the
      // next unused section in document order, but never steal a section that
      // has its own real heading later in the template. Without this guard a
      // short outline can move "System Architecture" or "Declaration" into an
      // unrelated sub-theme placeholder.
      const candidate = sections.findIndex((_, i) => !used.has(i));
      if (candidate >= 0) {
        const candidateHeading = normalizeHeading(sections[candidate].heading);
        const hasOwnHeadingLater = headings
          .slice(headingIndex + 1)
          .some((later) => later.normalized === candidateHeading);
        if (!hasOwnHeadingLater) index = candidate;
      }
    }

    if (index < 0) {
      let best = -1;
      let bestScore = 0;
      for (let i = 0; i < sections.length; i++) {
        if (used.has(i)) continue;
        const score = similarity(heading.text, sections[i].heading);
        if (score > bestScore) {
          best = i;
          bestScore = score;
        }
      }
      if (bestScore >= 0.55) index = best;
    }

    if (index >= 0) {
      used.add(index);
      heading.section = sections[index];
    }
  }
}

function splitContent(content: string): string[] {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const paragraphs: string[] = [];
  for (const block of blocks) {
    const lines = block
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length > 1) {
      paragraphs.push(...lines);
      continue;
    }

    // Models often emit "1. ... 2. ..." as one paragraph. Split numbered
    // list items so they are readable in Word.
    const numbered = block.split(/\s+(?=\d{1,2}[.)]\s)/);
    paragraphs.push(...numbered.map((line) => line.trim()).filter(Boolean));
  }
  return paragraphs;
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*(?:---|\*\*\*)\s*$/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function createContentParagraph(
  context: RenderContext,
  text: string,
): Element {
  const doc = context.doc;
  const trimmed = stripInlineMarkdown(text);
  const isList = /^\s*(?:[-*•]|\d{1,2}[.)])\s+/.test(trimmed);
  const source = isList && context.listParagraph
    ? context.listParagraph
    : context.bodyParagraph;

  const paragraph = makeW(doc, "p");
  const pPr = directChild(source, "pPr");
  if (pPr) {
    const cloned = pPr.cloneNode(true) as Element;
    for (const removable of ["numPr", "sectPr", "pageBreakBefore"]) {
      const child = directChild(cloned, removable);
      if (child) cloned.removeChild(child);
    }
    paragraph.appendChild(cloned);
  }

  const sourceRun = elementChildren(source).find(
    (child) => localName(child) === "r",
  );
  const rPr = sourceRun ? directChild(sourceRun, "rPr") : null;

  const run = makeW(doc, "r");
  if (rPr) run.appendChild(rPr.cloneNode(true) as Element);

  let output = trimmed;
  if (isList && !/^\s*\d{1,2}[.)]\s+/.test(output)) {
    output = `• ${output.replace(/^\s*[-*•]\s+/, "")}`;
  }

  const t = makeW(doc, "t");
  t.setAttributeNS(XML_NS, "xml:space", "preserve");
  t.appendChild(doc.createTextNode(output));
  run.appendChild(t);
  paragraph.appendChild(run);

  return paragraph;
}

function imageCaption(
  text: string,
  fallbackNumber = 1,
  sectionHeading?: string | null,
): string {
  const match = text.match(/figure\s+\d+\s*[:.]\s*[^\[]+/i);
  if (match) return match[0].trim().replace(/\s+/g, " ");

  const cleaned = text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned) return cleaned;

  return `Figure ${fallbackNumber}: ${sectionHeading?.trim() || "Project Figure"}`;
}

function detectImageMime(buffer: Buffer, fallback: string): string {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }
  return fallback || "image/png";
}

function imageDimensions(
  buffer: Buffer,
  mimeType: string,
): { width: number; height: number } {
  if (mimeType === "image/png" && buffer.length >= 24) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (mimeType === "image/jpeg" && buffer.length >= 4) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      if (offset + 4 > buffer.length) break;
      const length = buffer.readUInt16BE(offset + 2);
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return {
          width: buffer.readUInt16BE(offset + 7),
          height: buffer.readUInt16BE(offset + 5),
        };
      }
      offset += 2 + length;
    }
  }

  return { width: 1024, height: 576 };
}

function createDrawingElement(
  context: RenderContext,
  relId: string,
  width: number,
  height: number,
  altText: string,
): Element {
  const doc = context.doc;
  const drawing = makeW(doc, "drawing");
  const inline = doc.createElementNS(WP_NS, "wp:inline");
  for (const [name, value] of Object.entries({
    distT: "0",
    distB: "0",
    distL: "0",
    distR: "0",
  })) {
    inline.setAttribute(name, value);
  }

  const extent = doc.createElementNS(WP_NS, "wp:extent");
  extent.setAttribute("cx", String(width));
  extent.setAttribute("cy", String(height));
  inline.appendChild(extent);

  const effectExtent = doc.createElementNS(WP_NS, "wp:effectExtent");
  for (const [name, value] of Object.entries({
    l: "0",
    t: "0",
    r: "0",
    b: "0",
  })) {
    effectExtent.setAttribute(name, value);
  }
  inline.appendChild(effectExtent);

  const drawingId = context.media.nextDrawingId++;
  const docPr = doc.createElementNS(WP_NS, "wp:docPr");
  docPr.setAttribute("id", String(drawingId));
  docPr.setAttribute("name", `Generated figure ${drawingId}`);
  docPr.setAttribute("descr", altText);
  inline.appendChild(docPr);

  const framePr = doc.createElementNS(WP_NS, "wp:cNvGraphicFramePr");
  const locks = doc.createElementNS(A_NS, "a:graphicFrameLocks");
  locks.setAttribute("noChangeAspect", "1");
  framePr.appendChild(locks);
  inline.appendChild(framePr);

  const graphic = doc.createElementNS(A_NS, "a:graphic");
  const graphicData = doc.createElementNS(A_NS, "a:graphicData");
  graphicData.setAttribute(
    "uri",
    "http://schemas.openxmlformats.org/drawingml/2006/picture",
  );
  graphic.appendChild(graphicData);

  const picture = doc.createElementNS(PIC_NS, "pic:pic");
  const nvPicPr = doc.createElementNS(PIC_NS, "pic:nvPicPr");
  const cNvPr = doc.createElementNS(PIC_NS, "pic:cNvPr");
  cNvPr.setAttribute("id", String(drawingId));
  cNvPr.setAttribute("name", `Generated figure ${drawingId}`);
  cNvPr.setAttribute("descr", altText);
  nvPicPr.appendChild(cNvPr);
  nvPicPr.appendChild(doc.createElementNS(PIC_NS, "pic:cNvPicPr"));
  picture.appendChild(nvPicPr);

  const blipFill = doc.createElementNS(PIC_NS, "pic:blipFill");
  const blip = doc.createElementNS(A_NS, "a:blip");
  blip.setAttributeNS(R_NS, "r:embed", relId);
  blipFill.appendChild(blip);
  const stretch = doc.createElementNS(A_NS, "a:stretch");
  stretch.appendChild(doc.createElementNS(A_NS, "a:fillRect"));
  blipFill.appendChild(stretch);
  picture.appendChild(blipFill);

  const spPr = doc.createElementNS(PIC_NS, "pic:spPr");
  const xfrm = doc.createElementNS(A_NS, "a:xfrm");
  const off = doc.createElementNS(A_NS, "a:off");
  off.setAttribute("x", "0");
  off.setAttribute("y", "0");
  xfrm.appendChild(off);
  const ext = doc.createElementNS(A_NS, "a:ext");
  ext.setAttribute("cx", String(width));
  ext.setAttribute("cy", String(height));
  xfrm.appendChild(ext);
  spPr.appendChild(xfrm);
  const prstGeom = doc.createElementNS(A_NS, "a:prstGeom");
  prstGeom.setAttribute("prst", "rect");
  prstGeom.appendChild(doc.createElementNS(A_NS, "a:avLst"));
  spPr.appendChild(prstGeom);
  picture.appendChild(spPr);

  graphicData.appendChild(picture);
  inline.appendChild(graphic);
  drawing.appendChild(inline);
  return drawing;
}

function registerImageMedia(
  context: RenderContext,
  image: RenderImage,
): { relId: string; width: number; height: number; mimeType: string } {
  const mimeType = detectImageMime(image.buffer, image.mimeType);
  const extension =
    mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1] || "png";

  let imageIndex = context.media.nextImageIndex++;
  let path = `word/media/image${imageIndex}.${extension}`;
  while (context.media.files.some((file) => file.path === path)) {
    imageIndex = context.media.nextImageIndex++;
    path = `word/media/image${imageIndex}.${extension}`;
  }

  const relId = `rId${context.media.nextRelationshipId++}`;
  context.media.files.push({ path, buffer: image.buffer, mimeType });
  context.media.relationships.push({
    id: relId,
    target: `media/image${imageIndex}.${extension}`,
  });

  const dimensions = imageDimensions(image.buffer, mimeType);
  const maxWidth = 5_500_000;
  const maxHeight = 4_000_000;
  const scale = Math.min(
    maxWidth / Math.max(1, dimensions.width),
    maxHeight / Math.max(1, dimensions.height),
  );

  return {
    relId,
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale)),
    mimeType,
  };
}

function createImageParagraph(
  context: RenderContext,
  placeholder: Element,
  image: RenderImage,
  altText: string,
): Element {
  const doc = context.doc;
  const paragraph = makeW(doc, "p");
  const sourcePPr = directChild(placeholder, "pPr");
  if (sourcePPr) {
    const cloned = sourcePPr.cloneNode(true) as Element;
    for (const removable of ["numPr", "sectPr", "pageBreakBefore"]) {
      const child = directChild(cloned, removable);
      if (child) cloned.removeChild(child);
    }
    const existingJc = directChild(cloned, "jc");
    if (existingJc) cloned.removeChild(existingJc);
    const jc = makeW(doc, "jc");
    setWAttr(jc, "val", "center");
    cloned.appendChild(jc);
    paragraph.appendChild(cloned);
  } else {
    const pPr = makeW(doc, "pPr");
    const jc = makeW(doc, "jc");
    setWAttr(jc, "val", "center");
    pPr.appendChild(jc);
    paragraph.appendChild(pPr);
  }

  const media = registerImageMedia(context, image);
  const run = makeW(doc, "r");
  run.appendChild(
    createDrawingElement(
      context,
      media.relId,
      media.width,
      media.height,
      altText,
    ),
  );
  paragraph.appendChild(run);
  return paragraph;
}

function createCaptionParagraph(
  context: RenderContext,
  placeholder: Element,
  caption: string,
): Element {
  const doc = context.doc;
  const captionP = makeW(doc, "p");
  const sourcePPr = directChild(placeholder, "pPr");
  if (sourcePPr) {
    const cloned = sourcePPr.cloneNode(true) as Element;
    for (const removable of ["numPr", "sectPr"]) {
      const child = directChild(cloned, removable);
      if (child) cloned.removeChild(child);
    }
    const captionJc = directChild(cloned, "jc");
    if (captionJc) cloned.removeChild(captionJc);
    const jcCaption = makeW(doc, "jc");
    setWAttr(jcCaption, "val", "center");
    cloned.appendChild(jcCaption);
    const spacing = directChild(cloned, "spacing");
    if (spacing) cloned.removeChild(spacing);
    const spacingNew = makeW(doc, "spacing");
    setWAttr(spacingNew, "before", "100");
    setWAttr(spacingNew, "after", "200");
    cloned.appendChild(spacingNew);
    captionP.appendChild(cloned);
  }

  const captionRun = makeW(doc, "r");
  const captionRPr = makeW(doc, "rPr");
  const captionItalics = makeW(doc, "i");
  captionRPr.appendChild(captionItalics);
  const captionSize = makeW(doc, "sz");
  setWAttr(captionSize, "val", "20");
  captionRPr.appendChild(captionSize);
  captionRun.appendChild(captionRPr);
  const captionText = makeW(doc, "t");
  captionText.setAttributeNS(XML_NS, "xml:space", "preserve");
  captionText.appendChild(doc.createTextNode(caption));
  captionRun.appendChild(captionText);
  captionP.appendChild(captionRun);
  return captionP;
}

function createPlaceholderBox(context: RenderContext): Element {
  const doc = context.doc;
  const table = makeW(doc, "tbl");

  const tblPr = makeW(doc, "tblPr");
  const tblW = makeW(doc, "tblW");
  setWAttr(tblW, "w", "5000");
  setWAttr(tblW, "type", "pct");
  tblPr.appendChild(tblW);

  const jc = makeW(doc, "jc");
  setWAttr(jc, "val", "center");
  tblPr.appendChild(jc);

  const borders = makeW(doc, "tblBorders");
  for (const side of ["top", "left", "bottom", "right", "insideH", "insideV"]) {
    const border = makeW(doc, side);
    setWAttr(border, "val", "dashed");
    setWAttr(border, "sz", "4");
    setWAttr(border, "space", "0");
    setWAttr(border, "color", "A6A6A6");
    borders.appendChild(border);
  }
  tblPr.appendChild(borders);

  const layout = makeW(doc, "tblLayout");
  setWAttr(layout, "type", "fixed");
  tblPr.appendChild(layout);
  table.appendChild(tblPr);

  const grid = makeW(doc, "tblGrid");
  const gridCol = makeW(doc, "gridCol");
  setWAttr(gridCol, "w", "8660");
  grid.appendChild(gridCol);
  table.appendChild(grid);

  const row = makeW(doc, "tr");
  const trPr = makeW(doc, "trPr");
  const trHeight = makeW(doc, "trHeight");
  setWAttr(trHeight, "val", "2370");
  setWAttr(trHeight, "hRule", "atLeast");
  trPr.appendChild(trHeight);
  const cantSplit = makeW(doc, "cantSplit");
  trPr.appendChild(cantSplit);
  row.appendChild(trPr);

  const cell = makeW(doc, "tc");
  const tcPr = makeW(doc, "tcPr");
  const tcW = makeW(doc, "tcW");
  setWAttr(tcW, "w", "8660");
  setWAttr(tcW, "type", "dxa");
  tcPr.appendChild(tcW);
  const vAlign = makeW(doc, "vAlign");
  setWAttr(vAlign, "val", "center");
  tcPr.appendChild(vAlign);
  const shading = makeW(doc, "shd");
  setWAttr(shading, "val", "clear");
  setWAttr(shading, "color", "auto");
  setWAttr(shading, "fill", "FCFDFD");
  tcPr.appendChild(shading);
  cell.appendChild(tcPr);

  const p = makeW(doc, "p");
  const pPr = makeW(doc, "pPr");
  const pJc = makeW(doc, "jc");
  setWAttr(pJc, "val", "center");
  pPr.appendChild(pJc);
  p.appendChild(pPr);
  const r = makeW(doc, "r");
  const rPr = makeW(doc, "rPr");
  const color = makeW(doc, "color");
  setWAttr(color, "val", "808080");
  rPr.appendChild(color);
  const italics = makeW(doc, "i");
  rPr.appendChild(italics);
  const size = makeW(doc, "sz");
  setWAttr(size, "val", "18");
  rPr.appendChild(size);
  r.appendChild(rPr);
  const t = makeW(doc, "t");
  t.setAttributeNS(XML_NS, "xml:space", "preserve");
  t.appendChild(doc.createTextNode("[Insert system architecture diagram here]"));
  r.appendChild(t);
  p.appendChild(r);
  cell.appendChild(p);
  row.appendChild(cell);
  table.appendChild(row);

  return table;
}

function createImageSpace(
  context: RenderContext,
  placeholder: Element,
  image: RenderImage | null,
): Element[] {
  const caption =
    image?.caption?.trim() ||
    imageCaption(
      textOf(placeholder),
      context.imageCursor,
      context.metadata.projectTitle,
    );

  if (image) {
    return [
      createImageParagraph(
        context,
        placeholder,
        image,
        image.altText || caption,
      ),
      createCaptionParagraph(context, placeholder, caption),
    ];
  }

  return [
    createPlaceholderBox(context),
    createCaptionParagraph(context, placeholder, caption),
  ];
}

function rowsForTables(
  generated: GeneratedTable[],
  capacities: number[],
): string[][][] {
  const tableCount = capacities.length;
  if (tableCount === 0) return [];

  const directTables =
    generated.length >= tableCount &&
    generated.slice(0, tableCount).every((table) => table.rows.length > 0);
  if (directTables) {
    return capacities.map(
      (_, index) => generated[index]?.rows?.map((row) => [...row]) ?? [],
    );
  }

  const allRows = generated.flatMap((table) =>
    table.rows.map((row) => [...row]),
  );
  if (allRows.length === 0) {
    return capacities.map(() => []);
  }

  // Keep the template's original page-split proportions. For example, a
  // phase table split 4 + 2 rows stays close to that split rather than being
  // divided evenly.
  const totalCapacity = capacities.reduce((sum, value) => sum + value, 0) || 1;
  const output: string[][][] = [];
  let cursor = 0;
  for (let index = 0; index < tableCount; index++) {
    const remainingTables = tableCount - index - 1;
    const remainingRows = allRows.length - cursor;
    let take: number;
    if (remainingTables === 0) {
      take = remainingRows;
    } else {
      const share = Math.round(
        (allRows.length * (capacities[index] || 1)) / totalCapacity,
      );
      take = Math.max(0, Math.min(remainingRows - remainingTables, share));
    }
    output.push(allRows.slice(cursor, cursor + take));
    cursor += take;
  }
  return output;
}

function isHeaderRow(row: Element): boolean {
  const cells = directChildren(row, "tc");
  const firstCell = cells[0] ? textOf(cells[0]).trim() : "";
  if (/^(?:phase\s*)?(?:[IVXLC]+|\d+)\b/i.test(firstCell)) return false;

  const text = cells
    .map((cell) => textOf(cell))
    .join(" ")
    .toLowerCase();
  if (/\[author|what the paper|what it did/.test(text)) return false;
  return /reference|key contribution|limitation|phase|task|activity|category|tools|deliverable|timeline|parameter|specification/.test(
    text,
  );
}

function tableDataCapacity(table: Element): number {
  const rows = directChildren(table, "tr");
  if (rows.length === 0) return 0;
  return isHeaderRow(rows[0]) ? Math.max(0, rows.length - 1) : rows.length;
}

function fillTemplateTable(
  context: RenderContext,
  table: Element,
  rows: string[][] | null,
): void {
  if (!rows || rows.length === 0) return;

  const tableRows = directChildren(table, "tr");
  if (tableRows.length === 0) return;

  const headerRow = isHeaderRow(tableRows[0]) ? tableRows[0] : null;
  const dataRows = headerRow ? tableRows.slice(1) : tableRows;
  if (dataRows.length === 0) return;

  const columnCount = Math.max(
    1,
    directChildren(tableRows[0], "tc").length,
  );
  const dataRowTemplate = dataRows[0].cloneNode(true) as Element;

  for (const row of dataRows) {
    table.removeChild(row);
  }

  for (const rowData of rows) {
    const row = dataRowTemplate.cloneNode(true) as Element;
    const cells = directChildren(row, "tc");
    for (let index = 0; index < columnCount; index++) {
      if (cells[index]) {
        setCellText(
          context.doc,
          cells[index],
          stripInlineMarkdown(rowData[index] ?? ""),
        );
      }
    }
    table.appendChild(row);
  }
}

function renderRegion(
  region: Element[],
  section: RenderSection,
  context: RenderContext,
): Element[] {
  const output: Element[] = [];

  for (const paragraph of splitContent(section.content)) {
    output.push(createContentParagraph(context, paragraph));
  }

  const tableElements = region.filter(isTable);
  const tableRows = rowsForTables(
    section.tables ?? [],
    tableElements.map(tableDataCapacity),
  );
  let tableIndex = 0;

  for (const element of region) {
    if (isTable(element)) {
      fillTemplateTable(context, element, tableRows[tableIndex] ?? null);
      tableIndex++;
      output.push(element);
    } else if (isImagePlaceholder(element)) {
      const image = context.images[context.imageCursor] ?? null;
      context.imageCursor++;
      output.push(...createImageSpace(context, element, image));
    } else if (isGuidanceParagraph(element)) {
      const cleaned = cleanGuidanceParagraph(element);
      if (cleaned) output.push(cleaned);
    } else if (hasDrawingOrShape(element)) {
      output.push(element);
    } else if (isCaptionParagraph(element)) {
      output.push(element);
    } else if (hasSectionBreak(element)) {
      output.push(element);
    } else if (isKeywordsParagraph(element)) {
      const keywords = context.metadata.keywords ?? [];
      if (keywords.length > 0) {
        setParagraphText(
          context.doc,
          element,
          `Keywords: ${keywords.join(", ")}`,
        );
      }
      output.push(element);
    }
    // Remaining body paragraphs are template guidance and placeholders.
  }

  return output;
}

function fillTitlePage(
  children: Element[],
  metadata: RenderMetadata,
): void {
  const firstHeading = children.findIndex((child) => headingLevel(child) !== null);
  const beforeFirstHeading =
    firstHeading >= 0 ? children.slice(0, firstHeading) : children;

  for (const table of beforeFirstHeading.filter(isTable)) {
    const doc = table.ownerDocument as Document;
    for (const row of directChildren(table, "tr")) {
      const cells = directChildren(row, "tc");
      if (cells.length < 2) continue;

      const label = textOf(cells[0])
        .replace(/\s+/g, " ")
        .trim()
        .replace(/:\s*$/, "");
      if (!label) continue;

      const key = fieldKeyForLabel(label);
      if (!isPersonalFieldKey(key)) continue;

      const value = metadataValueForField(key, metadata);
      const current = textOf(cells[1]).trim();
      if (value) {
        setCellText(doc, cells[1], value);
      } else if (!current || /^\[/.test(current)) {
        const placeholder = placeholderTextForKey(key, label);
        if (placeholder) setCellText(doc, cells[1], placeholder);
      }
    }
  }

  if (metadata.academicYear) {
    for (const paragraph of beforeFirstHeading.filter(isParagraph)) {
      if (/academic\s+year/i.test(textOf(paragraph))) {
        setParagraphText(
          paragraph.ownerDocument as Document,
          paragraph,
          `Academic Year: ${metadata.academicYear}`,
        );
      }
    }
  }
}

function replaceTextInElement(
  element: Element,
  search: string,
  replacement: string,
): boolean {
  const nodes = allElements(element, "t");
  const fullText = nodes.map((node) => node.textContent ?? "").join("");
  const searchStart = fullText.indexOf(search);
  if (searchStart < 0) return false;
  const searchEnd = searchStart + search.length;

  let offset = 0;
  let inserted = false;
  for (const node of nodes) {
    const value = node.textContent ?? "";
    const nodeStart = offset;
    const nodeEnd = offset + value.length;
    offset = nodeEnd;

    if (nodeEnd <= searchStart || nodeStart >= searchEnd) continue;

    const localStart = Math.max(0, searchStart - nodeStart);
    const localEnd = Math.min(value.length, searchEnd - nodeStart);
    const before = value.slice(0, localStart);
    const after = value.slice(localEnd);
    const insertedText = inserted ? "" : replacement;
    inserted = true;
    node.textContent = `${before}${insertedText}${after}`;
  }

  return true;
}

function replaceAllTextInElement(
  element: Element,
  search: string,
  replacement: string,
): boolean {
  let replaced = false;
  for (let guard = 0; guard < 20; guard++) {
    if (!replaceTextInElement(element, search, replacement)) break;
    replaced = true;
  }
  return replaced;
}

function replacePlaceholdersInTables(
  body: Element,
  metadata: RenderMetadata,
): void {
  for (const field of collectPlaceholderFields(body)) {
    if (!field.placeholder) continue;
    const value = metadataValueForField(field.key, metadata);
    if (!value) continue;
    replaceAllTextInElement(body, field.placeholder, value);
  }
}

function ensureDrawingNamespaces(doc: Document): void {
  const root = doc.documentElement;
  const namespaces: Record<string, string> = {
    wp: WP_NS,
    a: A_NS,
    pic: PIC_NS,
    r: R_NS,
  };
  for (const [prefix, namespace] of Object.entries(namespaces)) {
    if (!root.hasAttributeNS(XMLNS_NS, prefix)) {
      root.setAttributeNS(XMLNS_NS, `xmlns:${prefix}`, namespace);
    }
  }
}

async function createMediaState(
  zip: JSZip,
  doc: Document,
): Promise<MediaState> {
  let maxImageIndex = 0;
  for (const name of Object.keys(zip.files)) {
    const match = name.match(/^word\/media\/image(\d+)\./i);
    if (match) maxImageIndex = Math.max(maxImageIndex, Number(match[1]));
  }

  let maxRelationshipId = 0;
  const relationshipsFile = zip.file("word/_rels/document.xml.rels");
  if (relationshipsFile) {
    const relationships = await relationshipsFile.async("string");
    for (const match of relationships.matchAll(/Id="rId(\d+)"/g)) {
      maxRelationshipId = Math.max(maxRelationshipId, Number(match[1]));
    }
  }

  let maxDrawingId = 0;
  const drawingNodes = Array.from(
    doc.getElementsByTagNameNS(WP_NS, "docPr"),
  );
  for (const node of drawingNodes) {
    const id = Number(node.getAttribute("id"));
    if (Number.isFinite(id)) maxDrawingId = Math.max(maxDrawingId, id);
  }

  return {
    nextImageIndex: maxImageIndex + 1,
    nextRelationshipId: maxRelationshipId + 1,
    nextDrawingId: maxDrawingId + 1,
    files: [],
    relationships: [],
  };
}

async function writeMediaToZip(
  zip: JSZip,
  media: MediaState,
): Promise<void> {
  if (media.files.length === 0) return;

  for (const file of media.files) {
    zip.file(file.path, file.buffer);
  }

  const relationshipType =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
  const additions = media.relationships
    .map(
      (relationship) =>
        `<Relationship Id="${relationship.id}" Type="${relationshipType}" Target="${relationship.target}"/>`,
    )
    .join("");

  const relationshipsFile = zip.file("word/_rels/document.xml.rels");
  const relationships = relationshipsFile
    ? await relationshipsFile.async("string")
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  zip.file(
    "word/_rels/document.xml.rels",
    relationships.replace(/<\/Relationships>\s*$/, `${additions}</Relationships>`),
  );

  const contentTypesFile = zip.file("[Content_Types].xml");
  if (contentTypesFile) {
    let contentTypes = await contentTypesFile.async("string");
    const byExtension = new Map<string, string>();
    for (const file of media.files) {
      const extension = file.path.split(".").pop()?.toLowerCase();
      if (extension) byExtension.set(extension, file.mimeType);
    }
    for (const [extension, mimeType] of byExtension) {
      const hasDefault = new RegExp(
        `<Default[^>]*Extension=["']${extension}["']`,
        "i",
      ).test(contentTypes);
      if (!hasDefault) {
        contentTypes = contentTypes.replace(
          /<\/Types>\s*$/,
          `<Default Extension="${extension}" ContentType="${mimeType}"/></Types>`,
        );
      }
    }
    zip.file("[Content_Types].xml", contentTypes);
  }
}

export async function renderTemplateDocument(
  input: RenderTemplateInput,
): Promise<RenderTemplateResult> {
  const warnings: string[] = [];
  const zip = await JSZip.loadAsync(input.templateBuffer);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("Template is not a valid DOCX file");

  const doc = new DOMParser().parseFromString(
    await documentFile.async("string"),
    "application/xml",
  );
  const body = allElements(doc, "body")[0];
  if (!body) throw new Error("Template DOCX has no document body");

  ensureDrawingNamespaces(doc);
  const media = await createMediaState(zip, doc);

  const children = elementChildren(body);
  fillTitlePage(children, input.metadata ?? {});

  const headings: HeadingInfo[] = children
    .map((child, index) => {
      const level = headingLevel(child);
      if (!level) return null;
      const text = textOf(child).trim();
      if (!text) return null;
      return {
        text,
        level,
        index,
        normalized: normalizeHeading(text),
      } satisfies HeadingInfo;
    })
    .filter((heading): heading is HeadingInfo => heading !== null);

  if (headings.length === 0) {
    warnings.push("Template has no recognizable headings; used template as-is.");
  }

  mapSections(headings, input.sections);

  const bodyParagraph =
    findBodyTemplate(children) ??
    findParagraphByStyle(children, "Normal") ??
    children.find((child) => isParagraph(child) && !headingLevel(child) && textOf(child).trim());
  const listParagraph = findParagraphByStyle(children, "ListParagraph");

  if (!bodyParagraph) {
    throw new Error("Template has no body paragraph style to copy");
  }

  const context: RenderContext = {
    doc,
    bodyParagraph,
    listParagraph,
    metadata: input.metadata ?? {},
    images: input.images ?? [],
    imageCursor: 0,
    media,
  };

  const mapped = new Set<RenderSection>();
  for (const heading of headings) {
    if (heading.section) mapped.add(heading.section);
  }
  for (const section of input.sections) {
    if (!mapped.has(section)) {
      warnings.push(`No matching template heading for "${section.heading}"`);
    }
  }

  const rebuilt: Element[] = [];
  let cursor = 0;
  for (let headingIndex = 0; headingIndex < headings.length; headingIndex++) {
    const heading = headings[headingIndex];
    while (cursor < heading.index) {
      rebuilt.push(children[cursor]);
      cursor++;
    }

    const headingElement = children[heading.index];
    const section = heading.section;

    if (section && !isStaticSection(heading.text)) {
      if (isPlaceholderHeading(heading.text)) {
        setParagraphText(doc, headingElement, section.heading);
      }
      rebuilt.push(headingElement);

      const nextHeading = headings[headingIndex + 1];
      const regionEnd = nextHeading ? nextHeading.index : children.length;
      const region = children.slice(heading.index + 1, regionEnd);
      rebuilt.push(...renderRegion(region, section, context));
      cursor = regionEnd;
    } else {
      const staticSection = isStaticSection(heading.text);
      if (!isPlaceholderHeading(heading.text) || staticSection) {
        rebuilt.push(headingElement);
      }

      if (staticSection) {
        cursor = heading.index + 1;
      } else {
        // No generated section matched this template heading. Keep the
        // layout, tables, and figures, but drop the template's guidance text.
        const nextHeading = headings[headingIndex + 1];
        const regionEnd = nextHeading ? nextHeading.index : children.length;
        rebuilt.push(
          ...renderRegion(
            children.slice(heading.index + 1, regionEnd),
            { id: "", heading: heading.text, content: "", tables: [] },
            context,
          ),
        );
        cursor = regionEnd;
      }
    }
  }

  while (cursor < children.length) {
    rebuilt.push(children[cursor]);
    cursor++;
  }

  for (const child of children) {
    if (child.parentNode === body) body.removeChild(child);
  }
  for (const child of rebuilt) {
    body.appendChild(child);
  }

  replacePlaceholdersInTables(body, input.metadata ?? {});
  await writeMediaToZip(zip, media);

  const serialized = new XMLSerializer().serializeToString(doc);
  zip.file("word/document.xml", serialized);

  const coreFile = zip.file("docProps/core.xml");
  if (coreFile) {
    const core = await coreFile.async("string");
    const escapeXml = (value: string) =>
      value.replace(/[<>&'"]/g, (character) => {
        switch (character) {
          case "<":
            return "&lt;";
          case ">":
            return "&gt;";
          case "&":
            return "&amp;";
          case "'":
            return "&apos;";
          default:
            return "&quot;";
        }
      });
    zip.file(
      "docProps/core.xml",
      core.replace(
        /<dc:title>[\s\S]*?<\/dc:title>/,
        `<dc:title>${escapeXml(input.documentTitle)}</dc:title>`,
      ),
    );
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  return { buffer: Buffer.from(buffer), warnings };
}
