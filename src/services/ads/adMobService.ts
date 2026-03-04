import mobileAds, { RewardedAd, TestIds, RewardedAdEventType, AdEventType } from 'react-native-google-mobile-ads';
import { ADMOB_REWARDED_AD_UNIT_ID } from '../../constants/keys';

class AdMobService {
    private isInitialized = false;
    private rewardedAd: RewardedAd | null = null;
    private rewardedAdLoaded = false;

    // Use the official Google Mobile Ads Test ID for development to prevent accidental policy violations.
    // Before publishing, you can swap this with ADMOB_REWARDED_AD_UNIT_ID from keys.ts if testing is finished.
    private adUnitId = __DEV__ ? TestIds.REWARDED : ADMOB_REWARDED_AD_UNIT_ID;

    constructor() {
        void this.initialize();
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
        if (!this.isInitialized || !this.adUnitId) return;

        const ad = RewardedAd.createForAdRequest(this.adUnitId, {
            requestNonPersonalizedAdsOnly: true,
        });
        this.rewardedAd = ad;
        this.rewardedAdLoaded = false;

        // Event listener for ad loaded
        ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
            this.rewardedAdLoaded = true;
        });

        ad.addAdEventListener(AdEventType.ERROR, () => {
            this.rewardedAdLoaded = false;
        });

        ad.load();
    }

    private async waitForRewardedAdLoad(timeoutMs = 7000): Promise<boolean> {
        if (this.rewardedAd && this.rewardedAdLoaded) {
            return true;
        }

        if (!this.rewardedAd) {
            this.preloadRewardedAd();
        }

        const ad = this.rewardedAd;
        if (!ad) return false;

        return new Promise((resolve) => {
            let settled = false;
            const complete = (ready: boolean) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                unsubscribeLoaded();
                unsubscribeError();
                resolve(ready);
            };

            const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
                this.rewardedAdLoaded = true;
                complete(true);
            });

            const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
                this.rewardedAdLoaded = false;
                complete(false);
            });

            const timer = setTimeout(() => {
                complete(this.rewardedAdLoaded);
            }, timeoutMs);

            try {
                ad.load();
            } catch {
                complete(false);
            }
        });
    }

    public async showRewardedAd(options?: {
        onEarnedReward?: () => void;
    }): Promise<boolean> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const ready = await this.waitForRewardedAdLoad();
        if (!ready || !this.rewardedAd) {
            this.preloadRewardedAd();
            return false;
        }

        return new Promise((resolve) => {
            const ad = this.rewardedAd!;

            let userEarnedReward = false;
            let dismissHandled = false;

            const handleCompletion = (earned: boolean) => {
                if (dismissHandled) return;
                dismissHandled = true;
                unsubscribeEarned();
                unsubscribeClosed();
                unsubscribeError();
                // Preload the next ad for next time.
                this.preloadRewardedAd();
                resolve(earned);
            };

            const unsubscribeEarned = ad.addAdEventListener(
                RewardedAdEventType.EARNED_REWARD,
                () => {
                    userEarnedReward = true;
                    if (options?.onEarnedReward) {
                        try {
                            options.onEarnedReward();
                        } catch {
                            // Do not fail ad flow if callback logic throws.
                        }
                    }
                }
            );

            const unsubscribeClosed = ad.addAdEventListener(
                AdEventType.CLOSED,
                () => {
                    handleCompletion(userEarnedReward);
                }
            );

            const unsubscribeError = ad.addAdEventListener(
                AdEventType.ERROR,
                () => {
                    handleCompletion(false);
                }
            );

            try {
                this.rewardedAdLoaded = false;
                ad.show();
            } catch {
                handleCompletion(false);
            }
        });
    }
}

export const adMobService = new AdMobService();
