import { createSignal, onMount, onCleanup } from 'solid-js';
import type { Group, PagedResult } from '../db/types';
import type { GroupSearchOptions } from '../repositories';
import { groupRepo } from '../repositories';

export function useGroups() {
  const [groups, setGroups] = createSignal<Group[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<Error | null>(null);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const result = await groupRepo.findAll();
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
      loadGroups();
    });

    onCleanup(unsubscribe);
  });

  const createGroup = async (data: Omit<Group, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) => {
    try {
      const group = await groupRepo.create(data);
      return group;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateGroup = async (id: string, data: Partial<Omit<Group, '_id' | '_rev'>>) => {
    try {
      const group = await groupRepo.update(id, data);
      return group;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteGroup = async (id: string) => {
    try {
      await groupRepo.delete(id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const findRoots = async () => {
    try {
      return await groupRepo.findRoots();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const findChildren = async (groupId: string) => {
    try {
      return await groupRepo.findChildren(groupId);
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

  return {
    groups,
    loading,
    error,
    createGroup,
    updateGroup,
    deleteGroup,
    findRoots,
    findChildren,
    searchGroups,
    refresh: loadGroups,
  };
}
