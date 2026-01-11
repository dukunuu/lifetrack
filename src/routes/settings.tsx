import { For, Show, createSignal } from 'solid-js';
import { Cloud, Sparkles, Palette, SlidersHorizontal, Eye, EyeOff } from 'lucide-solid';
import { useSettings } from '../lib/hooks/useSettings';
import { destroyDatabase } from '../lib/db';
import { OPENAI_MODELS, OPENROUTER_MODELS } from '../lib/constants/ai-models';

const THEMES = [
  { id: 'lifetrack', label: 'Lifetrack (default)' },
  { id: 'graphite', label: 'Graphite' },
  { id: 'linen', label: 'Linen (light)' },
  { id: 'cyberpunk', label: 'Cyberpunk' },
];

export default function Settings() {
  const { settings, setSettings, resetSettings } = useSettings();
  const [showSyncKey, setShowSyncKey] = createSignal(false);
  const [showSyncPassword, setShowSyncPassword] = createSignal(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = createSignal(false);
  const [purgeLoading, setPurgeLoading] = createSignal(false);

  const updateSync = (
    field: 'enabled' | 'endpoint' | 'username' | 'password' | 'apiKey',
    value: boolean | string,
  ) => {
    setSettings((prev) => ({
      ...prev,
      sync: {
        ...prev.sync,
        [field]: value,
      },
    }));
  };

  const updateAi = (
    field: 'provider' | 'openRouterApiKey' | 'openRouterModel' | 'openAiApiKey' | 'openAiModel',
    value: string,
  ) => {
    setSettings((prev) => ({
      ...prev,
      ai: {
        ...prev.ai,
        [field]: value,
      },
    }));
  };

  const updateAppearanceTheme = (value: string) => {
    setSettings((prev) => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        theme: value,
      },
    }));
  };

  const updateAppearanceReduceMotion = (value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        reduceMotion: value,
      },
    }));
  };

  const updateAppearanceTimeFormat = (value: '12h' | '24h') => {
    setSettings((prev) => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        timeFormat: value,
      },
    }));
  };

  const updateQuickAdd = (field: 'showSessionTimer', value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      quickAdd: {
        ...prev.quickAdd,
        [field]: value,
      },
    }));
  };

  const handlePurge = async () => {
    const confirmed = confirm(
      'This will delete all local data (trackers, entries, sessions, goals). This cannot be undone. Continue?',
    );
    if (!confirmed) return;

    try {
      setPurgeLoading(true);
      await destroyDatabase();
      window.location.reload();
    } catch (err) {
      console.error('Failed to purge local data:', err);
      alert('Failed to delete local data. Please try again.');
    } finally {
      setPurgeLoading(false);
    }
  };

  return (
    <div class="flex-1 p-6 lg:p-8">
      <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold">Settings</h1>
          <p class="text-base-content/60">
            Customize sync, AI, appearance, and quick-add behavior.
          </p>
        </div>
        <button type="button" class="btn btn-ghost" onClick={resetSettings}>
          Reset to defaults
        </button>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <section class="border-base-300/50 bg-base-100/70 rounded-2xl border p-6 shadow-sm">
          <div class="mb-5 flex items-center gap-3">
            <div class="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
              <Cloud class="size-5" />
            </div>
            <div>
              <h2 class="text-lg font-bold">Sync</h2>
              <p class="text-base-content/60 text-sm">CouchDB or custom sync endpoint.</p>
            </div>
          </div>

          <div class="space-y-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-base-content/70 text-sm font-semibold">Enable sync</div>
                <div class="text-base-content/50 text-xs">
                  Automatically sync when the app is online.
                </div>
              </div>
              <input
                type="checkbox"
                class="toggle toggle-primary"
                checked={settings().sync.enabled}
                onChange={(e) => updateSync('enabled', e.currentTarget.checked)}
              />
            </div>

            <label class="form-control w-full">
              <div class="label">
                <span class="label-text text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                  Sync endpoint
                </span>
              </div>
              <input
                class="input input-bordered w-full"
                value={settings().sync.endpoint}
                onInput={(e) => updateSync('endpoint', e.currentTarget.value)}
                placeholder="https://sync.example.com"
              />
            </label>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                    CouchDB username
                  </span>
                </div>
                <input
                  class="input input-bordered w-full"
                  value={settings().sync.username}
                  onInput={(e) => updateSync('username', e.currentTarget.value)}
                  placeholder="admin"
                />
              </label>

              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                    CouchDB password
                  </span>
                </div>
                <div class="flex gap-2">
                  <input
                    class="input input-bordered flex-1"
                    type={showSyncPassword() ? 'text' : 'password'}
                    value={settings().sync.password}
                    onInput={(e) => updateSync('password', e.currentTarget.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    class="btn btn-ghost btn-square"
                    onClick={() => setShowSyncPassword((prev) => !prev)}
                    aria-label={showSyncPassword() ? 'Hide password' : 'Show password'}
                  >
                    <Show when={showSyncPassword()} fallback={<Eye class="size-4" />}>
                      <EyeOff class="size-4" />
                    </Show>
                  </button>
                </div>
              </label>
            </div>

            <label class="form-control w-full">
              <div class="label">
                <span class="label-text text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                  Auth API key (optional)
                </span>
              </div>
              <div class="flex gap-2">
                <input
                  class="input input-bordered flex-1"
                  type={showSyncKey() ? 'text' : 'password'}
                  value={settings().sync.apiKey}
                  onInput={(e) => updateSync('apiKey', e.currentTarget.value)}
                  placeholder="sk_live_..."
                />
                <button
                  type="button"
                  class="btn btn-ghost btn-square"
                  onClick={() => setShowSyncKey((prev) => !prev)}
                  aria-label={showSyncKey() ? 'Hide API key' : 'Show API key'}
                >
                  <Show when={showSyncKey()} fallback={<Eye class="size-4" />}>
                    <EyeOff class="size-4" />
                  </Show>
                </button>
              </div>
            </label>
          </div>
        </section>

        <section class="border-base-300/50 bg-base-100/70 rounded-2xl border p-6 shadow-sm">
          <div class="mb-5 flex items-center gap-3">
            <div class="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
              <Sparkles class="size-5" />
            </div>
            <div>
              <h2 class="text-lg font-bold">AI</h2>
              <p class="text-base-content/60 text-sm">Choose a provider for AI features.</p>
            </div>
          </div>

          <div class="space-y-5">
            <label class="form-control w-full">
              <div class="label">
                <span class="label-text text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                  Provider
                </span>
              </div>
              <select
                class="select select-bordered w-full"
                value={settings().ai.provider}
                onChange={(e) => updateAi('provider', e.currentTarget.value)}
              >
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
              </select>
            </label>

            <Show when={settings().ai.provider === 'openrouter'}>
              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                    OpenRouter API key
                  </span>
                </div>
                <div class="flex gap-2">
                  <input
                    class="input input-bordered flex-1"
                    type={showOpenRouterKey() ? 'text' : 'password'}
                    value={settings().ai.openRouterApiKey}
                    onInput={(e) => updateAi('openRouterApiKey', e.currentTarget.value)}
                    placeholder="or-..."
                  />
                  <button
                    type="button"
                    class="btn btn-ghost btn-square"
                    onClick={() => setShowOpenRouterKey((prev) => !prev)}
                    aria-label={showOpenRouterKey() ? 'Hide API key' : 'Show API key'}
                  >
                    <Show when={showOpenRouterKey()} fallback={<Eye class="size-4" />}>
                      <EyeOff class="size-4" />
                    </Show>
                  </button>
                </div>
              </label>

              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                    OpenRouter model
                  </span>
                </div>
                <select
                  class="select select-bordered w-full"
                  value={settings().ai.openRouterModel}
                  onChange={(e) => updateAi('openRouterModel', e.currentTarget.value)}
                >
                  <For each={OPENROUTER_MODELS}>
                    {(model) => <option value={model}>{model}</option>}
                  </For>
                </select>
              </label>
            </Show>

            <Show when={settings().ai.provider === 'openai'}>
              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                    OpenAI API key
                  </span>
                </div>
                <div class="flex gap-2">
                  <input
                    class="input input-bordered flex-1"
                    type={showOpenRouterKey() ? 'text' : 'password'}
                    value={settings().ai.openAiApiKey}
                    onInput={(e) => updateAi('openAiApiKey', e.currentTarget.value)}
                    placeholder="sk-..."
                  />
                  <button
                    type="button"
                    class="btn btn-ghost btn-square"
                    onClick={() => setShowOpenRouterKey((prev) => !prev)}
                    aria-label={showOpenRouterKey() ? 'Hide API key' : 'Show API key'}
                  >
                    <Show when={showOpenRouterKey()} fallback={<Eye class="size-4" />}>
                      <EyeOff class="size-4" />
                    </Show>
                  </button>
                </div>
              </label>

              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                    OpenAI model
                  </span>
                </div>
                <select
                  class="select select-bordered w-full"
                  value={settings().ai.openAiModel}
                  onChange={(e) => updateAi('openAiModel', e.currentTarget.value)}
                >
                  <For each={OPENAI_MODELS}>
                    {(model) => <option value={model}>{model}</option>}
                  </For>
                </select>
              </label>
            </Show>

            <div class="text-base-content/50 text-xs">
              API keys are stored locally in your browser. AI requests are sent directly to the
              selected provider.
            </div>
          </div>
        </section>

        <section class="border-base-300/50 bg-base-100/70 rounded-2xl border p-6 shadow-sm">
          <div class="mb-5 flex items-center gap-3">
            <div class="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
              <Palette class="size-5" />
            </div>
            <div>
              <h2 class="text-lg font-bold">Appearance</h2>
              <p class="text-base-content/60 text-sm">Theme and motion preferences.</p>
            </div>
          </div>

          <div class="space-y-5">
            <label class="form-control w-full">
              <div class="label">
                <span class="label-text text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                  Theme
                </span>
              </div>
              <select
                class="select select-bordered w-full"
                value={settings().appearance.theme}
                onChange={(e) => updateAppearanceTheme(e.currentTarget.value)}
              >
                <For each={THEMES}>
                  {(theme) => <option value={theme.id}>{theme.label}</option>}
                </For>
              </select>
            </label>

            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-base-content/70 text-sm font-semibold">Reduce motion</div>
                <div class="text-base-content/50 text-xs">
                  Minimize animations and transitions.
                </div>
              </div>
              <input
                type="checkbox"
                class="toggle toggle-primary"
                checked={settings().appearance.reduceMotion}
                onChange={(e) => updateAppearanceReduceMotion(e.currentTarget.checked)}
              />
            </div>

            <div class="space-y-2">
              <div class="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                Time format
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  class={`btn btn-sm ${settings().appearance.timeFormat === '24h' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => updateAppearanceTimeFormat('24h')}
                >
                  24h
                </button>
                <button
                  type="button"
                  class={`btn btn-sm ${settings().appearance.timeFormat === '12h' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => updateAppearanceTimeFormat('12h')}
                >
                  12h
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="border-base-300/50 bg-base-100/70 rounded-2xl border p-6 shadow-sm">
          <div class="mb-5 flex items-center gap-3">
            <div class="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
              <SlidersHorizontal class="size-5" />
            </div>
            <div>
              <h2 class="text-lg font-bold">Quick Add</h2>
              <p class="text-base-content/60 text-sm">Tune quick-add suggestions.</p>
            </div>
          </div>

          <div class="space-y-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-base-content/70 text-sm font-semibold">
                  Show session timer in command suggestions
                </div>
                <div class="text-base-content/50 text-xs">
                  Helpful for tracking how long a session has been active.
                </div>
              </div>
              <input
                type="checkbox"
                class="toggle toggle-primary"
                checked={settings().quickAdd.showSessionTimer}
                onChange={(e) => updateQuickAdd('showSessionTimer', e.currentTarget.checked)}
              />
            </div>

            <div class="text-base-content/50 text-xs">
              Changes save automatically to your device.
            </div>
          </div>
        </section>

        <section class="border-base-300/50 bg-base-100/70 rounded-2xl border p-6 shadow-sm">
          <div class="mb-5 flex items-center gap-3">
            <div class="bg-error/10 text-error grid size-10 place-items-center rounded-xl">
              <Cloud class="size-5" />
            </div>
            <div>
              <h2 class="text-lg font-bold">Danger Zone</h2>
              <p class="text-base-content/60 text-sm">Irreversible actions.</p>
            </div>
          </div>

          <div class="space-y-4">
            <div class="text-base-content/60 text-sm">
              Delete all local data stored on this device. This does not affect any remote sync
              database.
            </div>
            <button
              type="button"
              class="btn btn-error"
              onClick={handlePurge}
              disabled={purgeLoading()}
            >
              {purgeLoading() ? 'Deleting...' : 'Delete local data'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
