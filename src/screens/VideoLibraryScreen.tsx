import React, { useCallback, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    TextInput,
    Keyboard,
} from 'react-native';
import { useFocusEffect, useNavigation, useIsFocused } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';

import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';
import { useVideoLibrary } from '../hooks/useVideoLibrary';
import VideoCard from '../components/VideoCard';
import DisplaySettingsModal from '../components/DisplaySettingsModal';
import { RootStackParamList } from '../navigation/types';
import { readResumeStore } from '../utils/resumeStore';
import { useSettingsStore } from '../store/settingsStore';

const VideoLibraryScreen = () => {
    const { colors } = useThemeContext();
    const insets = useSafeAreaInsets();
    const styles = useStyles(colors, insets);

    const { viewMode, sortBy, sortOrder, isIncognito, setIsIncognito } = useSettingsStore();
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const [resumeMap, setResumeMap] = useState<Record<string, number>>({});

    // Header UI State
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [lastPlayedUri, setLastPlayedUri] = useState<string | null>(null);
    const [lastPlayedTitle, setLastPlayedTitle] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);

    // Defer heavy disk scanning until this screen is explicitly brought to the foreground
    const isFocused = useIsFocused();
    const [hasFocused, setHasFocused] = useState(false);

    useEffect(() => {
        if (isFocused && !hasFocused) {
            setHasFocused(true);
        }
    }, [isFocused, hasFocused]);

    const { videos, isLoading, refetch } = useVideoLibrary(!hasFocused);

    const handleVideoPress = (video: MediaLibrary.Asset | { uri: string, filename: string }) => {
        navigation.navigate('Player', { videoUri: video.uri, title: video.filename });
    };

    useFocusEffect(
        useCallback(() => {
            let active = true;
            void (async () => {
                const store = await readResumeStore();
                if (active) {
                    setResumeMap(store);

                    // Determine Last Played video (highest timestamp or basically anything recorded)
                    // For a true "last played timeline", we'd need a separate timestamp store,
                    // but we can grab one from the resumeMap keys. In a robust app, you'd store date modified.
                    // For now, let's just show an icon if *any* resume state exists.
                    const uris = Object.keys(store);
                    if (uris.length > 0) {
                        const mostRecentUri = uris[uris.length - 1]; // Naive pick
                        setLastPlayedUri(mostRecentUri);
                        const matchedVideo = videos.find(v => v.uri === mostRecentUri);
                        setLastPlayedTitle(matchedVideo?.filename || 'Last Video');
                    } else {
                        setLastPlayedUri(null);
                    }
                }
            })();
            return () => { active = false; };
        }, [])
    );

    const filteredVideos = videos
        .filter((v) => v.filename.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            let res = 0;
            if (sortBy === 'name') {
                res = a.filename.localeCompare(b.filename);
            } else if (sortBy === 'length') {
                res = a.duration - b.duration;
            } else if (sortBy === 'date') {
                res = a.modificationTime - b.modificationTime;
            }
            return sortOrder === 'asc' ? res : -res;
        });

    const handleLastPlayed = () => {
        if (lastPlayedUri && lastPlayedTitle) {
            handleVideoPress({ uri: lastPlayedUri, filename: lastPlayedTitle });
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                {isSearching ? (
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search videos..."
                            placeholderTextColor={colors.textMuted}
                            autoFocus
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        <TouchableOpacity onPress={() => { setIsSearching(false); setSearchQuery(''); Keyboard.dismiss(); }}>
                            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <View style={styles.headerTitleRow}>
                            <Text style={styles.headerTitle}>Video Library</Text>
                            {isIncognito && <Ionicons name="eye-off" size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />}
                            {filteredVideos.length > 0 && (
                                <Text style={styles.headerCount}>{filteredVideos.length} videos</Text>
                            )}
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity style={styles.headerBtn} onPress={() => setIsSearching(true)}>
                                <Ionicons name="search-outline" size={22} color={colors.text} />
                            </TouchableOpacity>
                            {lastPlayedUri && (
                                <TouchableOpacity style={styles.headerBtn} onPress={handleLastPlayed}>
                                    <Ionicons name="time-outline" size={22} color={colors.text} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.headerBtn} onPress={() => setIsMenuOpen(!isMenuOpen)}>
                                <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>

            {/* Dropdown Menu */}
            {isMenuOpen && !isSearching && (
                <View style={styles.dropdownMenu}>
                    <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => { setIsMenuOpen(false); setIsSettingsModalVisible(true); }}
                    >
                        <Ionicons name="options-outline" size={20} color={colors.text} style={styles.dropdownIcon} />
                        <Text style={styles.dropdownText}>Display Settings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => { setIsIncognito(!isIncognito); setIsMenuOpen(false); }}
                    >
                        <Ionicons name={isIncognito ? "eye-off" : "eye-outline"} size={20} color={colors.text} style={styles.dropdownIcon} />
                        <Text style={styles.dropdownText}>{isIncognito ? 'Disable Incognito' : 'Incognito Mode'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => { setIsMenuOpen(false); refetch(); }}
                    >
                        <Ionicons name="refresh-outline" size={20} color={colors.text} style={styles.dropdownIcon} />
                        <Text style={styles.dropdownText}>Refresh Library</Text>
                    </TouchableOpacity>
                </View>
            )}

            {isLoading && (
                <View style={styles.scanningBanner}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.scanningText}>Discovering videos...</Text>
                </View>
            )}

            <FlatList
                data={filteredVideos}
                key={viewMode} // Force re-render on grid/list toggle
                renderItem={({ item }) => (
                    <VideoCard
                        video={item}
                        onPress={handleVideoPress}
                        resumePositionMillis={resumeMap[item.uri] ?? 0}
                    />
                )}
                keyExtractor={(item) => item.id}
                numColumns={viewMode === 'grid' ? 2 : 1}
                contentContainerStyle={[styles.listContent, { paddingBottom: SPACING.xl + insets.bottom }]}
                onRefresh={refetch}
                refreshing={isLoading}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="videocam-off-outline" size={64} color={colors.textMuted} />
                        <Text style={styles.emptyTitle}>
                            {isLoading ? 'Scanning Device' : 'No videos found'}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {isLoading ? 'Looking for video files...' : 'Videos from your device will appear here'}
                        </Text>
                    </View>
                }
            />

            <DisplaySettingsModal
                visible={isSettingsModalVisible}
                onClose={() => setIsSettingsModalVisible(false)}
            />
        </View>
    );
};

