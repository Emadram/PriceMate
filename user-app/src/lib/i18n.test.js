import { describe, expect, it } from 'vitest';
import { resources } from './i18n';

describe('i18n resources', () => {
  it('keeps English and Turkish translation keys in sync', () => {
    const enKeys = Object.keys(resources.en.translation).sort();
    const trKeys = Object.keys(resources.tr.translation).sort();

    expect(trKeys).toEqual(enKeys);
  });
});
