import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    TouchableWithoutFeedback,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';
import { formatTime } from '../utils/timeUtils';

export interface FileInfo {
    filename?: string;
    uri?: string;
    duration?: number;
    modificationTime?: number;
    width?: number;
    height?: number;
    mediaType?: string;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    file: FileInfo | null;
}

const FileInfoModal = ({ visible, onClose, file }: Props) => {
    const { colors } = useThemeContext();
    const insets = useSafeAreaInsets();
    const styles = useStyles(colors, insets);

    const translateY = useRef(new Animated.Value(600)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(translateY, {
                    toValue: 0,
                    tension: 65,
                    friction: 10,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 600,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible, translateY, fadeAnim]);

    const renderDetail = (icon: keyof typeof Ionicons.glyphMap, label: string, value: string) => (
        <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
                <Ionicons name={icon} size={22} color={colors.primary} />
            </View>
            <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue} selectable={true}>{value}</Text>
            </View>
        </View>
    );

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            <Animated.View
                style={[
                    styles.sheetContainer,
                    { transform: [{ translateY }] }
                ]}
            >
                <View style={styles.dragHandleContainer}>
                    <View style={styles.dragHandle} />
                </View>

                <View style={styles.header}>
                    <Text style={styles.title}>File Information</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {file && (
                    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                        {renderDetail('document-text-outline', 'Filename', file.filename || 'Unknown')}
                        {renderDetail('folder-open-outline', 'File Path', file.uri || 'Unknown Location')}
                        
                        {(file.width && file.height) ? renderDetail('scan-outline', 'Resolution', `${file.width} × ${file.height}`) : null}
                        
                        {file.duration ? renderDetail('time-outline', 'Duration', formatTime(file.duration * 1000)) : null}
                        
                        {file.modificationTime ? renderDetail('calendar-outline', 'Creation Date', new Date(file.modificationTime).toLocaleString()) : null}
                        
                        {file.mediaType ? renderDetail('film-outline', 'Type', file.mediaType.toUpperCase()) : null}
                        
                        <View style={styles.bottomSpacer} />
                    </ScrollView>
                )}
            </Animated.View>
        </Modal>
    );
};

const useStyles = (colors: any, insets: any) => StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheetContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        paddingBottom: Math.max(insets.bottom, SPACING.m),
        maxHeight: '75%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 20,
    },
    dragHandleContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    dragHandle: {
        width: 40,
        height: 5,
        borderRadius: 3,
        backgroundColor: colors.border,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: {
        fontSize: FONT_SIZE.l,
        fontWeight: FONT_WEIGHT.bold,
        color: colors.text,
        letterSpacing: LETTER_SPACING.wide,
    },
    closeButton: {
        padding: SPACING.xs,
    },
    content: {
        paddingVertical: SPACING.m,
    },
    contentContainer: {
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.xxl,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: SPACING.l,
    },
    iconContainer: {
        width: 42,
        height: 42,
        borderRadius: RADIUS.l,
        backgroundColor: colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
        marginTop: 2,
    },
    detailTextContainer: {
        flex: 1,
    },
    detailLabel: {
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.medium,
        color: colors.textMuted,
        marginBottom: 4,
        letterSpacing: LETTER_SPACING.wider,
        textTransform: 'uppercase',
    },
    detailValue: {
        fontSize: FONT_SIZE.m,
        color: colors.text,
        lineHeight: 22,
    },
    bottomSpacer: {
        height: 20,
    }
});

export default FileInfoModal;