const useStyles = (colors: any, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingTop: insets.top,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    headerTitle: {
        color: colors.text,
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: LETTER_SPACING.tight,
    },
    headerCount: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.s,
        marginLeft: SPACING.s,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerBtn: {
        padding: SPACING.xs,
        marginLeft: SPACING.xs,
        borderRadius: RADIUS.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceHigh,
        borderRadius: RADIUS.full,
        paddingHorizontal: SPACING.m,
        height: 40,
    },
    searchIcon: {
        marginRight: SPACING.s,
    },
    searchInput: {
        flex: 1,
        color: colors.text,
        fontSize: FONT_SIZE.m,
        height: '100%',
    },
    dropdownMenu: {
        position: 'absolute',
        top: 60 + insets.top,
        right: SPACING.m,
        backgroundColor: colors.surfaceHigh,
        borderRadius: RADIUS.m,
        paddingVertical: SPACING.xs,
        minWidth: 180,
        zIndex: 1000,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: SPACING.m,
    },
    dropdownIcon: {
        marginRight: SPACING.m,
    },
    dropdownText: {
        color: colors.text,
        fontSize: FONT_SIZE.m,
    },
    listContent: {
        padding: SPACING.s,
        paddingBottom: SPACING.xl,
    },
    scanningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.s,
        paddingVertical: SPACING.s,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    scanningText: {
        color: colors.primary,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.medium,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 80,
        gap: SPACING.s,
    },
    emptyTitle: {
        color: colors.text,
        fontSize: FONT_SIZE.l,
        fontWeight: FONT_WEIGHT.semiBold,
        marginTop: SPACING.s,
    },
    emptySubtitle: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.s,
        textAlign: 'center',
        maxWidth: 260,
    },
});

export default VideoLibraryScreen;
