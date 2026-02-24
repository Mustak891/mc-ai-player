import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';
import { formatTime } from '../utils/timeUtils';

interface AudioFile {
    id: string;
    filename: string;
    uri: string;
    duration: number;
    modificationTime: number;
}

interface AudioRowProps {
    item: AudioFile;
    isPlaying: boolean;
    onPress: (item: AudioFile) => void;
}

// Animated equalizer bars
const EqualizerBars = ({ colors }: { colors: any }) => {
    const bars = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.7)).current, useRef(new Animated.Value(0.5)).current];
    const eqStyles = getEqStyles();

    useEffect(() => {
        const animations = bars.map((bar, i) =>
            Animated.loop(
                Animated.sequence([
                    Animated.timing(bar, { toValue: 1, duration: 260 + i * 90, useNativeDriver: true }),
                    Animated.timing(bar, { toValue: 0.2, duration: 220 + i * 70, useNativeDriver: true }),
                ])
            )
        );
        const composite = Animated.parallel(animations);
        composite.start();
        return () => composite.stop();
    }, []);

    return (
        <View style={eqStyles.container}>
            {bars.map((scale, i) => (
                <Animated.View key={i} style={[eqStyles.bar, { transform: [{ scaleY: scale }], backgroundColor: colors.primary }]} />
            ))}
        </View>
    );
};

const getEqStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 18,
        gap: 2,
    },
    bar: {
        width: 3,
        height: 14,
        borderRadius: 2,
        transformOrigin: 'bottom',
    },
});

const AudioRow = ({ item, isPlaying, onPress }: AudioRowProps) => {
    const { colors } = useThemeContext();
    const styles = useStyles(colors);
    const eqStyles = getEqStyles();
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () =>
        Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
    const handlePressOut = () =>
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

    const nameWithoutExt = item.filename.replace(/\.[^.]+$/, '');
    const ext = item.filename.split('.').pop()?.toUpperCase() || '';

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                style={[styles.container, isPlaying && styles.activeContainer]}
                onPress={() => onPress(item)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
            >
                {/* Album art placeholder */}
                <View style={[styles.albumArt, isPlaying && styles.albumArtActive]}>
                    {isPlaying ? (
                        <EqualizerBars colors={colors} />
                    ) : (
                        <Ionicons name="musical-note" size={22} color={isPlaying ? colors.white : colors.primary} />
                    )}
                </View>

                {/* Track info */}
                <View style={styles.info}>
                    <Text style={[styles.name, isPlaying && styles.activeName]} numberOfLines={1}>
                        {nameWithoutExt}
                    </Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.meta}>{formatTime(item.duration * 1000)}</Text>
                        <View style={styles.dot} />
                        <Text style={[styles.extBadge]}>{ext}</Text>
                    </View>
                </View>

                {/* More / playing indicator */}
                <View style={styles.rightSection}>
                    {isPlaying ? (
                        <View style={styles.playingDot} />
                    ) : (
                        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
                    )}
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const useStyles = (colors: any) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    activeContainer: {
        backgroundColor: colors.primarySubtle,
    },
    albumArt: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.s,
        backgroundColor: colors.surfaceHigh,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    albumArtActive: {
        backgroundColor: 'rgba(255, 122, 0, 0.18)',
        borderColor: colors.primaryGlow,
    },
    info: {
        flex: 1,
    },
    name: {
        color: colors.text,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.medium,
        marginBottom: 4,
        letterSpacing: -0.1,
    },
    activeName: {
        color: colors.primary,
        fontWeight: FONT_WEIGHT.semiBold,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    meta: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.xs,
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 2,
        backgroundColor: colors.textMuted,
    },
    extBadge: {
        color: colors.textMuted,
        fontSize: FONT_SIZE.xxs,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 0.5,
    },
    rightSection: {
        width: 28,
        alignItems: 'center',
    },
    playingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },
});

export default AudioRow;
