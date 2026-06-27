import { DateTime } from 'luxon';

const SNAP_CACHE_KEY = 'sw_snapshot_v4';
const SNAP_PREFS_KEY = 'sw_snapshot_prefs';

export interface SnapshotCachePayload<TPlanet = unknown, TEvent = unknown, TMoonPhase = unknown> {
    planets: TPlanet[];
    weekEvents: TEvent[];
    moonPhase: TMoonPhase;
}

export function loadSnapshotCache<TPlanet = unknown, TEvent = unknown, TMoonPhase = unknown>(queryKey: string): SnapshotCachePayload<TPlanet, TEvent, TMoonPhase> | null {
    try {
        const raw = localStorage.getItem(SNAP_CACHE_KEY);
        if (!raw) {
            return null;
        }
        const cache = JSON.parse(raw);
        if (cache.queryKey !== queryKey) {
            return null;
        }
        if (!cache.cachedAt || DateTime.fromISO(cache.cachedAt).diffNow('hours').hours < -6) {
            return null;
        }
        return cache.data;
    } catch {
        return null;
    }
}

export function saveSnapshotCache<TPlanet = unknown, TEvent = unknown, TMoonPhase = unknown>(
    queryKey: string,
    planets: TPlanet[],
    weekEvents: TEvent[],
    moonPhase: TMoonPhase,
): void {
    try {
        localStorage.setItem(
            SNAP_CACHE_KEY,
            JSON.stringify({
                queryKey,
                cachedAt: DateTime.now().toISO(),
                data: { planets, weekEvents, moonPhase },
            }),
        );
    } catch {
    }
}

export function loadSnapshotPrefs<TPrefs extends Record<string, unknown> = Record<string, unknown>>(): TPrefs {
    try {
        const raw = localStorage.getItem(SNAP_PREFS_KEY);
        return raw ? JSON.parse(raw) : {} as TPrefs;
    } catch {
        return {} as TPrefs;
    }
}

export function saveSnapshotPrefs(prefs: Record<string, unknown>): void {
    try {
        localStorage.setItem(SNAP_PREFS_KEY, JSON.stringify(prefs));
    } catch {
    }
}
