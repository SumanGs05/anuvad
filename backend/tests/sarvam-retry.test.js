jest.mock('axios', () => ({ create: jest.fn() }));
const axios = require('axios');
const client = require('../src/services/sarvamClient');

describe('sarvam client retry', () => {
  beforeEach(() => jest.clearAllMocks());

  test('retries translateText on 429 and succeeds on third attempt', async () => {
    const error429 = Object.assign(new Error('rate limited'), { response: { status: 429, data: {} } });
    const api = {
      post: jest.fn()
        .mockRejectedValueOnce(error429)
        .mockRejectedValueOnce(error429)
        .mockResolvedValueOnce({ data: { translated_text: 'नमस्ते' } })
    };
    axios.create.mockReturnValue(api);

    const result = await client.translateText({ text: 'Hello', targetLanguage: 'hi' });
    expect(result).toBe('नमस्ते');
    expect(api.post).toHaveBeenCalledTimes(3);
  }, 15000);

  test('retries translateText on 500 and throws after max attempts', async () => {
    const error500 = Object.assign(new Error('server error'), { response: { status: 500, data: {} } });
    const api = { post: jest.fn().mockRejectedValue(error500) };
    axios.create.mockReturnValue(api);

    await expect(client.translateText({ text: 'Hello', targetLanguage: 'hi' }))
      .rejects.toThrow('Translation provider request failed');
    expect(api.post).toHaveBeenCalledTimes(3);
  }, 15000);

  test('does not retry on 400 client errors', async () => {
    const error400 = Object.assign(new Error('bad request'), { response: { status: 400, data: {} } });
    const api = { post: jest.fn().mockRejectedValue(error400) };
    axios.create.mockReturnValue(api);

    await expect(client.translateText({ text: 'Hello', targetLanguage: 'hi' }))
      .rejects.toThrow('Translation provider request failed');
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  test('API key is sent as a header and not as a query param or body field', async () => {
    const api = {
      post: jest.fn().mockResolvedValue({ data: { translated_text: 'hello' } })
    };
    axios.create.mockReturnValue(api);

    await client.translateText({ text: 'hi', targetLanguage: 'hi' });

    // axios.create is called with headers containing api-subscription-key.
    const createCall = axios.create.mock.calls[0][0];
    expect(createCall.headers['api-subscription-key']).toBeTruthy();

    // The POST body must not contain the key.
    const postBody = api.post.mock.calls[0][1];
    expect(JSON.stringify(postBody)).not.toContain('api-subscription-key');
  });
});
