import type { ChatMessage } from '../db/types';
import { entryRepo, sessionRepo, trackerRepo } from '../repositories';
import { dateString, timestamp } from '../db/utils';
import { parserService } from './parser';
import { requestChatDecision, requestChatResponseStream, requestWebSearchSummary } from './ai-chat';
import { generateImage, supportsImageModel, supportsVisionModel } from './image-service';

type AiSettings = {
  provider: 'openrouter';
  openRouterApiKey: string;
  openRouterModel: string;
  openRouterImageModel: string;
};

const createChatMessage = (role: ChatMessage['role'], content: string): ChatMessage => ({
  role,
  content,
  createdAt: timestamp(),
});

const resolveAiConfig = (settings: AiSettings) => {
  const provider = 'openrouter' as const;
  const apiKey = settings.openRouterApiKey;
  const model = settings.openRouterModel;
  if (!apiKey) {
    throw new Error('Add your AI API key in Settings to start chatting.');
  }
  return { provider, apiKey, model };
};

const resolveImageConfig = (settings: AiSettings) => {
  const provider = 'openrouter' as const;
  const apiKey = settings.openRouterApiKey;
  const model = settings.openRouterImageModel;
  if (!apiKey) {
    throw new Error('Add your AI API key in Settings to generate images.');
  }
  if (!model || !supportsImageModel(model)) {
    throw new Error('Image generation is not available for the selected model.');
  }
  return { provider, apiKey, model };
};

const ensureOnline = () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('AI chat is an internet-only feature.');
  }
};

const executeQuickAdd = async (raw: string) => {
  const parseResult = await parserService.parse(raw);

  if (parseResult.errors.length > 0) {
    const errorMsg = parseResult.errors.map((e) => e.message).join('; ');
    throw new Error(errorMsg);
  }

  if (parseResult.trackerData.length === 0) {
    throw new Error('No trackers found in input');
  }

  const now = timestamp();
  const date = dateString(new Date(now));

  const entryData = parseResult.trackerData.map((td) => ({
    trackerId: td.tracker._id,
    trackerTag: td.tracker.tag,
    values: td.values,
    completed: td.completed,
    skipped: td.skipped,
  }));

  await entryRepo.create({
    timestamp: now,
    date,
    raw,
    data: entryData,
    note: parseResult.note || undefined,
  });
};

const runSearch = async (query: string, settings: AiSettings) => {
  const { provider, apiKey, model } = resolveAiConfig(settings);
  if (provider !== 'openrouter') {
    throw new Error('Web search requires OpenRouter.');
  }

  const result = await requestWebSearchSummary({ provider, apiKey, model }, query);
  const sources =
    result.citations.length > 0
      ? result.citations
          .filter((citation) => citation.url)
          .map((citation) => {
            const title = citation.title || citation.url;
            return `- [${title}](${citation.url})`;
          })
          .join('\n')
      : '- No sources returned.';

  return `Summary: ${result.summary}\n\nSources:\n${sources}`;
};

const buildTrackerContext = async (imageAvailable: boolean) => {
  const trackers = await trackerRepo.findAll();
  const active = trackers.filter((tracker) => !tracker.archived);
  const sample = active.slice(0, 40);
  if (sample.length === 0) {
    return 'No trackers exist yet.';
  }

  const lines = sample.map((tracker) => {
    const fields = [...tracker.fields]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((field, index) => {
        const unit = field.unit ? ` (${field.unit})` : '';
        return `${index + 1}) ${field.label}${unit} [${field.type}]`;
      })
      .join(', ');
    return `#${tracker.tag} — ${tracker.label}${fields ? ` | fields: ${fields}` : ''}`;
  });

  return [
    'Available trackers (use #tag with values in order of fields):',
    ...lines,
    'If a tracker has no fields, use a single value after the tag.',
    imageAvailable
      ? 'Image generation is available. Use /image <prompt> when asked for an image.'
      : 'Image generation is not available.',
  ].join('\n');
};

const describeTrackerFields = (tag: string, trackerFields: Array<{ label: string; unit?: string; type: string }>) => {
  const ordered = trackerFields.map((field, index) => {
    const unit = field.unit ? ` (${field.unit})` : '';
    return `${index + 1}) ${field.label}${unit} [${field.type}]`;
  });
  return `For #${tag}, provide values in this order: ${ordered.join(', ')}.`;
};

