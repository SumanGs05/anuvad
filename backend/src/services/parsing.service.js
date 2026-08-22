const fs = require('fs');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const sarvamClient = require('./sarvamClient');
const logger = require('../utils/logger');

function htmlToBlocks(html) {
  const blocks = [];
  const tagRegex = /<(h[1-6]|p|table)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const [, tag, inner] = match;

    if (tag.toLowerCase() === 'table') {
      const rows = [];
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;

      while ((rowMatch = rowRegex.exec(inner)) !== null) {
        const cells = [
          ...rowMatch[1].matchAll(
            /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
          )
        ].map((cell) => stripTags(cell[1]).trim());

        if (cells.length) rows.push(cells);
      }

      if (rows.length) {
        blocks.push({
          type: 'table',
          rows
        });
      }
    } else if (tag.toLowerCase().startsWith('h')) {
      blocks.push({
        type: 'heading',
        level: Number(tag[1]),
        text: stripTags(inner).trim()
      });
    } else {
      const text = stripTags(inner).trim();

      if (text) {
        blocks.push({
          type: 'paragraph',
          text
        });
      }
    }
  }

  return blocks;
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function parseDocx(filePath) {
  const buffer = fs.readFileSync(filePath);
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const blocks = htmlToBlocks(html);

  if (!blocks.length) {
    throw new Error('No extractable text found in document');
  }

  return blocks;
}

let pdfjsPromise = null;

async function getPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }

  return pdfjsPromise;
}

function median(values) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cleanText(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getItemFontSize(item) {
  const transform = item.transform || [];
  const scaleX = Math.abs(Number(transform[0]) || 0);
  const scaleY = Math.abs(Number(transform[3]) || 0);
  const height = Math.abs(Number(item.height) || 0);

  return Math.max(scaleX, scaleY, height, 1);
}

function getItemX(item) {
  return Number(item.transform?.[4]) || 0;
}

function getItemY(item) {
  return Number(item.transform?.[5]) || 0;
}

function isBoldFont(fontName) {
  return /bold|black|heavy|semibold|demi/i.test(fontName || '');
}

function joinLineItems(items) {
  if (!items.length) return '';

  let result = items[0].text;

  for (let i = 1; i < items.length; i += 1) {
    const previous = items[i - 1];
    const current = items[i];

    const previousRight =
      previous.x + previous.width;

    const gap =
      current.x - previousRight;

    if (gap > 1.5) {
      result += ' ';
    }

    result += current.text;
  }

  return cleanText(result);
}

function buildLines(items) {
  const usableItems = items
    .filter(
      (item) =>
        item &&
        typeof item.str === 'string' &&
        item.str.trim().length > 0
    )
    .map((item) => ({
      text: cleanText(item.str),
      x: getItemX(item),
      y: getItemY(item),
      width: Number(item.width) || 0,
      height: Number(item.height) || 0,
      fontSize: getItemFontSize(item),
      fontName: item.fontName || '',
      bold: isBoldFont(item.fontName),
      hasEOL: Boolean(item.hasEOL)
    }));

  if (!usableItems.length) return [];

  const typicalHeight = median(
    usableItems.map((item) => item.fontSize)
  );

  const yTolerance = clamp(
    typicalHeight * 0.35,
    2,
    6
  );

  usableItems.sort((a, b) => {
    if (Math.abs(a.y - b.y) > yTolerance) {
      return b.y - a.y;
    }

    return a.x - b.x;
  });

  const lines = [];

  for (const item of usableItems) {
    let targetLine = null;

    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];

      if (Math.abs(line.y - item.y) <= yTolerance) {
        targetLine = line;
        break;
      }

      if (line.y - item.y > yTolerance) {
        break;
      }
    }

    if (!targetLine) {
      targetLine = {
        y: item.y,
        items: []
      };

      lines.push(targetLine);
    }

    targetLine.items.push(item);
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);

    line.fontSize = median(
      line.items.map((item) => item.fontSize)
    );

    line.boldRatio =
      line.items.filter((item) => item.bold).length /
      Math.max(line.items.length, 1);

    line.x = line.items[0]?.x || 0;

    const lastItem =
      line.items[line.items.length - 1];

    line.right = lastItem
      ? lastItem.x + lastItem.width
      : line.x;

    line.width =
      Math.max(0, line.right - line.x);

    line.text = joinLineItems(line.items);
  }

  return lines.sort((a, b) => b.y - a.y);
}

