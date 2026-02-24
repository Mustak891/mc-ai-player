import * as FileSystem from 'expo-file-system/legacy';

import { DEFAULT_PLAYER_CONTROL_SETTINGS, PlayerControlSettings } from '../types/playerSettings';

const SETTINGS_PATH = `${FileSystem.documentDirectory}player-control-settings.json`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const sanitize = (partial: Partial<PlayerControlSettings>): PlayerControlSettings => {
    const merged: PlayerControlSettings = {
        ...DEFAULT_PLAYER_CONTROL_SETTINGS,
        ...partial,
    };

    merged.controlsHideDelayMs = clamp(Math.floor(merged.controlsHideDelayMs || 0), 1000, 10000);
    merged.seekStepSeconds = clamp(Math.floor(merged.seekStepSeconds || 0), 1, 30);
    merged.longPressSeekStepSeconds = clamp(Math.floor(merged.longPressSeekStepSeconds || 0), 5, 120);
    merged.fastPlaySpeed = clamp(merged.fastPlaySpeed || 2, 1.25, 4);
    return merged;
};

export const loadPlayerControlSettings = async (): Promise<PlayerControlSettings> => {
    try {
        const info = await FileSystem.getInfoAsync(SETTINGS_PATH);
        if (!info.exists) return DEFAULT_PLAYER_CONTROL_SETTINGS;
        const raw = await FileSystem.readAsStringAsync(SETTINGS_PATH);
        const parsed = JSON.parse(raw) as Partial<PlayerControlSettings>;
        if (!parsed || typeof parsed !== 'object') return DEFAULT_PLAYER_CONTROL_SETTINGS;
        return sanitize(parsed);
    } catch {
        return DEFAULT_PLAYER_CONTROL_SETTINGS;
    }
};

export const savePlayerControlSettings = async (settings: PlayerControlSettings): Promise<void> => {
    try {
        const sanitized = sanitize(settings);
        await FileSystem.writeAsStringAsync(SETTINGS_PATH, JSON.stringify(sanitized));
    } catch {
        // Best effort only.
    }
};

