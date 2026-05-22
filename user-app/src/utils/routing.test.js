import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRoute } from './routing';

const sampleOsrmResponse = {
  code: 'Ok',
  routes: [
    {
      distance: 1200,
      duration: 300,
      geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] },
      legs: [
        {
          steps: [
            { distance: 400, duration: 80, maneuver: { instruction: 'Head north', type: 'straight' }, name: 'Street 1' },
            { distance: 800, duration: 220, maneuver: { instruction: 'Turn right', type: 'turn' }, name: 'Street 2' }
          ]
        }
      ]
    }
  ]
};

describe('routing.fetchRoute', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(sampleOsrmResponse) }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses geojson and steps from OSRM', async () => {
    const r = await fetchRoute(0,0,1,1);
    expect(r).toHaveProperty('geojson');
    expect(r).toHaveProperty('distance', 1200);
    expect(r).toHaveProperty('duration', 300);
    expect(Array.isArray(r.steps)).toBeTruthy();
    expect(r.steps.length).toBe(2);
    expect(r.steps[0].maneuver.instruction).toBe('Head north');
  });
});