function getColumnStarts(line) {
  if (!line.items || line.items.length < 2) {
    return [];
  }

  const starts = [line.items[0].x];

  for (let i = 1; i < line.items.length; i += 1) {
    const previous = line.items[i - 1];
    const current = line.items[i];

    const gap =
      current.x -
      (previous.x + previous.width);

    if (gap >= 30) {
      starts.push(current.x);
    }
  }

  return starts;
}

function isPossibleTableRow(line) {
  if (!line.items || line.items.length < 2) {
    return false;
  }

  return getColumnStarts(line).length >= 2;
}

function findTableRuns(lines) {
  const candidates = lines.map((line, index) => ({
    index,
    line,
    starts: getColumnStarts(line),
    possible: isPossibleTableRow(line)
  }));

  const runs = [];
  let current = [];

  for (const candidate of candidates) {
    if (!candidate.possible) {
      if (current.length >= 2) {
        runs.push(current);
      }

      current = [];
      continue;
    }

    if (!current.length) {
      current.push(candidate);
      continue;
    }

    const previous =
      current[current.length - 1];

    const verticalGap =
      Math.abs(
        previous.line.y -
        candidate.line.y
      );

    const previousStarts =
      previous.starts;

    const currentStarts =
      candidate.starts;

    const sameColumnCount =
      previousStarts.length ===
      currentStarts.length;

    const firstColumnMatches =
      Math.abs(
        previousStarts[0] -
        currentStarts[0]
      ) <= 20;

    const secondColumnMatches =
      Math.abs(
        previousStarts[1] -
        currentStarts[1]
      ) <= 20;

    const sameColumns =
      sameColumnCount &&
      firstColumnMatches &&
      secondColumnMatches;

    const normalRowSpacing =
      verticalGap <= 40;

    if (
      sameColumns &&
      normalRowSpacing
    ) {
      current.push(candidate);
    } else {
      if (current.length >= 2) {
        runs.push(current);
      }

      current = [candidate];
    }
  }

  if (current.length >= 2) {
    runs.push(current);
  }

  return runs;
}

function tableRunToBlock(run) {
  if (!run || run.length < 2) {
    return null;
  }

  const rows = [];

  for (const entry of run) {
    const line = entry.line;
    const starts = getColumnStarts(line);

    if (starts.length < 2) continue;

    const cells = starts.map(() => '');

    for (const item of line.items) {
      let closestColumn = 0;
      let closestDistance =
        Math.abs(
          item.x - starts[0]
        );

      for (let i = 1; i < starts.length; i += 1) {
        const distance =
          Math.abs(
            item.x - starts[i]
          );

        if (distance < closestDistance) {
          closestDistance = distance;
          closestColumn = i;
        }
      }

      if (cells[closestColumn]) {
        cells[closestColumn] +=
          ` ${item.text}`;
      } else {
        cells[closestColumn] =
          item.text;
      }
    }

    const cleanedCells =
      cells.map((cell) =>
        cleanText(cell)
      );

    if (
      cleanedCells.some(
        (cell) => cell.length > 0
      )
    ) {
      rows.push(cleanedCells);
    }
  }

  if (rows.length < 2) {
    return null;
  }

  return {
    type: 'table',
    rows
  };
}

