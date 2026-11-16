import PDFDocument from "pdfkit";

export interface PdfColumn<Row> {
  header: string;
  /** Relative width; columns are scaled to fill the page width. */
  width: number;
  align?: "left" | "right" | "center";
  value: (row: Row) => string;
}

export interface PdfTableOptions<Row> {
  title: string;
  subtitle?: string;
  columns: PdfColumn<Row>[];
  rows: Row[];
  /** Optional summary lines printed under the table. */
  footerLines?: string[];
  headerColor?: string;
  landscape?: boolean;
}

const MARGIN = 36;
const FONT_SIZE = 8;
const HEADER_FONT_SIZE = 8;
const CELL_PADDING = 4;

/**
 * Renders a simple paginated table report. Uses the built-in Helvetica font,
 * which cannot draw "₱", so currency is written as "PHP".
 */
export function renderPdfTable<Row>(opts: PdfTableOptions<Row>): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    layout: opts.landscape ? "landscape" : "portrait",
    margin: MARGIN,
    bufferPages: true,
    info: { Title: opts.title, Author: "Tarabay-Mais System" },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const pageWidth = doc.page.width - MARGIN * 2;
  const totalWeight = opts.columns.reduce((sum, c) => sum + c.width, 0);
  const widths = opts.columns.map((c) => (c.width / totalWeight) * pageWidth);
  const headerColor = opts.headerColor ?? "#065F46";
  const bottomLimit = () => doc.page.height - MARGIN - 20;

  // ── Title block ──
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#14213d").text(opts.title);
  if (opts.subtitle) {
    doc.font("Helvetica").fontSize(9).fillColor("#4b5563").text(opts.subtitle);
  }
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#6b7280")
    .text(
      `Ginawa noong ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })} · ${opts.rows.length} record(s)`,
    );
  doc.moveDown(0.8);

  const rowHeight = (cells: string[], font: string, size: number) => {
    doc.font(font).fontSize(size);
    return (
      Math.max(
        ...cells.map((text, i) =>
          doc.heightOfString(text || " ", { width: (widths[i] ?? 0) - CELL_PADDING * 2 }),
        ),
      ) +
      CELL_PADDING * 2
    );
  };

  const drawRow = (
    cells: string[],
    y: number,
    height: number,
    style: { font: string; size: number; color: string; fill?: string },
  ) => {
    let x = MARGIN;
    if (style.fill) {
      doc.rect(MARGIN, y, pageWidth, height).fill(style.fill);
    }
    doc.font(style.font).fontSize(style.size).fillColor(style.color);
    cells.forEach((text, i) => {
      const w = widths[i] ?? 0;
      doc.text(text, x + CELL_PADDING, y + CELL_PADDING, {
        width: w - CELL_PADDING * 2,
        align: opts.columns[i]?.align ?? "left",
      });
      x += w;
    });
    doc
      .moveTo(MARGIN, y + height)
      .lineTo(MARGIN + pageWidth, y + height)
      .lineWidth(0.5)
      .strokeColor("#dde3d8")
      .stroke();
  };

  const headers = opts.columns.map((c) => c.header);
  const drawHeader = () => {
    const h = rowHeight(headers, "Helvetica-Bold", HEADER_FONT_SIZE);
    const y = doc.y;
    drawRow(headers, y, h, {
      font: "Helvetica-Bold",
      size: HEADER_FONT_SIZE,
      color: "#FFFFFF",
      fill: headerColor,
    });
    doc.y = y + h;
  };

  drawHeader();

  if (opts.rows.length === 0) {
    doc.moveDown(0.5);
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor("#6b7280")
      .text("Walang record para sa napiling filter.", MARGIN);
  }

  opts.rows.forEach((row, index) => {
    const cells = opts.columns.map((c) => c.value(row));
    const h = rowHeight(cells, "Helvetica", FONT_SIZE);
    if (doc.y + h > bottomLimit()) {
      doc.addPage();
      drawHeader();
    }
    const style: { font: string; size: number; color: string; fill?: string } = {
      font: "Helvetica",
      size: FONT_SIZE,
      color: "#14213d",
    };
    if (index % 2 === 1) style.fill = "#F4F6F2";
    const y = doc.y;
    drawRow(cells, y, h, style);
    doc.y = y + h;
  });

  if (opts.footerLines?.length) {
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#14213d");
    for (const line of opts.footerLines) doc.text(line, MARGIN);
  }

  // ── Page numbers ──
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Writing inside the bottom margin would otherwise trigger an automatic new page.
    doc.page.margins.bottom = 0;
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#6b7280")
      .text(
        `TarabayMais · DA Region II   —   Pahina ${i + 1} ng ${range.count}`,
        MARGIN,
        doc.page.height - MARGIN - 4,
        { width: pageWidth, align: "center", lineBreak: false },
      );
  }

  doc.end();
  return done;
}

export const formatPeso = (value: number): string =>
  `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