const validateQuickAdd = async (command: string) => {
  const parsed = await parserService.parse(command);
  if (parsed.errors.length === 0) {
    return { ok: true as const };
  }

  const tracker = parsed.trackerData[0]?.tracker;
  if (tracker) {
    const fields = [...tracker.fields]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((field) => ({
        label: field.label,
        unit: field.unit,
        type: field.type,
      }));
    return {
      ok: false as const,
      message: `${describeTrackerFields(tracker.tag, fields)} ${parsed.errors[0]?.message ?? ''}`.trim(),
    };
  }

  return {
    ok: false as const,
    message: parsed.errors[0]?.message ?? 'Invalid command.',
  };
};

const runImageCommand = async (sessionId: string, prompt: string, settings: AiSettings) => {
  if (!prompt) {
    throw new Error('Image prompt is missing.');
  }
  const { provider, apiKey, model } = resolveImageConfig(settings);
  const result = await generateImage({
    provider,
    apiKey,
    model,
    prompt,
  });
  await sessionRepo.appendChatMessage(sessionId, {
    role: 'assistant',
    content: `Generated image: ${prompt}`,
    createdAt: timestamp(),
    imageDataUrl: result.dataUrl,
    imagePrompt: prompt,
  });
};

export const runChatTurn = async (
  sessionId: string,
  content: string,
  settings: AiSettings,
  imageDataUrl?: string,
) => {
  const trimmed = content.trim();
  if (!trimmed && !imageDataUrl) return;
  ensureOnline();

  const session = await sessionRepo.findById(sessionId);
  if (!session) {
    throw new Error('Session not found.');
  }
  if (session.status !== 'active') {
    throw new Error('This chat session is closed.');
  }

  const userMessage = {
    ...createChatMessage('user', trimmed),
    imageDataUrl: imageDataUrl || undefined,
  };
  await sessionRepo.appendChatMessage(session._id, userMessage);

  if (trimmed.toLowerCase().startsWith('/image')) {
    const prompt = trimmed.replace(/^\/image\s*/i, '').trim();
    await sessionRepo.appendChatMessage(
      session._id,
      createChatMessage('assistant', `Running command: /image ${prompt || ''}`.trim()),
    );
    try {
      await runImageCommand(session._id, prompt, settings);
    } catch (err) {
      const message = (err as Error).message || 'Image generation failed.';
      await sessionRepo.appendChatMessage(
        session._id,
        createChatMessage('assistant', `Command failed: ${message}`),
      );
    }
    return;
  }

  const { provider, apiKey, model } = resolveAiConfig(settings);
  if (imageDataUrl && !supportsVisionModel(model)) {
    await sessionRepo.appendChatMessage(
      session._id,
      createChatMessage('assistant', 'This model does not support image inputs.'),
    );
    return;
  }

  const previousMessages = session.chatMessages ?? [];
  const trackerContext = await buildTrackerContext(
    supportsImageModel(settings.openRouterImageModel),
  );
  const decision = await requestChatDecision({
    provider,
    apiKey,
    model,
    messages: [
      createChatMessage('system', trackerContext),
      ...previousMessages,
      userMessage,
    ],
  });

  if (decision.reply) {
    await sessionRepo.appendChatMessage(
      session._id,
      createChatMessage('assistant', decision.reply),
    );
  }

  if (decision.command) {
    try {
      if (decision.command.toLowerCase().startsWith('/search')) {
        const query = decision.command.replace(/^\/search\s*/i, '').trim();
        if (!query) {
          throw new Error('Search query is missing.');
        }
        await sessionRepo.appendChatMessage(
          session._id,
          createChatMessage('assistant', `Running command: ${decision.command}`),
        );
        const results = await runSearch(query, settings);
        await sessionRepo.appendChatMessage(
          session._id,
          createChatMessage('assistant', results),
        );
      } else if (decision.command.toLowerCase().startsWith('/image')) {
        const prompt = decision.command.replace(/^\/image\s*/i, '').trim();
        await sessionRepo.appendChatMessage(
          session._id,
          createChatMessage('assistant', `Running command: ${decision.command}`),
        );
        await runImageCommand(session._id, prompt, settings);
      } else {
        const validation = await validateQuickAdd(decision.command);
        if (!validation.ok) {
          await sessionRepo.appendChatMessage(
            session._id,
            createChatMessage('assistant', validation.message),
          );
          return;
        }
        await sessionRepo.appendChatMessage(
          session._id,
          createChatMessage('assistant', `Running command: ${decision.command}`),
        );
        await executeQuickAdd(decision.command);
        await sessionRepo.appendChatMessage(
          session._id,
          createChatMessage('assistant', `Logged: ${decision.command}`),
        );
      }
    } catch (err) {
      const message = (err as Error).message || 'Command failed.';
      await sessionRepo.appendChatMessage(
        session._id,
        createChatMessage('assistant', `Command failed: ${message}`),
      );
    }
  }
};

