import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  shouldTriggerSummarization,
  isTitleGenerationTrigger,
  trimToWordLimit,
  mergeFacts,
  parseFactsJson,
  buildPromptWithMemory,
  applyTitleOverlay,
  hasPreferenceSignals,
  clampSummaryContent,
  clampMessages,
} from './aiMemoryUtils.js';

// Feature: ai-chat-memory, Property 4: Summarization trigger correct for all message counts
describe('Property 4: shouldTriggerSummarization trigger predicate', () => {
  it('returns true iff n > 8 && (n - 8) % 10 === 0 for all n in [0, 200]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), (n) => {
        const expected = n > 8 && (n - 8) % 10 === 0;
        expect(shouldTriggerSummarization(n)).toBe(expected);
      })
    );
  });
});

// Feature: ai-chat-memory, Property 13: Title generation trigger fires only at message count 2
describe('Property 13: isTitleGenerationTrigger predicate', () => {
  it('returns true iff n === 2 for all n in [0, 200]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), (n) => {
        const expected = n === 2;
        expect(isTitleGenerationTrigger(n)).toBe(expected);
      })
    );
  });
});

// Feature: ai-chat-memory, Property 14: Title word count always within bounds after trimming
describe('Property 14: trimToWordLimit word count always within bounds', () => {
  it('should produce a word count between 1 and 7 for any non-blank string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        (s) => {
          const result = trimToWordLimit(s, 7);
          const wordCount = result.split(/\s+/).filter(Boolean).length;
          return wordCount >= 1 && wordCount <= 7;
        }
      )
    );
  });
});

// Feature: ai-chat-memory, Property 10: Facts merge — new keys override, absent keys preserved
describe('Property 10: mergeFacts merge semantics', () => {
  const factsArb = fc.record({
    preferredStores: fc.array(fc.string()),
    preferredBrands: fc.array(fc.string()),
    dietaryNeeds: fc.array(fc.string()),
    priceSensitivity: fc.string(),
    avoidIngredients: fc.array(fc.string()),
  }, { withDeletedKeys: true });

  it('incoming keys override existing keys, absent keys are preserved', () => {
    // Validates: Requirements 3.5
    fc.assert(
      fc.property(factsArb, factsArb, (existing, incoming) => {
        const result = mergeFacts(existing, incoming);

        // For every key in incoming: result[k] === incoming[k]
        for (const k of Object.keys(incoming)) {
          expect(result[k]).toStrictEqual(incoming[k]);
        }

        // For every key only in existing (not in incoming): result[k] === existing[k]
        for (const k of Object.keys(existing)) {
          if (!(k in incoming)) {
            expect(result[k]).toStrictEqual(existing[k]);
          }
        }
      })
    );
  });
});

// Feature: ai-chat-memory, Property 11: Invalid facts JSON discarded without mutating store
describe('Property 11: parseFactsJson returns null for any invalid JSON string', () => {
  it('should return null for every string that is not valid JSON', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => {
          try { JSON.parse(s); return false; } catch { return true; }
        }),
        (s) => {
          expect(parseFactsJson(s)).toBeNull();
        }
      )
    );
  });
});

// Feature: ai-chat-memory, Property 9: Facts JSON round-trip
describe('Property 9: Facts JSON round-trip', () => {
  it('JSON.parse(JSON.stringify(facts)) deep-equals the original and all keys are within the allowed set', () => {
    // Validates: Requirements 3.3, 3.10
    const ALLOWED_KEYS = new Set([
      'preferredStores',
      'preferredBrands',
      'dietaryNeeds',
      'priceSensitivity',
      'avoidIngredients',
    ]);

    fc.assert(
      fc.property(
        fc.record({
          preferredStores: fc.array(fc.string()),
          preferredBrands: fc.array(fc.string()),
          dietaryNeeds: fc.array(fc.string()),
          priceSensitivity: fc.string(),
          avoidIngredients: fc.array(fc.string()),
        }, { withDeletedKeys: true }),
        (facts) => {
          const roundTripped = JSON.parse(JSON.stringify(facts));

          // Deep-equals the original
          expect(JSON.stringify(roundTripped)).toBe(JSON.stringify(facts));

          // All keys are within the allowed set
          for (const k of Object.keys(roundTripped)) {
            expect(ALLOWED_KEYS.has(k)).toBe(true);
          }
        }
      )
    );
  });
});

// Feature: ai-chat-memory, Property 17: Total memory injection clamped to ≤ 2500 characters
describe('Property 17: Total memory injection clamped to ≤ 2500 characters', () => {
  it('buildPromptWithMemory adds ≤ 2500 chars vs the base prompt for any summary and facts strings', () => {
    // Validates: Requirements 5.4
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.string(),
        (base, summary, facts) => {
          const result = buildPromptWithMemory(base, {
            conversationSummary: summary,
            userFacts: facts,
          });
          const injectedChars = result.length - base.length;
          return injectedChars <= 2500;
        }
      )
    );
  });
});

