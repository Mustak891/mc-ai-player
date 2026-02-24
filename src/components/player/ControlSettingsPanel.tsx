import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';

import { FONT_SIZE, SPACING } from '../../constants/theme';
import { useThemeContext } from '../../context/ThemeContext';
import { PlayerControlSettings } from '../../types/playerSettings';

type Props = {
    visible: boolean;
    settings: PlayerControlSettings;
    onClose: () => void;
    onChange: (next: PlayerControlSettings) => void;
    onOpenScreenshotInfo: () => void;
};

type ToggleRowProps = {
    title: string;
    subtitle?: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
};

const ToggleRow = ({ title, subtitle, value, onValueChange, colors }: ToggleRowProps & { colors: any }) => {
    const styles = useStyles(colors);
    return (
        <View style={styles.row}>
            <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>{title}</Text>
                {!!subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                thumbColor={colors.primary}
                trackColor={{ false: colors.border, true: colors.primary + '80' }} // Append alpha for track color
            />
        </View>
    );
};

const ControlSettingsPanel = ({ visible, settings, onClose, onChange, onOpenScreenshotInfo }: Props) => {
    const { colors } = useThemeContext();
    const styles = useStyles(colors);
    const update = <K extends keyof PlayerControlSettings>(key: K, value: PlayerControlSettings[K]) => {
        onChange({ ...settings, [key]: value });
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Control settings</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close-outline" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <ToggleRow
                            title="Audio-boost"
                            subtitle="Allow volume up to 200%"
                            value={settings.audioBoostEnabled}
                            onValueChange={(value) => update('audioBoostEnabled', value)}
                            colors={colors}
                        />
                        <ToggleRow
                            title="Save audio delay"
                            subtitle="Save individual audio delay per video"
                            value={settings.saveAudioDelayPerVideo}
                            onValueChange={(value) => update('saveAudioDelayPerVideo', value)}
                            colors={colors}
                        />
                        <ToggleRow
                            title="Automatic resume playback"
                            subtitle="Resume from last watched position"
                            value={settings.automaticResumePlayback}
                            onValueChange={(value) => update('automaticResumePlayback', value)}
                            colors={colors}
                        />

                        <Text style={styles.sectionLabel}>Gestures</Text>
                        <ToggleRow
                            title="Volume gesture"
                            subtitle="Control volume by gesture during playback"
                            value={settings.gestureVolumeEnabled}
                            onValueChange={(value) => update('gestureVolumeEnabled', value)}
                            colors={colors}
                        />
                        <ToggleRow
                            title="Brightness gesture"
                            subtitle="Control brightness by gesture during playback"
                            value={settings.gestureBrightnessEnabled}
                            onValueChange={(value) => update('gestureBrightnessEnabled', value)}
                            colors={colors}
                        />
                        <ToggleRow
                            title="Swipe to seek"
                            subtitle="Swipe your finger across the screen to seek"
                            value={settings.swipeToSeekEnabled}
                            onValueChange={(value) => update('swipeToSeekEnabled', value)}
                            colors={colors}
                        />
                        <ToggleRow
                            title="Two finger zoom"
                            subtitle="Zoom in and out with two fingers"
                            value={settings.twoFingerZoomEnabled}
                            onValueChange={(value) => update('twoFingerZoomEnabled', value)}
                            colors={colors}
                        />
                        <ToggleRow
                            title="Double tap to seek"
                            subtitle="Double tap side regions to seek"
                            value={settings.doubleTapSeekEnabled}
                            onValueChange={(value) => update('doubleTapSeekEnabled', value)}
                            colors={colors}
                        />
                        <ToggleRow
                            title="Double tap center play/pause"
                            subtitle="Double tap center to play/pause"
                            value={settings.doubleTapCenterPlayPauseEnabled}
                            onValueChange={(value) => update('doubleTapCenterPlayPauseEnabled', value)}
                            colors={colors}
                        />
                        <ToggleRow
                            title="Enable Fastplay (hold gesture)"
                            subtitle="Tap and hold to increase playback speed"
                            value={settings.fastPlayHoldEnabled}
                            onValueChange={(value) => update('fastPlayHoldEnabled', value)}
                            colors={colors}
                        />

                        <View style={styles.row}>
                            <View style={styles.rowTextWrap}>
                                <Text style={styles.rowTitle}>Fastplay speed</Text>
                                <Text style={styles.rowSubtitle}>{settings.fastPlaySpeed.toFixed(2)}x</Text>
                            </View>
                        </View>
                        <Slider
                            minimumValue={1.25}
                            maximumValue={4}
                            step={0.25}
                            value={settings.fastPlaySpeed}
                            onValueChange={(value) => update('fastPlaySpeed', value)}
                            minimumTrackTintColor={colors.primary}
                            maximumTrackTintColor="rgba(255,255,255,0.25)"
                            thumbTintColor={colors.primary}
                        />

                        <Text style={styles.sectionLabel}>Player controls</Text>
                        <ToggleRow
                            title="Seek buttons"
                            subtitle="Show rewind/forward buttons on player UI"
                            value={settings.seekButtonsVisible}
                            onValueChange={(value) => update('seekButtonsVisible', value)}
                            colors={colors}
                        />
                        <View style={styles.row}>
                            <View style={styles.rowTextWrap}>
                                <Text style={styles.rowTitle}>Video controls hiding delay</Text>
                                <Text style={styles.rowSubtitle}>{Math.round(settings.controlsHideDelayMs / 1000)}s</Text>
                            </View>
                        </View>
                        <Slider
                            minimumValue={1000}
                            maximumValue={10000}
                            step={100}
                            value={settings.controlsHideDelayMs}
                            onValueChange={(value) => update('controlsHideDelayMs', value)}
                            minimumTrackTintColor={colors.primary}
                            maximumTrackTintColor="rgba(255,255,255,0.25)"
                            thumbTintColor={colors.primary}
                        />
                        <ToggleRow
                            title="Videos transition title"
                            subtitle="Show video title on transition"
                            value={settings.videoTransitionTitleEnabled}
                            onValueChange={(value) => update('videoTransitionTitleEnabled', value)}
                            colors={colors}
                        />
                        <ToggleRow
                            title="Lock with sensor"
                            subtitle="Allow reverse orientation when locked"
                            value={settings.lockWithSensorEnabled}
                            onValueChange={(value) => update('lockWithSensorEnabled', value)}
                            colors={colors}
                        />
                        <ToggleRow
                            title="Take a screenshot"
                            subtitle={settings.screenshotEnabled ? 'Enabled' : 'Disabled'}
                            value={settings.screenshotEnabled}
                            onValueChange={(value) => {
                                update('screenshotEnabled', value);
                                if (value) onOpenScreenshotInfo();
                            }}
                            colors={colors}
                        />
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const useStyles = (colors: any) => StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'flex-end',
    },
    sheet: {
        maxHeight: '80%',
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: SPACING.l,
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
        marginBottom: SPACING.l,
    },
    title: {
        color: colors.primary,
        fontSize: FONT_SIZE.m,
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
    sectionLabel: {
        color: colors.primary,
        fontSize: FONT_SIZE.s,
        fontWeight: '700',
        marginTop: SPACING.l,
        marginBottom: SPACING.m,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.s,
    },
    rowTextWrap: {
        flex: 1,
        paddingRight: SPACING.m,
    },
    rowTitle: {
        color: colors.text,
        fontSize: FONT_SIZE.m,
        fontWeight: '600',
        marginBottom: 2,
    },
    rowSubtitle: {
        color: colors.subtext,
        fontSize: FONT_SIZE.s,
        fontWeight: '400',
    },
});

export default ControlSettingsPanel;
