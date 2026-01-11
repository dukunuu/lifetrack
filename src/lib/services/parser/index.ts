import { Tokenizer } from './tokenizer';
import { PATTERNS, normalizeUnit } from './patterns';
import type { ParseResult, ParsedTrackerData, ParseError, ValueParseResult } from './types';
import type { Tracker, FieldDefinition, FieldValue } from '../../db/types';
import { trackerRepo } from '../../repositories';

export class ParserService {
  private tokenizer: Tokenizer;

  constructor() {
    this.tokenizer = new Tokenizer();
  }

  async parse(input: string): Promise<ParseResult> {
    const errors: ParseError[] = [];
    const trackerData: ParsedTrackerData[] = [];

    // Tokenize input
    const tokens = this.tokenizer.tokenize(input);

    // Find tag tokens
    const tagTokens = tokens.filter((t) => t.type === 'tag');

    // Process each tag
    for (let i = 0; i < tagTokens.length; i++) {
      const tagToken = tagTokens[i];
      const nextTagToken = tagTokens[i + 1];

      // Resolve tracker
      const tracker = await trackerRepo.findByTagOrAlias(tagToken.value);

      if (!tracker) {
        errors.push({
          message: `Tracker "#${tagToken.value}" not found`,
          position: tagToken.startIndex,
          tag: tagToken.value,
        });
        continue;
      }

      // Extract values between this tag and next tag
      const rawValues = this.tokenizer.extractValues(
        input,
        tagToken.endIndex,
        nextTagToken?.startIndex,
      );

      // Parse values based on tracker fields
      const values = this.parseFieldValues(tracker, rawValues, errors, tagToken.value);

      // Check for modifiers
      const completed = tokens.some(
        (t) =>
          t.type === 'modifier' &&
          t.value === 'done' &&
          t.startIndex > tagToken.startIndex &&
          (!nextTagToken || t.startIndex < nextTagToken.startIndex),
      );

      const skipped = tokens.some(
        (t) =>
          t.type === 'modifier' &&
          t.value === 'skip' &&
          t.startIndex > tagToken.startIndex &&
          (!nextTagToken || t.startIndex < nextTagToken.startIndex),
      );

      trackerData.push({
        tracker,
        values,
        completed,
        skipped,
        rawText: input
          .substring(tagToken.startIndex, nextTagToken?.startIndex ?? input.length)
          .trim(),
      });
    }

    // Extract note
    const note = this.tokenizer.extractNote(input, tokens);

    return { trackerData, note, errors };
  }

  private parseFieldValues(
    tracker: Tracker,
    rawValues: string[],
    errors: ParseError[],
    tag: string,
  ): Record<string, FieldValue> {
    const values: Record<string, FieldValue> = {};

    // Sort fields by sortOrder
    const sortedFields = [...tracker.fields].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );

    // Match values to fields positionally
    let valueIndex = 0;

    for (const field of sortedFields) {
      if (valueIndex >= rawValues.length) {
        // Use default value if available
        if (field.defaultValue !== undefined) {
          values[field.name] = field.defaultValue;
        } else if (field.required) {
          errors.push({
            message: `Missing required field "${field.label}" for #${tag}`,
            tag,
          });
        }
        continue;
      }

      const rawValue = rawValues[valueIndex];
      const parsed = this.parseFieldValue(field, rawValue);

      if (parsed !== null) {
        values[field.name] = parsed.value;

        // Validate unit if field specifies one
        if (field.unit && parsed.unit && normalizeUnit(parsed.unit) !== normalizeUnit(field.unit)) {
          errors.push({
            message: `Expected unit "${field.unit}" but got "${parsed.unit}" for field "${field.label}"`,
            tag,
          });
        }

        valueIndex++;
      } else {
        // Could not parse, use default or error
        if (field.defaultValue !== undefined) {
          values[field.name] = field.defaultValue;
        } else if (field.required) {
          errors.push({
            message: `Could not parse value "${rawValue}" for field "${field.label}"`,
            tag,
          });
        }
        valueIndex++;
      }
    }

    return values;
  }

  private parseFieldValue(field: FieldDefinition, rawValue: string): ValueParseResult | null {
    switch (field.type) {
      case 'number':
      case 'counter':
        return this.parseNumber(rawValue);

      case 'scale':
        return this.parseScale(rawValue, field);

      case 'duration':
        return this.parseDuration(rawValue);

      case 'boolean':
        return this.parseBoolean(rawValue);

      case 'text':
        return { value: rawValue };

      default:
        return null;
    }
  }

  private parseNumber(rawValue: string): ValueParseResult | null {
    const match = rawValue.match(PATTERNS.NUMBER_WITH_UNIT);
    if (!match) return null;

    const value = parseFloat(match[1]);
    const unit = match[2] ? normalizeUnit(match[2]) : undefined;

    return { value, unit };
  }

  private parseScale(rawValue: string, field: FieldDefinition): ValueParseResult | null {
    const num = parseInt(rawValue);
    if (isNaN(num)) return null;

    const min = field.scaleMin ?? 1;
    const max = field.scaleMax ?? 5;

    if (num < min || num > max) return null;

    return { value: num };
  }

  private parseDuration(rawValue: string): ValueParseResult | null {
    const match = rawValue.match(PATTERNS.DURATION);
    if (!match) {
      // Try simple number (assume minutes)
      const num = this.parseNumber(rawValue);
      if (num && typeof num.value === 'number' && !num.unit) {
        return { value: num.value * 60 }; // Convert to seconds
      }
      if (num && typeof num.value === 'number' && num.unit === 'min') {
        return { value: num.value * 60 };
      }
      if (num && typeof num.value === 'number' && num.unit === 'h') {
        return { value: num.value * 3600 };
      }
      if (num && typeof num.value === 'number' && num.unit === 's') {
        return { value: num.value };
      }
      return null;
    }

    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const seconds = match[3] ? parseInt(match[3]) : 0;

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    return { value: totalSeconds };
  }

  private parseBoolean(rawValue: string): ValueParseResult | null {
    const lower = rawValue.toLowerCase();
    if (['true', 'yes', '1', 'y'].includes(lower)) {
      return { value: true };
    }
    if (['false', 'no', '0', 'n'].includes(lower)) {
      return { value: false };
    }
    return null;
  }
}

export const parserService = new ParserService();
