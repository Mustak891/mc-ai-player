import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT_COLORS, DARK_COLORS } from '../constants/theme';

type ThemeColors = typeof DARK_COLORS;
export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextType {
    isDark: boolean;
    colors: ThemeColors;
    themePreference: ThemePreference;
    setThemePreference: (preference: ThemePreference) => void;
}

const THEME_STORAGE_KEY = '@mcai_theme_preference';

const ThemeContext = createContext<ThemeContextType>({
    isDark: true,
    colors: DARK_COLORS,
    themePreference: 'system',
    setThemePreference: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');

    // Load saved preference on mount
    useEffect(() => {
        AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
            if (saved === 'light' || saved === 'dark' || saved === 'system') {
                setThemePreferenceState(saved);
            }
        }).catch(() => {});
    }, []);

    const setThemePreference = useCallback((preference: ThemePreference) => {
        setThemePreferenceState(preference);
        AsyncStorage.setItem(THEME_STORAGE_KEY, preference).catch(() => {});
    }, []);

    const isDark =
        themePreference === 'dark' ||
        (themePreference === 'system' && systemColorScheme === 'dark');

    const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

    return (
        <ThemeContext.Provider value={{ isDark, colors, themePreference, setThemePreference }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useThemeContext = () => useContext(ThemeContext);
