import { BaseRepository } from './base.repository';
import { generateId, slugify } from '../db/utils';
import type { PagedResult, Tracker } from '../db/types';
import Fuse, { type FuseResultMatch } from 'fuse.js';

export interface TrackerSearchOptions {
  query?: string;
  page?: number;
  perPage?: number;
  archived?: boolean;
  groupIds?: string[];
}

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
    };

    return super.create(trackerData);
  }

  async findByTag(tag: string): Promise<Tracker | null> {
    return this.findOne((doc) => doc.tag === tag);
  }

  async findByGroupId(groupId: string): Promise<Tracker[]> {
    const all = await this.findAll();
    return all.filter(
      (doc) => doc.groupId === groupId || doc.additionalGroupIds?.includes(groupId),
    );
  }

  async findPinned(): Promise<Tracker[]> {
    const all = await this.findAll();
    return all
      .filter((doc) => doc.pinned && !doc.archived)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async findArchived(): Promise<Tracker[]> {
    const all = await this.findAll();
    return all.filter((doc) => doc.archived);
  }

  async findByTagOrAlias(tagOrAlias: string): Promise<Tracker | null> {
    return this.findOne(
      (doc) => doc.tag === tagOrAlias || (doc.aliases?.includes(tagOrAlias) ?? false),
    );
  }

  async resolveTag(input: string): Promise<string | null> {
    const tracker = await this.findByTagOrAlias(input);
    return tracker ? tracker.tag : null;
  }

  async updateTag(trackerId: string, newTag: string): Promise<Tracker> {
    const tag = slugify(newTag);
    const existing = await this.findByTag(tag);
    if (existing && existing._id !== trackerId) {
      throw new Error(`Tracker with tag ${tag} already exists`);
    }

    return this.update(trackerId, { tag });
  }

  async addAlias(trackerId: string, alias: string): Promise<Tracker> {
    const tracker = await this.findById(trackerId);
    if (!tracker) {
      throw new Error(`Tracker ${trackerId} not found`);
    }

    const existing = await this.findByTagOrAlias(alias);
    if (existing && existing._id !== trackerId) {
      throw new Error(`Tag or alias ${alias} already in use`);
    }

    const aliases = tracker.aliases || [];
    if (!aliases.includes(alias)) {
      aliases.push(alias);
    }

    return this.update(trackerId, { aliases });
  }

  async removeAlias(trackerId: string, alias: string): Promise<Tracker> {
    const tracker = await this.findById(trackerId);
    if (!tracker) {
      throw new Error(`Tracker ${trackerId} not found`);
    }

    const aliases = (tracker.aliases || []).filter((a) => a !== alias);

    return this.update(trackerId, { aliases });
  }

  async addToGroup(trackerId: string, groupId: string): Promise<Tracker> {
    const tracker = await this.findById(trackerId);
    if (!tracker) {
      throw new Error(`Tracker ${trackerId} not found`);
    }

    const additionalGroupIds = tracker.additionalGroupIds || [];
    if (!additionalGroupIds.includes(groupId) && tracker.groupId !== groupId) {
      additionalGroupIds.push(groupId);
    }

    return this.update(trackerId, { additionalGroupIds });
  }

  async removeFromGroup(trackerId: string, groupId: string): Promise<Tracker> {
    const tracker = await this.findById(trackerId);
    if (!tracker) {
      throw new Error(`Tracker ${trackerId} not found`);
    }

    if (tracker.groupId === groupId) {
      throw new Error('Cannot remove tracker from its primary group');
    }

    const additionalGroupIds = (tracker.additionalGroupIds || []).filter((id) => id !== groupId);

    return this.update(trackerId, { additionalGroupIds });
  }

  async archive(trackerId: string): Promise<Tracker> {
    return this.update(trackerId, { archived: true });
  }

  async unarchive(trackerId: string): Promise<Tracker> {
    return this.update(trackerId, { archived: false });
  }

  async pin(trackerId: string): Promise<Tracker> {
    return this.update(trackerId, { pinned: true });
  }

  async unpin(trackerId: string): Promise<Tracker> {
    return this.update(trackerId, { pinned: false });
  }

  async search(
    query: string,
    limit: number = 10,
  ): Promise<
    Array<{
      item: Tracker;
      score: number;
      matches: readonly FuseResultMatch[];
    }>
  > {
    const all = await this.findAll();
    const active = all.filter((doc) => !doc.archived);

    const fuse = new Fuse(active, {
      keys: [
        { name: 'tag', weight: 2 },
        { name: 'label', weight: 1.5 },
        { name: 'aliases', weight: 1 },
      ],
      threshold: 0.4,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 1,
    });

    const results = fuse.search(query, { limit });

    return results.map((result) => ({
      item: result.item,
      score: result.score ?? 1,
      matches: result.matches ?? [],
    }));
  }

  async searchPaged(options: TrackerSearchOptions = {}): Promise<PagedResult<Tracker>> {
    const query = options.query?.trim() ?? '';
    const page = Math.max(1, options.page ?? 1);
    const perPage = options.perPage ?? 10;
    const archived = options.archived ?? false;
    const groupIds = options.groupIds ?? [];

    const all = await this.findAll();
    let filtered = all.filter((doc) => doc.archived === archived);

    if (groupIds.length > 0) {
      const groupSet = new Set(groupIds);
      filtered = filtered.filter(
        (doc) => groupSet.has(doc.groupId) || doc.additionalGroupIds?.some((id) => groupSet.has(id)),
      );
    }

    let results = filtered;
    if (query) {
      const fuse = new Fuse(filtered, {
        keys: [
          { name: 'label', weight: 2 },
          { name: 'tag', weight: 1.5 },
          { name: 'aliases', weight: 1 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 1,
      });
      results = fuse.search(query).map((result) => result.item);
    }

    const total = results.length;
    if (perPage <= 0) {
      return { items: results, total, page, perPage };
    }

    const start = (page - 1) * perPage;
    const items = results.slice(start, start + perPage);

    return { items, total, page, perPage };
  }
}

export const trackerRepo = new TrackerRepository();
