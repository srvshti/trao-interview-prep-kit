const DEFAULT_MODEL = 'gemini-3.5-flash';

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseJson(text) {
  const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('LLM returned invalid JSON');
  }
}

function responseText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text || '').join('').trim();
  if (!text) throw new Error('LLM returned an empty response');
  return text;
}

export function hasGeminiConfiguration(env = process.env) {
  return Boolean(env.GEMINI_API_KEY);
}

export async function generateGeminiJson({ prompt, fetcher = fetch, env = process.env, retries = 3 }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let lastError;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetcher(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
        }),
        signal: AbortSignal.timeout(20_000)
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        const detail = await response.text().catch(() => '');
        const error = new Error(`Gemini request failed with HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`);
        if (!retryable || attempt === retries - 1) throw error;
        lastError = error;
      } else {
        return parseJson(responseText(await response.json()));
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries - 1) throw error;
    }
    await sleep(300 * (2 ** attempt));
  }
  throw lastError || new Error('Gemini request failed');
}
