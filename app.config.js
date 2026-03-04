require('dotenv').config();

const isProdBuild = process.env.EAS_BUILD_PROFILE === 'production' || process.env.NODE_ENV === 'production';
const isTestAdMobId = (value) => typeof value === 'string' && value.includes('ca-app-pub-3940256099942544');

if (!process.env.GEMINI_API_KEY) {
    console.warn('\x1b[33m%s\x1b[0m', 'WARNING: GEMINI_API_KEY is not defined in environment variables.');
    console.warn('\x1b[33m%s\x1b[0m', 'AI Analysis feature will not work in this build.');
}

if (isProdBuild) {
    if (!process.env.ADMOB_ANDROID_APP_ID) {
        throw new Error('ADMOB_ANDROID_APP_ID is required for production builds.');
    }
    if (!process.env.ADMOB_REWARDED_AD_UNIT_ID) {
        throw new Error('ADMOB_REWARDED_AD_UNIT_ID is required for production builds.');
    }
    if (isTestAdMobId(process.env.ADMOB_ANDROID_APP_ID) || isTestAdMobId(process.env.ADMOB_REWARDED_AD_UNIT_ID)) {
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
            ]
        ],
        "orientation": "default",
        "icon": "./assets/icon.png",
        "userInterfaceStyle": "light",
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
                    "autoVerify": true,
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
                "projectId": "23d8d675-cd3e-4007-89d4-e5e4847fc447"
            },
            "geminiApiKey": process.env.GEMINI_API_KEY,
            "admobRewardedUnitId": process.env.ADMOB_REWARDED_AD_UNIT_ID
        }
    }
};
