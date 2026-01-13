import PouchDB from 'pouchdb-core';
import IdbAdapter from 'pouchdb-adapter-idb';
import HttpAdapter from 'pouchdb-adapter-http';
import Replication from 'pouchdb-replication';
import Find from 'pouchdb-find';
import QuickSearch from 'pouchdb-quick-search';
import MapReduce from 'pouchdb-mapreduce-no-ddocs';
import { timestamp } from './utils';

PouchDB.plugin(IdbAdapter);
PouchDB.plugin(HttpAdapter);
PouchDB.plugin(Replication);
PouchDB.plugin(Find);
PouchDB.plugin(QuickSearch);
PouchDB.plugin(MapReduce);

const DB_NAME = 'lifetrack';

export const db = new PouchDB(DB_NAME, {
  auto_compaction: true,
  revs_limit: 200,
  deterministic_revs: true,
});

export const ACTIVE_INDEX_NAMES = [
  'trackers-by-meta',
  'trackers-by-tag',
  'trackers-by-alias',
  'trackers-by-pinned',
  'groups-by-meta',
  'groups-by-slug',
  'groups-by-path',
  'goals-by-meta',
  'entries-by-date',
  'sessions-by-status-type',
];

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

export async function runMaintenance(): Promise<void> {
  await db.compact();
  await (
    db as PouchDB.Database<{}> & { viewCleanup: () => Promise<unknown> }
  ).viewCleanup();
}

export async function exportDatabase(): Promise<Blob> {
  const result = await db.allDocs({
    include_docs: true,
    attachments: true,
    binary: false,
  });
  const docs = result.rows.flatMap((row) => (row.doc ? [row.doc] : []));
  const payload = {
    exportedAt: timestamp(),
    docs,
  };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export async function getConflictCount(): Promise<number> {
  const result = await db.allDocs({
    include_docs: true,
    conflicts: true,
  });
  return result.rows.reduce((count, row) => {
    const conflicts = (row.doc as { _conflicts?: string[] } | undefined)?._conflicts;
    return count + (conflicts?.length ?? 0);
  }, 0);
}

export async function resolveConflicts(): Promise<number> {
  const result = await db.allDocs({
    include_docs: true,
    conflicts: true,
  });
  const deletions: Array<{ _id: string; _rev: string; _deleted: true }> = [];

  result.rows.forEach((row) => {
    const conflicts = (row.doc as { _conflicts?: string[] } | undefined)?._conflicts;
    if (!conflicts?.length) return;
    conflicts.forEach((rev) => {
      deletions.push({ _id: row.id, _rev: rev, _deleted: true });
    });
  });

  if (deletions.length === 0) return 0;
  await db.bulkDocs(deletions);
  return deletions.length;
}

export async function cleanupIndexes(allowedNames: string[]): Promise<number> {
  const indexes = await db.getIndexes();
  const removable = indexes.indexes.filter(
    (index) => index.name && index.name !== '_all_docs' && !allowedNames.includes(index.name),
  );

  for (const index of removable) {
    if (!index.ddoc) continue;
    await db.deleteIndex({
      ddoc: index.ddoc,
      name: index.name,
      type: index.type,
    });
  }

  return removable.length;
}

export default db;
