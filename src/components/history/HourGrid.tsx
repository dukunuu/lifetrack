import { For, Show, createMemo } from 'solid-js';
import type { Entry, Group, Session, Tracker } from '../../lib/db/types';

interface HourGridProps {
  entries: Entry[];
  sessions: Session[];
  trackers: Tracker[];
  groups: Group[];
  currentDate: Date;
  onEntryClick: (entry: Entry) => void;
  onSessionClick: (session: Session) => void;
  onHourClick?: (hour: number) => void;
  startHour?: number; // Default 6 (6 AM)
  endHour?: number; // Default 22 (10 PM)
}

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

export default function HourGrid(props: HourGridProps) {
  const startHour = () => props.startHour ?? 6;
  const endHour = () => props.endHour ?? 22;
  const totalHours = () => endHour() - startHour() + 1;

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

  // Group entries by hour
  const entriesByHour = createMemo(() => {
    const buckets: Entry[][] = Array.from({ length: 24 }, () => []);

    props.entries.forEach((entry) => {
      const hour = new Date(entry.timestamp).getHours();
      if (hour >= startHour() && hour <= endHour()) {
        buckets[hour].push(entry);
      }
    });

    // Sort each bucket by timestamp
    buckets.forEach((bucket) => bucket.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));

    return buckets;
  });

  // Group sessions by hour (based on start time)
  const sessionsByHour = createMemo(() => {
    const buckets: Session[][] = Array.from({ length: 24 }, () => []);

    props.sessions.forEach((session) => {
      if (!session.startTime) return;
      const hour = new Date(session.startTime).getHours();
      if (hour >= startHour() && hour <= endHour()) {
        buckets[hour].push(session);
      }
    });

    // Sort each bucket by start time
    buckets.forEach((bucket) => bucket.sort((a, b) => a.startTime.localeCompare(b.startTime)));

    return buckets;
  });

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

  const hours = createMemo(() => {
    return Array.from({ length: totalHours() }, (_, i) => startHour() + i);
  });

  // Calculate current time position for the red line indicator
  const currentTimePosition = createMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    if (currentHour < startHour() || currentHour > endHour()) {
      return null;
    }

    const hourIndex = currentHour - startHour();
    const percentage = (currentMinute / 60) * 100;

    return { hourIndex, percentage };
  });

  const isToday = createMemo(() => {
    const today = new Date();
    return (
      props.currentDate.getDate() === today.getDate() &&
      props.currentDate.getMonth() === today.getMonth() &&
      props.currentDate.getFullYear() === today.getFullYear()
    );
  });

  return (
    <div class="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div class="border-base-300 bg-base-200/50 border-b px-4 py-2">
        <div class="flex items-center justify-between">
          <span class="text-base-content/70 text-sm font-semibold">Time</span>
          <span class="text-base-content/50 text-xs">
            {props.currentDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Hour Grid */}
      <div class="flex-1 overflow-y-auto">
        <div
          class="grid"
          style={{
            'grid-template-columns': '60px 1fr',
            'grid-template-rows': `repeat(${totalHours()}, minmax(60px, 1fr))`,
          }}
        >
          <For each={hours()}>
            {(hour, index) => {
              const hourEntries = entriesByHour()[hour] || [];
              const hourSessions = sessionsByHour()[hour] || [];
              const hasItems = hourEntries.length > 0 || hourSessions.length > 0;
              const timePos = currentTimePosition();
              const showTimeLine = isToday() && timePos && timePos.hourIndex === index();

              return (
                <>
                  {/* Time Label */}
                  <div class="border-base-300 bg-base-100 flex items-start justify-center border-r border-b p-2">
                    <span class="text-base-content/60 sticky top-2 text-xs font-medium">
                      {formatHour(hour)}
                    </span>
                  </div>

                  {/* Hour Content */}
                  <div
                    class={`border-base-300 hover:bg-base-200/30 relative border-b p-2 transition-colors ${
                      hasItems ? 'bg-base-100' : 'bg-base-50'
                    }`}
                    onClick={() => props.onHourClick?.(hour)}
                  >
                    {/* Current Time Indicator */}
                    <Show when={showTimeLine}>
                      <div
                        class="absolute right-0 left-0 z-10 border-t-2 border-red-500"
                        style={{ top: `${timePos!.percentage}%` }}
                      >
                        <div class="absolute -top-1.5 -left-1 h-3 w-3 rounded-full bg-red-500" />
                      </div>
                    </Show>

                    <div class="flex h-full flex-col gap-1">
                      {/* Sessions */}
                      <For each={hourSessions}>
                        {(session) => (
                          <div
                            class="cursor-pointer overflow-hidden rounded px-2 py-1 text-xs text-white"
                            style={{ 'background-color': getSessionColor(session) }}
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onSessionClick(session);
                            }}
                          >
                            <div class="flex items-center gap-1">
                              <span class="truncate font-semibold">
                                {session.name || session.type}
                              </span>
                              <span class="flex-shrink-0 opacity-75">
                                {formatShortTime(session.startTime)}
                              </span>
                            </div>
                          </div>
                        )}
                      </For>

                      {/* Entries */}
                      <For each={hourEntries}>
                        {(entry) => (
                          <div
                            class="cursor-pointer overflow-hidden rounded border px-2 py-1 text-xs"
                            style={{
                              'border-color': getEntryColor(entry),
                              'background-color': `${getEntryColor(entry)}15`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onEntryClick(entry);
                            }}
                          >
                            <div class="flex items-center gap-1">
                              <div class="flex min-w-0 flex-1 flex-wrap gap-1">
                                <For each={entry.data}>
                                  {(data) => (
                                    <span class="badge badge-xs badge-ghost truncate">
                                      {getTrackerLabel(data.trackerId)}
                                    </span>
                                  )}
                                </For>
                              </div>
                              <span class="text-base-content/50 flex-shrink-0 text-[10px]">
                                {formatShortTime(entry.timestamp)}
                              </span>
                            </div>
                            <Show when={formatEntryDetails(entry)}>
                              <p class="text-base-content/70 mt-0.5 truncate text-[10px]">
                                {formatEntryDetails(entry)}
                              </p>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
}
