import { BaseRepository } from './base.repository';
import { generateId, timestamp } from '../db/utils';
import { db } from '../db';
import type { Session, SessionType } from '../db/types';

export class SessionRepository extends BaseRepository<Session> {
  protected prefix = 'session';

  private nonAiSessionTypes: SessionType[] = ['workout', 'meal', 'custom'];
  private sessionIndexReady: Promise<void> | null = null;

  private ensureSessionIndex = async () => {
    if (!this.sessionIndexReady) {
      this.sessionIndexReady = db
        .createIndex({
          index: {
            fields: ['_id', 'status', 'type'],
            name: 'sessions-by-status-type',
          },
        })
        .then(() => undefined);
    }
    return this.sessionIndexReady;
  };

  async create(data: Omit<Session, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<Session> {
    const sessionData = {
      ...data,
      _id: generateId.session(),
    };

    return super.create(sessionData);
  }

  async findActive(): Promise<Session | null> {
    await this.ensureSessionIndex();
    const result = await db.find({
      selector: {
        _id: { $gte: 'session:', $lte: 'session:\ufff0' },
        status: 'active',
        type: { $in: this.nonAiSessionTypes },
      },
      limit: 1,
    });
    return (result.docs[0] as Session | undefined) ?? null;
  }

  async findRecent(limit: number = 20): Promise<Session[]> {
    const result = await this.findAll({
      limit,
      descending: true,
    });

    return result;
  }

  async findRecentSummary(limit: number = 20): Promise<Session[]> {
    const result = await this.findRecent(limit);
    return result.map((session) => ({
      ...session,
      chatMessages: undefined,
    }));
  }

  async startSession(type: SessionType, groupId?: string, name?: string): Promise<Session> {
    const activeSession = await this.findActive();
    if (activeSession) {
      throw new Error('An active session already exists. Complete or abandon it first.');
    }

    return this.create({
      type,
      groupId,
      name,
      startTime: timestamp(),
      status: 'active',
      pendingData: [],
      pendingNotes: [],
      pendingRaw: [],
    });
  }

  async startAiSession(name?: string): Promise<Session> {
    return this.create({
      type: 'ai',
      name: name ?? 'AI Chat',
      startTime: timestamp(),
      status: 'active',
      pendingData: [],
      pendingNotes: [],
      pendingRaw: [],
      chatMessages: [],
    });
  }

  async completeSession(
    sessionId: string,
    notes?: string,
    clearPending: boolean = true,
  ): Promise<Session> {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'active') {
      throw new Error('Can only complete active sessions');
    }

    const endTime = timestamp();
    const duration = Math.floor(
      (new Date(endTime).getTime() - new Date(session.startTime).getTime()) / 1000,
    );

    const pendingUpdates = clearPending
      ? { pendingData: [], pendingNotes: [], pendingRaw: [] }
      : {};

    return this.update(sessionId, {
      status: 'completed',
      endTime,
      notes,
      summary: {
        duration,
        entryCount: session.summary?.entryCount ?? 0,
        aggregates: session.summary?.aggregates,
      },
      ...pendingUpdates,
    });
  }

  async abandonSession(sessionId: string): Promise<Session> {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'active') {
      throw new Error('Can only abandon active sessions');
    }

    return this.update(sessionId, {
      status: 'abandoned',
      endTime: timestamp(),
      pendingData: [],
      pendingNotes: [],
      pendingRaw: [],
    });
  }

  async updateSummary(sessionId: string, summary: Partial<Session['summary']>): Promise<Session> {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return this.update(sessionId, {
      summary: {
        ...session.summary,
        ...summary,
      } as Session['summary'],
    });
  }

  async appendPending(
    sessionId: string,
    data: Session['pendingData'],
    raw: string,
    note?: string,
  ): Promise<Session> {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const pendingData = [...(session.pendingData ?? []), ...(data ?? [])];
    const pendingNotes = [...(session.pendingNotes ?? []), ...(note ? [note] : [])];
    const pendingRaw = [...(session.pendingRaw ?? []), raw];

    return this.update(sessionId, {
      pendingData,
      pendingNotes,
      pendingRaw,
    });
  }

  async appendChatMessage(
    sessionId: string,
    message: NonNullable<Session['chatMessages']>[number],
  ) {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const chatMessages = [...(session.chatMessages ?? []), message];

    return this.update(sessionId, {
      chatMessages,
    });
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const hasImages = (session.chatMessages ?? []).some((msg) => msg.imageDataUrl);
    await this.delete(sessionId);

    if (hasImages) {
      await db.compact();
    }
  }
}

export const sessionRepo = new SessionRepository();
