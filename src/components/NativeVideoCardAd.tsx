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
import { resolveNativeAdUnitId } from '../services/ads/nativeAdUnits';

const adUnitId = resolveNativeAdUnitId('video-grid');

const NativeVideoCardAd = () => {
  const { colors } = useThemeContext();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <View style={styles.outer}>
      <View style={styles.container}>
        <Text style={styles.sponsored}>Sponsored</Text>
        {isLoading && !nativeAd ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading ad...</Text>
          </View>
        ) : nativeAd ? (
          <NativeAdView nativeAd={nativeAd} style={styles.nativeCard}>
            <NativeMediaView style={styles.media} />
            <View style={styles.infoContainer}>
              <NativeAsset assetType={NativeAssetType.HEADLINE}>
                <Text numberOfLines={2} style={styles.headline}>
                  {nativeAd.headline}
                </Text>
              </NativeAsset>
              <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
                <View style={styles.ctaButton}>
                  <Text style={styles.ctaText}>{nativeAd.callToAction || 'Learn More'}</Text>
                </View>
              </NativeAsset>
            </View>
          </NativeAdView>
        ) : null}
      </View>
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    outer: {
      flex: 1,
      margin: SPACING.xs,
      maxWidth: '48%',
    },
    container: {
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: RADIUS.m,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    sponsored: {
      fontSize: FONT_SIZE.xxs,
      color: colors.textMuted,
      fontWeight: FONT_WEIGHT.medium,
      paddingHorizontal: SPACING.xs,
      paddingTop: SPACING.xs,
      paddingBottom: 4,
    },
    nativeCard: {
      width: '100%',
    },
    media: {
      width: '100%',
      height: 128,
      backgroundColor: colors.surfaceHigh,
    },
    infoContainer: {
      padding: SPACING.s,
      gap: SPACING.xs,
    },
    headline: {
      color: colors.text,
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semiBold,
      lineHeight: 17,
      minHeight: 34,
    },
    ctaButton: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      borderRadius: RADIUS.s,
      paddingHorizontal: SPACING.s,
      paddingVertical: 4,
    },
    ctaText: {
      color: colors.white,
      fontSize: FONT_SIZE.xxs,
      fontWeight: FONT_WEIGHT.bold,
    },
    loadingState: {
      height: 190,
      justifyContent: 'center',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: FONT_SIZE.xs,
    },
  });

export default NativeVideoCardAd;
