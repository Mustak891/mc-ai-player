import { useState, useEffect, useRef, useCallback } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { Alert, AppState, AppStateStatus } from 'react-native';

export const useVideoLibrary = (lazy: boolean = false) => {
    const [videos, setVideos] = useState<MediaLibrary.Asset[]>([]);
    // Use granular permission hook — we will trigger the request ourselves
    const [permissionResponse, requestPermission] = MediaLibrary.usePermissions({ request: false });
    const [isLoading, setIsLoading] = useState(false);
    const [hasRequestedOnce, setHasRequestedOnce] = useState(false);

    // Track whether a fetch is already in progress to prevent duplicate calls
    const fetchingRef = useRef(false);
    const lazyRef = useRef(lazy);

    useEffect(() => {
        lazyRef.current = lazy;
    }, [lazy]);

    const fetchVideos = useCallback(async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        if (!permissionResponse?.granted) {
            fetchingRef.current = false;
            return;
        }

        setIsLoading(true);
        try {
            const media = await MediaLibrary.getAssetsAsync({
                mediaType: MediaLibrary.MediaType.video,
                first: 100,
                sortBy: [MediaLibrary.SortBy.creationTime],
            });
            setVideos(media.assets);
        } catch (error) {
            console.error('Error fetching videos:', error);
            Alert.alert('Error', 'Failed to load videos.');
        } finally {
            setIsLoading(false);
            fetchingRef.current = false;
        }
    }, [permissionResponse?.granted]);

    // AUTO-REQUEST ON MOUNT: If we haven't asked yet and canAskAgain is true, ask immediately.
    // This ensures on a fresh install the native dialog appears without the user needing to tap anything.
    useEffect(() => {
        if (hasRequestedOnce) return;
        if (permissionResponse === null) return; // Still loading permission status, wait

        if (!permissionResponse.granted && permissionResponse.canAskAgain) {
            setHasRequestedOnce(true);
            void requestPermission();
        } else {
            setHasRequestedOnce(true);
        }
    }, [permissionResponse, hasRequestedOnce, requestPermission]);

    // APP STATE LISTENER: When user comes back from Settings after granting permission,
    // automatically re-check and load videos without requiring a manual restart.
    useEffect(() => {
        const handleAppStateChange = (nextState: AppStateStatus) => {
            if (nextState === 'active') {
                // Re-fetch if the permission state has become granted
                if (permissionResponse?.granted) {
                    void fetchVideos();
                }
            }
        };
        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription.remove();
    }, [permissionResponse?.granted, fetchVideos]);

    // AUTO-FETCH: Whenever permission is granted and lazy=false, load the library.
    useEffect(() => {
        if (lazy) return;
        if (!permissionResponse?.granted) return;

        void fetchVideos();
    }, [permissionResponse?.granted, lazy, fetchVideos]);

    return {
        videos,
        isLoading,
        refetch: fetchVideos,
        // isPermissionLoading: true while we haven't got an answer from the OS yet
        isPermissionLoading: permissionResponse === null,
        hasPermission: permissionResponse?.granted ?? false,
        canAskAgain: permissionResponse?.canAskAgain ?? true,
        requestPermission,
    };
};
