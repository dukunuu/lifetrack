import type { SyncController } from '../db';
import { setupSync } from '../db';

export type SyncStatus = 'idle' | 'connecting' | 'active' | 'paused' | 'error';

export interface SyncConfig {
  enabled: boolean;
  endpoint: string;
  username?: string;
  password?: string;
  apiKey?: string;
}

let activeSync: SyncController | null = null;
let activeKey = '';

const normalizeEndpoint = (endpoint: string) => endpoint.trim().replace(/\/+$/, '');

const buildConfigKey = (config: SyncConfig) =>
  [
    config.enabled ? '1' : '0',
    normalizeEndpoint(config.endpoint),
    config.username ?? '',
    config.password ? '1' : '0',
    config.apiKey ? '1' : '0',
  ].join('|');

export function startCouchSync(config: SyncConfig, onStatus: (status: SyncStatus) => void) {
  if (!config.enabled) {
    return;
  }

  const endpoint = normalizeEndpoint(config.endpoint);
  if (!endpoint) {
    stopCouchSync();
    onStatus('error');
    return;
  }

  const nextKey = buildConfigKey(config);
  if (activeSync && activeKey === nextKey) {
    return;
  }

  stopCouchSync();
  activeKey = nextKey;
  onStatus('connecting');

  const sync = setupSync(endpoint, config.username, config.password);
  activeSync = sync;

  sync.on('active', () => onStatus('active'));
  sync.on('paused', () => onStatus('paused'));
  sync.on('error', () => onStatus('error'));
}

export function stopCouchSync() {
  if (!activeSync) return;
  activeSync.cancel();
  activeSync = null;
  activeKey = '';
}
