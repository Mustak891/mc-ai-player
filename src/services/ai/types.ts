export interface BoundingBox {
    x: number; // 0-1 normalized coordinates
    y: number; // 0-1 normalized coordinates
    width: number; // 0-1 normalized coordinates
    height: number; // 0-1 normalized coordinates
}

export type DetectionType = 'person' | 'object' | 'scene';

export interface Detection {
    id: string;
    label: string;
    confidence: number;
    box?: BoundingBox; // Scene detections might not have a box
    type: DetectionType;
    metadata?: {
        actorName?: string;
        description?: string;
    };
}

export interface AnalysisResult {
    timestamp: number;
    detections: Detection[];
}

export interface IAIService {
    analyze(timestamp: number, videoTitle?: string): Promise<AnalysisResult>;
}
