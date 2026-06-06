/**
 * aiMemoryUtils.js — Pure helper functions for AI Chat Memory
 * All functions in this file are pure (no side effects, no I/O).
 * Async I/O functions (fetchMemoryForPrompt, maybeSummarize, etc.) are added in task 5.
 */

import { db } from '../lib/appwrite.js';
import { Query } from 'appwrite';
import { AI_MEMORY_PROMPT_TTL_MS } from './cacheTtls';

const memoryPromptCache = new Map();
const memoryPromptInflight = new Map();

const memoryPromptCacheKey = (userId, conversationId) =>
  `${userId}:${conversationId || 'none'}`;

export function invalidateMemoryPromptCache(userId, conversationId = null) {
  if (!userId) return;
  memoryPromptCache.delete(memoryPromptCacheKey(userId, conversationId));
  memoryPromptCache.delete(memoryPromptCacheKey(userId, null));
}

// ---------------------------------------------------------------------------
// Trigger predicates
// ---------------------------------------------------------------------------

/**
 * Returns true when the message count is a summarization trigger point.
 * Triggers at count 18, 28, 38, … (every 10 messages after the initial threshold of 8).
 *
 * @param {number} messageCount
 * @returns {boolean}
 */
export function shouldTriggerSummarization(messageCount) {
  return messageCount > 8 && (messageCount - 8) % 10 === 0;
}

/**
 * Returns true only when messageCount is exactly 2 — the point at which
 * enough context exists to generate a meaningful conversation title.
 *
 * @param {number} messageCount
 * @returns {boolean}
 */
export function isTitleGenerationTrigger(messageCount) {
  return messageCount === 2;
}

// ---------------------------------------------------------------------------
// Title helpers
// ---------------------------------------------------------------------------

/**
 * Trims a string to at most `maxWords` words.
 * Words are split on whitespace; empty tokens (from multiple spaces, etc.) are discarded.
 * Returns '' for empty or whitespace-only input.
 *
 * @param {string} text
 * @param {number} maxWords
 * @returns {string}
 */
export function trimToWordLimit(text, maxWords) {
  if (!text || typeof text !== 'string') return '';
  const words = text.split(/\s+/).filter(token => token.length > 0);
  return words.slice(0, maxWords).join(' ');
}

// ---------------------------------------------------------------------------
// Content clamping helpers
// ---------------------------------------------------------------------------

/**
 * Clamps summary content to a maximum of 1500 characters.
 *
 * @param {string} text
 * @returns {string}
 */
export function clampSummaryContent(text) {
  return text.slice(0, 1500);
}

/**
 * Clamps each message's content field to a maximum of 1200 characters.
 * Returns a new array; the original is not mutated.
 *
 * @param {Array<{ role: string, content: string }>} messages
 * @returns {Array<{ role: string, content: string }>}
 */