function lineLooksLikeHeading(
  line,
  index,
  lines,
  bodyFontSize,
  pageHeight
) {
  const text = line.text;

  if (!text || text.length > 180) {
    return false;
  }

  const relativeSize =
    line.fontSize /
    Math.max(bodyFontSize, 1);

  const bold =
    line.boldRatio >= 0.5;

  const previous =
    lines[index - 1];

  const next =
    lines[index + 1];

  const gapAbove = previous
    ? Math.abs(
        previous.y - line.y
      )
    : 100;

  const gapBelow = next
    ? Math.abs(
        line.y - next.y
      )
    : 100;

  const largeFont =
    relativeSize >= 1.12;

  const veryLargeFont =
    relativeSize >= 1.30;

  const whitespaceAbove =
    gapAbove >
    line.fontSize * 1.35;

  const whitespaceBelow =
    gapBelow >
    line.fontSize * 1.35;

  if (
    largeFont &&
    (whitespaceAbove ||
      whitespaceBelow)
  ) {
    return true;
  }

  if (
    bold &&
    (whitespaceAbove ||
      whitespaceBelow)
  ) {
    return true;
  }

  if (veryLargeFont) {
    return true;
  }

  return false;
}

function headingLevel(
  line,
  bodyFontSize,
  pageHeight
) {
  const ratio =
    line.fontSize /
    Math.max(bodyFontSize, 1);

  if (
    ratio >= 1.35 &&
    line.y > pageHeight * 0.70
  ) {
    return 1;
  }

  return 2;
}

function linesToParagraphs(
  lines,
  bodyFontSize
) {
  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (!current) {
      current = {
        text: line.text,
        x: line.x,
        fontSize: line.fontSize,
        lastY: line.y
      };

      continue;
    }

    const verticalGap =
      current.lastY - line.y;

    const xDifference =
      Math.abs(
        current.x - line.x
      );

    const fontDifference =
      Math.abs(
        current.fontSize -
        line.fontSize
      );

    const sameParagraph =
      verticalGap <=
        Math.max(
          current.fontSize * 1.8,
          18
        ) &&
      xDifference <= 18 &&
      fontDifference <=
        Math.max(
          bodyFontSize * 0.25,
          3
        );

    if (sameParagraph) {
      current.text =
        `${current.text} ${line.text}`;

      current.lastY = line.y;
    } else {
      blocks.push({
        type: 'paragraph',
        text: cleanText(
          current.text
        )
      });

      current = {
        text: line.text,
        x: line.x,
        fontSize: line.fontSize,
        lastY: line.y
      };
    }
  }

  if (current) {
    blocks.push({
      type: 'paragraph',
      text: cleanText(
        current.text
      )
    });
  }

  return blocks.filter(
    (block) => block.text
  );
}

function pageToBlocks(
  textContent,
  pageWidth,
  pageHeight
) {
  const lines =
    buildLines(
      textContent.items
    );

  if (!lines.length) {
    return [];
  }

  const bodyFontSize =
    median(
      lines.map(
        (line) => line.fontSize
      )
    );

  const tableRuns =
    findTableRuns(lines);

  const tableStartMap =
    new Map();

  for (const run of tableRuns) {
    if (run.length) {
      tableStartMap.set(
        run[0].index,
        run
      );
    }
  }

  const blocks = [];
  let paragraphLines = [];

  function flushParagraph() {
    if (!paragraphLines.length) {
      return;
    }

    blocks.push(
      ...linesToParagraphs(
        paragraphLines,
        bodyFontSize
      )
    );

    paragraphLines = [];
  }

  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {
    const line =
      lines[index];

    const tableRun =
      tableStartMap.get(index);

    if (tableRun) {
      flushParagraph();

      const table =
        tableRunToBlock(
          tableRun
        );

      if (table) {
        blocks.push(table);
      }

      index =
        tableRun[
          tableRun.length - 1
        ].index;

      continue;
    }

    if (
      lineLooksLikeHeading(
        line,
        index,
        lines,
        bodyFontSize,
        pageHeight
      )
    ) {
      flushParagraph();

      blocks.push({
        type: 'heading',
        level: headingLevel(
          line,
          bodyFontSize,
          pageHeight
        ),
        text: line.text
      });

      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();

  return blocks.filter(
    (block) => {
      if (block.type === 'table') {
        return (
          block.rows &&
          block.rows.length > 0
        );
      }

      return (
        block.text &&
        block.text.trim()
      );
    }
  );
}
function mergeAdjacentTables(blocks) {
  const merged = [];

  for (const block of blocks) {
    const previous = merged[merged.length - 1];

    if (
      previous &&
      previous.type === 'table' &&
      block.type === 'table'
    ) {
      const previousColumnCount =
        previous.rows?.[0]?.length || 0;

      const currentColumnCount =
        block.rows?.[0]?.length || 0;

      if (
        previousColumnCount > 0 &&
        previousColumnCount === currentColumnCount
      ) {
        previous.rows.push(...block.rows);
        continue;
      }
    }

    merged.push(block);
  }

  return merged;
}

async function parsePdfWithLayout(filePath) {
  const pdfjsLib =
    await getPdfJs();

  const buffer =
    fs.readFileSync(filePath);

  const loadingTask =
    pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false
    });

  const pdf =
    await loadingTask.promise;

  const allBlocks = [];

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber += 1
  ) {
    const page =
      await pdf.getPage(
        pageNumber
      );

    const viewport =
      page.getViewport({
        scale: 1
      });

    const textContent =
      await page.getTextContent({
        normalizeWhitespace: true,
        disableNormalization: false
      });

    const pageBlocks =
      pageToBlocks(
        textContent,
        viewport.width,
        viewport.height
      );

    allBlocks.push(
      ...pageBlocks
    );
  }

