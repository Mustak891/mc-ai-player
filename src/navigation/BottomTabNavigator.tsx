import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';

import VideoLibraryScreen from '../screens/VideoLibraryScreen';
import AudioScreen from '../screens/AudioScreen';
import BrowseScreen from '../screens/BrowseScreen';
import PlaylistsScreen from '../screens/PlaylistsScreen';
import MoreScreen from '../screens/MoreScreen';
import { BottomTabParamList } from './types';

const Tab = createBottomTabNavigator<BottomTabParamList>();

type TabRoute = { name: string };
type IconProps = { focused: boolean; color: string; size: number; route: TabRoute; colors: any };

const TAB_CONFIG: Record<string, { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap; label: string }> = {
    VideoLibrary: { outline: 'videocam-outline', filled: 'videocam', label: 'Video' },
    Audio: { outline: 'musical-notes-outline', filled: 'musical-notes', label: 'Audio' },
    Browse: { outline: 'folder-outline', filled: 'folder-open', label: 'Browse' },
    Playlists: { outline: 'list-outline', filled: 'list', label: 'Playlists' },
    More: { outline: 'ellipsis-horizontal-outline', filled: 'ellipsis-horizontal', label: 'More' },
};

const TabIcon = ({ focused, color, size, route, colors }: IconProps) => {
    const cfg = TAB_CONFIG[route.name];
    const iconName = cfg ? (focused ? cfg.filled : cfg.outline) : 'ellipsis-horizontal-outline';
    const insets = initialWindowMetrics?.insets ?? useSafeAreaInsets();
    const styles = useStyles(colors, insets);

    return (
        <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
            <Ionicons name={iconName} size={size - 2} color={color} />
        </View>
    );
};

const BottomTabNavigator = () => {
    const { colors } = useThemeContext();
    const insets = initialWindowMetrics?.insets ?? useSafeAreaInsets();
    const styles = useStyles(colors, insets);

    return (
        <Tab.Navigator
            detachInactiveScreens={true}
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => (
                    <TabIcon focused={focused} color={color} size={size} route={route} colors={colors} />
                ),
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '600',
                    letterSpacing: 0.3,
                    marginBottom: Platform.OS === 'android' ? 2 : 0,
                },
                tabBarStyle: styles.tabBar,
                tabBarItemStyle: styles.tabBarItem,
                headerStyle: styles.header,
                headerTintColor: colors.text,
                freezeOnBlur: true,
                headerTitleStyle: {
                    fontWeight: '700',
                    fontSize: 17,
                    letterSpacing: -0.2,
                },
                headerShadowVisible: false,
            })}
        >
            <Tab.Screen name="VideoLibrary" component={VideoLibraryScreen} options={{ title: 'Video' }} />
            <Tab.Screen name="Audio" component={AudioScreen} />
            <Tab.Screen name="Browse" component={BrowseScreen} />
            <Tab.Screen name="Playlists" component={PlaylistsScreen} />
            <Tab.Screen name="More" component={MoreScreen} />
        </Tab.Navigator>
    );
};

const useStyles = (colors: any, insets: any) => StyleSheet.create({
    tabBar: {
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.borderSubtle,
        height: (Platform.OS === 'android' ? 62 : 64) + insets.bottom,
        paddingTop: 6,
        paddingBottom: (Platform.OS === 'android' ? 10 : 8) + insets.bottom,
        elevation: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
    },
    tabBarItem: {
        paddingTop: 2,
    },
    iconWrapper: {
        width: 40,
        height: 32,
        borderRadius: RADIUS.m,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconWrapperActive: {
        backgroundColor: colors.primarySubtle,
    },
    header: {
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        elevation: 0,
        shadowOpacity: 0,
    },
});

export default BottomTabNavigator;