export function clampMessages(messages) {
  return messages.map(({ role, content }) => ({
    role,
    content: content.slice(0, 1200),
  }));
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Builds a prompt string that injects conversation summary and user facts
 * as labeled memory sections prepended to the base prompt.
 *
 * - If both memCtx fields are null, returns `base` unchanged.
 * - Total injected characters (everything except `base`) is clamped to ≤ 2500.
 * - Order: summary section → facts section → base.
 *
 * @param {string} base - The base prompt string.
 * @param {{ conversationSummary: string | null, userFacts: object | null }} memCtx
 * @returns {string}
 */
export function buildPromptWithMemory(base, memCtx) {
  const { conversationSummary, userFacts } = memCtx;

  if (conversationSummary === null && userFacts === null) {
    return base;
  }

  const MAX_INJECTED = 2500;

  let summarySection = '';
  if (conversationSummary !== null) {
    const summaryText = conversationSummary.slice(0, 1500);
    summarySection = 'Earlier conversation context:\n' + summaryText + '\n\n';
  }

  let factsSection = '';
  if (userFacts !== null) {
    // If userFacts is already a string, use it directly; otherwise serialize to JSON
    const factsContent = typeof userFacts === 'string' ? userFacts : JSON.stringify(userFacts);
    const rawFacts = 'Remembered user preferences:\n' + factsContent + '\n\n';
    const remaining = MAX_INJECTED - summarySection.length;
    if (remaining > 0) {
      factsSection = rawFacts.slice(0, remaining);
    }
  }

  return summarySection + factsSection + base;
}

// ---------------------------------------------------------------------------
// Summary list overlay
// ---------------------------------------------------------------------------

/**
 * For each summary in `summaries`, finds a matching titleDoc where
 * `titleDoc.conversationId === summary.id`. If found, sets `summary.title`
 * to `titleDoc.content`. Returns the updated summaries array.
 *
 * @param {Array<{ id: string, title: string }>} summaries
 * @param {Array<{ conversationId: string, content: string }>} titleDocs
 * @returns {Array<{ id: string, title: string }>}
 */
export function applyTitleOverlay(summaries, titleDocs) {
  return summaries.map(summary => {
    const match = titleDocs.find(doc => doc.conversationId === summary.id);
    if (match) {
      return { ...summary, title: match.content };
    }
    return summary;
  });
}

// ---------------------------------------------------------------------------
// Facts helpers
// ---------------------------------------------------------------------------

/**
 * Safely parses a JSON string into a plain object.
 * Returns null if:
 *  - raw is null or undefined
 *  - JSON.parse throws
 *  - the parsed value is not a plain object (e.g. array, null, number, string)
 *
 * @param {string | null | undefined} raw
 * @returns {object | null}
 */
export function parseFactsJson(raw) {
  if (raw == null) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  return parsed;
}

/**
 * Merges two facts objects by spreading existing first, then incoming.
 * Incoming values override existing values for shared keys;
 * keys absent from incoming are preserved from existing.
 *
 * @param {object} existing
 * @param {object} incoming
 * @returns {object}
 */
export function mergeFacts(existing, incoming) {
  return { ...existing, ...incoming };
}

/**
 * Known signal keyword regex patterns for preference detection.
 * Covers: store names, dietary terms, price-sensitivity terms, brand trigger phrases.
 */
const PREFERENCE_SIGNAL_PATTERNS = [
  // Store names
  /\bcarrefour\b/,
  /\bspinneys\b/,
  /\blulu\b/,
  /union\s+coop/,
  /\bg[eé]ant\b/,
  /\bmonoprix\b/,
  /\bwaitrose\b/,
  /\bco-op\b/,
  // Dietary terms
  /\bvegan\b/,
  /\bvegetarian\b/,
  /\bhalal\b/,
  /\bkosher\b/,
  /gluten[- ]free/,
  /dairy[- ]free/,
  /nut[- ]free/,
  /\borganic\b/,
  // Price-sensitivity terms
  /\bbudget\b/,
  /\bcheap\b/,
  /\bexpensive\b/,
  /\bpremium\b/,
  /\baffordable\b/,
  // Brand trigger phrases
  /preferred\s+brand/,
  /favou?rite\s+brand/,
  /always\s+buy/,
  /go-to\s+brand/,
];

/**
 * Returns true if the combined text of assistantReply and userMessage
 * contains at least one known preference signal keyword.
 *
 * @param {string} assistantReply
 * @param {string} userMessage
 * @returns {boolean}
 */
export function hasPreferenceSignals(assistantReply, userMessage) {
  const combined = `${assistantReply ?? ''} ${userMessage ?? ''}`.toLowerCase();
  return PREFERENCE_SIGNAL_PATTERNS.some(pattern => pattern.test(combined));
}

// ---------------------------------------------------------------------------
// Async I/O — Memory fetch
// ---------------------------------------------------------------------------

/**
 * Fetches the conversation summary and user facts for the current user/conversation
 * from the Memory Store, to be injected into the system prompt.
 *
 * @param {string} userId
 * @param {string | null} conversationId
 * @returns {Promise<{ conversationSummary: string | null, userFacts: object | null }>}
 */
export async function fetchMemoryForPrompt(userId, conversationId) {
  if (!userId || !db.aiChatMemory) {
    return { conversationSummary: null, userFacts: null };
  }

  const cacheKey = memoryPromptCacheKey(userId, conversationId);
  const cached = memoryPromptCache.get(cacheKey);
  if (cached && Date.now() - cached.at < AI_MEMORY_PROMPT_TTL_MS) {
    return cached.data;
  }

  if (memoryPromptInflight.has(cacheKey)) {
    return memoryPromptInflight.get(cacheKey);
  }

  const run = (async () => {
  const LEGACY_CONVERSATION_ID = 'legacy';

  try {
    const summaryQueries = [
      Query.equal('userId', userId),
      Query.equal('memoryType', 'conversation_summary'),
      Query.limit(1),
    ];
    if (conversationId) {
      if (conversationId === LEGACY_CONVERSATION_ID) {
        summaryQueries.push(Query.isNull('conversationId'));
      } else {
        summaryQueries.push(Query.equal('conversationId', conversationId));
      }
    }

    const factsQueries = [
      Query.equal('userId', userId),
      Query.equal('memoryType', 'user_facts'),
      Query.limit(1),
    ];

    const [summaryRes, factsRes] = await Promise.all([
      conversationId
        ? db.aiChatMemory.list(summaryQueries)
        : Promise.resolve({ documents: [] }),
      db.aiChatMemory.list(factsQueries),
    ]);

    const summaryDoc = summaryRes.documents?.[0] ?? null;
    const factsDoc = factsRes.documents?.[0] ?? null;

    const conversationSummary = summaryDoc ? summaryDoc.content : null;
    const userFacts = factsDoc ? parseFactsJson(factsDoc.content) : null;

    return { conversationSummary, userFacts };
  } catch {
    return { conversationSummary: null, userFacts: null };
  }
  })();

  memoryPromptInflight.set(cacheKey, run);
  try {
    const data = await run;
    memoryPromptCache.set(cacheKey, { data, at: Date.now() });
    return data;
  } finally {
    memoryPromptInflight.delete(cacheKey);
  }
}

// ---------------------------------------------------------------------------
// Async I/O — Upsert helper (private, not exported)
// ---------------------------------------------------------------------------

/**
 * Upserts a memory document: queries for existing (userId, conversationId, memoryType),
 * updates if found, creates if not. Skips write if conversationId is falsy and
 * memoryType !== 'user_facts'.
 *
 * @param {string} userId
 * @param {string | null} conversationId
 * @param {string} memoryType
 * @param {string} content
 * @returns {Promise<void>}
 */
async function upsertMemoryDoc(userId, conversationId, memoryType, content) {
  if (!conversationId && memoryType !== 'user_facts') return;

  const queries = [
    Query.equal('userId', userId),
    Query.equal('memoryType', memoryType),
  ];
  if (conversationId) {
    queries.push(Query.equal('conversationId', conversationId));
  }

  const existing = await db.aiChatMemory.list(queries);
  const updatedAt = new Date().toISOString();

  if (existing.documents.length > 0) {
    await db.aiChatMemory.update(existing.documents[0].$id, { content, updatedAt });
  } else {
    const data = { userId, memoryType, content, updatedAt };
    if (conversationId) data.conversationId = conversationId;
    await db.aiChatMemory.create(data);
  }
  invalidateMemoryPromptCache(userId, conversationId);
}

// ---------------------------------------------------------------------------
// Async I/O — Conversation summarizer
// ---------------------------------------------------------------------------

/**
 * Generates and upserts a conversation summary if the message count triggers it.
 * Runs asynchronously — does not block the main chat flow.
 *
 * @param {{ openai: object, userId: string, conversationId: string, messages: Array<{ role: string, content: string }>, model: string }} params
 * @returns {Promise<void>}
 */
export async function maybeSummarize({ openai, userId, conversationId, messages, model }) {
  if (!userId || !conversationId || !shouldTriggerSummarization(messages.length)) return;

  const clampedMessages = clampMessages(messages);
  const messageText = clampedMessages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'Summarize this conversation in 2-4 concise sentences, capturing the main topics and any important user preferences or decisions.',
      },
      { role: 'user', content: messageText },
    ],
    max_tokens: 300,
  });

  const rawSummary = response.choices?.[0]?.message?.content?.trim() ?? '';
  const content = clampSummaryContent(rawSummary);
  if (!content) return;

  await upsertMemoryDoc(userId, conversationId, 'conversation_summary', content);
}

