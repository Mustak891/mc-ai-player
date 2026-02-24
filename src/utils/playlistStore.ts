import * as FileSystem from 'expo-file-system/legacy';

const PLAYLISTS_PATH = `${FileSystem.documentDirectory}saved-playlists.json`;

export type SavedPlaylist = {
    id: string;
    name: string;
    createdAt: number;
    items: Array<{ id: string; title: string; uri: string }>;
};

export const getPlaylists = async (): Promise<SavedPlaylist[]> => {
    try {
        const info = await FileSystem.getInfoAsync(PLAYLISTS_PATH);
        if (!info.exists) return [];
        const raw = await FileSystem.readAsStringAsync(PLAYLISTS_PATH);
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed as SavedPlaylist[];
    } catch {
        return [];
    }
};

export const savePlaylistSnapshot = async (
    name: string,
    items: Array<{ id: string; title: string; uri: string }>
): Promise<void> => {
    try {
        const prev = await getPlaylists();
        const next: SavedPlaylist[] = [
            {
                id: `playlist-${Date.now()}`,
                name,
                createdAt: Date.now(),
                items,
            },
            ...prev,
        ];
        await FileSystem.writeAsStringAsync(PLAYLISTS_PATH, JSON.stringify(next));
    } catch {
        // Best effort only.
    }
};

