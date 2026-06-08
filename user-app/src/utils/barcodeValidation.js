/** ZXing BarcodeFormat values used by the scanner. */
export const ZXING_FORMAT = {
    CODE_39: 2,
    CODE_93: 3,
    CODE_128: 4,
    EAN_8: 6,
    EAN_13: 7,
    UPC_A: 14,
    UPC_E: 15,
};

const GTIN_FORMATS = new Set([
    ZXING_FORMAT.EAN_8,
    ZXING_FORMAT.EAN_13,
    ZXING_FORMAT.UPC_A,
    ZXING_FORMAT.UPC_E,
]);

const LOOSE_FORMATS = new Set([
    ZXING_FORMAT.CODE_39,
    ZXING_FORMAT.CODE_93,
    ZXING_FORMAT.CODE_128,
]);

const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;

/**
 * Validate GTIN-13 check digit (GS1 mod-10).
 * @param {string} gtin13
 */
export function isValidGtinCheckDigit(gtin13) {
    if (!/^\d{13}$/.test(gtin13)) return false;

    const digits = gtin13.split('').map(Number);
    const check = digits[12];
    let sum = 0;

    for (let i = 0; i < 12; i += 1) {
        sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    }

    return (10 - (sum % 10)) % 10 === check;
}

/**
 * Normalize retail barcodes to GTIN-13 for checksum validation.
 * @param {string} code
 * @param {number|undefined} format
 * @returns {string|null}
 */
export function normalizeToGtin13(code, format) {
    const value = String(code || '').trim();
    if (!/^\d+$/.test(value)) return null;

    if (value.length === 13) return value;
    if (value.length === 12) return `0${value}`;
    if (value.length === 8) return `00000${value}`;
    if (format === ZXING_FORMAT.UPC_E && value.length >= 6 && value.length <= 8) {
        return `00000${value.padStart(8, '0')}`;
    }

    return null;
}

function validateGtin(code, format) {
    if (!/^\d+$/.test(code)) {
        return { ok: false, reason: 'invalid_format' };
    }

    const gtin13 = normalizeToGtin13(code, format);
    if (!gtin13) {
        return { ok: false, reason: 'invalid_format' };
    }

    if (!isValidGtinCheckDigit(gtin13)) {
        return { ok: false, reason: 'invalid_checksum' };
    }

    return { ok: true };
}

function validateLoose(code) {
    const value = String(code || '').trim();
    if (!value) return { ok: false, reason: 'empty' };
    if (value.length < 4 || value.length > 48) return { ok: false, reason: 'invalid_format' };
    if (!PRINTABLE_ASCII.test(value)) return { ok: false, reason: 'invalid_format' };
    return { ok: true };
}

function inferValidationStrategy(code, format) {
    if (format != null) {
        if (GTIN_FORMATS.has(format)) return 'gtin';
        if (LOOSE_FORMATS.has(format)) return 'loose';
    }

    const value = String(code || '').trim();
    if (/^\d{8}$/.test(value) || /^\d{12}$/.test(value) || /^\d{13}$/.test(value)) {
        return 'gtin';
    }

    if (/^\d+$/.test(value)) {
        return 'gtin';
    }

    return 'loose';
}

/**
 * @param {string} code
 * @param {number|undefined} format ZXing BarcodeFormat enum value
 * @returns {{ ok: boolean, reason?: 'empty' | 'invalid_format' | 'invalid_checksum' }}
 */
export function validateScannedBarcode(code, format) {
    const value = String(code ?? '').trim();
    if (!value) return { ok: false, reason: 'empty' };

    const strategy = inferValidationStrategy(value, format);
    if (strategy === 'gtin') return validateGtin(value, format);
    return validateLoose(value);
}
