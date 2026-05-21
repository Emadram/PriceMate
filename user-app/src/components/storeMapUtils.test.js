import { describe, it, expect } from 'vitest';
import { resolveCenter } from './storeMapUtils';

describe('storeMapUtils.resolveCenter', () => {
  it('prefers centerProp when valid', () => {
    const out = resolveCenter({ centerProp: [41, 29], lat: null, lon: null, supermarkets: [] });
    expect(out).toEqual({ latitude: 41, longitude: 29 });
  });

  it('uses lat/lon when provided', () => {
    const out = resolveCenter({ lat: 40, lon: 28, centerProp: null, supermarkets: [] });
    expect(out).toEqual({ latitude: 40, longitude: 28 });
  });

  it('returns single supermarket coords when only one valid', () => {
    const out = resolveCenter({ lat: null, lon: null, supermarkets: [{ latitude: 10, longitude: 20 }] });
    expect(out).toEqual({ latitude: 10, longitude: 20 });
  });

  it('averages multiple supermarkets', () => {
    const out = resolveCenter({ supermarkets: [{ latitude: 10, longitude: 20 }, { latitude: 12, longitude: 22 }] });
    expect(out.latitude).toBeCloseTo(11);
    expect(out.longitude).toBeCloseTo(21);
  });

  it('returns null when no valid coordinates', () => {
    const out = resolveCenter({ lat: null, lon: null, supermarkets: [] });
    expect(out).toBeNull();
  });
});
