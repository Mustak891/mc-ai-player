import * as FileSystem from 'expo-file-system/legacy';

import {
    DEFAULT_EQUALIZER_SETTINGS,
    EQUALIZER_FREQUENCIES,
    EqualizerPresetId,
    EqualizerProfile,
    EqualizerSettings,
} from '../types/playerSettings';

const EQUALIZER_PATH = `${FileSystem.documentDirectory}equalizer-settings.json`;
const DB_MIN = -20;
const DB_MAX = 20;

const clampDb = (value: number) => Math.min(DB_MAX, Math.max(DB_MIN, value));

export const EQUALIZER_PRESETS: Record<Exclude<EqualizerPresetId, 'custom'>, number[]> = {
    flat: new Array(EQUALIZER_FREQUENCIES.length).fill(0),
    bass_boost: [8, 6, 4, 2, 1, 0, -1, -2, -3, -4],
    treble_boost: [-4, -3, -2, -1, 0, 1, 2, 4, 6, 8],
    vocal: [-2, -1, 1, 3, 4, 4, 2, 1, 0, -1],
};

const sanitizeBands = (bands: number[] | undefined): number[] => {
    const next = new Array(EQUALIZER_FREQUENCIES.length).fill(0);
    if (!Array.isArray(bands)) return next;
    for (let i = 0; i < next.length; i += 1) {
        next[i] = clampDb(Number.isFinite(bands[i]) ? bands[i] : 0);
    }
    return next;
};

const sanitizeProfiles = (profiles: unknown): EqualizerProfile[] => {
    if (!Array.isArray(profiles)) return [];
    return profiles
        .filter((item) => item && typeof item === 'object')
        .map((item: any) => ({
            id: String(item.id || `${Date.now()}-${Math.random()}`),
            name: String(item.name || 'Custom'),
            preampDb: clampDb(Number(item.preampDb) || 0),
            bandsDb: sanitizeBands(item.bandsDb),
        }));
};

const sanitizeSettings = (value: Partial<EqualizerSettings>): EqualizerSettings => {
    const presetId = value.presetId || 'flat';
    return {
        enabled: !!value.enabled,
        presetId: ['flat', 'bass_boost', 'treble_boost', 'vocal', 'custom'].includes(presetId) ? presetId : 'flat',
        preampDb: clampDb(Number(value.preampDb) || 0),
        bandsDb: sanitizeBands(value.bandsDb),
        snapBands: value.snapBands !== false,
        customProfiles: sanitizeProfiles(value.customProfiles),
        selectedCustomProfileId: value.selectedCustomProfileId ? String(value.selectedCustomProfileId) : null,
    };
};

export const loadEqualizerSettings = async (): Promise<EqualizerSettings> => {
    try {
        const info = await FileSystem.getInfoAsync(EQUALIZER_PATH);
        if (!info.exists) return DEFAULT_EQUALIZER_SETTINGS;
        const raw = await FileSystem.readAsStringAsync(EQUALIZER_PATH);
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return DEFAULT_EQUALIZER_SETTINGS;
        return sanitizeSettings(parsed);
    } catch {
        return DEFAULT_EQUALIZER_SETTINGS;
    }
};

export const saveEqualizerSettings = async (settings: EqualizerSettings): Promise<void> => {
    try {
        await FileSystem.writeAsStringAsync(EQUALIZER_PATH, JSON.stringify(sanitizeSettings(settings)));
    } catch {
        // Best effort only.
    }
};

export const applyEqualizerPreset = (settings: EqualizerSettings, presetId: Exclude<EqualizerPresetId, 'custom'>): EqualizerSettings => {
    return {
        ...settings,
        presetId,
        bandsDb: [...EQUALIZER_PRESETS[presetId]],
        selectedCustomProfileId: null,
    };
};

