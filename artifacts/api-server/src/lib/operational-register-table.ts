import { PALETTE } from "./pdf-kit";

type Doc = PDFKit.PDFDocument;

export interface OperationalRegisterColumn<Row> {
  label: string;
  width: number;
  format: (row: Row) => string;
  align?: "left" | "center" | "right";
}

export interface OperationalRegisterTableOptions<Row> {
  x: number;
  startY: number;
  columns: OperationalRegisterColumn<Row>[];
  rows: Row[];
  pageBottom: number;
  onPageBreak: () => number;
  fontSize?: number;
  headerFontSize?: number;
  rowMinHeight?: number;
  cellPadX?: number;
  cellPadY?: number;
}

/**
 * A bounded, measured table for operational registers with long customer text.
 * Explicit cell heights prevent PDFKit from creating an unbranded implicit
 * spill page while preserving complete wrapped values.
 */
export function drawOperationalRegisterTable<Row>(
  doc: Doc,
  options: OperationalRegisterTableOptions<Row>,
): number {
  const fontSize = options.fontSize ?? 8.5;
  const headerFontSize = options.headerFontSize ?? 8.5;
  const rowMinHeight = options.rowMinHeight ?? 30;
  const padX = options.cellPadX ?? 4;
  const padY = options.cellPadY ?? 5;
  const tableWidth = options.columns.reduce((sum, column) => sum + column.width, 0);
  const physicalRight = doc.page.width - doc.page.margins.right;
  if (options.x < doc.page.margins.left || options.x + tableWidth > physicalRight + 0.01) {
    throw new Error(`Operational register table exceeds physical bounds: x=${options.x}, width=${tableWidth}`);
  }

  doc.font(PALETTE.FONT_BOLD).fontSize(headerFontSize);
  const headerTextHeight = Math.max(...options.columns.map((column) =>
    doc.heightOfString(column.label.toUpperCase(), { width: column.width - padX * 2 }),
  ));
  const headerHeight = Math.max(20, Math.ceil(headerTextHeight + 8));

  const drawHeader = (y: number) => {
    doc.rect(options.x, y, tableWidth, headerHeight).fill(PALETTE.NAVY);
    let x = options.x;
    for (const column of options.columns) {
      doc.font(PALETTE.FONT_BOLD).fontSize(headerFontSize).fillColor(PALETTE.WHITE)
        .text(column.label.toUpperCase(), x + padX, y + 4, {
          width: column.width - padX * 2,
          height: headerHeight - 7,
          align: column.align ?? "left",
          lineBreak: true,
        });
      x += column.width;
    }
    return y + headerHeight + 2;
  };

  let y = drawHeader(options.startY);
  options.rows.forEach((row, rowIndex) => {
    // PDFKit's heightOfString consults the mutable document cursor. Keep that
    // cursor away from the physical page edge so measurement itself cannot
    // trigger an implicit continuation page.
    doc.x = options.x;
    doc.y = 0;
    doc.font(PALETTE.FONT).fontSize(fontSize);
    const values = options.columns.map((column) => column.format(row));
    const textHeight = Math.max(...values.map((value, columnIndex) =>
      doc.heightOfString(value, { width: options.columns[columnIndex].width - padX * 2 }),
    ));
    const rowHeight = Math.max(rowMinHeight, Math.ceil(textHeight + padY * 2));

    if (y + rowHeight > options.pageBottom) {
      y = drawHeader(options.onPageBreak());
    }

    doc.rect(options.x, y, tableWidth, rowHeight)
      .fill(rowIndex % 2 === 0 ? PALETTE.WHITE : PALETTE.ROW_ALT);
    let x = options.x;
    values.forEach((value, columnIndex) => {
      const column = options.columns[columnIndex];
      doc.font(PALETTE.FONT).fontSize(fontSize).fillColor(PALETTE.TEXT)
        .text(value, x + padX, y + padY, {
          width: column.width - padX * 2,
          height: rowHeight - padY * 2,
          align: column.align ?? "left",
          lineBreak: true,
        });
      x += column.width;
    });
    doc.rect(options.x, y, tableWidth, rowHeight).stroke(PALETTE.BORDER);
    doc.x = options.x;
    doc.y = 0;
    y += rowHeight;
  });

  return y;
}
