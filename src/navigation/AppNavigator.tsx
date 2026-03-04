import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainer, DefaultTheme, Theme, useNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { Linking, View } from 'react-native';

import BottomTabNavigator from './BottomTabNavigator';
import PlayerScreen from '../screens/PlayerScreen';
import TermsAndConditionsScreen from '../screens/TermsAndConditionsScreen';
import { RootStackParamList } from './types';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import { useThemeContext } from '../context/ThemeContext';

const Stack = createStackNavigator<RootStackParamList>();
const INTENT_DEDUP_WINDOW_MS = 1200;

const isExternalVideoUrl = (url?: string | null): url is string =>
    !!url && (url.startsWith('content://') || url.startsWith('file://'));

const toExternalPlayerParams = (url: string): RootStackParamList['Player'] => {
    const fallbackTitle = decodeURIComponent(url.split('/').pop() || 'External Video').split('?')[0];
    return { videoUri: url, title: fallbackTitle, subtitleCandidates: [] };
};

const AppNavigator = () => {
    const { colors, isDark } = useThemeContext();
    const navigationRef = useNavigationContainerRef<RootStackParamList>();
    const pendingIntentUrlRef = useRef<string | null>(null);
    const lastHandledIntentRef = useRef<{ url: string; at: number } | null>(null);
    const [isBootstrapped, setIsBootstrapped] = useState(false);
    const [initialExternalUrl, setInitialExternalUrl] = useState<string | null>(null);

    const isRapidDuplicateIntent = useCallback((url: string) => {
        const lastHandled = lastHandledIntentRef.current;
        if (!lastHandled) return false;
        return lastHandled.url === url && Date.now() - lastHandled.at < INTENT_DEDUP_WINDOW_MS;
    }, []);

    const navigateToExternalVideo = useCallback(
        (url: string) => {
            if (isRapidDuplicateIntent(url)) return;
            lastHandledIntentRef.current = { url, at: Date.now() };

            const params = toExternalPlayerParams(url);
            if (navigationRef.isReady()) {
                navigationRef.navigate('Player', params);
            } else {
                pendingIntentUrlRef.current = url;
            }
        },
        [isRapidDuplicateIntent, navigationRef]
    );

    useEffect(() => {
        let isMounted = true;
        void Linking.getInitialURL()
            .then((url) => {
                if (!isMounted) return;
                if (!isExternalVideoUrl(url)) {
                    setInitialExternalUrl(null);
                    return;
                }
                setInitialExternalUrl(url);
                // Mark initial launch URL as already handled to suppress immediate duplicate callbacks.
                lastHandledIntentRef.current = { url, at: Date.now() };
            })
            .catch((error) => {
                console.warn('Initial URL read failed:', error);
                if (isMounted) {
                    setInitialExternalUrl(null);
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsBootstrapped(true);
                }
            });

        const subscription = Linking.addEventListener('url', ({ url }: { url: string }) => {
            if (!isExternalVideoUrl(url)) return;
            navigateToExternalVideo(url);
        });

        return () => {
            isMounted = false;
            subscription.remove();
        };
    }, [navigateToExternalVideo]);

    const initialState = useMemo(() => {
        if (!initialExternalUrl) return undefined;
        return {
            index: 1,
            routes: [
                { name: 'Main' as const },
                { name: 'Player' as const, params: toExternalPlayerParams(initialExternalUrl) },
            ],
        };
    }, [initialExternalUrl]);

    if (!isBootstrapped) {
        return <View style={{ flex: 1, backgroundColor: colors.background }} />;
    }

    const AppTheme: Theme = {
        ...DefaultTheme,
        colors: {
            ...DefaultTheme.colors,
            background: colors.background,
            card: colors.surface,
            text: colors.text,
            border: colors.borderSubtle,
            primary: colors.primary,
        },
    };

    return (
        <NavigationContainer
            ref={navigationRef}
            theme={AppTheme}
            initialState={initialState as any}
            onReady={() => {
                const pendingUrl = pendingIntentUrlRef.current;
                if (!pendingUrl) return;
                pendingIntentUrlRef.current = null;
                navigateToExternalVideo(pendingUrl);
            }}
        >
            <StatusBar style={isDark ? "light" : "dark"} translucent={true} backgroundColor="transparent" />
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    cardStyle: { backgroundColor: colors.background },
                }}
            >
                <Stack.Screen name="Main" component={BottomTabNavigator} />
                <Stack.Screen
                    name="Player"
                    component={PlayerScreen}
                    options={{
                        presentation: 'card',
                        gestureEnabled: false,
                        detachPreviousScreen: false,
                        cardStyle: { backgroundColor: '#000' },
                        animation: 'none',
                        cardStyleInterpolator: CardStyleInterpolators.forNoAnimation,
                    }}
                />
                <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
                <Stack.Screen name="TermsAndConditions" component={TermsAndConditionsScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
