import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    TouchableWithoutFeedback,
    Platform,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';
import * as MediaLibrary from 'expo-media-library';
import { formatTime } from '../utils/timeUtils';

export interface MenuAction {
    id: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    danger?: boolean;
}

interface MediaOptionsBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    asset: MediaLibrary.Asset | null; // Supports both Audio and Video assets
    actions: MenuAction[];
}

const formatBytes = (bytes: number) => {
    if (!bytes) return 'Unknown size';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const MediaOptionsBottomSheet = ({ visible, onClose, asset, actions }: MediaOptionsBottomSheetProps) => {
    const { colors } = useThemeContext();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const slideAnim = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 1,
                useNativeDriver: true,
                speed: 18,
                bounciness: 0,
            }).start();
        } else {
            slideAnim.setValue(0);
        }
    }, [visible, slideAnim]);

    const handleClose = () => {
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => onClose());
    };

    if (!visible || !asset) return null;

    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [600, 0], // Start below screen
    });

    const backdropOpacity = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.4],
    });

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none" // We handle the animation manually for smoothness
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <TouchableWithoutFeedback onPress={handleClose}>
                    <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
                </TouchableWithoutFeedback>

                <Animated.View
                    style={[
                        styles.sheet,
                        { backgroundColor: colors.surface, paddingBottom: insets.bottom + SPACING.l },
                        { transform: [{ translateY }] },
                    ]}
                >
                    {/* Header: File details */}
                    <View style={styles.header}>
                        <View style={styles.headerIconWrapper}>
                            <Ionicons
                                name={asset.mediaType === 'audio' ? 'musical-notes' : 'videocam'}
                                size={24}
                                color={colors.primary}
                            />
                        </View>
                        <View style={styles.headerInfo}>
                            <Text style={[styles.filename, { color: colors.text }]} numberOfLines={2}>
                                {asset.filename}
                            </Text>
                            <Text style={[styles.metaData, { color: colors.textSecondary }]}>
                                {new Date(asset.modificationTime).toLocaleDateString()} • {formatTime(asset.duration * 1000)}
                            </Text>
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

                    {/* Actions List - wrapped in ScrollView for landscape */}
                    <ScrollView
                        style={{ maxHeight: isLandscape ? height * 0.55 : undefined }}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >
                        <View style={styles.actionsContainer}>
                            {actions.map((action) => (
                                <TouchableOpacity
                                    key={action.id}
                                    style={[
                                        styles.actionRow,
                                        isLandscape && styles.actionRowCompact,
                                    ]}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        handleClose();
                                        setTimeout(() => action.onPress(), 150);
                                    }}
                                >
                                    <Ionicons
                                        name={action.icon}
                                        size={24}
                                        color={action.danger ? colors.error : colors.text}
                                        style={styles.actionIcon}
                                    />
                                    <Text
                                        style={[
                                            styles.actionLabel,
                                            { color: action.danger ? colors.error : colors.text },
                                        ]}
                                    >
                                        {action.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        paddingTop: SPACING.l,
        paddingHorizontal: SPACING.m,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    headerIconWrapper: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.m,
        backgroundColor: 'rgba(255, 122, 0, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    headerInfo: {
        flex: 1,
    },
    filename: {
        fontSize: FONT_SIZE.m,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: LETTER_SPACING.tight,
        marginBottom: 4,
    },
    metaData: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.medium,
    },
    divider: {
        height: 1,
        width: '100%',
        marginBottom: SPACING.s,
    },
    actionsContainer: {
        marginTop: SPACING.s,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: SPACING.xs,
    },
    actionRowCompact: {
        paddingVertical: 10,
    },
    actionIcon: {
        marginRight: SPACING.m,
        width: 32, // Fixed width for perfect vertical alignment
        textAlign: 'center',
    },
    actionLabel: {
        fontSize: FONT_SIZE.m,
        fontWeight: FONT_WEIGHT.semiBold,
        letterSpacing: 0.2,
    },
});

export default React.memo(MediaOptionsBottomSheet);
