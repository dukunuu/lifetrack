import { For, Show } from 'solid-js';
import type { Entry, Group, Session, Tracker } from '../../lib/db/types';

interface DayDetailModalProps {
  date: Date | null;
  entries: Entry[];
  sessions: Session[];
  trackers: Tracker[];
  groups: Group[];
  onClose: () => void;
}

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDuration = (start: string, end?: string) => {
  if (!end) return formatTime(start);
  return `${formatTime(start)} - ${formatTime(end)}`;
};

export default function DayDetailModal(props: DayDetailModalProps) {
  const trackerMap = () => {
    const map = new Map<string, Tracker>();
    props.trackers.forEach((t) => map.set(t._id, t));
    return map;
  };

  const groupMap = () => {
    const map = new Map<string, Group>();
    props.groups.forEach((g) => map.set(g._id, g));
    return map;
  };

  const getEntryColor = (entry: Entry) => {
    for (const data of entry.data) {
      const tracker = trackerMap().get(data.trackerId);
      if (tracker?.groupId) {
        const group = groupMap().get(tracker.groupId);
        if (group?.color) return group.color;
      }
    }
    return 'var(--fallback-p, oklch(var(--p)))';
  };

  const getSessionColor = (session: Session) => {
    if (session.groupId) {
      const group = groupMap().get(session.groupId);
      if (group?.color) return group.color;
    }
    return 'var(--fallback-s, oklch(var(--s)))';
  };

  const formatEntryDetails = (entry: Entry) => {
    const parts: string[] = [];
    entry.data.forEach((data) => {
      const tracker = trackerMap().get(data.trackerId);
      const fieldMap = new Map<string, { label: string; unit?: string }>();
      tracker?.fields.forEach((f) => fieldMap.set(f.name, { label: f.label, unit: f.unit }));

      Object.entries(data.values).forEach(([fieldName, value]) => {
        if (value === null || value === undefined) return;
        const field = fieldMap.get(fieldName);
        let formatted = '';
        if (typeof value === 'boolean') {
          formatted = value ? 'Yes' : 'No';
        } else if (typeof value === 'number') {
          formatted = field?.unit ? `${value} ${field.unit}` : `${value}`;
        } else {
          formatted = String(value);
        }
        parts.push(`${field?.label || fieldName}: ${formatted}`);
      });
    });
    return parts.join(', ');
  };

  const totalItems = () => props.entries.length + props.sessions.length;

  return (
    <Show when={props.date}>
      <div class="modal modal-open" onClick={props.onClose}>
        <div class="modal-box max-w-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 class="text-lg font-bold">
            {props.date!.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </h3>
          <p class="text-base-content/60 mt-1 text-sm">{totalItems()} items</p>

          <div class="max-h-[60vh] space-y-3 overflow-y-auto py-4">
            {/* Sessions */}
            <Show when={props.sessions.length > 0}>
              <div class="text-base-content/60 text-sm font-semibold tracking-wide uppercase">
                Sessions ({props.sessions.length})
              </div>
              <For each={props.sessions}>
                {(session) => (
                  <div
                    class="overflow-hidden rounded-lg"
                    style={{ 'background-color': `${getSessionColor(session)}20` }}
                  >
                    <div
                      class="px-3 py-2"
                      style={{ 'border-left': `3px solid ${getSessionColor(session)}` }}
                    >
                      <div class="flex items-center justify-between">
                        <span class="text-sm font-semibold">{session.name || session.type}</span>
                        <span class="text-base-content/60 text-xs">
                          {formatDuration(session.startTime, session.endTime)}
                        </span>
                      </div>
                      <Show when={session.notes}>
                        <p class="text-base-content/70 mt-1 text-xs">{session.notes}</p>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </Show>

            {/* Entries */}
            <Show when={props.entries.length > 0}>
              <div class="text-base-content/60 mt-4 text-sm font-semibold tracking-wide uppercase">
                Entries ({props.entries.length})
              </div>
              <For each={props.entries}>
                {(entry) => (
                  <div
                    class="overflow-hidden rounded-lg"
                    style={{ 'background-color': `${getEntryColor(entry)}15` }}
                  >
                    <div
                      class="px-3 py-2"
                      style={{ 'border-left': `3px solid ${getEntryColor(entry)}` }}
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex flex-wrap gap-1">
                          <For each={entry.data}>
                            {(data) => (
                              <span class="badge badge-sm badge-ghost">
                                {trackerMap().get(data.trackerId)?.label || data.trackerTag}
                              </span>
                            )}
                          </For>
                        </div>
                        <span class="text-base-content/60 ml-2 flex-shrink-0 text-xs">
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      <Show when={formatEntryDetails(entry)}>
                        <p class="text-base-content/70 mt-1 text-xs">{formatEntryDetails(entry)}</p>
                      </Show>
                      <Show when={entry.note}>
                        <p class="text-base-content/60 mt-1 text-xs italic">{entry.note}</p>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </Show>

            <Show when={totalItems() === 0}>
              <div class="text-base-content/60 py-8 text-center">
                No entries or sessions for this day.
              </div>
            </Show>
          </div>

          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onClick={props.onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
