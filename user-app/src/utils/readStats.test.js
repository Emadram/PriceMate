import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('readStats', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.stubEnv('VITE_READ_DEBUG', 'true');
    });

    it('increments list and get counters', async () => {
        const { recordListRead, recordGetRead, getReadStatsSnapshot, resetReadStats } =
            await import('./readStats');

        resetReadStats();
        recordListRead('products');
        recordListRead('products');
        recordGetRead('supermarkets');

        const snap = getReadStatsSnapshot();
        expect(snap.totalList).toBe(2);
        expect(snap.totalGet).toBe(1);
        expect(snap.total).toBe(3);
        expect(snap.byCollection.products).toEqual({ list: 2, get: 0 });
        expect(snap.byCollection.supermarkets).toEqual({ list: 0, get: 1 });
    });

    it('tracks scenario boundaries', async () => {
        const {
            startReadScenario,
            endReadScenario,
            recordListRead,
            resetReadStats,
        } = await import('./readStats');

        resetReadStats();
        startReadScenario('B1-favorite-toggle');
        recordListRead('favorites');
        const ended = endReadScenario();
        expect(ended.recentLog.some((row) => row.scenario === 'B1-favorite-toggle')).toBe(true);
    });
});
