import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';
import { getFileIcon, formatFileSize } from '../utils/fileUtils';

interface FileRowProps {
    name: string;
    isDirectory: boolean;
    size?: number;
    uri: string;
    subtitle?: string;
    onPress: (uri: string, isDirectory: boolean, name: string) => void;
}

const FileRow = ({ name, isDirectory, size, uri, subtitle, onPress }: FileRowProps) => {
    const { colors } = useThemeContext();
    const styles = useStyles(colors);
    const iconName = getFileIcon(name, isDirectory);

    const ext = !isDirectory ? name.split('.').pop()?.toLowerCase() : null;
    const isVideo = ['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(ext || '');
    const isAudio = ['mp3', 'wav', 'm4a', 'flac', 'ogg'].includes(ext || '');

    const iconColor = isDirectory ? colors.primary
        : isVideo ? '#6C63FF'
            : isAudio ? colors.success
                : colors.textSecondary;
    const iconBg = isDirectory ? colors.primarySubtle
        : isVideo ? 'rgba(108,99,255,0.15)'
            : isAudio ? 'rgba(0,217,160,0.12)'
                : colors.surfaceHigh;

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={() => onPress(uri, isDirectory, name)}
            activeOpacity={0.7}
        >
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
                <Ionicons name={iconName} size={22} color={iconColor} />
            </View>

            {/* Info */}
            <View style={styles.infoContainer}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <View style={styles.metaRow}>
                    {!isDirectory && size !== undefined && (
                        <Text style={styles.meta}>{formatFileSize(size)}</Text>
                    )}
                    {isDirectory && (
                        <Text style={styles.meta}>Folder</Text>
                    )}
                </View>
                {!!subtitle && (
                    <View style={styles.resumeRow}>
                        <Ionicons name="play-circle" size={11} color={colors.primary} />
                        <Text style={styles.resumeText}>{subtitle}</Text>
                    </View>
                )}
            </View>

            {/* Chevron */}
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
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
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: RADIUS.s,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    infoContainer: {
        flex: 1,
    },
    name: {
        color: colors.text,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.medium,
        marginBottom: 2,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    meta: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.xs,
    },
    resumeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
        gap: 4,
    },
    resumeText: {
        color: colors.primary,
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.semiBold,
    },
});

export default FileRow;
