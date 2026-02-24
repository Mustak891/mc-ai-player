import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AppState,
    Alert,
    Animated,
    DeviceEventEmitter,
    Easing,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
    InteractionManager,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as Brightness from 'expo-brightness';
import * as FileSystem from 'expo-file-system/legacy';
import * as ScreenOrientation from 'expo-screen-orientation';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import AIOverlay from '../components/AIOverlay';
import ControlSettingsPanel from '../components/player/ControlSettingsPanel';
import EqualizerPanel from '../components/player/EqualizerPanel';
import VideoTipsModal from '../components/player/VideoTipsModal';
import { useThemeContext } from '../context/ThemeContext';
import { FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, RADIUS, SPACING } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { equalizerService } from '../services/audio/equalizerService';
import { floatingOverlayService } from '../services/audio/floatingOverlayService';
import { pictureInPictureService } from '../services/audio/pictureInPictureService';
import { aiService } from '../services/ai/LocalAIService';
import { Detection } from '../services/ai/types';
import { DEFAULT_EQUALIZER_SETTINGS, DEFAULT_PLAYER_CONTROL_SETTINGS, EQUALIZER_FREQUENCIES, EqualizerPresetId, EqualizerSettings, PlayerControlSettings } from '../types/playerSettings';
import { applyEqualizerPreset, loadEqualizerSettings, saveEqualizerSettings } from '../utils/equalizerStore';
import { loadPlaybackPrefs, savePlaybackPrefs } from '../utils/playbackPrefsStore';
import { savePlaylistSnapshot, getPlaylists, SavedPlaylist } from '../utils/playlistStore';
import { loadPlayerControlSettings, savePlayerControlSettings } from '../utils/playerSettingsStore';
import { loadResumeInfo, writeResumePosition } from '../utils/resumeStore';
import { getSubtitleTextAt, parseSrt, parseVtt, SubtitleCue } from '../utils/subtitleUtils';
import { loadBookmarks, saveBookmarks } from '../utils/bookmarksStore';
import { formatTime } from '../utils/timeUtils';
import { useSettingsStore } from '../store/settingsStore';

type PlayerScreenRouteProp = RouteProp<RootStackParamList, 'Player'>;
type PlayerNavigationProp = StackNavigationProp<RootStackParamList>;
type SubtitleOption = { id: string; label: string; uri?: string; embeddedIndex?: number };
type PlayerUiStatus = {
    isLoaded: boolean;
    isPlaying: boolean;
    durationMillis: number;
    positionMillis: number;
    didJustFinish: boolean;
};

type DisplayMode = {
    id:
    | 'best_fit'
    | 'fit_screen'
    | 'fill'
    | 'ratio_16_9'
    | 'ratio_4_3'
    | 'ratio_16_10'
    | 'ratio_2_1'
    | 'ratio_2_21_1'
    | 'ratio_2_35_1'
    | 'ratio_2_39_1'
    | 'ratio_5_4'
    | 'center';
    label: string;
    contentFit: 'contain' | 'cover' | 'fill';
    aspectRatio?: number;
};

const DISPLAY_MODES: DisplayMode[] = [
    { id: 'best_fit', label: 'Best Fit', contentFit: 'contain' },
    { id: 'fit_screen', label: 'Fit Screen', contentFit: 'fill' },
    { id: 'fill', label: 'Fill', contentFit: 'cover' },
    { id: 'ratio_16_9', label: '16:9', contentFit: 'contain', aspectRatio: 16 / 9 },
    { id: 'ratio_4_3', label: '4:3', contentFit: 'contain', aspectRatio: 4 / 3 },
    { id: 'ratio_16_10', label: '16:10', contentFit: 'contain', aspectRatio: 16 / 10 },
    { id: 'ratio_2_1', label: '2:1', contentFit: 'contain', aspectRatio: 2 / 1 },
    { id: 'ratio_2_21_1', label: '2.21:1', contentFit: 'contain', aspectRatio: 2.21 / 1 },
    { id: 'ratio_2_35_1', label: '2.35:1', contentFit: 'contain', aspectRatio: 2.35 / 1 },
    { id: 'ratio_2_39_1', label: '2.39:1', contentFit: 'contain', aspectRatio: 2.39 / 1 },
    { id: 'ratio_5_4', label: '5:4', contentFit: 'contain', aspectRatio: 5 / 4 },
    { id: 'center', label: 'Center', contentFit: 'contain' },
];
const QUICK_ZOOM_MODE_IDS: DisplayMode['id'][] = ['best_fit', 'fit_screen', 'fill', 'ratio_16_9'];
const ZOOM_CYCLE_MODES = QUICK_ZOOM_MODE_IDS.map(
    (id) => DISPLAY_MODES.find((mode) => mode.id === id)!
);

