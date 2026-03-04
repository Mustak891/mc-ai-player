const {
    withAppBuildGradle,
    withProjectBuildGradle,
    withSettingsGradle,
} = require('@expo/config-plugins');

module.exports = function withFFmpegExoPlayer(config) {
    config = withAppBuildGradle(config, (config) => {
        const buildGradle = config.modResults.contents;

        // We use Anil Beesetti's NextLib Media3 extension because it reliably builds the Dolby EAC3 and AC3 FFmpeg codecs natively.
        let updatedContents = buildGradle.replace(
            /dependencies\s*\{/,
            `dependencies {\n    // Added by withFFmpegExoPlayer Config Plugin (NextLib FFmpeg Decoder for Dolby EAC3)\n    implementation("io.github.anilbeesetti:nextlib-media3ext:1.8.0-0.9.0") { \n        exclude group: 'androidx.media3' // prevent version collisions with expo-video\n    }\n`
        );

        // Apply the ABI filter to aggressively trim application size down to 50MB
        const defaultConfigMatch = /defaultConfig\s*\{/;
        if (updatedContents.match(defaultConfigMatch)) {
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

    return config;
};
