const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType
} = require('docx');

const HEADING_LEVELS = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6
};

const FONT_DIR = path.join(__dirname, '..', '..', 'assets');

const LANGUAGE_FONT_MAP = {
  hi: 'NotoSansDevanagari-Regular.ttf',
  mr: 'NotoSansDevanagari-Regular.ttf',
  bn: 'NotoSansBengali-Regular.ttf',
  gu: 'NotoSansGujarati-Regular.ttf',
  ta: 'NotoSansTamil-Regular.ttf',
  te: 'NotoSansTelugu-Regular.ttf'
};

const DEFAULT_FONT = 'Helvetica';

function registerFonts(doc) {
  for (const [lang, filename] of Object.entries(LANGUAGE_FONT_MAP)) {
    const fontPath = path.join(FONT_DIR, filename);

    if (!fs.existsSync(fontPath)) {
      throw new Error(
        `Missing font file for "${lang}": expected at ${fontPath}`
      );
    }

    doc.registerFont(lang, fontPath);
  }
}

function fontFor(lang) {
  return LANGUAGE_FONT_MAP[lang]
    ? lang
    : DEFAULT_FONT;
}

function buildDocxTable(rows) {
  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE
    },
    rows: rows.map((row, rowIndex) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(cell || ''),
                      bold: rowIndex === 0
                    })
                  ]
                })
              ]
            })
        )
      })
    )
  });
}

async function buildDocx(blocks, outputPath) {
  const children = [];

  for (const block of blocks) {
    if (block.type === 'heading') {
      children.push(
        new Paragraph({
          heading:
            HEADING_LEVELS[block.level] ||
            HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: block.text || '',
              bold: true
            })
          ]
        })
      );

      continue;
    }

    if (block.type === 'table') {
      children.push(
        buildDocxTable(block.rows || [])
      );

      continue;
    }

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: block.text || ''
          })
        ],
        spacing: {
          after: 160
        }
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        children
      }
    ]
  });

  const buffer =
    await Packer.toBuffer(doc);

  fs.writeFileSync(
    outputPath,
    buffer
  );

  return outputPath;
}

function ensureSpace(doc, requiredHeight) {
  const bottom =
    doc.page.height -
    doc.page.margins.bottom;

  if (
    doc.y + requiredHeight >
    bottom
  ) {
    doc.addPage();
  }
}

function drawTable(doc, rows, fontName) {
  if (!rows || !rows.length) {
    return;
  }

  const columnCount =
    Math.max(
      ...rows.map(
        (row) => row.length
      )
    );

  if (!columnCount) {
    return;
  }

  const pageWidth =
    doc.page.width -
    doc.page.margins.left -
    doc.page.margins.right;

  const columnWidth =
    pageWidth / columnCount;

  const padding = 6;
  const fontSize = 10;
  const lineGap = 2;

  let rowIndex = 0;

  while (rowIndex < rows.length) {
    const row = rows[rowIndex];

    const cellTexts =
      Array.from(
        { length: columnCount },
        (_, index) =>
          String(
            row[index] || ''
          )
      );

    doc.font(fontName);
    doc.fontSize(fontSize);

    const rowHeight =
      Math.max(
        ...cellTexts.map(
          (text) => {
            const height =
              doc.heightOfString(
                text,
                {
                  width:
                    columnWidth -
                    padding * 2,
                  lineGap
                }
              );

            return (
              height +
              padding * 2
            );
          }
        )
      );

    ensureSpace(
      doc,
      rowHeight + 5
    );

    const startX =
      doc.page.margins.left;

    const startY =
      doc.y;

    for (
      let columnIndex = 0;
      columnIndex < columnCount;
      columnIndex += 1
    ) {
      const x =
        startX +
        columnIndex *
          columnWidth;

      const text =
        cellTexts[columnIndex];

      doc
        .rect(
          x,
          startY,
          columnWidth,
          rowHeight
        )
        .stroke();

      if (rowIndex === 0) {
        doc
          .font(fontName)
          .fontSize(fontSize)
          .text(
            text,
            x + padding,
            startY + padding,
            {
              width:
                columnWidth -
                padding * 2,
              lineGap,
              align: 'left'
            }
          );
      } else {
        doc
          .font(fontName)
          .fontSize(fontSize)
          .text(
            text,
            x + padding,
            startY + padding,
            {
              width:
                columnWidth -
                padding * 2,
              lineGap,
              align: 'left'
            }
          );
      }
    }

    doc.y =
      startY +
      rowHeight;

    rowIndex += 1;
  }

  doc.moveDown(0.8);
}

function drawHeading(
  doc,
  text,
  level,
  fontName
) {
  const sizes = {
    1: 20,
    2: 16,
    3: 14,
    4: 13,
    5: 12,
    6: 11
  };

  const size =
    sizes[level] || 14;

  const estimatedHeight =
    size * 2.5;

  ensureSpace(
    doc,
    estimatedHeight
  );

  doc
    .font(fontName)
    .fontSize(size)
    .text(
      text || '',
      {
        paragraphGap:
          level === 1
            ? 10
            : 7
      }
    );

  doc.moveDown(
    level === 1
      ? 0.5
      : 0.25
  );
}

function drawParagraph(
  doc,
  text,
  fontName
) {
  if (!text || !text.trim()) {
    return;
  }

  doc
    .font(fontName)
    .fontSize(11);

  const availableWidth =
    doc.page.width -
    doc.page.margins.left -
    doc.page.margins.right;

  const estimatedHeight =
    doc.heightOfString(
      text,
      {
        width: availableWidth,
        lineGap: 2
      }
    );

  ensureSpace(
    doc,
    Math.min(
      estimatedHeight + 10,
      120
    )
  );

  doc.text(
    text,
    {
      width: availableWidth,
      lineGap: 2,
      paragraphGap: 6
    }
  );

  doc.moveDown(0.25);
}

async function buildPdf(
  blocks,
  outputPath,
  targetLanguage
) {
  return new Promise(
    (resolve, reject) => {
      const doc =
        new PDFDocument({
          margin: 50,
          autoFirstPage: true
        });

      const stream =
        fs.createWriteStream(
          outputPath
        );

      doc.pipe(stream);

      try {
        registerFonts(doc);

        const bodyFont =
          fontFor(
            targetLanguage
          );

        for (const block of blocks) {
          if (
            block.type ===
            'heading'
          ) {
            drawHeading(
              doc,
              block.text,
              block.level || 2,
              bodyFont
            );
          } else if (
            block.type ===
            'table'
          ) {
            drawTable(
              doc,
              block.rows || [],
              bodyFont
            );
          } else {
            drawParagraph(
              doc,
              block.text,
              bodyFont
            );
          }
        }

        doc.end();
      } catch (err) {
        reject(err);
      }

      stream.on(
        'finish',
        () => resolve(outputPath)
      );

      stream.on(
        'error',
        reject
      );
    }
  );
}

async function reconstructDocument({
  blocks,
  sourceExt,
  outputPath,
  targetLanguage
}) {
  if (
    sourceExt === 'docx'
  ) {
    await buildDocx(
      blocks,
      outputPath
    );

    return {
      outputPath,
      outputExt: 'docx'
    };
  }

  await buildPdf(
    blocks,
    outputPath,
    targetLanguage
  );

  return {
    outputPath,
    outputExt: 'pdf'
  };
}

module.exports = {
  reconstructDocument,
  buildDocx,
  buildPdf,
  registerFonts,
  fontFor
};
