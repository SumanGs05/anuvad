jest.mock('axios', () => ({ create: jest.fn() }));
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const client = require('../src/services/sarvamClient');

describe('sarvam client', () => {
  beforeEach(() => jest.clearAllMocks());
  test('maps project language codes', () => expect(client.toSarvamLangCode('hi')).toBe('hi-IN'));
  test('uses current multipart Doc AI flow for image extraction', async () => {
    const api = { post: jest.fn().mockResolvedValue({ data: { job_id: 'job-1' } }), get: jest.fn().mockResolvedValueOnce({ data: { status: 'completed' } }).mockResolvedValueOnce({ data: { documents: [{ blocks: [{ text: 'Extracted text' }] }] } }) };
    axios.create.mockReturnValue(api);
    const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'anuvad-')), 'scan.png');
    fs.writeFileSync(filePath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    await expect(client.parseImageDocument({ filePath })).resolves.toBe('Extracted text');
    expect(api.post.mock.calls[0][0]).toBe('/doc-ai/v1/job/digitise');
    expect(api.get.mock.calls[0][0]).toBe('/doc-ai/v1/job/job-1/status');
  });
});
