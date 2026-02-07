import { db } from '../db';
import type { Group, PagedResult } from '../db/types';
import { buildPath, buildSearchTokens, calculateDepth, generateId, slugify } from '../db/utils';
import { BaseRepository } from './base.repository';
import { trackerRepo } from './tracker.repository';

export interface GroupSearchOptions {
  query?: string;
  cursor?: string;
  perPage?: number;
  archived?: boolean;
}

const GROUP_PREFIX = 'group:';
const GROUP_END = `${GROUP_PREFIX}\ufff0`;
const GROUP_SEARCH_FIELDS = {
  groupSearchTokens: 1,
};
const GROUP_SEARCH_MM = '50%';
const MAX_GROUP_DEPTH = 5;

type QuickSearchRow = { id: string; doc?: Group; score?: number };
type QuickSearchResponse = { rows: QuickSearchRow[]; total_rows?: number };

const groupDb = db as PouchDB.Database<Group>;

let groupIndexReady: Promise<void> | null = null;
let groupTokensReady: Promise<void> | null = null;

const ensureGroupIndex = async () => {
  if (!groupIndexReady) {
    groupIndexReady = Promise.all([
      db.createIndex({
        index: {
          fields: ['archived', '_id'],
          name: 'groups-by-meta',
        },
      }),
      db.createIndex({
        index: {
          fields: ['_id', 'slug'],
          name: 'groups-by-slug',
        },
      }),
      db.createIndex({
        index: {
          fields: ['path'],
          name: 'groups-by-path',
        },
      }),
      db.createIndex({
        index: {
          fields: ['name', 'archived', 'allowsTrackers', 'path'],
          name: 'groups-by-name-active',
        },
      }),
      db.createIndex({
        index: {
          fields: ['name', 'archived', 'path'],
          name: 'groups-active-sort',
        },
      }),
    ]).then(() => undefined);
  }
  return groupIndexReady;
};

export class GroupRepository extends BaseRepository<Group> {
  protected prefix = 'group';

  async findActive(): Promise<Group[]> {
    await ensureGroupIndex();
    const result = await groupDb.find({
      selector: {
        name: { $gt: null },
        archived: false,
        path: { $gt: null },
      },
      sort: ['name'],
    });

    return result.docs as Group[];
  }

  async findGroupsForTrackers(): Promise<Group[]> {
    await ensureGroupIndex();
    const result = await groupDb.find({
      selector: {
        name: { $gt: null },
        archived: false,
        allowsTrackers: true,
        path: { $gt: null },
      },
      sort: ['name'],
    });
    return result.docs as Group[];
  }

  async create(data: Omit<Group, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<Group> {
    const slug = data.slug || slugify(data.name);

    let parentPath: string | null = null;
    if (data.parentId) {
      const parent = await this.findById(data.parentId);
      if (!parent) {
        throw new Error(`Parent group ${data.parentId} not found`);
      }
      parentPath = parent.path;
    }

    const path = buildPath(parentPath, slug);
    const depth = calculateDepth(path);
    if (depth > MAX_GROUP_DEPTH) {
      throw new Error(`Maximum group depth of ${MAX_GROUP_DEPTH} exceeded.`);
    }

    const groupData = {
      ...data,
      _id: generateId.group(),
      slug,
      path,
      depth,
      groupSearchTokens: buildSearchTokens(data.name, slug, path, data.description),
    };

    return super.create(groupData);
  }

  async findBySlug(slug: string): Promise<Group | null> {
    await ensureGroupIndex();
    const result = await groupDb.find({
      selector: {
        _id: { $gte: GROUP_PREFIX, $lte: GROUP_END },
        slug,
      },
      limit: 1,
    });
    return (result.docs[0] as Group | undefined) ?? null;
  }

  async findByPath(path: string): Promise<Group | null> {
    await ensureGroupIndex();
    const result = await groupDb.find({
      selector: {
        _id: { $gte: GROUP_PREFIX, $lte: GROUP_END },
        path,
      },
      limit: 1,
    });
    return (result.docs[0] as Group | undefined) ?? null;
  }

  async hasChildren(parentId: string): Promise<boolean> {
    const result = await groupDb.find({
      selector: { parentId },
      limit: 1, // We only need to know if ONE exists
      fields: ['_id'], // Only fetch ID to keep it tiny
    });
    return result.docs.length > 0;
  }

  async findDescendants(groupId: string): Promise<Group[]> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    await ensureGroupIndex();
    const start = `${group.path}/`;
    const end = `${group.path}/\ufff0`;
    const result = await groupDb.find({
      selector: {
        _id: { $gte: GROUP_PREFIX, $lte: GROUP_END },
        path: { $gte: start, $lte: end },
      },
    });
    return result.docs as Group[];
  }

