import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';
import FileRow from '../components/FileRow';
import { getParentDirectory } from '../utils/fileUtils';
import { RootStackParamList } from '../navigation/types';
import { readResumeStore } from '../utils/resumeStore';
import { formatTime } from '../utils/timeUtils';

interface FileItem {
    name: string;
    isDirectory: boolean;
    uri: string;
    size?: number;
    subtitle?: string;
}

type AndroidQuickAccessFolder = {
    folderName: string;
    label: string;
    subtitle: string;
};

const BROWSE_ROOT_URI = '__BROWSE_ROOT__';
const SHORTCUT_PREFIX = 'shortcut:';
const SHORTCUT_PICKER_URI = `${SHORTCUT_PREFIX}picker`;
const LAST_ANDROID_BROWSE_URI_KEY = 'browse:last-android-uri:v1';
const DEFAULT_ANDROID_ENTRY_FOLDER = 'Download';
const OPEN_VIDEO_DEDUP_WINDOW_MS = 650;
const PLAYABLE_EXTENSIONS = new Set([
    'mp4', 'm4v', 'mkv', 'mov', 'avi', 'webm', '3gp', '3g2', 'ts', 'm2ts', 'flv', 'mpeg', 'mpg',
    'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg',
]);
const SUBTITLE_EXTENSIONS = new Set(['srt', 'vtt']);
const ANDROID_QUICK_ACCESS_FOLDERS: AndroidQuickAccessFolder[] = [
    { folderName: 'Download', label: 'Downloads', subtitle: 'Most downloaded videos and files' },
    { folderName: 'Movies', label: 'Movies', subtitle: 'Common location for video files' },
    { folderName: 'DCIM', label: 'DCIM / Camera', subtitle: 'Camera and recorded media' },
    { folderName: 'Pictures', label: 'Pictures', subtitle: 'Images and screenshots' },
    { folderName: 'Music', label: 'Music', subtitle: 'Audio tracks and songs' },
    { folderName: 'Documents', label: 'Documents', subtitle: 'Documents and subtitle files' },
];

const formatSafPath = (uri: string) => {
    const decoded = decodeURIComponent(uri);
    const treePart = decoded.split('/tree/')[1]?.split('/document/')[0] || decoded;
    const normalized = treePart.replace(/^primary:/i, 'Internal Storage/');
    return normalized.replace(/:/g, '/');
};

const decodeUriSafe = (value: string) => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

const getFileNameFromUri = (uri: string) => {
    const decoded = decodeUriSafe(uri);
    const documentPart = decoded.includes('/document/') ? (decoded.split('/document/').pop() || decoded) : decoded;
    let candidate = documentPart.split('/').pop() || documentPart;
    if (candidate.includes(':')) {
        candidate = candidate.split(':').pop() || candidate;
    }
    const trimmed = candidate.trim();
    return trimmed || 'Video';
};

const getDisplayFileName = (name: string, uri: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.includes('/') || trimmed.includes(':')) {
        return getFileNameFromUri(uri);
    }
    return trimmed;
};

const isPlayableFileName = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    return PLAYABLE_EXTENSIONS.has(ext || '');
};

const isSubtitleFileName = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    return SUBTITLE_EXTENSIONS.has(ext || '');
};

