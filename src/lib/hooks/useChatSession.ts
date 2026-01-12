import { createEffect, createSignal } from 'solid-js';
import type { Session } from '../db/types';
import { sessionRepo } from '../repositories';
import { useSettings } from './useSettings';
import { runChatTurnStream } from '../services/chat-runtime';

export function useChatSession(sessionId: () => string) {
  const { settings } = useSettings();
  const [session, setSession] = createSignal<Session | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [sending, setSending] = createSignal(false);
  const [streamingContent, setStreamingContent] = createSignal('');
  const [streaming, setStreaming] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);

  const loadSession = async (id: string) => {
    try {
      setLoading(true);
      const result = await sessionRepo.findById(id);
      setSession(result);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    const id = sessionId();
    if (!id) return;
    loadSession(id);
    const unsubscribe = sessionRepo.onChange((doc) => {
      if (doc._id === id) {
        setSession(doc);
      }
    });
    return () => unsubscribe();
  });

  const sendMessage = async (content: string, imageDataUrl?: string) => {
    const trimmed = content.trim();
    if (!trimmed && !imageDataUrl) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('AI chat is an internet-only feature.');
    }

    try {
      setSending(true);
      setStreaming(false);
      setStreamingContent('');
      setError(null);
      await runChatTurnStream(sessionId(), trimmed, settings().ai, imageDataUrl, (chunk) => {
        if (!chunk) return;
        setStreaming(true);
        setStreamingContent((prev) => prev + chunk);
      });
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setSending(false);
      setStreaming(false);
      setStreamingContent('');
    }
  };

  const endChat = async () => {
    const current = session();
    if (!current) {
      throw new Error('Session not found.');
    }
    if (current.status !== 'active') return;
    await sessionRepo.completeSession(current._id, undefined, false);
  };

  const deleteSession = async () => {
    const current = session();
    if (!current) {
      throw new Error('Session not found.');
    }
    await sessionRepo.deleteChatSession(current._id);
  };

  return {
    session,
    loading,
    sending,
    streaming,
    streamingContent,
    error,
    sendMessage,
    endChat,
    deleteSession,
  };
}
