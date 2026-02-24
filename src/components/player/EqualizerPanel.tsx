import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';

import { FONT_SIZE, SPACING } from '../../constants/theme';
import { useThemeContext } from '../../context/ThemeContext';
import { EQUALIZER_FREQUENCIES, EqualizerPresetId, EqualizerSettings } from '../../types/playerSettings';

type Props = {
    visible: boolean;
    supported: boolean;
    settings: EqualizerSettings;
    onClose: () => void;
    onToggleEnabled: (enabled: boolean) => void;
    onSelectPreset: (preset: Exclude<EqualizerPresetId, 'custom'> | 'custom') => void;
    onSetPreamp: (value: number) => void;
    onSetBand: (index: number, value: number) => void;
    onToggleSnap: (value: boolean) => void;
    onSelectCustomProfile: (profileId: string) => void;
    onReset: () => void;
    onSave: () => void;
    onDelete: () => void;
};

const PRESET_ITEMS: Array<{ id: Exclude<EqualizerPresetId, 'custom'> | 'custom'; label: string }> = [
    { id: 'flat', label: 'Flat' },
    { id: 'bass_boost', label: 'Bass Boost' },
    { id: 'treble_boost', label: 'Treble Boost' },
    { id: 'vocal', label: 'Vocal' },
    { id: 'custom', label: 'Custom' },
];

const formatFreq = (hz: number) => {
    if (hz >= 1000) return `${hz / 1000}kHz`;
    return `${hz}Hz`;
};

