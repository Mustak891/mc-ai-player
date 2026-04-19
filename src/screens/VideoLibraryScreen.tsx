import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    TextInput,
    Keyboard,
    InteractionManager,
    Linking,
    Alert,
    Share,
    Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';

import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';
import { useVideoLibrary } from '../hooks/useVideoLibrary';
import VideoCard from '../components/VideoCard';
import NativeFeedAdCard from '../components/NativeFeedAdCard';
import NativeVideoCardAd from '../components/NativeVideoCardAd';
import DisplaySettingsModal from '../components/DisplaySettingsModal';
import MediaOptionsBottomSheet, { MenuAction } from '../components/MediaOptionsBottomSheet';
import FileInfoModal from '../components/FileInfoModal';
import * as Sharing from 'expo-sharing';
import { RootStackParamList } from '../navigation/types';
import { readResumeInfoStore, readResumeStore, ResumeStoreEntry } from '../utils/resumeStore';
import { useSettingsStore } from '../store/settingsStore';
import { adAnalytics } from '../services/ads/adAnalytics';

type VideoListItem =
    | { type: 'video'; key: string; video: MediaLibrary.Asset }
    | { type: 'ad'; key: string; slotId: string };

const shallowEqualNumberMap = (a: Record<string, number>, b: Record<string, number>) => {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
        if ((a[key] ?? 0) !== (b[key] ?? 0)) return false;
    }
    return true;
};

const shallowEqualResumeInfoMap = (
    a: Record<string, ResumeStoreEntry>,
    b: Record<string, ResumeStoreEntry>
) => {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
        const aEntry = a[key];
        const bEntry = b[key];
        if (!aEntry && !bEntry) continue;
        if (!aEntry || !bEntry) return false;
        if ((aEntry.positionMillis ?? 0) !== (bEntry.positionMillis ?? 0)) return false;
        if ((aEntry.updatedAt ?? 0) !== (bEntry.updatedAt ?? 0)) return false;
    }
    return true;
};

const OPEN_VIDEO_DEDUP_WINDOW_MS = 650;

