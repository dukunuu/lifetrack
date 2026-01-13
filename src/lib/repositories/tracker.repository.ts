import { BaseRepository } from './base.repository';
import { db } from '../db';
import { buildSearchTokens, generateId, slugify } from '../db/utils';
import type { PagedResult, Tracker } from '../db/types';

export interface TrackerSearchOptions {
  query?: string;
  cursor?: string;
  perPage?: number;
  archived?: boolean;
  groupIds?: string[];
}

const TRACKER_PREFIX = 'tracker:';
const TRACKER_END = `${TRACKER_PREFIX}\ufff0`;
const TRACKER_SEARCH_FIELDS = {
  trackerSearchTokens: 1,
};
const TRACKER_SEARCH_MM = '50%';

type QuickSearchRow = { id: string; doc?: Tracker; score?: number };
type QuickSearchResponse = { rows: QuickSearchRow[]; total_rows?: number };

const trackerDb = db as PouchDB.Database<Tracker>;

let trackerIndexReady: Promise<void> | null = null;
let trackerTokensReady: Promise<void> | null = null;

const ensureTrackerIndex = async () => {
  if (!trackerIndexReady) {
    trackerIndexReady = Promise.all([
      db.createIndex({
        index: {
          fields: ['_id', 'archived', 'groupId', 'additionalGroupIds'],
          name: 'trackers-by-meta',
        },
      }),
      db.createIndex({
        index: {
          fields: ['_id', 'tag'],
          name: 'trackers-by-tag',
        },
      }),
      db.createIndex({
        index: {
          fields: ['_id', 'aliases'],
          name: 'trackers-by-alias',
        },
      }),
      db.createIndex({
        index: {
          fields: ['_id', 'pinned', 'archived'],
          name: 'trackers-by-pinned',
        },
      }),
    ]).then(() => undefined);
  }
  return trackerIndexReady;
};

export class TrackerRepository extends BaseRepository<Tracker> {
  protected prefix = 'tracker';

