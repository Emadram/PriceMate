/**
 * Dev-only Appwrite read counter for mobile read verification.
 * Enable with VITE_READ_DEBUG=true; inspect via window.__priceMateReadStats.
 */

const READ_DEBUG = import.meta.env.VITE_READ_DEBUG === 'true';

const state = {
    totalList: 0,
    totalGet: 0,
    byCollection: {},
    scenario: null,
    scenarioStartedAt: null,
    log: [],
};

const MAX_LOG = 200;

function bump(collectionId, kind) {
    if (!READ_DEBUG) return;
    const key = String(collectionId || 'unknown');
    if (!state.byCollection[key]) {
        state.byCollection[key] = { list: 0, get: 0 };
    }
    state.byCollection[key][kind] += 1;
    if (kind === 'list') state.totalList += 1;
    else state.totalGet += 1;

    state.log.push({
        at: Date.now(),
        collection: key,
        kind,
        scenario: state.scenario,
    });
    if (state.log.length > MAX_LOG) {
        state.log.shift();
    }

    console.debug('[Appwrite reads]', kind, key, state.scenario ? `(scenario: ${state.scenario})` : '');
}

export function recordListRead(collectionId) {
    if (import.meta.env.DEV && !READ_DEBUG) {
        console.debug('[Appwrite reads]', collectionId);
    }
    bump(collectionId, 'list');
}

export function recordGetRead(collectionId) {
    bump(collectionId, 'get');
}

export function startReadScenario(name) {
    if (!READ_DEBUG) return getReadStatsSnapshot();
    state.scenario = String(name || 'unnamed');
    state.scenarioStartedAt = Date.now();
    console.info('[read-stats] scenario start:', state.scenario);
    return getReadStatsSnapshot();
}

export function endReadScenario() {
    if (!READ_DEBUG) return getReadStatsSnapshot();
    const snapshot = getReadStatsSnapshot();
    console.info('[read-stats] scenario end:', state.scenario, snapshot);
    state.scenario = null;
    state.scenarioStartedAt = null;
    return snapshot;
}

export function resetReadStats() {
    state.totalList = 0;
    state.totalGet = 0;
    state.byCollection = {};
    state.scenario = null;
    state.scenarioStartedAt = null;
    state.log = [];
    if (READ_DEBUG) {
        console.info('[read-stats] reset');
    }
    return getReadStatsSnapshot();
}

export function getReadStatsSnapshot() {
    return {
        totalList: state.totalList,
        totalGet: state.totalGet,
        total: state.totalList + state.totalGet,
        byCollection: { ...state.byCollection },
        scenario: state.scenario,
        scenarioStartedAt: state.scenarioStartedAt,
        recentLog: state.log.slice(-20),
    };
}

export function isReadDebugEnabled() {
    return READ_DEBUG;
}

if (typeof window !== 'undefined' && READ_DEBUG) {
    window.__priceMateReadStats = {
        get: getReadStatsSnapshot,
        reset: resetReadStats,
        startScenario: startReadScenario,
        endScenario: endReadScenario,
    };
}
