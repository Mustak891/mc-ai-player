export type RootStackParamList = {
    Main: undefined;
    Player: {
        videoUri: string;
        title?: string;
        subtitleCandidates?: Array<{ uri: string; name: string }>;
    };
};

export type BottomTabParamList = {
    VideoLibrary: undefined;
    Audio: undefined;
    Browse: undefined;
    Playlists: undefined;
    More: undefined;
};
