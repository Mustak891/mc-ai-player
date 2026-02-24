import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, Platform, TouchableOpacity } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';
import AudioRow from '../components/AudioRow';
import MiniPlayer from '../components/MiniPlayer';

interface AudioFile {
    id: string;
    filename: string;
    uri: string;
    duration: number;
    modificationTime: number;
}

const AudioScreen = () => {
    const { colors } = useThemeContext();
    const insets = useSafeAreaInsets();
    const styles = useStyles(colors, insets);

    const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
    const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
    const [isLoading, setIsLoading] = useState(false);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<AudioFile | null>(null);
    const [position, setPosition] = useState(0);

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
        if (!permissionResponse?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Alert.alert('Permission needed', 'Please grant media library permissions to list audio files.');
                return;
            }
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
                data={audioFiles}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <AudioRow
                        item={item}
                        isPlaying={currentTrack?.id === item.id && isPlaying}
                        onPress={handleTrackPress}
                    />
                )}
                contentContainerStyle={[styles.listContent, { paddingBottom: (currentTrack ? 100 : SPACING.xl) + insets.bottom }]}
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
        </View>
    );
};

const useStyles = (colors: any, insets: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
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
    }
});

export default AudioScreen;
