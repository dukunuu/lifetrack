import type { SyncController } from '../db';
import { setupSync } from '../db';

export type SyncStatus = 'idle' | 'connecting' | 'active' | 'paused' | 'error' | 'stalled';
export type SyncHealth = 'healthy' | 'degraded' | 'unhealthy';

export interface SyncConfig {
  enabled: boolean;
  endpoint: string;
  username?: string;
  password?: string;
  apiKey?: string;
  batchSize?: number;
  heartbeatInterval?: number;
  maxRetries?: number;
}

export interface SyncState {
  status: SyncStatus;
  health: SyncHealth;
  lastActivity: number;
  retryCount: number;
  totalChanges: number;
  errors: Array<{ timestamp: number; message: string }>;
}

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_HEARTBEAT_INTERVAL = 30000;
const DEFAULT_MAX_RETRIES = 5;
const STALL_TIMEOUT = 120000;

let activeSync: SyncController | null = null;
let activeKey = '';
let syncState: SyncState = {
  status: 'idle',
  health: 'healthy',
  lastActivity: Date.now(),
  retryCount: 0,
  totalChanges: 0,
  errors: [],
};

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

const normalizeEndpoint = (endpoint: string) => endpoint.trim().replace(/\/+$/, '');

const buildConfigKey = (config: SyncConfig) =>
  [
    config.enabled ? '1' : '0',
    normalizeEndpoint(config.endpoint),
    config.username ?? '',
    config.password ? '1' : '0',
    config.apiKey ? '1' : '0',
  ].join('|');

const updateState = (updates: Partial<SyncState>) => {
  syncState = { ...syncState, ...updates, lastActivity: Date.now() };
};

const recordError = (message: string) => {
  const errors = [...syncState.errors, { timestamp: Date.now(), message }].slice(-10);
  updateState({
    errors,
    health: syncState.retryCount >= 3 ? 'unhealthy' : 'degraded',
  });
};

const resetHeartbeat = () => {
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
  }
  heartbeatTimer = setTimeout(() => {
    if (syncState.status === 'active') {
      updateState({ status: 'stalled' });
    }
  }, STALL_TIMEOUT);
};

const clearHealthCheck = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
};

const startHealthCheck = (onStatus: (status: SyncStatus) => void) => {
  clearHealthCheck();
  healthCheckInterval = setInterval(() => {
    const timeSinceActivity = Date.now() - syncState.lastActivity;

    if (syncState.status === 'active' && timeSinceActivity > STALL_TIMEOUT) {
      updateState({ status: 'stalled' });
      onStatus('stalled');
    }

    if (
      syncState.status === 'error' &&
      syncState.retryCount < (syncState.errors.length > 0 ? 5 : 0)
    ) {
      // Auto-retry on error if we haven't exceeded max retries
    }
  }, DEFAULT_HEARTBEAT_INTERVAL);
};

export function startCouchSync(config: SyncConfig, onStatus: (status: SyncStatus) => void) {
  if (!config.enabled) {
    stopCouchSync();
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

  syncState = {
    status: 'connecting',
    health: 'healthy',
    lastActivity: Date.now(),
    retryCount: 0,
    totalChanges: 0,
    errors: [],
  };

  onStatus('connecting');

  const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;

  const sync = setupSync(endpoint, config.username, config.password, {
    batch_size: batchSize,
    batches_limit: 10,
    retry: true,
    heartbeat: 10000,
    timeout: 60000,
    back_off_function: (delay: number) => Math.min(delay * 2, 60000),
  });

  activeSync = sync;

  sync.on('change', (info: unknown) => {
    const changeInfo = info as { change?: { docs_read?: number; docs_written?: number } };
    const docsWritten = changeInfo?.change?.docs_written ?? 0;

    updateState({
      totalChanges: syncState.totalChanges + docsWritten,
      status: 'active',
    });
    resetHeartbeat();
    onStatus('active');
  });

  sync.on('active', () => {
    updateState({ status: 'active', retryCount: 0 });
    resetHeartbeat();
    onStatus('active');
  });

  sync.on('paused', () => {
    updateState({ status: 'paused' });
    onStatus('paused');
  });

  sync.on('error', (err: unknown) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    recordError(errorMessage);
    updateState({
      status: 'error',
      retryCount: syncState.retryCount + 1,
    });
    onStatus('error');

    if (syncState.retryCount >= maxRetries) {
      console.error(`Sync failed after ${maxRetries} retries:`, err);
    }
  });

  sync.on('complete', () => {
    updateState({ status: 'idle' });
    onStatus('idle');
  });

  startHealthCheck(onStatus);
}

export function stopCouchSync() {
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }

  clearHealthCheck();

  if (!activeSync) return;
  activeSync.cancel();
  activeSync = null;
  activeKey = '';
  syncState = {
    status: 'idle',
    health: 'healthy',
    lastActivity: Date.now(),
    retryCount: 0,
    totalChanges: 0,
    errors: [],
  };
}

export function getSyncState(): Readonly<SyncState> {
  return syncState;
}

export function resync(config: SyncConfig, onStatus: (status: SyncStatus) => void) {
  stopCouchSync();
  // Small delay to ensure clean restart
  setTimeout(() => {
    startCouchSync(config, onStatus);
  }, 100);
}

export function isSyncActive(): boolean {
  return activeSync !== null;
}
