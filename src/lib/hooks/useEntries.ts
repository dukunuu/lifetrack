import { createSignal, onMount, onCleanup } from 'solid-js';
import type { Entry } from '../db/types';
import { entryRepo } from '../repositories';

export function useEntries(options?: { limit?: number; autoLoad?: boolean }) {
  const [entries, setEntries] = createSignal<Entry[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<Error | null>(null);
  const [hasMore, setHasMore] = createSignal(false);
  const [total, setTotal] = createSignal(0);

  const limit = options?.limit ?? 50;
  const autoLoad = options?.autoLoad ?? true;

  const loadEntries = async (skip: number = 0, append: boolean = false) => {
    try {
      setLoading(true);
      const result = await entryRepo.findRecentWithPagination(limit, skip);

      if (append) {
        setEntries((prev) => [...prev, ...result.entries]);
      } else {
        setEntries(result.entries);
      }

      setHasMore(result.hasMore);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore() || loading()) return;
    await loadEntries(entries().length, true);
  };

  const refresh = async () => {
    await loadEntries(0, false);
  };

  onMount(async () => {
    if (autoLoad) {
      await loadEntries();
    }

    const unsubscribe = entryRepo.onChange(() => {
      // Refresh from start to show new entry
      refresh();
    });

    onCleanup(unsubscribe);
  });

  const createEntry = async (data: Omit<Entry, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) => {
    try {
      const entry = await entryRepo.create(data);
      return entry;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await entryRepo.delete(id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const findByDate = async (date: string) => {
    try {
      return await entryRepo.findByDate(date);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const findByGroupId = async (id: string) => {
    try {
      return await entryRepo.findByGroupId(id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const findRelevantEntries = async ({
    start,
    end,
    trackerIds,
  }: {
    start?: string;
    end?: string;
    trackerIds: string[];
  }) => {
    try {
      return await entryRepo.findRelevantEntries(trackerIds, start, end);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    entries,
    loading,
    error,
    hasMore,
    total,
    createEntry,
    deleteEntry,
    findByDate,
    findByGroupId,
    findRelevantEntries,
    loadMore,
    refresh,
  };
}
