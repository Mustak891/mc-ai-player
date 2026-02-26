export type RootStackParamList = {
    Main: undefined;
    Player: {
        videoUri: string;
        title?: string;
        subtitleCandidates?: Array<{ uri: string; name: string }>;
    };
    PrivacyPolicy: undefined;
    TermsAndConditions: undefined;
};

export type BottomTabParamList = {
    VideoLibrary: undefined;
    Audio: undefined;
    Browse: undefined;
    Playlists: undefined;
    More: undefined;
};
