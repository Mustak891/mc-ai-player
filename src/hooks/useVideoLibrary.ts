import { useState, useEffect, useRef, useCallback } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { checkStoragePermission, requestStoragePermission } from '../utils/permissions';

export const useVideoLibrary = (lazy: boolean = false) => {
    const [videos, setVideos] = useState<MediaLibrary.Asset[]>([]);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Track whether a fetch is already in progress to prevent duplicate calls
    const fetchingRef = useRef(false);
    const lazyRef = useRef(lazy);
    const hasRequestedRef = useRef(false);

    useEffect(() => {
        lazyRef.current = lazy;
    }, [lazy]);

    // AUTO-REQUEST ON MOUNT: Check silently, then request if needed.
    // This perfectly shows the native dialog on first launch automatically.
    useEffect(() => {
        let isMounted = true;
        if (hasRequestedRef.current) return;
        hasRequestedRef.current = true;

        const init = async () => {
            let granted = await checkStoragePermission('video');
            if (!granted) {
                granted = await requestStoragePermission('video');
            }
            if (isMounted) setHasPermission(granted);
        };
        void init();
        
        return () => { isMounted = false; };
    }, []);

    const fetchVideos = useCallback(async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        if (!hasPermission) {
            fetchingRef.current = false;
            return;
        }

        setIsLoading(true);
        try {
            const media = await MediaLibrary.getAssetsAsync({
                mediaType: MediaLibrary.MediaType.video,
                first: 100,
                sortBy: [[MediaLibrary.SortBy.creationTime, false]],
            });
            setVideos(media.assets);
        } catch (error) {
            console.error('Error fetching videos:', error);
            const details =
                error instanceof Error && error.message
                    ? error.message
                    : 'Failed to load videos from your device.';
            Alert.alert('Video Library Error', details);
        } finally {
            setIsLoading(false);
            fetchingRef.current = false;
        }
    }, [hasPermission]);

    // APP STATE LISTENER: When user comes back from Settings after granting permission,
    // automatically re-check and load videos without requiring a manual restart.
    useEffect(() => {
        const handleAppStateChange = (nextState: AppStateStatus) => {
            if (nextState === 'active') {
                void checkStoragePermission('video').then(granted => {
                    setHasPermission(granted);
                });
            }
        };
        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription.remove();
    }, []);

    // AUTO-FETCH: Whenever permission is granted and lazy=false, load the library.
    useEffect(() => {
        if (lazy) return;
        if (hasPermission) {
            void fetchVideos();
        }
    }, [hasPermission, lazy, fetchVideos]);

    const requestPermission = useCallback(async () => {
        const granted = await requestStoragePermission('video');
        setHasPermission(granted);
        return { granted, canAskAgain: true, status: granted ? 'granted' : 'denied' };
    }, []);

    return {
        videos,
        isLoading,
        refetch: fetchVideos,
        // isPermissionLoading: true while we haven't got an answer from the OS yet
        isPermissionLoading: hasPermission === null,
        hasPermission: hasPermission ?? false,
        canAskAgain: true, // Legacy compatibility, native OS handles prompts now.
        requestPermission,
    };
};
