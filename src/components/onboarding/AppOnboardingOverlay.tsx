import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    interpolate,
    Extrapolation,
    withTiming,
    runOnJS,
    FadeIn,
    FadeOut
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeContext } from '../../context/ThemeContext';
import { RADIUS, SPACING } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
const ONBOARDING_KEY = '@mcai_seen_app_onboarding';

const PAGES = [
    {
        key: 'welcome',
        title: 'Welcome to\nMcAi Player',
        description: 'Your premium, next-generation media player designed for ultimate performance and beauty.',
        icon: 'play-circle' as const,
        colors: ['rgba(59, 130, 246, 0.4)', 'rgba(147, 51, 234, 0.4)'],
    },
    {
        key: 'ai',
        title: 'The Magic of AI',
        description: 'Unlock our built-in Neural Engine to analyze scenes, enhance audio, and intelligently interact with your media.',
        icon: 'sparkles' as const,
        colors: ['rgba(147, 51, 234, 0.4)', 'rgba(236, 72, 153, 0.4)'],
    },
    {
        key: 'media',
        title: 'Universal Media',
        description: 'Flawlessly plays virtually any video or audio format, whether from your device or the web.',
        icon: 'folder-open' as const,
        colors: ['rgba(236, 72, 153, 0.4)', 'rgba(245, 158, 11, 0.4)'],
    },
    {
        key: 'theme',
        title: 'Personalize It',
        description: 'Make it yours with adaptive Dark and Light modes that sync perfectly with your system preferences.',
        icon: 'color-palette' as const,
        colors: ['rgba(245, 158, 11, 0.4)', 'rgba(16, 185, 129, 0.4)'],
    },
];

type Props = {
    onComplete?: () => void;
};

const AppOnboardingOverlay: React.FC<Props> = ({ onComplete }) => {
    const { colors, isDark } = useThemeContext();
    const [isVisible, setIsVisible] = useState(false);
    const scrollX = useSharedValue(0);
    const opacity = useSharedValue(1);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const hasSeen = await AsyncStorage.getItem(ONBOARDING_KEY);
                if (hasSeen !== 'true') {
                    setIsVisible(true);
                } else if (onComplete) {
                    onComplete();
                }
            } catch (error) {
                console.warn('Failed to read onboarding status', error);
                setIsVisible(true);
            }
        };
        void checkStatus();
    }, [onComplete]);

    const handleComplete = async () => {
        try {
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        } catch (error) {
            console.warn('Failed to save onboarding status', error);
        }
        
        opacity.value = withTiming(0, { duration: 400 }, () => {
            runOnJS(setIsVisible)(false);
            if (onComplete) runOnJS(onComplete)();
        });
    };

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollX.value = event.contentOffset.x;
        },
    });

    const overlayAnimatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
        };
    });

    if (!isVisible) return null;

    return (
        <Animated.View style={[styles.container, overlayAnimatedStyle]} exiting={FadeOut}>
            <BlurView intensity={isDark ? 80 : 90} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)' }]} />

            <Animated.ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                bounces={false}
                contentContainerStyle={{ width: width * PAGES.length }}
            >
                {PAGES.map((page, index) => {
                    return (
                        <Page 
                            key={page.key} 
                            page={page} 
                            index={index} 
                            scrollX={scrollX} 
                            themeColors={colors}
                            isDark={isDark} 
                        />
                    );
                })}
            </Animated.ScrollView>

            <View style={styles.footer}>
                <View style={styles.pagination}>
                    {PAGES.map((_, index) => {
                        return (
                            <Dot 
                                key={`dot-${index}`} 
                                index={index} 
                                scrollX={scrollX} 
                                primaryColor={colors.primary} 
                                inactiveColor={colors.borderSubtle}
                            />
                        );
                    })}
                </View>

                <TouchableOpacity 
                    style={[styles.button, { backgroundColor: colors.primary }]} 
                    onPress={handleComplete}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.buttonText, { color: colors.white }]}>Get Started</Text>
                    <Ionicons name="arrow-forward" size={20} color={colors.white} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

// Sub-component for each Page
const Page = ({ page, index, scrollX, themeColors, isDark }: any) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const animatedImageStyle = useAnimatedStyle(() => {
        const scale = interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP);
        const opacity = interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP);
        const translateY = interpolate(scrollX.value, inputRange, [100, 0, 100], Extrapolation.CLAMP);
        return {
            opacity,
            transform: [{ scale }, { translateY }],
        };
    });

    const animatedTextStyle = useAnimatedStyle(() => {
        const translateY = interpolate(scrollX.value, inputRange, [50, 0, -50], Extrapolation.CLAMP);
        const opacity = interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP);
        return {
            opacity,
            transform: [{ translateY }],
        };
    });

    return (
        <View style={styles.pageContainer}>
            <Animated.View style={[styles.imageContainer, animatedImageStyle, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
                {/* A cool gradient blob behind the icon */}
                <View style={[styles.gradientBlob, { backgroundColor: page.colors[0], transform: [{ translateX: -40 }, { translateY: -40 }] }]} />
                <View style={[styles.gradientBlob, { backgroundColor: page.colors[1], transform: [{ translateX: 40 }, { translateY: 40 }] }]} />
                
                <Ionicons name={page.icon} size={80} color={themeColors.primary} style={{ zIndex: 10 }} />
            </Animated.View>

            <Animated.View style={[styles.textContainer, animatedTextStyle]}>
                <Text style={[styles.title, { color: themeColors.text }]}>{page.title}</Text>
                <Text style={[styles.description, { color: themeColors.textSecondary }]}>{page.description}</Text>
            </Animated.View>
        </View>
    );
};

// Sub-component for Pagination Dot
const Dot = ({ index, scrollX, primaryColor, inactiveColor }: any) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const animatedDotStyle = useAnimatedStyle(() => {
        const dotWidth = interpolate(scrollX.value, inputRange, [8, 24, 8], Extrapolation.CLAMP);
        const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP);
        return {
            width: dotWidth,
            opacity,
            backgroundColor: scrollX.value >= (index - 0.5) * width && scrollX.value < (index + 0.5) * width ? primaryColor : inactiveColor
        };
    });

    return <Animated.View style={[styles.dot, animatedDotStyle]} />;
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999999, // Ensure it's on top of absolutely everything
        elevation: 1000,
    },
    pageContainer: {
        width,
        height: height * 0.75,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.xl,
    },
    imageContainer: {
        width: width * 0.6,
        height: width * 0.6,
        borderRadius: width * 0.3,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xxl,
        overflow: 'hidden',
    },
    gradientBlob: {
        position: 'absolute',
        width: width * 0.4,
        height: width * 0.4,
        borderRadius: width * 0.2,
        opacity: 0.6,
    },
    textContainer: {
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: SPACING.m,
        letterSpacing: -0.5,
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: SPACING.m,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: height * 0.25,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING.xxl,
    },
    pagination: {
        flexDirection: 'row',
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.l,
    },
    dot: {
        height: 8,
        borderRadius: 4,
        marginHorizontal: 4,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: SPACING.l,
        borderRadius: RADIUS.full,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonText: {
        fontSize: 18,
        fontWeight: '700',
    },
});

export default AppOnboardingOverlay;
