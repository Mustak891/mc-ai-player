import React from 'react';
import 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, useColorScheme, Linking } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/context/ThemeContext';
import { LIGHT_COLORS, DARK_COLORS } from './src/constants/theme';

import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources natively
SplashScreen.preventAutoHideAsync();

export default function App() {
  const colorScheme = useColorScheme();
  const themeBg = colorScheme === 'dark' ? DARK_COLORS.background : LIGHT_COLORS.background;

  const [appIsReady, setAppIsReady] = React.useState(false);
  const [initialState, setInitialState] = React.useState<any>();

  React.useEffect(() => {
    // Force the root native window background to match the app's dynamic theme
    SystemUI.setBackgroundColorAsync(themeBg);
  }, [themeBg]);

  React.useEffect(() => {
    async function prepare() {
      try {
        const url = await Linking.getInitialURL();
        if (url && (url.startsWith('content://') || url.startsWith('file://'))) {
          const fallbackTitle = decodeURIComponent(url.split('/').pop() || 'External Video').split('?')[0];
          setInitialState({
            index: 0,
            routes: [
              {
                name: 'Player',
                params: { videoUri: url, title: fallbackTitle, subtitleCandidates: [] }
              }
            ]
          });
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  const onLayoutRootView = React.useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <ThemeProvider>
      <View style={{ flex: 1, backgroundColor: themeBg }} onLayout={onLayoutRootView}>
        <SafeAreaProvider>
          <AppNavigator initialState={initialState} />
        </SafeAreaProvider>
      </View>
    </ThemeProvider>
  );
}
