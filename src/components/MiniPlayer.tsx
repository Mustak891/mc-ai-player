import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';
import { formatTime } from '../utils/timeUtils';
import Slider from '@react-native-community/slider';

interface MiniPlayerProps {
    currentTrack: { filename: string; duration: number } | null;
    position: number;
    isPlaying: boolean;
    onPlayPause: () => void;
    onSeek: (val: number) => void;
    onClose: () => void;
}

const MiniPlayer = ({ currentTrack, position, isPlaying, onPlayPause, onSeek, onClose }: MiniPlayerProps) => {
    const { colors } = useThemeContext();
    const styles = useStyles(colors);

    const slideAnim = useRef(new Animated.Value(80)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (currentTrack) {
            Animated.parallel([
                Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, { toValue: 80, duration: 180, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
            ]).start();
        }
    }, [!!currentTrack]);

    if (!currentTrack) return null;

    const nameWithoutExt = currentTrack.filename.replace(/\.[^.]+$/, '');
    const progress = currentTrack.duration > 0
        ? position / (currentTrack.duration * 1000)
        : 0;

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }], opacity: opacityAnim }]}>
            {/* Thin progress bar at top */}
            <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
            </View>

            {/* Invisible seek slider over progress bar */}
            <Slider
                style={styles.hiddenSlider}
                minimumValue={0}
                maximumValue={currentTrack.duration * 1000}
                value={position}
                onSlidingComplete={onSeek}
                minimumTrackTintColor="transparent"
                maximumTrackTintColor="transparent"
                thumbTintColor="transparent"
            />

            {/* Main content */}
            <View style={styles.content}>
                {/* Album art */}
                <View style={styles.albumArt}>
                    <Ionicons name="musical-notes" size={20} color={colors.primary} />
                </View>

                {/* Track info */}
                <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={1}>{nameWithoutExt}</Text>
                    <Text style={styles.time}>
                        {formatTime(position)} / {formatTime(currentTrack.duration * 1000)}
                    </Text>
                </View>

                {/* Controls */}
                <View style={styles.controls}>
                    <TouchableOpacity onPress={onPlayPause} style={styles.playBtn} activeOpacity={0.8}>
                        <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={colors.white} style={isPlaying ? undefined : { marginLeft: 2 }} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                        <Ionicons name="close" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );
};

const useStyles = (colors: any) => StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surfaceGlass,
        borderTopWidth: 1,
        borderTopColor: colors.borderGlass,
        // iOS blur approximation via opacity
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 20,
    },
    progressTrack: {
        height: 2,
        backgroundColor: colors.border,
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 1,
    },
    hiddenSlider: {
        position: 'absolute',
        top: -10,
        left: 0,
        right: 0,
        height: 30,
        opacity: 0,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.m,
        paddingVertical: 11,
    },
    albumArt: {
        width: 42,
        height: 42,
        borderRadius: RADIUS.s,
        backgroundColor: colors.surfaceHigh,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    info: {
        flex: 1,
        marginRight: SPACING.s,
    },
    title: {
        color: colors.text,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.semiBold,
        marginBottom: 2,
    },
    time: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.xs,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
    },
    playBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceHigh,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default MiniPlayer;
