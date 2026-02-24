import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FONT_SIZE, SPACING } from '../../constants/theme';
import { useThemeContext } from '../../context/ThemeContext';

type Props = {
    visible: boolean;
    onClose: () => void;
};

const TIPS = [
    { title: 'Player controls', body: 'Tap screen once to show controls. Use play/pause and seek bar for quick navigation.' },
    { title: 'Volume and brightness', body: 'Swipe vertically on right side for volume and left side for brightness.' },
    { title: 'Seek gestures', body: 'Double tap side regions to jump backward/forward. Swipe horizontally to scrub video.' },
    { title: 'Zoom and display', body: 'Tap zoom icon to cycle modes. Long press zoom icon for all aspect ratio options.' },
    { title: 'Picture-in-Picture', body: 'Tap the PiP icon to continue watching in a floating window over other apps.' },
    { title: 'On-Device AI', body: 'Tap the AI button to freeze the frame and analyze the scene using the offline Neural Engine.' },
    { title: 'Audio and subtitles', body: 'Use language icon to pick audio tracks and subtitle tracks without stopping playback.' },
    { title: 'Equalizer', body: 'Open More options -> Equalizer to tune preamp and frequency bands in real time.' },
    { title: 'Advanced menu', body: 'Use More options for sleep timers, bookmarks, background play, and control settings.' },
];

const VideoTipsModal = ({ visible, onClose }: Props) => {
    const { colors } = useThemeContext();
    const styles = useStyles(colors);
    const [index, setIndex] = useState(0);
    const item = useMemo(() => TIPS[index] || TIPS[0], [index]);
    const last = index === TIPS.length - 1;

    const handleNext = () => {
        if (last) {
            setIndex(0);
            onClose();
            return;
        }
        setIndex((prev) => prev + 1);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Video Player Tips</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.contentScroll} style={styles.contentBase} showsVerticalScrollIndicator={false}>
                        <Text style={styles.tipTitle}>{item.title}</Text>
                        <Text style={styles.tipBody}>{item.body}</Text>
                    </ScrollView>

                    <View style={styles.footer}>
                        <View style={styles.dots}>
                            {TIPS.map((_, idx) => (
                                <View key={idx} style={[styles.dot, idx === index && styles.dotActive]} />
                            ))}
                        </View>
                        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                            <Text style={styles.nextButtonText}>{last ? 'Done' : 'Next'}</Text>
                            <Ionicons name={last ? "checkmark" : "chevron-forward"} size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const useStyles = (colors: any) => StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        padding: SPACING.m,
    },
    sheet: {
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: SPACING.l,
        width: '100%',
        maxWidth: 400,
        maxHeight: '90%',
        minHeight: 340,
        elevation: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.m,
    },
    title: {
        color: colors.primary,
        fontSize: FONT_SIZE.s,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentBase: {
        // Removed flex: 1 to prevent layout strict-clamping
        marginVertical: SPACING.m,
    },
    contentScroll: {
        // Removed flexGrow: 1 to ensure natural content sizing
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.s,
    },
    tipTitle: {
        color: colors.text,
        fontSize: FONT_SIZE.xxl,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: SPACING.m,
        letterSpacing: -0.5,
    },
    tipBody: {
        color: colors.subtext,
        fontSize: FONT_SIZE.m,
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: SPACING.l,
    },
    dots: {
        flexDirection: 'row',
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.border,
    },
    dotActive: {
        backgroundColor: colors.primary,
        width: 20,
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: SPACING.l,
        paddingVertical: 10,
        borderRadius: 20,
        gap: SPACING.xs,
    },
    nextButtonText: {
        color: '#FFFFFF', // Keep button text purely white for contrast against the brand primary color
        fontSize: FONT_SIZE.s,
        fontWeight: '700',
    },
});

export default VideoTipsModal;