export const runChatTurnStream = async (
  sessionId: string,
  content: string,
  settings: AiSettings,
  imageDataUrl: string | undefined,
  onToken: (chunk: string) => void,
) => {
  const trimmed = content.trim();
  if (!trimmed && !imageDataUrl) return;
  ensureOnline();

  const session = await sessionRepo.findById(sessionId);
  if (!session) {
    throw new Error('Session not found.');
  }
  if (session.status !== 'active') {
    throw new Error('This chat session is closed.');
  }

  const userMessage = {
    ...createChatMessage('user', trimmed),
    imageDataUrl: imageDataUrl || undefined,
  };
  await sessionRepo.appendChatMessage(session._id, userMessage);

  if (trimmed.toLowerCase().startsWith('/image')) {
    const prompt = trimmed.replace(/^\/image\s*/i, '').trim();
    await sessionRepo.appendChatMessage(
      session._id,
      createChatMessage('assistant', `Running command: /image ${prompt || ''}`.trim()),
    );
    try {
      await runImageCommand(session._id, prompt, settings);
    } catch (err) {
      const message = (err as Error).message || 'Image generation failed.';
      await sessionRepo.appendChatMessage(
        session._id,
        createChatMessage('assistant', `Command failed: ${message}`),
      );
    }
    return;
  }

  const { provider, apiKey, model } = resolveAiConfig(settings);
  if (imageDataUrl && !supportsVisionModel(model)) {
    await sessionRepo.appendChatMessage(
      session._id,
      createChatMessage('assistant', 'This model does not support image inputs.'),
    );
    return;
  }

  const previousMessages = session.chatMessages ?? [];
  const trackerContext = await buildTrackerContext(
    supportsImageModel(settings.openRouterImageModel),
  );
  const decision = await requestChatDecision({
    provider,
    apiKey,
    model,
    messages: [
      createChatMessage('system', trackerContext),
      ...previousMessages,
      userMessage,
    ],
  });

  if (!decision.command) {
    let reply = '';
    try {
      for await (const chunk of requestChatResponseStream({
        provider,
        apiKey,
        model,
        messages: [
          createChatMessage('system', trackerContext),
          ...previousMessages,
          userMessage,
        ],
      })) {
        reply += chunk;
        onToken(chunk);
      }
    } catch (err) {
      if (decision.reply) {
        await sessionRepo.appendChatMessage(
          session._id,
          createChatMessage('assistant', decision.reply),
        );
        return;
      }
      throw err;
    }

    const trimmedReply = reply.trim();
    if (trimmedReply) {
      await sessionRepo.appendChatMessage(
        session._id,
        createChatMessage('assistant', trimmedReply),
      );
    }
    return;
  }

  if (decision.reply) {
    await sessionRepo.appendChatMessage(
      session._id,
      createChatMessage('assistant', decision.reply),
    );
  }

  if (decision.command) {
    try {
      if (decision.command.toLowerCase().startsWith('/search')) {
        const query = decision.command.replace(/^\/search\s*/i, '').trim();
        if (!query) {
          throw new Error('Search query is missing.');
        }
        await sessionRepo.appendChatMessage(
          session._id,
          createChatMessage('assistant', `Running command: ${decision.command}`),
        );
        const results = await runSearch(query, settings);
        await sessionRepo.appendChatMessage(
          session._id,
          createChatMessage('assistant', results),
        );
      } else if (decision.command.toLowerCase().startsWith('/image')) {
        const prompt = decision.command.replace(/^\/image\s*/i, '').trim();
        await sessionRepo.appendChatMessage(
          session._id,
          createChatMessage('assistant', `Running command: ${decision.command}`),
        );
        await runImageCommand(session._id, prompt, settings);
      } else {
        const validation = await validateQuickAdd(decision.command);
        if (!validation.ok) {
          await sessionRepo.appendChatMessage(
            session._id,
            createChatMessage('assistant', validation.message),
          );
          return;
        }
        await sessionRepo.appendChatMessage(
          session._id,
          createChatMessage('assistant', `Running command: ${decision.command}`),
        );
        await executeQuickAdd(decision.command);
        await sessionRepo.appendChatMessage(
          session._id,
          createChatMessage('assistant', `Logged: ${decision.command}`),
        );
      }
    } catch (err) {
      const message = (err as Error).message || 'Command failed.';
      await sessionRepo.appendChatMessage(
        session._id,
        createChatMessage('assistant', `Command failed: ${message}`),
      );
    }
  }
};
