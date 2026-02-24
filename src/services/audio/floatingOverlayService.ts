import { NativeModules, Platform } from 'react-native';

type FloatingOverlayModule = {
    isSupported: () => Promise<boolean>;
    isPermissionGranted: () => Promise<boolean>;
    openPermissionSettings: () => Promise<void>;
    startOverlay: (uri: string, positionMs: number, playWhenReady: boolean, title?: string) => Promise<void>;
    stopOverlay: () => Promise<void>;
};

const getModule = (): FloatingOverlayModule | null => {
    const mod = (NativeModules as any)?.McAiFloatingOverlay;
    if (!mod) return null;
    return mod as FloatingOverlayModule;
};

export const floatingOverlayService = {
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

    async isPermissionGranted(): Promise<boolean> {
        if (Platform.OS !== 'android') return false;
        const mod = getModule();
        if (!mod?.isPermissionGranted) return false;
        try {
            return await mod.isPermissionGranted();
        } catch {
            return false;
        }
    },

    async openPermissionSettings(): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod?.openPermissionSettings) return;
        await mod.openPermissionSettings();
    },

    async startOverlay(uri: string, positionMs: number, playWhenReady: boolean, title?: string): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod?.startOverlay) return;
        await mod.startOverlay(uri, positionMs, playWhenReady, title);
    },

    async stopOverlay(): Promise<void> {
        if (Platform.OS !== 'android') return;
        const mod = getModule();
        if (!mod?.stopOverlay) return;
        await mod.stopOverlay();
    },
};

