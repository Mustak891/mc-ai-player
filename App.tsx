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
    // Under edgeToEdgeEnabled: true, the system natively handles backgrounds 
    // and explicitly blocks manual SystemUI/NavigationBar color setters.
    // Instead, we just let the React Native View background handle the styling!
    NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark').catch((error) => {
      console.warn(error);
    });
  }, [isDark]);

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
