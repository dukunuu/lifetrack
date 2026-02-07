import { ChevronLeft, ChevronRight } from 'lucide-solid';
import { Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import type { Entry, Session } from '../../lib/db/types';
import { useCalendarEntries } from '../../lib/hooks/useCalendarEntries';
import { useGroups } from '../../lib/hooks/useGroups';
import { useSessions } from '../../lib/hooks/useSessions';
import { useTrackers } from '../../lib/hooks/useTrackers';
import CalendarGrid from './CalendarGrid';
import DayDetailModal from './DayDetailModal';
import EntryDetailModal from './EntryDetailModal';
import HourGrid from './HourGrid';
import MobileInfiniteCalendar from './MobileInfiniteCalendar';
import SessionDetailModal from './SessionDetailModal';
import WeekGrid from './WeekGrid';

export default function HistoryCalendar() {
  const { entries, loading, hasMorePast, hasMoreFuture, currentDate, loadMore, navigateToDate } =
    useCalendarEntries();
  const { sessions } = useSessions();
  const { trackers } = useTrackers({ loadAll: true });
  const { groups } = useGroups();

  const [isMobile, setIsMobile] = createSignal(false);
  const [selectedEntry, setSelectedEntry] = createSignal<Entry | null>(null);
  const [selectedSession, setSelectedSession] = createSignal<Session | null>(null);
  const [selectedDate, setSelectedDate] = createSignal<Date | null>(null);
  const [viewMode, setViewMode] = createSignal<'month' | 'week' | 'day'>('month');

  // Check for mobile on mount and on resize
  onMount(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };
    checkMobile();

    const media = window.matchMedia('(max-width: 768px)');
    const handler = () => checkMobile();
    media.addEventListener('change', handler);
    onCleanup(() => media.removeEventListener('change', handler));
  });

  const trackersList = createMemo(() => trackers());
  const groupsList = createMemo(() => groups());
  const sessionsList = createMemo(() => sessions());

  const handleDateChange = (date: Date) => {
    navigateToDate(date);
  };

  const handleEntryClick = (entry: Entry) => {
    setSelectedEntry(entry);
  };

  const handleSessionClick = (session: Session) => {
    setSelectedSession(session);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleLoadMore = async (direction: 'past' | 'future') => {
    return loadMore(direction);
  };

  const navigate = (direction: -1 | 1) => {
    const newDate = new Date(currentDate());
    if (viewMode() === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else {
      newDate.setDate(newDate.getDate() + direction * (viewMode() === 'week' ? 7 : 1));
    }
    navigateToDate(newDate);
  };

  const goToToday = () => {
    navigateToDate(new Date());
  };

  const formatDateRange = () => {
    const date = currentDate();
    if (viewMode() === 'month') {
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (viewMode() === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    const isToday = new Date().toDateString() === date.toDateString();
    if (isToday) return 'Today';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  return (
    <div class="flex h-full flex-col overflow-hidden">
      {/* Desktop View */}
      <div class={`${isMobile() ? 'hidden' : 'flex'} h-full flex-col`}>
        {/* Unified Header */}
        <div class="border-base-300 bg-base-100 border-b px-4 py-3">
          <div class="flex items-center justify-between">
            {/* View Toggle */}
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
              <button
                type="button"
                class={`btn btn-sm join-item ${viewMode() === 'day' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('day')}
              >
                Day
              </button>
            </div>

            {/* Navigation */}
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="btn btn-ghost btn-sm btn-circle"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft class="h-5 w-5" />
              </button>
              <span class="min-w-[200px] text-center font-semibold">{formatDateRange()}</span>
              <button
                type="button"
                class="btn btn-ghost btn-sm btn-circle"
                onClick={() => navigate(1)}
              >
                <ChevronRight class="h-5 w-5" />
              </button>
              <button type="button" class="btn btn-ghost btn-sm ml-2" onClick={goToToday}>
                Today
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-hidden">
          {/* Month View */}
          <Show when={viewMode() === 'month'}>
            <CalendarGrid
              entries={entries()}
              sessions={sessionsList()}
              trackers={trackersList()}
              groups={groupsList()}
              currentDate={currentDate()}
              onDateChange={handleDateChange}
              onEntryClick={handleEntryClick}
              onSessionClick={handleSessionClick}
              onDayClick={handleDayClick}
              showHeader={false}
            />
          </Show>

          {/* Week View */}
          <Show when={viewMode() === 'week'}>
            <WeekGrid
              entries={entries()}
              sessions={sessionsList()}
              trackers={trackersList()}
              groups={groupsList()}
              currentDate={currentDate()}
              onEntryClick={handleEntryClick}
              onSessionClick={handleSessionClick}
              onDayClick={handleDayClick}
            />
          </Show>

          {/* Day View */}
          <Show when={viewMode() === 'day'}>
            <HourGrid
              entries={entries().filter(
                (e) => e.date === currentDate().toISOString().split('T')[0],
              )}
              sessions={sessionsList().filter((s) => {
                if (!s.startTime) return false;
                return (
                  new Date(s.startTime).toISOString().split('T')[0] ===
                  currentDate().toISOString().split('T')[0]
                );
              })}
              trackers={trackersList()}
              groups={groupsList()}
              currentDate={currentDate()}
              onEntryClick={handleEntryClick}
              onSessionClick={handleSessionClick}
              startHour={6}
              endHour={22}
            />
          </Show>
        </div>
      </div>

      {/* Mobile View */}
      <div class={`${isMobile() ? 'flex' : 'hidden'} h-full flex-col`}>
        <MobileInfiniteCalendar
          entries={entries()}
          sessions={sessionsList()}
          trackers={trackersList()}
          groups={groupsList()}
          currentDate={currentDate()}
          onEntryClick={handleEntryClick}
          onSessionClick={handleSessionClick}
          onDayClick={handleDayClick}
          onDateChange={handleDateChange}
          onLoadMore={handleLoadMore}
          hasMorePast={hasMorePast()}
          hasMoreFuture={hasMoreFuture()}
          loading={loading()}
        />
      </div>

      {/* Modals */}
      <EntryDetailModal entry={selectedEntry()} onClose={() => setSelectedEntry(null)} />
      <SessionDetailModal session={selectedSession()} onClose={() => setSelectedSession(null)} />
      <DayDetailModal
        date={selectedDate()}
        entries={entries().filter((e) => {
          const date = selectedDate();
          return date ? e.date === date.toISOString().split('T')[0] : false;
        })}
        sessions={sessionsList().filter((s) => {
          const date = selectedDate();
          if (!date || !s.startTime) return false;
          return (
            new Date(s.startTime).toISOString().split('T')[0] === date.toISOString().split('T')[0]
          );
        })}
        trackers={trackersList()}
        groups={groupsList()}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}
