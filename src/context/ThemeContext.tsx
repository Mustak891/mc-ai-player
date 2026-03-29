import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { Appearance, ColorSchemeName, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT_COLORS, DARK_COLORS } from '../constants/theme';

type ThemeColors = typeof DARK_COLORS;
export type ThemePreference = 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
    isDark: boolean;
    colors: ThemeColors;
    themePreference: ThemePreference;
    resolvedTheme: ResolvedTheme;
    systemTheme: ResolvedTheme;
    isSystemThemeSelected: boolean;
    isThemeReady: boolean;
    setThemePreference: (preference: ThemePreference) => void;
}

const THEME_STORAGE_KEY = '@mcai_theme_preference';

const normalizeColorScheme = (scheme: ColorSchemeName): ResolvedTheme =>
    scheme === 'dark' ? 'dark' : 'light';

const ThemeContext = createContext<ThemeContextType>({
    isDark: true,
    colors: DARK_COLORS,
    themePreference: 'system',
    resolvedTheme: 'dark',
    systemTheme: 'dark',
    isSystemThemeSelected: true,
    isThemeReady: false,
    setThemePreference: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();

    useEffect(() => {
        // Manual theme overrides were removed, so always hand control back to the OS.
        Appearance.setColorScheme(null);
        AsyncStorage.removeItem(THEME_STORAGE_KEY).catch(() => {});
    }, []);

    const setThemePreference = useCallback((_preference: ThemePreference) => {
        Appearance.setColorScheme(null);
        AsyncStorage.removeItem(THEME_STORAGE_KEY).catch(() => {});
    }, []);

    const systemTheme = normalizeColorScheme(systemColorScheme);
    const themePreference: ThemePreference = 'system';
    const resolvedTheme = systemTheme;
    const isDark = resolvedTheme === 'dark';
    const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

    const value = useMemo(
        () => ({
            isDark,
            colors,
            themePreference,
            resolvedTheme,
            systemTheme,
            isSystemThemeSelected: true,
            isThemeReady: true,
            setThemePreference,
        }),
        [colors, isDark, resolvedTheme, setThemePreference, systemTheme]
    );

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useThemeContext = () => useContext(ThemeContext);
