import { createSignal, onMount, onCleanup } from 'solid-js';
import type { Group, PagedResult } from '../db/types';
import type { GroupSearchOptions } from '../repositories';
import { groupRepo } from '../repositories';

export interface UseGroupsOptions {
  load?: 'all' | 'active' | 'trackers' | 'none';
}

export function useGroups(options: UseGroupsOptions = { load: 'all' }) {
  const [groups, setGroups] = createSignal<Group[]>([]);
  const [loading, setLoading] = createSignal(options.load !== 'none');
  const [error, setError] = createSignal<Error | null>(null);
  const [revision, setRevision] = createSignal(0);

  const loadGroups = async () => {
    if (options.load === 'none') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let result: Group[] = [];
      if (options.load === 'active') {
        result = await groupRepo.findActive();
      } else if (options.load === 'trackers') {
        result = await groupRepo.findGroupsForTrackers();
      } else {
        result = await groupRepo.findAll();
      }
      setGroups(result);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    await loadGroups();

    const unsubscribe = groupRepo.onChange(() => {
      setRevision((value) => value + 1);
      if (options.load !== 'none') {
        loadGroups();
      }
    });

    onCleanup(unsubscribe);
  });

  const createGroup = async (data: Omit<Group, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) => {
    try {
      const group = await groupRepo.create(data);
      setRevision((value) => value + 1);
      return group;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateGroup = async (id: string, data: Partial<Omit<Group, '_id' | '_rev'>>) => {
    try {
      const group = await groupRepo.update(id, data);
      setRevision((value) => value + 1);
      return group;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteGroup = async (id: string) => {
    try {
      await groupRepo.delete(id);
      setRevision((value) => value + 1);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const findById = async (id: string) => {
    try {
      return await groupRepo.findById(id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const groupHasChildren = async (id: string) => {
    try {
      return await groupRepo.hasChildren(id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }

  const findActive = async () => {
    try {
      return await groupRepo.findActive();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const findGroupsForTrackers = async () => {
    try {
      return await groupRepo.findGroupsForTrackers();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const searchGroups = async (options: GroupSearchOptions = {}): Promise<PagedResult<Group>> => {
    try {
      return await groupRepo.searchPaged(options);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const findDescendants = async (id: string) => {
    try {
      return await groupRepo.findDescendants(id)
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }

  return {
    groups,
    loading,
    error,
    createGroup,
    groupHasChildren,
    updateGroup,
    deleteGroup,
    findActive,
    findById,
    findGroupsForTrackers,
    findDescendants,
    searchGroups,
    refresh: loadGroups,
    revision,
  };
}
