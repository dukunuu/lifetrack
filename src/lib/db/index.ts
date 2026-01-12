import PouchDB from 'pouchdb-core';
import IdbAdapter from 'pouchdb-adapter-idb';
import HttpAdapter from 'pouchdb-adapter-http';
import Replication from 'pouchdb-replication';

PouchDB.plugin(IdbAdapter);
PouchDB.plugin(HttpAdapter);
PouchDB.plugin(Replication);

const DB_NAME = 'lifetrack';

export const db = new PouchDB(DB_NAME);

type SyncEventEmitter = {
  on(event: 'change', handler: (info: unknown) => void): SyncEventEmitter;
  on(event: 'error', handler: (err: unknown) => void): SyncEventEmitter;
  on(event: 'paused' | 'active', handler: () => void): SyncEventEmitter;
};

export type SyncController = SyncEventEmitter & {
  cancel: () => void;
};

export function setupSync(
  remoteUrl: string,
  username?: string,
  password?: string,
): SyncController {
  const remote = new PouchDB(remoteUrl, {
    auth: username && password ? { username, password } : undefined,
  });

  const sync = (
    db as PouchDB.Database<Record<string, unknown>> & {
      sync: (
        remoteDb: PouchDB.Database<Record<string, unknown>>,
        options: unknown,
      ) => SyncController;
    }
  ).sync(remote, { live: true, retry: true });

  sync.on('change', (info: unknown) => {
    console.log('Sync change:', info);
  });

  sync.on('error', (err: unknown) => {
    console.error('Sync error:', err);
  });

  sync.on('paused', () => {
    console.log('Sync paused');
  });

  sync.on('active', () => {
    console.log('Sync active');
  });

  return sync;
}

export async function destroyDatabase(): Promise<void> {
  await db.destroy();
}

export default db;
