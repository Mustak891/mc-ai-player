import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, Platform, TouchableOpacity, Share, Linking } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { checkStoragePermission, requestStoragePermission } from '../utils/permissions';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';
import AudioRow from '../components/AudioRow';
import MiniPlayer from '../components/MiniPlayer';
import NativeFeedAdCard from '../components/NativeFeedAdCard';
import MediaOptionsBottomSheet from '../components/MediaOptionsBottomSheet';
import FileInfoModal from '../components/FileInfoModal';
import * as Sharing from 'expo-sharing';
import { adAnalytics } from '../services/ads/adAnalytics';

interface AudioFile {
    id: string;
    filename: string;
    uri: string;
    duration: number;
    modificationTime: number;
}

type AudioListItem =
    | { type: 'audio'; key: string; audio: AudioFile }
    | { type: 'ad'; key: string; slotId: string };

const AudioScreen = () => {
    const { colors } = useThemeContext();
    const insets = useSafeAreaInsets();
    const styles = useStyles(colors, insets);

    const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<AudioFile | null>(null);
    const [position, setPosition] = useState(0);
    const [selectedAudioMenu, setSelectedAudioMenu] = useState<AudioFile | null>(null);
    const [infoModalFile, setInfoModalFile] = useState<AudioFile | null>(null);

    useEffect(() => {
        if (Platform.OS === 'web') {
            setAudioFiles([
                { id: '1', filename: 'Demo Song.mp3', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', duration: 300, modificationTime: Date.now() },
            ]);
            return;
        }
        loadAudioFiles();
        return () => { if (sound) { void sound.unloadAsync(); } };
    }, []);

    const loadAudioFiles = async () => {
        let granted = await checkStoragePermission('audio');
        if (!granted) {
            granted = await requestStoragePermission('audio');
        }
        setHasPermission(granted);
        if (!granted) {
            Alert.alert(
                'Permission Required',
                'Please allow storage access in Settings to view your audio library.',
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Open Settings", onPress: () => Linking.openSettings() }
                ]
            );
            return;
        }
        setIsLoading(true);
        try {
            const media = await MediaLibrary.getAssetsAsync({
                mediaType: MediaLibrary.MediaType.audio,
                first: 100,
                sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
            });
            setAudioFiles(media.assets as unknown as AudioFile[]);
        } catch { Alert.alert('Error', 'Could not load audio files.'); }
        finally { setIsLoading(false); }
    };

    const handlePlayPause = async () => {
        if (!sound) return;
        if (isPlaying) { await sound.pauseAsync(); setIsPlaying(false); }
        else { await sound.playAsync(); setIsPlaying(true); }
    };

    const handleTrackPress = async (track: AudioFile) => {
        if (currentTrack?.id === track.id) { handlePlayPause(); return; }
        if (sound) await sound.unloadAsync();
        try {
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: track.uri }, { shouldPlay: true },
                (status: any) => {
                    if (status.isLoaded) {
                        setPosition(status.positionMillis);
                        if (status.didJustFinish) { setIsPlaying(false); setPosition(0); }
                    }
                }
            );
            setSound(newSound); setCurrentTrack(track); setIsPlaying(true);
        } catch { Alert.alert('Error', 'Could not play audio file.'); }
    };

    const handleSeek = async (val: number) => { if (sound) await sound.setPositionAsync(val); };
    const handleStop = async () => {
        if (sound) { await sound.stopAsync(); await sound.unloadAsync(); }
        setSound(null); setCurrentTrack(null); setIsPlaying(false); setPosition(0);
    };

    const shouldRenderInlineAudioAd = hasPermission === true;
    const audioAdSlots = useMemo(() => {
        if (!shouldRenderInlineAudioAd) return [];

        const slots: Array<{ slotId: string; insertAfterCount: number }> = [];
        for (let insertAfterCount = 6; insertAfterCount < audioFiles.length; insertAfterCount += 6) {
            const slotIndex = slots.length + 1;
            slots.push({
                slotId: `audio-library-inline-${slotIndex}`,
                insertAfterCount,
            });
        }

        return slots;
    }, [audioFiles.length, shouldRenderInlineAudioAd]);

    const audioListItems = useMemo<AudioListItem[]>(() => {
        const mapped: AudioListItem[] = audioFiles.map((audio) => ({
            type: 'audio',
            key: `audio-${audio.id}`,
            audio,
        }));

        audioAdSlots.forEach((slot, index) => {
            const insertAt = Math.min(slot.insertAfterCount + index, mapped.length);
            mapped.splice(insertAt, 0, {
                type: 'ad',
                key: `ad-${slot.slotId}`,
                slotId: slot.slotId,
            });
        });

        return mapped;
    }, [audioAdSlots, audioFiles]);

    const renderAudioItem = useCallback(({ item }: { item: AudioListItem }) => {
        if (item.type === 'ad') {
            adAnalytics.trackSlotRendered(item.slotId);
            return <NativeFeedAdCard placement="audio-list" />;
        }

        return (
            <AudioRow
                item={item.audio}
                isPlaying={currentTrack?.id === item.audio.id && isPlaying}
                onPress={handleTrackPress}
                onOptionsPress={setSelectedAudioMenu}
            />
        );
    }, [currentTrack?.id, isPlaying]);

    const audioKeyExtractor = useCallback((item: AudioListItem) => item.key, []);

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: AudioListItem }> }) => {
        viewableItems.forEach((token) => {
            if (token.item?.type === 'ad') {
                adAnalytics.trackSlotViewable(token.item.slotId);
            }
        });
    }).current;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Audio Library</Text>
                    {audioFiles.length > 0 && (
                        <Text style={styles.headerCount}>{audioFiles.length} tracks</Text>
                    )}
                </View>
                <TouchableOpacity style={styles.headerBtn} onPress={loadAudioFiles}>
                    <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {isLoading && (
                <View style={styles.scanningBanner}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.scanningText}>Discovering audio...</Text>
                </View>
            )}

            <FlatList
                data={audioListItems}
                keyExtractor={audioKeyExtractor}
                renderItem={renderAudioItem}
                contentContainerStyle={[styles.listContent, { paddingBottom: (currentTrack ? 100 : SPACING.xl) + insets.bottom }]}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="musical-notes-outline" size={64} color={colors.textMuted} />
                        <Text style={styles.emptyTitle}>
                            {isLoading ? 'Scanning Device' : 'No audio files found'}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {isLoading ? 'Looking for audio files...' : 'Audio files from your device will appear here'}
                        </Text>
                    </View>
                }
            />

            {currentTrack && (
                <MiniPlayer
                    currentTrack={currentTrack}
                    position={position}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    onSeek={handleSeek}
                    onClose={handleStop}
                />
            )}

            <MediaOptionsBottomSheet
                visible={!!selectedAudioMenu}
                onClose={() => setSelectedAudioMenu(null)}
                asset={selectedAudioMenu as unknown as MediaLibrary.Asset}
                actions={[
                    {
                        id: 'play',
                        label: 'Play Track',
                        icon: 'play-outline',
                        onPress: () => {
                            if (selectedAudioMenu) handleTrackPress(selectedAudioMenu);
                        }
                    },
                    {
                        id: 'info',
                        label: 'Information',
                        icon: 'information-circle-outline',
                        onPress: () => {
                            if (selectedAudioMenu) {
                                setInfoModalFile(selectedAudioMenu);
                                setSelectedAudioMenu(null);
                            }
                        }
                    },
                    {
                        id: 'share',
                        label: 'Share',
                        icon: 'share-social-outline',
                        onPress: async () => {
                            if (selectedAudioMenu) {
                                try {
                                    await Sharing.shareAsync(selectedAudioMenu.uri, {
                                        dialogTitle: `Share ${selectedAudioMenu.filename}`
                                    });
                                } catch (e) {
                                    // Ignore cancel errors
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
                            if (selectedAudioMenu) {
                                try {
                                    await MediaLibrary.deleteAssetsAsync([selectedAudioMenu as unknown as MediaLibrary.Asset]);
                                    loadAudioFiles();
                                    setSelectedAudioMenu(null);
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
    container: { flex: 1, backgroundColor: colors.background },
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
    headerTitle: {
        color: colors.text,
        fontSize: FONT_SIZE.l,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: LETTER_SPACING.tight,
    },
    headerCount: { color: colors.textSecondary, fontSize: FONT_SIZE.xs, marginTop: 2 },
    headerBtn: {
        width: 36, height: 36, borderRadius: RADIUS.s,
        backgroundColor: colors.surfaceHigh,
        justifyContent: 'center', alignItems: 'center',
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
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: SPACING.s },
    emptyTitle: { color: colors.text, fontSize: FONT_SIZE.l, fontWeight: FONT_WEIGHT.semiBold, marginTop: SPACING.s },
    emptySubtitle: { color: colors.textSecondary, fontSize: FONT_SIZE.s, textAlign: 'center', maxWidth: 260 },
    listContent: {
        paddingTop: SPACING.s,
        paddingLeft: insets.left,
        paddingRight: insets.right,
    }
});

export default AudioScreen;
