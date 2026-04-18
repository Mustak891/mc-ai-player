import { INLINE_AD_PROFILE } from '../../constants/keys';

export type InlineAdSlot = {
    slotId: string;
    insertAfterCount: number;
};

export type InlineAdProfile = 'conservative' | 'balanced' | 'revenue-first';

type BuildInlineAdSlotsParams = {
    contentCount: number;
    slotPrefix: string;
    maxAds?: number;
    maxDensity?: number;
    profile?: InlineAdProfile;
};

const normalizeInlineAdProfile = (value: unknown): InlineAdProfile => {
    const normalized = (typeof value === 'string' ? value : 'balanced').trim().toLowerCase();
    if (normalized === 'conservative') return 'conservative';
    if (normalized === 'revenue-first' || normalized === 'revenue_first' || normalized === 'revenuefirst') {
        return 'revenue-first';
    }
    return 'balanced';
};

const activeInlineAdProfile = normalizeInlineAdProfile(INLINE_AD_PROFILE);

const getProfileMaxDensity = (profile: InlineAdProfile) => {
    if (profile === 'conservative') return 0.15;
    if (profile === 'revenue-first') return 0.2;
    return 0.18;
};

const getFirstInsertAfterCount = (contentCount: number, profile: InlineAdProfile) => {
    if (profile === 'conservative') {
        if (contentCount >= 120) return 6;
        if (contentCount >= 60) return 7;
        return 8;
    }

    if (profile === 'revenue-first') {
        if (contentCount >= 80) return 5;
        if (contentCount >= 30) return 6;
        return 7;
    }

    if (contentCount >= 90) return 5;
    if (contentCount >= 40) return 6;
    return 7;
};

const getIntervalByContentLength = (contentCount: number, profile: InlineAdProfile) => {
    if (profile === 'conservative') {
        if (contentCount >= 160) return 12;
        if (contentCount >= 90) return 13;
        if (contentCount >= 50) return 14;
        return 16;
    }

    if (profile === 'revenue-first') {
        if (contentCount >= 140) return 10;
        if (contentCount >= 80) return 11;
        if (contentCount >= 40) return 12;
        return 13;
    }

    if (contentCount >= 120) return 10;
    if (contentCount >= 80) return 11;
    if (contentCount >= 50) return 12;
    if (contentCount >= 30) return 13;
    return 14;
};

export const buildInlineAdSlots = ({
    contentCount,
    slotPrefix,
    maxAds = 4,
    maxDensity,
    profile = activeInlineAdProfile,
}: BuildInlineAdSlotsParams): InlineAdSlot[] => {
    if (!slotPrefix || contentCount <= 0) return [];

    const firstInsertAfterCount = getFirstInsertAfterCount(contentCount, profile);
    if (contentCount <= firstInsertAfterCount) return [];

    const density = typeof maxDensity === 'number' ? maxDensity : getProfileMaxDensity(profile);
    const maxByDensity = Math.floor(contentCount * density);
    const maxAllowedAds = Math.max(1, Math.min(maxAds, maxByDensity));
    const interval = getIntervalByContentLength(contentCount, profile);

    const slots: InlineAdSlot[] = [];
    let insertAfterCount = firstInsertAfterCount;

    while (insertAfterCount < contentCount && slots.length < maxAllowedAds) {
        slots.push({
            slotId: `${slotPrefix}-${slots.length + 1}`,
            insertAfterCount,
        });
        insertAfterCount += interval;
    }

    return slots;
};

export const getInlineAdProfile = () => activeInlineAdProfile;