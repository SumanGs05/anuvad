jest.mock('../src/services/sarvamClient', () => ({
  translateText: jest.fn(), chatCompletion: jest.fn(), parseImageDocument: jest.fn()
}));

const sarvamClient = require('../src/services/sarvamClient');
const { chunkText, translatePlainText, translateBlocks } = require('../src/services/translation.service');
const { buildGlossarySection, buildSystemPrompt, refineText, refineBlocks } = require('../src/services/refinement.service');
const { htmlToBlocks } = require('../src/services/parsing.service');
const { buildDocx, buildPdf } = require('../src/services/reconstruction.service');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('translation service', () => {
  beforeEach(() => jest.clearAllMocks());
  test('chunks text and translates every block while preserving table structure', async () => {
    expect(chunkText('one. two.', 5)).toEqual(['one.', 'two.']);
    sarvamClient.translateText.mockResolvedValueOnce('नमस्ते').mockResolvedValueOnce('तालिका');
    await expect(translateBlocks([{ type: 'paragraph', text: 'Hello' }, { type: 'table', rows: [['Cell']] }], 'hi')).resolves.toEqual([{ type: 'paragraph', text: 'नमस्ते' }, { type: 'table', rows: [['तालिका']] }]);
    expect(translatePlainText('', 'hi')).resolves.toBe('');
  });
});

describe('refinement service', () => {
  beforeEach(() => jest.clearAllMocks());
  test('creates a glossary-led prompt and retains the base translation when refinement is blank', async () => {
    expect(buildGlossarySection('hi')).toContain('intellectual property');
    expect(buildSystemPrompt('hi')).toContain('CIPAM');

    // Use text longer than 400 chars so the length optimisation does not skip chatCompletion.
    const longText = 'Hello '.repeat(80).trim(); // 479 chars
    const longTranslation = 'नमस्ते '.repeat(80).trim();

    sarvamClient.chatCompletion.mockResolvedValue('   ');
    await expect(refineText({ originalText: longText, baseTranslation: longTranslation, targetLanguage: 'hi' })).resolves.toBe(longTranslation);

    sarvamClient.chatCompletion.mockResolvedValue('सुधारा');
    await expect(
      refineBlocks(
        [{ type: 'paragraph', text: longText }],
        [{ type: 'paragraph', text: longTranslation }],
        'hi'
      )
    ).resolves.toEqual([{ type: 'paragraph', text: 'सुधारा' }]);
  });
});

describe('parsing service', () => {
  test('turns Mammoth-like HTML into structural blocks', () => {
    expect(htmlToBlocks('<h1>Title</h1><p>Hello &amp; welcome</p><table><tr><td>A</td><td>B</td></tr></table>')).toEqual([{ type: 'heading', level: 1, text: 'Title' }, { type: 'paragraph', text: 'Hello & welcome' }, { type: 'table', rows: [['A', 'B']] }]);
  });
});

describe('reconstruction service', () => {
  test('writes readable docx and pdf output', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'anuvad-'));
    const docxPath = path.join(directory, 'output.docx');
    const pdfPath = path.join(directory, 'output.pdf');
    await buildDocx([{ type: 'heading', level: 1, text: 'Title' }, { type: 'paragraph', text: 'Body' }], docxPath);
    await buildPdf([{ type: 'paragraph', text: 'Body' }], pdfPath);
    expect(fs.statSync(docxPath).size).toBeGreaterThan(0);
    expect(fs.statSync(pdfPath).size).toBeGreaterThan(0);
  });
});
