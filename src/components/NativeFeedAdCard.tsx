import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
    NativeAd,
    NativeAdView,
    NativeAsset,
    NativeAssetType,
    NativeMediaView,
} from 'react-native-google-mobile-ads';
import { useThemeContext } from '../context/ThemeContext';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../constants/theme';
import { NativeAdPlacement, resolveNativeAdUnitId } from '../services/ads/nativeAdUnits';

type NativeFeedAdCardProps = {
    placement?: NativeAdPlacement;
};

const NativeFeedAdCard = ({ placement = 'browse-list' }: NativeFeedAdCardProps) => {
    const { colors } = useThemeContext();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const adUnitId = resolveNativeAdUnitId(placement);
    const isCompact = placement === 'audio-list' || placement === 'settings-footer';

    useEffect(() => {
        let mounted = true;
        let loadedAd: NativeAd | null = null;

        if (!adUnitId) {
            return () => {
                mounted = false;
            };
        }

        setIsLoading(true);
        void (async () => {
            try {
                const ad = await NativeAd.createForAdRequest(adUnitId, {
                    requestNonPersonalizedAdsOnly: true,
                });
                if (!mounted) {
                    ad.destroy();
                    return;
                }
                loadedAd = ad;
                setNativeAd(ad);
            } catch {
                if (mounted) {
                    setNativeAd(null);
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        })();

        return () => {
            mounted = false;
            if (loadedAd) {
                loadedAd.destroy();
            }
        };
    }, [adUnitId]);

    if (!adUnitId) return null;

    if (isLoading && !nativeAd) {
        return (
            <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Loading sponsored content...</Text>
            </View>
        );
    }

    if (!nativeAd) return null;

    return (
        <View style={[styles.cardShell, isCompact && styles.compactCardShell]}>
            <Text style={styles.sponsoredTag}>Sponsored</Text>
            <NativeAdView nativeAd={nativeAd} style={[styles.card, isCompact && styles.compactCard]}>
                <View style={[styles.mediaWrap, isCompact && styles.compactMediaWrap]}>
                    <NativeMediaView style={[styles.media, isCompact && styles.compactMedia]} />
                </View>
                <View style={[styles.content, isCompact && styles.compactContent]}>
                    <NativeAsset assetType={NativeAssetType.HEADLINE}>
                        <Text numberOfLines={isCompact ? 2 : 2} style={[styles.headline, isCompact && styles.compactHeadline]}>
                            {nativeAd.headline}
                        </Text>
                    </NativeAsset>

                    <NativeAsset assetType={NativeAssetType.BODY}>
                        <Text numberOfLines={isCompact ? 2 : 2} style={[styles.body, isCompact && styles.compactBody]}>
                            {nativeAd.body}
                        </Text>
                    </NativeAsset>

                    <View style={styles.ctaRow}>
                        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
                            <View style={[styles.ctaButton, isCompact && styles.compactCtaButton]}>
                                <Text style={styles.ctaText}>{nativeAd.callToAction || 'Learn more'}</Text>
                            </View>
                        </NativeAsset>
                    </View>
                </View>
            </NativeAdView>
        </View>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        cardShell: {
            marginTop: SPACING.m,
            marginHorizontal: SPACING.s,
            borderRadius: RADIUS.m,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.surface,
            overflow: 'hidden',
        },
        compactCardShell: {
            borderRadius: RADIUS.l,
        },
        sponsoredTag: {
            color: colors.textMuted,
            fontSize: FONT_SIZE.xs,
            fontWeight: FONT_WEIGHT.medium,
            paddingHorizontal: SPACING.s,
            paddingTop: SPACING.s,
        },
        card: {
            width: '100%',
        },
        compactCard: {
            flexDirection: 'row',
            alignItems: 'stretch',
            gap: SPACING.s,
            paddingHorizontal: SPACING.s,
            paddingBottom: SPACING.s,
        },
        mediaWrap: {
            width: '100%',
        },
        compactMediaWrap: {
            width: 72,
            marginTop: SPACING.xs,
            marginBottom: SPACING.xs,
            flexShrink: 0,
        },
        media: {
            width: '100%',
            aspectRatio: 16 / 9,
            backgroundColor: colors.surfaceHigh,
            marginTop: SPACING.xs,
        },
        compactMedia: {
            width: 72,
            height: 72,
            aspectRatio: undefined,
            borderRadius: RADIUS.m,
            marginTop: 0,
        },
        content: {
            padding: SPACING.s,
            gap: SPACING.xs,
        },
        compactContent: {
            flex: 1,
            paddingLeft: 0,
            paddingRight: 0,
            justifyContent: 'center',
        },
        headline: {
            color: colors.text,
            fontSize: FONT_SIZE.s,
            fontWeight: FONT_WEIGHT.semiBold,
        },
        compactHeadline: {
            fontSize: FONT_SIZE.xs,
        },
        body: {
            color: colors.textSecondary,
            fontSize: FONT_SIZE.xs,
            lineHeight: 18,
        },
        compactBody: {
            fontSize: FONT_SIZE.xxs,
            lineHeight: 15,
        },
        ctaRow: {
            marginTop: SPACING.xs,
            alignItems: 'flex-start',
        },
        ctaButton: {
            backgroundColor: colors.primary,
            paddingHorizontal: SPACING.m,
            paddingVertical: SPACING.xs,
            borderRadius: RADIUS.s,
        },
        compactCtaButton: {
            paddingHorizontal: SPACING.s,
            paddingVertical: 5,
        },
        ctaText: {
            color: colors.white,
            fontSize: FONT_SIZE.xs,
            fontWeight: FONT_WEIGHT.bold,
        },
        loadingCard: {
            marginTop: SPACING.m,
            marginHorizontal: SPACING.s,
            borderRadius: RADIUS.m,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.surface,
            padding: SPACING.m,
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACING.s,
        },
        loadingText: {
            color: colors.textSecondary,
            fontSize: FONT_SIZE.xs,
        },
    });

export default NativeFeedAdCard;
