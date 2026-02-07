import { BaseRepository } from './base.repository';
import { db } from '../db';
import { generateId, buildSearchTokens } from '../db/utils';
import type { Goal, GoalPeriod, PagedResult } from '../db/types';

export interface GoalSearchOptions {
  query?: string;
  cursor?: string;
  perPage?: number;
  archived?: boolean;
  period?: GoalPeriod;
}

const GOAL_PREFIX = 'goal:';
const GOAL_END = `${GOAL_PREFIX}\ufff0`;
const GOAL_SEARCH_FIELDS = {
  goalSearchTokens: 1,
};
const GOAL_SEARCH_MM = '50%';

type QuickSearchRow = { id: string; doc?: Goal; score?: number };
type QuickSearchResponse = { rows: QuickSearchRow[]; total_rows?: number };

const goalDb = db as PouchDB.Database<Goal>;

let goalIndexReady: Promise<void> | null = null;
let goalTokensReady: Promise<void> | null = null;

const ensureGoalIndex = async () => {
  if (!goalIndexReady) {
    goalIndexReady = db
      .createIndex({
        index: {
          fields: ['_id', 'archived', 'period'],
          name: 'goals-by-meta',
        },
      })
      .then(() => undefined);
  }
  return goalIndexReady;
};

export class GoalRepository extends BaseRepository<Goal> {
  protected prefix = 'goal';

  async create(data: Omit<Goal, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<Goal> {
    const goalData = {
      ...data,
      _id: generateId.goal(),
      goalSearchTokens: buildSearchTokens(data.name, data.description, data.targetUnit),
    };

    return super.create(goalData);
  }

  async searchPaged(options: GoalSearchOptions = {}): Promise<PagedResult<Goal>> {
    const query = options.query?.trim() ?? '';
    const cursor = options.cursor;
    const perPage = Math.max(1, options.perPage ?? 10);
    const archived = options.archived ?? false;
    if (query) {
      await this.ensureSearchTokens();
      const result = (await goalDb.search({
        query,
        fields: GOAL_SEARCH_FIELDS,
        mm: GOAL_SEARCH_MM,
        include_docs: true,
      })) as QuickSearchResponse;

      let filtered = result.rows
        .map((row: QuickSearchRow) => row.doc)
        .filter((doc): doc is Goal => !!doc)
        .filter((doc: Goal) => doc.archived === archived);

      if (options.period) {
        filtered = filtered.filter((doc) => doc.period === options.period);
      }

      const total = filtered.length;
      const start = cursor ? Math.max(filtered.findIndex((doc) => doc._id === cursor) + 1, 0) : 0;
      const items = filtered.slice(start, start + perPage);
      const nextCursor = start + perPage < total ? items[items.length - 1]?._id : undefined;

      return { items, total, perPage, nextCursor };
    }

    await ensureGoalIndex();

    const idSelector = cursor
      ? { _id: { $gt: cursor, $lte: GOAL_END } }
      : { _id: { $gte: GOAL_PREFIX, $lte: GOAL_END } };

    let selector: Record<string, unknown> = {
      ...idSelector,
      archived,
    };

    if (options.period) {
      selector = {
        $and: [idSelector, { archived }, { period: options.period }],
      };
    }

    const result = await db.find({
      selector,
      sort: ['_id'],
      limit: perPage + 1,
    });

    const docs = result.docs as Goal[];
    const hasMore = docs.length > perPage;
    const items = hasMore ? docs.slice(0, perPage) : docs;
    const nextCursor = hasMore ? items[items.length - 1]?._id : undefined;

    return { items, perPage, nextCursor };
  }

  async update(id: string, data: Partial<Omit<Goal, '_id' | '_rev'>>): Promise<Goal> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Document with id ${id} not found`);
    }

    const nextName = data.name ?? existing.name;
    const nextDescription = data.description ?? existing.description;
    const nextTargetUnit = data.targetUnit ?? existing.targetUnit;
    const goalSearchTokens = buildSearchTokens(nextName, nextDescription, nextTargetUnit);

    return super.update(id, { ...data, goalSearchTokens });
  }

  async findPinnedGoals(): Promise<Goal[]> {
    return [];
  }

  private async ensureSearchTokens(): Promise<void> {
    if (!goalTokensReady) {
      goalTokensReady = (async () => {
        const selector = {
          _id: { $gte: GOAL_PREFIX, $lte: GOAL_END },
          goalSearchTokens: { $exists: false },
        };

        let missing: Goal[] = [];
        try {
          const result = await goalDb.find({ selector });
          missing = result.docs as Goal[];
        } catch (err) {
          missing = await this.findAll();
        }

        if (!missing.length) return;

        const updates = missing.map((doc) => ({
          ...doc,
          goalSearchTokens: buildSearchTokens(doc.name, doc.description, doc.targetUnit),
        }));

        await goalDb.bulkDocs(updates);
      })();
    }

    return goalTokensReady;
  }
}

export const goalRepo = new GoalRepository();
