require('dotenv').config();

const isProdBuild = process.env.EAS_BUILD_PROFILE === 'production';
const isTestAdMobId = (value) => typeof value === 'string' && value.includes('ca-app-pub-3940256099942544');

if (!process.env.GEMINI_API_KEY) {
    console.warn('\x1b[33m%s\x1b[0m', 'WARNING: GEMINI_API_KEY is not defined in environment variables.');
    console.warn('\x1b[33m%s\x1b[0m', 'AI Analysis feature will not work in this build.');
}

if (isProdBuild) {
    if (!process.env.ADMOB_ANDROID_APP_ID) {
        throw new Error('ADMOB_ANDROID_APP_ID is required for production builds.');
    }
    if (!process.env.ADMOB_REWARDED_INTERSTITIAL_UNIT_ID) {
        throw new Error('ADMOB_REWARDED_INTERSTITIAL_UNIT_ID is required for production builds.');
    }
    if (isTestAdMobId(process.env.ADMOB_ANDROID_APP_ID) || isTestAdMobId(process.env.ADMOB_REWARDED_INTERSTITIAL_UNIT_ID)) {
        throw new Error('Production build is using AdMob test IDs. Replace with live AdMob IDs.');
    }
}


module.exports = {
    "expo": {
        "name": "McAi Player",
        "slug": "mc-ai-player",
        "version": "1.0.0",
        "plugins": [
            "./withFFmpegExoPlayer.js",
            [
                "react-native-google-mobile-ads",
                {
                    "androidAppId": process.env.ADMOB_ANDROID_APP_ID
                }
            ],
            [
                "expo-build-properties",
                {
                    "android": {
                        "newArchEnabled": true,
                        "packagingOptions": {
                            "pickFirsts": [
                                "lib/x86/libc++_shared.so",
                                "lib/x86_64/libjsc.so",
                                "lib/arm64-v8a/libjsc.so",
                                "lib/arm64-v8a/libc++_shared.so",
                                "lib/x86_64/libc++_shared.so",
                                "lib/armeabi-v7a/libc++_shared.so"
                            ]
                        }
                    }
                }
            ]
        ],
        "orientation": "default",
        "icon": "./assets/icon.png",
        "userInterfaceStyle": "automatic",
        "splash": {
            "image": "./assets/transparent.png",
            "resizeMode": "contain",
            "backgroundColor": "#0c0c0c"
        },
        "ios": {
            "supportsTablet": true
        },
        "android": {
            "adaptiveIcon": {
                "foregroundImage": "./assets/adaptive-icon.png",
                "backgroundColor": "#ffffff"
            },
            "edgeToEdgeEnabled": true,
            "predictiveBackGestureEnabled": false,
            "package": "app.mcai.videoplayer",
            "intentFilters": [
                {
                    "action": "VIEW",
                    "data": [
                        { "mimeType": "audio/*" },
                        { "mimeType": "audio/*", "scheme": "content" },
                        { "mimeType": "audio/*", "scheme": "file" },
                        { "mimeType": "audio/*", "scheme": "http" },
                        { "mimeType": "audio/*", "scheme": "https" }
                    ],
                    "category": ["DEFAULT", "BROWSABLE"]
                },
                {
                    "action": "VIEW",
                    "data": [
                        { "mimeType": "video/*" },
                        { "mimeType": "video/*", "scheme": "content" },
                        { "mimeType": "video/*", "scheme": "file" },
                        { "mimeType": "video/*", "scheme": "http" },
                        { "mimeType": "video/*", "scheme": "https" }
                    ],
                    "category": ["DEFAULT", "BROWSABLE"]
                }
            ]
        },
        "web": {
            "favicon": "./assets/favicon.png"
        },
        "extra": {
            "eas": {
                "projectId": "f6010e19-92d1-4d38-9a94-6f5bbcbafcb0"
            },
            "geminiApiKey": process.env.GEMINI_API_KEY,
            "admobRewardedInterstitialUnitId": process.env.ADMOB_REWARDED_INTERSTITIAL_UNIT_ID
        }
    }
};
