import { Calendar, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import type { Entry, Group, Session, Tracker } from '../../lib/db/types';

interface MobileInfiniteCalendarProps {
  entries: Entry[];
  sessions: Session[];
  trackers: Tracker[];
  groups: Group[];
  currentDate: Date;
  onEntryClick: (entry: Entry) => void;
  onSessionClick: (session: Session) => void;
  onDayClick: (date: Date) => void;
  onDateChange: (date: Date) => void;
  onLoadMore: (direction: 'past' | 'future') => Promise<boolean>;
  hasMorePast: boolean;
  hasMoreFuture: boolean;
  loading: boolean;
}

interface DayGroup {
  date: Date;
  dateKey: string;
  entries: Entry[];
  sessions: Session[];
}

const toDateString = (date: Date) => date.toISOString().split('T')[0];

const isSameDay = (date1: Date, date2: Date) => toDateString(date1) === toDateString(date2);

const isSameMonth = (date1: Date, date2: Date) =>
  date1.getUTCMonth() === date2.getUTCMonth() && date1.getUTCFullYear() === date2.getUTCFullYear();

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

const formatMonthYear = (date: Date) => {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

export default function MobileInfiniteCalendar(props: MobileInfiniteCalendarProps) {
  const [containerRef, setContainerRef] = createSignal<HTMLDivElement | null>(null);
  const [isLoadingMore, setIsLoadingMore] = createSignal(false);
  const [showMonthPicker, setShowMonthPicker] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<'list' | 'mini-calendar'>('list');

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

  const days = createMemo(() => {
    const dayMap = new Map<string, DayGroup>();

    // Add entries
    props.entries.forEach((entry) => {
      const dateKey = entry.date;
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          date: new Date(`${dateKey}T00:00:00Z`),
          dateKey,
          entries: [],
          sessions: [],
        });
      }
      dayMap.get(dateKey)!.entries.push(entry);
    });

    // Add sessions
    props.sessions.forEach((session) => {
      if (!session.startTime) return;
      const dateKey = toDateString(new Date(session.startTime));
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          date: new Date(`${dateKey}T00:00:00Z`),
          dateKey,
          entries: [],
          sessions: [],
        });
      }
      dayMap.get(dateKey)!.sessions.push(session);
    });

    // Sort by date descending
    return Array.from(dayMap.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  });

  // Generate months for picker (past 2 years to future 1 year)
  const availableMonths = createMemo(() => {
    const months: Date[] = [];
    const today = new Date();
    const start = new Date(today.getFullYear() - 2, 0, 1);
    const end = new Date(today.getFullYear() + 1, 11, 31);

    const cursor = new Date(start);
    while (cursor <= end) {
      months.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return months.reverse();
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

  const navigateMonth = (direction: -1 | 1) => {
    const newDate = addMonths(props.currentDate, direction);
    props.onDateChange(newDate);
  };

  const goToToday = () => {
    props.onDateChange(new Date());
  };

  const selectMonth = (date: Date) => {
    props.onDateChange(date);
    setShowMonthPicker(false);
  };

  // Mini calendar days
  const miniCalendarDays = createMemo(() => {
    const year = props.currentDate.getUTCFullYear();
    const month = props.currentDate.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));

    // Get start of week for first day
    const startOfWeek = new Date(firstDay);
    const dayOfWeek = startOfWeek.getUTCDay();
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - ((dayOfWeek + 6) % 7));

    // Get end of week for last day
    const endOfWeek = new Date(lastDay);
    const lastDayOfWeek = endOfWeek.getUTCDay();
    endOfWeek.setUTCDate(endOfWeek.getUTCDate() + ((7 - lastDayOfWeek) % 7));

    const days: Date[] = [];
    const cursor = new Date(startOfWeek);
    while (cursor <= endOfWeek) {
      days.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days;
  });

  const getDayItems = (date: Date) => {
    const dateKey = toDateString(date);
    const entries = props.entries.filter((e) => e.date === dateKey);
    const sessions = props.sessions.filter((s) => {
      if (!s.startTime) return false;
      return toDateString(new Date(s.startTime)) === dateKey;
    });
    return { entries, sessions };
  };

  // Infinite scroll handling
  createEffect(() => {
    const container = containerRef();
    if (!container) return;

    const handleScroll = () => {
      if (isLoadingMore()) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollBottom = scrollHeight - scrollTop - clientHeight;

      // Load more when approaching bottom (future dates)
      if (scrollBottom < 300 && props.hasMoreFuture && !isLoadingMore()) {
        setIsLoadingMore(true);
        props.onLoadMore('future').then(() => {
          setIsLoadingMore(false);
        });
      }

      // Load more when approaching top (past dates)
      if (scrollTop < 300 && props.hasMorePast && !isLoadingMore()) {
        setIsLoadingMore(true);
        const prevHeight = container.scrollHeight;
        props.onLoadMore('past').then(() => {
          // Maintain scroll position after loading past items
          requestAnimationFrame(() => {
            const newHeight = container.scrollHeight;
            container.scrollTop = newHeight - prevHeight + scrollTop;
          });
          setIsLoadingMore(false);
        });
      }
    };

    container.addEventListener('scroll', handleScroll);
    onCleanup(() => container.removeEventListener('scroll', handleScroll));
  });

  return (
    <div class="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div class="border-base-300 bg-base-100 sticky top-0 z-20 border-b px-4 py-3 shadow-sm">
        <div class="flex items-center justify-between">
          {/* Month Navigation */}
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-circle"
              onClick={() => navigateMonth(-1)}
            >
              <ChevronLeft class="h-5 w-5" />
            </button>

            <button
              type="button"
              class="btn btn-ghost btn-sm px-3"
              onClick={() => setShowMonthPicker(true)}
            >
              <span class="font-semibold">{formatMonthYear(props.currentDate)}</span>
            </button>

            <button
              type="button"
              class="btn btn-ghost btn-sm btn-circle"
              onClick={() => navigateMonth(1)}
            >
              <ChevronRight class="h-5 w-5" />
            </button>
          </div>

          {/* View Toggle & Today */}
          <div class="flex items-center gap-1">
            <button
              type="button"
              class={`btn btn-sm ${viewMode() === 'list' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('list')}
            >
              <List class="h-4 w-4" />
            </button>
            <button
              type="button"
              class={`btn btn-sm ${viewMode() === 'mini-calendar' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('mini-calendar')}
            >
              <LayoutGrid class="h-4 w-4" />
            </button>
            <button type="button" class="btn btn-ghost btn-sm ml-1" onClick={goToToday}>
              Today
            </button>
          </div>
        </div>
      </div>

      {/* Mini Calendar View */}
      <Show when={viewMode() === 'mini-calendar'}>
        <div class="border-base-300 bg-base-100 border-b p-4">
          {/* Weekday headers */}
          <div class="mb-2 grid grid-cols-7 gap-1">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day) => (
              <div class="text-base-content/50 text-center text-xs font-medium">{day}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div class="grid grid-cols-7 gap-1">
            <For each={miniCalendarDays()}>
              {(date) => {
                const { entries, sessions } = getDayItems(date);
                const inCurrentMonth = isSameMonth(date, props.currentDate);
                const isToday = isSameDay(date, new Date());
                const hasItems = entries.length > 0 || sessions.length > 0;

                return (
                  <button
                    type="button"
                    class={`relative aspect-square rounded-lg p-1 text-sm transition-colors ${
                      isToday
                        ? 'bg-primary text-primary-content'
                        : inCurrentMonth
                          ? 'bg-base-200 hover:bg-base-300'
                          : 'text-base-content/30 bg-transparent'
                    }`}
                    onClick={() => {
                      if (!isSameMonth(date, props.currentDate)) {
                        props.onDateChange(date);
                      }
                      props.onDayClick(date);
                    }}
                  >
                    <span class="font-medium">{date.getUTCDate()}</span>
                    {hasItems && (
                      <div class="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                        {sessions.length > 0 && <div class="bg-secondary h-1 w-1 rounded-full" />}
                        {entries.length > 0 && <div class="bg-primary h-1 w-1 rounded-full" />}
                      </div>
                    )}
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* List View */}
      <div ref={setContainerRef} class="flex-1 overflow-y-auto">
        <Show when={viewMode() === 'list'}>
          {/* Loading indicator for past */}
          <Show when={props.loading && props.hasMorePast}>
            <div class="flex items-center justify-center gap-2 py-4">
              <span class="loading loading-spinner loading-sm text-primary"></span>
              <span class="text-base-content/60 text-sm">Loading history...</span>
            </div>
          </Show>

          {/* Empty state */}
          <Show when={!props.loading && days().length === 0}>
            <div class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
              <Calendar class="text-base-content/20 h-16 w-16" />
              <div class="text-center">
                <h3 class="text-lg font-semibold">No entries yet</h3>
                <p class="text-base-content/60">Start tracking to see your history here</p>
              </div>
            </div>
          </Show>

          {/* Days list */}
          <div class="divide-base-300 divide-y">
            <For each={days()}>
              {(day) => (
                <div class="flex gap-3 px-4 py-3">
                  {/* Date column */}
                  <div class="flex w-14 flex-shrink-0 flex-col items-center pt-1">
                    <div class="text-base-content/60 text-xs">
                      {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div
                      class={`text-lg font-semibold ${
                        isSameDay(day.date, new Date()) ? 'text-primary' : 'text-base-content'
                      }`}
                    >
                      {day.date.getUTCDate()}
                    </div>
                  </div>

                  {/* Events column */}
                  <div class="flex-1 space-y-2">
                    {/* Sessions */}
                    <For each={day.sessions}>
                      {(session) => (
                        <div
                          class="cursor-pointer overflow-hidden rounded-lg"
                          style={{ 'background-color': `${getSessionColor(session)}20` }}
                          onClick={() => props.onSessionClick(session)}
                        >
                          <div
                            class="px-3 py-2"
                            style={{ 'border-left': `3px solid ${getSessionColor(session)}` }}
                          >
                            <div class="flex items-center justify-between">
                              <span class="text-sm font-semibold">
                                {session.name || session.type}
                              </span>
                              <span class="text-base-content/60 text-xs">
                                {formatDuration(session.startTime, session.endTime)}
                              </span>
                            </div>
                            <Show when={session.notes}>
                              <p class="text-base-content/70 mt-1 line-clamp-2 text-xs">
                                {session.notes}
                              </p>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>

                    {/* Entries */}
                    <For each={day.entries}>
                      {(entry) => (
                        <div
                          class="cursor-pointer overflow-hidden rounded-lg"
                          style={{ 'background-color': `${getEntryColor(entry)}15` }}
                          onClick={() => props.onEntryClick(entry)}
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
                                      {getTrackerLabel(data.trackerId)}
                                    </span>
                                  )}
                                </For>
                              </div>
                              <span class="text-base-content/60 ml-2 flex-shrink-0 text-xs">
                                {formatTime(entry.timestamp)}
                              </span>
                            </div>
                            <Show when={formatEntryDetails(entry)}>
                              <p class="text-base-content/70 mt-1 text-xs">
                                {formatEntryDetails(entry)}
                              </p>
                            </Show>
                            <Show when={entry.note}>
                              <p class="text-base-content/60 mt-1 line-clamp-2 text-xs italic">
                                {entry.note}
                              </p>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>

          {/* Loading indicator for future */}
          <Show when={props.loading && props.hasMoreFuture}>
            <div class="flex items-center justify-center gap-2 py-4">
              <span class="loading loading-spinner loading-sm text-primary"></span>
              <span class="text-base-content/60 text-sm">Loading more...</span>
            </div>
          </Show>

          {/* End of history indicator */}
          <Show when={!props.hasMorePast && days().length > 0}>
            <div class="text-base-content/40 py-4 text-center text-sm">Beginning of history</div>
          </Show>
        </Show>
      </div>

      {/* Month Picker Modal */}
      <Show when={showMonthPicker()}>
        <div class="modal modal-open" onClick={() => setShowMonthPicker(false)}>
          <div class="modal-box max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 class="mb-4 text-lg font-bold">Select Month</h3>
            <div class="space-y-2">
              <For each={availableMonths()}>
                {(month) => (
                  <button
                    type="button"
                    class={`w-full rounded-lg px-4 py-3 text-left transition-colors ${
                      isSameMonth(month, props.currentDate)
                        ? 'bg-primary text-primary-content'
                        : 'hover:bg-base-200'
                    }`}
                    onClick={() => selectMonth(month)}
                  >
                    <span class="font-semibold">
                      {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                  </button>
                )}
              </For>
            </div>
            <div class="modal-action">
              <button type="button" class="btn btn-ghost" onClick={() => setShowMonthPicker(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
