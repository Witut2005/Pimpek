import { AiError, AiRequest } from '../../models/ai.model';
import { ClaudeProvider } from './claude-provider';
import { GeminiProvider } from './gemini-provider';
import { OpenAiProvider } from './openai-provider';

const REQUEST: AiRequest = { apiKey: 'key', model: 'model-x', system: 'sys', prompt: 'hi', maxTokens: 100 };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('AI providers', () => {
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    fetchSpy = spyOn(window, 'fetch');
  });

  function sent(call = 0): { url: string; headers: Record<string, string>; body: any } {
    const [url, init] = fetchSpy.calls.argsFor(call) as [string, RequestInit];
    return { url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) };
  }

  it('Claude sends the browser-access header and joins text blocks', async () => {
    fetchSpy.and.resolveTo(json(200, { content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }));
    expect(await new ClaudeProvider().complete(REQUEST)).toBe('ab');
    const { url, headers, body } = sent();
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(headers['x-api-key']).toBe('key');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(body).toEqual({ model: 'model-x', max_tokens: 100, system: 'sys', messages: [{ role: 'user', content: 'hi' }] });
  });

  it('Gemini skips thoughts and reads the answer parts', async () => {
    fetchSpy.and.resolveTo(
      json(200, { candidates: [{ content: { parts: [{ text: 'hmm', thought: true }, { text: 'svg' }] } }] }),
    );
    expect(await new GeminiProvider().complete(REQUEST)).toBe('svg');
    expect(sent().url).toContain('/models/model-x:generateContent');
    expect(sent().headers['x-goog-api-key']).toBe('key');
  });

  it('Gemini reports a 400 about the key as a wrong key', async () => {
    fetchSpy.and.resolveTo(json(400, { error: { message: 'API key not valid. Please pass a valid API key.' } }));
    await expectAsync(new GeminiProvider().complete(REQUEST)).toBeRejectedWithError(AiError, /nie przyjął klucza/);
  });

  it('OpenAI sends a bearer token and reads the first choice', async () => {
    fetchSpy.and.resolveTo(json(200, { choices: [{ message: { content: 'svg' } }] }));
    expect(await new OpenAiProvider().complete(REQUEST)).toBe('svg');
    expect(sent().headers['authorization']).toBe('Bearer key');
  });

  it('retries an overloaded model, then gives up with a message', async () => {
    // Skip the back-off waits.
    spyOn(window, 'setTimeout').and.callFake(((fn: () => void) => {
      fn();
      return 0;
    }) as typeof setTimeout);
    fetchSpy.and.callFake(async () => json(503, { error: { message: 'overloaded' } }));
    await expectAsync(new ClaudeProvider().complete(REQUEST)).toBeRejectedWithError(AiError, /przeciążony \(503\)/);
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it('does not retry a wrong key', async () => {
    fetchSpy.and.resolveTo(json(401, { error: { message: 'invalid x-api-key' } }));
    await expectAsync(new ClaudeProvider().complete(REQUEST)).toBeRejectedWithError(AiError, /nie przyjął klucza/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty answer', async () => {
    fetchSpy.and.resolveTo(json(200, { choices: [{ message: { content: '' } }] }));
    await expectAsync(new OpenAiProvider().complete(REQUEST)).toBeRejectedWithError(AiError, /nie odesłał/);
  });
});
