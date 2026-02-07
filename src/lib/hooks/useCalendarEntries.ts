import { createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import type { Entry } from '../db/types';
import { entryRepo } from '../repositories';

const DAYS_BATCH_SIZE = 30; // Number of days to load at a time
const DEFAULT_PAST_DAYS = 30;
const DEFAULT_FUTURE_DAYS = 7;

const toDateString = (date: Date) => date.toISOString().split('T')[0];

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export function useCalendarEntries() {
  const [entries, setEntries] = createSignal<Entry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [hasMorePast, setHasMorePast] = createSignal(true);
  const [hasMoreFuture, setHasMoreFuture] = createSignal(true);
  const [currentDate, setCurrentDate] = createSignal(new Date());
  const [visibleStartDate, setVisibleStartDate] = createSignal<Date>(
    addDays(new Date(), -DEFAULT_PAST_DAYS),
  );
  const [visibleEndDate, setVisibleEndDate] = createSignal<Date>(
    addDays(new Date(), DEFAULT_FUTURE_DAYS),
  );

  // Load entries for a specific date range
  const loadEntriesForRange = async (start: Date, end: Date, append: boolean = false) => {
    try {
      setLoading(true);
      const startStr = toDateString(start);
      const endStr = toDateString(end);

      const result = await entryRepo.findInDateRange(startStr, endStr);

      if (append) {
        setEntries((prev: Entry[]) => {
          const existingIds = new Set(prev.map((e: Entry) => e._id));
          const newEntries = result.filter((e: Entry) => !existingIds.has(e._id));
          return [...prev, ...newEntries];
        });
      } else {
        setEntries(result);
      }

      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  // Load more entries in the past
  const loadMorePast = async (): Promise<boolean> => {
    if (loading() || !hasMorePast()) return false;

    const newStart = addDays(visibleStartDate(), -DAYS_BATCH_SIZE);
    await loadEntriesForRange(newStart, visibleStartDate(), true);

    // Check if we've reached the beginning of history
    const loadedEntries = entries().filter(
      (e) => e.date >= toDateString(newStart) && e.date < toDateString(visibleStartDate()),
    );
    if (loadedEntries.length === 0) {
      setHasMorePast(false);
    }

    setVisibleStartDate(newStart);
    return hasMorePast();
  };

  // Load more entries in the future
  const loadMoreFuture = async (): Promise<boolean> => {
    if (loading() || !hasMoreFuture()) return false;

    const newEnd = addDays(visibleEndDate(), DAYS_BATCH_SIZE);
    await loadEntriesForRange(visibleEndDate(), newEnd, true);

    // Check if we've reached today or future
    const today = new Date();
    if (newEnd >= today) {
      setHasMoreFuture(false);
    }

    setVisibleEndDate(newEnd);
    return hasMoreFuture();
  };

  // Load more in either direction (for mobile infinite scroll)
  const loadMore = async (direction: 'past' | 'future'): Promise<boolean> => {
    if (direction === 'past') {
      return loadMorePast();
    }
    return loadMoreFuture();
  };

  // Refresh entries for current visible range
  const refresh = async () => {
    await loadEntriesForRange(visibleStartDate(), visibleEndDate(), false);
  };

  // Navigate to a specific date
  const navigateToDate = async (date: Date) => {
    setCurrentDate(date);
    const newStart = addDays(date, -DEFAULT_PAST_DAYS);
    const newEnd = addDays(date, DEFAULT_FUTURE_DAYS);
    setVisibleStartDate(newStart);
    setVisibleEndDate(newEnd);
    setHasMorePast(true);
    setHasMoreFuture(newEnd < new Date());
    await loadEntriesForRange(newStart, newEnd, false);
  };

  const [error, setError] = createSignal<Error | null>(null);

  // Initial load
  onMount(async () => {
    await loadEntriesForRange(visibleStartDate(), visibleEndDate(), false);

    // Subscribe to changes
    const unsubscribe = entryRepo.onChange(() => {
      refresh();
    });

    onCleanup(unsubscribe);
  });

  // Filter entries by visible range (for performance)
  const visibleEntries = createMemo(() => {
    const start = toDateString(visibleStartDate());
    const end = toDateString(visibleEndDate());
    return entries().filter((e) => e.date >= start && e.date <= end);
  });

  return {
    entries: visibleEntries,
    allEntries: entries,
    loading,
    error,
    hasMorePast,
    hasMoreFuture,
    currentDate,
    visibleStartDate,
    visibleEndDate,
    loadMore,
    refresh,
    navigateToDate,
    setCurrentDate,
  };
}
