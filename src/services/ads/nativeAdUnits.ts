import { TestIds } from 'react-native-google-mobile-ads';

import {
    ADMOB_NATIVE_AUDIO_UNIT_ID,
    ADMOB_NATIVE_BROWSE_UNIT_ID,
    ADMOB_NATIVE_FEED_UNIT_ID,
    ADMOB_NATIVE_SETTINGS_UNIT_ID,
    ADMOB_NATIVE_PLAYLIST_UNIT_ID,
    ADMOB_NATIVE_VIDEO_UNIT_ID,
} from '../../constants/keys';

export type NativeAdPlacement = 'video-grid' | 'video-list' | 'audio-list' | 'browse-list' | 'playlist-list' | 'settings-footer';

const placementUnitMap: Record<NativeAdPlacement, string> = {
    'video-grid': ADMOB_NATIVE_VIDEO_UNIT_ID || ADMOB_NATIVE_FEED_UNIT_ID,
    'video-list': ADMOB_NATIVE_FEED_UNIT_ID,
    'audio-list': ADMOB_NATIVE_AUDIO_UNIT_ID || ADMOB_NATIVE_FEED_UNIT_ID,
    'browse-list': ADMOB_NATIVE_BROWSE_UNIT_ID || ADMOB_NATIVE_FEED_UNIT_ID,
    'playlist-list': ADMOB_NATIVE_PLAYLIST_UNIT_ID || ADMOB_NATIVE_FEED_UNIT_ID,
    'settings-footer': ADMOB_NATIVE_SETTINGS_UNIT_ID || ADMOB_NATIVE_FEED_UNIT_ID,
};

export const resolveNativeAdUnitId = (placement: NativeAdPlacement) => {
    return __DEV__ ? TestIds.NATIVE : placementUnitMap[placement];
};