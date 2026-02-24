import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
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
}

const BrowseScreen = () => {
    const { colors } = useThemeContext();
    const styles = useStyles(colors);

    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const [currentPath, setCurrentPath] = useState(FileSystem.documentDirectory || '');
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [directoryHistory, setDirectoryHistory] = useState<string[]>([]);
    const [resumeMap, setResumeMap] = useState<Record<string, number>>({});

    const isPlayableFile = (name: string) => {
        const ext = name.split('.').pop()?.toLowerCase();
        return ['mp4', 'mkv', 'mov', 'avi', 'mp3', 'wav', 'm4a'].includes(ext || '');
    };
    const isSubtitleFile = (name: string) => {
        const ext = name.split('.').pop()?.toLowerCase();
        return ['srt', 'vtt'].includes(ext || '');
    };

    const loadDirectory = async (uri: string, addToHistory = true) => {
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
                        try {
                            const info = await FileSystem.getInfoAsync(entryUri);
                            const fallbackName = decodeURIComponent(entryUri.split('/').pop() || 'Item');
                            const name = info.exists && info.uri
                                ? decodeURIComponent(info.uri.split('/').pop() || fallbackName)
                                : fallbackName;
                            return { name, uri: entryUri, isDirectory: !!info.isDirectory, size: info.exists ? info.size : 0 };
                        } catch {
                            return { name: decodeURIComponent(entryUri.split('/').pop() || 'Item'), uri: entryUri, isDirectory: false, size: 0 };
                        }
                    }));
                })()
                : await (async () => {
                    const result = await FileSystem.readDirectoryAsync(uri);
                    return Promise.all(result.map(async (name) => {
                        const itemUri = uri + (uri.endsWith('/') ? '' : '/') + name;
                        const info = await FileSystem.getInfoAsync(itemUri);
                        return { name, uri: itemUri, isDirectory: info.isDirectory, size: info.exists ? info.size : 0 };
                    }));
                })();

            fileItems.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                return a.isDirectory ? -1 : 1;
            });
            setFiles(fileItems);
            setCurrentPath(uri);
        } catch {
            Alert.alert('Error', 'Could not read directory.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (Platform.OS === 'web') {
            setFiles([
                { name: 'Demo Folder', isDirectory: true, uri: 'demo/folder', size: 0 },
                { name: 'demo_video.mp4', isDirectory: false, uri: 'https://www.w3schools.com/html/mov_bbb.mp4', size: 1024 * 1024 * 5 },
            ]);
            setCurrentPath('Web Demo Storage');
            return;
        }
        if (FileSystem.documentDirectory) loadDirectory(FileSystem.documentDirectory, false);
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

    const handlePress = (uri: string, isDirectory: boolean, name: string) => {
        if (isDirectory) {
            loadDirectory(uri);
        } else if (isPlayableFile(name)) {
            const candidates = files
                .filter((item) => !item.isDirectory && isSubtitleFile(item.name))
                .map((item) => ({ uri: item.uri, name: item.name }));
            navigation.navigate('Player', { videoUri: uri, title: name, subtitleCandidates: candidates });
        } else {
            Alert.alert('Unsupported', 'This file type is not supported yet.');
        }
    };

    const handleGoBack = () => {
        if (directoryHistory.length > 0) {
            const previous = directoryHistory[directoryHistory.length - 1];
            setDirectoryHistory((prev) => prev.slice(0, -1));
            loadDirectory(previous, false);
            return;
        }
        if (currentPath === FileSystem.documentDirectory) return;
        loadDirectory(getParentDirectory(currentPath), false);
    };

    const requestStorageAccess = async () => {
        if (Platform.OS !== 'android') {
            Alert.alert('Info', 'Folder picker is currently available only on Android.');
            return;
        }
        try {
            const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (!permission.granted) { Alert.alert('Permission denied', 'Folder access was not granted.'); return; }
            setDirectoryHistory([]);
            loadDirectory(permission.directoryUri, false);
        } catch {
            Alert.alert('Error', 'Could not open folder picker.');
        }
    };

    const canGoBack = directoryHistory.length > 0 || currentPath !== FileSystem.documentDirectory;
    const displayPath = currentPath.startsWith('content://')
        ? decodeURIComponent(currentPath).split('/tree/').pop() || 'Selected Folder'
        : currentPath.split('/').pop() || 'Internal Storage';

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

                <TouchableOpacity style={styles.navBtn} onPress={requestStorageAccess}>
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
                    renderItem={({ item }) => (
                        <FileRow
                            name={item.name}
                            isDirectory={item.isDirectory}
                            uri={item.uri}
                            size={item.size}
                            subtitle={
                                !item.isDirectory && isPlayableFile(item.name) && (resumeMap[item.uri] ?? 0) > 0
                                    ? `Continue at ${formatTime(resumeMap[item.uri] ?? 0)}`
                                    : undefined
                            }
                            onPress={handlePress}
                        />
                    )}
                    keyExtractor={(item) => item.uri}
                    contentContainerStyle={styles.list}
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
