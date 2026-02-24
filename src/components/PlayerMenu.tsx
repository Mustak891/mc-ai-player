import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE, SPACING } from '../constants/theme';
import { useThemeContext } from '../context/ThemeContext';

interface MenuOption {
    id: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    action: () => void;
}

interface PlayerMenuProps {
    visible: boolean;
    onClose: () => void;
    options: MenuOption[];
}

const PlayerMenu = ({ visible, onClose, options }: PlayerMenuProps) => {
    const { colors } = useThemeContext();
    const styles = useStyles(colors);
    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
            <View style={styles.menuContainer}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {options.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            style={styles.menuItem}
                            onPress={() => {
                                option.action();
                                onClose();
                            }}
                        >
                            <Ionicons name={option.icon} size={24} color={colors.white} style={styles.icon} />
                            <Text style={styles.label}>{option.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
};

const useStyles = (colors: any) => StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 20,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    menuContainer: {
        width: 250,
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        height: '100%',
        paddingTop: SPACING.xl,
    },
    scrollContent: {
        paddingBottom: SPACING.xl,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.m,
        paddingHorizontal: SPACING.m,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    icon: {
        marginRight: SPACING.m,
        width: 30, // Alignment
    },
    label: {
        color: colors.white,
        fontSize: FONT_SIZE.m,
        fontWeight: '500',
    },
});

export default PlayerMenu;
