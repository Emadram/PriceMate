import { describe, it, expect } from 'vitest';
import { buildRouteKey, resolveCenter } from './storeMapUtils';

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

describe('storeMapUtils.buildRouteKey', () => {
  it('returns a stable rounded key for equivalent route coordinates', () => {
    const a = buildRouteKey(
      { latitude: 35.1234567, longitude: 33.7654321 },
      { latitude: 35.2234567, longitude: 33.8654321 }
    );
    const b = buildRouteKey(
      { latitude: 35.12345671, longitude: 33.76543209 },
      { latitude: 35.22345673, longitude: 33.86543208 }
    );
    expect(a).toBe(b);
  });

  it('returns an empty key when route coordinates are missing', () => {
    expect(buildRouteKey(null, { latitude: 35, longitude: 33 })).toBe('');
    expect(buildRouteKey({ latitude: 35, longitude: 33 }, null)).toBe('');
  });
});
