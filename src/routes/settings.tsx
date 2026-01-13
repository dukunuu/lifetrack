import { For, Show, createSignal, onMount } from 'solid-js';
import { Cloud, Sparkles, Palette, SlidersHorizontal, Eye, EyeOff } from 'lucide-solid';
import { useSearchParams } from '@solidjs/router';
import { useSettings } from '../lib/hooks/useSettings';
import {
  ACTIVE_INDEX_NAMES,
  cleanupIndexes,
  destroyDatabase,
  exportDatabase,
  getConflictCount,
  resolveConflicts,
  runMaintenance,
} from '../lib/db';
import { OPENROUTER_MODELS } from '../lib/constants/ai-models';

const THEMES = [
  { id: 'lifetrack', label: 'Lifetrack (default)' },
  { id: 'graphite', label: 'Graphite' },
  { id: 'linen', label: 'Linen (light)' },
  { id: 'cyberpunk', label: 'Cyberpunk' },
  { id: 'gothic', label: 'Gothic' },
];

export default function Settings() {
  const { settings, setSettings, resetSettings } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSyncKey, setShowSyncKey] = createSignal(false);
  const [showSyncPassword, setShowSyncPassword] = createSignal(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = createSignal(false);
  const [purgeLoading, setPurgeLoading] = createSignal(false);
  const [maintenanceLoading, setMaintenanceLoading] = createSignal(false);
  const [exportLoading, setExportLoading] = createSignal(false);
  const [conflictCount, setConflictCount] = createSignal<number | null>(null);
  const [conflictLoading, setConflictLoading] = createSignal(false);
  const [indexCleanupLoading, setIndexCleanupLoading] = createSignal(false);
  const [indexCleanupCount, setIndexCleanupCount] = createSignal<number | null>(null);
  const [storageUsage, setStorageUsage] = createSignal<number | null>(null);
  const [storageQuota, setStorageQuota] = createSignal<number | null>(null);
  const [storagePersisted, setStoragePersisted] = createSignal<boolean | null>(null);

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

  const updateAi = (field: 'openRouterApiKey' | 'openRouterModel', value: string) => {
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

  const updateAppearanceHistoryView = (value: 'day' | 'week' | 'month') => {
    setSettings((prev) => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        defaultHistoryView: value,
      },
    }));
  };

  const updateAppearanceHistoryStartHour = (value: number) => {
    setSettings((prev) => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        historyStartHour: value,
      },
    }));
  };

  const formatHourOption = (hour: number) => {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      hour12: settings().appearance.timeFormat === '12h',
    });
  };

  const updateQuickAdd = (field: 'showSessionTimer' | 'usePopup', value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      quickAdd: {
        ...prev.quickAdd,
        [field]: value,
      },
    }));
  };

  const openHelp = (section: 'sync' | 'ai') => {
    setSearchParams({ help: section });
  };

  const closeHelp = () => {
    setSearchParams({ help: undefined });
  };

  const helpSection = () => {
    const value = searchParams.help;
    return value === 'sync' || value === 'ai' ? value : null;
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

  const refreshStorageEstimate = async () => {
    if (!navigator.storage?.estimate) return;
    const estimate = await navigator.storage.estimate();
    setStorageUsage(typeof estimate.usage === 'number' ? estimate.usage : null);
    setStorageQuota(typeof estimate.quota === 'number' ? estimate.quota : null);
  };

  const refreshStoragePersisted = async () => {
    if (!navigator.storage?.persisted) return;
    const persisted = await navigator.storage.persisted();
    setStoragePersisted(persisted);
  };

  const requestPersistentStorage = async () => {
    if (!navigator.storage?.persist) return;
    const persisted = await navigator.storage.persist();
    setStoragePersisted(persisted);
  };

  const handleMaintenance = async () => {
    try {
      setMaintenanceLoading(true);
      await runMaintenance();
      await refreshStorageEstimate();
    } catch (err) {
      console.error('Maintenance failed:', err);
      alert('Maintenance failed. Please try again.');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      const blob = await exportDatabase();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestampLabel = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `lifetrack-export-${timestampLabel}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const refreshConflictCount = async () => {
    try {
      const count = await getConflictCount();
      setConflictCount(count);
    } catch (err) {
      console.error('Failed to load conflict count:', err);
      setConflictCount(null);
    }
  };

  const handleResolveConflicts = async () => {
    try {
      setConflictLoading(true);
      const resolved = await resolveConflicts();
      await refreshConflictCount();
      alert(resolved > 0 ? `Resolved ${resolved} conflicting revisions.` : 'No conflicts found.');
    } catch (err) {
      console.error('Conflict resolution failed:', err);
      alert('Conflict resolution failed. Please try again.');
    } finally {
      setConflictLoading(false);
    }
  };

  const handleCleanupIndexes = async () => {
    try {
      setIndexCleanupLoading(true);
      const removed = await cleanupIndexes(ACTIVE_INDEX_NAMES);
      setIndexCleanupCount(removed);
    } catch (err) {
      console.error('Index cleanup failed:', err);
      alert('Index cleanup failed. Please try again.');
    } finally {
      setIndexCleanupLoading(false);
    }
  };

  const formatBytes = (value: number | null) => {
    if (value === null) return 'Unknown';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let remaining = value;
    let unitIndex = 0;
    while (remaining >= 1024 && unitIndex < units.length - 1) {
      remaining /= 1024;
      unitIndex += 1;
    }
    return `${remaining.toFixed(1)} ${units[unitIndex]}`;
  };

  onMount(() => {
    refreshStorageEstimate();
    refreshStoragePersisted();
    refreshConflictCount();
  });

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
            <button
              type="button"
              class="btn btn-ghost btn-sm ml-auto"
              onClick={() => openHelp('sync')}
              aria-label="Sync help"
              title="Sync help"
            >
              ?
            </button>
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
              <SlidersHorizontal class="size-5" />
            </div>
            <div>
              <h2 class="text-lg font-bold">Storage & Maintenance</h2>
              <p class="text-base-content/60 text-sm">
                Track local storage usage and keep the database compact.
              </p>
            </div>
          </div>

          <div class="space-y-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-base-content/70 text-sm font-semibold">Local storage usage</div>
                <div class="text-base-content/50 text-xs">
                  {formatBytes(storageUsage())} used of {formatBytes(storageQuota())}
                </div>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                onClick={refreshStorageEstimate}
              >
                Refresh
              </button>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-base-content/70 text-sm font-semibold">Persistent storage</div>
                <div class="text-base-content/50 text-xs">
                  {storagePersisted() === null
                    ? 'Status unavailable'
                    : storagePersisted()
                      ? 'Enabled'
                      : 'Not enabled'}
                </div>
              </div>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                disabled={storagePersisted() === true}
                onClick={requestPersistentStorage}
              >
                Request
              </button>
            </div>

            <div class="border-base-content/10 border-t pt-4">
              <div class="text-base-content/70 text-sm font-semibold">Maintenance</div>
              <div class="text-base-content/50 text-xs">
                Compact the database and clean up view indexes.
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm mt-3"
                onClick={handleMaintenance}
                disabled={maintenanceLoading()}
              >
                {maintenanceLoading() ? 'Running…' : 'Run maintenance'}
              </button>
            </div>

            <div class="border-base-content/10 border-t pt-4">
              <div class="text-base-content/70 text-sm font-semibold">Export data</div>
              <div class="text-base-content/50 text-xs">
                Download a full backup with attachments (JSON).
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm mt-3"
                onClick={handleExport}
                disabled={exportLoading()}
              >
                {exportLoading() ? 'Preparing…' : 'Download backup'}
              </button>
            </div>

            <div class="border-base-content/10 border-t pt-4">
              <div class="text-base-content/70 text-sm font-semibold">Conflict resolution</div>
              <div class="text-base-content/50 text-xs">
                {conflictCount() === null
                  ? 'Conflict status unavailable.'
                  : `${conflictCount()} conflict${conflictCount() === 1 ? '' : 's'} detected.`}
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm mt-3"
                onClick={handleResolveConflicts}
                disabled={conflictLoading()}
              >
                {conflictLoading() ? 'Resolving…' : 'Resolve conflicts'}
              </button>
            </div>

            <div class="border-base-content/10 border-t pt-4">
              <div class="text-base-content/70 text-sm font-semibold">Index cleanup</div>
              <div class="text-base-content/50 text-xs">
                {indexCleanupCount() === null
                  ? 'Remove stale find indexes.'
                  : `Removed ${indexCleanupCount()} index${indexCleanupCount() === 1 ? '' : 'es'}.`}
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm mt-3"
                onClick={handleCleanupIndexes}
                disabled={indexCleanupLoading()}
              >
                {indexCleanupLoading() ? 'Cleaning…' : 'Clean indexes'}
              </button>
            </div>
          </div>
        </section>

        <section class="border-base-300/50 bg-base-100/70 rounded-2xl border p-6 shadow-sm">
          <div class="mb-5 flex items-center gap-3">
            <div class="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
              <Sparkles class="size-5" />
            </div>
            <div>
              <h2 class="text-lg font-bold">AI</h2>
              <p class="text-base-content/60 text-sm">Configure OpenRouter for AI features.</p>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm ml-auto"
              onClick={() => openHelp('ai')}
              aria-label="AI help"
              title="AI help"
            >
              ?
            </button>
          </div>

          <div class="space-y-5">
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

            <div class="text-base-content/50 text-xs">
              API keys are stored locally in your browser. AI requests are sent directly to
              OpenRouter.
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

            <label class="form-control w-full">
              <div class="label">
                <span class="label-text text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                  Default history view
                </span>
              </div>
              <select
                class="select select-bordered w-full"
                value={settings().appearance.defaultHistoryView}
                onChange={(e) =>
                  updateAppearanceHistoryView(
                    e.currentTarget.value as 'day' | 'week' | 'month',
                  )
                }
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
              <div class="text-base-content/50 mt-2 text-xs">
                Small screens always use Day view.
              </div>
            </label>

            <label class="form-control w-full">
              <div class="label">
                <span class="label-text text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                  History start hour
                </span>
              </div>
              <select
                class="select select-bordered w-full"
                value={settings().appearance.historyStartHour}
                onChange={(e) =>
                  updateAppearanceHistoryStartHour(Number(e.currentTarget.value))
                }
              >
                <For each={Array.from({ length: 24 }, (_, hour) => hour)}>
                  {(hour) => <option value={hour}>{formatHourOption(hour)}</option>}
                </For>
              </select>
              <div class="text-base-content/50 mt-2 text-xs">
                Applies to day and week grids.
              </div>
            </label>
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
                <div class="text-base-content/70 text-sm font-semibold">Use pop-up Quick Add</div>
                <div class="text-base-content/50 text-xs">
                  Hide the docked bar and open Quick Add from a floating button.
                </div>
              </div>
              <input
                type="checkbox"
                class="toggle toggle-primary"
                checked={settings().quickAdd.usePopup}
                onChange={(e) => updateQuickAdd('usePopup', e.currentTarget.checked)}
              />
            </div>

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

      <Show when={helpSection()}>
        <div class="modal modal-open backdrop-blur-sm">
          <div class="modal-box bg-base-200 border-base-300 relative w-full max-w-2xl border">
            <button
              type="button"
              class="btn btn-sm btn-circle absolute right-4 top-4"
              aria-label="Close help"
              onClick={closeHelp}
            >
              <span class="text-lg leading-none">×</span>
            </button>
            <Show when={helpSection() === 'sync'}>
              <div class="space-y-4">
                <h3 class="text-xl font-bold">Enable Sync</h3>
                <ol class="list-decimal space-y-2 pl-5 text-sm text-base-content/80">
                  <li>Deploy a CouchDB instance reachable from the browser (HTTPS recommended).</li>
                  <li>Configure CouchDB CORS to allow your frontend origin.</li>
                  <li>Create a per-user database and user credentials in CouchDB.</li>
                  <li>
                    In Settings {'->'} Sync, enter the endpoint (example:
                    <span class="font-semibold"> https://couch.example.com/dukunuu-db</span>),
                    username, and password, then enable sync.
                  </li>
                </ol>
                <div class="text-xs text-base-content/60">
                  The endpoint should point directly to the user database.
                </div>
              </div>
            </Show>
            <Show when={helpSection() === 'ai'}>
              <div class="space-y-4">
                <h3 class="text-xl font-bold">Enable AI Features</h3>
                <ol class="list-decimal space-y-2 pl-5 text-sm text-base-content/80">
                  <li>Create an OpenRouter API key.</li>
                  <li>In Settings {'->'} AI, enter the API key.</li>
                  <li>Select a model if needed.</li>
                </ol>
                <div class="text-xs text-base-content/60">
                  API keys are stored locally in your browser settings.
                </div>
              </div>
            </Show>
          </div>
          <div class="modal-backdrop">
            <button type="button" onClick={closeHelp}>
              close
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
