import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, Modal, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../context/ThemeContext';
import NativeFeedAdCard from '../components/NativeFeedAdCard';
import { deletePlaylistById, getPlaylists, removeItemFromPlaylist, SavedPlaylist } from '../utils/playlistStore';
import { adAnalytics } from '../services/ads/adAnalytics';
import { RootStackParamList } from '../navigation/types';

type PlaylistListItem =
    | { type: 'playlist'; key: string; playlist: SavedPlaylist }
    | { type: 'ad'; key: string; slotId: string };

const PlaylistsScreen = () => {
    const { colors } = useThemeContext();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const styles = useStyles(colors, insets);
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const [playlists, setPlaylists] = useState<SavedPlaylist[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPlaylist, setSelectedPlaylist] = useState<SavedPlaylist | null>(null);
    const [isPlaylistModalVisible, setIsPlaylistModalVisible] = useState(false);

    const loadPlaylists = useCallback(async () => {
        setIsLoading(true);
        const result = await getPlaylists();
        setPlaylists(result);
        setIsLoading(false);
        return result;
    }, []);

    useFocusEffect(
        useCallback(() => {
            let active = true;

            void (async () => {
                const result = await loadPlaylists();
                if (!active) return;
                setPlaylists(result);
            })();

            return () => {
                active = false;
            };
        }, [loadPlaylists])
    );

    const playlistAdSlots = useMemo(() => {
        const slots: Array<{ slotId: string; insertAfterCount: number }> = [];
        for (let insertAfterCount = 6; insertAfterCount < playlists.length && slots.length < 2; insertAfterCount += 6) {
            const slotIndex = slots.length + 1;
            slots.push({
                slotId: `playlist-inline-${slotIndex}`,
                insertAfterCount,
            });
        }
        return slots;
    }, [playlists.length]);

    const playlistItems = useMemo<PlaylistListItem[]>(() => {
        const mapped: PlaylistListItem[] = playlists.map((playlist) => ({
            type: 'playlist',
            key: `playlist-${playlist.id}`,
            playlist,
        }));

        playlistAdSlots.forEach((slot, index) => {
            const insertAt = Math.min(slot.insertAfterCount + index, mapped.length);
            mapped.splice(insertAt, 0, {
                type: 'ad',
                key: `ad-${slot.slotId}`,
                slotId: slot.slotId,
            });
        });

        return mapped;
    }, [playlistAdSlots, playlists]);

    const showFallbackFooterAd = !isLoading && playlists.length > 0 && playlistAdSlots.length === 0;
    const modalCardWidth = Math.min(520, width - 24);
    const modalCardMaxHeight = Math.max(240, Math.min(height * 0.82, height - insets.top - insets.bottom - 24));

    useEffect(() => {
        if (!showFallbackFooterAd) return;
        adAnalytics.trackSlotRendered('playlist-footer-inline-1');
        adAnalytics.trackSlotViewable('playlist-footer-inline-1');
    }, [showFallbackFooterAd]);

    const handleOpenPlaylist = useCallback((playlist: SavedPlaylist) => {
        setSelectedPlaylist(playlist);
        setIsPlaylistModalVisible(true);
    }, []);

    const handleDeletePlaylist = useCallback((playlist: SavedPlaylist) => {
        Alert.alert(
            'Delete playlist',
            `Remove "${playlist.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        void (async () => {
                            const deleted = await deletePlaylistById(playlist.id);
                            if (!deleted) {
                                Alert.alert('Delete failed', 'Could not remove this playlist. Please try again.');
                                return;
                            }
                            setPlaylists((prev) => prev.filter((entry) => entry.id !== playlist.id));
                            if (selectedPlaylist?.id === playlist.id) {
                                setSelectedPlaylist(null);
                                setIsPlaylistModalVisible(false);
                            }
                        })();
                    },
                },
            ]
        );
    }, [selectedPlaylist?.id]);

    const handlePlayPlaylistItem = useCallback((playlist: SavedPlaylist, item: SavedPlaylist['items'][number]) => {
        setIsPlaylistModalVisible(false);
        navigation.navigate('Player', {
            videoUri: item.uri,
            title: item.title || playlist.name,
            initialResumePositionMillis: 0,
        });
    }, [navigation]);

    const handleDeletePlaylistItem = useCallback((playlistId: string, itemId: string) => {
        void (async () => {
            const updatedPlaylist = await removeItemFromPlaylist(playlistId, itemId);
            if (!updatedPlaylist) {
                await loadPlaylists();
                setSelectedPlaylist(null);
                setIsPlaylistModalVisible(false);
                return;
            }

            setPlaylists((prev) => prev.map((entry) => entry.id === updatedPlaylist.id ? updatedPlaylist : entry));
            setSelectedPlaylist(updatedPlaylist);
        })();
    }, [loadPlaylists]);

    const renderPlaylistItem = useCallback(({ item }: { item: PlaylistListItem }) => {
        if (item.type === 'ad') {
            adAnalytics.trackSlotRendered(item.slotId);
            return <NativeFeedAdCard placement="playlist-list" />;
        }

        const dateText = new Date(item.playlist.createdAt).toLocaleDateString();
        return (
            <View style={styles.playlistCard}>
                <TouchableOpacity
                    style={styles.playlistInfoButton}
                    activeOpacity={0.8}
                    onPress={() => handleOpenPlaylist(item.playlist)}
                >
                    <Text style={styles.title} numberOfLines={1}>{item.playlist.name}</Text>
                    <Text style={styles.metaText}>{item.playlist.items.length} items</Text>
                    <Text style={styles.metaText}>Updated {dateText}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.playlistDeleteButton}
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                    onPress={() => handleDeletePlaylist(item.playlist)}
                >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
            </View>
        );
    }, [colors.error, handleDeletePlaylist, handleOpenPlaylist, styles]);

    const playlistKeyExtractor = useCallback((item: PlaylistListItem) => item.key, []);
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: PlaylistListItem }> }) => {
        viewableItems.forEach((token) => {
            if (token.item?.type === 'ad') {
                adAnalytics.trackSlotViewable(token.item.slotId);
            }
        });
    }).current;

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>Playlists</Text>

            {isLoading ? (
                <View style={styles.centerState}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.text}>Loading playlists...</Text>
                </View>
            ) : (
                <FlatList
                    data={playlistItems}
                    renderItem={renderPlaylistItem}
                    keyExtractor={playlistKeyExtractor}
                    contentContainerStyle={styles.listContent}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                    ListFooterComponent={showFallbackFooterAd ? <NativeFeedAdCard placement="playlist-list" /> : null}
                    ListEmptyComponent={
                        <View style={styles.centerState}>
                            <Text style={styles.text}>No playlists yet. Save one from Player to see it here.</Text>
                        </View>
                    }
                />
            )}

            <Modal
                visible={isPlaylistModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsPlaylistModalVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { width: modalCardWidth, maxHeight: modalCardMaxHeight }] }>
                        <View style={styles.modalHeaderRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle} numberOfLines={1}>{selectedPlaylist?.name || 'Playlist'}</Text>
                                <Text style={styles.modalMeta}>{selectedPlaylist?.items.length ?? 0} items</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsPlaylistModalVisible(false)}>
                                <Ionicons name="close" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.modalListContent} showsVerticalScrollIndicator={false}>
                            {(selectedPlaylist?.items || []).map((playlistItem) => (
                                <View key={playlistItem.id} style={styles.modalItemRow}>
                                    <TouchableOpacity
                                        style={styles.modalItemInfo}
                                        onPress={() => selectedPlaylist && handlePlayPlaylistItem(selectedPlaylist, playlistItem)}
                                    >
                                        <Ionicons name="play-circle" size={20} color={colors.primary} style={{ marginRight: 10 }} />
                                        <Text style={styles.modalItemTitle} numberOfLines={1}>{playlistItem.title || 'Untitled video'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.modalDeleteButton}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        onPress={() => selectedPlaylist && handleDeletePlaylistItem(selectedPlaylist.id, playlistItem.id)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const useStyles = (colors: any, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    headerTitle: {
        color: colors.text,
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 10,
    },
    listContent: {
        paddingBottom: 24,
        gap: 10,
    },
    playlistCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    playlistInfoButton: {
        flex: 1,
        gap: 6,
        paddingVertical: 4,
        paddingRight: 8,
    },
    playlistDeleteButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    title: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '700',
    },
    metaText: {
        color: colors.textSecondary,
        fontSize: 12,
    },
    text: {
        color: colors.textSecondary,
        lineHeight: 20,
    },
    centerState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    modalCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: 14,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
    },
    modalTitle: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '700',
    },
    modalMeta: {
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: 4,
    },
    modalListContent: {
        gap: 8,
        paddingBottom: 8,
    },
    modalItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: 12,
        backgroundColor: colors.background,
        paddingHorizontal: 10,
        paddingVertical: 10,
        gap: 10,
    },
    modalItemInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    modalItemTitle: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    modalDeleteButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
});

export default PlaylistsScreen;
