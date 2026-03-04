import React, { useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Image,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';

interface VideoCardProps {
    video: MediaLibrary.Asset;
    onPress: (video: MediaLibrary.Asset) => void;
    resumePositionMillis?: number;
}

const formatDuration = (millis: number) => {
    const totalSec = Math.floor(millis / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getResolutionLabel = (width: number, height: number): { label: string; color: string } => {
    const minDim = Math.min(width, height);
    if (minDim >= 2160) return { label: '4K', color: '#6C63FF' };
    if (minDim >= 1440) return { label: '2K', color: '#00D9A0' };
    if (minDim >= 1080) return { label: 'HD', color: '#FF7A00' };
    if (minDim >= 720) return { label: 'HD', color: '#FF7A00' };
    return { label: 'SD', color: '#8A8A8A' };
};

const VideoCard = ({ video, onPress, resumePositionMillis = 0 }: VideoCardProps) => {
    const { colors } = useThemeContext();
    const styles = useStyles(colors);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const resolution = getResolutionLabel(video.width, video.height);
    const hasResume = resumePositionMillis > 0;
    const resumePct = hasResume && video.duration > 0
        ? Math.min(resumePositionMillis / (video.duration * 1000), 1)
        : 0;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start();
    };
    const handlePressOut = () => {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
    };

    return (
        <Animated.View style={[styles.outer, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
                style={styles.container}
                onPress={() => onPress(video)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
            >
                {/* Thumbnail */}
                <View style={styles.thumbnailContainer}>
                    <Image source={{ uri: video.uri }} style={styles.thumbnail} />

                    {/* Bottom gradient scrim */}
                    <View style={styles.gradientScrim} />

                    {/* Play icon center overlay */}
                    <View style={styles.playOverlay}>
                        <View style={styles.playCircle}>
                            <Ionicons name="play" size={18} color={colors.white} style={{ marginLeft: 2 }} />
                        </View>
                    </View>

                    {/* Resolution badge */}
                    <View style={[styles.resBadge, { backgroundColor: resolution.color }]}>
                        <Text style={styles.resBadgeText}>{resolution.label}</Text>
                    </View>

                    {/* Duration badge */}
                    <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{formatDuration(video.duration * 1000)}</Text>
                    </View>

                    {/* Resume progress bar */}
                    {hasResume && (
                        <View style={styles.resumeBarTrack}>
                            <View style={[styles.resumeBarFill, { width: `${resumePct * 100}%` }]} />
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={styles.infoContainer}>
                    <Text style={styles.title} numberOfLines={2}>{video.filename.replace(/\.[^.]+$/, '')}</Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaText}>
                            {new Date(video.modificationTime * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </Text>
                        {hasResume && (
                            <View style={styles.resumeBadge}>
                                <Ionicons name="play-circle" size={10} color={colors.primary} />
                                <Text style={styles.resumeBadgeText}>Continue</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const areVideoCardPropsEqual = (prev: VideoCardProps, next: VideoCardProps) => {
    return (
        prev.video.id === next.video.id &&
        prev.video.uri === next.video.uri &&
        prev.video.filename === next.video.filename &&
        prev.video.duration === next.video.duration &&
        prev.video.modificationTime === next.video.modificationTime &&
        prev.resumePositionMillis === next.resumePositionMillis &&
        prev.onPress === next.onPress
    );
};

const useStyles = (colors: any) => StyleSheet.create({
    outer: {
        flex: 1,
        margin: SPACING.xs,
        maxWidth: '48%',
    },
    container: {
        backgroundColor: colors.surface,
        borderRadius: RADIUS.m,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    thumbnailContainer: {
        height: 128,
        backgroundColor: '#0A0A0A',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    gradientScrim: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 52,
        backgroundColor: 'transparent',
        // Approximate linear gradient via layered opacity
        borderBottomLeftRadius: 0,
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.52)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    resBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: RADIUS.xs,
    },
    resBadgeText: {
        color: colors.white,
        fontSize: 9,
        fontWeight: FONT_WEIGHT.heavy,
        letterSpacing: 0.5,
    },
    durationBadge: {
        position: 'absolute',
        bottom: 8,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.72)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: RADIUS.xs,
    },
    durationText: {
        color: colors.white,
        fontSize: FONT_SIZE.xxs,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: LETTER_SPACING.wide,
    },
    resumeBarTrack: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    resumeBarFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 2,
    },
    infoContainer: {
        padding: SPACING.s,
        paddingBottom: 10,
    },
    title: {
        color: colors.text,
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.medium,
        lineHeight: 17,
        marginBottom: 5,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    metaText: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.xxs,
    },
    resumeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    resumeBadgeText: {
        color: colors.primary,
        fontSize: FONT_SIZE.xxs,
        fontWeight: FONT_WEIGHT.semiBold,
    },
});

export default React.memo(VideoCard, areVideoCardPropsEqual);