  async searchPaged(options: GroupSearchOptions = {}): Promise<PagedResult<Group>> {
    const query = options.query?.trim() ?? '';
    const cursor = options.cursor;
    const perPage = Math.max(1, options.perPage ?? 10);

    if (query) {
      await this.ensureSearchTokens();
      const result = (await groupDb.search({
        query,
        fields: GROUP_SEARCH_FIELDS,
        mm: GROUP_SEARCH_MM,
        include_docs: true,
      })) as QuickSearchResponse;

      const filtered = result.rows
        .map((row: QuickSearchRow) => row.doc)
        .filter((doc): doc is Group => !!doc);

      const total = filtered.length;
      const start = cursor ? Math.max(filtered.findIndex((doc) => doc._id === cursor) + 1, 0) : 0;
      const items = filtered.slice(start, start + perPage);
      const nextCursor = start + perPage < total ? items[items.length - 1]?._id : undefined;

      return { items, total, perPage, nextCursor };
    }

    await ensureGroupIndex();

    const selector = {
      _id: cursor ? { $gt: cursor, $lte: GROUP_END } : { $gte: GROUP_PREFIX, $lte: GROUP_END },
      parentId: null,
      archived: { $gte: false },
    };

    const result = await db.find({
      selector,
      sort: ['archived', '_id'],
      limit: perPage + 1,
    });

    const docs = result.docs as Group[];
    const hasMore = docs.length > perPage;
    const items = hasMore ? docs.slice(0, perPage) : docs;
    const nextCursor = hasMore ? items[items.length - 1]?._id : undefined;

    return { items, perPage, nextCursor };
  }

  async delete(id: string): Promise<void> {
    const group = await this.findById(id);
    if (!group) {
      throw new Error(`Group ${id} not found`);
    }

    // Find all descendant groups (subgroups at any depth)
    const descendants = await this.findDescendants(id);

    // Collect all group IDs (including the group itself and all descendants)
    const allGroupIds = [id, ...descendants.map((d) => d._id)];

    const docsToDelete: PouchDB.Core.PutDocument<{}>[] = [];

    for (const groupId of allGroupIds) {
      const trackers = await trackerRepo.findByGroupId(groupId);
      docsToDelete.push(
        ...trackers.map(
          (tracker) =>
            ({
              ...tracker,
              _deleted: true,
            }) as PouchDB.Core.PutDocument<{}>,
        ),
      );
    }

    docsToDelete.push(
      ...[group, ...descendants].map(
        (doc) =>
          ({
            ...doc,
            _deleted: true,
          }) as PouchDB.Core.PutDocument<{}>,
      ),
    );

    if (docsToDelete.length > 0) {
      await (db as PouchDB.Database<{}>).bulkDocs(docsToDelete);
    }
  }

