import { For, Show, createMemo, createSignal } from 'solid-js';
import type { Entry, Group, Session, Tracker } from '../../lib/db/types';

interface WeekGridProps {
  entries: Entry[];
  sessions: Session[];
  trackers: Tracker[];
  groups: Group[];
  currentDate: Date;
  onEntryClick: (entry: Entry) => void;
  onSessionClick: (session: Session) => void;
  onDayClick: (date: Date) => void;
  startHour?: number;
  endHour?: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDateString = (date: Date) => date.toISOString().split('T')[0];

const formatHour = (hour: number) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    hour12: true,
  });
};

const formatShortTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export default function WeekGrid(props: WeekGridProps) {
  const startHour = () => props.startHour ?? 6;
  const endHour = () => props.endHour ?? 22;
  const totalHours = () => endHour() - startHour() + 1;
  const [expandedEntries, setExpandedEntries] = createSignal<Set<string>>(new Set());

  const trackerMap = createMemo(() => {
    const map = new Map<string, Tracker>();
    props.trackers.forEach((t) => map.set(t._id, t));
    return map;
  });

  const groupMap = createMemo(() => {
    const map = new Map<string, Group>();
    props.groups.forEach((g) => map.set(g._id, g));
    return map;
  });

  // Get week days
  const weekDays = createMemo(() => {
    const date = new Date(props.currentDate);
    const day = date.getDay();
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - day);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  });

  // Group items by day and hour
  const getDayHourItems = (dayDate: Date, hour: number) => {
    const dateKey = toDateString(dayDate);

    const dayEntries = props.entries.filter((e) => e.date === dateKey);
    const hourEntries = dayEntries.filter((e) => new Date(e.timestamp).getHours() === hour);

    const daySessions = props.sessions.filter((s) => {
      if (!s.startTime) return false;
      return (
        toDateString(new Date(s.startTime)) === dateKey && new Date(s.startTime).getHours() === hour
      );
    });

    return { entries: hourEntries, sessions: daySessions };
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

  const getTrackerLabel = (trackerId: string) => {
    return trackerMap().get(trackerId)?.label || 'Unknown';
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

  const toggleEntryExpand = (entryId: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const isEntryExpanded = (entryId: string) => expandedEntries().has(entryId);

  const hours = createMemo(() => {
    return Array.from({ length: totalHours() }, (_, i) => startHour() + i);
  });

  return (
    <div class="flex h-full flex-col overflow-hidden">
      {/* Day Headers */}
      <div
        class="border-base-300 grid border-b"
        style={{ 'grid-template-columns': '60px repeat(7, 1fr)' }}
      >
        <div class="border-base-300 bg-base-200/50 border-r p-2">
          <span class="text-base-content/60 text-xs font-semibold">Time</span>
        </div>
        <For each={weekDays()}>
          {(day) => {
            const isToday = toDateString(day) === toDateString(new Date());
            return (
              <div
                class={`border-base-300 border-r p-2 text-center ${isToday ? 'bg-primary/10' : 'bg-base-200/50'}`}
              >
                <div class="text-base-content/60 text-xs">{WEEKDAYS[day.getDay()]}</div>
                <div class={`text-lg font-semibold ${isToday ? 'text-primary' : ''}`}>
                  {day.getDate()}
                </div>
              </div>
            );
          }}
        </For>
      </div>

      {/* Hour Grid */}
      <div class="flex-1 overflow-y-auto">
        <div style={{ 'min-height': `${totalHours() * 80}px` }}>
          <For each={hours()}>
            {(hour) => (
              <div
                class="border-base-300 grid border-b"
                style={{ 'grid-template-columns': '60px repeat(7, 1fr)', 'min-height': '80px' }}
              >
                {/* Time Label */}
                <div class="border-base-300 bg-base-100 flex items-start justify-center border-r p-2">
                  <span class="text-base-content/60 sticky top-2 text-xs font-medium">
                    {formatHour(hour)}
                  </span>
                </div>

                {/* Day Columns */}
                <For each={weekDays()}>
                  {(day) => {
                    const { entries, sessions } = getDayHourItems(day, hour);
                    const hasItems = entries.length > 0 || sessions.length > 0;
                    const isToday = toDateString(day) === toDateString(new Date());

                    return (
                      <div
                        class={`border-base-300 relative overflow-hidden border-r p-1 ${
                          hasItems ? 'bg-base-100' : 'bg-base-50'
                        } ${isToday ? 'bg-primary/5' : ''}`}
                        onClick={() => props.onDayClick(day)}
                      >
                        {/* Sessions */}
                        <For each={sessions}>
                          {(session) => (
                            <div
                              class="mb-1 cursor-pointer overflow-hidden rounded px-1 py-0.5 text-[10px] text-white"
                              style={{ 'background-color': getSessionColor(session) }}
                              onClick={(e) => {
                                e.stopPropagation();
                                props.onSessionClick(session);
                              }}
                            >
                              <div class="truncate font-semibold">
                                {session.name || session.type}
                              </div>
                              <div class="opacity-75">{formatShortTime(session.startTime)}</div>
                            </div>
                          )}
                        </For>

                        {/* Entries - with expand/collapse */}
                        <For each={entries}>
                          {(entry) => {
                            const isExpanded = isEntryExpanded(entry._id);
                            const details = formatEntryDetails(entry);

                            return (
                              <div
                                class="mb-1 cursor-pointer overflow-hidden rounded border px-1 py-0.5 text-[10px]"
                                style={{
                                  'border-color': getEntryColor(entry),
                                  'background-color': `${getEntryColor(entry)}15`,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (details.length > 30 || entry.data.length > 1) {
                                    toggleEntryExpand(entry._id);
                                  } else {
                                    props.onEntryClick(entry);
                                  }
                                }}
                              >
                                <div class="flex items-center gap-1">
                                  <div class="flex min-w-0 flex-1 flex-wrap gap-0.5">
                                    <For each={entry.data.slice(0, isExpanded ? undefined : 2)}>
                                      {(data) => (
                                        <span class="badge badge-xs badge-ghost truncate text-[9px]">
                                          {getTrackerLabel(data.trackerId)}
                                        </span>
                                      )}
                                    </For>
                                    {!isExpanded && entry.data.length > 2 && (
                                      <span class="text-base-content/50 text-[9px]">
                                        +{entry.data.length - 2}
                                      </span>
                                    )}
                                  </div>
                                  <span class="text-base-content/50 flex-shrink-0 text-[9px]">
                                    {formatShortTime(entry.timestamp)}
                                  </span>
                                </div>

                                {/* Expandable Details */}
                                <Show when={isExpanded}>
                                  <div class="border-base-300/30 mt-1 space-y-0.5 border-t pt-1">
                                    <For each={entry.data}>
                                      {(data) => (
                                        <div class="text-[9px]">
                                          <span class="font-semibold">
                                            {getTrackerLabel(data.trackerId)}:
                                          </span>
                                          <div class="text-base-content/70 ml-2">
                                            {Object.entries(data.values)
                                              .filter(([_, v]) => v !== null && v !== undefined)
                                              .map(([k, v]) => `${k}: ${v}`)
                                              .join(', ')}
                                          </div>
                                        </div>
                                      )}
                                    </For>
                                  </div>
                                </Show>

                                <Show when={!isExpanded && details}>
                                  <div class="text-base-content/60 mt-0.5 truncate text-[9px]">
                                    {details}
                                  </div>
                                </Show>
                              </div>
                            );
                          }}
                        </For>

                        {/* Show "more" indicator if many items */}
                        <Show when={entries.length + sessions.length > 3}>
                          <div class="text-base-content/40 mt-1 text-center text-[9px]">
                            +{entries.length + sessions.length - 3} more
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