  async create(data: Omit<Tracker, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<Tracker> {
    const tag = data.tag || slugify(data.label);

    const existing = await this.findByTag(tag);
    if (existing) {
      throw new Error(`Tracker with tag ${tag} already exists`);
    }

    const trackerData = {
      ...data,
      _id: generateId.tracker(),
      tag,
      trackerSearchTokens: buildSearchTokens(data.label, tag, ...(data.aliases ?? [])),
    };

    return super.create(trackerData);
  }

  async findByTag(tag: string): Promise<Tracker | null> {
    await ensureTrackerIndex();
    const result = await trackerDb.find({
      selector: {
        _id: { $gte: TRACKER_PREFIX, $lte: TRACKER_END },
        tag,
      },
      limit: 1,
    });
    return (result.docs[0] as Tracker | undefined) ?? null;
  }

  async findByGroupId(groupId: string): Promise<Tracker[]> {
    await ensureTrackerIndex();
    const result = await trackerDb.find({
      selector: {
        _id: { $gte: TRACKER_PREFIX, $lte: TRACKER_END },
        $or: [
          { groupId },
          { additionalGroupIds: { $elemMatch: { $eq: groupId } } },
        ],
      },
    });
    return result.docs as Tracker[];
  }

  async findPinned(): Promise<Tracker[]> {
    await ensureTrackerIndex();
    const result = await trackerDb.find({
      selector: {
        _id: { $gte: TRACKER_PREFIX, $lte: TRACKER_END },
        pinned: true,
        archived: false,
      },
    });
    return (result.docs as Tracker[]).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async findByTagOrAlias(tagOrAlias: string): Promise<Tracker | null> {
    await ensureTrackerIndex();
    const result = await trackerDb.find({
      selector: {
        _id: { $gte: TRACKER_PREFIX, $lte: TRACKER_END },
        $or: [
          { tag: tagOrAlias },
          { aliases: { $elemMatch: { $eq: tagOrAlias } } },
        ],
      },
      limit: 1,
    });
    return (result.docs[0] as Tracker | undefined) ?? null;
  }

  async update(id: string, data: Partial<Omit<Tracker, '_id' | '_rev'>>): Promise<Tracker> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Document with id ${id} not found`);
    }

    const nextLabel = data.label ?? existing.label;
    const nextTag = data.tag ?? existing.tag;
    const nextAliases = data.aliases ?? existing.aliases;
    const trackerSearchTokens = buildSearchTokens(nextLabel, nextTag, ...(nextAliases ?? []));

    return super.update(id, { ...data, trackerSearchTokens });
  }

  private async ensureSearchTokens(): Promise<void> {
    if (!trackerTokensReady) {
      trackerTokensReady = (async () => {
        const selector = {
          _id: { $gte: TRACKER_PREFIX, $lte: TRACKER_END },
          trackerSearchTokens: { $exists: false },
        };

        let missing: Tracker[] = [];
        try {
          const result = await trackerDb.find({ selector });
          missing = result.docs as Tracker[];
        } catch (err) {
          missing = await this.findAll();
        }

        if (!missing.length) return;

        const updates = missing.map((doc) => ({
          ...doc,
          trackerSearchTokens: buildSearchTokens(doc.label, doc.tag, ...(doc.aliases ?? [])),
        }));

        await trackerDb.bulkDocs(updates);
      })();
    }

    return trackerTokensReady;
  }

  async search(
    query: string,
    limit: number = 10,
  ): Promise<
    Array<{
      item: Tracker;
      score: number;
      matches: readonly { indices: Array<[number, number]> }[];
    }>
  > {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    await this.ensureSearchTokens();
    const result = (await trackerDb.search({
      query: trimmed,
      fields: TRACKER_SEARCH_FIELDS,
      mm: TRACKER_SEARCH_MM,
      include_docs: true,
      limit,
    })) as QuickSearchResponse;

    return result.rows
      .map((row: QuickSearchRow) => row.doc)
      .filter((doc): doc is Tracker => !!doc)
      .filter((doc: Tracker) => !doc.archived)
      .map((doc: Tracker, index: number) => ({
        item: doc,
        score: result.rows[index]?.score ?? 1,
        matches: [],
      }));
  }

  async searchPaged(options: TrackerSearchOptions = {}): Promise<PagedResult<Tracker>> {
    const query = options.query?.trim() ?? '';
    const cursor = options.cursor;
    const perPage = Math.max(1, options.perPage ?? 10);
    const archived = options.archived ?? false;
    const groupIds = options.groupIds ?? [];
    const groupSet = new Set(groupIds);
    const matchesGroup = (doc: Tracker) => {
      if (groupSet.size === 0) return true;
      return groupSet.has(doc.groupId) || doc.additionalGroupIds?.some((id) => groupSet.has(id));
    };

    if (query) {
      await this.ensureSearchTokens();
      const result = (await trackerDb.search({
        query,
        fields: TRACKER_SEARCH_FIELDS,
        mm: TRACKER_SEARCH_MM,
        include_docs: true,
      })) as QuickSearchResponse;

      let filtered = result.rows
        .map((row: QuickSearchRow) => row.doc)
        .filter((doc): doc is Tracker => !!doc)
        .filter((doc: Tracker) => doc.archived === archived)
        .filter(matchesGroup);

      const total = filtered.length;
      const start = cursor ? Math.max(filtered.findIndex((doc) => doc._id === cursor) + 1, 0) : 0;
      const items = filtered.slice(start, start + perPage);
      const nextCursor = start + perPage < total ? items[items.length - 1]?._id : undefined;

      return { items, total, perPage, nextCursor };
    }

    await ensureTrackerIndex();

    const idSelector = cursor
      ? { _id: { $gt: cursor, $lte: TRACKER_END } }
      : { _id: { $gte: TRACKER_PREFIX, $lte: TRACKER_END } };

    let selector: Record<string, unknown> = {
      ...idSelector,
      archived,
    };

    if (groupSet.size > 0) {
      selector = {
        $and: [
          idSelector,
          { archived },
          {
            $or: [
              { groupId: { $in: groupIds } },
              { additionalGroupIds: { $in: groupIds } },
            ],
          },
        ],
      };
    }

    const result = await db.find({
      selector,
      sort: ['_id'],
      limit: perPage + 1,
    });

    const docs = result.docs as Tracker[];
    const hasMore = docs.length > perPage;
    const items = hasMore ? docs.slice(0, perPage) : docs;
    const nextCursor = hasMore ? items[items.length - 1]?._id : undefined;

    return { items, perPage, nextCursor };
  }
}

export const trackerRepo = new TrackerRepository();