const VideoLibraryScreen = () => {
    const { colors } = useThemeContext();
    const insets = initialWindowMetrics?.insets ?? useSafeAreaInsets();
    const styles = useMemo(
        () => useStyles(colors, insets),
        [colors, insets.top, insets.bottom]
    );

    const { viewMode, sortBy, sortOrder, isIncognito, setIsIncognito } = useSettingsStore();
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const [resumeMap, setResumeMap] = useState<Record<string, number>>({});
    const resumeMapRef = useRef<Record<string, number>>({});

    // Header UI State
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [lastPlayedUri, setLastPlayedUri] = useState<string | null>(null);
    const [lastPlayedTitle, setLastPlayedTitle] = useState<string | null>(null);
    const [resumeInfoMap, setResumeInfoMap] = useState<Record<string, ResumeStoreEntry>>({});
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
    const [selectedVideoMenu, setSelectedVideoMenu] = useState<MediaLibrary.Asset | null>(null);
    const [infoModalFile, setInfoModalFile] = useState<MediaLibrary.Asset | null>(null);
    const lastOpenVideoRef = useRef<{ uri: string; at: number } | null>(null);

    // Use libraryReady to defer the initial scan until after navigation animations
    // have fully settled. Avoids a re-render flash during the open/close transition.
    const [libraryReady, setLibraryReady] = useState(false);

    const { videos, isLoading, refetch, hasPermission, canAskAgain, isPermissionLoading, requestPermission } = useVideoLibrary(!libraryReady);

    const handleVideoPress = useCallback((video: MediaLibrary.Asset | { uri: string, filename: string }) => {
        const now = Date.now();
        const lastOpen = lastOpenVideoRef.current;
        if (lastOpen && lastOpen.uri === video.uri && now - lastOpen.at < OPEN_VIDEO_DEDUP_WINDOW_MS) {
            return;
        }
        lastOpenVideoRef.current = { uri: video.uri, at: now };
        navigation.navigate('Player', {
            videoUri: video.uri,
            title: video.filename,
            initialResumePositionMillis: resumeMapRef.current[video.uri] ?? 0,
        });
    }, [navigation]);

    const getFileNameFromUri = (uri: string) => {
        try {
            const decoded = decodeURIComponent(uri);
            const candidate = decoded.split('/').pop() || decoded;
            return candidate.trim() || 'Last Video';
        } catch {
            const candidate = uri.split('/').pop() || uri;
            return candidate.trim() || 'Last Video';
        }
    };

    useFocusEffect(
        useCallback(() => {
            let active = true;
            const task = InteractionManager.runAfterInteractions(() => {
                // Mark the library as ready for the first time AFTER animations settle.
                // This prevents a re-render during the navigation transition that caused the flash.
                if (!libraryReady) {
                    setLibraryReady(true);
                }
                void (async () => {
                    const [store, infoStore] = await Promise.all([
                        readResumeStore(),
                        readResumeInfoStore(),
                    ]);
                    if (!active) return;
                    setResumeMap((prev) => (shallowEqualNumberMap(prev, store) ? prev : store));
                    setResumeInfoMap((prev) =>
                        shallowEqualResumeInfoMap(prev, infoStore) ? prev : infoStore
                    );
                })();
            });
            return () => {
                active = false;
                task.cancel();
            };
        }, [libraryReady])
    );

    useEffect(() => {
        resumeMapRef.current = resumeMap;
    }, [resumeMap]);

    useEffect(() => {
        const videoUris = new Set(videos.map((video) => video.uri));

        const pickMostRecent = (entries: Array<[string, ResumeStoreEntry]>) => {
            if (entries.length === 0) return null;
            const sorted = [...entries].sort((a, b) => {
                const deltaUpdated = (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0);
                if (deltaUpdated !== 0) return deltaUpdated;
                return (b[1]?.positionMillis || 0) - (a[1]?.positionMillis || 0);
            });
            return sorted[0]?.[0] ?? null;
        };

        const validEntries = Object.entries(resumeInfoMap).filter(
            ([, info]) => (info?.positionMillis || 0) > 0
        );
        if (validEntries.length === 0) {
            setLastPlayedUri(null);
            setLastPlayedTitle(null);
            return;
        }

        const inLibrary = validEntries.filter(([uri]) => videoUris.has(uri));
        const mostRecentUri = pickMostRecent(inLibrary) || pickMostRecent(validEntries);
        if (!mostRecentUri) {
            setLastPlayedUri(null);
            setLastPlayedTitle(null);
            return;
        }

        const matchedVideo = videos.find((video) => video.uri === mostRecentUri);
        setLastPlayedUri(mostRecentUri);
        setLastPlayedTitle(matchedVideo?.filename || getFileNameFromUri(mostRecentUri));
    }, [videos, resumeInfoMap]);

    const filteredVideos = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        return videos
            .filter((video) => video.filename.toLowerCase().includes(normalizedQuery))
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
    }, [videos, searchQuery, sortBy, sortOrder]);

    const shouldRenderNativeInlineAd = hasPermission && !isSearching;

    const videoAdSlots = useMemo(() => {
        if (!shouldRenderNativeInlineAd) return [];

        const slots: Array<{ slotId: string; insertAfterCount: number }> = [];
        for (let insertAfterCount = 6; insertAfterCount < filteredVideos.length; insertAfterCount += 6) {
            const slotIndex = slots.length + 1;
            slots.push({
                slotId: `video-library-inline-${slotIndex}`,
                insertAfterCount,
            });
        }

        return slots;
    }, [filteredVideos.length, shouldRenderNativeInlineAd]);

    const videoListItems = useMemo<VideoListItem[]>(() => {
        const mapped: VideoListItem[] = filteredVideos.map((video) => ({
            type: 'video',
            key: `video-${video.id}`,
            video,
        }));

        videoAdSlots.forEach((slot, index) => {
            const insertAt = Math.min(slot.insertAfterCount + index, mapped.length);
            mapped.splice(insertAt, 0, {
                type: 'ad',
                key: `ad-${slot.slotId}`,
                slotId: slot.slotId,
            });
        });

        return mapped;
    }, [filteredVideos, videoAdSlots]);

    const handleLastPlayed = useCallback(() => {
        if (lastPlayedUri && lastPlayedTitle) {
            handleVideoPress({ uri: lastPlayedUri, filename: lastPlayedTitle });
        }
    }, [handleVideoPress, lastPlayedTitle, lastPlayedUri]);

    const renderVideoItem = useCallback(
        ({ item }: { item: VideoListItem }) => {
            if (item.type === 'ad') {
                adAnalytics.trackSlotRendered(item.slotId);
                return viewMode === 'grid' ? <NativeVideoCardAd /> : <NativeFeedAdCard placement="video-list" />;
            }
            return (
                <VideoCard
                    video={item.video}
                    onPress={handleVideoPress}
                    onOptionsPress={setSelectedVideoMenu}
                    resumePositionMillis={resumeMap[item.video.uri] ?? 0}
                />
            );
        },
        [handleVideoPress, resumeMap, viewMode]
    );

    const videoKeyExtractor = useCallback((item: VideoListItem) => item.key, []);

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: VideoListItem }> }) => {
        viewableItems.forEach((token) => {
            if (token.item?.type === 'ad') {
                adAnalytics.trackSlotViewable(token.item.slotId);
            }
        });
    }).current;

    const listContentStyle = useMemo(
        () => [styles.listContent, { paddingBottom: SPACING.xl + insets.bottom }],
        [styles.listContent, insets.bottom]
    );

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
                data={videoListItems}
                key={viewMode} // Force re-render on grid/list toggle
                renderItem={renderVideoItem}
                keyExtractor={videoKeyExtractor}
                numColumns={viewMode === 'grid' ? 2 : 1}
                contentContainerStyle={listContentStyle}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                onRefresh={refetch}
                refreshing={isLoading}
                initialNumToRender={12}
                maxToRenderPerBatch={8}
                updateCellsBatchingPeriod={50}
                windowSize={7}
                removeClippedSubviews
                ListEmptyComponent={
                    // While the OS hasn't returned a permission status yet, show nothing
                    // to avoid flashing "Open Settings" before the native dialog appears.
                    isPermissionLoading ? null :
                    !hasPermission ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="folder-open-outline" size={64} color={colors.primary} />
                            <Text style={styles.emptyTitle}>Storage Access Required</Text>
                            <Text style={styles.emptySubtitle}>
                                MC AI Player needs permission to access and display the videos stored on your device.
                            </Text>
                            <TouchableOpacity
                                style={[styles.permissionButton, { backgroundColor: colors.primary }]}
                                onPress={async () => {
                                    const res = await requestPermission();
                                    if (res.granted) {
                                        refetch();
                                    } else {
                                        Alert.alert(
                                            "Permission Required", 
                                            "Please allow storage access in Settings to view your library.", 
                                            [
                                                { text: "Cancel", style: "cancel" },
                                                { text: "Open Settings", onPress: () => Linking.openSettings() }
                                            ]
                                        );
                                    }
                                }}
                            >
                                <Text style={styles.permissionButtonText}>Grant Permission</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="videocam-off-outline" size={64} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>
                                {isLoading ? 'Scanning Device' : 'No videos found'}
                            </Text>
                            <Text style={styles.emptySubtitle}>
                                {isLoading ? 'Looking for video files...' : 'Videos from your device will appear here'}
                            </Text>
                        </View>
                    )
                }            />

            <DisplaySettingsModal
                visible={isSettingsModalVisible}
                onClose={() => setIsSettingsModalVisible(false)}
            />

            <MediaOptionsBottomSheet
                visible={!!selectedVideoMenu}
                onClose={() => setSelectedVideoMenu(null)}
                asset={selectedVideoMenu}
                actions={[
                    {
                        id: 'play',
                        label: 'Play',
                        icon: 'play-outline',
                        onPress: () => {
                            if (selectedVideoMenu) handleVideoPress(selectedVideoMenu);
                        }
                    },
                    {
                        id: 'play-start',
                        label: 'Play from start',
                        icon: 'play-skip-back-outline',
                        onPress: () => {
                            if (selectedVideoMenu) {
                                navigation.navigate('Player', {
                                    videoUri: selectedVideoMenu.uri,
                                    title: selectedVideoMenu.filename,
                                    initialResumePositionMillis: 0,
                                    forcePlayFromStart: true,
                                });
                            }
                        }
                    },
                    {
                        id: 'info',
                        label: 'Information',
                        icon: 'information-circle-outline',
                        onPress: () => {
                            if (selectedVideoMenu) {
                                setInfoModalFile(selectedVideoMenu);
                                setSelectedVideoMenu(null);
                            }
                        }
                    },
                    {
                        id: 'share',
                        label: 'Share',
                        icon: 'share-social-outline',
                        onPress: async () => {
                            if (selectedVideoMenu) {
                                try {
                                    await Sharing.shareAsync(selectedVideoMenu.uri, {
                                        dialogTitle: `Share ${selectedVideoMenu.filename}`
                                    });
                                } catch (e) {
                                    // Handle share error silently
                                }
                            }
                        }
                    },
                    {
                        id: 'delete',
                        label: 'Delete',
                        icon: 'trash-outline',
                        danger: true,
                        onPress: async () => {
                            if (selectedVideoMenu) {
                                try {
                                    await MediaLibrary.deleteAssetsAsync([selectedVideoMenu]);
                                    refetch();
                                    setSelectedVideoMenu(null);
                                } catch (e) {
                                    Alert.alert("Deletion Failed", "Could not delete this file. Make sure you grant the system permission.");
                                }
                            }
                        }
                    }
                ]}
            />
            <FileInfoModal 
                visible={!!infoModalFile} 
                onClose={() => setInfoModalFile(null)} 
                file={infoModalFile as any} 
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
        paddingTop: insets.top + SPACING.s,
        paddingBottom: SPACING.m,
        paddingLeft: insets.left + SPACING.m,
        paddingRight: insets.right + SPACING.m,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        right: insets.right + SPACING.m,
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
        paddingVertical: SPACING.s,
        paddingLeft: insets.left + SPACING.s,
        paddingRight: insets.right + SPACING.s,
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
    permissionButton: {
        marginTop: SPACING.l,
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.m,
        borderRadius: RADIUS.full,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
    },
    permissionButtonText: {
        color: colors.white,
        fontSize: FONT_SIZE.m,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: LETTER_SPACING.normal,
    },
});

export default VideoLibraryScreen;
