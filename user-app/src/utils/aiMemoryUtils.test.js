import { describe, it, expect } from 'vitest';
import {
  shouldTriggerSummarization,
  isTitleGenerationTrigger,
  trimToWordLimit,
  mergeFacts,
  parseFactsJson,
  buildPromptWithMemory,
  applyTitleOverlay,
} from './aiMemoryUtils.js';

describe('shouldTriggerSummarization', () => {
  it('returns false for count 0', () => {
    expect(shouldTriggerSummarization(0)).toBe(false);
  });

  it('returns false for count 8 (threshold boundary, not exceeded)', () => {
    expect(shouldTriggerSummarization(8)).toBe(false);
  });

  it('returns false for count 9 (9 > 8 but (9-8)%10 = 1, not 0)', () => {
    expect(shouldTriggerSummarization(9)).toBe(false);
  });

  it('returns true for count 18 (18 > 8 && (18-8)%10 === 0)', () => {
    expect(shouldTriggerSummarization(18)).toBe(true);
  });

  it('returns false for count 19 ((19-8)%10 = 1, not 0)', () => {
    expect(shouldTriggerSummarization(19)).toBe(false);
  });

  it('returns true for count 28 (28 > 8 && (28-8)%10 === 0)', () => {
    expect(shouldTriggerSummarization(28)).toBe(true);
  });

  it('returns true for count 38 (38 > 8 && (38-8)%10 === 0)', () => {
    expect(shouldTriggerSummarization(38)).toBe(true);
  });
});

describe('isTitleGenerationTrigger', () => {
  it('returns false for count 0', () => {
    expect(isTitleGenerationTrigger(0)).toBe(false);
  });

  it('returns false for count 1', () => {
    expect(isTitleGenerationTrigger(1)).toBe(false);
  });

  it('returns true for count 2 (only trigger point)', () => {
    expect(isTitleGenerationTrigger(2)).toBe(true);
  });

  it('returns false for count 3', () => {
    expect(isTitleGenerationTrigger(3)).toBe(false);
  });

  it('returns false for count 4', () => {
    expect(isTitleGenerationTrigger(4)).toBe(false);
  });
});

describe('trimToWordLimit', () => {
  it('returns a 3-word string unchanged when maxWords=7', () => {
    expect(trimToWordLimit('one two three', 7)).toBe('one two three');
  });

  it('returns a 7-word string unchanged when maxWords=7', () => {
    expect(trimToWordLimit('one two three four five six seven', 7)).toBe('one two three four five six seven');
  });

  it('trims an 8-word string to 7 words when maxWords=7', () => {
    expect(trimToWordLimit('one two three four five six seven eight', 7)).toBe('one two three four five six seven');
  });

  it('trims a 12-word string to 7 words when maxWords=7', () => {
    expect(trimToWordLimit('a b c d e f g h i j k l', 7)).toBe('a b c d e f g');
  });

  it('returns empty string for empty input', () => {
    expect(trimToWordLimit('', 7)).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(trimToWordLimit('   ', 7)).toBe('');
  });
});

describe('mergeFacts', () => {
  it('overrides existing key with incoming value', () => {
    const existing = { preferredStores: ['A'] };
    const incoming = { preferredStores: ['B'] };
    expect(mergeFacts(existing, incoming)).toEqual({ preferredStores: ['B'] });
  });

  it('preserves keys absent from incoming', () => {
    const existing = { preferredStores: ['A'], dietaryNeeds: ['vegan'] };
    const incoming = { preferredStores: ['B'] };
    expect(mergeFacts(existing, incoming)).toEqual({
      preferredStores: ['B'],
      dietaryNeeds: ['vegan'],
    });
  });

  it('populates result from incoming when existing is empty', () => {
    const existing = {};
    const incoming = { priceSensitivity: 'budget' };
    expect(mergeFacts(existing, incoming)).toEqual({ priceSensitivity: 'budget' });
  });

  it('returns clone of existing when incoming is empty', () => {
    const existing = { dietaryNeeds: ['halal'] };
    const incoming = {};
    expect(mergeFacts(existing, incoming)).toEqual({ dietaryNeeds: ['halal'] });
  });

  it('returns empty object when both existing and incoming are empty', () => {
    expect(mergeFacts({}, {})).toEqual({});
  });
});

