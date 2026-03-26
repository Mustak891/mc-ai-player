import { PermissionsAndroid, Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

export const checkStoragePermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
        const res = await MediaLibrary.getPermissionsAsync();
        return res.granted;
    }
    try {
        if ((Platform.Version as number) >= 33) {
            const hasVideo = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO);
            const hasAudio = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
            return hasVideo || hasAudio;
        } else {
            return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        }
    } catch (e) {
        return false;
    }
};

let isRequesting = false;

export const requestStoragePermission = async (): Promise<boolean> => {
    if (isRequesting) return false;
    
    if (Platform.OS !== 'android') {
        const res = await MediaLibrary.requestPermissionsAsync();
        return res.granted;
    }
    
    isRequesting = true;
    try {
        if ((Platform.Version as number) >= 33) {
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
                PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
                PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
            ]);
            return (
                granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] === PermissionsAndroid.RESULTS.GRANTED ||
                granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
            );
        } else {
            const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
            return result === PermissionsAndroid.RESULTS.GRANTED;
        }
    } catch (e) {
        console.error('Permission Request Error', e);
        return false;
    } finally {
        isRequesting = false;
    }
};