  async update(id: string, data: Partial<Omit<Group, '_id' | '_rev'>>): Promise<Group> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Document with id ${id} not found`);

    const nextName = data.name ?? existing.name;
    const nextSlug = data.slug ?? existing.slug;
    const nextParentId = data.parentId !== undefined ? data.parentId : existing.parentId;
    const nextArchived = data.archived !== undefined ? data.archived : existing.archived;

    let nextPath = existing.path;
    let nextDepth = existing.depth;

    if (existing.archived === true && nextArchived === false) {
      if (nextParentId) {
        const parent = await this.findById(nextParentId);
        if (!parent || parent.archived) {
          throw new Error('Cannot unarchive: The parent group is currently archived.');
        }
      }
    }

    const isMoving = nextParentId !== existing.parentId || nextSlug !== existing.slug;

    if (isMoving) {
      let parentPath: string | null = null;
      if (nextParentId) {
        const parent = await this.findById(nextParentId);
        if (!parent) throw new Error('Parent group not found');
        parentPath = parent.path;
      }

      nextPath = buildPath(parentPath, nextSlug);
      nextDepth = calculateDepth(nextPath);

      // Depth Validation
      if (nextDepth > MAX_GROUP_DEPTH) {
        throw new Error(`Exceeds maximum depth of ${MAX_GROUP_DEPTH}`);
      }

      // Check if any descendant would exceed depth after move
      const descendants = await this.findDescendants(id);
      const maxDescendantDepth = descendants.reduce((max, d) => {
        const projectedPath = d.path.replace(existing.path, nextPath);
        return Math.max(max, calculateDepth(projectedPath));
      }, nextDepth);

      if (maxDescendantDepth > MAX_GROUP_DEPTH) {
        throw new Error('Moving this branch would exceed the maximum allowed depth.');
      }
    }

    const archiveChanged = nextArchived !== existing.archived;
    let descendantUpdates: Group[] = [];

    if (isMoving || archiveChanged) {
      const descendants = await this.findDescendants(id);
      descendantUpdates = descendants.map((desc) => {
        const newPath = isMoving ? desc.path.replace(existing.path, nextPath) : desc.path;
        return {
          ...desc,
          archived: nextArchived,
          path: newPath,
          depth: calculateDepth(newPath),
          groupSearchTokens: buildSearchTokens(desc.name, desc.slug, newPath, desc.description),
        };
      });
    }

    const groupSearchTokens = buildSearchTokens(
      nextName,
      nextSlug,
      nextPath,
      data.description ?? existing.description,
    );

    const updatedGroup = await super.update(id, {
      ...data,
      path: nextPath,
      depth: nextDepth,
      archived: nextArchived,
      groupSearchTokens,
    });

    // 5. SAVE DESCENDANTS (Bulk)
    if (descendantUpdates.length > 0) {
      await (db as PouchDB.Database<Group>).bulkDocs(descendantUpdates);
    }

    return updatedGroup;
  }

  private async ensureSearchTokens(): Promise<void> {
    if (!groupTokensReady) {
      groupTokensReady = (async () => {
        const selector = {
          _id: { $gte: GROUP_PREFIX, $lte: GROUP_END },
          groupSearchTokens: { $exists: false },
        };

        let missing: Group[] = [];
        try {
          const result = await groupDb.find({ selector });
          missing = result.docs as Group[];
        } catch (err) {
          missing = await this.findAll();
        }

        if (!missing.length) return;

        const updates = missing.map((doc) => ({
          ...doc,
          groupSearchTokens: buildSearchTokens(doc.name, doc.slug, doc.path, doc.description),
        }));

        await groupDb.bulkDocs(updates);
      })();
    }

    return groupTokensReady;
  }

  async findGroupWithChildren(path: string) {
    await ensureGroupIndex();
    const result = await groupDb.find({
      selector: {
        _id: { $gte: GROUP_PREFIX, $lte: GROUP_END },
        path: {
          $gte: path,
          $lt: path + '\ufff0',
        },
      },
      sort: ['path'],
    });
    return result.docs as Group[];
  }

  async findByIds(ids: string[]): Promise<Group[]> {
    if (!ids || ids.length === 0) return [];

    await ensureGroupIndex();

    const result = await groupDb.find({
      selector: {
        _id: {
          $in: ids,
          $gte: GROUP_PREFIX,
          $lte: GROUP_END,
        },
      },
    });

    return result.docs as Group[];
  }
}

export const groupRepo = new GroupRepository();
