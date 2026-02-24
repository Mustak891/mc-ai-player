import React, { useEffect, useRef } from 'react';
import { NavigationContainer, DefaultTheme, Theme, useNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { Linking } from 'react-native';

import BottomTabNavigator from './BottomTabNavigator';
import PlayerScreen from '../screens/PlayerScreen';
import { RootStackParamList } from './types';
import { useThemeContext } from '../context/ThemeContext';

const Stack = createStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
    initialState?: any;
}

const AppNavigator = ({ initialState }: AppNavigatorProps) => {
    const { colors, isDark } = useThemeContext();
    const navigationRef = useNavigationContainerRef<RootStackParamList>();

    useEffect(() => {
        // Catch intents fired while the app is already slumbering in the background
        const subscription = Linking.addEventListener('url', ({ url }: { url: string }) => {
            if (!url) return;
            if (url.startsWith('content://') || url.startsWith('file://')) {
                const fallbackTitle = decodeURIComponent(url.split('/').pop() || 'External Video').split('?')[0];
                if (navigationRef.isReady()) {
                    navigationRef.navigate('Player', { videoUri: url, title: fallbackTitle, subtitleCandidates: [] });
                }
            }
        });
        return () => subscription.remove();
    }, [navigationRef]);

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
        <NavigationContainer ref={navigationRef} theme={AppTheme} initialState={initialState}>
            <StatusBar style={isDark ? "light" : "dark"} />
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
                        presentation: 'modal',
                        gestureEnabled: false,
                    }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
