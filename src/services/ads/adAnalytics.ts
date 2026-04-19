import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLE_AD_ANALYTICS_DEBUG = false;
const AD_ANALYTICS_STORAGE_KEY = 'ad_analytics_v1';

type SlotStats = {
  rendered: number;
  viewable: number;
  lastRenderedAt?: string;
  lastViewableAt?: string;
};

type AnalyticsState = {
  dayKey: string;
  slots: Record<string, SlotStats>;
};

const createEmptyState = (dayKey: string): AnalyticsState => ({
  dayKey,
  slots: {},
});

const getDayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

let state: AnalyticsState = createEmptyState(getDayKey());
let loaded = false;
let loadPromise: Promise<void> | null = null;

const debugLog = (message: string) => {
  if (__DEV__ && ENABLE_AD_ANALYTICS_DEBUG) {
    console.log(message);
  }
};

const hydrateState = async () => {
  if (loaded) return;

  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(AD_ANALYTICS_STORAGE_KEY);
        if (!stored) {
          state = createEmptyState(getDayKey());
          loaded = true;
          return;
        }

        const parsed = JSON.parse(stored) as Partial<AnalyticsState> | null;
        const dayKey = getDayKey();
        if (!parsed || parsed.dayKey !== dayKey || !parsed.slots || typeof parsed.slots !== 'object') {
          state = createEmptyState(dayKey);
          loaded = true;
          return;
        }

        state = {
          dayKey,
          slots: parsed.slots,
        };
        loaded = true;
      } catch {
        state = createEmptyState(getDayKey());
        loaded = true;
      }
    })();
  }

  await loadPromise;
};

const persistState = async () => {
  try {
    await AsyncStorage.setItem(AD_ANALYTICS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best effort only.
  }
};

const trackSlot = async (slotId: string, field: 'rendered' | 'viewable') => {
  if (!slotId) return;

  await hydrateState();

  const slotStats = state.slots[slotId] ?? { rendered: 0, viewable: 0 };
  slotStats[field] += 1;
  if (field === 'rendered') {
    slotStats.lastRenderedAt = new Date().toISOString();
  } else {
    slotStats.lastViewableAt = new Date().toISOString();
  }
  state.slots[slotId] = slotStats;

  debugLog(`[AdAnalytics] ${field}: ${slotId}`);
  void persistState();
};

const getSortedSlotEntries = () =>
  Object.entries(state.slots).sort((left, right) => right[1].viewable - left[1].viewable || right[1].rendered - left[1].rendered);

export const adAnalytics = {
  trackSlotRendered(slotId: string) {
    void trackSlot(slotId, 'rendered');
  },

  trackSlotViewable(slotId: string) {
    void trackSlot(slotId, 'viewable');
  },

  async getSnapshot() {
    await hydrateState();

    const slots = getSortedSlotEntries().map(([slotId, stats]) => ({
      slotId,
      ...stats,
    }));

    return {
      dayKey: state.dayKey,
      rendered: slots.reduce((total, slot) => total + slot.rendered, 0),
      viewable: slots.reduce((total, slot) => total + slot.viewable, 0),
      slots,
    };
  },

  async reset() {
    state = createEmptyState(getDayKey());
    loaded = true;
    loadPromise = Promise.resolve();
    await persistState();
  },
};
