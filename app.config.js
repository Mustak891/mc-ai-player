import 'dotenv/config';

export default {
    "expo": {
        "name": "McAi Player",
        "slug": "mc-ai-player",
        "version": "1.0.0",
        "plugins": [
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
                "projectId": "5ada4e0a-abba-4809-b18b-5fa6327e3d9e"
            },
            "geminiApiKey": process.env.GEMINI_API_KEY,
            "admobRewardedUnitId": process.env.ADMOB_REWARDED_AD_UNIT_ID
        }
    }
};
