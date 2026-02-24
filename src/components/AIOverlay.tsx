import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Detection } from '../services/ai/types';
import { useThemeContext } from '../context/ThemeContext';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../constants/theme';

interface AIOverlayProps {
    detections: Detection[];
    videoDimensions: { width: number; height: number };
    viewDimensions: { width: number; height: number };
    visible: boolean;
    isAnalyzing?: boolean;
    onClose?: () => void;
}

const AIOverlay = ({ detections, visible, isAnalyzing, onClose }: AIOverlayProps) => {
    const { colors } = useThemeContext();
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacityAnim, {
            toValue: visible || isAnalyzing ? 1 : 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [visible, isAnalyzing]);

    if (!visible && !isAnalyzing && detections.length === 0) return null;

    // Synthesize context: find the active scene
    const sceneDetection = detections.find(d => d.type === 'scene');

    return (
        <Animated.View style={[styles.container, { opacity: opacityAnim }]}>
            <View style={[styles.panel, { backgroundColor: 'rgba(10,10,10,0.85)', borderColor: 'rgba(255,255,255,0.15)' }]}>
                {/* Header / Scene Context */}
                <View style={styles.header}>
                    <Ionicons name="sparkles" size={14} color={isAnalyzing ? 'rgba(255,255,255,0.6)' : colors.primary} />
                    <View style={styles.textContent}>
                        <Text
                            style={[
                                styles.headerText,
                                { color: isAnalyzing ? 'rgba(255,255,255,0.6)' : '#FFFFFF' } // Enforce pure white text for readability against the dark glass panel
                            ]}
                        >
                            {isAnalyzing ? 'Analyzing frame...' : (sceneDetection?.metadata?.description || sceneDetection?.label || 'Scene details')}
                        </Text>
                    </View>
                    {!isAnalyzing && onClose && (
                        <Ionicons
                            name="close"
                            size={18}
                            color="rgba(255,255,255,0.7)"
                            style={styles.closeIcon}
                            onPress={onClose}
                        />
                    )}
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 85, // Safely below the TopBar
        right: SPACING.l,
        zIndex: 10,
        maxWidth: 200, // Wrap tightly for single words
    },
    panel: {
        padding: SPACING.m,
        borderRadius: RADIUS.m,
        borderWidth: 1,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    textContent: {
        flexShrink: 1,
        justifyContent: 'center',
    },
    headerText: {
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.semiBold,
        lineHeight: 18,
    },
    closeIcon: {
        padding: 4,
        marginLeft: SPACING.xs,
    },
});

export default AIOverlay;
