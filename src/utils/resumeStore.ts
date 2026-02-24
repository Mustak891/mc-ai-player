import * as FileSystem from 'expo-file-system/legacy';

const RESUME_STORE_PATH = `${FileSystem.documentDirectory}resume-positions.json`;

type ResumeStoreEntry = {
    positionMillis: number;
    updatedAt: number;
};

type ResumeStoreRaw = Record<string, number | ResumeStoreEntry>;

const normalizeEntry = (value: number | ResumeStoreEntry | undefined): ResumeStoreEntry => {
    if (typeof value === 'number') {
        return {
            positionMillis: Math.max(0, Math.floor(value)),
            updatedAt: 0,
        };
    }
    if (value && typeof value === 'object') {
        return {
            positionMillis: Math.max(0, Math.floor(value.positionMillis ?? 0)),
            updatedAt: Math.max(0, Math.floor(value.updatedAt ?? 0)),
        };
    }
    return { positionMillis: 0, updatedAt: 0 };
};

const readResumeStoreRaw = async (): Promise<ResumeStoreRaw> => {
    try {
        const info = await FileSystem.getInfoAsync(RESUME_STORE_PATH);
        if (!info.exists) return {};
        const raw = await FileSystem.readAsStringAsync(RESUME_STORE_PATH);
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return parsed as ResumeStoreRaw;
        }
        return {};
    } catch {
        return {};
    }
};

export const readResumeStore = async (): Promise<Record<string, number>> => {
    const raw = await readResumeStoreRaw();
    const normalized: Record<string, number> = {};
    Object.keys(raw).forEach((uri) => {
        normalized[uri] = normalizeEntry(raw[uri]).positionMillis;
    });
    return normalized;
};

export const writeResumePosition = async (uri: string, positionMillis: number) => {
    try {
        const store = await readResumeStoreRaw();
        store[uri] = {
            positionMillis: Math.max(0, Math.floor(positionMillis)),
            updatedAt: Date.now(),
        };
        await FileSystem.writeAsStringAsync(RESUME_STORE_PATH, JSON.stringify(store));
    } catch {
        // Best effort only.
    }
};

export const loadResumePosition = async (uri: string): Promise<number> => {
    const store = await readResumeStoreRaw();
    return normalizeEntry(store[uri]).positionMillis;
};

export const loadResumeInfo = async (uri: string): Promise<ResumeStoreEntry> => {
    const store = await readResumeStoreRaw();
    return normalizeEntry(store[uri]);
};
