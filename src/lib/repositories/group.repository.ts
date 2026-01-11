import { BaseRepository } from './base.repository';
import { generateId, slugify, buildPath, calculateDepth } from '../db/utils';
import type { Group, PagedResult } from '../db/types';
import { trackerRepo } from './tracker.repository';
import Fuse from 'fuse.js';

export interface GroupSearchOptions {
  query?: string;
  page?: number;
  perPage?: number;
  archived?: boolean;
}

export class GroupRepository extends BaseRepository<Group> {
  protected prefix = 'group';

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

    const groupData = {
      ...data,
      _id: generateId.group(),
      slug,
      path,
      depth,
    };

    return super.create(groupData);
  }

  async findBySlug(slug: string): Promise<Group | null> {
    return this.findOne((doc) => doc.slug === slug);
  }

  async findByPath(path: string): Promise<Group | null> {
    return this.findOne((doc) => doc.path === path);
  }

  async findByParentId(parentId: string | null): Promise<Group[]> {
    const all = await this.findAll();
    return all.filter((doc) => doc.parentId === parentId);
  }

  async findRoots(): Promise<Group[]> {
    return this.findByParentId(null);
  }

  async findChildren(groupId: string): Promise<Group[]> {
    return this.findByParentId(groupId);
  }

  async findDescendants(groupId: string): Promise<Group[]> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    const all = await this.findAll();
    return all.filter((doc) => doc.path.startsWith(group.path + '/') && doc._id !== groupId);
  }

  async findAncestors(groupId: string): Promise<Group[]> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    if (!group.parentId) {
      return [];
    }

    const ancestors: Group[] = [];
    const pathParts = group.path.split('/');

    for (let i = 0; i < pathParts.length - 1; i++) {
      const ancestorPath = pathParts.slice(0, i + 1).join('/');
      const ancestor = await this.findByPath(ancestorPath);
      if (ancestor) {
        ancestors.push(ancestor);
      }
    }

    return ancestors;
  }

  async findByDepth(depth: number): Promise<Group[]> {
    const all = await this.findAll();
    return all.filter((doc) => doc.depth === depth);
  }

  async searchPaged(options: GroupSearchOptions = {}): Promise<PagedResult<Group>> {
    const query = options.query?.trim() ?? '';
    const page = Math.max(1, options.page ?? 1);
    const perPage = options.perPage ?? 10;
    const archived = options.archived ?? false;

    const all = await this.findAll();
    const filtered = all.filter((doc) => doc.archived === archived);

    let results = filtered;
    if (query) {
      const fuse = new Fuse(filtered, {
        keys: [
          { name: 'name', weight: 2 },
          { name: 'path', weight: 1.5 },
          { name: 'description', weight: 1 },
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

  async updatePath(groupId: string, newSlug: string): Promise<Group> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    const slug = slugify(newSlug);
    let parentPath: string | null = null;

    if (group.parentId) {
      const parent = await this.findById(group.parentId);
      if (!parent) {
        throw new Error(`Parent group ${group.parentId} not found`);
      }
      parentPath = parent.path;
    }

    const newPath = buildPath(parentPath, slug);
    const oldPath = group.path;

    const descendants = await this.findDescendants(groupId);
    for (const descendant of descendants) {
      const descendantNewPath = descendant.path.replace(oldPath, newPath);
      await this.update(descendant._id, {
        path: descendantNewPath,
        depth: calculateDepth(descendantNewPath),
      });
    }

    return this.update(groupId, {
      slug,
      path: newPath,
      depth: calculateDepth(newPath),
    });
  }

  async move(groupId: string, newParentId: string | null): Promise<Group> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    if (newParentId === groupId) {
      throw new Error('Cannot move group to itself');
    }

    let newParentPath: string | null = null;
    if (newParentId) {
      const newParent = await this.findById(newParentId);
      if (!newParent) {
        throw new Error(`Parent group ${newParentId} not found`);
      }

      if (newParent.path.startsWith(group.path + '/')) {
        throw new Error('Cannot move group to its own descendant');
      }

      newParentPath = newParent.path;
    }

    const newPath = buildPath(newParentPath, group.slug);
    const oldPath = group.path;

    const descendants = await this.findDescendants(groupId);
    for (const descendant of descendants) {
      const descendantNewPath = descendant.path.replace(oldPath, newPath);
      await this.update(descendant._id, {
        path: descendantNewPath,
        depth: calculateDepth(descendantNewPath),
      });
    }

    return this.update(groupId, {
      parentId: newParentId,
      path: newPath,
      depth: calculateDepth(newPath),
    });
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

    // Delete all trackers that belong to any of these groups
    for (const groupId of allGroupIds) {
      const trackers = await trackerRepo.findByGroupId(groupId);
      for (const tracker of trackers) {
        await trackerRepo.delete(tracker._id);
      }
    }

    // Delete all descendant groups (bottom-up, deepest first)
    const sortedDescendants = descendants.sort((a, b) => b.depth - a.depth);
    for (const descendant of sortedDescendants) {
      await super.delete(descendant._id);
    }

    // Finally, delete the group itself
    await super.delete(id);
  }
}

export const groupRepo = new GroupRepository();
