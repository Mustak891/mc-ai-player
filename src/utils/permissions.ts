import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

export type StoragePermissionKind = 'audio' | 'photo' | 'video';

const hasMediaAccess = (permission: MediaLibrary.PermissionResponse) =>
    permission.granted || permission.accessPrivileges === 'limited';

const getGranularPermissions = (
    kind: StoragePermissionKind
): MediaLibrary.GranularPermission[] | undefined => {
    if (Platform.OS !== 'android') {
        return undefined;
    }
    return [kind];
};

export const checkStoragePermission = async (
    kind: StoragePermissionKind = 'video'
): Promise<boolean> => {
    try {
        const res = await MediaLibrary.getPermissionsAsync(false, getGranularPermissions(kind));
        return hasMediaAccess(res);
    } catch {
        return false;
    }
};

const pendingRequests = new Map<StoragePermissionKind, Promise<boolean>>();

export const requestStoragePermission = async (
    kind: StoragePermissionKind = 'video'
): Promise<boolean> => {
    const existingRequest = pendingRequests.get(kind);
    if (existingRequest) {
        return existingRequest;
    }

    const requestPromise = (async () => {
        try {
            const res = await MediaLibrary.requestPermissionsAsync(false, getGranularPermissions(kind));
            return hasMediaAccess(res);
        } catch (e) {
            console.error('Permission Request Error', e);
            return false;
        } finally {
            pendingRequests.delete(kind);
        }
    })();

    pendingRequests.set(kind, requestPromise);
    return requestPromise;
};