const BrowseScreen = () => {
    const { colors } = useThemeContext();
    const styles = useMemo(() => useStyles(colors), [colors]);

    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const [currentPath, setCurrentPath] = useState(
        Platform.OS === 'android' ? BROWSE_ROOT_URI : (FileSystem.documentDirectory || '')
    );
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [directoryHistory, setDirectoryHistory] = useState<string[]>([]);
    const [resumeMap, setResumeMap] = useState<Record<string, number>>({});
    const lastOpenVideoRef = useRef<{ uri: string; at: number } | null>(null);

    const loadQuickAccessRoot = () => {
        if (Platform.OS !== 'android') return;
        const shortcutRows: FileItem[] = ANDROID_QUICK_ACCESS_FOLDERS.map((entry) => ({
            name: entry.label,
            subtitle: entry.subtitle,
            isDirectory: true,
            uri: `${SHORTCUT_PREFIX}${entry.folderName}`,
            size: 0,
        }));
        shortcutRows.push({
            name: 'Choose Folder…',
            subtitle: 'Open Android folder picker',
            isDirectory: true,
            uri: SHORTCUT_PICKER_URI,
            size: 0,
        });
        setFiles(shortcutRows);
        setCurrentPath(BROWSE_ROOT_URI);
    };

    const loadDirectory = async (
        uri: string,
        addToHistory = true,
        options?: { silentError?: boolean }
    ): Promise<boolean> => {
        const isSafUri = uri.startsWith('content://');
        if (addToHistory && currentPath && currentPath !== uri) {
            setDirectoryHistory((prev) => [...prev, currentPath]);
        }
        setIsLoading(true);
        try {
            const fileItems: FileItem[] = isSafUri
                ? await (async () => {
                    const entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
                    return Promise.all(entries.map(async (entryUri) => {
                        const fallbackName = getFileNameFromUri(entryUri);
                        try {
                            const info = await FileSystem.getInfoAsync(entryUri);
                            const name = info.exists && info.uri
                                ? getFileNameFromUri(info.uri)
                                : fallbackName;
                            return { name, uri: entryUri, isDirectory: !!info.isDirectory, size: info.exists ? info.size : 0 };
                        } catch {
                            return { name: fallbackName, uri: entryUri, isDirectory: false, size: 0 };
                        }
                    }));
                })()
                : await (async () => {
                    const result = await FileSystem.readDirectoryAsync(uri);
                    return Promise.all(result.map(async (name) => {
                        const itemUri = uri + (uri.endsWith('/') ? '' : '/') + name;
                        const info = await FileSystem.getInfoAsync(itemUri);
                        return {
                            name: getDisplayFileName(name, itemUri),
                            uri: itemUri,
                            isDirectory: info.isDirectory,
                            size: info.exists ? info.size : 0,
                        };
                    }));
                })();

            fileItems.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                return a.isDirectory ? -1 : 1;
            });
            setFiles(fileItems);
            setCurrentPath(uri);
            if (Platform.OS === 'android' && isSafUri) {
                void AsyncStorage.setItem(LAST_ANDROID_BROWSE_URI_KEY, uri);
            }
            return true;
        } catch {
            if (!options?.silentError) {
                Alert.alert('Error', 'Could not read directory.');
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        let active = true;
        if (Platform.OS === 'web') {
            setFiles([
                { name: 'Demo Folder', isDirectory: true, uri: 'demo/folder', size: 0 },
                { name: 'demo_video.mp4', isDirectory: false, uri: 'https://www.w3schools.com/html/mov_bbb.mp4', size: 1024 * 1024 * 5 },
            ]);
            setCurrentPath('Web Demo Storage');
            return;
        }
        void (async () => {
            if (Platform.OS === 'android') {
                const lastUri = await AsyncStorage.getItem(LAST_ANDROID_BROWSE_URI_KEY);
                if (lastUri) {
                    const restored = await loadDirectory(lastUri, false, { silentError: true });
                    if (!restored && active) {
                        loadQuickAccessRoot();
                    }
                    return;
                }
                if (active) {
                    loadQuickAccessRoot();
                }
                return;
            }
            if (FileSystem.documentDirectory) {
                await loadDirectory(FileSystem.documentDirectory, false, { silentError: true });
            }
        })();
        return () => { active = false; };
    }, []);

    useFocusEffect(
        useCallback(() => {
            let active = true;
            void (async () => {
                const store = await readResumeStore();
                if (active) setResumeMap(store);
            })();
            return () => { active = false; };
        }, [])
    );

    const requestStorageAccess = async (initialFolderName?: string) => {
        if (Platform.OS !== 'android') {
            Alert.alert('Info', 'Folder picker is currently available only on Android.');
            return;
        }
        try {
            const initialUri = currentPath.startsWith('content://')
                ? currentPath
                : FileSystem.StorageAccessFramework.getUriForDirectoryInRoot(
                    initialFolderName || DEFAULT_ANDROID_ENTRY_FOLDER
                );
            const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri);
            if (!permission.granted) {
                Alert.alert('Permission denied', 'Folder access was not granted.');
                return;
            }
            await loadDirectory(permission.directoryUri, true);
        } catch {
            Alert.alert('Error', 'Could not open folder picker.');
        }
    };

    const handleShortcutOpen = async (uri: string) => {
        if (uri === SHORTCUT_PICKER_URI) {
            await requestStorageAccess(DEFAULT_ANDROID_ENTRY_FOLDER);
            return;
        }
        const folderName = uri.replace(SHORTCUT_PREFIX, '').trim();
        if (!folderName) return;
        await requestStorageAccess(folderName);
    };

    const handlePress = useCallback((uri: string, isDirectory: boolean, name: string) => {
        if (uri.startsWith(SHORTCUT_PREFIX)) {
            void handleShortcutOpen(uri);
            return;
        }
        if (isDirectory) {
            void loadDirectory(uri);
        } else if (isPlayableFileName(name)) {
            const now = Date.now();
            const lastOpen = lastOpenVideoRef.current;
            if (lastOpen && lastOpen.uri === uri && now - lastOpen.at < OPEN_VIDEO_DEDUP_WINDOW_MS) {
                return;
            }
            lastOpenVideoRef.current = { uri, at: now };
            const playbackTitle = getDisplayFileName(name, uri);
            const candidates = files
                .filter((item) => !item.isDirectory && isSubtitleFileName(item.name))
                .map((item) => ({ uri: item.uri, name: getDisplayFileName(item.name, item.uri) }));
            navigation.navigate('Player', { videoUri: uri, title: playbackTitle, subtitleCandidates: candidates });
        } else {
            Alert.alert('Unsupported', 'This file type is not supported yet.');
        }
    }, [files, navigation]);

    const handleGoBack = () => {
        if (directoryHistory.length > 0) {
            const previous = directoryHistory[directoryHistory.length - 1];
            setDirectoryHistory((prev) => prev.slice(0, -1));
            if (previous === BROWSE_ROOT_URI) {
                loadQuickAccessRoot();
            } else {
                void loadDirectory(previous, false);
            }
            return;
        }
        if (Platform.OS === 'android') {
            if (currentPath !== BROWSE_ROOT_URI) {
                loadQuickAccessRoot();
            }
            return;
        }
        if (currentPath === FileSystem.documentDirectory) return;
        void loadDirectory(getParentDirectory(currentPath), false);
    };

    const handleGoHome = () => {
        setDirectoryHistory([]);
        loadQuickAccessRoot();
    };

    const isAndroidRootView = Platform.OS === 'android' && currentPath === BROWSE_ROOT_URI;
    const canGoBack = directoryHistory.length > 0 || (
        Platform.OS === 'android'
            ? !isAndroidRootView
            : currentPath !== FileSystem.documentDirectory
    );
    const canGoHome = Platform.OS === 'android' && !isAndroidRootView;
    const displayPath = isAndroidRootView
        ? 'Internal Storage'
        : currentPath.startsWith('content://')
            ? formatSafPath(currentPath)
            : currentPath.split('/').pop() || 'Internal Storage';

    const renderFileItem = useCallback(
        ({ item }: { item: FileItem }) => (
            <FileRow
                name={item.name}
                isDirectory={item.isDirectory}
                uri={item.uri}
                size={item.size}
                subtitle={
                    item.subtitle ||
                    (
                        !item.isDirectory && isPlayableFileName(item.name) && (resumeMap[item.uri] ?? 0) > 0
                            ? `Continue at ${formatTime(resumeMap[item.uri] ?? 0)}`
                            : undefined
                    )
                }
                onPress={handlePress}
            />
        ),
        [handlePress, resumeMap]
    );

    const fileKeyExtractor = useCallback((item: FileItem) => item.uri, []);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={handleGoBack}
                    disabled={!canGoBack}
                    style={[styles.navBtn, !canGoBack && styles.navBtnDisabled]}
                >
                    <Ionicons name="arrow-back" size={20} color={!canGoBack ? colors.textMuted : colors.text} />
                </TouchableOpacity>

                <View style={styles.pathContainer}>
                    <Ionicons name="folder" size={14} color={colors.primary} style={{ marginRight: 5 }} />
                    <Text style={styles.pathText} numberOfLines={1}>{displayPath}</Text>
                </View>

                {Platform.OS === 'android' && (
                    <TouchableOpacity
                        style={[styles.navBtn, !canGoHome && styles.navBtnDisabled]}
                        onPress={handleGoHome}
                        disabled={!canGoHome}
                    >
                        <Ionicons name="home-outline" size={20} color={!canGoHome ? colors.textMuted : colors.primary} />
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.navBtn} onPress={() => void requestStorageAccess()}>
                    <Ionicons name="folder-open-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading…</Text>
                </View>
            ) : (
                <FlatList
                    data={files}
                    renderItem={renderFileItem}
                    keyExtractor={fileKeyExtractor}
                    contentContainerStyle={styles.list}
                    initialNumToRender={20}
                    maxToRenderPerBatch={10}
                    updateCellsBatchingPeriod={50}
                    windowSize={7}
                    removeClippedSubviews
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="folder-open-outline" size={64} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>Empty Folder</Text>
                            <Text style={styles.emptySubtitle}>No files or folders here</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const useStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.s,
        paddingVertical: SPACING.s,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        gap: SPACING.s,
    },
    navBtn: {
        width: 38, height: 38, borderRadius: RADIUS.s,
        backgroundColor: colors.surfaceHigh,
        justifyContent: 'center', alignItems: 'center',
    },
    navBtnDisabled: { opacity: 0.3 },
    pathContainer: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surfaceHigh,
        borderRadius: RADIUS.s,
        paddingHorizontal: SPACING.s,
        paddingVertical: 8,
    },
    pathText: { flex: 1, color: colors.text, fontSize: FONT_SIZE.s, fontWeight: FONT_WEIGHT.medium },
    list: { paddingBottom: SPACING.xl },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.m },
    loadingText: { color: colors.textSecondary, fontSize: FONT_SIZE.s },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: SPACING.s },
    emptyTitle: { color: colors.text, fontSize: FONT_SIZE.l, fontWeight: FONT_WEIGHT.semiBold, marginTop: SPACING.s },
    emptySubtitle: { color: colors.textSecondary, fontSize: FONT_SIZE.s },
});

export default BrowseScreen;
