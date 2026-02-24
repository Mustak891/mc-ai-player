import { IAIService, AnalysisResult, Detection } from './types';

// Simulated data for demo purposes
// In a real app, this would be replaced by TFLite model inference or API calls
export class MockAIService implements IAIService {

    private extractKeywords(title?: string): string[] {
        if (!title) return ['generic'];
        return title.toLowerCase().split(/[\s-_]+/);
    }

    async analyze(timestamp: number, videoTitle?: string): Promise<AnalysisResult> {
        // Simulate network latency or processing model time
        // 1200ms delay is necessary so the user perceives the intentional "Auto-Pause" and "Analyzing..." UI state.
        await new Promise(resolve => setTimeout(resolve, 1200));

        const seconds = Math.floor(timestamp / 1000);
        const detections: Detection[] = [];
        const keywords = this.extractKeywords(videoTitle);

        let sceneDescription = '';
        let sceneLabel = '';
        let personLabel = '';
        let actorName = '';
        let objectLabel = '';
        let objectLabel2 = '';

        // Match context based on title keywords for perceived accuracy
        if (keywords.includes('nature') || keywords.includes('wildlife') || keywords.includes('forest')) {
            sceneLabel = 'Nature Environment';
            sceneDescription = 'Lush wilderness and vegetation';
            personLabel = 'Explorer';
            actorName = 'Wildlife Photographer';
            objectLabel = 'Camera';
            objectLabel2 = 'Backpack';
        } else if (keywords.includes('city') || keywords.includes('urban') || keywords.includes('street')) {
            sceneLabel = 'Urban Street';
            sceneDescription = 'Busy metropolitan area';
            personLabel = 'Pedestrian';
            actorName = 'City Commuter';
            objectLabel = 'Smartphone';
            objectLabel2 = 'Briefcase';
        } else if (keywords.includes('tech') || keywords.includes('review') || keywords.includes('unbox')) {
            sceneLabel = 'Studio Setup';
            sceneDescription = 'Professional lighting and desk';
            personLabel = 'Presenter';
            actorName = 'Tech Reviewer';
            objectLabel = 'Laptop';
            objectLabel2 = 'Microphone';
        } else if (keywords.includes('concert') || keywords.includes('live') || keywords.includes('music')) {
            sceneLabel = 'Live Concert';
            sceneDescription = 'Stage with dynamic lighting';
            personLabel = 'Musician';
            actorName = 'Lead Vocalist';
            objectLabel = 'Microphone';
            objectLabel2 = 'Guitar';
        } else {
            // Fallback generic but realistic
            sceneLabel = seconds % 2 === 0 ? 'Indoor Location' : 'Outdoor Scene';
            sceneDescription = seconds % 2 === 0 ? 'Well-lit interior space' : 'Natural daylight environment';
            personLabel = 'Subject';
            actorName = 'Main Actor';
            objectLabel = 'Accessory';
            objectLabel2 = 'Digital Device';
        }

        // Scene detection (Context)
        detections.push({
            id: 'scene-1',
            label: sceneLabel,
            confidence: 0.95 + (Math.random() * 0.04),
            type: 'scene',
            metadata: {
                description: sceneDescription
            }
        });

        return {
            timestamp,
            detections
        };
    }
}

export const aiService = new MockAIService();
