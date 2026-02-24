import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '../context/ThemeContext';

const PlaylistsScreen = () => {
    const { colors } = useThemeContext();
    const insets = useSafeAreaInsets();
    const styles = useStyles(colors, insets);

    return (
        <View style={styles.container}>
            <Text style={styles.text}>Playlists feature coming soon.</Text>
        </View>
    );
};

const useStyles = (colors: any, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
    },
    text: {
        color: colors.textSecondary,
    },
});

export default PlaylistsScreen;
