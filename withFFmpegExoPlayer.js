const {
    withAppBuildGradle,
    withProjectBuildGradle,
    withSettingsGradle,
    withAndroidManifest,
} = require('@expo/config-plugins');

/**
 * Injects an audio/* VIEW intent-filter into MainActivity,
 * identical in structure to the video/* filter that expo-video injects.
 * This survives every `expo prebuild` so manual AndroidManifest.xml edits are not needed.
 */
function addAudioIntentFilter(config) {
    return withAndroidManifest(config, (config) => {
        const manifest = config.modResults;
        const application = manifest.manifest.application?.[0];
        if (!application) return config;

        const mainActivity = application.activity?.find(
            (a) => a.$?.['android:name'] === '.MainActivity'
        );
        if (!mainActivity) return config;

        // Check if audio filter already exists to avoid duplicates
        const alreadyHasAudio = mainActivity['intent-filter']?.some((filter) =>
            filter.data?.some((d) => d.$?.['android:mimeType'] === 'audio/*')
        );
        if (alreadyHasAudio) return config;

        const audioFilter = {
            $: {},
            action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
            category: [
                { $: { 'android:name': 'android.intent.category.DEFAULT' } },
                { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
            ],
            data: [
                { $: { 'android:mimeType': 'audio/*' } },
                { $: { 'android:mimeType': 'audio/*', 'android:scheme': 'content' } },
                { $: { 'android:mimeType': 'audio/*', 'android:scheme': 'file' } },
                { $: { 'android:mimeType': 'audio/*', 'android:scheme': 'http' } },
                { $: { 'android:mimeType': 'audio/*', 'android:scheme': 'https' } },
            ],
        };

        mainActivity['intent-filter'] = [
            ...(mainActivity['intent-filter'] || []),
            audioFilter,
        ];

        return config;
    });
}

module.exports = function withFFmpegExoPlayer(config) {
    config = withAppBuildGradle(config, (config) => {
        const buildGradle = config.modResults.contents;

        // We use Anil Beesetti's NextLib Media3 extension because it reliably builds the Dolby EAC3 and AC3 FFmpeg codecs natively.
        // We also explicitly include Media3 dependencies so they are visible to the main app's Kotlin source.
        const media3Version = "1.3.1";
        const dependencyBlock = `    // Added by withFFmpegExoPlayer Config Plugin\n    implementation("androidx.media3:media3-exoplayer:${media3Version}")\n    implementation("androidx.media3:media3-ui:${media3Version}")\n    implementation("androidx.media3:media3-session:${media3Version}")\n    implementation("androidx.media3:media3-common:${media3Version}")\n    implementation("io.github.anilbeesetti:nextlib-media3ext:${media3Version}-0.9.0") { \n        exclude group: 'androidx.media3' // prevent version collisions with expo-video\n    }\n`;
        const hasInjectedMedia3Deps =
            buildGradle.includes(`implementation("androidx.media3:media3-exoplayer:${media3Version}")`) &&
            buildGradle.includes(`implementation("io.github.anilbeesetti:nextlib-media3ext:${media3Version}-0.9.0")`);

        let updatedContents = hasInjectedMedia3Deps
            ? buildGradle
            : buildGradle.replace(/dependencies\s*\{/, `dependencies {\n${dependencyBlock}`);

        // Apply the ABI filter to aggressively trim application size down to 50MB
        const defaultConfigMatch = /defaultConfig\s*\{/;
        const hasArm64OnlyFilter = /ndk\s*\{\s*abiFilters\s+"arm64-v8a"\s*\}/m.test(updatedContents);
        if (!hasArm64OnlyFilter && updatedContents.match(defaultConfigMatch)) {
            updatedContents = updatedContents.replace(
                defaultConfigMatch,
                `defaultConfig {\n        // Keep APK < 50MB by only compiling for arm64\n        ndk {\n            abiFilters "arm64-v8a"\n        }\n`
            );
        }

        config.modResults.contents = updatedContents;
        return config;
    });

    config = withProjectBuildGradle(config, (config) => {
        const projectBuildGradle = config.modResults.contents;
        if (projectBuildGradle.includes('expo-video-local')) {
            return config;
        }

        const substitutionBlock = `\nsubprojects {\n  configurations.configureEach {\n    resolutionStrategy.dependencySubstitution {\n      substitute module("host.exp.exponent:expo.modules.video") using project(":expo-video-local")\n    }\n  }\n}\n`;
        config.modResults.contents = projectBuildGradle.replace(
            /apply plugin: "expo-root-project"/,
            `${substitutionBlock}\napply plugin: "expo-root-project"`
        );
        return config;
    });

    config = withSettingsGradle(config, (config) => {
        const settingsGradle = config.modResults.contents;
        if (settingsGradle.includes(':expo-video-local')) {
            return config;
        }

        const localProjectBlock = `\n// Use local expo-video source so native codec patches in node_modules/expo-video are actually compiled.\ninclude ':expo-video-local'\nproject(':expo-video-local').projectDir = new File(rootDir, '../node_modules/expo-video/android')\n`;
        config.modResults.contents = `${settingsGradle.trimEnd()}\n${localProjectBlock}`;
        return config;
    });

    // Inject audio/* intent filter so the app appears in "Open with" for audio files.
    config = addAudioIntentFilter(config);

    return config;
};
