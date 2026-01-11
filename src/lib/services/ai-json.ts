import OpenAI from 'openai';
import { jsonrepair } from 'jsonrepair';

interface AiJsonOptions {
  provider: 'openrouter' | 'openai';
  apiKey: string;
  model: string;
  schema: Record<string, unknown>;
  prompt: string;
}

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const extractJsonObject = (content: string) => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : content).trim();
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('AI response did not include a JSON object.');
  }
  return raw.slice(firstBrace, lastBrace + 1);
};

const parseJsonSafely = (input: string) => {
  try {
    return JSON.parse(input);
  } catch (err) {
    try {
      const repaired = jsonrepair(input);
      return JSON.parse(repaired);
    } catch {
      throw new Error(`AI returned invalid JSON: ${(err as Error).message}`);
    }
  }
};

const requestOpenRouter = async (options: AiJsonOptions, systemPrompt: string) => {
  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
      'X-Title': 'Lifetrack',
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: options.prompt },
      ],
    }),
  });

  if (!response.ok) {
    let message = `OpenRouter request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // ignore parsing errors
    }
    throw new Error(message);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content;
};

const requestOpenAi = async (options: AiJsonOptions, systemPrompt: string) => {
  const client = new OpenAI({ apiKey: options.apiKey, dangerouslyAllowBrowser: true });
  const response = await client.chat.completions.create({
    model: options.model,
    temperature: 0.2,
    max_tokens: 900,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: options.prompt },
    ],
  });
  return response.choices[0]?.message?.content;
};

export const generateJsonFromSchema = async (options: AiJsonOptions) => {
  const schemaText = JSON.stringify(options.schema, null, 2);
  const systemPrompt = [
    'You are a JSON generator.',
    'Return a single JSON object that fully conforms to the provided JSON Schema.',
    'Include all required fields and any helpful optional fields.',
    'Use only valid JSON. Do not wrap the response in markdown or code fences.',
    '',
    'JSON Schema:',
    schemaText,
  ].join('\n');

  const content =
    options.provider === 'openai'
      ? await requestOpenAi(options, systemPrompt)
      : await requestOpenRouter(options, systemPrompt);
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI response was empty.');
  }

  const jsonText = extractJsonObject(content);
  const parsed = parseJsonSafely(jsonText);

  return JSON.stringify(parsed, null, 2);
};
