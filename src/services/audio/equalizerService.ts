import { NativeModules, Platform } from 'react-native';

type EqualizerNativeModule = {
    isSupported: () => Promise<boolean>;
    attachToPlayerSession: (sessionId: number) => Promise<void>;
    setEnabled: (enabled: boolean) => Promise<void>;
    setPreampDb: (value: number) => Promise<void>;
    setBandGainDb: (index: number, value: number) => Promise<void>;
    reset: () => Promise<void>;
    release: () => Promise<void>;
};

const MODULE_NAME = 'McAiEqualizer';

const getModule = (): EqualizerNativeModule | null => {
    const module = (NativeModules as any)?.[MODULE_NAME];
    if (!module) return null;
    return module as EqualizerNativeModule;
};

const clampDb = (value: number) => Math.min(20, Math.max(-20, value));

export const equalizerService = {
    async isSupported(): Promise<boolean> {
        if (Platform.OS !== 'android') return false;
        const mod = getModule();
        if (!mod?.isSupported) return false;
        try {
            return await mod.isSupported();
        } catch {
            return false;
        }
    },

    async attachToPlayerSession(sessionId: number): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod?.attachToPlayerSession) return;
        await mod.attachToPlayerSession(Math.max(0, Math.floor(sessionId)));
    },

    async setEnabled(enabled: boolean): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod?.setEnabled) return;
        await mod.setEnabled(!!enabled);
    },

    async setPreampDb(value: number): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod?.setPreampDb) return;
        await mod.setPreampDb(clampDb(value));
    },

    async setBandGainDb(index: number, value: number): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod?.setBandGainDb) return;
        await mod.setBandGainDb(Math.max(0, Math.floor(index)), clampDb(value));
    },

    async applyPreset(presetId: string): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod) return;
        if (mod.reset) {
            await mod.reset();
        }
        void presetId;
    },

    async reset(): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod?.reset) return;
        await mod.reset();
    },

    async release(): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod?.release) return;
        await mod.release();
    },
};

