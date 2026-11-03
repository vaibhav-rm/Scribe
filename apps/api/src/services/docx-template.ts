import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const W_NS =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_NS = "http://www.w3.org/XML/1998/namespace";

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

export interface TemplateLayout {
  headings: TemplateHeading[];
  tables: TemplateTableLayout[];
  pageSize: string;
  margins: TemplateMargins;
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

export interface RenderMetadata {
  projectTitle?: string;
  studentName?: string;
  usn?: string;
  academicYear?: string;
  keywords?: string[];
}

export interface RenderTemplateInput {
  templateBuffer: Buffer;
  documentTitle: string;
  sections: RenderSection[];
  metadata?: RenderMetadata;
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

interface RenderContext {
  doc: Document;
  bodyParagraph: Element;
  listParagraph: Element | null;
  metadata: RenderMetadata;
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
  let currentHeading: string | null = null;

  for (const child of children) {
    if (isParagraph(child)) {
      const level = headingLevel(child);
      if (level) {
        currentHeading = textOf(child).trim();
        headings.push({ text: currentHeading, level });
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
  };
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
      // next unused section in document order.
      index = sections.findIndex((_, i) => !used.has(i));
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

function imageCaption(text: string): string {
  const match = text.match(/figure\s+\d+\s*[:.]\s*[^\[]+/i);
  if (match) return match[0].trim().replace(/\s+/g, " ");
  return "Figure 1: Proposed System Architecture";
}

function createImageSpace(
  context: RenderContext,
  placeholder: Element,
): Element[] {
  const doc = context.doc;
  const caption = imageCaption(textOf(placeholder));

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

  return [table, captionP];
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
      output.push(...createImageSpace(context, element));
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
  const beforeFirstHeading = firstHeading >= 0 ? children.slice(0, firstHeading) : children;
  const titleTable = beforeFirstHeading.find(isTable);
  if (!titleTable) return;

  for (const row of directChildren(titleTable, "tr")) {
    const cells = directChildren(row, "tc");
    if (cells.length < 2) continue;
    const label = textOf(cells[0]).toLowerCase();
    let value = "";
    if (label.includes("title")) value = metadata.projectTitle ?? "[Project Title]";
    else if (label.includes("student name")) {
      value = metadata.studentName ?? "[Student Name(s)]";
    } else if (label.includes("usn") || label.includes("reg.")) {
      value = metadata.usn ?? "[USN / Reg. No.]";
    } else if (label.includes("semester") || label.includes("section")) {
      value = "[Semester and Section]";
    } else if (label.includes("lab batch")) {
      value = "[Lab Batch]";
    } else if (label.includes("date")) {
      value = "[Date of Submission]";
    }
    if (value) setCellText(createDocumentProxy(cells[0]), cells[1], value);
  }

  if (metadata.academicYear) {
    for (const paragraph of beforeFirstHeading.filter(isParagraph)) {
      if (/academic\s+year/i.test(textOf(paragraph))) {
        setParagraphText(
          createDocumentProxy(paragraph),
          paragraph,
          `Academic Year: ${metadata.academicYear}`,
        );
      }
    }
  }
}

function createDocumentProxy(element: Element): Document {
  return element.ownerDocument as Document;
}

function replaceTextInElement(
  element: Element,
  search: string,
  replacement: string,
): void {
  const nodes = allElements(element, "t");
  const fullText = nodes.map((node) => node.textContent ?? "").join("");
  const searchStart = fullText.indexOf(search);
  if (searchStart < 0) return;
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
}

function replacePlaceholdersInTables(
  body: Element,
  metadata: RenderMetadata,
): void {
  for (const table of allElements(body, "tbl")) {
    for (const cell of allElements(table, "tc")) {
      const text = textOf(cell).trim();
      if (/\[name\s*&\s*usn\]/i.test(text)) {
        const student = metadata.studentName ?? "[Student Name]";
        const usn = metadata.usn ? ` (${metadata.usn})` : "";
        replaceTextInElement(cell, "[Name & USN]", `${student}${usn}`);
      }
      if (/\[usn\s*\/?\s*reg\.?\s*no\.?\]/i.test(text)) {
        replaceTextInElement(
          cell,
          "[USN / Reg. No.]",
          metadata.usn ?? "[USN / Reg. No.]",
        );
      }
    }
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
