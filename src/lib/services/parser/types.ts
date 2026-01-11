import type { Tracker, FieldValue } from '../../db/types';

export interface ParsedToken {
  type: 'tag' | 'value' | 'modifier' | 'text';
  value: string;
  startIndex: number;
  endIndex: number;
}

export interface ParsedTrackerData {
  tracker: Tracker;
  values: Record<string, FieldValue>;
  completed?: boolean;
  skipped?: boolean;
  rawText: string;
}

export interface ParseResult {
  trackerData: ParsedTrackerData[];
  note: string;
  errors: ParseError[];
}

export interface ParseError {
  message: string;
  position?: number;
  tag?: string;
}

export interface ValueParseResult {
  value: FieldValue;
  unit?: string;
}
