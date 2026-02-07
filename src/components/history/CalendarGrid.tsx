import { ChevronLeft, ChevronRight } from 'lucide-solid';
import { For, Show, createMemo, createSignal } from 'solid-js';
import type { Entry, Group, Session, Tracker } from '../../lib/db/types';

interface CalendarGridProps {
  entries: Entry[];
  sessions: Session[];
  trackers: Tracker[];
  groups: Group[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onEntryClick: (entry: Entry) => void;
  onSessionClick: (session: Session) => void;
  onDayClick: (date: Date) => void;
  showHeader?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDateString = (date: Date) => date.toISOString().split('T')[0];

const startOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const endOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

const startOfWeek = (date: Date) => {
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = base.getUTCDay();
  const diff = (day + 6) % 7;
  base.setUTCDate(base.getUTCDate() - diff);
  return base;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const isSameMonth = (date1: Date, date2: Date) =>
  date1.getUTCMonth() === date2.getUTCMonth() && date1.getUTCFullYear() === date2.getUTCFullYear();

const isSameDay = (date1: Date, date2: Date) => toDateString(date1) === toDateString(date2);

const formatMonthYear = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export default function CalendarGrid(props: CalendarGridProps) {
  const [viewMode, setViewMode] = createSignal<'month' | 'week'>('month');

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

  const entriesByDate = createMemo(() => {
    const map = new Map<string, Entry[]>();
    props.entries.forEach((entry) => {
      const date = entry.date;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(entry);
    });
    return map;
  });

  const sessionsByDate = createMemo(() => {
    const map = new Map<string, Session[]>();
    props.sessions.forEach((session) => {
      if (!session.startTime) return;
      const dateKey = toDateString(new Date(session.startTime));
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(session);
    });
    return map;
  });

  const calendarDays = createMemo(() => {
    const monthStart = startOfMonth(props.currentDate);
    const monthEnd = endOfMonth(props.currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = startOfWeek(addDays(monthEnd, 6));

    const days: Date[] = [];
    let cursor = calendarStart;
    while (cursor <= calendarEnd) {
      days.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    return days;
  });

  const weekDays = createMemo(() => {
    const weekStart = startOfWeek(props.currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  });

  const getDayItems = (date: Date) => {
    const dateKey = toDateString(date);
    const entries = entriesByDate().get(dateKey) || [];
    const sessions = sessionsByDate().get(dateKey) || [];
    return { entries, sessions };
  };

  const navigateMonth = (direction: -1 | 1) => {
    const newDate = new Date(props.currentDate);
    newDate.setUTCMonth(newDate.getUTCMonth() + direction);
    props.onDateChange(newDate);
  };

  const navigateWeek = (direction: -1 | 1) => {
    const newDate = addDays(props.currentDate, direction * 7);
    props.onDateChange(newDate);
  };

  const goToToday = () => {
    props.onDateChange(new Date());
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

  const showHeader = () => props.showHeader ?? true;

  return (
    <div class="flex h-full flex-col">
      <Show when={showHeader()}>
        {/* Header */}
        <div class="border-base-300 flex items-center justify-between border-b px-4 py-3">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="btn btn-ghost btn-sm btn-circle"
                onClick={() => (viewMode() === 'month' ? navigateMonth(-1) : navigateWeek(-1))}
              >
                <ChevronLeft class="h-5 w-5" />
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm btn-circle"
                onClick={() => (viewMode() === 'month' ? navigateMonth(1) : navigateWeek(1))}
              >
                <ChevronRight class="h-5 w-5" />
              </button>
            </div>
            <h2 class="text-lg font-semibold">{formatMonthYear(props.currentDate)}</h2>
            <button type="button" class="btn btn-ghost btn-sm" onClick={goToToday}>
              Today
            </button>
          </div>

          <div class="join">
            <button
              type="button"
              class={`btn btn-sm join-item ${viewMode() === 'month' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('month')}
            >
              Month
            </button>
            <button
              type="button"
              class={`btn btn-sm join-item ${viewMode() === 'week' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
          </div>
        </div>
      </Show>

      {/* Weekday Headers */}
      <div class="border-base-300 bg-base-200/50 grid grid-cols-7 border-b">
        <For each={WEEKDAYS}>
          {(day) => (
            <div class="text-base-content/70 px-2 py-2 text-center text-sm font-semibold">
              {day}
            </div>
          )}
        </For>
      </div>

      {/* Calendar Grid */}
      <Show when={viewMode() === 'month'}>
        <div class="grid flex-1 auto-rows-fr grid-cols-7 overflow-hidden">
          <For each={calendarDays()}>
            {(date) => {
              const { entries, sessions } = getDayItems(date);
              const inCurrentMonth = isSameMonth(date, props.currentDate);
              const isToday = isSameDay(date, new Date());
              const totalItems = entries.length + sessions.length;

              return (
                <div
                  class={`border-base-300 hover:bg-base-200/50 relative min-h-[80px] cursor-pointer border-r border-b p-2 transition-colors ${
                    inCurrentMonth ? 'bg-base-100' : 'bg-base-200/30'
                  }`}
                  onClick={() => props.onDayClick(date)}
                >
                  {/* Day Number */}
                  <div class="mb-1 flex items-center justify-between">
                    <span
                      class={`text-sm font-medium ${
                        isToday
                          ? 'bg-primary text-primary-content rounded-full px-2 py-0.5'
                          : inCurrentMonth
                            ? 'text-base-content'
                            : 'text-base-content/40'
                      }`}
                    >
                      {date.getUTCDate()}
                    </span>
                    <Show when={totalItems > 0}>
                      <span class="text-base-content/50 text-xs">{totalItems}</span>
                    </Show>
                  </div>

                  {/* Events */}
                  <div class="space-y-1">
                    {/* Sessions */}
                    <For each={sessions.slice(0, 2)}>
                      {(session) => (
                        <div
                          class="truncate rounded px-1.5 py-0.5 text-xs font-medium text-white"
                          style={{ 'background-color': getSessionColor(session) }}
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onSessionClick(session);
                          }}
                        >
                          {session.name || session.type}
                        </div>
                      )}
                    </For>

                    {/* Entries */}
                    <For each={entries.slice(0, sessions.length > 0 ? 1 : 2)}>
                      {(entry) => (
                        <div
                          class="truncate rounded px-1.5 py-0.5 text-xs font-medium text-white"
                          style={{ 'background-color': getEntryColor(entry) }}
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onEntryClick(entry);
                          }}
                        >
                          {entry.data[0]?.trackerTag || 'Entry'}
                        </div>
                      )}
                    </For>

                    {/* More indicator */}
                    <Show when={totalItems > (sessions.length > 0 ? 3 : 2)}>
                      <div class="text-base-content/50 text-xs">
                        +{totalItems - (sessions.length > 0 ? 3 : 2)} more
                      </div>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Week View */}
      <Show when={viewMode() === 'week'}>
        <div class="grid flex-1 auto-rows-fr grid-cols-7 overflow-hidden">
          <For each={weekDays()}>
            {(date) => {
              const { entries, sessions } = getDayItems(date);
              const isToday = isSameDay(date, new Date());

              return (
                <div
                  class={`border-base-300 hover:bg-base-200/50 relative min-h-[120px] cursor-pointer border-r p-3 transition-colors ${
                    isToday ? 'bg-primary/5' : 'bg-base-100'
                  }`}
                  onClick={() => props.onDayClick(date)}
                >
                  {/* Day Header */}
                  <div class="mb-3 text-center">
                    <div class="text-base-content/60 text-xs">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div
                      class={`mt-1 inline-flex h-8 w-8 items-center justify-center text-lg font-semibold ${
                        isToday
                          ? 'bg-primary text-primary-content rounded-full'
                          : 'text-base-content'
                      }`}
                    >
                      {date.getUTCDate()}
                    </div>
                  </div>

                  {/* Events List */}
                  <div class="space-y-1.5">
                    {/* Sessions */}
                    <For each={sessions}>
                      {(session) => (
                        <div
                          class="truncate rounded-md px-2 py-1 text-xs font-medium text-white"
                          style={{ 'background-color': getSessionColor(session) }}
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onSessionClick(session);
                          }}
                        >
                          {session.name || session.type}
                        </div>
                      )}
                    </For>

                    {/* Entries */}
                    <For each={entries}>
                      {(entry) => (
                        <div
                          class="truncate rounded-md px-2 py-1 text-xs font-medium text-white"
                          style={{ 'background-color': getEntryColor(entry) }}
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onEntryClick(entry);
                          }}
                        >
                          {entry.data.map((d) => d.trackerTag).join(', ')}
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
