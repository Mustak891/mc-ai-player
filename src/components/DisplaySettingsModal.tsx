import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE, FONT_WEIGHT, SPACING, RADIUS } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';
import { useSettingsStore, SortBy, SortOrder, GroupBy, ViewMode } from '../store/settingsStore';

interface DisplaySettingsModalProps {
    visible: boolean;
    onClose: () => void;
}

const DisplaySettingsModal: React.FC<DisplaySettingsModalProps> = ({ visible, onClose }) => {
    const { colors } = useThemeContext();
    const styles = useStyles(colors);
    const {
        viewMode, setViewMode,
        sortBy, setSortBy,
        sortOrder, setSortOrder,
        groupBy, setGroupBy,
        showFavoritesOnly, setShowFavoritesOnly,
    } = useSettingsStore();

    const renderHeader = () => (
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Display settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
        </View>
    );

    const renderActionRow = (icon: any, title: string, rightContent: React.ReactNode, onPress?: () => void) => (
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
            <View style={styles.rowLeft}>
                <Ionicons name={icon} size={24} color={colors.textSecondary} style={styles.rowIcon} />
                <Text style={styles.rowTitle}>{title}</Text>
            </View>
            <View style={styles.rowRight}>
                {rightContent}
            </View>
        </TouchableOpacity>
    );

    const renderSortOption = (type: SortBy, icon: any, label: string, descAsc: string, descDesc: string) => {
        const isActive = sortBy === type;
        const currentOrder = isActive ? sortOrder : 'asc';

        return (
            <TouchableOpacity
                style={styles.sortOptionRow}
                onPress={() => {
                    if (isActive) {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                        setSortBy(type);
                        setSortOrder('asc'); // default order when switching sort type
                    }
                }}
            >
                <View style={styles.rowLeft}>
                    <Ionicons name={icon} size={24} color={isActive ? colors.primary : colors.textSecondary} style={styles.rowIcon} />
                    <Text style={[styles.rowTitle, isActive && { color: colors.primary }]}>{label}</Text>
                </View>
                <View style={styles.sortRight}>
                    <Text style={[styles.sortDesc, isActive && { color: colors.primary }]}>
                        {currentOrder === 'asc' ? descAsc : descDesc}
                    </Text>
                    {isActive && <Ionicons name="checkmark" size={20} color={colors.primary} style={styles.checkIcon} />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={styles.sheet} onStartShouldSetResponder={() => true}>
                    {renderHeader()}

                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {/* Top Options */}
                        <View style={styles.section}>
                            {renderActionRow(
                                viewMode === 'grid' ? "apps-outline" : "list-outline",
                                `Display in ${viewMode === 'list' ? 'grid' : 'list'}`,
                                null,
                                () => setViewMode(viewMode === 'grid' ? 'list' : 'grid')
                            )}

                            {renderActionRow(
                                showFavoritesOnly ? "heart" : "heart-outline",
                                "Show only favourites",
                                <View style={[styles.checkbox, showFavoritesOnly && styles.checkboxActive]}>
                                    {showFavoritesOnly && <Ionicons name="checkmark" size={16} color={colors.background} />}
                                </View>,
                                () => setShowFavoritesOnly(!showFavoritesOnly)
                            )}

                            {renderActionRow(
                                "folder-outline",
                                "Group videos",
                                <Text style={styles.dropdownText}>
                                    {groupBy === 'none' ? 'None' : `By ${groupBy}`} <Ionicons name="caret-down" size={14} />
                                </Text>,
                                () => {
                                    // Simple cycling for demo; a real app might use a sub-menu picker
                                    const groups: GroupBy[] = ['none', 'name', 'folder', 'date'];
                                    const nextIdx = (groups.indexOf(groupBy) + 1) % groups.length;
                                    setGroupBy(groups[nextIdx]);
                                }
                            )}
                        </View>

                        {/* Sort By Section */}
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Sort by...</Text>
                        </View>

                        <View style={styles.section}>
                            {renderSortOption('name', "text-outline", "Name", "A → Z", "Z → A")}
                            {renderSortOption('length', "time-outline", "Length", "Shortest first", "Longest first")}
                            {renderSortOption('date', "calendar-outline", "Insertion date", "Oldest first", "Newest first")}
                            {renderSortOption('tracks', "list-outline", "Nb tracks", "Less videos in group", "More videos in group")}
                        </View>
                    </ScrollView>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const useStyles = (colors: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.background,
        borderTopLeftRadius: RADIUS.l,
        borderTopRightRadius: RADIUS.l,
        height: '80%', // Takes up similar space to VLC
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceHigh,
    },
    headerTitle: {
        fontSize: FONT_SIZE.l,
        fontWeight: FONT_WEIGHT.bold,
        color: colors.primary, // VLC uses orange branding for headers
    },
    closeBtn: {
        padding: SPACING.xs,
    },
    scrollContent: {
        paddingVertical: SPACING.xs,
    },
    section: {
        paddingHorizontal: SPACING.m,
        marginBottom: SPACING.m,
    },
    sectionHeader: {
        paddingHorizontal: SPACING.m,
        marginBottom: SPACING.s,
    },
    sectionTitle: {
        color: colors.primary,
        fontSize: FONT_SIZE.m,
        fontWeight: FONT_WEIGHT.bold,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.m,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowIcon: {
        marginRight: SPACING.m,
        width: 24,
        textAlign: 'center',
    },
    rowTitle: {
        color: colors.text,
        fontSize: FONT_SIZE.m,
        fontWeight: FONT_WEIGHT.medium,
    },
    rowRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dropdownText: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.s,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: colors.textMuted,
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    sortOptionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.l,
    },
    sortRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sortDesc: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.s,
    },
    checkIcon: {
        marginLeft: SPACING.s,
    },
});

export default DisplaySettingsModal;
