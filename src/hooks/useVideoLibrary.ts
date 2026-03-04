import { useState, useEffect, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { Alert, InteractionManager } from 'react-native';

export const useVideoLibrary = (lazy: boolean = false) => {
    const [videos, setVideos] = useState<MediaLibrary.Asset[]>([]);
    const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
    const [isLoading, setIsLoading] = useState(false);
    // Track whether a fetch is already in progress to prevent duplicate calls
    const fetchingRef = useRef(false);
    // Track the latest lazy value without triggering re-renders
    const lazyRef = useRef(lazy);

    useEffect(() => {
        lazyRef.current = lazy;
    }, [lazy]);

    const fetchVideos = async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        if (!permissionResponse?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Alert.alert('Permission needed', 'Please grant permission to access video files.');
                fetchingRef.current = false;
                return;
            }
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
    };

    useEffect(() => {
        if (lazy) return;

        // Use InteractionManager to defer the fetch until after any active
        // navigation animations are fully complete. This prevents the
        // setIsLoading(true) state update from causing a visible re-render
        // of the library screen during a navigation transition.
        const task = InteractionManager.runAfterInteractions(() => {
            void fetchVideos();
        });

        return () => {
            task.cancel();
        };
    }, [permissionResponse, lazy]);

    return { videos, isLoading, refetch: fetchVideos };
};
