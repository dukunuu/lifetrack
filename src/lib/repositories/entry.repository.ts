import { BaseRepository } from './base.repository';
import { generateId, dateString } from '../db/utils';
import type { Entry, QueryOptions } from '../db/types';

export class EntryRepository extends BaseRepository<Entry> {
  protected prefix = 'entry';

  async create(data: Omit<Entry, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<Entry> {
    const date = data.date || dateString(new Date(data.timestamp));

    const entryData = {
      ...data,
      _id: generateId.entry(),
      date,
    };

    return super.create(entryData);
  }

  async findByDate(date: string, options?: QueryOptions): Promise<Entry[]> {
    const all = await this.findAll(options);
    return all.filter((doc) => doc.date === date);
  }

  async findByDateRange(
    startDate: string,
    endDate: string,
    options?: QueryOptions,
  ): Promise<Entry[]> {
    const all = await this.findAll(options);
    return all.filter((doc) => doc.date >= startDate && doc.date <= endDate);
  }

  async findByTracker(trackerId: string, options?: QueryOptions): Promise<Entry[]> {
    const all = await this.findAll(options);
    return all.filter((doc) => doc.data.some((d) => d.trackerId === trackerId));
  }

  async findByTrackerTag(tag: string, options?: QueryOptions): Promise<Entry[]> {
    const all = await this.findAll(options);
    return all.filter((doc) => doc.data.some((d) => d.trackerTag === tag));
  }

  async findBySession(sessionId: string, options?: QueryOptions): Promise<Entry[]> {
    const all = await this.findAll(options);
    return all.filter((doc) => doc.sessionId === sessionId);
  }

  async findByGroup(groupId: string, options?: QueryOptions): Promise<Entry[]> {
    const all = await this.findAll(options);
    return all.filter((doc) => doc.groupId === groupId);
  }

  async findRecent(limit: number = 50): Promise<Entry[]> {
    const result = await this.findAll({
      limit,
      descending: true,
    });

    return result;
  }

  async findWithPhotos(options?: QueryOptions): Promise<Entry[]> {
    const all = await this.findAll(options);
    return all.filter((doc) => doc.photos && doc.photos.length > 0);
  }

  async findByLocation(
    lat: number,
    lng: number,
    radiusKm: number,
    options?: QueryOptions,
  ): Promise<Entry[]> {
    const all = await this.findAll(options);

    return all.filter((doc) => {
      if (!doc.location) return false;

      const distance = this._calculateDistance(lat, lng, doc.location.lat, doc.location.lng);

      return distance <= radiusKm;
    });
  }

  async getDateStats(date: string): Promise<{
    totalEntries: number;
    uniqueTrackers: number;
    trackerCounts: Record<string, number>;
  }> {
    const entries = await this.findByDate(date);
    const trackerCounts: Record<string, number> = {};

    for (const entry of entries) {
      for (const data of entry.data) {
        trackerCounts[data.trackerTag] = (trackerCounts[data.trackerTag] || 0) + 1;
      }
    }

    return {
      totalEntries: entries.length,
      uniqueTrackers: Object.keys(trackerCounts).length,
      trackerCounts,
    };
  }

  async getTrackerHistory(trackerId: string, limit?: number): Promise<Entry[]> {
    const entries = await this.findByTracker(trackerId, {
      limit,
      descending: true,
    });

    return entries;
  }

  private _calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this._deg2rad(lat2 - lat1);
    const dLon = this._deg2rad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this._deg2rad(lat1)) *
        Math.cos(this._deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  private _deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
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
}

export const entryRepo = new EntryRepository();
