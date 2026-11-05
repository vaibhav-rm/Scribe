import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import {
  contentTablesForHeading,
  extractPlaceholderFields,
  extractTemplateLayout,
  renderTemplateDocument,
  type RenderSection,
} from "./docx-template.js";

const W_NS =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const A_NS =
  "http://schemas.openxmlformats.org/drawingml/2006/main";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function paragraph(style: string, text: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

function cell(text: string, runs?: string[]): string {
  const content = runs
    ? runs
        .map(
          (run) =>
            `<w:r><w:t xml:space="preserve">${run}</w:t></w:r>`,
        )
        .join("")
    : `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
  return `<w:tc><w:p>${content}</w:p></w:tc>`;
}

function row(cells: string[]): string {
  return `<w:tr>${cells.join("")}</w:tr>`;
}

function table(rows: string[]): string {
  return `<w:tbl>${rows.join("")}</w:tbl>`;
}

function templateXml(): string {
  const titleTable = table([
    row([cell("PROJECT SYNOPSIS")]),
    row([cell("Title of Project:"), cell("")]),
    row([cell("Student Name(s):"), cell("")]),
    row([cell("USN / Reg. No.:"), cell("")]),
  ]);

  const researchGapTable = table([
    row([
      cell("Reference"),
      cell("Key Contribution"),
      cell("Limitation / Research Gap"),
    ]),
    row([
      cell("[Author, Year]"),
      cell("[What the paper proposed]"),
      cell("[What it did NOT address]"),
    ]),
  ]);

  const phaseRows = [
    row([
      cell("Phase"),
      cell("Task to be completed"),
      cell("Activities involved"),
      cell("Duration"),
    ]),
    ...["I", "II", "III", "IV"].map((phase) =>
      row([
        cell(phase),
        cell(`Task ${phase}`),
        cell(`Activities ${phase}`),
        cell("Weeks"),
      ]),
    ),
  ];
  const phaseTableOne = table(phaseRows);
  const phaseTableTwo = table([
    row([cell("V"), cell("Task V"), cell("Activities V"), cell("Weeks")]),
    row([cell("VI"), cell("Task VI"), cell("Activities VI"), cell("Weeks")]),
  ]);

  const declarationTable = table([
    row([
      cell("", ["Student Signature:[Name", " &amp; USN]Date:"]),
      cell("Guide Signature:[Dr./Prof. Name, Designation] Date:"),
    ]),
  ]);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}">
  <w:body>
    ${paragraph("Title", "Department of Computer Science")}
    ${titleTable}
    ${paragraph("Heading1", "Abstract")}
    ${paragraph("BodyText", "Guideline: Write 200-300 words.")}
    ${paragraph("BodyText", "[Write the abstract here]")}
    ${paragraph("BodyText", "Keywords: [5-7 relevant keywords]")}
    ${paragraph("Heading2", "Research Gap Summary")}
    ${paragraph("BodyText", "Guideline: Summarise the research gaps.")}
    ${researchGapTable}
    ${paragraph("Heading2", "System Architecture Overview")}
    ${paragraph("BodyText", "Guideline: insert a diagram.")}
    ${paragraph("BodyText", "[ INSERT SYSTEM ARCHITECTURE DIAGRAM / BLOCK DIAGRAM HERE ]Figure 1: Proposed System Architecture")}
    ${paragraph("Heading2", "Implementation Plan (Phase-wise)")}
    ${paragraph("BodyText", "Guideline: describe each phase.")}
    ${phaseTableOne}
    ${phaseTableTwo}
    ${paragraph("Heading1", "Declaration &amp; Signatures")}
    ${paragraph("BodyText", "I/We hereby declare that this synopsis is our original work.")}
    ${declarationTable}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:bottom="1440" w:left="1800" w:right="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

const validSections: RenderSection[] = [
  {
    id: "abstract",
    heading: "Abstract",
    content: "Generated abstract about a wearable BCI.",
  },
  {
    id: "gap",
    heading: "Research Gap Summary",
    content: "Generated research gap discussion.",
    tables: [
      {
        headers: [
          "Reference",
          "Key Contribution",
          "Limitation / Research Gap",
        ],
        rows: [
          ["Smith 2023", "Wearable EEG", "No real-time classification"],
          ["Lee 2024", "Low-cost hardware", "No mobility support"],
        ],
      },
    ],
  },
  {
    id: "architecture",
    heading: "System Architecture Overview",
    content: "Generated architecture explanation.",
  },
  {
    id: "plan",
    heading: "Implementation Plan (Phase-wise)",
    content: "Generated implementation plan.",
    tables: [
      {
        headers: [
          "Phase",
          "Task to be completed",
          "Activities involved",
          "Duration",
        ],
        rows: [
          ["I", "Literature review", "Survey prior work", "2 weeks"],
          ["II", "Dataset", "Collect EEG data", "3 weeks"],
          ["III", "Design", "Draw block diagram", "2 weeks"],
          ["IV", "Build", "Train the model", "6 weeks"],
          ["V", "Evaluate", "Measure accuracy", "2 weeks"],
          ["VI", "Document", "Write report", "3 weeks"],
        ],
      },
    ],
  },
  {
    id: "declaration",
    heading: "Declaration & Signatures",
    content: "THIS MUST NOT REPLACE THE TEMPLATE DECLARATION",
  },
];

async function buildTemplate(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W_NS}">
  <w:style w:type="paragraph" w:styleId="BodyText"><w:name w:val="Body Text"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style>
</w:styles>`,
  );
  zip.file("word/document.xml", templateXml());
  return Buffer.from(
    await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
  );
}

