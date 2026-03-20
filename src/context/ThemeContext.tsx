import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ColorSchemeName, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT_COLORS, DARK_COLORS } from '../constants/theme';

type ThemeColors = typeof DARK_COLORS;
export type ThemePreference = 'light' | 'dark' | 'system';
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
    const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
    const [isThemeReady, setIsThemeReady] = useState(false);

    useEffect(() => {
        let isMounted = true;

        AsyncStorage.getItem(THEME_STORAGE_KEY)
            .then((saved) => {
                if (!isMounted) return;
                if (saved === 'light' || saved === 'dark' || saved === 'system') {
                    setThemePreferenceState(saved);
                }
            })
            .catch(() => {})
            .finally(() => {
                if (isMounted) {
                    setIsThemeReady(true);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const setThemePreference = useCallback((preference: ThemePreference) => {
        setThemePreferenceState(preference);
        AsyncStorage.setItem(THEME_STORAGE_KEY, preference).catch(() => {});
    }, []);

    const systemTheme = normalizeColorScheme(systemColorScheme);
    const resolvedTheme = themePreference === 'system' ? systemTheme : themePreference;
    const isDark = resolvedTheme === 'dark';
    const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

    const value = useMemo(
        () => ({
            isDark,
            colors,
            themePreference,
            resolvedTheme,
            systemTheme,
            isSystemThemeSelected: themePreference === 'system',
            isThemeReady,
            setThemePreference,
        }),
        [colors, isDark, isThemeReady, resolvedTheme, setThemePreference, systemTheme, themePreference]
    );

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useThemeContext = () => useContext(ThemeContext);
