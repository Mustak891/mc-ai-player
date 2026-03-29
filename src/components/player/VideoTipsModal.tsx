import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, ScrollView, useWindowDimensions } from 'react-native';
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
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const styles = useStyles(colors, isLandscape, height, width);

    const [index, setIndex] = useState(0);
    const item = useMemo(() => TIPS[index] || TIPS[0], [index]);
    const last = index === TIPS.length - 1;

    useEffect(() => {
        if (visible) {
            setIndex(0);
        }
    }, [visible]);

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

                    <View style={styles.body}>
                        <ScrollView
                            contentContainerStyle={styles.contentScroll}
                            style={styles.contentBase}
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={styles.tipTitle}>{item.title}</Text>
                            <Text style={styles.tipBody}>{item.body}</Text>
                        </ScrollView>
                    </View>

                    <View style={styles.footer}>
                        <View style={styles.dots}>
                            {TIPS.map((_, idx) => (
                                <TouchableOpacity key={idx} onPress={() => setIndex(idx)}>
                                    <View style={[styles.dot, idx === index && styles.dotActive]} />
                                </TouchableOpacity>
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

const useStyles = (colors: any, isLandscape: boolean, screenHeight: number, screenWidth: number) => {
    const sheetHeight = Math.min(screenHeight * (isLandscape ? 0.82 : 0.72), isLandscape ? 520 : 560);
    const landscapeWidth = Math.min(screenWidth * 0.65, 520);

    return StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        padding: SPACING.m,
        alignItems: 'center',
    },
    sheet: {
        height: sheetHeight,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: isLandscape ? SPACING.m : SPACING.l,
        width: isLandscape ? landscapeWidth : '100%',
        maxWidth: 480,
        maxHeight: sheetHeight,
        elevation: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
        overflow: 'hidden',
    },
    body: {
        flex: 1,
        minHeight: 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: isLandscape ? SPACING.s : SPACING.m,
    },
    title: {
        color: colors.primary,
        fontSize: isLandscape ? FONT_SIZE.xs : FONT_SIZE.s,
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
        flex: 1,
        minHeight: 0,
        marginVertical: isLandscape ? SPACING.xs : SPACING.m,
    },
    contentScroll: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.s,
        paddingVertical: SPACING.s,
    },
    tipTitle: {
        color: colors.text,
        fontSize: isLandscape ? FONT_SIZE.l : FONT_SIZE.xxl,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: isLandscape ? SPACING.s : SPACING.m,
        letterSpacing: -0.5,
    },
    tipBody: {
        color: colors.subtext,
        fontSize: isLandscape ? FONT_SIZE.s : FONT_SIZE.m,
        textAlign: 'center',
        lineHeight: isLandscape ? 20 : 24,
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: isLandscape ? SPACING.s : SPACING.l,
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
        paddingVertical: isLandscape ? 8 : 10,
        borderRadius: 20,
        gap: SPACING.xs,
    },
    nextButtonText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZE.s,
        fontWeight: '700',
    },
});
};

export default VideoTipsModal;
