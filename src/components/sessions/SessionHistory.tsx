import { For, Show, createMemo, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { CalendarClock, CheckCircle2, CircleX, Clock4, ChevronDown } from 'lucide-solid';
import { useGroups } from '../../lib/hooks/useGroups';
import { useSessions } from '../../lib/hooks/useSessions';
import { useEntriesAll } from '../../lib/hooks/useEntriesAll';
import { useTrackers } from '../../lib/hooks/useTrackers';
import type { Entry, EntryData, FieldDefinition, FieldValue, Tracker } from '../../lib/db/types';

const formatDateTime = (value: string) => {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  return `${minutes}m`;
};

const formatFieldValue = (value: FieldValue, field?: FieldDefinition) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') {
    return field?.unit ? `${value} ${field.unit}` : `${value}`;
  }
  return String(value);
};

const formatEntryValues = (item: EntryData, tracker?: Tracker) => {
  const fieldMap = new Map<string, FieldDefinition>();
  tracker?.fields.forEach((field) => fieldMap.set(field.name, field));

  const parts = Object.entries(item.values ?? {})
    .map(([name, value]) => {
      const field = fieldMap.get(name);
      const label = field?.label ?? name;
      const formattedValue = formatFieldValue(value, field);
      if (!formattedValue) return null;
      return `${label} ${formattedValue}`.trim();
    })
    .filter((part): part is string => Boolean(part));

  const flags = [item.completed ? 'done' : null, item.skipped ? 'skip' : null].filter(
    (flag): flag is string => Boolean(flag),
  );

  const suffix = parts.length > 0 ? `: ${parts.join(', ')}` : '';
  const flagSuffix = flags.length > 0 ? ` (${flags.join(', ')})` : '';

  return `${suffix}${flagSuffix}`;
};

