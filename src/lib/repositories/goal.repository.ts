import { BaseRepository } from './base.repository';
import { generateId } from '../db/utils';
import type { Goal, GoalType, GoalPeriod, PagedResult, QueryOptions } from '../db/types';
import Fuse from 'fuse.js';

export interface GoalSearchOptions {
  query?: string;
  page?: number;
  perPage?: number;
  archived?: boolean;
  period?: GoalPeriod;
}

export class GoalRepository extends BaseRepository<Goal> {
  protected prefix = 'goal';

  async create(data: Omit<Goal, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<Goal> {
    const goalData = {
      ...data,
      _id: generateId.goal(),
    };

    return super.create(goalData);
  }

  async findByType(type: GoalType, options?: QueryOptions): Promise<Goal[]> {
    const all = await this.findAll(options);
    return all.filter((doc) => doc.type === type);
  }

  async findByPeriod(period: GoalPeriod, options?: QueryOptions): Promise<Goal[]> {
    const all = await this.findAll(options);
    return all.filter((doc) => doc.period === period);
  }

  async findByTracker(trackerId: string, options?: QueryOptions): Promise<Goal[]> {
    const all = await this.findAll(options);
    return all.filter((doc) => doc.trackerIds.includes(trackerId));
  }

  async findByGroup(groupId: string, options?: QueryOptions): Promise<Goal[]> {
    const all = await this.findAll(options);
    return all.filter((doc) => doc.groupId === groupId);
  }

  async findActive(options?: QueryOptions): Promise<Goal[]> {
    const all = await this.findAll(options);
    return all.filter((doc) => !doc.archived);
  }

  async findArchived(options?: QueryOptions): Promise<Goal[]> {
    const all = await this.findAll(options);
    return all.filter((doc) => doc.archived);
  }

  async findByDateRange(
    startDate: string,
    endDate: string,
    options?: QueryOptions,
  ): Promise<Goal[]> {
    const all = await this.findAll(options);
    return all.filter((doc) => {
      if (!doc.startDate || !doc.endDate) return false;
      return doc.startDate <= endDate && doc.endDate >= startDate;
    });
  }

  async findCurrent(options?: QueryOptions): Promise<Goal[]> {
    const now = new Date().toISOString().split('T')[0];
    const all = await this.findActive(options);

    return all.filter((doc) => {
      if (doc.period === 'custom' && doc.startDate && doc.endDate) {
        return doc.startDate <= now && doc.endDate >= now;
      }
      return true;
    });
  }

  async searchPaged(options: GoalSearchOptions = {}): Promise<PagedResult<Goal>> {
    const query = options.query?.trim() ?? '';
    const page = Math.max(1, options.page ?? 1);
    const perPage = options.perPage ?? 10;
    const archived = options.archived ?? false;

    const all = await this.findAll();
    let filtered = all.filter((doc) => doc.archived === archived);
    if (options.period) {
      filtered = filtered.filter((doc) => doc.period === options.period);
    }

    let results = filtered;
    if (query) {
      const fuse = new Fuse(filtered, {
        keys: [
          { name: 'name', weight: 2 },
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

  async archive(goalId: string): Promise<Goal> {
    return this.update(goalId, { archived: true });
  }

  async unarchive(goalId: string): Promise<Goal> {
    return this.update(goalId, { archived: false });
  }

  async addTracker(goalId: string, trackerId: string): Promise<Goal> {
    const goal = await this.findById(goalId);
    if (!goal) {
      throw new Error(`Goal ${goalId} not found`);
    }

    const trackerIds = goal.trackerIds || [];
    if (!trackerIds.includes(trackerId)) {
      trackerIds.push(trackerId);
    }

    return this.update(goalId, { trackerIds });
  }

  async removeTracker(goalId: string, trackerId: string): Promise<Goal> {
    const goal = await this.findById(goalId);
    if (!goal) {
      throw new Error(`Goal ${goalId} not found`);
    }

    const trackerIds = (goal.trackerIds || []).filter((id) => id !== trackerId);

    if (trackerIds.length === 0) {
      throw new Error('Goal must have at least one tracker');
    }

    return this.update(goalId, { trackerIds });
  }

  async updateTarget(goalId: string, target: number, targetUnit?: string): Promise<Goal> {
    return this.update(goalId, { target, targetUnit });
  }

  async updatePeriod(
    goalId: string,
    period: GoalPeriod,
    startDate?: string,
    endDate?: string,
  ): Promise<Goal> {
    if (period === 'custom' && (!startDate || !endDate)) {
      throw new Error('Custom period requires start and end dates');
    }

    return this.update(goalId, { period, startDate, endDate });
  }
}

export const goalRepo = new GoalRepository();
