const { withAndroidStyles } = require('@expo/config-plugins');

module.exports = function withDisableForceDark(config) {
    return withAndroidStyles(config, async (config) => {
        config.modResults = { ...config.modResults };
        const styles = config.modResults.resources.style;
        const appTheme = styles.find((style) => style.$.name === 'AppTheme');
        
        if (appTheme) {
            const hasForceDark = appTheme.item.find((item) => item.$.name === 'android:forceDarkAllowed');
            if (!hasForceDark) {
                appTheme.item.push({
                    _: 'false',
                    $: { name: 'android:forceDarkAllowed', 'tools:targetApi': '29' },
                });
            } else {
                hasForceDark._ = 'false';
            }
        }
        return config;
    });
};
