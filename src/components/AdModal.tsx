import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useThemeContext } from '../context/ThemeContext';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../constants/theme';

interface AdModalProps {
    visible: boolean;
    onAdClosed: () => void;
}

const AdModal = ({ visible, onAdClosed }: AdModalProps) => {
    const { colors } = useThemeContext();
    const styles = useStyles(colors);
    const [countdown, setCountdown] = useState(5);
    const [canSkip, setCanSkip] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (visible) {
            setCountdown(5);
            setCanSkip(false);

            timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        setCanSkip(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={() => {
                if (canSkip) onAdClosed();
            }}
            supportedOrientations={['portrait', 'landscape']}
        >
            <View style={styles.overlay}>
                {/* Simulated Video Area */}
                <View style={styles.adContent}>
                    <Ionicons name="play-circle-outline" size={64} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.adMockText}>Simulated Advertisement</Text>
                    <ActivityIndicator size="small" color="#FFF" style={{ marginTop: 20 }} />
                </View>

                {/* Top Bar for Skip/Close */}
                <View style={styles.topBar}>
                    {/* "Ad" Badge */}
                    <BlurView intensity={30} tint="dark" style={styles.adBadge}>
                        <Text style={styles.adBadgeText}>Ad</Text>
                    </BlurView>

                    {/* Skip/Countdown Button */}
                    <TouchableOpacity
                        style={[
                            styles.skipButton,
                            !canSkip && styles.skipButtonDisabled
                        ]}
                        disabled={!canSkip}
                        onPress={onAdClosed}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.skipButtonText}>
                            {canSkip ? 'Skip Ad' : `Skip in ${countdown}`}
                        </Text>
                        {canSkip && <Ionicons name="play-forward" size={14} color="#000" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const useStyles = (colors: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.xl, // Safe area roughly
        zIndex: 10,
    },
    adContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    adMockText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: FONT_SIZE.m,
        marginTop: SPACING.m,
        letterSpacing: 1,
    },
    adBadge: {
        paddingHorizontal: SPACING.m,
        paddingVertical: 4,
        borderRadius: RADIUS.s,
        backgroundColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    adBadgeText: {
        color: '#FFFFFF',
        fontWeight: FONT_WEIGHT.bold,
        fontSize: FONT_SIZE.s,
    },
    skipButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderRadius: 20,
    },
    skipButtonDisabled: {
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    skipButtonText: {
        color: '#000000',
        fontWeight: FONT_WEIGHT.bold,
        fontSize: FONT_SIZE.m,
    },
});

export default AdModal;