const EqualizerPanel = ({
    visible,
    supported,
    settings,
    onClose,
    onToggleEnabled,
    onSelectPreset,
    onSetPreamp,
    onSetBand,
    onToggleSnap,
    onSelectCustomProfile,
    onReset,
    onSave,
    onDelete,
}: Props) => {
    const { colors } = useThemeContext();
    const styles = useStyles(colors);
    const presetLabel = useMemo(
        () => PRESET_ITEMS.find((item) => item.id === settings.presetId)?.label || 'Custom',
        [settings.presetId]
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Equalizer</Text>
                        <View style={styles.enableRow}>
                            <Text style={styles.enableText}>Enable</Text>
                            <Switch
                                value={settings.enabled}
                                onValueChange={onToggleEnabled}
                                thumbColor={colors.primary}
                                trackColor={{ false: '#3A3A3A', true: '#6E3E12' }}
                            />
                            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                                <Ionicons name="close-outline" size={24} color={colors.white} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {!supported && (
                        <Text style={styles.unsupportedText}>
                            Equalizer processing is currently Android-only in this build.
                        </Text>
                    )}

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.presetRow}>
                            <Text style={styles.metaLabel}>Preset</Text>
                            <Text style={styles.metaValue}>{presetLabel}</Text>
                        </View>
                        <View style={styles.presetList}>
                            {PRESET_ITEMS.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.presetChip, settings.presetId === item.id && styles.presetChipActive]}
                                    onPress={() => onSelectPreset(item.id)}
                                >
                                    <Text style={styles.presetChipText}>{item.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {settings.customProfiles.length > 0 && (
                            <>
                                <Text style={styles.customTitle}>Custom profiles</Text>
                                <View style={styles.presetList}>
                                    {settings.customProfiles.map((profile) => (
                                        <TouchableOpacity
                                            key={profile.id}
                                            style={[
                                                styles.presetChip,
                                                settings.selectedCustomProfileId === profile.id && styles.presetChipActive,
                                            ]}
                                            onPress={() => onSelectCustomProfile(profile.id)}
                                        >
                                            <Text style={styles.presetChipText}>{profile.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        )}

                        <View style={styles.preampRow}>
                            <Text style={styles.metaLabel}>Preamp</Text>
                            <Text style={styles.metaValue}>{settings.preampDb.toFixed(1)}dB</Text>
                        </View>
                        <Slider
                            minimumValue={-20}
                            maximumValue={20}
                            value={settings.preampDb}
                            onValueChange={onSetPreamp}
                            minimumTrackTintColor={colors.primary}
                            maximumTrackTintColor="rgba(255,255,255,0.2)"
                            thumbTintColor={colors.primary}
                        />

                        <Text style={styles.bandTitle}>Bands</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bandRow}>
                            {EQUALIZER_FREQUENCIES.map((freq, index) => (
                                <View key={freq} style={styles.bandItem}>
                                    <Text style={styles.dbTop}>+20dB</Text>
                                    <Slider
                                        style={styles.verticalSlider}
                                        minimumValue={-20}
                                        maximumValue={20}
                                        value={settings.bandsDb[index] ?? 0}
                                        onValueChange={(value) => onSetBand(index, value)}
                                        minimumTrackTintColor={colors.primary}
                                        maximumTrackTintColor="rgba(255,255,255,0.2)"
                                        thumbTintColor={colors.primary}
                                        step={settings.snapBands ? 1 : 0}
                                    />
                                    <Text style={styles.dbBottom}>-20dB</Text>
                                    <Text style={styles.freqText}>{formatFreq(freq)}</Text>
                                    <Text style={styles.bandValue}>{(settings.bandsDb[index] ?? 0).toFixed(0)}dB</Text>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.snapRow}>
                            <Text style={styles.metaLabel}>Snap bands</Text>
                            <Switch
                                value={settings.snapBands}
                                onValueChange={onToggleSnap}
                                thumbColor={colors.primary}
                                trackColor={{ false: '#3A3A3A', true: '#6E3E12' }}
                            />
                        </View>

                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.footerButton} onPress={onDelete}>
                                <Text style={styles.footerButtonText}>DELETE</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.footerButton} onPress={onReset}>
                                <Text style={styles.footerButtonText}>RESET</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.footerButton} onPress={onSave}>
                                <Text style={[styles.footerButtonText, styles.saveText]}>SAVE</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const useStyles = (colors: any) => StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.62)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: 'rgba(10,10,10,0.97)',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: SPACING.m,
        maxHeight: '84%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        color: colors.white,
        fontSize: FONT_SIZE.xl,
        fontWeight: '700',
    },
    enableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
    },
    enableText: {
        color: colors.white,
        fontSize: FONT_SIZE.m,
        fontWeight: '600',
    },
    closeButton: {
        marginLeft: SPACING.xs,
    },
    unsupportedText: {
        color: colors.textSecondary,
        marginTop: SPACING.s,
        marginBottom: SPACING.s,
    },
    presetRow: {
        marginTop: SPACING.m,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    metaLabel: {
        color: colors.white,
        fontSize: FONT_SIZE.l,
        fontWeight: '600',
    },
    metaValue: {
        color: colors.primary,
        fontSize: FONT_SIZE.l,
        fontWeight: '700',
    },
    presetList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
        marginTop: SPACING.s,
        marginBottom: SPACING.s,
    },
    presetChip: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 999,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
    },
    presetChipActive: {
        backgroundColor: 'rgba(232,113,10,0.25)',
        borderWidth: 1,
        borderColor: colors.primary,
    },
    presetChipText: {
        color: colors.white,
        fontWeight: '600',
    },
    customTitle: {
        color: colors.textSecondary,
        marginTop: SPACING.xs,
        marginBottom: 4,
    },
    preampRow: {
        marginTop: SPACING.s,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    bandTitle: {
        marginTop: SPACING.m,
        color: colors.white,
        fontSize: FONT_SIZE.l,
        fontWeight: '700',
    },
    bandRow: {
        paddingTop: SPACING.s,
        paddingBottom: SPACING.s,
        gap: SPACING.s,
    },
    bandItem: {
        alignItems: 'center',
        width: 72,
    },
    dbTop: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.xs,
    },
    dbBottom: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.xs,
    },
    verticalSlider: {
        width: 140,
        height: 40,
        transform: [{ rotate: '-90deg' }],
    },
    freqText: {
        marginTop: 2,
        color: colors.white,
        fontSize: FONT_SIZE.s,
        fontWeight: '700',
    },
    bandValue: {
        color: colors.textSecondary,
        fontSize: FONT_SIZE.xs,
    },
    snapRow: {
        marginTop: SPACING.m,
        marginBottom: SPACING.m,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.s,
        gap: SPACING.s,
    },
    footerButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    footerButtonText: {
        color: colors.white,
        fontWeight: '700',
        letterSpacing: 1.2,
    },
    saveText: {
        color: colors.primary,
    },
});

export default EqualizerPanel;
