import Constants from 'expo-constants';

const extra =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ??
    ((Constants as any).manifest2?.extra as Record<string, unknown> | undefined) ??
    ((Constants as any).manifest?.extra as Record<string, unknown> | undefined) ??
    {};

export const GEMINI_API_KEY = (extra.geminiApiKey as string) ?? '';
export const AI_BACKEND_URL = (extra.aiBackendUrl as string) ?? '';
export const ADMOB_REWARDED_INTERSTITIAL_UNIT_ID = (extra.admobRewardedInterstitialUnitId as string) ?? '';
export const ADMOB_NATIVE_FEED_UNIT_ID = (extra.admobNativeFeedUnitId as string) ?? '';
export const ADMOB_NATIVE_VIDEO_UNIT_ID = (extra.admobNativeVideoUnitId as string) ?? '';
export const ADMOB_NATIVE_AUDIO_UNIT_ID = (extra.admobNativeAudioUnitId as string) ?? '';
export const ADMOB_NATIVE_SETTINGS_UNIT_ID = (extra.admobNativeSettingsUnitId as string) ?? '';
export const ADMOB_NATIVE_BROWSE_UNIT_ID = (extra.admobNativeBrowseUnitId as string) ?? '';
export const ADMOB_NATIVE_PLAYLIST_UNIT_ID = (extra.admobNativePlaylistUnitId as string) ?? '';
export const INLINE_AD_PROFILE = (extra.inlineAdProfile as string) ?? 'balanced';
