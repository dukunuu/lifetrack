import { db } from '../db';
import type { Entry, EntryData, EntryMedia, PhotoValue, QueryOptions } from '../db/types';
import { dateString, generateId, timestamp } from '../db/utils';
import { BaseRepository } from './base.repository';

export class EntryRepository extends BaseRepository<Entry> {
  protected prefix = 'entry';

  private entryIndexReady: Promise<void> | null = null;

  private ensureEntryIndex = async () => {
    if (!this.entryIndexReady) {
      this.entryIndexReady = Promise.all([
        db.createIndex({
          index: {
            fields: ['_id', 'date'],
            name: 'entries-by-date',
          },
        }),
        db.createIndex({
          index: {
            fields: ['date', 'data.trackerId'],
            name: 'idx-entries-date-trackers',
          },
        }),
        db.createIndex({
          index: {
            fields: ['groupId'],
            name: 'idx-group-id',
          },
        }),
      ]).then(() => undefined);
    }
    return this.entryIndexReady;
  };

  async create(data: Omit<Entry, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<Entry> {
    const date = data.date || dateString(new Date(data.timestamp));

    const entryData = {
      ...data,
      _id: generateId.entry(),
      date,
    };

    const entry = await super.create(entryData);
    await this.linkMediaToEntry(entry._id, entry.data);
    return entry;
  }

  async findByDate(date: string, options?: QueryOptions): Promise<Entry[]> {
    await this.ensureEntryIndex();
    const selector: Record<string, unknown> = {
      _id: { $gte: 'entry:', $lte: 'entry:\ufff0' },
      date,
    };
    const result = await db.find({
      selector,
      limit: options?.limit,
      skip: options?.skip,
    });
    return result.docs as Entry[];
  }

  async findRecent(limit: number = 50): Promise<Entry[]> {
    const result = await this.findAll({
      limit,
      descending: true,
    });

    return result;
  }

  async findRecentWithPagination(
    limit: number = 50,
    skip: number = 0,
  ): Promise<{
    entries: Entry[];
    hasMore: boolean;
    total: number;
  }> {
    // Get one extra to check if there are more
    const result = await this.findAll({
      limit: limit + 1,
      skip,
      descending: true,
    });

    const hasMore = result.length > limit;
    const entries = hasMore ? result.slice(0, limit) : result;

    // Get total count
    const all = await this.findAll();
    const total = all.length;

    return { entries, hasMore, total };
  }

  async getRecentTags(limit: number = 10): Promise<string[]> {
    const recent = await this.findRecent(100);
    const tagsSet = new Set<string>();

    for (const entry of recent) {
      for (const data of entry.data) {
        tagsSet.add(data.trackerTag);
      }
      if (tagsSet.size >= limit) break;
    }

    return Array.from(tagsSet).slice(0, limit);
  }

  async createMediaAttachment(options: {
    blob: Blob;
    contentType?: string;
    entryId?: string;
    trackerId?: string;
    fieldName?: string;
  }): Promise<EntryMedia> {
    const now = timestamp();
    const mediaDoc: EntryMedia = {
      _id: generateId.media(),
      createdAt: now,
      updatedAt: now,
      entryId: options.entryId,
      trackerId: options.trackerId,
      fieldName: options.fieldName,
      contentType: options.contentType,
      size: options.blob.size,
      _attachments: {
        original: {
          content_type: options.contentType ?? options.blob.type ?? 'application/octet-stream',
          data: options.blob,
        },
      },
    };

    const response = await db.put(mediaDoc as EntryMedia);
    return {
      ...mediaDoc,
      _rev: response.rev,
    };
  }

  async getMediaAttachment(mediaId: string, name: string = 'original'): Promise<Blob | null> {
    try {
      const doc = await db.get<EntryMedia>(mediaId, {
        attachments: true,
        binary: true,
      });
      const attachment = doc._attachments?.[name] as PouchDB.Core.FullAttachment | undefined;
      const data = attachment?.data;
      if (!data) return null;
      return data as Blob;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  private async linkMediaToEntry(entryId: string, data: EntryData[]): Promise<void> {
    const mediaIds = new Set<string>();
    data.forEach((entryData) => {
      Object.values(entryData.values).forEach((value) => {
        if (this.isPhotoValue(value)) {
          mediaIds.add(value.mediaId);
        }
      });
    });

    if (mediaIds.size === 0) return;

    const result = await db.allDocs<EntryMedia>({
      keys: Array.from(mediaIds),
      include_docs: true,
    });

    const updates: EntryMedia[] = [];
    result.rows.forEach((row) => {
      if ('doc' in row && row.doc) {
        updates.push(row.doc as EntryMedia);
      }
    });

    const patched = updates
      .filter((doc) => doc.entryId !== entryId)
      .map((doc) => ({
        ...doc,
        entryId,
        updatedAt: timestamp(),
      }));

    if (patched.length > 0) {
      await db.bulkDocs(patched);
    }
  }

  async findRelevantEntries(trackerIds: string[], start?: string, end?: string) {
    await this.ensureEntryIndex();

    const selector: any = {
      data: {
        $elemMatch: {
          trackerId: { $in: trackerIds },
          skipped: false, // Only get non-skipped data
        },
      },
    };

    if (start && end) {
      selector.date = { $gte: start, $lte: end };
    }
    const result = await db.find({
      selector,
      use_index: 'idx-entries-date-trackers',
    });

    return result.docs as Entry[];
  }

  async findByGroupId(id: string) {
    await this.ensureEntryIndex();

    const result = await db.find({
      selector: {
        _id: { $gte: this.prefix, $lte: this.prefix },
        groupId: id,
      },
    });

    return result.docs as Entry[];
  }

  async findInDateRange(start: string, end: string): Promise<Entry[]> {
    await this.ensureEntryIndex();

    const result = await db.find({
      selector: {
        _id: { $gte: 'entry:', $lte: 'entry:\ufff0' },
        date: { $gte: start, $lte: end },
      },
      use_index: 'entries-by-date',
    });

    return result.docs as Entry[];
  }

  private isPhotoValue(value: EntryData['values'][string]): value is PhotoValue {
    return (
      typeof value === 'object' &&
      value !== null &&
      'mediaId' in value &&
      typeof (value as PhotoValue).mediaId === 'string'
    );
  }
}

export const entryRepo = new EntryRepository();
