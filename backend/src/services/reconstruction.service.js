const fs = require('fs');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun } = require('docx');

const HEADING_LEVELS = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6
};

/**
 * Rebuilds a .docx file from translated/refined blocks, preserving
 * headings, paragraphs, and tables.
 */
async function buildDocx(blocks, outputPath) {
  const children = blocks.map((block) => {
    if (block.type === 'heading') {
      return new Paragraph({
        heading: HEADING_LEVELS[block.level] || HeadingLevel.HEADING_2,
        children: [new TextRun({ text: block.text, bold: true })]
      });
    }
    if (block.type === 'table') {
      return new Table({
        rows: block.rows.map(
          (row) =>
            new TableRow({
              children: row.map(
                (cell) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun(cell || '')] })]
                  })
              )
            })
        )
      });
    }
    return new Paragraph({ children: [new TextRun(block.text || '')] });
  });

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

/**
 * Rebuilds a .pdf file from translated/refined blocks. Used both for
 * PDF-in/PDF-out jobs and as the output format for image-in jobs, since an
 * image cannot be "reconstructed" with translated text in place.
 */
async function buildPdf(blocks, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    blocks.forEach((block) => {
      if (block.type === 'heading') {
        doc.fontSize(16 - (block.level || 2)).font('Helvetica-Bold').text(block.text, { paragraphGap: 8 });
        doc.moveDown(0.3);
      } else if (block.type === 'table') {
        doc.fontSize(10).font('Helvetica');
        block.rows.forEach((row) => {
          doc.text(row.join('  |  '));
        });
        doc.moveDown(0.5);
      } else {
        doc.fontSize(11).font('Helvetica').text(block.text, { paragraphGap: 6 });
        doc.moveDown(0.3);
      }
    });

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

/**
 * @param {{ blocks: Array, sourceExt: string, outputPath: string }} params
 * @returns {Promise<{ outputPath: string, outputExt: 'docx'|'pdf' }>}
 */
async function reconstructDocument({ blocks, sourceExt, outputPath }) {
  if (sourceExt === 'docx') {
    await buildDocx(blocks, outputPath);
    return { outputPath, outputExt: 'docx' };
  }
  // PDFs, and images (which have no "original format" to preserve),
  // are both reconstructed as PDF output.
  await buildPdf(blocks, outputPath);
  return { outputPath, outputExt: 'pdf' };
}

module.exports = { reconstructDocument, buildDocx, buildPdf };