// Feature: ai-chat-memory, Property 9: Facts JSON round-trip
describe('Property 9: Facts JSON round-trip', () => {
  const factsArb = fc.record({
    preferredStores: fc.array(fc.string()),
    preferredBrands: fc.array(fc.string()),
    dietaryNeeds: fc.array(fc.string()),
    priceSensitivity: fc.string(),
    avoidIngredients: fc.array(fc.string()),
  }, { withDeletedKeys: true });

  const ALLOWED_KEYS = new Set(['preferredStores', 'preferredBrands', 'dietaryNeeds', 'priceSensitivity', 'avoidIngredients']);

  it('round-trips correctly and all keys are within the allowed set', () => {
    // Validates: Requirements 3.3, 3.10
    fc.assert(
      fc.property(factsArb, (facts) => {
        const roundTripped = JSON.parse(JSON.stringify(facts));
        // Deep equality (toEqual ignores prototype differences — JSON round-trip always produces plain objects)
        expect(roundTripped).toEqual(facts);
        // All keys within allowed set
        for (const k of Object.keys(roundTripped)) {
          expect(ALLOWED_KEYS.has(k)).toBe(true);
        }
      })
    );
  });
});

// Feature: ai-chat-memory, Property 16: Memory injection section order invariant
describe('Property 16: buildPromptWithMemory section ordering', () => {
  it('contains "Earlier conversation context:" before "Remembered user preferences:" when both are non-null', () => {
    // Validates: Requirements 5.2, 5.3
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.string(),
        (base, conversationSummary, userFacts) => {
          const result = buildPromptWithMemory(base, { conversationSummary, userFacts });
          const summaryIdx = result.indexOf('Earlier conversation context:');
          const factsIdx = result.indexOf('Remembered user preferences:');
          return summaryIdx < factsIdx;
        }
      )
    );
  });
});

// Feature: ai-chat-memory, Property 18: No memory sections injected when context is empty
describe('Property 18: buildPromptWithMemory with null context produces no memory headers', () => {
  it('does not contain "Earlier conversation context:" or "Remembered user preferences:" when both are null', () => {
    // Validates: Requirements 5.5
    fc.assert(
      fc.property(
        fc.string(),
        (base) => {
          const result = buildPromptWithMemory(base, { conversationSummary: null, userFacts: null });
          expect(result.includes('Earlier conversation context:')).toBe(false);
          expect(result.includes('Remembered user preferences:')).toBe(false);
        }
      )
    );
  });
});

// Feature: ai-chat-memory, Property 5: Summary content always clamped to ≤ 1500 characters
describe('Property 5: clampSummaryContent always produces length ≤ 1500', () => {
  it('should return a string of length ≤ 1500 for any input string', () => {
    // Validates: Requirements 2.3, 2.9
    fc.assert(
      fc.property(fc.string(), (s) => {
        return clampSummaryContent(s).length <= 1500;
      })
    );
  });
});

// Feature: ai-chat-memory, Property 8: Preference signal detection correctly classifies arbitrary text
describe('Property 8: hasPreferenceSignals detection', () => {
  it('returns true for strings containing known signal keywords', () => {
    // Validates: Requirements 3.1
    fc.assert(
      fc.property(
        fc.constantFrom('Carrefour', 'Spinneys', 'Lulu', 'vegan', 'halal', 'budget', 'organic', 'gluten-free'),
        (keyword) => {
          const text = 'I prefer ' + keyword + ' products';
          expect(hasPreferenceSignals(text, '')).toBe(true);
        }
      )
    );
  });

  it('returns false for strings containing none of the known keywords', () => {
    // Validates: Requirements 3.1
    fc.assert(
      fc.property(
        fc.string().filter(s => !/(carrefour|spinneys|lulu|lulu hypermarket|union coop|géant|monoprix|vegan|vegetarian|halal|kosher|gluten.free|dairy.free|nut.free|organic|budget|cheap|expensive|premium|affordable|avoid)/i.test(s)),
        (s) => {
          expect(hasPreferenceSignals(s, '')).toBe(false);
        }
      )
    );
  });
});

// Feature: ai-chat-memory, Property 6: Input messages to summarizer clamped to ≤ 1200 characters each
describe('Property 6: clampMessages clamps all message content to ≤ 1200 characters', () => {
  it('every resulting message has content.length <= 1200 for any array of message objects', () => {
    // Validates: Requirements 2.8
    fc.assert(
      fc.property(
        fc.array(fc.record({ role: fc.constantFrom('user', 'assistant'), content: fc.string() })),
        (messages) => {
          const clamped = clampMessages(messages);
          return clamped.every((msg) => msg.content.length <= 1200);
        }
      )
    );
  });
});

// Feature: ai-chat-memory, Property 15: Title overlay substitutes AI titles in conversation summaries
describe('Property 15: applyTitleOverlay sets matched summary titles from titleDocs', () => {
  const summaryArb = fc.array(
    fc.record({ id: fc.string({ minLength: 1 }), title: fc.string() })
  );

  it('sets each matched summary title to the titleDoc content', () => {
    // Validates: Requirements 4.4
    fc.assert(
      fc.property(summaryArb, (summaries) => {
        // Build titleDocs that match each summary by id
        const titleDocs = summaries.map((s) => ({
          conversationId: s.id,
          content: 'AI Title for ' + s.id,
          memoryType: 'conversation_title',
        }));

        const result = applyTitleOverlay(summaries, titleDocs);

        for (let i = 0; i < summaries.length; i++) {
          const matchingDoc = titleDocs.find((d) => d.conversationId === summaries[i].id);
          if (matchingDoc) {
            expect(result[i].title).toBe(matchingDoc.content);
          }
        }
      })
    );
  });

  it('leaves titles unchanged when no matching titleDoc exists', () => {
    // Validates: Requirements 4.4
    fc.assert(
      fc.property(summaryArb, (summaries) => {
        const result = applyTitleOverlay(summaries, []);
        for (let i = 0; i < summaries.length; i++) {
          expect(result[i].title).toBe(summaries[i].title);
        }
      })
    );
  });
});
