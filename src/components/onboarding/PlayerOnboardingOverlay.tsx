import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeContext } from '../../context/ThemeContext';
import { RADIUS, SPACING } from '../../constants/theme';

const ONBOARDING_KEY = '@mcai_seen_player_onboarding';
const { width, height } = Dimensions.get('window');

type Props = {
    onDismiss?: () => void;
};

const PlayerOnboardingOverlay: React.FC<Props> = ({ onDismiss }) => {
    const { colors } = useThemeContext();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const hasSeen = await AsyncStorage.getItem(ONBOARDING_KEY);
                if (hasSeen !== 'true') {
                    setIsVisible(true);
                } else if (onDismiss) {
                    onDismiss();
                }
            } catch (error) {
                console.warn('Failed to read player onboarding status', error);
                setIsVisible(true);
            }
        };
        void checkStatus();
    }, [onDismiss]);

    const handleDismiss = async () => {
        try {
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        } catch (error) {
            console.warn('Failed to save player onboarding status', error);
        }
        setIsVisible(false);
        if (onDismiss) onDismiss();
    };

    if (!isVisible) return null;

    return (
        <Animated.View style={styles.container} entering={FadeIn} exiting={FadeOut}>
            {/* We don't use a full blur because we want the video underneath to be slightly visible, but mostly dark */}
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.8)' }]} />

            {/* Top Right: AI Button Highlight */}
            <View style={styles.aiButtonHighlight}>
                <View style={styles.pointerLineDown} />
                <Text style={styles.highlightTextRight}>Tap for AI Magic!</Text>
                <Ionicons name="sparkles" size={24} color={colors.primary} style={{ marginTop: 8 }} />
            </View>

            {/* Left Edge: Brightness Swipe */}
            <View style={styles.leftSwipeArea}>
                <Ionicons name="sunny-outline" size={32} color="white" />
                <Ionicons name="swap-vertical-outline" size={48} color="rgba(255,255,255,0.5)" style={{ marginVertical: 8 }} />
                <Text style={styles.gestureText}>Brightness</Text>
            </View>

            {/* Right Edge: Volume Swipe */}
            <View style={styles.rightSwipeArea}>
                <Ionicons name="volume-high-outline" size={32} color="white" />
                <Ionicons name="swap-vertical-outline" size={48} color="rgba(255,255,255,0.5)" style={{ marginVertical: 8 }} />
                <Text style={styles.gestureText}>Volume</Text>
            </View>

            {/* Center: Seek Swipe */}
            <View style={styles.centerSwipeArea}>
                <Ionicons name="swap-horizontal-outline" size={64} color="rgba(255,255,255,0.7)" />
                <Text style={styles.gestureTextCenter}>Swipe left/right to seek</Text>
            </View>

            {/* Bottom Button */}
            <View style={styles.bottomSection}>
                <TouchableOpacity 
                    style={[styles.dismissButton, { backgroundColor: colors.primary }]} 
                    onPress={handleDismiss}
                    activeOpacity={0.8}
                >
                    <Text style={styles.dismissText}>Got it!</Text>
                </TouchableOpacity>
            </View>

        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 99999, // Extremely high zIndex to cover the player controls
        elevation: 100,
    },
    aiButtonHighlight: {
        position: 'absolute',
        top: 60,
        right: 20,
        alignItems: 'flex-end',
    },
    pointerLineDown: {
        width: 2,
        height: 40,
        backgroundColor: 'white',
        marginRight: 24,
        marginBottom: 8,
    },
    highlightTextRight: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'right',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    leftSwipeArea: {
        position: 'absolute',
        top: '30%',
        left: '10%',
        alignItems: 'center',
    },
    rightSwipeArea: {
        position: 'absolute',
        top: '30%',
        right: '10%',
        alignItems: 'center',
    },
    centerSwipeArea: {
        position: 'absolute',
        top: '45%',
        alignSelf: 'center',
        alignItems: 'center',
    },
    gestureText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    gestureTextCenter: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 12,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    bottomSection: {
        position: 'absolute',
        bottom: 50,
        width: '100%',
        alignItems: 'center',
    },
    dismissButton: {
        paddingHorizontal: SPACING.xxl,
        paddingVertical: SPACING.l,
        borderRadius: RADIUS.full,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    dismissText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default PlayerOnboardingOverlay;