describe('parseFactsJson', () => {
  it('parses a valid JSON object string', () => {
    expect(parseFactsJson('{"preferredStores":["Carrefour"]}')).toEqual({
      preferredStores: ['Carrefour'],
    });
  });

  it('returns null for invalid JSON string', () => {
    expect(parseFactsJson('not json')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(parseFactsJson(null)).toBeNull();
  });

  it('parses a partial schema (missing keys are allowed)', () => {
    expect(parseFactsJson('{"priceSensitivity":"budget"}')).toEqual({
      priceSensitivity: 'budget',
    });
  });

  it('returns null for a JSON array (non-object)', () => {
    expect(parseFactsJson('["a"]')).toBeNull();
  });

  it('returns null for a JSON number (non-object)', () => {
    expect(parseFactsJson('42')).toBeNull();
  });
});

describe('buildPromptWithMemory', () => {
  it('both summary and facts populated: contains both section headers in correct order', () => {
    const result = buildPromptWithMemory('base', {
      conversationSummary: 'Summary text',
      userFacts: { preferredStores: ['Carrefour'] },
    });

    expect(result).toContain('Earlier conversation context:');
    expect(result).toContain('Remembered user preferences:');

    const summaryIdx = result.indexOf('Earlier conversation context:');
    const factsIdx = result.indexOf('Remembered user preferences:');
    expect(summaryIdx).toBeLessThan(factsIdx);
  });

  it('summary only (facts null): contains summary header, no facts header', () => {
    const result = buildPromptWithMemory('base', {
      conversationSummary: 'Summary text',
      userFacts: null,
    });

    expect(result).toContain('Earlier conversation context:');
    expect(result).not.toContain('Remembered user preferences:');
  });

  it('facts only (summary null): contains facts header, no summary header', () => {
    const result = buildPromptWithMemory('base', {
      conversationSummary: null,
      userFacts: { dietaryNeeds: ['vegan'] },
    });

    expect(result).toContain('Remembered user preferences:');
    expect(result).not.toContain('Earlier conversation context:');
  });

  it('both null: returns base string exactly (no memory headers injected)', () => {
    const result = buildPromptWithMemory('base', {
      conversationSummary: null,
      userFacts: null,
    });

    expect(result).not.toContain('Earlier conversation context:');
    expect(result).not.toContain('Remembered user preferences:');
  });
});

describe('applyTitleOverlay', () => {
  it('replaces title when a matching titleDoc exists', () => {
    const summaries = [{ id: 'conv-1', title: 'Old truncated title' }];
    const titleDocs = [{ conversationId: 'conv-1', content: 'Best Deals Today', memoryType: 'conversation_title' }];
    const result = applyTitleOverlay(summaries, titleDocs);
    expect(result[0].title).toBe('Best Deals Today');
  });

  it('leaves title unchanged when no matching titleDoc exists', () => {
    const summaries = [{ id: 'conv-2', title: 'Original Title' }];
    const titleDocs = [{ conversationId: 'other-conv', content: 'Different Title', memoryType: 'conversation_title' }];
    const result = applyTitleOverlay(summaries, titleDocs);
    expect(result[0].title).toBe('Original Title');
  });

  it('returns summaries unchanged when titleDocs is empty', () => {
    const summaries = [{ id: 'conv-3', title: 'My Title' }];
    const result = applyTitleOverlay(summaries, []);
    expect(result[0].title).toBe('My Title');
  });

  it('returns empty array when summaries is empty', () => {
    const titleDocs = [{ conversationId: 'conv-1', content: 'Some Title', memoryType: 'conversation_title' }];
    const result = applyTitleOverlay([], titleDocs);
    expect(result).toEqual([]);
  });
});
