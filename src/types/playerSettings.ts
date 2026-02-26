export type ResumeMode = 'always' | 'prompt_after_24h' | 'never';

export type PlayerControlSettings = {
    audioBoostEnabled: boolean;
    saveAudioDelayPerVideo: boolean;
    automaticResumePlayback: boolean;
    resumeMode: ResumeMode;
    floatingControlsDefaultVisible: boolean;
    floatingControlAutoHideMs: number;
    gestureVolumeEnabled: boolean;
    gestureBrightnessEnabled: boolean;
    swipeToSeekEnabled: boolean;
    doubleTapSeekEnabled: boolean;
    twoFingerZoomEnabled: boolean;
    fastPlayHoldEnabled: boolean;
    screenshotEnabled: boolean;
    seekButtonsVisible: boolean;
    controlsHideDelayMs: number;
    videoTransitionTitleEnabled: boolean;
    lockWithSensorEnabled: boolean;
    doubleTapCenterPlayPauseEnabled: boolean;
    seekStepSeconds: number;
    longPressSeekStepSeconds: number;
    fastPlaySpeed: number;
    globalSubtitleDelayMs: number;
};

export type EqualizerPresetId = 'flat' | 'bass_boost' | 'treble_boost' | 'vocal' | 'custom';

export type EqualizerProfile = {
    id: string;
    name: string;
    preampDb: number;
    bandsDb: number[];
};

export type EqualizerSettings = {
    enabled: boolean;
    presetId: EqualizerPresetId;
    preampDb: number;
    bandsDb: number[];
    snapBands: boolean;
    customProfiles: EqualizerProfile[];
    selectedCustomProfileId: string | null;
};

export const EQUALIZER_FREQUENCIES = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const DEFAULT_PLAYER_CONTROL_SETTINGS: PlayerControlSettings = {
    audioBoostEnabled: false,
    saveAudioDelayPerVideo: true,
    automaticResumePlayback: true,
    resumeMode: 'prompt_after_24h',
    floatingControlsDefaultVisible: true,
    floatingControlAutoHideMs: 3000,
    gestureVolumeEnabled: true,
    gestureBrightnessEnabled: true,
    swipeToSeekEnabled: true,
    doubleTapSeekEnabled: true,
    twoFingerZoomEnabled: true,
    fastPlayHoldEnabled: false,
    screenshotEnabled: false,
    seekButtonsVisible: false,
    controlsHideDelayMs: 3200,
    videoTransitionTitleEnabled: true,
    lockWithSensorEnabled: true,
    doubleTapCenterPlayPauseEnabled: false,
    seekStepSeconds: 10,
    longPressSeekStepSeconds: 20,
    fastPlaySpeed: 2,
    globalSubtitleDelayMs: 0,
};

export const DEFAULT_EQUALIZER_SETTINGS: EqualizerSettings = {
    enabled: false,
    presetId: 'flat',
    preampDb: 0,
    bandsDb: new Array(EQUALIZER_FREQUENCIES.length).fill(0),
    snapBands: true,
    customProfiles: [],
    selectedCustomProfileId: null,
};
