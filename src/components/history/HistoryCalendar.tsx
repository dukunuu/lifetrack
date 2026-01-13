import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { ChevronLeft, ChevronRight } from 'lucide-solid';
import { A } from '@solidjs/router';
import { useEntriesAll } from '../../lib/hooks/useEntriesAll';
import { useGoals } from '../../lib/hooks/useGoals';
import { useGroups } from '../../lib/hooks/useGroups';
import { useSessions } from '../../lib/hooks/useSessions';
import { useTrackers } from '../../lib/hooks/useTrackers';
import { useSettings } from '../../lib/hooks/useSettings';
import { computeGoalProgress } from '../../lib/services/goal-progress';
import type {
  Entry,
  EntryData,
  FieldDefinition,
  FieldValue,
  Session,
  Tracker,
} from '../../lib/db/types';

type ViewMode = 'day' | 'week' | 'month';

const toDateString = (date: Date) => date.toISOString().split('T')[0];

const atUtcMidnight = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

const startOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const endOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

const startOfWeek = (date: Date) => {
  const base = atUtcMidnight(date);
  const day = base.getUTCDay();
  const diff = (day + 6) % 7;
  return addDays(base, -diff);
};

const endOfWeek = (date: Date) => addDays(startOfWeek(date), 6);

const formatDayLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

const formatShortDateLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const formatFullDate = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const formatTime = (timestamp: string, timeFormat: '12h' | '24h') =>
  new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: timeFormat === '12h',
  });

const formatSessionTime = (
  session: Session,
  timeFormat: '12h' | '24h',
) => {
  const start = formatTime(session.startTime, timeFormat);
  if (!session.endTime) return start;
  return `${start}-${formatTime(session.endTime, timeFormat)}`;
};

const formatHourLabel = (hour: number, timeFormat: '12h' | '24h') => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    hour12: timeFormat === '12h',
  });
};

const weekdayShort = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'short' });

const buildHourOrder = (startHour: number) =>
  Array.from({ length: 24 }, (_, index) => (index + startHour) % 24);

const formatFieldValue = (value: FieldValue, field?: FieldDefinition) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') {
    return field?.unit ? `${value} ${field.unit}` : `${value}`;
  }
  return String(value);
};

const formatEntryDetails = (item: EntryData, tracker?: Tracker) => {
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

  const flags = [
    item.completed ? 'done' : null,
    item.skipped ? 'skip' : null,
  ].filter((flag): flag is string => Boolean(flag));

  const valuePart = parts.join(', ');
  const flagPart = flags.length > 0 ? `(${flags.join(', ')})` : '';
  return [valuePart, flagPart].filter(Boolean).join(' ');
};