return mergeAdjacentTables(allBlocks);
}

async function parsePdfFallback(filePath) {
  const buffer =
    fs.readFileSync(filePath);

  const { text } =
    await pdfParse(buffer);

  const paragraphs =
    text
      .split(/\n{2,}/)
      .map((paragraph) =>
        paragraph
          .replace(/\s+/g, ' ')
          .trim()
      )
      .filter(Boolean);

  return paragraphs.map(
    (text) => ({
      type: 'paragraph',
      text
    })
  );
}

async function parsePdf(filePath) {
  try {
    const blocks =
      await parsePdfWithLayout(
        filePath
      );

    if (!blocks.length) {
      throw new Error(
        'PDF.js extracted no structured text'
      );
    }

    return blocks;
  } catch (err) {
    logger.warn(
      'PDF layout parser failed; using text fallback',
      {
        error: err.message
      }
    );

    const fallback =
      await parsePdfFallback(
        filePath
      );

    if (!fallback.length) {
      throw new Error(
        'No extractable text found in PDF'
      );
    }

    return fallback;
  }
}

async function parseImage(
  filePath,
  sourceLanguage
) {
  const text =
    await sarvamClient.parseImageDocument({
      filePath,
      sourceLanguage
    });

  const paragraphs =
    text
      .split(/\n{2,}/)
      .map((paragraph) =>
        paragraph.trim()
      )
      .filter(Boolean);

  if (!paragraphs.length) {
    throw new Error(
      'No extractable text found in image'
    );
  }

  return paragraphs.map(
    (text) => ({
      type: 'paragraph',
      text
    })
  );
}

async function parseDocument({
  filePath,
  ext,
  sourceLanguage = 'en'
}) {
  try {
    let blocks;

    if (ext === 'docx') {
      blocks =
        await parseDocx(filePath);
    } else if (ext === 'pdf') {
      blocks =
        await parsePdf(filePath);
    } else if (
      ext === 'jpg' ||
      ext === 'png'
    ) {
      blocks =
        await parseImage(
          filePath,
          sourceLanguage
        );
    } else {
      throw new Error(
        `Unsupported file extension: ${ext}`
      );
    }

    return {
      blocks
    };
  } catch (err) {
    logger.error(
      'parsing.service.parseDocument failed',
      err,
      { ext }
    );

    throw err;
  }
}

module.exports = {
  parseDocument,
  htmlToBlocks,
  parsePdf,
  parsePdfWithLayout,
  buildLines,
  findTableRuns
};
