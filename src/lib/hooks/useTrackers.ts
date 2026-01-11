import { createSignal, onMount, onCleanup } from 'solid-js';
import type { PagedResult, Tracker } from '../db/types';
import type { TrackerSearchOptions } from '../repositories';
import { trackerRepo } from '../repositories';

export function useTrackers() {
  const [trackers, setTrackers] = createSignal<Tracker[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<Error | null>(null);

  const loadTrackers = async () => {
    try {
      setLoading(true);
      const result = await trackerRepo.findAll();
      setTrackers(result);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    await loadTrackers();

    const unsubscribe = trackerRepo.onChange(() => {
      loadTrackers();
    });

    onCleanup(unsubscribe);
  });

  const createTracker = async (data: Omit<Tracker, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) => {
    try {
      const tracker = await trackerRepo.create(data);
      return tracker;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateTracker = async (id: string, data: Partial<Omit<Tracker, '_id' | '_rev'>>) => {
    try {
      const tracker = await trackerRepo.update(id, data);
      return tracker;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteTracker = async (id: string) => {
    try {
      await trackerRepo.delete(id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const findByGroupId = async (groupId: string) => {
    try {
      return await trackerRepo.findByGroupId(groupId);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const searchTrackers = async (
    options: TrackerSearchOptions = {},
  ): Promise<PagedResult<Tracker>> => {
    try {
      return await trackerRepo.searchPaged(options);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    trackers,
    loading,
    error,
    createTracker,
    updateTracker,
    deleteTracker,
    findByGroupId,
    searchTrackers,
    refresh: loadTrackers,
  };
}
