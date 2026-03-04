import React from 'react';
import 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/context/ThemeContext';
import { LIGHT_COLORS, DARK_COLORS } from './src/constants/theme';

import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const colorScheme = useColorScheme();
  const themeBg = colorScheme === 'dark' ? DARK_COLORS.background : LIGHT_COLORS.background;

  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  React.useEffect(() => {
    async function prepare() {
      try {
        // Force the root native window background to match the app's dynamic theme
        await SystemUI.setBackgroundColorAsync(themeBg);
      } catch (e) {
        console.warn(e);
      } finally {
        if (fontsLoaded) {
          // App is ready! Tell Expo to drop the logo and show the UI
          await SplashScreen.hideAsync();
        }
      }
    }

    prepare();
  }, [themeBg, fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <View style={{ flex: 1, backgroundColor: themeBg }}>
        <SafeAreaProvider>
          <AppNavigator />
        </SafeAreaProvider>
      </View>
    </ThemeProvider>
  );
}
