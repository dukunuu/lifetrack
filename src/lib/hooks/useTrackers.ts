import { createSignal, onMount, onCleanup } from 'solid-js';
import type { PagedResult, Tracker } from '../db/types';
import type { TrackerSearchOptions } from '../repositories';
import { trackerRepo } from '../repositories';

interface UseTrackersOptions {
  loadAll?: boolean;
}

export function useTrackers(options: UseTrackersOptions = {}) {
  const loadAll = options.loadAll ?? false;
  const [trackers, setTrackers] = createSignal<Tracker[]>([]);
  const [loading, setLoading] = createSignal(loadAll);
  const [error, setError] = createSignal<Error | null>(null);
  const [revision, setRevision] = createSignal(0);

  const loadTrackers = async () => {
    if (!loadAll) return;
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
    if (loadAll) {
      await loadTrackers();
    } else {
      setLoading(false);
    }

    const unsubscribe = trackerRepo.onChange(() => {
      setRevision((value) => value + 1);
      if (loadAll) {
        loadTrackers();
      }
    });

    onCleanup(unsubscribe);
  });

  const createTracker = async (data: Omit<Tracker, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) => {
    try {
      const tracker = await trackerRepo.create(data);
      setRevision((value) => value + 1);
      return tracker;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateTracker = async (id: string, data: Partial<Omit<Tracker, '_id' | '_rev'>>) => {
    try {
      const tracker = await trackerRepo.update(id, data);
      setRevision((value) => value + 1);
      return tracker;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteTracker = async (id: string) => {
    try {
      await trackerRepo.delete(id);
      setRevision((value) => value + 1);
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

  const findById = async (id: string) => {
    try {
      return await trackerRepo.findById(id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const findByIds = async (ids: string[]) => {
    try {
      return await trackerRepo.findByIds(ids);
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
    revision,
    createTracker,
    updateTracker,
    deleteTracker,
    findByGroupId,
    findById,
    findByIds,
    searchTrackers,
    refresh: loadTrackers,
  };
}
