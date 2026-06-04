import { describe, it, expect } from 'vitest';
import {
    scrubPunctuationAfterProductTags,
    tokenizeMessageContent,
    polishMessageSegments,
} from './chatMessageContent';

describe('chatMessageContent', () => {
    it('scrubs punctuation immediately after BARCODE and STORE tags', () => {
        const input = 'Cheapest: [BARCODE:123]. Also [STORE:abc].';
        expect(scrubPunctuationAfterProductTags(input)).toBe('Cheapest: [BARCODE:123] Also [STORE:abc]');
    });

    it('polishMessageSegments removes orphan period after a product card', () => {
        const segments = tokenizeMessageContent('Here you go [BARCODE:123].');
        const polished = polishMessageSegments(segments);
        expect(polished).toEqual([
            { type: 'text', value: 'Here you go ' },
            { type: 'barcode', value: '123' },
        ]);
    });

    it('polishMessageSegments removes leading period before following text', () => {
        const segments = tokenizeMessageContent('[BARCODE:123]. Try this next.');
        const polished = polishMessageSegments(segments);
        expect(polished).toEqual([
            { type: 'barcode', value: '123' },
            { type: 'text', value: 'Try this next.' },
        ]);
    });

    it('keeps intentional sentence punctuation before a card', () => {
        const segments = tokenizeMessageContent('Best match below. [BARCODE:99]');
        const polished = polishMessageSegments(segments);
        expect(polished[0].value.trim()).toBe('Best match below.');
    });
});