// ---------------------------------------------------------------------------
// Async I/O — Title generation
// ---------------------------------------------------------------------------

/**
 * Generates and upserts an AI-produced conversation title.
 * Only fires when messageCount === 2 (isTitleGenerationTrigger).
 * Runs asynchronously — does not block the main chat flow.
 *
 * @param {{ openai: object, userId: string, conversationId: string, firstUserMessage: string, model: string, messageCount: number }} params
 * @returns {Promise<void>}
 */
export async function maybeTitleGenerate({ openai, userId, conversationId, firstUserMessage, model, messageCount }) {
  if (!userId || !conversationId || !isTitleGenerationTrigger(messageCount)) return;

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'Generate a concise 3-7 word title for this conversation. Return ONLY the title, no punctuation, no quotes, no explanation.',
      },
      { role: 'user', content: firstUserMessage },
    ],
    max_tokens: 20,
  });

  const raw = response.choices?.[0]?.message?.content?.trim() ?? '';
  const title = trimToWordLimit(raw, 7);
  if (!title) return;

  await upsertMemoryDoc(userId, conversationId, 'conversation_title', title);
}

// ---------------------------------------------------------------------------
// Async I/O — Fact extraction
// ---------------------------------------------------------------------------

/**
 * Extracts user preference facts from an assistant reply and upserts them
 * into the user_facts memory document. Runs asynchronously.
 */
