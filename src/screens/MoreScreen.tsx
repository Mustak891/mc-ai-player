import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Linking, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';

const MoreScreen = () => {
    const { colors, isDark } = useThemeContext();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const styles = useStyles(colors, insets);
    const handlePlaceholder = (feature: string) => {
        Alert.alert('Coming Soon', `${feature} will be available in a future update.`);
    };

    const SettingRow = ({ icon, label, rightElement, onPress }: any) => (
        <TouchableOpacity style={styles.row} onPress={onPress}>
            <View style={styles.rowLeft}>
                <Ionicons name={icon} size={22} color={colors.primary} style={styles.rowIcon} />
                <Text style={styles.rowLabel}>{label}</Text>
            </View>
            {rightElement ? rightElement : (
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings & More</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Visual Settings Section */}
                <Text style={styles.sectionTitle}>APPEARANCE</Text>
                <View style={styles.card}>
                    <SettingRow
                        icon={isDark ? "moon" : "sunny"}
                        label="Dark Mode"
                        rightElement={<Text style={styles.valueText}>{isDark ? 'On (System)' : 'Off (System)'}</Text>}
                    />
                    <View style={styles.divider} />
                    <SettingRow
                        icon="color-palette"
                        label="Accent Color"
                        rightElement={<Text style={styles.valueText}>Orange</Text>}
                        onPress={() => handlePlaceholder('Custom accent colors')}
                    />
                </View>

                {/* About Section */}
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

                {/* Social Section */}
                <Text style={styles.sectionTitle}>CONNECT</Text>
                <View style={styles.card}>
                    <SettingRow
                        icon="star"
                        label="Rate on Play Store"
                        onPress={() => handlePlaceholder('Store rating')}
                    />
                    <View style={styles.divider} />
                    <SettingRow
                        icon="logo-github"
                        label="View Source Code"
                        onPress={() => Linking.openURL('https://github.com/Mustak891/mc-ai-player').catch(() => handlePlaceholder('Source code link'))}
                    />
                </View>

                {/* Footer Brand */}
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
        marginLeft: 54, // Align with text start
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
    }
});

export default MoreScreen;
