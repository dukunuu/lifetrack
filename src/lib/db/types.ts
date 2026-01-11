export interface BaseDocument {
  _id: string;
  _rev?: string;
  createdAt: string;
  updatedAt: string;
}

export type FieldType = 'number' | 'text' | 'duration' | 'boolean' | 'scale' | 'counter' | 'photo';

export interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number | string | boolean;
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: Record<number, string>;
  maxPhotos?: number;
  maxSizeKB?: number;
  compress?: boolean;
  targetWidth?: number;
  required?: boolean;
  sortOrder?: number;
}

export interface Tracker extends BaseDocument {
  _id: string;
  tag: string;
  label: string;
  fields: FieldDefinition[];
  groupId: string;
  additionalGroupIds?: string[];
  icon?: string;
  aliases?: string[];
  sortOrder: number;
  archived: boolean;
  pinned: boolean;
}

export interface Group extends BaseDocument {
  _id: string;
  slug: string;
  path: string;
  depth: number;
  parentId: string | null;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  allowsTrackers: boolean;
  sortOrder: number;
  archived: boolean;
}

export type FieldValue = number | string | boolean | null;

export interface EntryData {
  trackerId: string;
  trackerTag: string;
  values: Record<string, FieldValue>;
  completed?: boolean;
  skipped?: boolean;
}

export interface PhotoMeta {
  filename: string;
  caption?: string;
  width?: number;
  height?: number;
  takenAt?: string;
  size: number;
}

export interface Entry extends BaseDocument {
  _id: string;
  timestamp: string;
  date: string;
  raw: string;
  data: EntryData[];
  note?: string;
  groupId?: string;
  sessionId?: string;
  photos?: PhotoMeta[];
  _attachments?: PouchDB.Core.Attachments;
  location?: {
    lat: number;
    lng: number;
    name?: string;
  };
}

export type SessionType = 'workout' | 'meal' | 'custom' | 'ai';
export type SessionStatus = 'active' | 'completed' | 'abandoned';

export interface SessionSummary {
  duration: number;
  entryCount: number;
  aggregates?: Record<string, number>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface Session extends BaseDocument {
  _id: string;
  type: SessionType;
  name?: string;
  groupId?: string;
  startTime: string;
  endTime?: string;
  status: SessionStatus;
  summary?: SessionSummary;
  notes?: string;
  pendingData?: EntryData[];
  pendingNotes?: string[];
  pendingRaw?: string[];
  chatMessages?: ChatMessage[];
}

export type GoalType = 'target' | 'cumulative' | 'frequency' | 'streak' | 'duration';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type GoalAggregation = 'sum' | 'count' | 'average' | 'max' | 'min' | 'latest';

export interface Goal extends BaseDocument {
  _id: string;
  name: string;
  description?: string;
  trackerIds: string[];
  fieldNames?: string[];
  groupId?: string;
  type: GoalType;
  target: number;
  targetUnit?: string;
  period: GoalPeriod;
  startDate?: string;
  endDate?: string;
  aggregation: GoalAggregation;
  rollover: boolean;
  icon?: string;
  color?: string;
  archived: boolean;
  pinned: boolean;
  sortOrder: number;
}

export interface QueryOptions {
  limit?: number;
  skip?: number;
  descending?: boolean;
  startkey?: string;
  endkey?: string;
  include_docs?: boolean;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

export interface Repository<T extends BaseDocument> {
  findById(id: string): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<T[]>;
  create(data: Omit<T, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, data: Partial<Omit<T, '_id' | '_rev'>>): Promise<T>;
  delete(id: string): Promise<void>;
  onChange(callback: (doc: T) => void): () => void;
}
