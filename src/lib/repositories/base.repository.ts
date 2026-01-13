import { db } from '../db';
import { timestamp } from '../db/utils';
import type { BaseDocument, QueryOptions, Repository } from '../db/types';

export abstract class BaseRepository<T extends BaseDocument> implements Repository<T> {
  protected abstract prefix: string;

  async findById(id: string): Promise<T | null> {
    try {
      const doc = await db.get<T>(id);
      return doc;
    } catch (err: any) {
      if (err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async findAll(options: QueryOptions = {}): Promise<T[]> {
    const defaultStart = `${this.prefix}:`;
    const defaultEnd = `${this.prefix}:\ufff0`;
    const descending = options.descending ?? false;

    const startkey = descending
      ? (options.startkey ?? defaultEnd)
      : (options.startkey ?? defaultStart);
    const endkey = descending ? (options.endkey ?? defaultStart) : (options.endkey ?? defaultEnd);

    const result = await db.allDocs<T>({
      include_docs: true,
      startkey,
      endkey,
      limit: options.limit,
      skip: options.skip,
      descending,
    });

    return result.rows.filter((row) => row.doc !== undefined).map((row) => row.doc as T);
  }

  async create(data: Omit<T, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = timestamp();
    const doc = {
      ...data,
      _id: (data as any)._id,
      createdAt: now,
      updatedAt: now,
    } as T;

    const response = await db.put(doc);

    return {
      ...doc,
      _rev: response.rev,
    };
  }

  async update(id: string, data: Partial<Omit<T, '_id' | '_rev'>>): Promise<T> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Document with id ${id} not found`);
    }

    const updated = {
      ...existing,
      ...data,
      _id: existing._id,
      _rev: existing._rev,
      createdAt: existing.createdAt,
      updatedAt: timestamp(),
    } as T;

    const response = await db.put(updated);

    return {
      ...updated,
      _rev: response.rev,
    };
  }

  async delete(id: string): Promise<void> {
    const doc = await this.findById(id);
    if (!doc) {
      throw new Error(`Document with id ${id} not found`);
    }

    if (!doc._rev) {
      throw new Error(`Document ${id} has no revision`);
    }

    await db.remove(doc._id, doc._rev);
  }

  onChange(callback: (doc: T) => void): () => void {
    const changes = db
      .changes<T>({
        since: 'now',
        live: true,
        include_docs: true,
        filter: (doc) => doc._id.startsWith(`${this.prefix}:`),
      })
      .on('change', (change) => {
        if (change.doc) {
          callback(change.doc);
        }
      });

    return () => changes.cancel();
  }

}