export default function HistoryCalendar() {
  const { entries, loading } = useEntriesAll();
  const { goals } = useGoals();
  const { groups } = useGroups();
  const { sessions } = useSessions();
  const { trackers } = useTrackers({ loadAll: true });
  const { settings } = useSettings();
  const [view, setView] = createSignal<ViewMode>('day');
  const [anchorDate, setAnchorDate] = createSignal(atUtcMidnight(new Date()));
  const [selectedDate, setSelectedDate] = createSignal<string | null>(null);
  const [selectedSlot, setSelectedSlot] = createSignal<{ dateKey: string; hour: number } | null>(
    null,
  );
  const [showDatePicker, setShowDatePicker] = createSignal(false);
  const [isCompact, setIsCompact] = createSignal(false);
  const [hasAppliedDefault, setHasAppliedDefault] = createSignal(false);

  onMount(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const sync = () => {
      setIsCompact(media.matches);
      if (media.matches) {
        setView('day');
      } else {
        setHasAppliedDefault(false);
      }
    };

    sync();
    if (media.addEventListener) {
      media.addEventListener('change', sync);
      onCleanup(() => media.removeEventListener('change', sync));
    } else {
      media.addListener(sync);
      onCleanup(() => media.removeListener(sync));
    }
  });

  createEffect(() => {
    if (isCompact()) return;
    if (hasAppliedDefault()) return;
    setView(settings().appearance.defaultHistoryView);
    setHasAppliedDefault(true);
  });

  const trackerMap = createMemo(() => {
    const map = new Map<string, Tracker>();
    trackers().forEach((tracker) => map.set(tracker._id, tracker));
    return map;
  });

  const groupMap = createMemo(() => {
    const map = new Map<string, { name: string; color?: string }>();
    groups().forEach((group) => map.set(group._id, { name: group.name, color: group.color }));
    return map;
  });

  const entriesByDate = createMemo(() => {
    const map = new Map<string, Entry[]>();
    entries().forEach((entry) => {
      const date = entry.date;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(entry);
    });
    return map;
  });

  const entriesBySessionId = createMemo(() => {
    const map = new Map<string, Entry[]>();
    entries().forEach((entry) => {
      if (!entry.sessionId) return;
      if (!map.has(entry.sessionId)) map.set(entry.sessionId, []);
      map.get(entry.sessionId)!.push(entry);
    });
    map.forEach((list) => list.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
    return map;
  });

  const sessionsByDate = createMemo(() => {
    const map = new Map<string, Session[]>();
    sessions().forEach((session) => {
      if (!session.startTime) return;
      const dateKey = toDateString(atUtcMidnight(new Date(session.startTime)));
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(session);
    });
    map.forEach((list) => list.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  });

  const sessionsByDateHour = createMemo(() => {
    const map = new Map<string, Map<number, Session[]>>();
    sessions().forEach((session) => {
      if (!session.startTime) return;
      const start = new Date(session.startTime);
      const dateKey = toDateString(atUtcMidnight(start));
      const hour = start.getHours();
      if (!map.has(dateKey)) map.set(dateKey, new Map());
      const dayMap = map.get(dateKey)!;
      if (!dayMap.has(hour)) dayMap.set(hour, []);
      dayMap.get(hour)!.push(session);
    });
    map.forEach((dayMap) => {
      dayMap.forEach((list) => list.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    });
    return map;
  });

  const dayEntries = createMemo(() => entriesByDate().get(toDateString(anchorDate())) ?? []);
  const dayKey = createMemo(() => toDateString(anchorDate()));
  const dayHourRows = createMemo(() => {
    const buckets: Entry[][] = Array.from({ length: 24 }, () => []);
    dayEntries().forEach((entry) => {
      const hour = new Date(entry.timestamp).getHours();
      buckets[hour].push(entry);
    });
    const order = buildHourOrder(settings().appearance.historyStartHour);
    return order.map((hour) => ({
      hour,
      entries: buckets[hour].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    }));
  });
  const dayRowTemplate = createMemo(() => {
    const sessionsForDay = sessionsByDateHour().get(dayKey()) ?? new Map();
    return dayHourRows()
      .map((row) =>
        row.entries.length > 0 || (sessionsForDay.get(row.hour) ?? []).length > 0
          ? 'minmax(48px, 1fr)'
          : 'minmax(26px, 0.45fr)',
      )
      .join(' ');
  });

  const weekStart = createMemo(() => startOfWeek(anchorDate()));
  const weekEnd = createMemo(() => endOfWeek(anchorDate()));
  const weekDates = createMemo(() =>
    Array.from({ length: 7 }, (_, index) => addDays(weekStart(), index)),
  );

  const monthStart = createMemo(() => startOfMonth(anchorDate()));
  const monthEnd = createMemo(() => endOfMonth(anchorDate()));
  const monthGridDates = createMemo(() => {
    const start = startOfWeek(monthStart());
    const end = endOfWeek(monthEnd());
    const days: Date[] = [];
    let cursor = start;
    while (cursor <= end) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  });

  const goalsForView = createMemo(() => {
    const period =
      view() === 'day' ? 'daily' : view() === 'week' ? 'weekly' : 'monthly';
    return goals()
      .filter((goal) => goal.period === period && !goal.archived)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  });

  const rangeForView = createMemo(() => {
    if (view() === 'day') {
      const date = toDateString(anchorDate());
      return { start: date, end: date };
    }
    if (view() === 'week') {
      return { start: toDateString(weekStart()), end: toDateString(weekEnd()) };
    }
    return { start: toDateString(monthStart()), end: toDateString(monthEnd()) };
  });

  const progressByGoalId = createMemo(() => {
    const map = new Map<string, ReturnType<typeof computeGoalProgress>>();
    const range = rangeForView();
    goalsForView().forEach((goal) => {
      map.set(goal._id, computeGoalProgress(goal, entries(), groups(), trackers(), { range }));
    });
    return map;
  });

  const periodLabel = createMemo(() => {
    if (view() === 'day') return formatFullDate(anchorDate());
    if (view() === 'week') {
      const start = weekStart();
      const end = weekEnd();
      return `${formatDayLabel(start)} - ${formatDayLabel(end)}`;
    }
    return formatMonthLabel(anchorDate());
  });

  const rangeLabel = createMemo(() => {
    const range = rangeForView();
    const start = new Date(`${range.start}T00:00:00Z`);
    const end = new Date(`${range.end}T00:00:00Z`);
    if (range.start === range.end) return formatDayLabel(start);
    return `${formatDayLabel(start)} - ${formatDayLabel(end)}`;
  });

  const movePeriod = (direction: -1 | 1) => {
    if (view() === 'day') {
      setAnchorDate(addDays(anchorDate(), direction));
      return;
    }
    if (view() === 'week') {
      setAnchorDate(addDays(anchorDate(), direction * 7));
      return;
    }
    setAnchorDate(addMonths(anchorDate(), direction));
  };

  const resetToday = () => setAnchorDate(atUtcMidnight(new Date()));
  const handleDateChange = (value: string) => {
    if (!value) return;
    setAnchorDate(atUtcMidnight(new Date(`${value}T00:00:00Z`)));
    setShowDatePicker(false);
  };

  const goalPreview = createMemo(() => goalsForView().slice(0, 6));
  const goalOverflowCount = createMemo(() =>
    Math.max(0, goalsForView().length - goalPreview().length),
  );

  const renderEntryPills = (entry: Entry, compact?: boolean) => (
    <div class={`flex flex-wrap ${compact ? 'mt-1 gap-1 text-[11px]' : 'mt-2 gap-2 text-xs'}`}>
      <For each={entry.data}>
        {(item) => {
          const tracker = trackerMap().get(item.trackerId);
          const details = formatEntryDetails(item, tracker);
          return (
            <span class="border-base-300/50 bg-base-100/70 text-base-content/80 rounded-full border px-2 py-1">
              <span class="font-semibold">#{item.trackerTag}</span>
              <Show when={details}>
                <span class="text-base-content/60">: {details}</span>
              </Show>
            </span>
          );
        }}
      </For>
    </div>
  );

  const renderEntryCard = (entry: Entry, compact?: boolean) => (
    <div
      class={`border-base-300/50 bg-base-200/60 rounded-lg border p-3 ${compact ? 'text-xs' : ''}`}
      style={{
        'border-left': entry.groupId ? `2px solid ${groupMap().get(entry.groupId)?.color ?? 'transparent'}` : undefined,
      }}
    >
      <div class="text-base-content/60 text-xs">
        {formatTime(entry.timestamp, settings().appearance.timeFormat)}
      </div>
      {renderEntryPills(entry)}
      <Show when={entry.note}>
        <div class="text-base-content/60 mt-2 text-xs">{entry.note}</div>
      </Show>
    </div>
  );

  const renderSessionBadge = (session: Session, includeEntries?: boolean) => {
    const group = session.groupId ? groupMap().get(session.groupId) : undefined;
    const label = session.name || (session.type === 'ai' ? 'AI Chat' : session.type);
    const sessionEntries = entriesBySessionId().get(session._id) ?? [];
    return (
      <div
        class="border-base-300/50 bg-base-200/80 text-base-content/80 rounded-md border px-2 py-2 text-xs"
        style={{
          'border-left': group?.color ? `2px solid ${group.color}` : undefined,
        }}
      >
        <div class="space-y-1">
          <div class="font-semibold truncate">{label}</div>
          <Show when={session.type === 'ai'}>
            <A
              class="text-primary block text-center text-xs hover:underline"
              href={`/sessions/${session._id}`}
            >
              Open chat
            </A>
          </Show>
        </div>
        <div class="text-base-content/50">
          {formatSessionTime(session, settings().appearance.timeFormat)}
        </div>
        <Show when={includeEntries && sessionEntries.length > 0}>
          <div class="mt-1 space-y-1">
            <For each={sessionEntries}>
              {(entry) => (
                <div class="border-base-300/40 bg-base-100/70 rounded-md border px-2 py-2 text-xs">
                  <div class="text-base-content/60 text-xs">
                    {formatTime(entry.timestamp, settings().appearance.timeFormat)}
                  </div>
                  {renderEntryPills(entry, true)}
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    );
  };

  const entriesForSlot = (dateKey: string, hour: number) => {
    return (entriesByDate().get(dateKey) ?? []).filter((entry) => {
      return new Date(entry.timestamp).getHours() === hour;
    });
  };

  const sessionsForSlot = (dateKey: string, hour: number) => {
    return sessionsByDateHour().get(dateKey)?.get(hour) ?? [];
  };

  const entriesForSlotExcludingSessions = (dateKey: string, hour: number) => {
    const sessionIds = new Set(sessionsForSlot(dateKey, hour).map((session) => session._id));
    return entriesForSlot(dateKey, hour).filter(
      (entry) => !entry.sessionId || !sessionIds.has(entry.sessionId),
    );
  };

  const entriesForDateExcludingSessions = (dateKey: string) => {
    const sessionIds = new Set((sessionsByDate().get(dateKey) ?? []).map((session) => session._id));
    return (entriesByDate().get(dateKey) ?? []).filter(
      (entry) => !entry.sessionId || !sessionIds.has(entry.sessionId),
    );
  };

  const weekHourRows = createMemo(() => {
    const order = buildHourOrder(settings().appearance.historyStartHour);
    return order.map((hour) => ({
      hour,
      cells: weekDates().map((date) => {
        const dateKey = toDateString(date);
        return {
          date,
          dateKey,
          entries: entriesForSlot(dateKey, hour),
          sessions: sessionsForSlot(dateKey, hour),
        };
      }),
    }));
  });

  const weekRowTemplate = createMemo(() => {
    return weekHourRows()
      .map((row) =>
        row.cells.some((cell) => cell.entries.length > 0 || cell.sessions.length > 0)
          ? 'minmax(36px, 0.8fr)'
          : 'minmax(20px, 0.35fr)',
      )
      .join(' ');
  });

  const monthWeekCount = createMemo(() => Math.ceil(monthGridDates().length / 7));

  return (
    <div class="flex h-full min-h-0 flex-col gap-4 overflow-visible sm:overflow-hidden">
      <div class="border-base-300/50 bg-base-100/70 sticky top-0 z-20 shrink-0 rounded-xl border px-4 py-3 shadow-sm sm:static">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 sm:hidden">
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onClick={() => movePeriod(-1)}
              aria-label="Previous"
            >
              <ChevronLeft class="size-4" />
            </button>
            <Show
              when={!showDatePicker()}
              fallback={
                <input
                  type="date"
                  class="input input-bordered input-xs"
                  value={toDateString(anchorDate())}
                  onChange={(e) => handleDateChange(e.currentTarget.value)}
                  onBlur={() => setShowDatePicker(false)}
                />
              }
            >
              <button
                type="button"
                class="text-base-content/80 text-sm font-semibold"
                onClick={() => setShowDatePicker(true)}
              >
                {formatShortDateLabel(anchorDate())}
              </button>
            </Show>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onClick={() => movePeriod(1)}
              aria-label="Next"
            >
              <ChevronRight class="size-4" />
            </button>
          </div>

          <div class="flex items-center gap-2 sm:hidden">
            <button type="button" class="btn btn-ghost btn-xs" onClick={resetToday}>
              Today
            </button>
          </div>

          <div class="hidden w-full items-center justify-between gap-3 sm:flex">
            <div class="join">
              <button
                type="button"
                class={`btn btn-xs join-item ${view() === 'day' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setView('day')}
              >
                Day
              </button>
              <Show when={!isCompact()}>
                <button
                  type="button"
                  class={`btn btn-xs join-item ${view() === 'week' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setView('week')}
                >
                  Week
                </button>
                <button
                  type="button"
                  class={`btn btn-xs join-item ${view() === 'month' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setView('month')}
                >
                  Month
                </button>
              </Show>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="btn btn-ghost btn-xs"
                onClick={() => movePeriod(-1)}
                aria-label="Previous"
              >
                <ChevronLeft class="size-4" />
              </button>
              <Show
                when={!showDatePicker()}
                fallback={
                  <input
                    type="date"
                    class="input input-bordered input-xs"
                    value={toDateString(anchorDate())}
                    onChange={(e) => handleDateChange(e.currentTarget.value)}
                    onBlur={() => setShowDatePicker(false)}
                  />
                }
              >
                <button
                  type="button"
                  class="text-base-content/80 text-sm font-semibold"
                  onClick={() => setShowDatePicker(true)}
                >
                  {periodLabel()}
                </button>
              </Show>
              <button
                type="button"
                class="btn btn-ghost btn-xs"
                onClick={() => movePeriod(1)}
                aria-label="Next"
              >
                <ChevronRight class="size-4" />
              </button>
            </div>

            <button type="button" class="btn btn-ghost btn-xs" onClick={resetToday}>
              Today
            </button>
          </div>
        </div>
      </div>

      <div class="shrink-0 space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-base-content/60 text-xs font-semibold uppercase tracking-wide">
            {view() === 'day' ? 'Daily goals' : view() === 'week' ? 'Weekly goals' : 'Monthly goals'}
          </div>
          <div class="text-base-content/40 text-xs">{rangeLabel()}</div>
        </div>
        <Show when={goalsForView().length > 0}>
          <div class="flex flex-wrap items-center gap-2">
            <For each={goalPreview()}>
              {(goal, index) => {
                const progress = progressByGoalId().get(goal._id);
                return (
                  <div
                    class="border-base-300/60 bg-base-200/70 rounded-full border px-3 py-2 text-xs"
                    style={{
                      'border-left': goal.color ? `2px solid ${goal.color}` : undefined,
                      'animation-delay': `${index() * 40}ms`,
                    }}
                  >
                    <div class="flex items-center gap-2">
                      <span class="font-semibold truncate max-w-[140px]">{goal.name}</span>
                      <span class="text-base-content/50 tabular-nums">
                        {progress?.current ?? 0}/{progress?.target ?? 0}
                      </span>
                    </div>
                    <div class="bg-base-300/70 mt-1 h-1.5 overflow-hidden rounded-full">
                      <div
                        class="h-full rounded-full transition-all"
                        style={{
                          width: `${progress?.percent ?? 0}%`,
                          'background-color': goal.color || 'var(--fallback-p,oklch(var(--p)))',
                        }}
                      />
                    </div>
                  </div>
                );
              }}
            </For>
            <Show when={goalOverflowCount() > 0}>
              <div class="text-base-content/50 text-xs">+{goalOverflowCount()} more</div>
            </Show>
          </div>
        </Show>
      </div>

      <Show
        when={!loading()}
        fallback={<div class="text-base-content/60 shrink-0">Loading entries...</div>}
      >
        <Show when={view() === 'day'}>
          <div class="border-base-300 flex-1 min-h-0 overflow-hidden rounded-2xl border">
            <div
              class="grid h-full grid-cols-[70px_1fr]"
              style={{ 'grid-template-rows': `auto ${dayRowTemplate()}` }}
            >
              <div class="border-base-300 bg-base-200/60 border-b px-2 py-3 text-center text-xs font-semibold">
                Time
              </div>
              <div class="border-base-300 bg-base-200/60 border-b border-l px-3 py-3 text-center">
                <div class="text-sm font-semibold">{weekdayShort(anchorDate())}</div>
                <div class="text-base-content/50 text-xs">
                  {anchorDate().getUTCMonth() + 1}/{anchorDate().getUTCDate()}
                </div>
              </div>
              <For each={dayHourRows()}>
                {(row) => (
                  <>
                    <div class="border-base-300 bg-base-200/40 border-b px-2 py-2 text-center text-xs font-semibold tabular-nums">
                      {formatHourLabel(row.hour, settings().appearance.timeFormat)}
                    </div>
                    <button
                      type="button"
                      class="border-base-300 border-b border-l px-2 py-2 text-left text-xs hover:bg-base-200/60"
                      onClick={() => setSelectedSlot({ dateKey: dayKey(), hour: row.hour })}
                    >
                      <Show
                        when={
                          (sessionsByDateHour().get(dayKey())?.get(row.hour) ?? []).length > 0 ||
                          entriesForSlotExcludingSessions(dayKey(), row.hour).length > 0
                        }
                      >
                        <div class="space-y-1">
                          <For each={sessionsByDateHour().get(dayKey())?.get(row.hour) ?? []}>
                            {(session) => (
                              <div class="truncate text-xs font-semibold">
                                {session.name || session.type}
                              </div>
                            )}
                          </For>
                          <For each={entriesForSlotExcludingSessions(dayKey(), row.hour).slice(0, 1)}>
                            {(entry) => (
                              <div class="text-base-content/60 truncate text-xs">
                                {entry.data[0]?.trackerTag ? `#${entry.data[0].trackerTag}` : 'Entry'}
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </button>
                  </>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={view() === 'week'}>
          <div class="border-base-300 flex-1 min-h-0 overflow-hidden rounded-2xl border">
            <div
              class="grid h-full grid-cols-[70px_repeat(7,minmax(0,1fr))]"
              style={{ 'grid-template-rows': `auto ${weekRowTemplate()}` }}
            >
              <div class="border-base-300 bg-base-200/60 border-b px-2 py-2 text-center text-xs font-semibold">
                Time
              </div>
              <For each={weekDates()}>
                {(date) => (
                  <div class="border-base-300 bg-base-200/60 border-b border-l px-3 py-3 text-center">
                    <div class="text-sm font-semibold">{weekdayShort(date)}</div>
                    <div class="text-base-content/50 text-xs">
                      {date.getUTCMonth() + 1}/{date.getUTCDate()}
                    </div>
                  </div>
                )}
              </For>
              <For each={weekHourRows()}>
                {(row) => (
                  <>
                    <div class="border-base-300 bg-base-200/40 border-b px-2 py-2 text-center text-xs font-semibold tabular-nums">
                      {formatHourLabel(row.hour, settings().appearance.timeFormat)}
                    </div>
                    <For each={row.cells}>
                      {(cell) => (
                        <button
                          type="button"
                          class="border-base-300 border-b border-l flex h-full min-h-[32px] flex-col justify-center gap-1 overflow-hidden px-2 py-2 text-left text-xs hover:bg-base-200/60"
                          onClick={() => setSelectedSlot({ dateKey: cell.dateKey, hour: row.hour })}
                        >
                          <Show
                            when={
                              cell.sessions.length +
                                entriesForSlotExcludingSessions(cell.dateKey, row.hour).length >
                              0
                            }
                          >
                            <div class="text-base-content/70 truncate">
                              {cell.sessions.length +
                                entriesForSlotExcludingSessions(cell.dateKey, row.hour).length}{' '}
                              items
                            </div>
                          </Show>
                          <div class="flex flex-col gap-1 overflow-hidden">
                            <For each={cell.sessions.slice(0, 1)}>
                              {(session) => (
                                <div class="truncate text-xs font-semibold">
                                  {session.name || session.type}
                                </div>
                              )}
                            </For>
                            <For
                              each={entriesForSlotExcludingSessions(cell.dateKey, row.hour).slice(0, 1)}
                            >
                              {(entry) => (
                                <div class="text-base-content/60 truncate text-xs">
                                  {entry.data[0]?.trackerTag ? `#${entry.data[0].trackerTag}` : 'Entry'}
                                </div>
                              )}
                            </For>
                          </div>
                        </button>
                      )}
                    </For>
                  </>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={view() === 'month'}>
          <div class="border-base-300 flex-1 min-h-0 overflow-hidden rounded-2xl border">
            <div
              class="grid h-full grid-cols-7"
              style={{
                'grid-template-rows': `auto repeat(${monthWeekCount()}, minmax(0, 1fr))`,
              }}
            >
              <For each={Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchorDate()), i))}>
                {(date) => (
                  <div class="border-base-300 bg-base-200/60 border-b border-l px-3 py-3 text-center text-sm font-semibold">
                    {weekdayShort(date)}
                  </div>
                )}
              </For>
              <For each={monthGridDates()}>
                {(date) => {
                  const dateKey = toDateString(date);
                  const items = () => {
                    const entryItems = (entriesByDate().get(dateKey) ?? []).flatMap((entry) =>
                      entry.data.map((item) => {
                        const tracker = trackerMap().get(item.trackerId);
                        const details = formatEntryDetails(item, tracker);
                        const label = tracker?.label ?? item.trackerTag;
                        return {
                          id: `${entry._id}-${item.trackerId}`,
                          label: details ? `${label}: ${details}` : label,
                        };
                      }),
                    );
                    const sessionItems = (sessionsByDate().get(dateKey) ?? []).map((session) => {
                      const label = session.name || (session.type === 'ai' ? 'AI Chat' : session.type);
                      const timeLabel = formatSessionTime(
                        session,
                        settings().appearance.timeFormat,
                      );
                      return {
                        id: `session-${session._id}`,
                        label: `Session: ${label} (${timeLabel})`,
                      };
                    });
                    return [...sessionItems, ...entryItems];
                  };
                  const preview = () => items().slice(0, 3);
                  const extraCount = () => Math.max(0, items().length - preview().length);
                  const inMonth = () => date.getUTCMonth() === anchorDate().getUTCMonth();

                  return (
                    <div
                      class={`border-base-300 border-b border-l p-2 overflow-hidden ${inMonth() ? 'bg-base-100/60' : 'bg-base-200/20 text-base-content/40'}`}
                    >
                      <div class="text-base-content/70 mb-2 text-sm font-semibold">
                        {date.getUTCDate()}
                      </div>
                      <div class="space-y-1">
                        <For each={preview()}>
                          {(item) => (
                            <button
                              type="button"
                              class="bg-base-200/70 border-base-300/40 text-base-content/70 hover:text-base-content w-full rounded-md border px-2 py-1 text-left text-xs truncate transition-colors"
                              onClick={() => setSelectedDate(dateKey)}
                            >
                              {item.label}
                            </button>
                          )}
                        </For>
                        <Show when={extraCount() > 0}>
                          <button
                            type="button"
                            class="text-base-content/50 text-xs hover:text-base-content/70"
                            onClick={() => setSelectedDate(dateKey)}
                          >
                            +{extraCount()} more
                          </button>
                        </Show>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>
      </Show>

      <Show when={selectedDate()}>
        <div class="modal modal-open backdrop-blur-sm">
          <div class="modal-box bg-base-200 border-base-300 relative w-full max-w-3xl border">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold">
                  Entries for {selectedDate()}
                </h3>
                <p class="text-base-content/60 text-sm">
                  {formatFullDate(new Date(`${selectedDate()}T00:00:00Z`))}
                </p>
              </div>
              <button type="button" class="btn btn-ghost btn-sm" onClick={() => setSelectedDate(null)}>
                Close
              </button>
            </div>
            <div class="mt-4 space-y-3">
              <Show when={(sessionsByDate().get(selectedDate() || '') ?? []).length > 0}>
                <div class="space-y-2">
                  <div class="text-base-content/60 text-xs font-semibold uppercase tracking-wide">
                    Sessions
                  </div>
                  <For each={sessionsByDate().get(selectedDate() || '') ?? []}>
                    {(session) => renderSessionBadge(session, true)}
                  </For>
                </div>
              </Show>
              <Show
                when={
                  entriesForDateExcludingSessions(selectedDate() || '').length > 0
                }
                fallback={
                  <div class="text-base-content/60 text-sm">No entries recorded.</div>
                }
              >
                <For each={entriesForDateExcludingSessions(selectedDate() || '')}>
                  {(entry) => renderEntryCard(entry)}
                </For>
              </Show>
            </div>
          </div>
          <div class="modal-backdrop" onClick={() => setSelectedDate(null)} />
        </div>
      </Show>

      <Show when={selectedSlot()}>
        <div class="modal modal-open backdrop-blur-sm">
          <div class="modal-box bg-base-200 border-base-300 relative w-full max-w-3xl border">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold">
                  {selectedSlot() ? formatHourLabel(selectedSlot()!.hour, settings().appearance.timeFormat) : ''}
                </h3>
                <p class="text-base-content/60 text-sm">
                  {selectedSlot()
                    ? formatFullDate(new Date(`${selectedSlot()!.dateKey}T00:00:00Z`))
                    : ''}
                </p>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                onClick={() => setSelectedSlot(null)}
              >
                Close
              </button>
            </div>
            <div class="mt-4 space-y-3">
              <Show when={selectedSlot()}>
                <Show
                  when={sessionsForSlot(selectedSlot()!.dateKey, selectedSlot()!.hour).length > 0}
                >
                  <div class="space-y-2">
                    <div class="text-base-content/60 text-xs font-semibold uppercase tracking-wide">
                      Sessions
                    </div>
                    <For each={sessionsForSlot(selectedSlot()!.dateKey, selectedSlot()!.hour)}>
                      {(session) => renderSessionBadge(session, true)}
                    </For>
                  </div>
                </Show>
                <Show
                  when={
                    entriesForSlotExcludingSessions(selectedSlot()!.dateKey, selectedSlot()!.hour)
                      .length > 0
                  }
                  fallback={
                    <div class="text-base-content/60 text-sm">No entries recorded.</div>
                  }
                >
                  <div class="space-y-2">
                    <div class="text-base-content/60 text-xs font-semibold uppercase tracking-wide">
                      Entries
                    </div>
                    <For
                      each={entriesForSlotExcludingSessions(
                        selectedSlot()!.dateKey,
                        selectedSlot()!.hour,
                      )}
                    >
                      {(entry) => renderEntryCard(entry)}
                    </For>
                  </div>
                </Show>
              </Show>
            </div>
          </div>
          <div class="modal-backdrop" onClick={() => setSelectedSlot(null)} />
        </div>
      </Show>
    </div>
  );
}
