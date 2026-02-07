import { createEffect, createSignal, onCleanup } from 'solid-js';
import {
  type SyncStatus,
  getSyncState,
  isSyncActive,
  startCouchSync,
  stopCouchSync,
  resync as triggerResync,
} from '../services/sync-service';
import { useSettings } from './useSettings';

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

  const resync = () => {
    triggerResync(settings().sync, setStatus);
  };

  return {
    status,
    getState: getSyncState,
    isActive: isSyncActive,
    resync,
  };
}
