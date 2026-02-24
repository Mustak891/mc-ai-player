import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOKMARKS_PREFIX = 'bookmarks_';

export const saveBookmarks = async (videoUri: string, bookmarks: number[]): Promise<void> => {
    try {
        const key = `${BOOKMARKS_PREFIX}${videoUri}`;
        await AsyncStorage.setItem(key, JSON.stringify(bookmarks));
    } catch (e) {
        console.warn('Failed to save bookmarks', e);
    }
};

export const loadBookmarks = async (videoUri: string): Promise<number[]> => {
    try {
        const key = `${BOOKMARKS_PREFIX}${videoUri}`;
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
            return JSON.parse(stored) as number[];
        }
    } catch (e) {
        console.warn('Failed to load bookmarks', e);
    }
    return [];
};
