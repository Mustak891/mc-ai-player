import mobileAds, { RewardedInterstitialAd, TestIds, RewardedAdEventType, AdEventType } from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ADMOB_REWARDED_INTERSTITIAL_UNIT_ID } from '../../constants/keys';

type RewardedLimitState = {
    dayKey: string;
    shownCount: number;
    lastShownAt: number;
};

const REWARDED_LIMITS_STORAGE_KEY = 'ads:rewarded:limits:v1';
const REWARDED_COOLDOWN_MS = 2 * 60 * 1000;
const REWARDED_DAILY_CAP = 6;

class AdMobService {
    private isInitialized = false;
    private rewardedAd: RewardedInterstitialAd | null = null;
    private rewardedAdLoaded = false;

    // Use the official Google Mobile Ads Test ID for development to prevent accidental policy violations.
    // Before publishing, you can swap this with ADMOB_REWARDED_INTERSTITIAL_UNIT_ID from keys.ts if testing is finished.
    private adUnitId = __DEV__ ? TestIds.REWARDED_INTERSTITIAL : ADMOB_REWARDED_INTERSTITIAL_UNIT_ID;

    private getTodayKey(now = new Date()) {
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private formatRemainingMs(ms: number) {
        const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        if (minutes > 0) {
            return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
        }
        return `${seconds}s`;
    }

    private async readRewardedLimitState(): Promise<RewardedLimitState> {
        try {
            const raw = await AsyncStorage.getItem(REWARDED_LIMITS_STORAGE_KEY);
            if (!raw) {
                return {
                    dayKey: this.getTodayKey(),
                    shownCount: 0,
                    lastShownAt: 0,
                };
            }

            const parsed = JSON.parse(raw) as Partial<RewardedLimitState>;
            const safeDayKey = typeof parsed.dayKey === 'string' ? parsed.dayKey : this.getTodayKey();
            const safeShownCount = Number.isFinite(parsed.shownCount) ? Math.max(0, Number(parsed.shownCount)) : 0;
            const safeLastShownAt = Number.isFinite(parsed.lastShownAt) ? Math.max(0, Number(parsed.lastShownAt)) : 0;

            const today = this.getTodayKey();
            if (safeDayKey !== today) {
                return {
                    dayKey: today,
                    shownCount: 0,
                    lastShownAt: safeLastShownAt,
                };
            }

            return {
                dayKey: safeDayKey,
                shownCount: safeShownCount,
                lastShownAt: safeLastShownAt,
            };
        } catch {
            return {
                dayKey: this.getTodayKey(),
                shownCount: 0,
                lastShownAt: 0,
            };
        }
    }

    private async writeRewardedLimitState(state: RewardedLimitState) {
        try {
            await AsyncStorage.setItem(REWARDED_LIMITS_STORAGE_KEY, JSON.stringify(state));
        } catch {
            // Best-effort only.
        }
    }

    private async getRewardedAvailability(): Promise<{ allowed: boolean; message?: string }> {
        const now = Date.now();
        const state = await this.readRewardedLimitState();

        if (state.shownCount >= REWARDED_DAILY_CAP) {
            return {
                allowed: false,
                message: 'Daily AI ad limit reached. Please try again tomorrow.',
            };
        }

        const elapsedSinceLast = now - state.lastShownAt;
        if (state.lastShownAt > 0 && elapsedSinceLast < REWARDED_COOLDOWN_MS) {
            const remaining = REWARDED_COOLDOWN_MS - elapsedSinceLast;
            return {
                allowed: false,
                message: `AI Analysis is on cooldown. Try again in ${this.formatRemainingMs(remaining)}.`,
            };
        }

        return { allowed: true };
    }

    private async recordRewardedImpression() {
        const now = Date.now();
        const state = await this.readRewardedLimitState();
        const today = this.getTodayKey();
        const nextState: RewardedLimitState = {
            dayKey: today,
            shownCount: state.dayKey === today ? state.shownCount + 1 : 1,
            lastShownAt: now,
        };
        await this.writeRewardedLimitState(nextState);
    }

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

        const ad = RewardedInterstitialAd.createForAdRequest(this.adUnitId, {
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

        const availability = await this.getRewardedAvailability();
        if (!availability.allowed) {
            throw new Error(availability.message || 'AI ad is not available right now.');
        }

        const ready = await this.waitForRewardedAdLoad();
        if (!ready || !this.rewardedAd) {
            this.preloadRewardedAd();
            throw new Error("No Internet Connection: Please check your network to load the ad and use the AI.");
        }

        return new Promise((resolve, reject) => {
            const ad = this.rewardedAd!;

            let userEarnedReward = false;
            let dismissHandled = false;

            const handleCompletion = async (earned: boolean) => {
                if (dismissHandled) return;
                dismissHandled = true;
                unsubscribeEarned();
                unsubscribeClosed();
                unsubscribeError();
                if (earned) {
                    await this.recordRewardedImpression();
                }
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
                    // Only return true if they explicitly earned the reward before closing.
                    // This creates the strict "must watch full ad" enforcement.
                    void handleCompletion(userEarnedReward);
                }
            );

            const unsubscribeError = ad.addAdEventListener(
                AdEventType.ERROR,
                () => {
                    if (dismissHandled) return;
                    dismissHandled = true;
                    unsubscribeEarned();
                    unsubscribeClosed();
                    unsubscribeError();
                    this.preloadRewardedAd();
                    reject(new Error("No Internet Connection: Please check your network to load the ad and use the AI."));
                }
            );

            try {
                this.rewardedAdLoaded = false;
                ad.show();
            } catch {
                if (dismissHandled) return;
                dismissHandled = true;
                unsubscribeEarned();
                unsubscribeClosed();
                unsubscribeError();
                this.preloadRewardedAd();
                reject(new Error("An unexpected error occurred while showing the ad."));
            }
        });
    }
}

export const adMobService = new AdMobService();
