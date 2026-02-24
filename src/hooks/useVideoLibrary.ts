import { useState, useEffect } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';

export const useVideoLibrary = (lazy: boolean = false) => {
    const [videos, setVideos] = useState<MediaLibrary.Asset[]>([]);
    const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
    const [isLoading, setIsLoading] = useState(false);

    const fetchVideos = async () => {
        if (!permissionResponse?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Alert.alert('Permission needed', 'Please grant permission to access video files.');
                return;
            }
        }

        setIsLoading(true);
        try {
            const media = await MediaLibrary.getAssetsAsync({
                mediaType: MediaLibrary.MediaType.video,
                first: 100, // Load first 100 for now, add pagination later if needed
                sortBy: [MediaLibrary.SortBy.creationTime],
            });
            setVideos(media.assets);
        } catch (error) {
            console.error('Error fetching videos:', error);
            Alert.alert('Error', 'Failed to load videos.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!lazy) {
            fetchVideos();
        }
    }, [permissionResponse, lazy]);

    return { videos, isLoading, refetch: fetchVideos };
};
