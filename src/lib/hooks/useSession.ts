import { createSignal, onCleanup, onMount } from 'solid-js';
import type { Session, SessionType } from '../db/types';
import { entryRepo, sessionRepo } from '../repositories';
import { dateString, timestamp } from '../db/utils';

export function useSession() {
  const [activeSession, setActiveSession] = createSignal<Session | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<Error | null>(null);

  const loadActiveSession = async () => {
    try {
      setLoading(true);
      const session = await sessionRepo.findActive();
      setActiveSession(session);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    await loadActiveSession();

    const unsubscribe = sessionRepo.onChange(() => {
      loadActiveSession();
    });

    onCleanup(unsubscribe);
  });

  const startSession = async (type: SessionType, groupId?: string, name?: string) => {
    try {
      const session = await sessionRepo.startSession(type, groupId, name);
      setActiveSession(session);
      return session;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const completeSession = async (notes?: string) => {
    try {
      const session = activeSession();
      if (!session) {
        throw new Error('No active session');
      }
      const updated = await finalizeSession(session, notes);
      setActiveSession(null);
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  const abandonSession = async () => {
    try {
      const session = activeSession();
      if (!session) {
        throw new Error('No active session');
      }
      const updated = await sessionRepo.abandonSession(session._id);
      setActiveSession(null);
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    activeSession,
    loading,
    error,
    startSession,
    completeSession,
    abandonSession,
    refresh: loadActiveSession,
  };
}

async function finalizeSession(session: Session, notes?: string): Promise<Session> {
  const pendingData = session.pendingData ?? [];
  if (pendingData.length === 0) {
    return sessionRepo.completeSession(session._id, notes);
  }

  const now = timestamp();
  const date = dateString(new Date(now));
  const raw = (session.pendingRaw ?? []).join('\n');
  const note = [...(session.pendingNotes ?? []), notes ?? ''].join(' ').trim();

  await entryRepo.create({
    timestamp: now,
    date,
    raw,
    data: pendingData,
    note: note.length > 0 ? note : undefined,
    sessionId: session._id,
    groupId: session.groupId,
  });

  return sessionRepo.completeSession(session._id, notes, true);
}