export async function maybeExtractFacts({ openai, userId, conversationId, assistantReply, userMessage }) {
  void conversationId;
  if (!userId) return;
  if (!hasPreferenceSignals(assistantReply, userMessage)) return;

  const response = await openai.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Extract user shopping preferences from this conversation. Return ONLY a JSON object with these optional fields:
{
  "preferredStores": ["store names"],
  "preferredBrands": ["brand names"],
  "dietaryNeeds": ["dietary restrictions"],
  "priceSensitivity": "budget|mid-range|premium",
  "avoidIngredients": ["ingredients to avoid"]
}
Include only fields that are explicitly mentioned. Return {} if nothing specific is mentioned.`,
      },
      {
        role: 'user',
        content: `User said: "${userMessage}"\nAssistant replied: "${assistantReply}"`,
      },
    ],
    max_tokens: 200,
  });

  const raw = response.choices?.[0]?.message?.content?.trim() ?? '';
  const incoming = parseFactsJson(raw);
  if (!incoming) return;

  // Load existing user_facts doc
  let existing = {};
  try {
    const existingDocs = await db.aiChatMemory.list([
      Query.equal('userId', userId),
      Query.equal('memoryType', 'user_facts'),
    ]);
    if (existingDocs.documents.length > 0) {
      existing = parseFactsJson(existingDocs.documents[0].content) ?? {};
    }
  } catch {
    // If load fails, start from empty
  }

  const merged = mergeFacts(existing, incoming);
  await upsertMemoryDoc(userId, null, 'user_facts', JSON.stringify(merged));
}
