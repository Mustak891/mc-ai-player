import { NativeModules, Platform } from 'react-native';

type PiPModule = {
    isSupported: () => Promise<boolean>;
    isPermissionEnabled?: () => Promise<boolean>;
    setAutoEnterEnabled: (enabled: boolean) => Promise<void>;
    enter: (width: number, height: number, isPlaying: boolean) => Promise<void>;
    updateActions: (isPlaying: boolean) => Promise<void>;
    openSettings: () => Promise<void>;
    bringAppToFront?: () => Promise<void>;
};

const getModule = (): PiPModule | null => {
    const mod = (NativeModules as any)?.McAiPictureInPicture;
    if (!mod) return null;
    return mod as PiPModule;
};

export const pictureInPictureService = {
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

    async setAutoEnterEnabled(enabled: boolean): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod?.setAutoEnterEnabled) return;
        await mod.setAutoEnterEnabled(enabled);
    },

    async isPermissionEnabled(): Promise<boolean> {
        if (Platform.OS !== 'android') return false;
        const mod = getModule();
        if (!mod?.isPermissionEnabled) return true;
        try {
            return await mod.isPermissionEnabled();
        } catch {
            return true;
        }
    },

    async enter(width = 16, height = 9, isPlaying = true): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod?.enter) return;
        await mod.enter(width, height, isPlaying);
    },

    async updateActions(isPlaying: boolean): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod?.updateActions) return;
        await mod.updateActions(isPlaying);
    },

    async openSettings(): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod?.openSettings) return;
        await mod.openSettings();
    },

    async bringAppToFront(): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod?.bringAppToFront) return;
        await mod.bringAppToFront();
    },
};
