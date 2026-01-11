import { PATTERNS } from './patterns';
import type { ParsedToken } from './types';

export class Tokenizer {
  tokenize(input: string): ParsedToken[] {
    const tokens: ParsedToken[] = [];

    // Find all tag matches
    const tagMatches = Array.from(input.matchAll(PATTERNS.TAG));

    for (const match of tagMatches) {
      const tag = match[1];
      const scaleValue = match[2]; // For #mood(4) syntax

      tokens.push({
        type: 'tag',
        value: tag,
        startIndex: match.index!,
        endIndex: match.index! + match[0].length,
      });

      // If scale value present, add as value token
      if (scaleValue) {
        tokens.push({
          type: 'value',
          value: scaleValue,
          startIndex: match.index! + tag.length + 2, // After #tag(
          endIndex: match.index! + match[0].length - 1,
        });
      }
    }

    // Find all modifier matches
    const modifierMatches = Array.from(input.matchAll(PATTERNS.MODIFIER));

    for (const match of modifierMatches) {
      tokens.push({
        type: 'modifier',
        value: match[1],
        startIndex: match.index!,
        endIndex: match.index! + match[0].length,
      });
    }

    // Sort tokens by position
    tokens.sort((a, b) => a.startIndex - b.startIndex);

    return tokens;
  }

  // Extract values between tokens
  extractValues(input: string, tagEndIndex: number, nextTokenIndex?: number): string[] {
    const endIndex = nextTokenIndex ?? input.length;
    const segment = input.substring(tagEndIndex, endIndex).trim();

    if (!segment) return [];

    // Split by whitespace and filter empty
    return segment.split(/\s+/).filter((s) => s.length > 0);
  }

  // Extract note (text that's not part of tags/modifiers)
  extractNote(input: string, tokens: ParsedToken[]): string {
    if (tokens.length === 0) return input.trim();

    // Find gaps between tokens
    const parts: string[] = [];
    let lastEnd = 0;

    for (const token of tokens) {
      if (token.startIndex > lastEnd) {
        const text = input.substring(lastEnd, token.startIndex).trim();
        if (text && !text.match(/^\d/)) {
          // Avoid capturing values
          parts.push(text);
        }
      }
      lastEnd = token.endIndex;
    }

    // Add remaining text
    if (lastEnd < input.length) {
      const text = input.substring(lastEnd).trim();
      if (text) parts.push(text);
    }

    return parts.join(' ').trim();
  }
}
