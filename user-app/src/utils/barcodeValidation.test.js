import { describe, it, expect } from 'vitest';
import {
    isValidGtinCheckDigit,
    normalizeToGtin13,
    validateScannedBarcode,
    ZXING_FORMAT,
} from './barcodeValidation';

describe('barcodeValidation', () => {
    it('accepts a valid EAN-13', () => {
        expect(isValidGtinCheckDigit('5449000000996')).toBe(true);
        expect(validateScannedBarcode('5449000000996', ZXING_FORMAT.EAN_13)).toEqual({ ok: true });
    });

    it('rejects EAN-13 with invalid checksum', () => {
        expect(validateScannedBarcode('5449000000995', ZXING_FORMAT.EAN_13)).toEqual({
            ok: false,
            reason: 'invalid_checksum',
        });
    });

    it('normalizes UPC-A and EAN-8 to GTIN-13', () => {
        expect(normalizeToGtin13('544900000099', ZXING_FORMAT.UPC_A)).toBe('0544900000099');
        expect(normalizeToGtin13('12345670', ZXING_FORMAT.EAN_8)).toBe('0000012345670');
    });

    it('accepts loose Code 128 values', () => {
        expect(validateScannedBarcode('ABC-12345', ZXING_FORMAT.CODE_128)).toEqual({ ok: true });
    });

    it('rejects empty, too short, and non-printable values', () => {
        expect(validateScannedBarcode('')).toEqual({ ok: false, reason: 'empty' });
        expect(validateScannedBarcode('123', ZXING_FORMAT.CODE_128)).toEqual({
            ok: false,
            reason: 'invalid_format',
        });
        expect(validateScannedBarcode('bad\x07code', ZXING_FORMAT.CODE_128)).toEqual({
            ok: false,
            reason: 'invalid_format',
        });
    });

    it('infers GTIN validation from numeric length when format is omitted', () => {
        expect(validateScannedBarcode('5449000000996')).toEqual({ ok: true });
        expect(validateScannedBarcode('1234567890')).toEqual({ ok: false, reason: 'invalid_format' });
    });
});
