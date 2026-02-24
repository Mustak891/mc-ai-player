import * as FileSystem from 'expo-file-system/legacy';

const PLAYBACK_PREFS_STORE_PATH = `${FileSystem.documentDirectory}playback-prefs.json`;

export type PlaybackPrefs = {
    audioTrackLabel?: string;
    audioDisabled?: boolean;
    subtitleEnabled?: boolean;
    subtitleTrackId?: string;
    subtitleTrackLabel?: string;
    subtitleSyncMs?: number;
};

type PlaybackPrefsStore = Record<string, PlaybackPrefs>;

const readRawStore = async (): Promise<PlaybackPrefsStore> => {
    try {
        const info = await FileSystem.getInfoAsync(PLAYBACK_PREFS_STORE_PATH);
        if (!info.exists) return {};
        const raw = await FileSystem.readAsStringAsync(PLAYBACK_PREFS_STORE_PATH);
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return parsed as PlaybackPrefsStore;
        }
        return {};
    } catch {
        return {};
    }
};

export const loadPlaybackPrefs = async (uri: string): Promise<PlaybackPrefs | null> => {
    const store = await readRawStore();
    const prefs = store[uri];
    if (!prefs || typeof prefs !== 'object') return null;
    return prefs;
};

export const savePlaybackPrefs = async (uri: string, prefs: PlaybackPrefs): Promise<void> => {
    try {
        const store = await readRawStore();
        store[uri] = prefs;
        await FileSystem.writeAsStringAsync(PLAYBACK_PREFS_STORE_PATH, JSON.stringify(store));
    } catch {
        // Best effort only.
    }
};

