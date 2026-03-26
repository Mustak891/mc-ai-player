module.exports = function (api) {
    api.cache(true);
    const isProd = process.env.NODE_ENV === 'production' || process.env.EAS_BUILD_PROFILE === 'production';
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            'react-native-reanimated/plugin',
            ...(isProd ? ['transform-remove-console'] : []),
        ],
    };
};
