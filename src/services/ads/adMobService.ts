import mobileAds, { RewardedAd, TestIds, RewardedAdEventType, AdEventType } from 'react-native-google-mobile-ads';
import { ADMOB_REWARDED_AD_UNIT_ID } from '../../constants/keys';

class AdMobService {
    private isInitialized = false;
    private rewardedAd: RewardedAd | null = null;

    // Use the official Google Mobile Ads Test ID for development to prevent accidental policy violations.
    // Before publishing, you can swap this with ADMOB_REWARDED_AD_UNIT_ID from keys.ts if testing is finished.
    private adUnitId = __DEV__ ? TestIds.REWARDED : ADMOB_REWARDED_AD_UNIT_ID;

    constructor() {
        this.initialize();
    }

    async initialize() {
        if (this.isInitialized) return;
        try {
            await mobileAds().initialize();
            this.isInitialized = true;
            this.preloadRewardedAd();
        } catch (error) {
            console.error("AdMob initialization failed:", error);
        }
    }

    private preloadRewardedAd() {
        if (!this.isInitialized) return;

        this.rewardedAd = RewardedAd.createForAdRequest(this.adUnitId, {
            requestNonPersonalizedAdsOnly: true,
        });

        // Event listener for ad loaded
        const unsubscribeLoaded = this.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
            console.log('Rewarded ad loaded successfully.');
        });

        this.rewardedAd.load();
    }

    public async showRewardedAd(): Promise<boolean> {
        return new Promise((resolve) => {
            if (!this.rewardedAd) {
                this.preloadRewardedAd();
                // If ad isn't loaded immediately, we just skip it for now or we could wait. Let's just resolve.
                console.warn('Ad not ready yet.');
                resolve(false);
                return;
            }

            let userEarnedReward = false;
            let dismissHandled = false;

            const handleCompletion = (earned: boolean) => {
                if (dismissHandled) return;
                dismissHandled = true;
                unsubscribeEarned();
                unsubscribeClosed();
                // Preload the next ad for next time.
                this.preloadRewardedAd();
                resolve(earned);
            };

            const unsubscribeEarned = this.rewardedAd.addAdEventListener(
                RewardedAdEventType.EARNED_REWARD,
                () => {
                    userEarnedReward = true;
                }
            );

            const unsubscribeClosed = this.rewardedAd.addAdEventListener(
                AdEventType.CLOSED,
                () => {
                    handleCompletion(userEarnedReward);
                }
            );

            try {
                this.rewardedAd.show();
            } catch (error) {
                console.error('Failed to show rewarded ad:', error);
                handleCompletion(false);
            }
        });
    }
}

export const adMobService = new AdMobService();