export default function SessionHistory() {
  const { sessions, loading } = useSessions();
  const { groups } = useGroups();
  const { entries } = useEntriesAll();
  const { trackers } = useTrackers({ loadAll: true });
  const [expandedId, setExpandedId] = createSignal<string | null>(null);

  const groupMap = createMemo(() => {
    const map = new Map<string, { name: string; color?: string }>();
    groups().forEach((group) => map.set(group._id, { name: group.name, color: group.color }));
    return map;
  });

  const trackerMap = createMemo(() => {
    const map = new Map<string, Tracker>();
    trackers().forEach((tracker) => map.set(tracker._id, tracker));
    return map;
  });

  const entriesBySession = createMemo(() => {
    const map = new Map<string, Entry[]>();
    entries().forEach((entry) => {
      if (!entry.sessionId) return;
      if (!map.has(entry.sessionId)) {
        map.set(entry.sessionId, []);
      }
      map.get(entry.sessionId)!.push(entry);
    });
    return map;
  });

  return (
    <div class="border-base-300/50 bg-base-100/70 rounded-2xl border p-6 shadow-sm">
      <div class="mb-4 flex items-center gap-3">
        <div class="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
          <CalendarClock class="size-5" />
        </div>
        <div>
          <h2 class="text-lg font-bold">Session History</h2>
          <p class="text-base-content/60 text-sm">Recent sessions across your trackers.</p>
        </div>
      </div>

      <Show
        when={!loading() && sessions().length > 0}
        fallback={
          <div class="text-base-content/50 rounded-xl border border-dashed p-6 text-center text-sm">
            No sessions logged yet.
          </div>
        }
      >
        <div class="space-y-3">
          <For each={sessions()}>
            {(session) => {
              const isChat = session.type === 'ai';
              return (
                <div
                  class="border-base-300/50 bg-base-200/50 rounded-xl border px-4 py-3"
                  style={{
                    'border-left': session.groupId
                      ? `2px solid ${groupMap().get(session.groupId)?.color ?? 'transparent'}`
                      : undefined,
                  }}
                >
                  <div class="flex flex-wrap items-center justify-between gap-4">
                    <div class="min-w-0">
                      <div class="text-base-content/80 text-sm font-semibold">
                        {session.name || (isChat ? 'AI Chat' : session.type)}
                      </div>
                      <div class="text-base-content/50 text-xs">
                        {isChat
                          ? 'Conversation'
                          : session.groupId
                            ? (groupMap().get(session.groupId)?.name ?? 'Unknown group')
                            : 'No group'}
                      </div>
                    </div>

                    <div class="text-base-content/60 flex flex-wrap items-center gap-4 text-xs">
                      <span class="flex items-center gap-1">
                        <Clock4 class="size-3" />
                        {formatDateTime(session.startTime)}
                      </span>
                      <Show when={session.summary?.duration}>
                        <span class="flex items-center gap-1">
                          <Clock4 class="size-3" />
                          {formatDuration(session.summary!.duration)}
                        </span>
                      </Show>
                      <span class="flex items-center gap-1">
                        <Show
                          when={session.status === 'completed'}
                          fallback={
                            session.status === 'active' ? (
                              <Clock4 class="text-info size-3" />
                            ) : (
                              <CircleX class="text-error size-3" />
                            )
                          }
                        >
                          <CheckCircle2 class="text-success size-3" />
                        </Show>
                        {session.status}
                      </span>
                      <Show when={session.summary?.entryCount !== undefined}>
                        <span class="tabular-nums">{session.summary!.entryCount} entries</span>
                      </Show>
                    </div>
                  </div>

                  <div class="mt-3 flex flex-wrap items-center gap-3">
                    <Show when={!isChat}>
                      <button
                        class="text-base-content/60 hover:text-base-content flex items-center gap-2 text-xs transition-colors"
                        onClick={() =>
                          setExpandedId(expandedId() === session._id ? null : session._id)
                        }
                      >
                        <span>
                          {expandedId() === session._id ? 'Hide entries' : 'View entries'}
                        </span>
                        <ChevronDown
                          class={`size-4 transition-transform ${expandedId() === session._id ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </Show>
                    <Show when={isChat}>
                      <A class="btn btn-ghost btn-xs" href={`/sessions/${session._id}`}>
                        Open chat
                      </A>
                    </Show>
                  </div>

                  <Show when={!isChat && expandedId() === session._id}>
                    <div class="border-base-300/50 mt-4 border-t pt-4">
                      <div class="space-y-3">
                        <Show
                          when={(entriesBySession().get(session._id) ?? []).length > 0}
                          fallback={
                            <Show
                              when={(session.pendingData ?? []).length > 0}
                              fallback={
                                <div class="text-base-content/50 text-xs">
                                  No entries logged yet.
                                </div>
                              }
                            >
                              <div class="text-base-content/50 text-xs">Pending entries</div>
                              <div class="space-y-2">
                                <For each={session.pendingData ?? []}>
                                  {(item) => (
                                    <div class="bg-base-200/60 border-base-300/40 rounded-lg border px-3 py-2 text-xs">
                                      <span class="font-semibold">#{item.trackerTag}</span>
                                      <span class="text-base-content/60">
                                        {formatEntryValues(item, trackerMap().get(item.trackerId))}
                                      </span>
                                    </div>
                                  )}
                                </For>
                              </div>
                            </Show>
                          }
                        >
                          <For each={entriesBySession().get(session._id) ?? []}>
                            {(entry) => (
                              <div class="bg-base-200/60 border-base-300/40 rounded-lg border px-3 py-2">
                                <div class="text-base-content/60 text-xs">
                                  {formatDateTime(entry.timestamp)}
                                </div>
                                <div class="mt-2 flex flex-wrap gap-2 text-xs">
                                  <For each={entry.data}>
                                    {(item) => (
                                      <span class="bg-base-100/70 border-base-300/50 text-base-content/80 rounded-full border px-2 py-1">
                                        <span class="font-semibold">#{item.trackerTag}</span>
                                        <span class="text-base-content/60">
                                          {formatEntryValues(
                                            item,
                                            trackerMap().get(item.trackerId),
                                          )}
                                        </span>
                                      </span>
                                    )}
                                  </For>
                                </div>
                                <Show when={entry.note}>
                                  <div class="text-base-content/60 mt-2 text-xs">{entry.note}</div>
                                </Show>
                              </div>
                            )}
                          </For>
                        </Show>
                      </div>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