const AUTO_HIDE_DELAY_MS = 3200;
const PANEL_TRANSLATE = 16;
const DOUBLE_TAP_DELAY_MS = 260;
const RESUME_PROMPT_INACTIVITY_MS = 24 * 60 * 60 * 1000;
const AUDIO_BOOST_MULTIPLIER = 2;
const POPUP_WIDTH = 260;
const POPUP_HEIGHT = 146;
const USE_SYSTEM_PIP = false;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const PlayerScreen = () => {
    const { colors } = useThemeContext();
    const styles = useStyles(colors);
    const route = useRoute<PlayerScreenRouteProp>();
    const navigation = useNavigation<PlayerNavigationProp>();
    const { videoUri, title, subtitleCandidates = [] } = route.params;
    const { width, height } = useWindowDimensions();
    const isIncognito = useSettingsStore((state) => state.isIncognito);
    const isLandscape = width > height;
    const player = useVideoPlayer({ uri: videoUri }, (instance) => {
        instance.loop = false;
        instance.timeUpdateEventInterval = 0.2;
        instance.play();
    });

    const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);
    const tapTimeout = useRef<NodeJS.Timeout | null>(null);
    const sleepTimerTimeout = useRef<NodeJS.Timeout | null>(null);
    const fastPlayHoldTimeout = useRef<NodeJS.Timeout | null>(null);
    const gestureHudTimeout = useRef<NodeJS.Timeout | null>(null);
    const seekFeedbackTimeout = useRef<NodeJS.Timeout | null>(null);
    const pipEntryTimeout = useRef<NodeJS.Timeout | null>(null);
    const initialBrightness = useRef<number | null>(null);
    const hasBrightnessControl = useRef(true);
    const nativeVolumeApiRef = useRef<any>(null);
    const nativeVolumeListenerRef = useRef<{ remove: () => void } | null>(null);
    const baseSystemVolumeRef = useRef(0.5);
    const lastSystemVolumeRef = useRef(0.5);
    const restoringSystemVolumeRef = useRef(false);
    const gestureSide = useRef<'left' | 'right' | null>(null);
    const gestureStartVolume = useRef(1);
    const gestureStartBrightness = useRef(1);
    const gestureStartPosition = useRef(0);
    const horizontalPreviewPosition = useRef(0);
    const pinchActive = useRef(false);
    const pinchStartDistance = useRef(0);
    const pinchLastStepTs = useRef(0);
    const lastBrightnessWriteTs = useRef(0);
    const lastHorizontalSeekTs = useRef(0);
    const lastResumeSaveTs = useRef(0);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const verticalGestureActive = useRef(false);
    const horizontalGestureActive = useRef(false);
    const blockNextTap = useRef(false);
    const volumeRef = useRef(1);
    const lastNonZeroVolume = useRef(1);
    const brightnessRef = useRef(1);
    const controlsOpacity = useRef(new Animated.Value(1)).current;
    const playButtonScale = useRef(new Animated.Value(1)).current;
    const seekFeedbackOpacity = useRef(new Animated.Value(0)).current;
    const audioPanelAnim = useRef(new Animated.Value(0)).current;
    const morePanelAnim = useRef(new Animated.Value(0)).current;
    const advancedPanelAnim = useRef(new Animated.Value(0)).current;
    const zoomPanelAnim = useRef(new Animated.Value(0)).current;
    const volumePanelAnim = useRef(new Animated.Value(0)).current;
    const lastTapTimestamp = useRef(0);
    const hasAutoStarted = useRef(false);
    const hasAppliedResumeRef = useRef(false);
    const resumePromptShownRef = useRef(false);
    const resumePositionRef = useRef(0);
    const resumeUpdatedAtRef = useRef(0);
    const resumeInfoLoadedRef = useRef(false);
    const activeVideoUriRef = useRef(videoUri);
    const statusRef = useRef<PlayerUiStatus>({
        isLoaded: false,
        isPlaying: false,
        durationMillis: 0,
        positionMillis: 0,
        didJustFinish: false,
    });
    const sliderSeekingRef = useRef(false);
    const subtitleCueCacheRef = useRef<Record<string, SubtitleCue[]>>({});
    const hasAppliedDefaultSubtitleRef = useRef(false);
    const lastEnabledSubtitleRef = useRef<SubtitleOption | null>(null);
    const preferredAudioLabelRef = useRef<string | null>(null);
    const preferredSubtitleIdRef = useRef<string | null>(null);
    const preferredSubtitleLabelRef = useRef<string | null>(null);
    const shouldAutoSelectDefaultSubtitleRef = useRef(true);
    const hasRestoredSubtitlePreferenceRef = useRef(false);
    const pipEntryPendingRef = useRef(false);
    const pipEnteredRef = useRef(false);

    const [status, setStatus] = useState<PlayerUiStatus>({
        isLoaded: false,
        isPlaying: false,
        durationMillis: 0,
        positionMillis: 0,
        didJustFinish: false,
    });
    const [showControls, setShowControls] = useState(true);
    const [volumePanelVisible, setVolumePanelVisible] = useState(false);
    const [audioPanelVisible, setAudioPanelVisible] = useState(false);
    const [morePanelVisible, setMorePanelVisible] = useState(false);
    const [advancedPanelVisible, setAdvancedPanelVisible] = useState(false);
    const [zoomPanelVisible, setZoomPanelVisible] = useState(false);
    const [equalizerPanelVisible, setEqualizerPanelVisible] = useState(false);
    const [controlSettingsVisible, setControlSettingsVisible] = useState(false);
    const [videoTipsVisible, setVideoTipsVisible] = useState(false);
    const [jumpToTimeVisible, setJumpToTimeVisible] = useState(false);
    const [jumpTargetMs, setJumpTargetMs] = useState(0);
    const [jumpInput, setJumpInput] = useState('');
    const [audioOnlyMode, setAudioOnlyMode] = useState(false);
    const [popUpMode, setPopUpMode] = useState(false);
    const [pipSupported, setPipSupported] = useState(false);
    const [abRepeatStartMs, setAbRepeatStartMs] = useState<number | null>(null);
    const [abRepeatEndMs, setAbRepeatEndMs] = useState<number | null>(null);
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
    const [detections, setDetections] = useState<Detection[]>([]);
    const [viewDimensions, setViewDimensions] = useState({ width: 0, height: 0 });
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [selectedDisplayMode, setSelectedDisplayMode] = useState<DisplayMode>(DISPLAY_MODES[0]);
    const [audioOptions, setAudioOptions] = useState<string[]>(['Default Audio Track']);
    const [detectedAudioTrackCount, setDetectedAudioTrackCount] = useState(0);
    const [selectedAudioTrack, setSelectedAudioTrack] = useState('Default Audio Track');
    const [isAudioTrackDisabled, setIsAudioTrackDisabled] = useState(false);
    const [audioSectionExpanded, setAudioSectionExpanded] = useState(true);
    const [subtitleSectionExpanded, setSubtitleSectionExpanded] = useState(true);
    const [embeddedSubtitleOptions, setEmbeddedSubtitleOptions] = useState<SubtitleOption[]>([]);
    const [localSubtitleOptions, setLocalSubtitleOptions] = useState<SubtitleOption[]>([]);
    const [detectedSubtitleTrackCount, setDetectedSubtitleTrackCount] = useState(0);
    const [selectedSubtitle, setSelectedSubtitle] = useState('Subtitles Off');
    const [selectedSubtitleId, setSelectedSubtitleId] = useState('off');
    const [activeSubtitleCues, setActiveSubtitleCues] = useState<SubtitleCue[]>([]);
    const [activeSubtitleText, setActiveSubtitleText] = useState('');
    const [subtitleSyncMs, setSubtitleSyncMs] = useState(0);
    const [equalizerMode, setEqualizerMode] = useState('Flat');
    const [equalizerSettings, setEqualizerSettings] = useState<EqualizerSettings>(DEFAULT_EQUALIZER_SETTINGS);
    const [equalizerSupported, setEqualizerSupported] = useState(false);
    const [playerSettings, setPlayerSettings] = useState<PlayerControlSettings>(DEFAULT_PLAYER_CONTROL_SETTINGS);
    const [repeatMode, setRepeatMode] = useState<'off' | 'single' | 'all'>('off');
    const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
    const [bookmarks, setBookmarks] = useState<number[]>([]);
    const [showVideoInfo, setShowVideoInfo] = useState(false);
    const [videoSizeFormatted, setVideoSizeFormatted] = useState<string | null>(null);
    const [showPlaylist, setShowPlaylist] = useState(false);
    const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>([]);
    const [isOrientationLocked, setIsOrientationLocked] = useState(false);
    const [seekFeedbackText, setSeekFeedbackText] = useState('');
    const [isSeeking, setIsSeeking] = useState(false);
    const [seekPreviewPosition, setSeekPreviewPosition] = useState(0);
    const [stableDurationMillis, setStableDurationMillis] = useState(0);
    const [playerVolume, setPlayerVolume] = useState(1);
    const [screenBrightness, setScreenBrightness] = useState(1);
    const [gestureHud, setGestureHud] = useState<{
        visible: boolean;
        type: 'volume' | 'brightness' | null;
        value: number;
    }>({ visible: false, type: null, value: 0 });
    const [playlistItems] = useState([
        { id: '1', title: title || 'Current Video', uri: videoUri },
        { id: '2', title: 'Sample Clip', uri: videoUri },
    ]);
    const [isTouchLocked, setIsTouchLocked] = useState(false);
    const selectedAudioTrackRef = useRef(selectedAudioTrack);
    const isAudioTrackDisabledRef = useRef(isAudioTrackDisabled);
    const selectedSubtitleIdRef = useRef(selectedSubtitleId);
    const selectedSubtitleRef = useRef(selectedSubtitle);
    const subtitleSyncMsRef = useRef(subtitleSyncMs);
    const playerSettingsRef = useRef(playerSettings);
    const equalizerSettingsRef = useRef(equalizerSettings);
    const speedBeforeHoldRef = useRef<number | null>(null);

    const subtitleOptions = useMemo(
        () => [{ id: 'off', label: 'Subtitles Off' }, ...embeddedSubtitleOptions, ...localSubtitleOptions],
        [embeddedSubtitleOptions, localSubtitleOptions]
    );

    useEffect(() => {
        activeVideoUriRef.current = videoUri;
    }, [videoUri]);

    useEffect(() => {
        let alive = true;
        void (async () => {
            const [loadedPlayerSettings, loadedEqualizerSettings, eqSupported, supportedPiP] = await Promise.all([
                loadPlayerControlSettings(),
                loadEqualizerSettings(),
                equalizerService.isSupported(),
                pictureInPictureService.isSupported(),
            ]);
            if (!alive) return;
            setPlayerSettings(loadedPlayerSettings);
            setEqualizerSettings(loadedEqualizerSettings);
            setEqualizerSupported(eqSupported);
            setPipSupported(supportedPiP);
        })();
        return () => {
            alive = false;
        };
    }, []);

    const persistPlaybackPreferences = (override?: {
        audioTrackLabel?: string;
        audioDisabled?: boolean;
        subtitleEnabled?: boolean;
        subtitleTrackId?: string;
        subtitleTrackLabel?: string;
        subtitleSyncMs?: number;
    }) => {
        const subtitleEnabled = override?.subtitleEnabled ?? selectedSubtitleId !== 'off';
        const shouldSavePerVideoDelay = playerSettingsRef.current.saveAudioDelayPerVideo;
        void savePlaybackPrefs(videoUri, {
            audioTrackLabel: override?.audioTrackLabel ?? selectedAudioTrack,
            audioDisabled: override?.audioDisabled ?? isAudioTrackDisabled,
            subtitleEnabled,
            subtitleTrackId: subtitleEnabled ? override?.subtitleTrackId ?? selectedSubtitleId : undefined,
            subtitleTrackLabel: subtitleEnabled ? override?.subtitleTrackLabel ?? selectedSubtitle : undefined,
            subtitleSyncMs: shouldSavePerVideoDelay ? override?.subtitleSyncMs ?? subtitleSyncMs : undefined,
        });
    };

    const updatePlayerSettings = (next: PlayerControlSettings) => {
        setPlayerSettings(next);
        void savePlayerControlSettings(next);
    };

    const closeAllPanels = () => {
        setVolumePanelVisible(false);
        setAudioPanelVisible(false);
        setMorePanelVisible(false);
        setAdvancedPanelVisible(false);
        setZoomPanelVisible(false);
        setEqualizerPanelVisible(false);
        setControlSettingsVisible(false);
        setVideoTipsVisible(false);
        setJumpToTimeVisible(false);
    };

    const openAudioSubtitlePanel = (section: 'audio' | 'subtitle') => {
        setAudioPanelVisible(true);
        setAudioSectionExpanded(section === 'audio');
        setSubtitleSectionExpanded(section === 'subtitle');
        setMorePanelVisible(false);
        setAdvancedPanelVisible(false);
        setZoomPanelVisible(false);
        setVolumePanelVisible(false);
        setEqualizerPanelVisible(false);
        setControlSettingsVisible(false);
        setVideoTipsVisible(false);
    };

    const openAdvancedControlsPanel = () => {
        setMorePanelVisible(true);
        setAudioPanelVisible(false);
        setAdvancedPanelVisible(false);
        setZoomPanelVisible(false);
        setVolumePanelVisible(false);
        setEqualizerPanelVisible(false);
        setControlSettingsVisible(false);
        setVideoTipsVisible(false);
    };

    const openQuickAdvancedPanel = () => {
        setAdvancedPanelVisible(true);
        setMorePanelVisible(false);
        setAudioPanelVisible(false);
        setZoomPanelVisible(false);
        setVolumePanelVisible(false);
        setEqualizerPanelVisible(false);
        setControlSettingsVisible(false);
        setVideoTipsVisible(false);
    };


    const isAnyPanelOpen = () =>
        audioPanelVisible ||
        morePanelVisible ||
        advancedPanelVisible ||
        zoomPanelVisible ||
        volumePanelVisible ||
        equalizerPanelVisible ||
        controlSettingsVisible ||
        videoTipsVisible ||
        jumpToTimeVisible;


    const showGestureHud = (type: 'volume' | 'brightness', value: number) => {
        setGestureHud({ visible: true, type, value });
        if (gestureHudTimeout.current) {
            clearTimeout(gestureHudTimeout.current);
        }
    };

    const hideSeekFeedbackSoon = (delayMs = 650) => {
        if (seekFeedbackTimeout.current) {
            clearTimeout(seekFeedbackTimeout.current);
        }
        seekFeedbackTimeout.current = setTimeout(() => {
            Animated.timing(seekFeedbackOpacity, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
            }).start();
        }, delayMs);
    };

    const showSeekFeedback = (text: string, autoHideDelayMs = 650) => {
        setSeekFeedbackText(text);
        seekFeedbackOpacity.stopAnimation();
        seekFeedbackOpacity.setValue(1);
        hideSeekFeedbackSoon(autoHideDelayMs);
    };

    useEffect(() => {
        volumeRef.current = playerVolume;
    }, [playerVolume]);

    useEffect(() => {
        brightnessRef.current = screenBrightness;
    }, [screenBrightness]);

    useEffect(() => {
        const boost = playerSettings.audioBoostEnabled ? AUDIO_BOOST_MULTIPLIER : 1;
        player.volume = clamp(playerVolume * boost, 0, AUDIO_BOOST_MULTIPLIER);
    }, [player, playerVolume, playerSettings.audioBoostEnabled]);

    useEffect(() => {
        if (playerSettings.audioBoostEnabled) {
            setPlayerVolume(2);
            volumeRef.current = 2;
            lastNonZeroVolume.current = 2;
            return;
        }
        if (volumeRef.current > 1) {
            setPlayerVolume(1);
            volumeRef.current = 1;
            lastNonZeroVolume.current = 1;
        }
    }, [playerSettings.audioBoostEnabled]);

    useEffect(() => {
        player.muted = isAudioTrackDisabled;
    }, [player, isAudioTrackDisabled]);

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    useEffect(() => {
        if (status.durationMillis > 0) {
            setStableDurationMillis(status.durationMillis);
        }
    }, [status.durationMillis]);

    useEffect(() => {
        if (showVideoInfo && videoUri) {
            void FileSystem.getInfoAsync(videoUri).then((info) => {
                if (info.exists && (info as any).size) {
                    const mb = (info as any).size / (1024 * 1024);
                    setVideoSizeFormatted(`${mb.toFixed(2)} MB`);
                }
            }).catch(() => { });
        }
    }, [showVideoInfo, videoUri]);

    useEffect(() => {
        selectedAudioTrackRef.current = selectedAudioTrack;
    }, [selectedAudioTrack]);

    useEffect(() => {
        isAudioTrackDisabledRef.current = isAudioTrackDisabled;
    }, [isAudioTrackDisabled]);

    useEffect(() => {
        selectedSubtitleIdRef.current = selectedSubtitleId;
    }, [selectedSubtitleId]);

    useEffect(() => {
        selectedSubtitleRef.current = selectedSubtitle;
    }, [selectedSubtitle]);

    useEffect(() => {
        subtitleSyncMsRef.current = subtitleSyncMs;
    }, [subtitleSyncMs]);

    useEffect(() => {
        playerSettingsRef.current = playerSettings;
    }, [playerSettings]);

    useEffect(() => {
        equalizerSettingsRef.current = equalizerSettings;
    }, [equalizerSettings]);

    useEffect(() => {
        let alive = true;
        hasAutoStarted.current = false;
        hasAppliedResumeRef.current = false;
        resumePromptShownRef.current = false;
        resumePositionRef.current = 0;
        resumeUpdatedAtRef.current = 0;
        resumeInfoLoadedRef.current = false;
        hasAppliedDefaultSubtitleRef.current = false;
        hasRestoredSubtitlePreferenceRef.current = false;
        preferredAudioLabelRef.current = null;
        preferredSubtitleIdRef.current = null;
        preferredSubtitleLabelRef.current = null;
        shouldAutoSelectDefaultSubtitleRef.current = true;
        setIsAudioTrackDisabled(false);
        setSelectedAudioTrack('Default Audio Track');
        setSelectedSubtitleId('off');
        setSelectedSubtitle('Subtitles Off');
        setActiveSubtitleCues([]);
        setActiveSubtitleText('');
        setSubtitleSyncMs(playerSettingsRef.current.globalSubtitleDelayMs || 0);
        void (async () => {
            try {
                const resumeInfo = await loadResumeInfo(videoUri);
                const prefs = await loadPlaybackPrefs(videoUri);
                if (!alive) return;
                resumePositionRef.current = resumeInfo.positionMillis;
                resumeUpdatedAtRef.current = resumeInfo.updatedAt;
                if (prefs) {
                    if (prefs.audioTrackLabel) {
                        preferredAudioLabelRef.current = prefs.audioTrackLabel;
                        setSelectedAudioTrack(prefs.audioTrackLabel);
                    }
                    if (typeof prefs.audioDisabled === 'boolean') {
                        setIsAudioTrackDisabled(prefs.audioDisabled);
                    }
                    if (playerSettingsRef.current.saveAudioDelayPerVideo && typeof prefs.subtitleSyncMs === 'number') {
                        setSubtitleSyncMs(prefs.subtitleSyncMs);
                    }
                    if (prefs.subtitleEnabled === false) {
                        setSelectedSubtitleId('off');
                        setSelectedSubtitle('Subtitles Off');
                        setActiveSubtitleCues([]);
                        setActiveSubtitleText('');
                        shouldAutoSelectDefaultSubtitleRef.current = false;
                        hasAppliedDefaultSubtitleRef.current = true;
                        hasRestoredSubtitlePreferenceRef.current = true;
                        preferredSubtitleIdRef.current = 'off';
                    } else if (prefs.subtitleTrackId || prefs.subtitleTrackLabel) {
                        preferredSubtitleIdRef.current = prefs.subtitleTrackId || null;
                        preferredSubtitleLabelRef.current = prefs.subtitleTrackLabel || null;
                        shouldAutoSelectDefaultSubtitleRef.current = false;
                    }
                }
            } finally {
                if (alive) {
                    resumeInfoLoadedRef.current = true;
                }
            }
        })();

        return () => {
            alive = false;
        };
    }, [videoUri]);

    useEffect(() => {
        if (playerSettings.videoTransitionTitleEnabled && title) {
            flashSeekFeedback(title);
        }
    }, [videoUri, playerSettings.videoTransitionTitleEnabled, title]);

    const parseSubtitleContent = (uri: string, content: string) => {
        const lower = uri.toLowerCase();
        if (lower.endsWith('.vtt')) {
            return parseVtt(content);
        }
        return parseSrt(content);
    };

    const loadSubtitleFromUri = async (uri: string): Promise<SubtitleCue[]> => {
        if (subtitleCueCacheRef.current[uri]) {
            return subtitleCueCacheRef.current[uri];
        }
        const raw = await FileSystem.readAsStringAsync(uri);
        const cues = parseSubtitleContent(uri, raw);
        subtitleCueCacheRef.current[uri] = cues;
        return cues;
    };

    useEffect(() => {
        let alive = true;
        void (async () => {
            const options: SubtitleOption[] = [];
            const extRegex = /\.(srt|vtt)$/i;
            const seen = new Set<string>();

            const addCandidate = (uri: string, name: string) => {
                if (!extRegex.test(name) || seen.has(uri)) return;
                seen.add(uri);
                options.push({ id: uri, label: name, uri });
            };

            subtitleCandidates.forEach((item) => addCandidate(item.uri, item.name));

            if (videoUri.startsWith('file://')) {
                const slash = videoUri.lastIndexOf('/');
                if (slash > 0) {
                    const dirUri = videoUri.slice(0, slash + 1);
                    try {
                        const entries = await FileSystem.readDirectoryAsync(dirUri);
                        entries.forEach((name) => {
                            if (!extRegex.test(name)) return;
                            addCandidate(`${dirUri}${name}`, name);
                        });
                    } catch {
                        // Directory scan is best effort.
                    }
                }
            }

            if (!alive) return;
            setLocalSubtitleOptions(options);
        })();

        return () => {
            alive = false;
        };
    }, [videoUri, subtitleCandidates]);

    const handleSelectSubtitle = async (option: SubtitleOption) => {
        if (option.id === 'off') {
            try {
                player.subtitleTrack = null;
            } catch { }
            setSelectedSubtitleId('off');
            setSelectedSubtitle('Subtitles Off');
            setActiveSubtitleCues([]);
            setActiveSubtitleText('');
            hasRestoredSubtitlePreferenceRef.current = true;
            shouldAutoSelectDefaultSubtitleRef.current = false;
            preferredSubtitleIdRef.current = 'off';
            preferredSubtitleLabelRef.current = 'Subtitles Off';
            persistPlaybackPreferences({
                subtitleEnabled: false,
                subtitleTrackId: undefined,
                subtitleTrackLabel: undefined,
            });
            return;
        }

        if (typeof option.embeddedIndex === 'number') {
            try {
                const tracks = (player as any).availableSubtitleTracks ?? [];
                player.subtitleTrack = tracks[option.embeddedIndex] ?? null;
                setSelectedSubtitleId(option.id);
                setSelectedSubtitle(option.label);
                lastEnabledSubtitleRef.current = option;
                setActiveSubtitleCues([]);
                setActiveSubtitleText('');
                hasRestoredSubtitlePreferenceRef.current = true;
                shouldAutoSelectDefaultSubtitleRef.current = false;
                preferredSubtitleIdRef.current = option.id;
                preferredSubtitleLabelRef.current = option.label;
                persistPlaybackPreferences({
                    subtitleEnabled: true,
                    subtitleTrackId: option.id,
                    subtitleTrackLabel: option.label,
                });
                return;
            } catch {
                Alert.alert('Subtitle', 'Embedded subtitle track switching is not available for this file.');
                return;
            }
        }

        if (!option.uri) {
            Alert.alert('Subtitle', 'Subtitle source is not available.');
            return;
        }

        try {
            try {
                player.subtitleTrack = null;
            } catch { }
            const cues = await loadSubtitleFromUri(option.uri);
            if (cues.length === 0) {
                Alert.alert('Subtitle', 'No cues found in this subtitle file.');
                return;
            }
            setSelectedSubtitleId(option.id);
            setSelectedSubtitle(option.label);
            lastEnabledSubtitleRef.current = option;
            setActiveSubtitleCues(cues);
            setActiveSubtitleText('');
            hasRestoredSubtitlePreferenceRef.current = true;
            shouldAutoSelectDefaultSubtitleRef.current = false;
            preferredSubtitleIdRef.current = option.id;
            preferredSubtitleLabelRef.current = option.label;
            persistPlaybackPreferences({
                subtitleEnabled: true,
                subtitleTrackId: option.id,
                subtitleTrackLabel: option.label,
            });
        } catch {
            Alert.alert('Subtitle', 'Could not load selected subtitle file.');
        }
    };

    const handleSelectAudioTrack = async (label: string, index: number) => {
        setIsAudioTrackDisabled(false);
        setSelectedAudioTrack(label);
        preferredAudioLabelRef.current = label;
        persistPlaybackPreferences({
            audioDisabled: false,
            audioTrackLabel: label,
        });
        try {
            player.muted = false;
            const tracks = (player as any).availableAudioTracks ?? [];
            player.audioTrack = tracks[index] ?? null;
        } catch {
            Alert.alert(
                'Audio Track',
                'Could not switch this audio track on current device backend.'
            );
        }
    };

    useEffect(() => {
        if (hasRestoredSubtitlePreferenceRef.current) return;
        if (!preferredSubtitleIdRef.current || preferredSubtitleIdRef.current === 'off') return;

        const option =
            subtitleOptions.find((item) => item.id === preferredSubtitleIdRef.current) ||
            (preferredSubtitleLabelRef.current
                ? subtitleOptions.find((item) => item.label === preferredSubtitleLabelRef.current)
                : undefined);
        if (!option) return;

        if (typeof option.embeddedIndex === 'number') {
            const tracks = (player as any).availableSubtitleTracks ?? [];
            if (!tracks[option.embeddedIndex]) return;
        }

        hasRestoredSubtitlePreferenceRef.current = true;
        shouldAutoSelectDefaultSubtitleRef.current = false;
        hasAppliedDefaultSubtitleRef.current = true;
        void handleSelectSubtitle(option);
    }, [subtitleOptions, player]);

    const handleDisableAudioTrack = async () => {
        setIsAudioTrackDisabled(true);
        persistPlaybackPreferences({
            audioDisabled: true,
        });
        try {
            player.muted = true;
        } catch {
            // Fallback handled by internal volume/mute controls.
        }
    };

    const handleImportSubtitleFromFolder = async () => {
        if (Platform.OS !== 'android') {
            Alert.alert('Subtitle', 'Folder subtitle import is currently available on Android.');
            return;
        }
        try {
            const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (!permission.granted) {
                return;
            }
            const entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(permission.directoryUri);
            const subtitleUris = entries.filter((uri) => /\.(srt|vtt)$/i.test(uri));
            if (subtitleUris.length === 0) {
                Alert.alert('Subtitle', 'No .srt or .vtt subtitle files found in that folder.');
                return;
            }
            setLocalSubtitleOptions((prev) => {
                const seen = new Set(prev.map((item) => item.id));
                const next = [...prev];
                subtitleUris.forEach((uri) => {
                    if (seen.has(uri)) return;
                    const name = decodeURIComponent(uri.split('/').pop() || 'Subtitle');
                    next.push({ id: uri, uri, label: name });
                });
                return next;
            });
            Alert.alert('Subtitle', `Added ${subtitleUris.length} subtitle file(s).`);
        } catch {
            Alert.alert('Subtitle', 'Could not import subtitle files from folder.');
        }
    };

    const handleDownloadSubtitlesOnline = async () => {
        const query = encodeURIComponent(title || 'video');
        const url = `https://www.opensubtitles.com/en/search/subs?query=${query}`;
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
            await Linking.openURL(url);
            return;
        }
        Alert.alert('Subtitles', 'Could not open subtitle download page.');
    };

    const handleAdjustSubtitleDelay = (deltaMs: number) => {
        setSubtitleSyncMs((prev) => {
            const next = prev + deltaMs;
            if (!playerSettingsRef.current.saveAudioDelayPerVideo) {
                const nextSettings = {
                    ...playerSettingsRef.current,
                    globalSubtitleDelayMs: next,
                };
                updatePlayerSettings(nextSettings);
            }
            persistPlaybackPreferences({ subtitleSyncMs: next });
            return next;
        });
    };

    const handleVideoError = (error: string) => {
        Alert.alert('Playback Error', error || 'Unknown video playback error.');
    };

    const hideGestureHudSoon = () => {
        if (gestureHudTimeout.current) {
            clearTimeout(gestureHudTimeout.current);
        }
        gestureHudTimeout.current = setTimeout(() => {
            setGestureHud((prev) => ({ ...prev, visible: false }));
        }, 650);
    };

    const applyBrightness = (value: number) => {
        setScreenBrightness(value);
        const now = Date.now();
        if (now - lastBrightnessWriteTs.current < 40) return;
        lastBrightnessWriteTs.current = now;
        void Brightness.setBrightnessAsync(value).catch(() => {
            hasBrightnessControl.current = false;
        });
    };

    const setVolumeLevel = (value: number) => {
        // Allow up to 2.0 (200%) if enabled
        const max = playerSettingsRef.current.audioBoostEnabled ? 2 : 1;
        const next = clamp(value, 0, max);
        if (Math.abs(next - volumeRef.current) > 0.001) {
            setPlayerVolume(next);
            if (statusRef.current.isLoaded) {
                // Native volume maxes out at 1.0
                player.volume = Math.min(1, next);

                // If above 1.0, use Preamp gain (up to 15dB)
                if (next > 1) {
                    const boostRatio = next - 1; // 0.0 to 1.0
                    void equalizerService.setEnabled(true);
                    void equalizerService.setPreampDb(boostRatio * 15);
                } else if (volumeRef.current > 1) {
                    void equalizerService.setPreampDb(0);
                }
            }
        }
        volumeRef.current = next;
        if (next > 0.001) {
            lastNonZeroVolume.current = next;
        }
        return next;
    };

    const setBrightnessLevel = (value: number) => {
        const next = clamp(value, 0.1, 1);
        applyBrightness(next);
        return next;
    };

    const handleTouchStart = (event: any) => {
        if (popUpMode) return;
        if (isTouchLocked) return;
        if (isAnyPanelOpen()) {
            verticalGestureActive.current = false;
            horizontalGestureActive.current = false;
            pinchActive.current = false;
            return;
        }
        const native = event?.nativeEvent;
        const touches = native?.touches;

        if (touches?.length >= 2) {
            const dx = (touches[1].pageX ?? 0) - (touches[0].pageX ?? 0);
            const dy = (touches[1].pageY ?? 0) - (touches[0].pageY ?? 0);
            pinchStartDistance.current = Math.hypot(dx, dy);
            pinchActive.current = true;
            pinchLastStepTs.current = 0;
            verticalGestureActive.current = false;
            horizontalGestureActive.current = false;
            blockNextTap.current = true;
            if (tapTimeout.current) {
                clearTimeout(tapTimeout.current);
            }
            return;
        }

        pinchActive.current = false;
        pinchLastStepTs.current = 0;
        touchStartX.current = native?.pageX ?? native?.locationX ?? width / 2;
        touchStartY.current = native?.pageY ?? native?.locationY ?? height / 2;
        verticalGestureActive.current = false;
        horizontalGestureActive.current = false;
        gestureSide.current = null;
        gestureStartVolume.current = volumeRef.current;
        gestureStartBrightness.current = brightnessRef.current;
        gestureStartPosition.current = status.isLoaded ? status.positionMillis : 0;
        horizontalPreviewPosition.current = gestureStartPosition.current;
        lastHorizontalSeekTs.current = 0;
    };

    const handleTouchMove = (event: any) => {
        if (popUpMode) return;
        if (isTouchLocked) return;
        if (isAnyPanelOpen()) {
            return;
        }
        if (sliderSeekingRef.current) {
            return;
        }
        const settings = playerSettingsRef.current;
        const native = event?.nativeEvent;
        const touches = native?.touches;

        if ((touches?.length >= 2 || pinchActive.current) && status.isLoaded) {
            if (!settings.twoFingerZoomEnabled) {
                return;
            }
            if (touches?.length >= 2) {
                const dx = (touches[1].pageX ?? 0) - (touches[0].pageX ?? 0);
                const dy = (touches[1].pageY ?? 0) - (touches[0].pageY ?? 0);
                const distance = Math.hypot(dx, dy);
                const baseline = Math.max(pinchStartDistance.current, 1);
                const scaleDelta = distance / baseline;
                const now = Date.now();
                if (Math.abs(scaleDelta - 1) > 0.08 && now - pinchLastStepTs.current > 180) {
                    if (scaleDelta < 1) {
                        const mode16by9 = DISPLAY_MODES.find((mode) => mode.id === 'ratio_16_9');
                        if (mode16by9 && selectedDisplayMode.id !== mode16by9.id) {
                            handleSetDisplayMode(mode16by9);
                            flashSeekFeedback('Zoom: 16:9');
                        }
                    } else {
                        const fitScreenMode = DISPLAY_MODES.find((mode) => mode.id === 'fit_screen');
                        if (fitScreenMode && selectedDisplayMode.id !== fitScreenMode.id) {
                            handleSetDisplayMode(fitScreenMode);
                            flashSeekFeedback('Zoom: Fit Screen');
                        }
                    }
                    pinchStartDistance.current = distance;
                    pinchLastStepTs.current = now;
                    showOverlayControls();
                    resetControlsTimer();
                }
            }
            return;
        }

        const x = native?.pageX ?? touchStartX.current;
        const y = native?.pageY ?? touchStartY.current;
        const dx = x - touchStartX.current;
        const dy = y - touchStartY.current;

        if (!verticalGestureActive.current && !horizontalGestureActive.current) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;

            if (Math.abs(dy) > Math.abs(dx)) {
                if (!settings.gestureVolumeEnabled && !settings.gestureBrightnessEnabled) {
                    return;
                }
                verticalGestureActive.current = true;
                gestureSide.current = touchStartX.current < width / 2 ? 'left' : 'right';
            } else if (status.isLoaded) {
                if (!settings.swipeToSeekEnabled) {
                    return;
                }
                horizontalGestureActive.current = true;
                setIsSeeking(true);
                setSeekPreviewPosition(gestureStartPosition.current);
            }

            blockNextTap.current = true;
            if (tapTimeout.current) {
                clearTimeout(tapTimeout.current);
            }
        }

        if (verticalGestureActive.current) {
            if (!gestureSide.current) return;
            const normalizedDelta = (-dy / Math.max(height, 1)) * 1.6;

            if (gestureSide.current === 'right') {
                if (!settings.gestureVolumeEnabled) return;
                const nextVolume = setVolumeLevel(gestureStartVolume.current + normalizedDelta);
                showGestureHud('volume', nextVolume);
            } else {
                if (!settings.gestureBrightnessEnabled) return;
                const nextBrightness = setBrightnessLevel(gestureStartBrightness.current + normalizedDelta);
                showGestureHud('brightness', nextBrightness);
            }
            return;
        }

        if (horizontalGestureActive.current && status.isLoaded) {
            const duration = status.durationMillis ?? 0;
            const baseJumpWindowMs = clamp(duration * 0.25, 10000, 180000);
            const deltaMs = (dx / Math.max(width, 1)) * baseJumpWindowMs;
            const nextPosition = clamp(gestureStartPosition.current + deltaMs, 0, duration);
            horizontalPreviewPosition.current = nextPosition;
            setSeekPreviewPosition(nextPosition);

            const secondsDelta = Math.round((nextPosition - gestureStartPosition.current) / 1000);
            showSeekFeedback(`${secondsDelta >= 0 ? '+' : ''}${secondsDelta}s  ${formatTime(nextPosition)}`, 700);

            const now = Date.now();
            if (now - lastHorizontalSeekTs.current >= 120) {
                lastHorizontalSeekTs.current = now;
                player.currentTime = nextPosition / 1000;
            }
        }
    };

    const handleTouchEnd = () => {
        if (popUpMode) return;
        if (isTouchLocked) return;
        if (isAnyPanelOpen()) {
            return;
        }
        if (sliderSeekingRef.current) {
            return;
        }
        if (pinchActive.current) {
            pinchActive.current = false;
            pinchStartDistance.current = 0;
            pinchLastStepTs.current = 0;
        }
        if (verticalGestureActive.current) {
            hideGestureHudSoon();
        }
        if (horizontalGestureActive.current && status.isLoaded) {
            const finalPosition = horizontalPreviewPosition.current;
            player.currentTime = finalPosition / 1000;
            setSeekPreviewPosition(finalPosition);
            setIsSeeking(false);
            resetControlsTimer();
            hideSeekFeedbackSoon(120);
        }
        verticalGestureActive.current = false;
        horizontalGestureActive.current = false;
        gestureSide.current = null;
    };

    const handleVolumeButtonPress = () => {
        // VLC-like quick control: tap to mute/unmute video volume only.
        if (volumeRef.current > 0.001) {
            const next = setVolumeLevel(0);
            showGestureHud('volume', next);
            hideGestureHudSoon();
        } else {
            const restore = lastNonZeroVolume.current > 0.001 ? lastNonZeroVolume.current : 0.7;
            const next = setVolumeLevel(restore);
            showGestureHud('volume', next);
            hideGestureHudSoon();
        }
    };

    const animatePanel = (value: Animated.Value, visible: boolean) => {
        Animated.timing(value, {
            toValue: visible ? 1 : 0,
            duration: visible ? 180 : 140,
            easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
            useNativeDriver: true,
        }).start();
    };

    const showOverlayControls = () => {
        setShowControls(true);
        Animated.timing(controlsOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    };

    const hideOverlayControls = () => {
        closeAllPanels();
        setShowControls(false);
        Animated.timing(controlsOpacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
        }).start();
    };

    const resetControlsTimer = () => {
        if (hideControlsTimeout.current) {
            clearTimeout(hideControlsTimeout.current);
        }
        hideControlsTimeout.current = setTimeout(() => {
            if (
                status.isLoaded &&
                status.isPlaying &&
                !advancedPanelVisible &&
                !audioPanelVisible &&
                !morePanelVisible &&
                !volumePanelVisible &&
                !zoomPanelVisible &&
                !equalizerPanelVisible &&
                !controlSettingsVisible &&
                !videoTipsVisible
            ) {
                hideOverlayControls();
            }
        }, playerSettings.controlsHideDelayMs || AUTO_HIDE_DELAY_MS);
    };

    useEffect(() => {
        if (showControls) {
            resetControlsTimer();
        }
        return () => {
            if (hideControlsTimeout.current) {
                clearTimeout(hideControlsTimeout.current);
            }
        };
    }, [
        showControls,
        status.isLoaded && status.isPlaying,
        advancedPanelVisible,
        audioPanelVisible,
        morePanelVisible,
        volumePanelVisible,
        zoomPanelVisible,
        equalizerPanelVisible,
        controlSettingsVisible,
        videoTipsVisible,
        playerSettings.controlsHideDelayMs,
    ]);

    useEffect(() => {
        const syncOrientationLockState = async () => {
            try {
                const lock = await ScreenOrientation.getOrientationLockAsync();
                setIsOrientationLocked(lock !== ScreenOrientation.OrientationLock.DEFAULT);
            } catch {
                // Ignore orientation lock sync errors.
            }
        };
        void syncOrientationLockState();

        const subscription = ScreenOrientation.addOrientationChangeListener(() => {
            void syncOrientationLockState();
            showOverlayControls();
            resetControlsTimer();
        });

        void (async () => {
            try {
                const current = await Brightness.getBrightnessAsync();
                initialBrightness.current = current;
                setScreenBrightness(current);
            } catch {
                hasBrightnessControl.current = false;
            }
        })();

        let isHardwareVolumeActive = true;

        // Dev build path: hardware volume keys control in-app video volume.
        void (async () => {
            try {
                const nativeModule = require('react-native-volume-manager');
                const volumeApi = nativeModule?.VolumeManager ?? nativeModule?.default;
                // If it unmounted while requiring the module, immediately bail out.
                if (!isHardwareVolumeActive || !volumeApi?.getVolume || !volumeApi?.addVolumeListener || !volumeApi?.setVolume) {
                    return;
                }
                nativeVolumeApiRef.current = volumeApi;

                try {
                    await volumeApi.showNativeVolumeUI?.({ enabled: false });
                } catch {
                    // Ignore if device/runtime does not support hiding native UI.
                }

                // Provide baseline locking with smart headroom to catch relative press events
                const RESTORE_TARGET = 0.5;
                const MARGIN = 0.2; // Only reset system volume when it gets < 20% or > 80%

                baseSystemVolumeRef.current = RESTORE_TARGET;
                lastSystemVolumeRef.current = RESTORE_TARGET;

                await volumeApi.setVolume(RESTORE_TARGET, { type: 'music', showUI: false });

                // If the component unmounted while we were awaiting setVolume, cancel subscription!
                if (!isHardwareVolumeActive) {
                    return;
                }

                let lastEventTs = 0;
                let consecutiveEvents = 0;
                let currentDirection = 0;

                nativeVolumeListenerRef.current = volumeApi.addVolumeListener((event: any) => {
                    const currentSystem = clamp(event?.volume ?? lastSystemVolumeRef.current, 0, 1);
                    const delta = currentSystem - lastSystemVolumeRef.current;

                    // 1. Ignore micro-drifts/float jitter natively broadcasted by Android
                    if (Math.abs(delta) < 0.02) {
                        return;
                    }

                    // 2. MATHEMATICAL RESET ABSORPTION
                    if (Math.abs(delta) > 0.15) {
                        lastSystemVolumeRef.current = currentSystem;
                        return;
                    }

                    lastSystemVolumeRef.current = currentSystem;

                    // 3. BURST TRACKING HEURISTIC
                    // Natively, a single hardware press frequently blasts exactly 2 events rapidly.
                    // A human hold fires continuously every ~50ms.
                    // By grouping events that occur within 160ms of each other into a "burst",
                    // we can strategically drop EXACTLY the 2nd event of every burst.
                    // This perfectly swallows the double-click echo, while passing all subsequent holds!
                    const now = Date.now();
                    if (now - lastEventTs > 160) {
                        consecutiveEvents = 1;
                        currentDirection = delta > 0 ? 1 : -1;
                    } else {
                        consecutiveEvents++;
                    }
                    lastEventTs = now;

                    if (consecutiveEvents === 2) {
                        return; // Drop the echo!
                    }

                    // 4. APPLY VOLUME STEP
                    // Use the established currentDirection so jitter doesn't reverse the hold.

                    // 4. CONTINUOUS HOLD & SINGLE PRESS STREAMING
                    // At this point, the event is a genuine physical press. 
                    // No timeouts, no debounce—we allow native OS streaming to give the user perfectly smooth continuous hold!
                    lastSystemVolumeRef.current = currentSystem;
                    const direction = currentDirection;

                    // Strictly exactly 1 level per press (e.g. 50 -> 51 -> 52) 
                    const STEP_SIZE = 1;
                    const maxVol = playerSettingsRef.current.audioBoostEnabled ? 200 : 100;
                    const currentVolInt = Math.round(volumeRef.current * 100);
                    const nextVolInt = clamp(currentVolInt + (direction * STEP_SIZE), 0, maxVol);
                    const next = setVolumeLevel(nextVolInt / 100);

                    showGestureHud('volume', next);
                    hideGestureHudSoon();

                    // 4. ELASTIC HEADROOM REGENERATION
                    // If the user's continuous holding pushes the bounds, seamlessly invoke the background reset.
                    // It will be harmlessly caught and absorbed by the threshold filter above.
                    if (currentSystem < MARGIN || currentSystem > (1 - MARGIN)) {
                        void volumeApi.setVolume(RESTORE_TARGET, { type: 'music', showUI: false });
                    }
                });
            } catch {
                // Expo Go / unsupported runtime: skip hardware mapping silently.
            }
        })();

        return () => {
            if (tapTimeout.current) {
                clearTimeout(tapTimeout.current);
            }
            if (sleepTimerTimeout.current) {
                clearTimeout(sleepTimerTimeout.current);
            }
            if (fastPlayHoldTimeout.current) {
                clearTimeout(fastPlayHoldTimeout.current);
            }
            if (gestureHudTimeout.current) {
                clearTimeout(gestureHudTimeout.current);
            }
            if (seekFeedbackTimeout.current) {
                clearTimeout(seekFeedbackTimeout.current);
            }
            if (pipEntryTimeout.current) {
                clearTimeout(pipEntryTimeout.current);
            }
            // Mark inactive to cancel any pending async hardware attachment
            isHardwareVolumeActive = false;

            if (nativeVolumeListenerRef.current?.remove) {
                nativeVolumeListenerRef.current.remove();
            }
            if (nativeVolumeApiRef.current?.showNativeVolumeUI) {
                void nativeVolumeApiRef.current.showNativeVolumeUI({ enabled: true }).catch(() => { });
            }
            ScreenOrientation.removeOrientationChangeListener(subscription);
            void ScreenOrientation.unlockAsync();
            if (hasBrightnessControl.current && initialBrightness.current !== null) {
                void Brightness.setBrightnessAsync(initialBrightness.current);
            }
            if (statusRef.current.isLoaded && !statusRef.current.didJustFinish) {
                void writeResumePosition(activeVideoUriRef.current, statusRef.current.positionMillis);
            }
            void pictureInPictureService.setAutoEnterEnabled(false);
            void equalizerService.release();
            const subtitleEnabled = selectedSubtitleIdRef.current !== 'off';
            const shouldSavePerVideoDelay = playerSettingsRef.current.saveAudioDelayPerVideo;
            void savePlaybackPrefs(activeVideoUriRef.current, {
                audioTrackLabel: selectedAudioTrackRef.current,
                audioDisabled: isAudioTrackDisabledRef.current,
                subtitleEnabled,
                subtitleTrackId: subtitleEnabled ? selectedSubtitleIdRef.current : undefined,
                subtitleTrackLabel: subtitleEnabled ? selectedSubtitleRef.current : undefined,
                subtitleSyncMs: shouldSavePerVideoDelay ? subtitleSyncMsRef.current : undefined,
            });
            if (!shouldSavePerVideoDelay) {
                void savePlayerControlSettings({
                    ...playerSettingsRef.current,
                    globalSubtitleDelayMs: subtitleSyncMsRef.current,
                });
            }
        };
    }, []);

    const handleAnalyzeScene = async () => {
        if (!status.isLoaded || isAiAnalyzing) return;

        // 1. Pause video and show analyzing state
        setIsAiAnalyzing(true);
        if (status.isPlaying) {
            player.pause();
        }

        try {
            // 2. Run local hardware ML inference on current frame
            const currentMillis = status.positionMillis || 0;
            const result = await aiService.analyze(currentMillis, title, videoUri);

            // 3. Show Result
            setDetections(result.detections);

        } catch (error: any) {
            console.warn('AI Analysis failed:', error);
        } finally {
            setIsAiAnalyzing(false);
            // intentionally NOT auto-resuming or auto-hiding here so the user has time to read the full analysis
        }
    };

    const handleCloseAI = () => {
        setDetections([]);
        player.play();
    };

    useEffect(() => {
        const syncTracks = () => {
            const audioTracks = (player as any).availableAudioTracks ?? [];
            const subtitles = (player as any).availableSubtitleTracks ?? [];
            const discoveredAudio = audioTracks.map(
                (track: any, index: number) => track?.label || track?.language || `Audio Track ${index + 1}`
            );
            setDetectedAudioTrackCount(discoveredAudio.length);
            if (discoveredAudio.length > 0) {
                setAudioOptions(discoveredAudio);
                if (preferredAudioLabelRef.current && discoveredAudio.includes(preferredAudioLabelRef.current)) {
                    const preferredIndex = discoveredAudio.findIndex(
                        (label: string) => label === preferredAudioLabelRef.current
                    );
                    if (!isAudioTrackDisabled) {
                        try {
                            player.audioTrack = audioTracks[preferredIndex] ?? null;
                        } catch {
                            // Fallback to selected label state.
                        }
                    }
                    setSelectedAudioTrack(preferredAudioLabelRef.current);
                    preferredAudioLabelRef.current = null;
                } else if (!discoveredAudio.includes(selectedAudioTrack)) {
                    setSelectedAudioTrack(discoveredAudio[0]);
                }
            } else {
                setAudioOptions(['Default Audio Track']);
            }

            const discoveredTextTracks = subtitles.map((track: any, index: number) => ({
                id: `embedded:${index}`,
                label: track?.label || track?.language || `Embedded Subtitle ${index + 1}`,
                embeddedIndex: index,
            }));
            setDetectedSubtitleTrackCount(discoveredTextTracks.length);
            setEmbeddedSubtitleOptions(discoveredTextTracks);

            if (!hasRestoredSubtitlePreferenceRef.current && preferredSubtitleIdRef.current && preferredSubtitleIdRef.current !== 'off') {
                const preferredById = discoveredTextTracks.find(
                    (option: SubtitleOption) => option.id === preferredSubtitleIdRef.current
                );
                const preferredByLabel =
                    !preferredById && preferredSubtitleLabelRef.current
                        ? discoveredTextTracks.find(
                            (option: SubtitleOption) => option.label === preferredSubtitleLabelRef.current
                        )
                        : null;
                const preferredOption = preferredById || preferredByLabel;
                if (preferredOption && typeof preferredOption.embeddedIndex === 'number') {
                    try {
                        player.subtitleTrack = subtitles[preferredOption.embeddedIndex] ?? null;
                        setSelectedSubtitleId(preferredOption.id);
                        setSelectedSubtitle(preferredOption.label);
                        setActiveSubtitleCues([]);
                        setActiveSubtitleText('');
                        lastEnabledSubtitleRef.current = preferredOption;
                        hasAppliedDefaultSubtitleRef.current = true;
                        hasRestoredSubtitlePreferenceRef.current = true;
                        preferredSubtitleIdRef.current = preferredOption.id;
                        preferredSubtitleLabelRef.current = preferredOption.label;
                    } catch {
                        // Keep fallback behavior below.
                    }
                }
            }

            if (
                discoveredTextTracks.length > 0 &&
                shouldAutoSelectDefaultSubtitleRef.current &&
                !hasAppliedDefaultSubtitleRef.current &&
                selectedSubtitleId === 'off' &&
                activeSubtitleCues.length === 0
            ) {
                const defaultTrack = subtitles[0] ?? null;
                if (defaultTrack) {
                    player.subtitleTrack = defaultTrack;
                    setSelectedSubtitleId(discoveredTextTracks[0].id);
                    setSelectedSubtitle(discoveredTextTracks[0].label);
                    lastEnabledSubtitleRef.current = discoveredTextTracks[0];
                    hasAppliedDefaultSubtitleRef.current = true;
                }
            }
        };

        const syncStatus = (didJustFinish = false) => {
            const durationMillis = Math.max(0, Math.floor((player.duration || 0) * 1000));
            const positionMillis = Math.max(0, Math.floor((player.currentTime || 0) * 1000));
            const nextStatus: PlayerUiStatus = {
                isLoaded: player.status !== 'idle' && player.status !== 'loading',
                isPlaying: !!player.playing,
                durationMillis,
                positionMillis,
                didJustFinish,
            };
            setStatus(nextStatus);
            statusRef.current = nextStatus;

            if (nextStatus.isLoaded && resumeInfoLoadedRef.current && !hasAppliedResumeRef.current) {
                hasAppliedResumeRef.current = true;
                const resumePosition = resumePositionRef.current;
                const settings = playerSettingsRef.current;
                const canResume =
                    settings.automaticResumePlayback &&
                    resumePosition > 3000 &&
                    durationMillis > 0 &&
                    resumePosition < Math.max(durationMillis - 3000, 0);
                const shouldPromptResume =
                    settings.resumeMode === 'prompt_after_24h' &&
                    resumeUpdatedAtRef.current > 0 &&
                    Date.now() - resumeUpdatedAtRef.current >= RESUME_PROMPT_INACTIVITY_MS;
                if (canResume && !resumePromptShownRef.current) {
                    if (settings.resumeMode === 'always') {
                        player.currentTime = resumePosition / 1000;
                    } else if (shouldPromptResume) {
                        resumePromptShownRef.current = true;
                        hasAutoStarted.current = true;
                        Alert.alert(
                            'Resume Playback',
                            `Continue from ${formatTime(resumePosition)}?`,
                            [
                                {
                                    text: 'Start Over',
                                    style: 'destructive',
                                    onPress: () => {
                                        if (!isIncognito) void writeResumePosition(videoUri, 0);
                                        player.currentTime = 0;
                                        player.play();
                                    },
                                },
                                {
                                    text: 'Resume',
                                    onPress: () => {
                                        player.currentTime = resumePosition / 1000;
                                        player.play();
                                    },
                                },
                            ],
                            { cancelable: false }
                        );
                    } else {
                        player.currentTime = resumePosition / 1000;
                    }
                }
            }

            if (nextStatus.isLoaded && !hasAutoStarted.current) {
                hasAutoStarted.current = true;
                player.play();
            }

            if (didJustFinish) {
                showOverlayControls();
                if (!isIncognito) void writeResumePosition(videoUri, 0);
                if (repeatMode === 'single') {
                    player.currentTime = 0;
                    player.play();
                } else if (repeatMode === 'all') {
                    // Placeholder for actual playlist queue advancement.
                    // If this was a real playlist manager context, playNext() would trigger.
                    // For now, loop this item as 'All' conceptually.
                    player.currentTime = 0;
                    player.play();
                }
            }

            if (abRepeatStartMs !== null && abRepeatEndMs !== null && positionMillis >= abRepeatEndMs) {
                // Seek to EXACT A-point
                player.currentTime = abRepeatStartMs / 1000;
                player.play(); // ensure it continues playing
            }

            if (nextStatus.isLoaded && hasAppliedResumeRef.current) {
                const now = Date.now();
                if (now - lastResumeSaveTs.current > 3000) {
                    lastResumeSaveTs.current = now;
                    if (!isIncognito) void writeResumePosition(videoUri, positionMillis);
                }
            }
        };

        syncTracks();
        syncStatus(false);
        const subs = [
            player.addListener('timeUpdate', () => syncStatus(false)),
            player.addListener('playingChange', () => syncStatus(false)),
            player.addListener('availableAudioTracksChange', () => syncTracks()),
            player.addListener('availableSubtitleTracksChange', () => syncTracks()),
            player.addListener('sourceLoad', () => {
                syncTracks();
                syncStatus(false);
            }),
            player.addListener('playToEnd', () => syncStatus(true)),
            player.addListener('statusChange', (payload: any) => {
                if (payload?.status === 'error') {
                    handleVideoError(payload?.error?.message || 'Unknown player error');
                }
                syncStatus(false);
            }),
        ];
        return () => {
            subs.forEach((sub: any) => sub?.remove?.());
        };
    }, [player, repeatMode, selectedAudioTrack, isAudioTrackDisabled, videoUri, abRepeatStartMs, abRepeatEndMs]);

    const flashSeekFeedback = (text: string) => {
        showSeekFeedback(text, 520);
    };

    const handleJumpBySeconds = async (seconds: number) => {
        if (!status.isLoaded) return;
        const duration = status.durationMillis ?? 0;
        const nextPosition = Math.max(0, Math.min(duration, status.positionMillis + seconds * 1000));
        player.currentTime = nextPosition / 1000;
        flashSeekFeedback(seconds > 0 ? `+${seconds}s` : `${seconds}s`);
    };

    const handleSurfaceTap = (event: any) => {
        if (blockNextTap.current) {
            blockNextTap.current = false;
            return;
        }
        if (isTouchLocked) {
            showOverlayControls();
            resetControlsTimer();
            return;
        }

        const settings = playerSettingsRef.current;
        const now = Date.now();
        const tapX = event.nativeEvent?.locationX ?? width / 2;
        const centerStart = width * 0.35;
        const centerEnd = width * 0.65;
        const isCenterTap = tapX >= centerStart && tapX <= centerEnd;

        if (now - lastTapTimestamp.current < DOUBLE_TAP_DELAY_MS) {
            if (tapTimeout.current) {
                clearTimeout(tapTimeout.current);
            }
            lastTapTimestamp.current = 0;
            if (isCenterTap && settings.doubleTapCenterPlayPauseEnabled) {
                void handlePlayPause();
                showOverlayControls();
                resetControlsTimer();
                return;
            }
            if (settings.doubleTapSeekEnabled) {
                const isLeftSide = tapX < width / 2;
                void handleJumpBySeconds(isLeftSide ? -settings.seekStepSeconds : settings.seekStepSeconds);
            }
            showOverlayControls();
            resetControlsTimer();
            return;
        }

        lastTapTimestamp.current = now;
        tapTimeout.current = setTimeout(() => {
            if (showControls) {
                hideOverlayControls();
            } else {
                showOverlayControls();
                resetControlsTimer();
            }
        }, DOUBLE_TAP_DELAY_MS);
    };

    const handlePlayPause = async () => {
        if (!status.isLoaded) return;
        Animated.sequence([
            Animated.timing(playButtonScale, {
                toValue: 0.94,
                duration: 90,
                useNativeDriver: true,
            }),
            Animated.spring(playButtonScale, {
                toValue: 1,
                friction: 5,
                tension: 120,
                useNativeDriver: true,
            }),
        ]).start();
        if (status.isPlaying) {
            player.pause();
        } else {
            player.play();
        }
        showOverlayControls();
        resetControlsTimer();
    };

    const handleSeek = async (value: number) => {
        sliderSeekingRef.current = false;
        if (stableDurationMillis <= 0) return;
        player.currentTime = value / 1000;
        setSeekPreviewPosition(value);
        setIsSeeking(false);
        setStatus((prev) => ({ ...prev, positionMillis: value }));
        statusRef.current = { ...statusRef.current, positionMillis: value };
        resetControlsTimer();
    };

    const handleSeekStart = () => {
        if (stableDurationMillis <= 0) return;
        sliderSeekingRef.current = true;
        setIsSeeking(true);
        const current = statusRef.current.positionMillis || status.positionMillis || 0;
        setSeekPreviewPosition(current);
    };

    const handleSeekChange = (value: number) => {
        if (stableDurationMillis <= 0) return;
        setSeekPreviewPosition(value);
    };

    const handleLongPress = () => {
        if (isTouchLocked) return;
        if (playerSettings.fastPlayHoldEnabled) {
            return;
        }
        showOverlayControls();
        openQuickAdvancedPanel();
    };

    const handleSurfacePressIn = () => {
        if (isTouchLocked) return;
        if (!playerSettingsRef.current.fastPlayHoldEnabled || !status.isLoaded || !status.isPlaying) return;
        if (fastPlayHoldTimeout.current) {
            clearTimeout(fastPlayHoldTimeout.current);
        }
        fastPlayHoldTimeout.current = setTimeout(() => {
            speedBeforeHoldRef.current = playbackSpeed;
            player.playbackRate = playerSettingsRef.current.fastPlaySpeed;
            flashSeekFeedback(`Fastplay ${playerSettingsRef.current.fastPlaySpeed.toFixed(2)}x`);
        }, 220);
    };

    const handleSurfacePressOut = () => {
        if (isTouchLocked) return;
        if (fastPlayHoldTimeout.current) {
            clearTimeout(fastPlayHoldTimeout.current);
            fastPlayHoldTimeout.current = null;
        }
        if (speedBeforeHoldRef.current !== null) {
            const restore = speedBeforeHoldRef.current;
            speedBeforeHoldRef.current = null;
            player.playbackRate = restore;
            setPlaybackSpeed(restore);
        }
    };

    const handleChangeSpeed = async (speed: number) => {
        setPlaybackSpeed(speed);
        if (status.isLoaded) {
            player.playbackRate = speed;
        }
        flashSeekFeedback(`Speed: ${speed}x`);
        // Slight delay to prevent immediate panel closure issues
        setTimeout(() => setAdvancedPanelVisible(false), 200);
    };

    const getPlayerAudioSessionId = () => {
        const anyPlayer = player as any;
        const candidates = [
            anyPlayer?.audioSessionId,
            anyPlayer?.androidAudioSessionId,
            anyPlayer?.player?.audioSessionId,
            anyPlayer?.nativeRef?.audioSessionId,
        ];
        for (const candidate of candidates) {
            if (typeof candidate === 'number' && Number.isFinite(candidate)) {
                return Math.max(0, Math.floor(candidate));
            }
        }
        return 0;
    };

    const applyEqualizerToNative = async (next: EqualizerSettings) => {
        if (!equalizerSupported) return;
        try {
            const sessionId = getPlayerAudioSessionId();
            await equalizerService.attachToPlayerSession(sessionId);
            await equalizerService.setEnabled(next.enabled);
            await equalizerService.setPreampDb(next.preampDb);
            for (let i = 0; i < EQUALIZER_FREQUENCIES.length; i += 1) {
                await equalizerService.setBandGainDb(i, next.bandsDb[i] ?? 0);
            }
        } catch {
            // Native DSP apply is best effort. UI state remains persisted.
        }
    };

    const updateEqualizerSettings = (next: EqualizerSettings) => {
        setEqualizerSettings(next);
        setEqualizerMode(
            next.presetId === 'flat'
                ? 'Flat'
                : next.presetId === 'bass_boost'
                    ? 'Bass Boost'
                    : next.presetId === 'treble_boost'
                        ? 'Treble Boost'
                        : next.presetId === 'vocal'
                            ? 'Vocal'
                            : 'Custom'
        );
        void saveEqualizerSettings(next);
        void applyEqualizerToNative(next);
    };

    const handleSelectEqualizerPreset = (presetId: EqualizerPresetId) => {
        if (presetId === 'custom') {
            updateEqualizerSettings({ ...equalizerSettings, presetId: 'custom' });
            return;
        }
        const next = applyEqualizerPreset(equalizerSettings, presetId);
        updateEqualizerSettings(next);
    };

    const handleSetEqualizerBand = (index: number, value: number) => {
        const nextBands = [...equalizerSettings.bandsDb];
        nextBands[index] = value;
        updateEqualizerSettings({
            ...equalizerSettings,
            presetId: 'custom',
            selectedCustomProfileId: null,
            bandsDb: nextBands,
        });
    };

    const handleSaveEqualizerProfile = () => {
        const profileId = `custom-${Date.now()}`;
        const profileName = `Custom ${equalizerSettings.customProfiles.length + 1}`;
        const next = {
            ...equalizerSettings,
            presetId: 'custom' as const,
            selectedCustomProfileId: profileId,
            customProfiles: [
                ...equalizerSettings.customProfiles,
                {
                    id: profileId,
                    name: profileName,
                    preampDb: equalizerSettings.preampDb,
                    bandsDb: [...equalizerSettings.bandsDb],
                },
            ],
        };
        updateEqualizerSettings(next);
        Alert.alert('Equalizer', `${profileName} saved.`);
    };

    const handleSelectEqualizerCustomProfile = (profileId: string) => {
        const profile = equalizerSettings.customProfiles.find((item) => item.id === profileId);
        if (!profile) return;
        updateEqualizerSettings({
            ...equalizerSettings,
            presetId: 'custom',
            selectedCustomProfileId: profile.id,
            preampDb: profile.preampDb,
            bandsDb: [...profile.bandsDb],
        });
    };

    const handleDeleteEqualizerProfile = () => {
        if (!equalizerSettings.selectedCustomProfileId) {
            Alert.alert('Equalizer', 'No custom profile selected.');
            return;
        }
        const nextProfiles = equalizerSettings.customProfiles.filter(
            (profile) => profile.id !== equalizerSettings.selectedCustomProfileId
        );
        updateEqualizerSettings({
            ...equalizerSettings,
            customProfiles: nextProfiles,
            selectedCustomProfileId: null,
        });
        Alert.alert('Equalizer', 'Custom profile deleted.');
    };

    const handleSetDisplayMode = (mode: DisplayMode) => {
        setSelectedDisplayMode(mode);
    };

    const parseTimeInputToMs = (value: string): number => {
        const cleaned = value.trim();
        if (!cleaned) return 0;
        if (/^\d+$/.test(cleaned)) {
            return Math.max(0, Number(cleaned)) * 1000;
        }
        const parts = cleaned.split(':').map((part) => Number(part));
        if (parts.some((n) => Number.isNaN(n) || n < 0)) return 0;
        let total = 0;
        if (parts.length === 2) {
            total = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            total = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else {
            return 0;
        }
        return total * 1000;
    };

    const openJumpToTimePanel = () => {
        if (!status.isLoaded) return;
        const current = status.positionMillis || 0;
        setJumpTargetMs(current);
        setJumpInput(formatTime(current));
        setJumpToTimeVisible(true);
        setMorePanelVisible(false);
    };

    const applyJumpToTime = (targetMs: number) => {
        if (!status.isLoaded) return;
        const clampedTarget = clamp(targetMs, 0, status.durationMillis || 0);
        player.currentTime = clampedTarget / 1000;
        setJumpTargetMs(clampedTarget);
        setSeekPreviewPosition(clampedTarget);
        setStatus((prev) => ({ ...prev, positionMillis: clampedTarget }));
        statusRef.current = { ...statusRef.current, positionMillis: clampedTarget };
        setJumpToTimeVisible(false);
        flashSeekFeedback(`Jumped to ${formatTime(clampedTarget)}`);

        // Resume play if paused but was playing before the jump prompt
        if (!status.isPlaying) {
            player.play();
        }
    };

    const toggleAudioOnlyMode = () => {
        setAudioOnlyMode((prev) => !prev);
        setMorePanelVisible(false);
    };

    const openOverlaySettings = async () => {
        try {
            await floatingOverlayService.openPermissionSettings();
        } catch {
            Alert.alert('Floating Player', 'Unable to open overlay permission settings.');
        }
    };

    const showOverlayBlockedPrompt = (message: string) => {
        Alert.alert('Enable Floating Window', message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void openOverlaySettings() },
        ]);
    };
    const showPiPBlockedPrompt = showOverlayBlockedPrompt;

    const clearPiPEntryWatchdog = () => {
        pipEntryPendingRef.current = false;
        pipEnteredRef.current = false;
        if (pipEntryTimeout.current) {
            clearTimeout(pipEntryTimeout.current);
            pipEntryTimeout.current = null;
        }
    };

    const togglePopUpMode = async () => {
        const next = !popUpMode;
        setMorePanelVisible(false);

        if (!USE_SYSTEM_PIP) {
            try {
                if (next) {
                    const supported = await floatingOverlayService.isSupported();
                    if (!supported) {
                        Alert.alert('Floating Player', 'Floating player is supported on Android only.');
                        return;
                    }
                    const granted = await floatingOverlayService.isPermissionGranted();
                    if (!granted) {
                        showOverlayBlockedPrompt('Allow "Display over other apps" to use floating player.');
                        return;
                    }
                    const startAt = statusRef.current.positionMillis || 0;
                    const shouldPlay = statusRef.current.isPlaying;
                    if (statusRef.current.isLoaded && shouldPlay) {
                        player.pause();
                    }
                    await floatingOverlayService.startOverlay(
                        videoUri,
                        startAt,
                        shouldPlay,
                        title || 'MC AI Player'
                    );
                    setPopUpMode(true);
                    closeAllPanels();
                    hideOverlayControls();
                } else {
                    await floatingOverlayService.stopOverlay().catch(() => { });
                    setPopUpMode(false);
                    showOverlayControls();
                    resetControlsTimer();
                }
            } catch {
                setPopUpMode(false);
                showOverlayControls();
                resetControlsTimer();
                Alert.alert('Floating Player', 'Unable to start floating window on this device right now.');
            }
            return;
        }

        if (!next) {
            setPopUpMode(false);
            clearPiPEntryWatchdog();
            if (pipSupported) {
                await pictureInPictureService.setAutoEnterEnabled(false);
            }
            showOverlayControls();
            resetControlsTimer();
            return;
        }

        const supported = pipSupported || (await pictureInPictureService.isSupported());
        if (!supported) {
            setPipSupported(false);
            setPopUpMode(false);
            await pictureInPictureService.setAutoEnterEnabled(false);
            showPiPBlockedPrompt('Picture-in-Picture is not supported or not available on this device.');
            showOverlayControls();
            resetControlsTimer();
            return;
        }

        setPipSupported(true);
        let resumedForPiP = false;
        try {
            clearPiPEntryWatchdog();
            pipEntryPendingRef.current = true;
            await pictureInPictureService.setAutoEnterEnabled(false);
            if (!statusRef.current.isPlaying && statusRef.current.isLoaded) {
                player.play();
                resumedForPiP = true;
                await new Promise((resolve) => setTimeout(resolve, 180));
            }
            await pictureInPictureService.enter(16, 9, statusRef.current.isPlaying);
            await pictureInPictureService.setAutoEnterEnabled(true);
            pipEntryTimeout.current = setTimeout(() => {
                if (!pipEntryPendingRef.current || pipEnteredRef.current) return;
                clearPiPEntryWatchdog();
                void pictureInPictureService.setAutoEnterEnabled(false);
                setPopUpMode(false);
                void pictureInPictureService.bringAppToFront().catch(() => { });
                void pictureInPictureService.isSupported().then(setPipSupported).catch(() => { });
                showPiPBlockedPrompt('PiP could not be started on this device right now.');
                showOverlayControls();
                resetControlsTimer();
            }, 1800);
        } catch {
            try {
                await new Promise((resolve) => setTimeout(resolve, 180));
                await pictureInPictureService.enter(16, 9, true);
                await pictureInPictureService.setAutoEnterEnabled(true);
                pipEntryTimeout.current = setTimeout(() => {
                    if (!pipEntryPendingRef.current || pipEnteredRef.current) return;
                    clearPiPEntryWatchdog();
                    void pictureInPictureService.setAutoEnterEnabled(false);
                    setPopUpMode(false);
                    void pictureInPictureService.bringAppToFront().catch(() => { });
                    showPiPBlockedPrompt('PiP could not be started on this device right now.');
                    showOverlayControls();
                    resetControlsTimer();
                }, 1800);
                return;
            } catch {
                await pictureInPictureService.setAutoEnterEnabled(false);
                setPopUpMode(false);
                clearPiPEntryWatchdog();
                if (resumedForPiP && statusRef.current.isLoaded) {
                    player.pause();
                }
                // Some OEM ROMs may push app to background on failed PiP attempt.
                await pictureInPictureService.bringAppToFront().catch(() => { });
                const permissionEnabled = await pictureInPictureService.isPermissionEnabled();
                showPiPBlockedPrompt(
                    permissionEnabled
                        ? 'PiP could not be started right now on this device. Please disable battery restrictions and try again.'
                        : 'PiP could not be started. Please allow Picture-in-Picture for this app.'
                );
                showOverlayControls();
                resetControlsTimer();
            }
        }
    };


    const cycleRepeatMode = () => {
        setRepeatMode((prev) => {
            if (prev === 'off') {
                flashSeekFeedback('Repeat: Single');
                return 'single';
            }
            if (prev === 'single') {
                flashSeekFeedback('Repeat: All');
                return 'all';
            }
            flashSeekFeedback('Repeat: Off');
            return 'off';
        });
    };

    const cycleAbRepeat = () => {
        if (!status.isLoaded) return;
        const pos = status.positionMillis;
        if (abRepeatStartMs === null) {
            setAbRepeatStartMs(pos);
            setAbRepeatEndMs(null);
            flashSeekFeedback(`A set: ${formatTime(pos)}`);
            return;
        }
        if (abRepeatEndMs === null) {
            if (pos <= abRepeatStartMs + 1000) {
                Alert.alert('A-B repeat', 'B must be greater than A.');
                return;
            }
            setAbRepeatEndMs(pos);
            flashSeekFeedback(`B set: ${formatTime(pos)}`);
            return;
        }
        setAbRepeatStartMs(null);
        setAbRepeatEndMs(null);
        flashSeekFeedback('A-B repeat cleared');
    };

    const saveCurrentPlaylist = async () => {
        const playlistName = `${title || 'Playlist'} - ${new Date().toLocaleString()}`;
        await savePlaylistSnapshot(playlistName, playlistItems);
        setShowPlaylist(true);
        setMorePanelVisible(false);
        Alert.alert('Playlist', 'Playlist saved successfully.');
    };

    const cycleQuickDisplayModeInternal = (showHint: boolean) => {
        const quickCurrentIndex = ZOOM_CYCLE_MODES.findIndex((mode) => mode.id === selectedDisplayMode.id);
        const nextIndex = quickCurrentIndex === -1 ? 0 : (quickCurrentIndex + 1) % ZOOM_CYCLE_MODES.length;
        const nextMode = ZOOM_CYCLE_MODES[nextIndex];
        handleSetDisplayMode(nextMode);
        flashSeekFeedback(showHint ? `${nextMode.label} - More zoom options` : `Zoom: ${nextMode.label}`);
        resetControlsTimer();
    };

    const cycleQuickDisplayMode = () => {
        cycleQuickDisplayModeInternal(true);
    };

    const cycleEqualizerMode = () => {
        setEqualizerPanelVisible(true);
        setMorePanelVisible(false);
        setAdvancedPanelVisible(false);
        setAudioPanelVisible(false);
        setZoomPanelVisible(false);
        setControlSettingsVisible(false);
        setVideoTipsVisible(false);
    };

    const cycleSleepTimer = () => {
        const options: Array<number | null> = [null, 15, 30, 60];
        const idx = options.indexOf(sleepMinutes);
        const nextValue = options[(idx + 1) % options.length];
        setSleepMinutes(nextValue);

        if (sleepTimerTimeout.current) {
            clearTimeout(sleepTimerTimeout.current);
            sleepTimerTimeout.current = null;
        }

        if (nextValue) {
            sleepTimerTimeout.current = setTimeout(() => {
                player.pause();
                showOverlayControls();
                Alert.alert('Sleep Timer', 'Playback paused.');
            }, nextValue * 60 * 1000);
        }
    };

    const addBookmark = () => {
        if (!status.isLoaded) return;
        const sec = Math.floor(status.positionMillis / 1000);
        setBookmarks((prev) => {
            if (prev.includes(sec)) return prev;
            const newBookmarks = [...prev, sec].sort((a, b) => a - b);
            if (!isIncognito) void saveBookmarks(videoUri, newBookmarks);
            return newBookmarks;
        });
        flashSeekFeedback(`Bookmark added at ${formatTime(sec * 1000)}`);
    };

    const jumpToBookmark = async (sec: number) => {
        player.currentTime = sec;
        showOverlayControls();
        resetControlsTimer();
    };

    const toggleOrientationLock = async () => {
        if (isOrientationLocked) {
            await ScreenOrientation.unlockAsync();
            setIsOrientationLocked(false);
            flashSeekFeedback('Orientation unlocked');
            showOverlayControls();
            resetControlsTimer();
            return;
        }

        const allowSensor = playerSettingsRef.current.lockWithSensorEnabled;
        if (isLandscape) {
            await ScreenOrientation.lockAsync(
                allowSensor
                    ? ScreenOrientation.OrientationLock.LANDSCAPE
                    : ScreenOrientation.OrientationLock.LANDSCAPE_LEFT
            );
        } else {
            await ScreenOrientation.lockAsync(
                allowSensor
                    ? ScreenOrientation.OrientationLock.PORTRAIT
                    : ScreenOrientation.OrientationLock.PORTRAIT_UP
            );
        }
        setIsOrientationLocked(true);
        flashSeekFeedback(isLandscape ? 'Orientation locked: Landscape' : 'Orientation locked: Portrait');
        showOverlayControls();
        resetControlsTimer();
    };

    const rotateScreenManually = async () => {
        // Manual rotate should work even when phone auto-rotate is disabled.
        if (!isOrientationLocked) {
            setIsOrientationLocked(true);
        }

        if (isLandscape) {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            flashSeekFeedback('Portrait');
        } else {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            flashSeekFeedback('Landscape');
        }
        showOverlayControls();
        resetControlsTimer();
    };

    useEffect(() => {
        if (!isOrientationLocked) {
            void ScreenOrientation.unlockAsync();
        }
    }, [isOrientationLocked]);

    useEffect(() => {
        if (!USE_SYSTEM_PIP) return;
        const sub = AppState.addEventListener('change', (state) => {
            if (state !== 'background') return;
            if (!popUpMode || !pipSupported) return;
            if (!statusRef.current.isLoaded) return;
            void pictureInPictureService.enter(16, 9, statusRef.current.isPlaying).catch(() => { });
        });
        return () => {
            sub.remove();
        };
    }, [popUpMode, pipSupported]);

    useEffect(() => {
        if (!USE_SYSTEM_PIP) return;
        if (!pipSupported || !popUpMode) return;
        void pictureInPictureService.updateActions(status.isPlaying).catch(() => { });
    }, [pipSupported, popUpMode, status.isPlaying]);

    useEffect(() => {
        if (!USE_SYSTEM_PIP) return;
        const sub = DeviceEventEmitter.addListener('McAiPiPAction', (action: string) => {
            switch (action) {
                case 'app.mcai.videoplayer.pip.PLAY_PAUSE':
                    if (!statusRef.current.isLoaded) return;
                    if (statusRef.current.isPlaying) {
                        player.pause();
                    } else {
                        player.play();
                    }
                    return;
                case 'app.mcai.videoplayer.pip.EXPAND':
                    setPopUpMode(false);
                    showOverlayControls();
                    resetControlsTimer();
                    return;
                case 'app.mcai.videoplayer.pip.CLOSE':
                    setPopUpMode(false);
                    void pictureInPictureService.setAutoEnterEnabled(false);
                    if (statusRef.current.isLoaded && statusRef.current.isPlaying) {
                        player.pause();
                    }
                    return;
                case 'app.mcai.videoplayer.pip.STATE_ENTERED':
                    pipEnteredRef.current = true;
                    pipEntryPendingRef.current = false;
                    if (pipEntryTimeout.current) {
                        clearTimeout(pipEntryTimeout.current);
                        pipEntryTimeout.current = null;
                    }
                    setPopUpMode(true);
                    hideOverlayControls();
                    flashSeekFeedback('Floating Mode Enabled');
                    return;
                case 'app.mcai.videoplayer.pip.STATE_EXITED':
                    clearPiPEntryWatchdog();
                    setPopUpMode(false);
                    showOverlayControls();
                    resetControlsTimer();
                    return;
                default:
                    return;
            }
        });
        return () => {
            sub.remove();
        };
    }, [player]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener(
            'McAiOverlayAction',
            (payload: { action?: string; positionMs?: number }) => {
                const action = payload?.action;
                const positionMs = Math.max(0, payload?.positionMs ?? 0);
                if (action === 'app.mcai.videoplayer.overlay.EXPAND') {
                    setPopUpMode(false);
                    if (statusRef.current.isLoaded) {
                        player.currentTime = positionMs / 1000;
                        player.play();
                    }
                    showOverlayControls();
                    resetControlsTimer();
                    return;
                }
                if (action === 'app.mcai.videoplayer.overlay.CLOSE') {
                    setPopUpMode(false);
                    if (statusRef.current.isLoaded) {
                        player.currentTime = positionMs / 1000;
                    }
                    showOverlayControls();
                    resetControlsTimer();
                }
            }
        );
        return () => {
            sub.remove();
        };
    }, [player]);

    useEffect(() => {
        if (!status.isLoaded || !equalizerSupported) return;
        void applyEqualizerToNative(equalizerSettingsRef.current);
    }, [status.isLoaded, equalizerSupported, videoUri]);

    useEffect(() => {
        if (!status.isLoaded || selectedSubtitleId === 'off' || activeSubtitleCues.length === 0) {
            if (activeSubtitleText) {
                setActiveSubtitleText('');
            }
            return;
        }
        const nowMs = Math.max(0, status.positionMillis + subtitleSyncMs);
        const text = getSubtitleTextAt(activeSubtitleCues, nowMs);
        if (text !== activeSubtitleText) {
            setActiveSubtitleText(text);
        }
    }, [status, subtitleSyncMs, activeSubtitleCues, selectedSubtitleId, activeSubtitleText]);

    useEffect(() => {
        animatePanel(audioPanelAnim, audioPanelVisible);
    }, [audioPanelVisible]);

    useEffect(() => {
        animatePanel(volumePanelAnim, volumePanelVisible);
    }, [volumePanelVisible]);

    useEffect(() => {
        animatePanel(morePanelAnim, morePanelVisible);
    }, [morePanelVisible]);

    useEffect(() => {
        animatePanel(advancedPanelAnim, advancedPanelVisible);
    }, [advancedPanelVisible]);

    useEffect(() => {
        animatePanel(zoomPanelAnim, zoomPanelVisible);
    }, [zoomPanelVisible]);

    const sceneInfo = detections.find((d) => d.type === 'scene');
    const actors = detections
        .filter((d) => d.type === 'person')
        .map((d) => d.metadata?.actorName || d.label);

    const containerPadding = isLandscape ? SPACING.s : SPACING.m;
    const advancedPanelMaxHeight = isLandscape ? Math.max(240, height - 96) : Math.max(320, Math.floor(height * 0.68));
    const advancedPanelWidth = isLandscape ? Math.min(360, Math.max(270, Math.floor(width * 0.44))) : 280;
    const maxVolumeLevel = playerSettings.audioBoostEnabled ? 2 : 1;
    const sliderMaxMillis = Math.max(stableDurationMillis, status.durationMillis || 0, 1);
    const livePositionMillis = status.positionMillis || statusRef.current.positionMillis || 0;
    const displayPositionMillis = isSeeking ? seekPreviewPosition : livePositionMillis;
    const videoFrameStyle = (() => {
        if (selectedDisplayMode.id === 'center') {
            return styles.centerVideo;
        }

        if (!selectedDisplayMode.aspectRatio) {
            return styles.video;
        }

        const targetRatio = selectedDisplayMode.aspectRatio;
        const containerRatio = width / Math.max(height, 1);

        if (containerRatio > targetRatio) {
            return {
                height: '100%' as const,
                aspectRatio: targetRatio,
                alignSelf: 'center' as const,
            };
        }

        return {
            width: '100%' as const,
            aspectRatio: targetRatio,
            alignSelf: 'center' as const,
        };
    })();

    return (
        <View style={styles.screen}>
            <StatusBar hidden />

            <Pressable
                style={styles.videoContainer}
                onPress={handleSurfaceTap}
                onLongPress={handleLongPress}
                delayLongPress={400}
                onPressIn={handleSurfacePressIn}
                onPressOut={handleSurfacePressOut}
                onLayout={(event) => setViewDimensions(event.nativeEvent.layout)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
            >
                <View
                    style={[
                        styles.videoStage,
                        audioOnlyMode && styles.videoStageAudioOnly,
                    ]}
                    pointerEvents="none"
                >
                    {!audioOnlyMode ? (
                        <VideoView
                            style={videoFrameStyle}
                            player={player}
                            nativeControls={false}
                            contentFit={selectedDisplayMode.contentFit}
                        />
                    ) : (
                        <View style={styles.audioOnlyCard}>
                            <Ionicons name="musical-notes-outline" size={32} color={colors.primary} />
                            <Text style={styles.audioOnlyTitle}>Audio Only Mode</Text>
                            <Text style={styles.audioOnlyMeta}>{title || 'Playing in background mode'}</Text>
                        </View>
                    )}
                </View>

                <AIOverlay
                    detections={detections}
                    videoDimensions={{ width: 1920, height: 1080 }}
                    viewDimensions={viewDimensions}
                    visible={detections.length > 0 || isAiAnalyzing}
                    isAnalyzing={isAiAnalyzing}
                    onClose={handleCloseAI}
                />

                {selectedSubtitleId !== 'off' && !!activeSubtitleText && !audioOnlyMode && (
                    <View style={styles.subtitleOverlay} pointerEvents="none">
                        <Text style={styles.subtitleText}>{activeSubtitleText}</Text>
                    </View>
                )}

                <Animated.View style={[styles.seekFeedbackBadge, { opacity: seekFeedbackOpacity }]}>
                    <Text style={styles.seekFeedbackText}>{seekFeedbackText}</Text>
                </Animated.View>

                {(abRepeatStartMs !== null || abRepeatEndMs !== null) && (
                    <View style={styles.abRepeatBadge}>
                        <Text style={styles.abRepeatText}>
                            A: {abRepeatStartMs !== null ? formatTime(abRepeatStartMs) : '--:--'}  B:{' '}
                            {abRepeatEndMs !== null ? formatTime(abRepeatEndMs) : '--:--'}
                        </Text>
                    </View>
                )}

                {gestureHud.visible && (
                    <View style={styles.gestureHud}>
                        <Ionicons
                            name={gestureHud.type === 'volume' ? 'volume-high-outline' : 'sunny-outline'}
                            size={20}
                            color={colors.white}
                        />
                        <Text style={styles.gestureHudText}>
                            {gestureHud.type === 'volume' ? 'Volume' : 'Brightness'} {Math.round(gestureHud.value * 100)}%
                        </Text>
                    </View>
                )}

                <Animated.View
                    pointerEvents={showControls ? 'auto' : 'none'}
                    style={[
                        styles.controlsOverlay,
                        { opacity: controlsOpacity, paddingHorizontal: containerPadding },
                    ]}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                >
                    {isTouchLocked ? (
                        <View style={styles.lockedOverlayContainer}>
                            <TouchableOpacity
                                style={styles.unlockButton}
                                onPress={() => {
                                    setIsTouchLocked(false);
                                    showOverlayControls();
                                    resetControlsTimer();
                                    flashSeekFeedback("Controls Unlocked");
                                }}
                            >
                                <Ionicons name="lock-closed" size={24} color={colors.white} />
                                <Text style={styles.unlockText}>Unlock</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <View style={styles.topBar}>
                                <TouchableOpacity
                                    style={styles.topIconButton}
                                    onPress={() => {
                                        if (navigation.canGoBack()) {
                                            navigation.goBack();
                                        } else {
                                            navigation.replace('Main');
                                        }
                                    }}
                                >
                                    <Ionicons name="arrow-back" size={22} color={colors.white} />
                                </TouchableOpacity>
                                <Text style={styles.titleText} numberOfLines={1}>
                                    {title || 'Video'}
                                </Text>
                                <View style={styles.topRightActions}>
                                    <TouchableOpacity
                                        style={styles.topIconButton}
                                        onPress={() => void rotateScreenManually()}
                                    >
                                        <Ionicons name="phone-portrait-outline" size={20} color={colors.white} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.topIconButton, isOrientationLocked && styles.activeTopIconButton]}
                                        onPress={() => void toggleOrientationLock()}
                                    >
                                        <Ionicons
                                            name={isOrientationLocked ? 'lock-closed-outline' : 'lock-open-outline'}
                                            size={20}
                                            color={colors.white}
                                        />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.topIconButton, isAiAnalyzing && styles.activeTopIconButton]}
                                        onPress={handleAnalyzeScene}
                                        disabled={isAiAnalyzing}
                                    >
                                        <View style={[styles.aiBadgeContainer, isAiAnalyzing && styles.aiBadgeContainerActive]}>
                                            <Text style={[styles.aiBadgeText, isAiAnalyzing && styles.aiBadgeTextActive]}>{isAiAnalyzing ? '...' : 'AI'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={[styles.bottomCluster, isLandscape && styles.bottomClusterLandscape]}>
                                {playerSettings.seekButtonsVisible && (
                                    <View style={styles.seekButtonsRow}>
                                        <TouchableOpacity
                                            style={styles.seekActionButton}
                                            onPress={() => void handleJumpBySeconds(-playerSettings.seekStepSeconds)}
                                            onLongPress={() => void handleJumpBySeconds(-playerSettings.longPressSeekStepSeconds)}
                                        >
                                            <Ionicons name="play-back" size={20} color={colors.white} />
                                            <Text style={styles.seekActionText}>-{playerSettings.seekStepSeconds}s</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.seekActionButton}
                                            onPress={() => void handleJumpBySeconds(playerSettings.seekStepSeconds)}
                                            onLongPress={() => void handleJumpBySeconds(playerSettings.longPressSeekStepSeconds)}
                                        >
                                            <Ionicons name="play-forward" size={20} color={colors.white} />
                                            <Text style={styles.seekActionText}>+{playerSettings.seekStepSeconds}s</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                <Animated.View style={{ transform: [{ scale: playButtonScale }] }}>
                                    <TouchableOpacity style={styles.playPauseButton} onPress={handlePlayPause}>
                                        <Ionicons
                                            name={status.isLoaded && status.isPlaying ? 'pause' : 'play'}
                                            size={44}
                                            color={colors.white}
                                            style={[
                                                styles.playPauseIcon,
                                            ]}
                                        />
                                    </TouchableOpacity>
                                </Animated.View>

                                <View style={styles.seekRow}>
                                    <TouchableOpacity
                                        style={styles.roundIconButton}
                                        onPress={() => {
                                            setAudioPanelVisible((prev) => !prev);
                                            setVolumePanelVisible(false);
                                            setMorePanelVisible(false);
                                            setAdvancedPanelVisible(false);
                                            setZoomPanelVisible(false);
                                        }}
                                        onLongPress={() => {
                                            setVolumePanelVisible((prev) => !prev);
                                            setAudioPanelVisible(false);
                                            setMorePanelVisible(false);
                                            setAdvancedPanelVisible(false);
                                            setZoomPanelVisible(false);
                                        }}
                                    >
                                        <Ionicons
                                            name="language-outline"
                                            size={20}
                                            color={colors.white}
                                        />
                                    </TouchableOpacity>
                                    <Text style={styles.timeText}>
                                        {sliderMaxMillis > 1 ? formatTime(displayPositionMillis) : '00:00'}
                                    </Text>

                                    <Slider
                                        style={styles.slider}
                                        minimumValue={0}
                                        maximumValue={sliderMaxMillis}
                                        value={Math.max(0, Math.min(displayPositionMillis, sliderMaxMillis))}
                                        onSlidingStart={handleSeekStart}
                                        onValueChange={handleSeekChange}
                                        onSlidingComplete={handleSeek}
                                        minimumTrackTintColor={colors.primary}
                                        maximumTrackTintColor="rgba(255,255,255,0.35)"
                                        thumbTintColor={colors.primary}
                                    />

                                    <Text style={styles.timeText}>
                                        {sliderMaxMillis > 1 ? formatTime(sliderMaxMillis) : '00:00'}
                                    </Text>

                                    <TouchableOpacity
                                        style={styles.roundIconButton}
                                        onPress={cycleQuickDisplayMode}
                                        onLongPress={() => {
                                            setZoomPanelVisible((prev) => !prev);
                                            setMorePanelVisible(false);
                                            setAudioPanelVisible(false);
                                            setAdvancedPanelVisible(false);
                                            setVolumePanelVisible(false);
                                        }}
                                    >
                                        <Ionicons name="resize-outline" size={20} color={colors.white} />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.roundIconButton}
                                        onPress={() => {
                                            setMorePanelVisible((prev) => !prev);
                                            setAudioPanelVisible(false);
                                            setAdvancedPanelVisible(false);
                                            setZoomPanelVisible(false);
                                            setVolumePanelVisible(false);
                                        }}
                                    >
                                        <Ionicons name="ellipsis-horizontal" size={22} color={colors.white} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {zoomPanelVisible && (
                                <Animated.View
                                    style={[
                                        styles.bottomPanel,
                                        styles.rightPanel,
                                        {
                                            opacity: zoomPanelAnim,
                                            transform: [
                                                {
                                                    translateX: zoomPanelAnim.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [PANEL_TRANSLATE, 0],
                                                    }),
                                                },
                                            ],
                                        },
                                    ]}
                                >
                                    <Text style={styles.panelTitle}>Zoom Options</Text>
                                    {DISPLAY_MODES.map((mode) => (
                                        <TouchableOpacity
                                            key={mode.id}
                                            style={styles.panelItem}
                                            onPress={() => {
                                                handleSetDisplayMode(mode);
                                                setZoomPanelVisible(false);
                                                flashSeekFeedback(mode.label);
                                                resetControlsTimer();
                                            }}
                                        >
                                            <Ionicons name="resize-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>
                                                {mode.label}
                                                {selectedDisplayMode.id === mode.id ? '  *' : ''}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                    <Text style={styles.panelMetaText}>Tip: Long press zoom icon for this full list.</Text>
                                </Animated.View>
                            )}

                            {volumePanelVisible && (
                                <Animated.View
                                    style={[
                                        styles.bottomPanel,
                                        styles.leftPanel,
                                        {
                                            opacity: volumePanelAnim,
                                            transform: [
                                                {
                                                    translateY: volumePanelAnim.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [PANEL_TRANSLATE, 0],
                                                    }),
                                                },
                                            ],
                                        },
                                    ]}
                                >
                                    <Text style={styles.panelTitle}>Video Volume</Text>
                                    <View style={styles.volumePanelRow}>
                                        <Slider
                                            style={styles.volumePanelSlider}
                                            minimumValue={0}
                                            maximumValue={maxVolumeLevel}
                                            value={playerVolume}
                                            onValueChange={(value) => {
                                                const next = clamp(value, 0, maxVolumeLevel);
                                                setPlayerVolume(next);
                                                volumeRef.current = next;
                                                showGestureHud('volume', next);
                                            }}
                                            onSlidingComplete={(value) => {
                                                const next = setVolumeLevel(value);
                                                showGestureHud('volume', next);
                                                hideGestureHudSoon();
                                            }}
                                            minimumTrackTintColor={colors.primary}
                                            maximumTrackTintColor="rgba(255,255,255,0.35)"
                                            thumbTintColor={colors.primary}
                                        />
                                    </View>
                                    <Text style={styles.panelItemText}>Level: {Math.round(playerVolume * 100)}%</Text>
                                </Animated.View>
                            )}

                            {audioPanelVisible && (
                                <Animated.View
                                    style={[
                                        styles.audioSubtitleSheet,
                                        {
                                            opacity: audioPanelAnim,
                                            transform: [
                                                {
                                                    translateY: audioPanelAnim.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [PANEL_TRANSLATE, 0],
                                                    }),
                                                },
                                            ],
                                        },
                                    ]}
                                >
                                    <View style={styles.sheetHandle} />
                                    <ScrollView style={styles.audioSubtitleScroll} showsVerticalScrollIndicator={false}>
                                        <TouchableOpacity
                                            style={styles.sectionHeader}
                                            onPress={() => setAudioSectionExpanded((prev) => !prev)}
                                        >
                                            <Text style={styles.sectionTitle}>Audio</Text>
                                            <Ionicons
                                                name={audioSectionExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                                                size={18}
                                                color={colors.white}
                                            />
                                        </TouchableOpacity>
                                        {audioSectionExpanded && (
                                            <View style={styles.sectionBody}>
                                                <TouchableOpacity style={styles.trackRow} onPress={() => void handleDisableAudioTrack()}>
                                                    <Ionicons
                                                        name={isAudioTrackDisabled ? 'checkmark' : 'ellipse-outline'}
                                                        size={18}
                                                        color={colors.white}
                                                    />
                                                    <Text style={styles.trackText}>Disable track</Text>
                                                </TouchableOpacity>
                                                {audioOptions.map((audioLabel, index) => (
                                                    <TouchableOpacity
                                                        key={`${audioLabel}-${index}`}
                                                        style={styles.trackRow}
                                                        onPress={() => void handleSelectAudioTrack(audioLabel, index)}
                                                    >
                                                        <Ionicons
                                                            name={!isAudioTrackDisabled && selectedAudioTrack === audioLabel ? 'checkmark' : 'ellipse-outline'}
                                                            size={18}
                                                            color={colors.white}
                                                        />
                                                        <Text style={styles.trackText}>{audioLabel}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                                {audioOptions.length <= 1 && (
                                                    <Text style={styles.panelMetaText}>
                                                        No embedded audio tracks detected by this decoder.
                                                    </Text>
                                                )}
                                            </View>
                                        )}

                                        <TouchableOpacity
                                            style={[styles.sectionHeader, styles.sectionHeaderDivider]}
                                            onPress={() => setSubtitleSectionExpanded((prev) => !prev)}
                                        >
                                            <Text style={styles.sectionTitle}>Subtitles</Text>
                                            <Ionicons
                                                name={subtitleSectionExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                                                size={18}
                                                color={colors.white}
                                            />
                                        </TouchableOpacity>
                                        {subtitleSectionExpanded && (
                                            <View style={styles.sectionBody}>
                                                <TouchableOpacity
                                                    style={styles.trackRow}
                                                    onPress={() => void handleSelectSubtitle({ id: 'off', label: 'Subtitles Off' })}
                                                >
                                                    <Ionicons
                                                        name={selectedSubtitleId === 'off' ? 'checkmark' : 'ellipse-outline'}
                                                        size={18}
                                                        color={colors.white}
                                                    />
                                                    <Text style={styles.trackText}>Disable subtitles</Text>
                                                </TouchableOpacity>

                                                {subtitleOptions
                                                    .filter((option) => option.id !== 'off')
                                                    .map((option) => (
                                                        <TouchableOpacity
                                                            key={option.id}
                                                            style={styles.trackRow}
                                                            onPress={() => void handleSelectSubtitle(option)}
                                                        >
                                                            <Ionicons
                                                                name={selectedSubtitleId === option.id ? 'checkmark' : 'ellipse-outline'}
                                                                size={18}
                                                                color={colors.white}
                                                            />
                                                            <Text style={styles.trackText}>{option.label}</Text>
                                                        </TouchableOpacity>
                                                    ))}

                                                <View style={styles.subtitleActionRow}>
                                                    <TouchableOpacity
                                                        style={styles.subtitleActionButton}
                                                        onPress={() => handleAdjustSubtitleDelay(-100)}
                                                    >
                                                        <Ionicons name="remove-outline" size={18} color={colors.white} />
                                                        <Text style={styles.subtitleActionText}>Delay</Text>
                                                    </TouchableOpacity>
                                                    <Text style={styles.subtitleDelayValue}>{subtitleSyncMs}ms</Text>
                                                    <TouchableOpacity
                                                        style={styles.subtitleActionButton}
                                                        onPress={() => handleAdjustSubtitleDelay(100)}
                                                    >
                                                        <Ionicons name="add-outline" size={18} color={colors.white} />
                                                        <Text style={styles.subtitleActionText}>Delay</Text>
                                                    </TouchableOpacity>
                                                </View>

                                                <TouchableOpacity style={styles.trackRow} onPress={() => void handleImportSubtitleFromFolder()}>
                                                    <Ionicons name="folder-open-outline" size={18} color={colors.white} />
                                                    <Text style={styles.trackText}>Select subtitle file</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.trackRow} onPress={() => void handleDownloadSubtitlesOnline()}>
                                                    <Ionicons name="cloud-download-outline" size={18} color={colors.white} />
                                                    <Text style={styles.trackText}>Download subtitles</Text>
                                                </TouchableOpacity>
                                                {detectedSubtitleTrackCount === 0 && localSubtitleOptions.length === 0 && (
                                                    <Text style={styles.panelMetaText}>
                                                        No embedded subtitle tracks detected. Try external subtitle file.
                                                    </Text>
                                                )}
                                            </View>
                                        )}
                                    </ScrollView>
                                </Animated.View>
                            )}

                            {morePanelVisible && (
                                <Animated.View
                                    style={[
                                        styles.bottomPanel,
                                        styles.rightPanel,
                                        {
                                            width: advancedPanelWidth,
                                            maxHeight: advancedPanelMaxHeight,
                                        },
                                        {
                                            opacity: morePanelAnim,
                                            transform: [
                                                {
                                                    translateX: morePanelAnim.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [PANEL_TRANSLATE, 0],
                                                    }),
                                                },
                                            ],
                                        },
                                    ]}
                                >
                                    <ScrollView
                                        style={styles.morePanelScroll}
                                        contentContainerStyle={styles.morePanelScrollContent}
                                        showsVerticalScrollIndicator={false}
                                    >
                                        <Text style={styles.panelTitle}>Advanced Controls</Text>
                                        <View style={styles.adjustRow}>
                                            <Ionicons name="volume-high-outline" size={18} color={colors.white} />
                                            <Slider
                                                style={styles.adjustSlider}
                                                minimumValue={0}
                                                maximumValue={maxVolumeLevel}
                                                value={playerVolume}
                                                onValueChange={(value) => {
                                                    const next = clamp(value, 0, maxVolumeLevel);
                                                    setPlayerVolume(next);
                                                    volumeRef.current = next;
                                                    showGestureHud('volume', next);
                                                }}
                                                onSlidingComplete={(value) => {
                                                    const next = setVolumeLevel(value);
                                                    showGestureHud('volume', next);
                                                    hideGestureHudSoon();
                                                }}
                                                minimumTrackTintColor={colors.primary}
                                                maximumTrackTintColor="rgba(255,255,255,0.35)"
                                                thumbTintColor={colors.primary}
                                            />
                                            <Text style={styles.adjustValue}>{Math.round(playerVolume * 100)}</Text>
                                        </View>
                                        <View style={styles.adjustRow}>
                                            <Ionicons name="sunny-outline" size={18} color={colors.white} />
                                            <Slider
                                                style={styles.adjustSlider}
                                                minimumValue={0.1}
                                                maximumValue={1}
                                                value={screenBrightness}
                                                onValueChange={(value) => {
                                                    const next = setBrightnessLevel(value);
                                                    showGestureHud('brightness', next);
                                                    hideGestureHudSoon();
                                                }}
                                                minimumTrackTintColor={colors.primary}
                                                maximumTrackTintColor="rgba(255,255,255,0.35)"
                                                thumbTintColor={colors.primary}
                                            />
                                            <Text style={styles.adjustValue}>{Math.round(screenBrightness * 100)}</Text>
                                        </View>
                                        <TouchableOpacity style={styles.panelItem} onPress={() => {
                                            setIsTouchLocked(true);
                                            setMorePanelVisible(false);
                                            hideOverlayControls();
                                            flashSeekFeedback("Controls Locked");
                                        }}>
                                            <Ionicons name="lock-closed-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Lock controls (Touch Lock)</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.panelItem} onPress={() => void toggleOrientationLock()}>
                                            <Ionicons
                                                name={isOrientationLocked ? 'lock-closed-outline' : 'lock-open-outline'}
                                                size={18}
                                                color={colors.white}
                                            />
                                            <Text style={styles.panelItemText}>Lock: {isOrientationLocked ? 'On' : 'Off'}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.panelItem} onPress={cycleSleepTimer}>
                                            <Ionicons name="timer-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Sleep timer: {sleepMinutes ? `${sleepMinutes}m` : 'Off'}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.panelItem} onPress={openQuickAdvancedPanel}>
                                            <Ionicons name="speedometer-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Playback speed: {playbackSpeed.toFixed(2)}x</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.panelItem} onPress={openJumpToTimePanel}>
                                            <Ionicons name="return-up-forward-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Jump to time</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.panelItem} onPress={cycleEqualizerMode}>
                                            <Ionicons name="options-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Equalizer: {equalizerMode}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.panelItem} onPress={toggleAudioOnlyMode}>
                                            <Ionicons name="musical-note-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Play as audio: {audioOnlyMode ? 'On' : 'Off'}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.panelItem} onPress={() => void togglePopUpMode()}>
                                            <Ionicons name="tv-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Pop-up player: {popUpMode ? 'On' : 'Off'}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.panelItem} onPress={cycleRepeatMode}>
                                            <Ionicons name="repeat-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Repeat mode: {repeatMode}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.panelItem} onPress={() => setShowVideoInfo((prev) => !prev)}>
                                            <Ionicons name="information-circle-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Video Information</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.panelItem} onPress={addBookmark}>
                                            <Ionicons name="bookmark-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Bookmarks ({bookmarks.length})</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.panelItem} onPress={cycleAbRepeat}>
                                            <Ionicons name="repeat-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>
                                                A-B repeat: {abRepeatStartMs === null ? 'Off' : abRepeatEndMs === null ? 'Set B' : 'On'}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.panelItem} onPress={() => { setShowPlaylist((prev) => !prev); closeAllPanels(); }}>
                                            <Ionicons name="list-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Playlists</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.panelItem} onPress={() => void saveCurrentPlaylist()}>
                                            <Ionicons name="save-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Save playlist snapshot</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.panelItem}
                                            onPress={() => {
                                                setControlSettingsVisible(true);
                                                setMorePanelVisible(false);
                                            }}
                                        >
                                            <Ionicons name="settings-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Control settings</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.panelItem}
                                            onPress={() => {
                                                setVideoTipsVisible(true);
                                                setMorePanelVisible(false);
                                            }}
                                        >
                                            <Ionicons name="sparkles-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Video player tips</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.panelItem}
                                            onPress={() => {
                                                setZoomPanelVisible(true);
                                                setMorePanelVisible(false);
                                                setAudioPanelVisible(false);
                                                setAdvancedPanelVisible(false);
                                                setVolumePanelVisible(false);
                                            }}
                                        >
                                            <Ionicons name="options-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>More Zoom Options</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.panelItem} onPress={() => void rotateScreenManually()}>
                                            <Ionicons name="phone-portrait-outline" size={18} color={colors.white} />
                                            <Text style={styles.panelItemText}>Rotate Screen</Text>
                                        </TouchableOpacity>
                                    </ScrollView>
                                </Animated.View>
                            )}

                            {advancedPanelVisible && (
                                <Animated.View
                                    style={[
                                        styles.advancedFloatingPanel,
                                        isLandscape && styles.advancedFloatingPanelLandscape,
                                        {
                                            opacity: advancedPanelAnim,
                                            transform: [
                                                {
                                                    translateY: advancedPanelAnim.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [PANEL_TRANSLATE, 0],
                                                    }),
                                                },
                                            ],
                                        },
                                    ]}
                                >
                                    <Text style={styles.panelTitle}>Quick Advanced Menu</Text>
                                    <View style={styles.advancedActionRow}>
                                        <TouchableOpacity style={styles.advancedChip} onPress={() => openAudioSubtitlePanel('audio')}>
                                            <Ionicons name="musical-notes-outline" size={16} color={colors.white} />
                                            <Text style={styles.advancedChipText}>Audio</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.advancedChip} onPress={() => openAudioSubtitlePanel('subtitle')}>
                                            <Ionicons name="text-outline" size={16} color={colors.white} />
                                            <Text style={styles.advancedChipText}>Subtitles</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.advancedChip}
                                            onPress={cycleQuickDisplayMode}
                                            onLongPress={() => {
                                                setZoomPanelVisible(true);
                                                setAdvancedPanelVisible(false);
                                            }}
                                        >
                                            <Ionicons name="scan-outline" size={16} color={colors.white} />
                                            <Text style={styles.advancedChipText}>Zoom</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.advancedChip} onPress={openAdvancedControlsPanel}>
                                            <Ionicons name="speedometer-outline" size={16} color={colors.white} />
                                            <Text style={styles.advancedChipText}>Speed</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.speedRow}>
                                        {[0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                                            <TouchableOpacity
                                                key={speed}
                                                style={[
                                                    styles.speedChip,
                                                    playbackSpeed === speed && styles.speedChipActive,
                                                ]}
                                                onPress={() => handleChangeSpeed(speed)}
                                            >
                                                <Text style={styles.speedChipText}>{speed}x</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <Text style={styles.panelMetaText}>
                                        Mode: {selectedDisplayMode.label} | Audio: {selectedAudioTrack} | Subs: {selectedSubtitle}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.closeAdvancedButton}
                                        onPress={() => setAdvancedPanelVisible(false)}
                                    >
                                        <Text style={styles.closeAdvancedText}>Close</Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            )}

                            {showVideoInfo && status.isLoaded && (
                                <View style={styles.infoPanel}>
                                    <View style={styles.playlistHeaderRow}>
                                        <Text style={styles.panelTitle}>Video Information</Text>
                                        <TouchableOpacity onPress={() => setShowVideoInfo(false)}>
                                            <Ionicons name="close" size={24} color={colors.white} />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.panelItemText}>Resolution: {(player as any)?.videoWidth || 'Unknown'}x{(player as any)?.videoHeight || 'Unknown'}</Text>
                                    {videoSizeFormatted && (
                                        <Text style={styles.panelItemText}>Size: {videoSizeFormatted}</Text>
                                    )}
                                    <Text style={styles.panelItemText}>Duration: {formatTime(status.durationMillis ?? 0)}</Text>
                                    <Text style={styles.panelItemText}>Position: {formatTime(status.positionMillis)}</Text>
                                    <Text style={styles.panelItemText}>Speed: {playbackSpeed.toFixed(2)}x</Text>
                                    <Text style={styles.panelItemText}>Display: {selectedDisplayMode.label}</Text>
                                </View>
                            )}

                            {showPlaylist && (
                                <View style={styles.playlistPanel}>
                                    <View style={styles.playlistHeaderRow}>
                                        <Text style={styles.panelTitle}>Saved Playlists</Text>
                                        <TouchableOpacity onPress={() => setShowPlaylist(false)}>
                                            <Ionicons name="close" size={24} color={colors.white} />
                                        </TouchableOpacity>
                                    </View>

                                    {savedPlaylists.length === 0 ? (
                                        <Text style={styles.panelMetaText}>No playlists saved yet.</Text>
                                    ) : (
                                        savedPlaylists.map((playlist, index) => (
                                            <TouchableOpacity
                                                key={playlist.id}
                                                style={styles.panelItem}
                                                onPress={() => {
                                                    // Placeholder for actually loading the playlist items into a player queue.
                                                    flashSeekFeedback(`Loaded ${playlist.name}`);
                                                    setShowPlaylist(false);
                                                }}
                                            >
                                                <Ionicons name="albums-outline" size={18} color={colors.primary} />
                                                <Text style={styles.panelItemText}>
                                                    {playlist.name} ({playlist.items.length} items)
                                                </Text>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                    {bookmarks.length > 0 && (
                                        <>
                                            <Text style={[styles.panelTitle, { marginTop: SPACING.s }]}>Bookmarks</Text>
                                            {bookmarks.map((sec) => (
                                                <TouchableOpacity key={sec} style={styles.panelItem} onPress={() => void jumpToBookmark(sec)}>
                                                    <Ionicons name="bookmark" size={16} color={colors.primary} />
                                                    <Text style={styles.panelItemText}>{formatTime(sec * 1000)}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </>
                                    )}
                                </View>
                            )}

                            <EqualizerPanel
                                visible={equalizerPanelVisible}
                                supported={equalizerSupported}
                                settings={equalizerSettings}
                                onClose={() => setEqualizerPanelVisible(false)}
                                onToggleEnabled={(enabled) =>
                                    updateEqualizerSettings({
                                        ...equalizerSettings,
                                        enabled,
                                    })
                                }
                                onSelectPreset={handleSelectEqualizerPreset}
                                onSetPreamp={(value) =>
                                    updateEqualizerSettings({
                                        ...equalizerSettings,
                                        presetId: 'custom',
                                        preampDb: value,
                                    })
                                }
                                onSetBand={handleSetEqualizerBand}
                                onToggleSnap={(snapBands) =>
                                    updateEqualizerSettings({
                                        ...equalizerSettings,
                                        snapBands,
                                    })
                                }
                                onSelectCustomProfile={handleSelectEqualizerCustomProfile}
                                onReset={() => {
                                    const next = {
                                        ...DEFAULT_EQUALIZER_SETTINGS,
                                        customProfiles: equalizerSettings.customProfiles,
                                    };
                                    updateEqualizerSettings(next);
                                    void equalizerService.reset();
                                }}
                                onSave={handleSaveEqualizerProfile}
                                onDelete={handleDeleteEqualizerProfile}
                            />

                            <ControlSettingsPanel
                                visible={controlSettingsVisible}
                                settings={playerSettings}
                                onClose={() => setControlSettingsVisible(false)}
                                onChange={updatePlayerSettings}
                                onOpenScreenshotInfo={() =>
                                    Alert.alert('Screenshot', 'Screenshot capture backend will be enabled in a future update.')
                                }
                            />

                            <VideoTipsModal visible={videoTipsVisible} onClose={() => setVideoTipsVisible(false)} />

                            <Modal visible={jumpToTimeVisible} transparent animationType="fade" onRequestClose={() => setJumpToTimeVisible(false)}>
                                <Pressable style={styles.modalBackdrop} onPress={() => setJumpToTimeVisible(false)}>
                                    <Pressable style={styles.jumpModalCard} onPress={(event) => event.stopPropagation()}>
                                        <Text style={styles.jumpModalTitle}>Jump to time</Text>
                                        <Text style={styles.jumpModalSubTitle}>Format: mm:ss or hh:mm:ss</Text>
                                        <TextInput
                                            value={jumpInput}
                                            onChangeText={(text) => {
                                                setJumpInput(text);
                                                const parsed = parseTimeInputToMs(text);
                                                setJumpTargetMs(clamp(parsed, 0, status.durationMillis || 0));
                                            }}
                                            placeholder="00:10:00"
                                            placeholderTextColor="rgba(255,255,255,0.35)"
                                            style={styles.jumpInput}
                                        />
                                        <Slider
                                            minimumValue={0}
                                            maximumValue={status.durationMillis || 1}
                                            value={jumpTargetMs}
                                            onValueChange={(value) => {
                                                setJumpTargetMs(value);
                                                setJumpInput(formatTime(value));
                                            }}
                                            minimumTrackTintColor={colors.primary}
                                            maximumTrackTintColor="rgba(255,255,255,0.35)"
                                            thumbTintColor={colors.primary}
                                        />
                                        <Text style={styles.jumpTargetText}>Target: {formatTime(jumpTargetMs)}</Text>
                                        <View style={styles.jumpModalActions}>
                                            <TouchableOpacity
                                                style={styles.jumpSecondaryButton}
                                                onPress={() => setJumpToTimeVisible(false)}
                                            >
                                                <Text style={styles.jumpSecondaryText}>Cancel</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.jumpPrimaryButton}
                                                onPress={() => applyJumpToTime(jumpTargetMs)}
                                            >
                                                <Text style={styles.jumpPrimaryText}>Jump</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </Pressable>
                                </Pressable>
                            </Modal>
                        </>
                    )}
                </Animated.View>
            </Pressable>

        </View>
    );
};

const useStyles = (colors: any) => StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.black,
    },
    videoContainer: {
        flex: 1,
        backgroundColor: colors.black,
    },
    videoStage: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoStagePopUp: {
        width: POPUP_WIDTH,
        height: POPUP_HEIGHT,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: '#000',
        zIndex: 25,
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    videoStageAudioOnly: {
        backgroundColor: '#000',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    centerVideo: {
        width: '88%',
        height: '88%',
        alignSelf: 'center',
    },
    lockedOverlayContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 48,
    },
    unlockButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.60)',
        paddingHorizontal: SPACING.l,
        paddingVertical: 12,
        borderRadius: RADIUS.full,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    unlockText: {
        color: colors.white,
        marginLeft: SPACING.s,
        fontSize: FONT_SIZE.m,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: LETTER_SPACING.wide,
    },
    // ── HUD badges ──────────────────────────────────────────────────
    seekFeedbackBadge: {
        position: 'absolute',
        top: '45%',
        alignSelf: 'center',
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        borderRadius: RADIUS.full,
        backgroundColor: 'rgba(0,0,0,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    seekFeedbackText: {
        color: colors.white,
        fontSize: FONT_SIZE.l,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: LETTER_SPACING.wide,
    },
    abRepeatBadge: {
        position: 'absolute',
        top: 96,
        alignSelf: 'center',
        borderRadius: RADIUS.full,
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        backgroundColor: 'rgba(0,0,0,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    abRepeatText: {
        color: colors.white,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: LETTER_SPACING.wide,
    },
    audioOnlyCard: {
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RADIUS.l,
        paddingHorizontal: SPACING.l,
        paddingVertical: SPACING.m,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        maxWidth: 320,
    },
    audioOnlyTitle: {
        color: colors.white,
        fontSize: FONT_SIZE.l,
        fontWeight: FONT_WEIGHT.heavy,
        marginTop: SPACING.xs,
        letterSpacing: LETTER_SPACING.tight,
    },
    audioOnlyMeta: {
        marginTop: 4,
        color: 'rgba(255,255,255,0.6)',
        fontSize: FONT_SIZE.s,
        textAlign: 'center',
    },
    // ── Modals ──────────────────────────────────────────────────────
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.72)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.m,
    },
    jumpModalCard: {
        width: '100%',
        maxWidth: 420,
        borderRadius: RADIUS.l,
        padding: SPACING.m,
        backgroundColor: 'rgba(10,10,10,0.95)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
    },
    jumpModalTitle: {
        color: colors.white,
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: LETTER_SPACING.tight,
    },
    jumpModalSubTitle: {
        marginTop: 3,
        color: 'rgba(255,255,255,0.6)',
        fontSize: FONT_SIZE.s,
    },
    jumpInput: {
        marginTop: SPACING.s,
        borderRadius: RADIUS.s,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.08)',
        color: colors.white,
        paddingHorizontal: SPACING.s,
        paddingVertical: 12,
        fontSize: FONT_SIZE.m,
        fontWeight: FONT_WEIGHT.medium,
        letterSpacing: LETTER_SPACING.wider,
    },
    jumpTargetText: {
        marginTop: SPACING.s,
        color: colors.primary,
        fontSize: FONT_SIZE.m,
        fontWeight: FONT_WEIGHT.bold,
        textAlign: 'center',
        letterSpacing: LETTER_SPACING.wide,
    },
    jumpModalActions: {
        marginTop: SPACING.m,
        flexDirection: 'row',
        gap: SPACING.s,
    },
    jumpSecondaryButton: {
        flex: 1,
        borderRadius: RADIUS.m,
        paddingVertical: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    jumpSecondaryText: {
        color: colors.white,
        fontWeight: FONT_WEIGHT.semiBold,
    },
    jumpPrimaryButton: {
        flex: 1,
        borderRadius: RADIUS.m,
        paddingVertical: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    jumpPrimaryText: {
        color: colors.white,
        fontWeight: FONT_WEIGHT.bold,
    },
    // ── Gesture HUD ─────────────────────────────────────────────────
    gestureHud: {
        position: 'absolute',
        top: '38%',
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        borderRadius: RADIUS.full,
        backgroundColor: 'rgba(0,0,0,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    gestureHudText: {
        color: colors.white,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.bold,
    },
    // ── Subtitles ────────────────────────────────────────────────────
    subtitleOverlay: {
        position: 'absolute',
        left: SPACING.m,
        right: SPACING.m,
        bottom: '19%',
        alignItems: 'center',
        zIndex: 3,
    },
    subtitleText: {
        color: colors.white,
        backgroundColor: 'rgba(0,0,0,0.72)',
        paddingHorizontal: SPACING.m,
        paddingVertical: 7,
        borderRadius: RADIUS.s,
        fontSize: FONT_SIZE.m,
        fontWeight: FONT_WEIGHT.semiBold,
        textAlign: 'center',
        lineHeight: 22,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    // ── Controls overlay ────────────────────────────────────────────
    controlsOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        paddingTop: SPACING.s,
        paddingBottom: SPACING.l,
        backgroundColor: 'rgba(0,0,0,0.60)',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: SPACING.s,
        paddingHorizontal: SPACING.s,
    },
    topIconButton: {
        width: 40,
        height: 40,
        borderRadius: RADIUS.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.60)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    activeTopIconButton: {
        backgroundColor: colors.primarySubtle,
        borderColor: colors.primaryGlow,
    },
    titleText: {
        color: colors.white,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.semiBold,
        flex: 1,
        textAlign: 'center',
        marginHorizontal: SPACING.s,
        letterSpacing: LETTER_SPACING.tight,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    topRightActions: {
        flexDirection: 'row',
        gap: SPACING.xs,
    },
    aiBadgeContainer: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiBadgeContainerActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primaryGlow,
    },
    aiBadgeText: {
        color: colors.white,
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    aiBadgeTextActive: {
        color: colors.primary,
    },
    // ── Center controls ─────────────────────────────────────────────
    bottomCluster: {
        alignItems: 'center',
        gap: SPACING.m,
    },
    bottomClusterLandscape: {
        gap: SPACING.s,
    },
    seekButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
    },
    seekActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: SPACING.m,
        paddingVertical: 9,
        borderRadius: RADIUS.full,
        backgroundColor: 'rgba(0,0,0,0.60)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    seekActionText: {
        color: colors.white,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.bold,
    },
    playPauseButton: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playPauseIcon: {
        textAlign: 'center',
    },
    // ── Seek row (progress bar) ─────────────────────────────────────
    seekRow: {
        width: '100%',
        minHeight: 52,
        borderRadius: RADIUS.m,
        paddingHorizontal: SPACING.s,
        backgroundColor: 'rgba(0,0,0,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        flexDirection: 'row',
        alignItems: 'center',
    },
    roundIconButton: {
        width: 34,
        height: 34,
        borderRadius: RADIUS.full,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 2,
    },
    timeText: {
        color: colors.white,
        fontSize: 12,
        width: 46,
        textAlign: 'center',
        fontVariant: ['tabular-nums'],
        fontWeight: FONT_WEIGHT.medium,
    },
    slider: {
        flex: 1,
        marginHorizontal: 6,
        height: 36,
    },
    // ── Side panels (volume/more) ───────────────────────────────────
    bottomPanel: {
        position: 'absolute',
        bottom: 108,
        width: 252,
        borderRadius: RADIUS.l,
        padding: SPACING.m,
        backgroundColor: 'rgba(10,10,10,0.95)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        elevation: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.55,
        shadowRadius: 16,
    },
    leftPanel: {
        left: SPACING.m,
    },
    rightPanel: {
        right: SPACING.m,
    },
    morePanelScroll: {
        flex: 1,
    },
    morePanelScrollContent: {
        paddingBottom: SPACING.xs,
    },
    panelTitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: FONT_SIZE.xxs,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: LETTER_SPACING.wider,
        textTransform: 'uppercase',
        marginBottom: SPACING.s,
    },
    playlistPanel: {
        position: 'absolute',
        bottom: 80,
        right: SPACING.m,
        width: 320,
        maxHeight: '60%',
        borderRadius: RADIUS.l,
        padding: SPACING.m,
        backgroundColor: 'rgba(10,10,10,0.95)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        elevation: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.55,
        shadowRadius: 16,
    },
    playlistHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.s,
    },
    panelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    panelItemText: {
        color: colors.white,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.medium,
    },
    disabledPanelItem: {
        opacity: 0.45,
    },
    disabledPanelItemText: {
        color: 'rgba(255,255,255,0.6)',
    },
    // ── Audio/subtitle sheet ────────────────────────────────────────
    audioSubtitleSheet: {
        position: 'absolute',
        left: SPACING.m,
        right: SPACING.m,
        bottom: 100,
        maxHeight: '60%',
        borderRadius: RADIUS.l,
        paddingTop: SPACING.s,
        paddingBottom: SPACING.s,
        backgroundColor: 'rgba(10,10,10,0.95)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        elevation: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
    },
    sheetHandle: {
        alignSelf: 'center',
        width: 38,
        height: 4,
        borderRadius: RADIUS.full,
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginBottom: SPACING.s,
    },
    audioSubtitleScroll: {
        paddingHorizontal: SPACING.m,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.s,
    },
    sectionHeaderDivider: {
        marginTop: SPACING.s,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    sectionTitle: {
        color: colors.white,
        fontSize: FONT_SIZE.l,
        fontWeight: FONT_WEIGHT.heavy,
        letterSpacing: LETTER_SPACING.tight,
    },
    sectionBody: {
        paddingBottom: SPACING.s,
        gap: 2,
    },
    trackRow: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
        paddingVertical: 8,
        borderRadius: RADIUS.s,
    },
    trackText: {
        color: colors.white,
        fontSize: FONT_SIZE.m,
        flexShrink: 1,
        fontWeight: FONT_WEIGHT.medium,
    },
    subtitleActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginVertical: SPACING.s,
    },
    subtitleActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: SPACING.s,
        paddingVertical: 7,
        borderRadius: RADIUS.s,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    subtitleActionText: {
        color: colors.white,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.semiBold,
    },
    subtitleDelayValue: {
        color: colors.primary,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.bold,
    },
    adjustRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
        marginBottom: SPACING.s,
    },
    adjustSlider: {
        flex: 1,
        height: 24,
    },
    adjustValue: {
        color: colors.white,
        fontSize: FONT_SIZE.s,
        width: 36,
        textAlign: 'right',
        fontVariant: ['tabular-nums'],
        fontWeight: FONT_WEIGHT.medium,
    },
    volumePanelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.s,
        marginBottom: SPACING.s,
    },
    volumePanelSlider: {
        flex: 1,
        height: 28,
    },
    // ── Advanced panel ──────────────────────────────────────────────
    advancedFloatingPanel: {
        position: 'absolute',
        top: '30%',
        alignSelf: 'center',
        width: '88%',
        borderRadius: RADIUS.l,
        padding: SPACING.m,
        backgroundColor: 'rgba(10,10,10,0.95)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 18,
    },
    advancedFloatingPanelLandscape: {
        width: '72%',
        top: '20%',
    },
    advancedActionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
        marginVertical: SPACING.s,
    },
    advancedChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: RADIUS.full,
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    advancedChipText: {
        color: colors.white,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.medium,
    },
    floatingMiniControls: {
        position: 'absolute',
        right: SPACING.xs,
        bottom: SPACING.xs,
        flexDirection: 'row',
        gap: 6,
    },
    floatingMiniButton: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    speedRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.s,
    },
    speedChip: {
        paddingHorizontal: SPACING.s,
        paddingVertical: 7,
        borderRadius: RADIUS.m,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    speedChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    speedChipText: {
        color: colors.white,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.semiBold,
    },
    panelMetaText: {
        color: 'rgba(255,255,255,0.6)',
        marginTop: SPACING.s,
        fontSize: FONT_SIZE.xs,
        lineHeight: 18,
    },
    closeAdvancedButton: {
        marginTop: SPACING.s,
        alignSelf: 'flex-end',
        paddingHorizontal: SPACING.m,
        paddingVertical: 6,
        borderRadius: RADIUS.full,
        backgroundColor: colors.primarySubtle,
    },
    closeAdvancedText: {
        color: colors.primary,
        fontSize: FONT_SIZE.s,
        fontWeight: FONT_WEIGHT.bold,
    },
    // ── AI & info panels ────────────────────────────────────────────
    aiPanel: {
        position: 'absolute',
        left: SPACING.m,
        right: SPACING.xl * 3,
        top: SPACING.xl * 2,
        borderRadius: RADIUS.s,
        paddingHorizontal: SPACING.s,
        paddingVertical: 8,
        backgroundColor: 'rgba(0,0,0,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    aiPanelTitle: {
        color: colors.primary,
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: LETTER_SPACING.wide,
        marginBottom: 2,
    },
    aiPanelText: {
        color: colors.white,
        fontSize: FONT_SIZE.xs,
        lineHeight: 16,
    },
    infoPanel: {
        position: 'absolute',
        top: SPACING.xl * 2,
        right: SPACING.m,
        width: 228,
        borderRadius: RADIUS.m,
        padding: SPACING.m,
        backgroundColor: 'rgba(10,10,10,0.95)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        elevation: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 14,
    },
});

export default PlayerScreen;
