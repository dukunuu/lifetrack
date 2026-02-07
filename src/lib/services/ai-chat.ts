import { jsonrepair } from 'jsonrepair';
import type { ChatMessage } from '../db/types';

interface AiChatOptions {
  provider: 'openrouter';
  apiKey: string;
  model: string;
  messages: ChatMessage[];
}

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const SYSTEM_PROMPT =
  'You are Lifetrack, a concise assistant for tracking, habits, and productivity. Keep replies short, practical, and friendly.';
const COMMAND_PROMPT = [
  'You are Lifetrack, a concise assistant for tracking, habits, and productivity.',
  'Return ONLY valid JSON.',
  'Schema: { "reply": string, "command": string }',
  'If the user asks to log/track/add/update something, set "command" to a Quick Add string like "#egg 1".',
  'Quick Add syntax examples: "#water 500ml", "#mood(4)", "#run 3km 20min", "#sleep 7h".',
  'If you need to look up information on the internet, set "command" to "/search <query>".',
  'If the user asks for an image and image generation is available, set "command" to "/image <prompt>".',
  'Only include "command" if you are confident about the exact tracker tag and the field order.',
  'If you are unsure about required values or their order, ask a short clarifying question and leave "command" empty.',
  'If no command is needed, set "command" to an empty string.',
  'Keep "reply" short and helpful.',
].join('\n');

const mapMessages = (messages: ChatMessage[]) =>
  messages.map((message) => {
    if (message.imageDataUrl) {
      const text = message.content?.trim() || 'User image.';
      return {
        role: message.role,
        content: [
          { type: 'text', text },
          { type: 'image_url', image_url: { url: message.imageDataUrl } },
        ],
      };
    }
    return {
      role: message.role,
      content: message.content,
    };
  });

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

const extractJsonObject = (content: string) => {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('AI response did not include a JSON object.');
  }
  return trimmed.slice(firstBrace, lastBrace + 1);
};

const requestOpenRouter = async (options: AiChatOptions) => {
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
      temperature: 0.4,
      max_tokens: 800,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...mapMessages(options.messages)],
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
  return data?.choices?.[0]?.message?.content as string | undefined;
};

export const requestChatResponse = async (options: AiChatOptions) => {
  const content = await requestOpenRouter(options);
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI response was empty.');
  }
  return content.trim();
};

export async function* requestChatResponseStream(options: AiChatOptions) {
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
      temperature: 0.4,
      max_tokens: 800,
      stream: true,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...mapMessages(options.messages)],
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

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Stream response body was empty.');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const lineEnd = buffer.indexOf('\n');
        if (lineEnd === -1) break;
        const line = buffer.slice(0, lineEnd).trim();
        buffer = buffer.slice(lineEnd + 1);

        if (!line || line.startsWith(':')) continue;
        if (!line.startsWith('data:')) continue;

        const data = line.slice(5).trim();
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          if (parsed?.error?.message) {
            throw new Error(parsed.error.message);
          }
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) {
            yield delta as string;
          }
        } catch (err) {
          if (err instanceof Error) {
            throw err;
          }
        }
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}

type UrlCitation = {
  url?: string;
  title?: string;
};

const extractCitations = (annotations: any[]): UrlCitation[] => {
  return annotations
    .map((annotation) => annotation?.url_citation)
    .filter((citation) => citation && (citation.url || citation.title))
    .map((citation) => ({ url: citation.url, title: citation.title }));
};

export const requestWebSearchSummary = async (
  options: Omit<AiChatOptions, 'messages'>,
  query: string,
) => {
  const model = options.model.includes(':online') ? options.model : `${options.model}:online`;
  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
      'X-Title': 'Lifetrack',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 700,
      plugins: [{ id: 'web', max_results: 3 }],
      messages: [
        {
          role: 'system',
          content:
            'Summarize the most relevant web results in 2-4 sentences. Do not include sources.',
        },
        { role: 'user', content: query },
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
  const message = data?.choices?.[0]?.message;
  const content = message?.content as string | undefined;
  if (!content || !content.trim()) {
    throw new Error('Web search response was empty.');
  }

  const annotations = Array.isArray(message?.annotations) ? message.annotations : [];
  const citations = extractCitations(annotations);

  return {
    summary: content.trim(),
    citations,
  };
};

export const requestChatDecision = async (options: AiChatOptions) => {
  const payload = {
    model: options.model,
    temperature: 0.3,
    max_tokens: 800,
    messages: [{ role: 'system', content: COMMAND_PROMPT }, ...mapMessages(options.messages)],
  };

  const content = await (async () => {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
        'X-Title': 'Lifetrack',
      },
      body: JSON.stringify(payload),
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
    return data?.choices?.[0]?.message?.content as string | undefined;
  })();

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI response was empty.');
  }

  const jsonText = extractJsonObject(content);
  const parsed = parseJsonSafely(jsonText) as { reply?: string; command?: string };

  return {
    reply: typeof parsed.reply === 'string' ? parsed.reply.trim() : '',
    command: typeof parsed.command === 'string' ? parsed.command.trim() : '',
  };
};
