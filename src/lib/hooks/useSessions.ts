import { createSignal, onCleanup, onMount } from 'solid-js';
import type { Session } from '../db/types';
import { sessionRepo } from '../repositories';

export function useSessions() {
  const [sessions, setSessions] = createSignal<Session[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<Error | null>(null);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const result = await sessionRepo.findRecentSummary(30);
      setSessions(result);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    await loadSessions();

    const unsubscribe = sessionRepo.onChange(() => {
      loadSessions();
    });

    onCleanup(unsubscribe);
  });

  return {
    sessions,
    loading,
    error,
    refresh: loadSessions,
  };
}