function parseDocument(xml: string): Document {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function textOf(element: Element): string {
  return Array.from(
    element.getElementsByTagNameNS(W_NS, "t"),
  )
    .map((node) => node.textContent ?? "")
    .join("");
}

function all(document: Document, local: string): Element[] {
  return Array.from(
    document.getElementsByTagNameNS(W_NS, local),
  ) as Element[];
}

function styleOf(paragraph: Element): string {
  return (
    paragraph
      .getElementsByTagNameNS(W_NS, "pStyle")[0]
      ?.getAttributeNS(W_NS, "val") ?? ""
  );
}

async function renderOutput(): Promise<{
  document: Document;
  zip: JSZip;
}> {
  const templateBuffer = await buildTemplate();
  const result = await renderTemplateDocument({
    templateBuffer,
    documentTitle: "Test Synopsis",
    sections: validSections,
    metadata: {
      projectTitle: "Wearable BCI",
      studentName: "Ada Lovelace",
      usn: "1RV00CS001",
      academicYear: "2026-27",
      keywords: ["Neural Networks", "BCI"],
    },
  });
  const zip = await JSZip.loadAsync(result.buffer);
  const xml = await zip.file("word/document.xml")!.async("string");
  return { document: parseDocument(xml), zip };
}

describe("template-preserving DOCX export", () => {
  it("extracts the real page layout and content table shells", async () => {
    const layout = await extractTemplateLayout(await buildTemplate());
    expect(layout.pageSize).toBe("A4");
    expect(layout.margins).toEqual({
      top: 1,
      bottom: 1,
      left: 1.25,
      right: 1,
    });
    expect(layout.headings.map((heading) => heading.text)).toContain(
      "Research Gap Summary",
    );
    expect(layout.headings.map((heading) => heading.text)).toContain(
      "Implementation Plan (Phase-wise)",
    );
    expect(layout.tables).toHaveLength(4);
    expect(layout.imagePlaceholders).toHaveLength(1);
    expect(layout.imagePlaceholders[0].sectionHeading).toBe(
      "System Architecture Overview",
    );
    expect(layout.imagePlaceholders[0].caption).toBe(
      "Figure 1: Proposed System Architecture",
    );

    const fields = await extractPlaceholderFields(await buildTemplate());
    expect(fields.map((field) => field.key)).toEqual(
      expect.arrayContaining(["project_title", "student_name", "usn"]),
    );
    expect(fields.every((field) => field.label.length > 0)).toBe(true);

    const gapTables = contentTablesForHeading(layout, "Research Gap Summary");
    expect(gapTables).toHaveLength(1);
    expect(gapTables[0].headers).toEqual([
      "Reference",
      "Key Contribution",
      "Limitation / Research Gap",
    ]);

    const planTables = contentTablesForHeading(
      layout,
      "Implementation Plan (Phase-wise)",
    );
    expect(planTables).toHaveLength(2);
  });

  it("keeps Word layout, removes guidance, fills tables, and reserves image space", async () => {
    const { document, zip } = await renderOutput();
    const xmlText = await zip.file("word/document.xml")!.async("string");
    const fullText = textOf(document.documentElement);

    // Page size and margins are still the template's values.
    expect(xmlText).toContain('w:left="1800"');
    expect(xmlText).toContain('w:w="11906"');
    expect(zip.file("word/styles.xml")).not.toBeNull();

    // Guidance and old placeholder paragraphs are gone.
    expect(fullText).not.toContain("Guideline:");
    expect(fullText).not.toContain("[Write the abstract here]");
    expect(fullText).toContain("Generated abstract about a wearable BCI.");
    expect(fullText).toContain("Keywords: Neural Networks, BCI");

    // Title page metadata was filled.
    expect(fullText).toContain("Wearable BCI");
    expect(fullText).toContain("Ada Lovelace");
    expect(fullText).toContain("1RV00CS001");

    // Research-gap table keeps its template header and gets generated rows.
    expect(fullText).toContain("Reference");
    expect(fullText).toContain("Smith 2023");
    expect(fullText).toContain("Lee 2024");
    expect(fullText).not.toContain("[Author, Year]");

    // Implementation rows are split across the two template tables.
    const phaseTables = all(document, "tbl").filter((table) =>
      textOf(table).includes("Task to be completed"),
    );
    expect(phaseTables).toHaveLength(1);
    expect(
      Array.from(
        phaseTables[0].getElementsByTagNameNS(W_NS, "tr"),
      ),
    ).toHaveLength(5);

    const continuation = all(document, "tbl").find(
      (table) =>
        textOf(table).includes("Evaluate") &&
        textOf(table).includes("Document"),
    );
    expect(continuation).toBeDefined();
    expect(
      Array.from(
        continuation!.getElementsByTagNameNS(W_NS, "tr"),
      ),
    ).toHaveLength(2);

    // The image placeholder becomes a fixed-height bordered image box plus caption.
    const imageTables = all(document, "tbl").filter(
      (table) => textOf(table).includes("Insert system architecture diagram"),
    );
    expect(imageTables).toHaveLength(1);
    const imageBoxXml = imageTables[0].ownerDocument
      ? new XMLSerializer().serializeToString(imageTables[0])
      : "";
    expect(imageBoxXml).toContain('w:val="2370"');
    expect(fullText).toContain("Figure 1: Proposed System Architecture");
    expect(fullText).not.toContain("INSERT SYSTEM ARCHITECTURE DIAGRAM");

    // Static declaration text is preserved, but the student name is filled in.
    expect(fullText).toContain(
      "I/We hereby declare that this synopsis is our original work.",
    );
    expect(fullText).not.toContain(
      "THIS MUST NOT REPLACE THE TEMPLATE DECLARATION",
    );
    expect(fullText).toContain("Ada Lovelace (1RV00CS001)");
    expect(fullText).toContain("Guide Signature:");

    // Headings keep their original styles.
    const abstractHeading = all(document, "p").find(
      (paragraph) => textOf(paragraph) === "Abstract",
    );
    expect(abstractHeading).toBeDefined();
    expect(styleOf(abstractHeading!)).toBe("Heading1");
  });

  it("embeds a generated figure and registers the DOCX media parts", async () => {
    const result = await renderTemplateDocument({
      templateBuffer: await buildTemplate(),
      documentTitle: "Test Synopsis",
      sections: validSections,
      metadata: { projectTitle: "Wearable BCI" },
      images: [
        {
          buffer: ONE_PIXEL_PNG,
          mimeType: "image/png",
          caption: "Figure 1: Generated system architecture",
          altText: "Generated system architecture diagram",
        },
      ],
    });

    const zip = await JSZip.loadAsync(result.buffer);
    const xml = await zip.file("word/document.xml")!.async("string");
    const document = parseDocument(xml);
    const fullText = textOf(document.documentElement);

    // The placeholder box is replaced by a real inline drawing.
    expect(
      Array.from(document.getElementsByTagNameNS(A_NS, "blip")),
    ).toHaveLength(1);
    expect(fullText).toContain("Figure 1: Generated system architecture");
    expect(fullText).not.toContain("Insert system architecture diagram");
    expect(
      all(document, "tbl").filter((table) =>
        textOf(table).includes("Insert system architecture diagram"),
      ),
    ).toHaveLength(0);

    // The image bytes, relationship, and content type are added to the ZIP.
    expect(zip.file("word/media/image1.png")).not.toBeNull();
    const relationships = await zip
      .file("word/_rels/document.xml.rels")!
      .async("string");
    expect(relationships).toContain("media/image1.png");
    expect(relationships).toContain("relationships/image");
    const contentTypes = await zip
      .file("[Content_Types].xml")!
      .async("string");
    expect(contentTypes).toContain('Extension="png"');
    expect(contentTypes).toContain("image/png");
  });
});
