import { createSignal, onMount, onCleanup } from 'solid-js';
import type { Entry } from '../db/types';
import { entryRepo } from '../repositories';

export function useEntriesAll() {
  const [entries, setEntries] = createSignal<Entry[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<Error | null>(null);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const result = await entryRepo.findAll();
      setEntries(result);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    await loadEntries();

    const unsubscribe = entryRepo.onChange(() => {
      loadEntries();
    });

    onCleanup(unsubscribe);
  });

  return {
    entries,
    loading,
    error,
    refresh: loadEntries,
  };
}
