import Constants from 'expo-constants';

const extra =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ??
    ((Constants as any).manifest2?.extra as Record<string, unknown> | undefined) ??
    ((Constants as any).manifest?.extra as Record<string, unknown> | undefined) ??
    {};

export const GEMINI_API_KEY = (extra.geminiApiKey as string) ?? '';
export const ADMOB_REWARDED_AD_UNIT_ID = (extra.admobRewardedUnitId as string) ?? '';
