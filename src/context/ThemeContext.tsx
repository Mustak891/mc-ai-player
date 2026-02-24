import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { LIGHT_COLORS, DARK_COLORS } from '../constants/theme';

type ThemeColors = typeof DARK_COLORS;

interface ThemeContextType {
    isDark: boolean;
    colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
    isDark: true,
    colors: DARK_COLORS,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const isDark = systemColorScheme === 'dark';

    const [colors, setColors] = useState<ThemeColors>(isDark ? DARK_COLORS : LIGHT_COLORS);

    useEffect(() => {
        setColors(systemColorScheme === 'dark' ? DARK_COLORS : LIGHT_COLORS);
    }, [systemColorScheme]);

    return (
        <ThemeContext.Provider value={{ isDark, colors }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useThemeContext = () => useContext(ThemeContext);
