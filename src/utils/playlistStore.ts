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

const writePlaylists = async (playlists: SavedPlaylist[]): Promise<void> => {
    await FileSystem.writeAsStringAsync(PLAYLISTS_PATH, JSON.stringify(playlists));
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
        await writePlaylists(next);
    } catch {
        // Best effort only.
    }
};

export const deletePlaylistById = async (playlistId: string): Promise<boolean> => {
    if (!playlistId) return false;
    try {
        const playlists = await getPlaylists();
        const next = playlists.filter((playlist) => playlist.id !== playlistId);
        if (next.length === playlists.length) return false;
        await writePlaylists(next);
        return true;
    } catch {
        return false;
    }
};

export const removeItemFromPlaylist = async (playlistId: string, itemId: string): Promise<SavedPlaylist | null> => {
    if (!playlistId || !itemId) return null;
    try {
        const playlists = await getPlaylists();
        const next = playlists.map((playlist) => {
            if (playlist.id !== playlistId) return playlist;
            return {
                ...playlist,
                items: playlist.items.filter((item) => item.id !== itemId),
            };
        });

        const updatedPlaylist = next.find((playlist) => playlist.id === playlistId) ?? null;
        const normalized = next.filter((playlist) => playlist.items.length > 0);
        await writePlaylists(normalized);
        return updatedPlaylist && updatedPlaylist.items.length > 0 ? updatedPlaylist : null;
    } catch {
        return null;
    }
};

