import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, Modal, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';
import NativeFeedAdCard from '../components/NativeFeedAdCard';
import { adAnalytics } from '../services/ads/adAnalytics';
import { buildInlineAdSlots } from '../services/ads/inlineAdSlots';

type AnalyticsSnapshot = Awaited<ReturnType<typeof adAnalytics.getSnapshot>>;
const MORE_SETTINGS_ITEM_COUNT = 7;

const MoreScreen = () => {
    const {
        colors,
        systemTheme,
    } = useThemeContext();

    const themeIcon = systemTheme === 'dark' ? 'moon' : 'sunny';
    const themeStatusText = `Following ${systemTheme === 'dark' ? 'Dark' : 'Light'} mode`;
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const styles = useStyles(colors, insets);
    const versionSecretTriggeredRef = useRef(false);
    const [analyticsVisible, setAnalyticsVisible] = useState(false);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsSnapshot, setAnalyticsSnapshot] = useState<AnalyticsSnapshot | null>(null);
    const [analyticsError, setAnalyticsError] = useState<string | null>(null);
    const moreAdSlots = useMemo(() => buildInlineAdSlots({
        contentCount: MORE_SETTINGS_ITEM_COUNT,
        slotPrefix: 'more-inline',
        maxAds: 2,
    }), []);
    const showSecondaryMoreAd = moreAdSlots.length > 1;

    const handlePlaceholder = (feature: string) => {
        Alert.alert('Coming Soon', `${feature} will be available in a future update.`);
    };

    useEffect(() => {
        if (!analyticsVisible) {
            return;
        }

        let mounted = true;
        setAnalyticsLoading(true);
        setAnalyticsError(null);

        void (async () => {
            try {
                const snapshot = await adAnalytics.getSnapshot();
                if (mounted) {
                    setAnalyticsSnapshot(snapshot);
                }
            } catch {
                if (mounted) {
                    setAnalyticsError('Unable to load ad analytics right now.');
                }
            } finally {
                if (mounted) {
                    setAnalyticsLoading(false);
                }
            }
        })();

        return () => {
            mounted = false;
        };
    }, [analyticsVisible]);

    const refreshAnalytics = async () => {
        setAnalyticsLoading(true);
        setAnalyticsError(null);

        try {
            const snapshot = await adAnalytics.getSnapshot();
            setAnalyticsSnapshot(snapshot);
        } catch {
            setAnalyticsError('Unable to load ad analytics right now.');
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const resetAnalytics = async () => {
        setAnalyticsLoading(true);
        setAnalyticsError(null);

        try {
            await adAnalytics.reset();
            const snapshot = await adAnalytics.getSnapshot();
            setAnalyticsSnapshot(snapshot);
        } catch {
            setAnalyticsError('Unable to reset ad analytics right now.');
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const SettingRow = ({ icon, label, rightElement, onPress, onLongPress }: any) => {
        const content = (
            <>
                <View style={styles.rowLeft}>
                    <Ionicons name={icon} size={22} color={colors.primary} style={styles.rowIcon} />
                    <Text style={styles.rowLabel}>{label}</Text>
                </View>
                {rightElement ? rightElement : (
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                )}
            </>
        );

        if (!onPress) {
            return <View style={styles.row}>{content}</View>;
        }

        return (
            <TouchableOpacity
                style={styles.row}
                onPress={() => {
                    if (versionSecretTriggeredRef.current) {
                        versionSecretTriggeredRef.current = false;
                        return;
                    }

                    onPress?.();
                }}
                onLongPress={() => {
                    versionSecretTriggeredRef.current = true;
                    onLongPress?.();
                }}
                delayLongPress={450}
                activeOpacity={0.7}
            >
                {content}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings & More</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionTitle}>APPEARANCE</Text>
                <View style={styles.card}>
                    <SettingRow
                        icon={themeIcon}
                        label="Appearance"
                        rightElement={
                            <View style={styles.themeSummary}>
                                <View style={styles.systemBadge}>
                                    <Text style={styles.systemBadgeText}>System default</Text>
                                </View>
                                <Text style={styles.themeStatusText}>{themeStatusText}</Text>
                            </View>
                        }
                    />
                    <View style={styles.divider} />
                    <SettingRow
                        icon="color-palette"
                        label="Accent Color"
                        rightElement={<Text style={styles.valueText}>Orange</Text>}
                        onPress={() => handlePlaceholder('Custom accent colors')}
                    />
                </View>

                <Text style={styles.sectionTitle}>ABOUT</Text>
                <View style={styles.card}>
                    <SettingRow
                        icon="information-circle"
                        label="Version"
                        rightElement={<Text style={styles.valueText}>1.0.4 Premium</Text>}
                        onPress={() => handlePlaceholder('Version history')}
                        onLongPress={() => setAnalyticsVisible(true)}
                    />
                    <View style={styles.divider} />
                    <SettingRow
                        icon="document-text"
                        label="Terms of Service"
                        onPress={() => navigation.navigate('TermsAndConditions')}
                    />
                    <View style={styles.divider} />
                    <SettingRow
                        icon="shield-checkmark"
                        label="Privacy Policy"
                        onPress={() => navigation.navigate('PrivacyPolicy')}
                    />
                </View>

                <Text style={styles.sectionTitle}>CONNECT</Text>
                <View style={styles.card}>
                    <SettingRow
                        icon="star"
                        label="Rate on Play Store"
                        onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=app.mcai.videoplayer').catch(() => handlePlaceholder('Store rating'))}
                    />
                    <View style={styles.divider} />
                    <SettingRow
                        icon="person-circle-outline"
                        label="Developer Profile"
                        onPress={() => Linking.openURL('https://github.com/Mustak891').catch(() => handlePlaceholder('Developer Profile link'))}
                    />
                </View>

                <View style={styles.adSection}>
                    <NativeFeedAdCard placement="settings-footer" />
                </View>

                <View style={styles.footerBrand}>
                    <Ionicons name="play-circle" size={48} color={colors.border} />
                    <Text style={styles.brandName}>MC AI PLAYER</Text>
                    <Text style={styles.brandSubtitle}>Powered by On-Device Neural Engine</Text>
                </View>

                {showSecondaryMoreAd && (
                    <View style={styles.adSectionSecondary}>
                        <NativeFeedAdCard placement="settings-footer" />
                    </View>
                )}
            </ScrollView>

            <Modal visible={analyticsVisible} transparent animationType="fade" onRequestClose={() => setAnalyticsVisible(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Ad analytics</Text>
                                <Text style={styles.modalSubtitle}>Local daily render and viewability totals</Text>
                            </View>
                            <Pressable onPress={() => setAnalyticsVisible(false)} hitSlop={12}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </Pressable>
                        </View>

                        {analyticsLoading && !analyticsSnapshot ? (
                            <View style={styles.modalLoadingRow}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.modalBodyText}>Loading analytics...</Text>
                            </View>
                        ) : analyticsError ? (
                            <Text style={styles.modalErrorText}>{analyticsError}</Text>
                        ) : analyticsSnapshot ? (
                            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} showsVerticalScrollIndicator={false}>
                                <View style={styles.metricGrid}>
                                    <View style={styles.metricCard}>
                                        <Text style={styles.metricLabel}>Rendered</Text>
                                        <Text style={styles.metricValue}>{analyticsSnapshot.rendered}</Text>
                                    </View>
                                    <View style={styles.metricCard}>
                                        <Text style={styles.metricLabel}>Viewable</Text>
                                        <Text style={styles.metricValue}>{analyticsSnapshot.viewable}</Text>
                                    </View>
                                </View>

                                <View style={styles.metaRow}>
                                    <Text style={styles.metaLabel}>Day key</Text>
                                    <Text style={styles.metaValue}>{analyticsSnapshot.dayKey}</Text>
                                </View>

                                <View style={styles.slotList}>
                                    {analyticsSnapshot.slots.length > 0 ? analyticsSnapshot.slots.map((slot) => (
                                        <View key={slot.slotId} style={styles.slotRow}>
                                            <View style={styles.slotHeader}>
                                                <Text style={styles.slotId} numberOfLines={1}>{slot.slotId}</Text>
                                                <View style={styles.slotPill}>
                                                    <Text style={styles.slotPillText}>{slot.viewable} viewable</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.slotStats}>{slot.rendered} rendered · {slot.viewable} viewable</Text>
                                        </View>
                                    )) : (
                                        <Text style={styles.modalBodyText}>No ad slots have reported yet.</Text>
                                    )}
                                </View>
                            </ScrollView>
                        ) : null}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.secondaryButton} onPress={refreshAnalytics} disabled={analyticsLoading}>
                                <Text style={styles.secondaryButtonText}>Refresh</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondaryButton} onPress={resetAnalytics} disabled={analyticsLoading}>
                                <Text style={styles.secondaryButtonText}>Reset</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.primaryButton} onPress={() => setAnalyticsVisible(false)}>
                                <Text style={styles.primaryButtonText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const useStyles = (colors: any, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingTop: insets.top + SPACING.s,
        paddingBottom: SPACING.m,
        paddingHorizontal: SPACING.m,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    headerTitle: {
        color: colors.text,
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: LETTER_SPACING.tight,
    },
    scrollContent: {
        padding: SPACING.m,
        paddingBottom: insets.bottom + SPACING.xxl,
    },
    sectionTitle: {
        color: colors.primary,
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 1.2,
        marginTop: SPACING.m,
        marginBottom: SPACING.s,
        marginLeft: SPACING.xs,
        opacity: 0.9,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: RADIUS.l,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: 'hidden',
        marginBottom: SPACING.s,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: SPACING.m,
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
    rowLabel: {
        color: colors.text,
        fontSize: FONT_SIZE.m,
        fontWeight: FONT_WEIGHT.medium,
    },
    valueText: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.medium,
    },
    divider: {
        height: 1,
        backgroundColor: colors.borderSubtle,
        marginLeft: 54,
    },
    footerBrand: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40,
        marginBottom: 20,
        opacity: 0.6,
    },
    adSection: {
        marginTop: SPACING.s,
        marginBottom: SPACING.m,
    },
    adSectionSecondary: {
        marginTop: SPACING.s,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'center',
        padding: SPACING.m,
    },
    modalCard: {
        backgroundColor: colors.surface,
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: SPACING.m,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: SPACING.m,
        marginBottom: SPACING.m,
    },
    modalTitle: {
        color: colors.text,
        fontSize: FONT_SIZE.l,
        fontWeight: FONT_WEIGHT.bold,
    },
    modalSubtitle: {
        color: colors.textMuted,
        fontSize: FONT_SIZE.xs,
        marginTop: 4,
    },
    modalLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
        paddingVertical: SPACING.m,
    },
    modalBody: {
        flexGrow: 0,
    },
    modalBodyContent: {
        gap: SPACING.m,
        paddingBottom: SPACING.s,
    },
    modalBodyText: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.s,
    },
    modalErrorText: {
        color: colors.error,
        fontSize: FONT_SIZE.s,
        marginBottom: SPACING.m,
    },
    metricGrid: {
        flexDirection: 'row',
        gap: SPACING.s,
    },
    metricCard: {
        flex: 1,
        backgroundColor: colors.background,
        borderRadius: RADIUS.l,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: SPACING.m,
    },
    metricLabel: {
        color: colors.textMuted,
        fontSize: FONT_SIZE.xs,
        marginBottom: 6,
    },
    metricValue: {
        color: colors.text,
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
    },
    metaRow: {
        backgroundColor: colors.background,
        borderRadius: RADIUS.l,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: SPACING.m,
    },
    metaLabel: {
        color: colors.textMuted,
        fontSize: FONT_SIZE.xs,
        marginBottom: 6,
    },
    metaValue: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.medium,
    },
    slotList: {
        gap: SPACING.s,
    },
    slotRow: {
        backgroundColor: colors.background,
        borderRadius: RADIUS.l,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: SPACING.m,
        gap: 8,
    },
    slotHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.s,
    },
    slotId: {
        flex: 1,
        color: colors.text,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.medium,
    },
    slotPill: {
        backgroundColor: colors.primarySoft,
        borderRadius: RADIUS.s,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    slotPillText: {
        color: colors.primary,
        fontSize: FONT_SIZE.xxs,
        fontWeight: FONT_WEIGHT.bold,
    },
    slotStats: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.xs,
    },
    modalActions: {
        flexDirection: 'row',
        gap: SPACING.s,
        marginTop: SPACING.m,
    },
    secondaryButton: {
        flex: 1,
        borderRadius: RADIUS.m,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        backgroundColor: colors.background,
        paddingVertical: 12,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
    },
    primaryButton: {
        flex: 1,
        borderRadius: RADIUS.m,
        backgroundColor: colors.primary,
        paddingVertical: 12,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: colors.white,
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
    },
    brandName: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.m,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 2,
        marginTop: SPACING.s,
    },
    brandSubtitle: {
        color: colors.textMuted,
        fontSize: FONT_SIZE.xs,
        marginTop: 4,
    },
    themeSummary: {
        alignItems: 'flex-end',
    },
    themeStatusText: {
        marginTop: 6,
        color: colors.textMuted,
        fontSize: FONT_SIZE.xxs,
        fontWeight: FONT_WEIGHT.medium,
    },
    systemBadge: {
        borderRadius: RADIUS.s,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        backgroundColor: colors.background,
        paddingVertical: 5,
        paddingHorizontal: 10,
    },
    systemBadgeText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.medium,
        color: colors.textSecondary,
    },
});

export default MoreScreen;

