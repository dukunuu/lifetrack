import { createSignal, onMount, onCleanup } from 'solid-js';
import type { Goal, PagedResult } from '../db/types';
import type { GoalSearchOptions } from '../repositories';
import { goalRepo } from '../repositories';

export function useGoals() {
  const [goals, setGoals] = createSignal<Goal[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<Error | null>(null);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const result = await goalRepo.findAll();
      setGoals(result);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    await loadGoals();

    const unsubscribe = goalRepo.onChange(() => {
      loadGoals();
    });

    onCleanup(unsubscribe);
  });

  const createGoal = async (data: Omit<Goal, '_id' | '_rev' | 'createdAt' | 'updatedAt'>) => {
    try {
      const goal = await goalRepo.create(data);
      return goal;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const updateGoal = async (id: string, data: Partial<Omit<Goal, '_id' | '_rev'>>) => {
    try {
      const goal = await goalRepo.update(id, data);
      return goal;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const deleteGoal = async (id: string) => {
    try {
      await goalRepo.delete(id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const searchGoals = async (options: GoalSearchOptions = {}): Promise<PagedResult<Goal>> => {
    try {
      return await goalRepo.searchPaged(options);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    goals,
    loading,
    error,
    createGoal,
    updateGoal,
    deleteGoal,
    searchGoals,
    refresh: loadGoals,
  };
}
