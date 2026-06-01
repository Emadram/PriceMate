const CARD_SEGMENT_TYPES = new Set(['barcode', 'store']);

const PUNCTUATION_ONLY = /^[\s.,;:!?…·\-–—]+$/u;

/**
 * Remove stray punctuation immediately after product/store tags (before tokenization).
 * @param {string} text
 */
export const scrubPunctuationAfterProductTags = (text) =>
    String(text || '')
        .replace(/\[(?:BARCODE|ID):([\w\d-]+)\]\s*[.,;:!?…]+/gi, '[BARCODE:$1]')
        .replace(/\[STORE:([\w\d-]+)\]\s*[.,;:!?…]+/gi, '[STORE:$1]');

/**
 * @param {string} text
 * @returns {{ type: 'text' | 'barcode' | 'store', value: string }[]}
 */
export const tokenizeMessageContent = (text) => {
    const combinedRegex = /\[(?:BARCODE|ID):([\w\d-]+)\]|\[STORE:([\w\d-]+)\]/gi;
    const segments = [];
    let lastIndex = 0;
    let match = combinedRegex.exec(text);
    while (match) {
        if (match.index > lastIndex) {
            segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }
        if (match[1]) segments.push({ type: 'barcode', value: match[1] });
        if (match[2]) segments.push({ type: 'store', value: match[2] });
        lastIndex = match.index + match[0].length;
        match = combinedRegex.exec(text);
    }
    if (lastIndex < text.length) {
        segments.push({ type: 'text', value: text.slice(lastIndex) });
    }
    return segments;
};

/**
 * Drops orphan punctuation text nodes and trims punctuation hugging product cards.
 * @param {{ type: string, value: string }[]} segments
 */
export const polishMessageSegments = (segments) => {
    const polished = [];

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (!segment || segment.type !== 'text') {
            polished.push(segment);
            continue;
        }

        const prev = polished[polished.length - 1];
        const prevIsCard = prev && CARD_SEGMENT_TYPES.has(prev.type);

        let value = segment.value;
        if (prevIsCard) {
            value = value.replace(/^\s*[.,;:!?…]+(?:\s+|$)/u, '');
        }

        if (!value.trim() || PUNCTUATION_ONLY.test(value)) {
            continue;
        }

        polished.push({ type: 'text', value });
    }

    return polished;
};
