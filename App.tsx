import React from 'react';
import 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import * as NavigationBar from 'expo-navigation-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useThemeContext } from './src/context/ThemeContext';

import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const ThemedAppShell: React.FC<{ fontsLoaded: boolean }> = ({ fontsLoaded }) => {
  const { colors, isThemeReady, isDark } = useThemeContext();

  React.useEffect(() => {
    // Update the app background (splash area behind the React Native view)
    SystemUI.setBackgroundColorAsync(colors.background).catch((error) => {
      console.warn(error);
    });
    // Update the Android system navigation bar (Back/Home/Recents button bar)
    NavigationBar.setBackgroundColorAsync(colors.surface).catch((error) => {
      console.warn(error);
    });
    NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark').catch((error) => {
      console.warn(error);
    });
  }, [colors.background, colors.surface, isDark]);

  React.useEffect(() => {
    if (!fontsLoaded || !isThemeReady) return;

    SplashScreen.hideAsync().catch((error) => {
      console.warn(error);
    });
  }, [fontsLoaded, isThemeReady]);

  if (!fontsLoaded || !isThemeReady) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </View>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  return (
    <ThemeProvider>
      <ThemedAppShell fontsLoaded={fontsLoaded} />
    </ThemeProvider>
  );
}
