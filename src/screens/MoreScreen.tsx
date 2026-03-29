import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';

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
    const handlePlaceholder = (feature: string) => {
        Alert.alert('Coming Soon', `${feature} will be available in a future update.`);
    };

    const SettingRow = ({ icon, label, rightElement, onPress }: any) => {
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
            <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
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
                        onPress={() => handlePlaceholder('Store rating')}
                    />
                    <View style={styles.divider} />
                    <SettingRow
                        icon="person-circle-outline"
                        label="Developer Profile"
                        onPress={() => Linking.openURL('https://github.com/Mustak891').catch(() => handlePlaceholder('Developer Profile link'))}
                    />
                </View>

                <View style={styles.footerBrand}>
                    <Ionicons name="play-circle" size={48} color={colors.border} />
                    <Text style={styles.brandName}>MC AI PLAYER</Text>
                    <Text style={styles.brandSubtitle}>Powered by On-Device Neural Engine</Text>
                </View>
            </ScrollView>
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

