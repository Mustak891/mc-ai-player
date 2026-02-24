import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ViewMode = 'grid' | 'list';
export type SortBy = 'name' | 'length' | 'date' | 'tracks';
export type SortOrder = 'asc' | 'desc';
export type GroupBy = 'none' | 'name' | 'folder' | 'date';

interface SettingsState {
    viewMode: ViewMode;
    sortBy: SortBy;
    sortOrder: SortOrder;
    groupBy: GroupBy;
    showFavoritesOnly: boolean;
    isIncognito: boolean;
    setViewMode: (mode: ViewMode) => void;
    setSortBy: (sortBy: SortBy) => void;
    setSortOrder: (order: SortOrder) => void;
    setGroupBy: (groupBy: GroupBy) => void;
    setShowFavoritesOnly: (show: boolean) => void;
    setIsIncognito: (isIncognito: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            viewMode: 'grid',
            sortBy: 'date',
            sortOrder: 'desc',
            groupBy: 'none',
            showFavoritesOnly: false,
            // Incognito mode is intentionally NOT persisted to disk in the long run,
            // but including it in user settings is acceptable. If we want it to reset on cold start,
            // we could omit it from the persist block or just overwrite it on load, but for now we leave it simple.
            isIncognito: false,

            setViewMode: (mode) => set({ viewMode: mode }),
            setSortBy: (sortBy) => set({ sortBy }),
            setSortOrder: (sortOrder) => set({ sortOrder }),
            setGroupBy: (groupBy) => set({ groupBy }),
            setShowFavoritesOnly: (show) => set({ showFavoritesOnly: show }),
            setIsIncognito: (isIncognito) => set({ isIncognito }),
        }),
        {
            name: 'mc-ai-player-settings',
            storage: createJSONStorage(() => AsyncStorage),
            // Do not persist incognito mode across cold app restarts
            partialize: (state) => ({
                viewMode: state.viewMode,
                sortBy: state.sortBy,
                sortOrder: state.sortOrder,
                groupBy: state.groupBy,
                showFavoritesOnly: state.showFavoritesOnly,
            } as any),
        }
    )
);
