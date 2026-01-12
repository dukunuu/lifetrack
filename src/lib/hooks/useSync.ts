import { createEffect, createSignal, onCleanup } from 'solid-js';
import { useSettings } from './useSettings';
import { startCouchSync, stopCouchSync, type SyncStatus } from '../services/sync-service';

export function useSync() {
  const { settings } = useSettings();
  const [status, setStatus] = createSignal<SyncStatus>('idle');

  createEffect(() => {
    const sync = settings().sync;
    if (!sync.enabled) {
      stopCouchSync();
      setStatus('idle');
      return;
    }

    void startCouchSync(sync, setStatus);
  });

  onCleanup(() => {
    stopCouchSync();
  });

  return { status };
}
