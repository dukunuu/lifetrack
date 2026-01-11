import { createMemo, createSignal } from 'solid-js';
import { useSettings } from './useSettings';
import { generateJsonFromSchema } from '../services/ai-json';

interface AiJsonCompletionOptions {
  schema: Record<string, unknown>;
  getPromptContext?: () => string[];
  getJsonValue: () => string;
  onJsonReady: (value: string) => void;
}

export const useAiJsonCompletion = (options: AiJsonCompletionOptions) => {
  const { settings } = useSettings();
  const [aiOpen, setAiOpen] = createSignal(false);
  const [aiPrompt, setAiPrompt] = createSignal('');
  const [aiLoading, setAiLoading] = createSignal(false);
  const [aiError, setAiError] = createSignal<string | null>(null);

  const aiEnabled = createMemo(() => {
    if (settings().ai.provider === 'openai') {
      return settings().ai.openAiApiKey.trim().length > 0;
    }
    return settings().ai.openRouterApiKey.trim().length > 0;
  });

  const reduceMotion = createMemo(() => settings().appearance.reduceMotion);

  const handleGenerateJson = async () => {
    if (!aiPrompt().trim() || !aiEnabled()) return;
    setAiLoading(true);
    setAiError(null);

    const contextLines = options.getPromptContext ? options.getPromptContext() : [];
    const promptParts: string[] = [aiPrompt().trim()];
    if (contextLines.length > 0) {
      promptParts.push('', ...contextLines);
    }
    promptParts.push('', 'Current JSON:', options.getJsonValue());

    try {
      const result = await generateJsonFromSchema({
        provider: settings().ai.provider,
        apiKey:
          settings().ai.provider === 'openai'
            ? settings().ai.openAiApiKey.trim()
            : settings().ai.openRouterApiKey.trim(),
        model:
          settings().ai.provider === 'openai'
            ? settings().ai.openAiModel
            : settings().ai.openRouterModel,
        schema: options.schema,
        prompt: promptParts.join('\n'),
      });
      options.onJsonReady(result);
    } catch (err) {
      setAiError((err as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  return {
    aiOpen,
    setAiOpen,
    aiPrompt,
    setAiPrompt,
    aiLoading,
    aiError,
    aiEnabled,
    reduceMotion,
    handleGenerateJson,
    clearAiError: () => setAiError(null),
  };
};
