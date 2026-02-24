import AsyncStorage from '@react-native-async-storage/async-storage';

const GEMINI_API_KEY_STORAGE = 'gemini-api-key-storage';

export const getGeminiApiKey = async (): Promise<string | null> => {
    try {
        return await AsyncStorage.getItem(GEMINI_API_KEY_STORAGE);
    } catch (error) {
        console.error('Failed to load Gemini API key', error);
        return null;
    }
};

export const saveGeminiApiKey = async (key: string): Promise<boolean> => {
    try {
        if (!key || key.trim() === '') {
            await AsyncStorage.removeItem(GEMINI_API_KEY_STORAGE);
        } else {
            await AsyncStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
        }
        return true;
    } catch (error) {
        console.error('Failed to save Gemini API key', error);
        return false;
    }
};
