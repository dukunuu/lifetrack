import { Show, For, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Zap, Hash, Pin, Clock, Command } from 'lucide-solid';
import { Tokenizer } from '../../lib/services/parser/tokenizer';
import { useGroups } from '../../lib/hooks/useGroups';
import { useTrackers } from '../../lib/hooks/useTrackers';
import { useQuickAdd } from '../../lib/hooks/useQuickAdd';
import { useSession } from '../../lib/hooks/useSession';
import { useSettings } from '../../lib/hooks/useSettings';

const tokenizer = new Tokenizer();

type QuickAddProps = {
  showPinnedTrackers?: boolean;
  openUp?: boolean;
  fixed?: boolean;
};

export default function QuickAdd(props: QuickAddProps) {
  const {
    input,
    setInput,
    suggestions,
    selectedIndex,
    showSuggestions,
    setShowSuggestions,
    loading,
    error,
    selectSuggestion,
    handleKeyDown,
    submit,
  } = useQuickAdd();

  const { groups } = useGroups();
  const { trackers } = useTrackers();
  const { activeSession } = useSession();
  const { settings } = useSettings();
  const [sessionNow, setSessionNow] = createSignal(Date.now());
  const groupMap = createMemo(() => {
    const map = new Map<string, { icon?: string; color?: string }>();
    groups().forEach((group) => map.set(group._id, { icon: group.icon, color: group.color }));
    return map;
  });

  const pinnedTrackers = createMemo(() => {
    const sessionGroupId = activeSession()?.groupId;
    return trackers()
      .filter((tracker) => tracker.pinned && !tracker.archived)
      .filter((tracker) => {
        if (!sessionGroupId) return true;
        return (
          tracker.groupId === sessionGroupId ||
          (tracker.additionalGroupIds?.includes(sessionGroupId) ?? false)
        );
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
      .slice(0, 8);
  });

  const sessionDurationLabel = createMemo(() => {
    const session = activeSession();
    if (!session) return '';
    const start = new Date(session.startTime).getTime();
    const seconds = Math.max(0, Math.floor((sessionNow() - start) / 1000));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins.toString().padStart(2, '0')}m`;
    }
    return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
  });

  const showSessionTimer = createMemo(() => settings().quickAdd.showSessionTimer);

  let inputRef: HTMLInputElement | undefined;
  let dropdownRef: HTMLUListElement | undefined;

  // Close dropdown on click outside
  createEffect(() => {
    if (showSuggestions()) {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          dropdownRef &&
          inputRef &&
          !dropdownRef.contains(e.target as Node) &&
          !inputRef.contains(e.target as Node)
        ) {
          setShowSuggestions(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      onCleanup(() => document.removeEventListener('mousedown', handleClickOutside));
    }
  });

  createEffect(() => {
    if (!activeSession()) return;
    const timer = setInterval(() => setSessionNow(Date.now()), 1000);
    onCleanup(() => clearInterval(timer));
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    try {
      await submit();
    } catch (err) {
      // Error is already set in hook
      console.error('Submit error:', err);
    }
  };

  const getSuggestionIcon = (reason: string) => {
    switch (reason) {
      case 'pinned':
        return <Pin class="size-3" />;
      case 'recent':
        return <Clock class="size-3" />;
      default:
        return <Hash class="size-3" />;
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'pinned':
        return 'Pinned';
      case 'recent':
        return 'Recent';
      case 'fuzzy':
        return 'Match';
      default:
        return '';
    }
  };

  const tagContext = createMemo(() => {
    const value = input();
    const tokens = tokenizer.tokenize(value);
    const tagTokens = tokens.filter((token) => token.type === 'tag');
    if (tagTokens.length === 0) return null;

    const currentTagToken = tagTokens[tagTokens.length - 1];
    const segmentValues = tokenizer.extractValues(value, currentTagToken.endIndex);

    const inlineScaleValues = tokens
      .filter((token) => token.type === 'value')
      .filter((token) => token.startIndex >= currentTagToken.startIndex)
      .map((token) => token.value);

    const combinedValues = [...inlineScaleValues, ...segmentValues]
      .map((val) => val.trim())
      .filter((val) => val.length > 0 && !val.startsWith('/'));

    return {
      values: combinedValues,
    };
  });

  const activeValueTokens = createMemo(() => tagContext()?.values ?? []);

  const activeSuggestion = createMemo(() => {
    const currentSuggestions = suggestions();
    if (currentSuggestions.length === 0) return undefined;
    const index = selectedIndex();
    const boundedIndex = Math.max(0, Math.min(index, currentSuggestions.length - 1));
    return currentSuggestions[boundedIndex];
  });

  const activeTrackerSuggestion = createMemo(() => {
    const suggestion = activeSuggestion();
    return suggestion && suggestion.type === 'tracker' ? suggestion : undefined;
  });

  const activeGroupMeta = createMemo(() => {
    const suggestion = activeSuggestion();
    const tracker = suggestion && suggestion.type === 'tracker' ? suggestion.tracker : undefined;
    return tracker ? groupMap().get(tracker.groupId) : undefined;
  });

  const activeFields = createMemo(() => {
    const suggestion = activeSuggestion();
    const tracker = suggestion && suggestion.type === 'tracker' ? suggestion.tracker : undefined;
    if (!tracker) return [];

    return [...tracker.fields].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  });

  const parameterStates = createMemo(() => {
    const fields = activeFields();
    const filledValues = activeValueTokens();
    return fields.map((field, index) => ({
      field,
      active: index < filledValues.length,
    }));
  });

  const activeAccentColor = createMemo(() => activeGroupMeta()?.color);

  const insertTag = (tag: string) => {
    const value = input().trim();
    const next = value.length > 0 ? `${value} #${tag} ` : `#${tag} `;
    setInput(next);
    inputRef?.focus();
  };

  return (
    <div
      class="bg-base-200 border-primary/10 relative rounded-2xl border shadow-2xl"
      classList={{ 'mb-8': !props.fixed }}
    >

      <div class="relative p-6">
        <div class="mb-4 flex items-center gap-2">
          <Zap class="text-primary size-5" />
          <h2 class="text-lg font-bold">Quick Add</h2>
        </div>

        <p class="text-base-content/60 mb-4 text-sm">
          Track anything with simple commands like{' '}
          <code class="bg-base-100/50 text-primary rounded px-2 py-1 font-mono text-xs">
            #water 500ml
          </code>
        </p>

        <Show when={(props.showPinnedTrackers ?? true) && pinnedTrackers().length > 0}>
          <div class="mb-4">
            <div class="text-base-content/40 mb-2 flex items-center gap-2 text-xs font-bold tracking-widest uppercase">
              <Pin class="size-3" />
              Pinned Trackers
            </div>
            <div class="flex flex-wrap gap-2">
              <For each={pinnedTrackers()}>
                {(tracker) => {
                  const meta = groupMap().get(tracker.groupId);
                  const accent = meta?.color;
                  return (
                    <button
                      type="button"
                      class="badge badge-lg bg-base-100/70 border-base-300/70 hover:border-primary/40 gap-2 border transition-colors"
                      style={{
                        'border-color': accent ?? undefined,
                        color: accent ?? undefined,
                      }}
                      onClick={() => insertTag(tracker.tag)}
                      title={tracker.label}
                    >
                      <Show when={meta?.icon}>
                        <span>{meta?.icon}</span>
                      </Show>
                      <span class="font-mono text-xs">#{tracker.tag}</span>
                      <span class="text-base-content/60 max-w-[140px] truncate text-xs">
                        {tracker.label}
                      </span>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        <form onSubmit={handleSubmit}>
          <div class="form-control">
            <div class="relative">
              <input
                ref={inputRef}
                type="text"
                value={input()}
                onInput={(e) => setInput(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command... e.g., #coffee #workout 30min"
                class="input input-bordered bg-base-100/50 border-base-300/50 focus:border-primary/50 w-full transition-colors"
                disabled={loading()}
              />

              <div
                class="flex flex-col gap-2"
                classList={{
                  'absolute bottom-full left-0 right-0 mb-2': props.openUp,
                  'z-20': props.openUp,
                }}
              >
                <Show
                  when={
                    showSuggestions() && parameterStates().length > 0 && activeTrackerSuggestion()
                  }
                >
                  <div
                    class="bg-base-200/40 text-base-content/70 rounded-2xl border p-3 text-xs"
                    classList={{ 'mt-3': !props.openUp }}
                    style={{
                      'border-color': activeAccentColor() ?? undefined,
                      'box-shadow': activeAccentColor()
                        ? `0 0 20px ${activeAccentColor()}22`
                        : undefined,
                    }}
                  >
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-[10px] font-semibold tracking-widest uppercase">
                        Active parameters
                      </span>
                      <span class="text-base-content/50 font-mono text-[11px]">
                        #{activeTrackerSuggestion()!.tracker.tag}
                      </span>
                    </div>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <For each={parameterStates()}>
                        {(parameter) => {
                          const badgeStyle =
                            parameter.active && activeAccentColor()
                              ? {
                                  'border-color': activeAccentColor(),
                                  color: activeAccentColor(),
                                  'background-color': `${activeAccentColor()}1A`,
                                }
                              : undefined;
                          return (
                            <div
                              class={`badge badge-sm gap-1 text-[11px] ${
                                parameter.active ? '' : 'badge-outline text-base-content/60'
                              }`}
                              style={badgeStyle}
                            >
                              <span>{parameter.field.label}</span>
                              <Show when={parameter.field.unit}>
                                <span class="text-base-content/50 text-[10px] tracking-widest uppercase">
                                  {parameter.field.unit}
                                </span>
                              </Show>
                              <Show when={parameter.field.required}>
                                <span class="text-warning text-[10px] font-bold">req</span>
                              </Show>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                </Show>

                {/* Autocomplete Dropdown - DaisyUI Menu */}
                <Show when={showSuggestions() && suggestions().length > 0}>
                  <ul
                    ref={dropdownRef}
                    class="menu bg-base-200 rounded-box border-base-300 max-h-96 overflow-y-auto border p-2 shadow-2xl"
                    classList={{ 'mt-2': !props.openUp }}
                  >
                    <For each={suggestions()}>
                      {(suggestion, index) => {
                        const trackerSuggestion =
                          suggestion.type === 'tracker' ? suggestion : undefined;
                        const commandSuggestion =
                          suggestion.type === 'command' ? suggestion : undefined;
                        const isTrackerSuggestion = !!trackerSuggestion;
                        const tracker = trackerSuggestion?.tracker;
                        const groupMeta = tracker ? groupMap().get(tracker.groupId) : undefined;
                        const accentColor = groupMeta?.color;
                        const emoji = groupMeta?.icon;

                        return (
                          <li>
                            <button
                              type="button"
                              class={`quickadd-suggestion flex items-center gap-3 ${
                                index() === selectedIndex() ? 'is-active' : ''
                              }`}
                              style={{
                                '--accent-color': accentColor ?? 'oklch(var(--p))',
                                '--accent-color-soft': accentColor
                                  ? `${accentColor}1A`
                                  : 'oklch(var(--p) / 0.12)',
                                'box-shadow': accentColor ? `0 0 20px ${accentColor}22` : undefined,
                              }}
                              onClick={() => selectSuggestion(suggestion)}
                            >
                              {/* Icon */}
                              <div class="flex-shrink-0">
                                <div class="avatar placeholder">
                                  <div
                                    class="bg-base-100 flex w-10 items-center justify-center rounded-lg text-2xl"
                                    style={{
                                      color: accentColor ?? undefined,
                                      'border-color': accentColor ?? undefined,
                                      'border-width': accentColor ? '1px' : undefined,
                                      'border-style': accentColor ? 'solid' : undefined,
                                    }}
                                  >
                                    {isTrackerSuggestion ? (
                                      <Show when={emoji} fallback={<Hash class="size-5" />}>
                                        <span>{emoji}</span>
                                      </Show>
                                    ) : (
                                      <Command class="size-5 text-primary" />
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Info */}
                              <div class="min-w-0 flex-1">
                                {trackerSuggestion ? (
                                  <>
                                    <div class="flex flex-wrap items-center gap-2">
                                      <span
                                        class="font-mono text-sm"
                                        style={{ color: accentColor ?? undefined }}
                                      >
                                        #{tracker!.tag}
                                      </span>
                                      <div class="badge badge-ghost badge-sm gap-1">
                                        {getSuggestionIcon(trackerSuggestion.reason)}
                                        {getReasonLabel(trackerSuggestion.reason)}
                                      </div>
                                    </div>
                                    <div class="text-base-content/70 truncate text-sm">
                                      {tracker!.label}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div class="flex flex-wrap items-center gap-2">
                                      <span class="font-mono text-sm text-primary">
                                        {commandSuggestion?.label}
                                      </span>
                                      <Show
                                        when={
                                          showSessionTimer() &&
                                          commandSuggestion?.command !== 'start' &&
                                          sessionDurationLabel()
                                        }
                                      >
                                        <div class="badge badge-outline badge-sm gap-1">
                                          <Clock class="size-3" />
                                          {sessionDurationLabel()}
                                        </div>
                                      </Show>
                                    </div>
                                    <div class="text-base-content/70 truncate text-sm">
                                      {commandSuggestion?.description}
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Score indicator for fuzzy matches */}
                              <Show when={trackerSuggestion?.reason === 'fuzzy'}>
                                <div class="badge badge-sm badge-outline">
                                  {Math.round((1 - (trackerSuggestion?.score ?? 1)) * 100)}%
                                </div>
                              </Show>
                            </button>
                          </li>
                        );
                      }}
                    </For>
                  </ul>
                </Show>
              </div>
            </div>
          </div>

          {/* Error Display */}
          <Show when={error()}>
            <div class="alert alert-error mt-2">
              <span>{error()!.message}</span>
            </div>
          </Show>

          {/* Loading Indicator */}
          <Show when={loading()}>
            <div class="alert mt-2">
              <span class="loading loading-spinner loading-sm"></span>
              <span>Creating entry...</span>
            </div>
          </Show>
        </form>
      </div>
    </div>
  );
}
