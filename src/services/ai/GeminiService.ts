import { GoogleGenerativeAI } from '@google/generative-ai';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { IAIService, AnalysisResult } from './types';
import { GEMINI_API_KEY } from '../../constants/keys';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const;

export class GeminiService implements IAIService {

    /**
     * Pre-capture a video frame as base64 at the given timestamp.
     * Call this before showing an ad so the expensive I/O is done during ad playback.
     */
    async captureFrameBase64(videoUri: string, timestampMs: number): Promise<string | null> {
        try {
            const thumbnail = await VideoThumbnails.getThumbnailAsync(videoUri, {
                time: timestampMs,
                quality: 0.8,
            });
            const manipResult = await ImageManipulator.manipulateAsync(
                thumbnail.uri,
                [{ resize: { width: 512 } }],
                { format: ImageManipulator.SaveFormat.JPEG, compress: 0.7 }
            );
            return await FileSystem.readAsStringAsync(manipResult.uri, { encoding: 'base64' });
        } catch {
            return null;
        }
    }

    /**
     * Run Gemini analysis using an already-captured base64 frame.
     * No thumbnail extraction latency — call this immediately on reward earned.
     */
    async analyzeWithBase64(
        base64: string,
        timestamp: number,
        videoTitle?: string
    ): Promise<AnalysisResult> {
        if (!GEMINI_API_KEY) {
            throw new Error('AI Analysis is currently unavailable because the API key is not configured.');
        }

        const prompt = `You are analyzing a frame from a video${videoTitle ? ` titled "${videoTitle}"` : ''}. In one sentence, describe what is on screen right now. Be direct and specific.`;

        let text = '';
        let lastModelError: unknown = null;
        for (const modelName of MODEL_CANDIDATES) {
            try {
                const model = genAI.getGenerativeModel(
                    { model: modelName },
                    { apiVersion: 'v1' }
                );
                const result = await model.generateContent([
                    prompt,
                    { inlineData: { data: base64, mimeType: 'image/jpeg' } },
                ]);
                text = result.response.text();
                if (text?.trim()) break;
                lastModelError = new Error(`Empty response from model ${modelName}`);
            } catch (modelError) {
                lastModelError = modelError;
            }
        }

        if (!text?.trim()) {
            if (lastModelError) throw lastModelError;
            throw new Error('No compatible Gemini model responded to generateContent.');
        }

        return {
            timestamp,
            detections: [{
                id: `gemini-detect-${timestamp}`,
                type: 'scene',
                label: 'Scene Details',
                confidence: 1.0,
                metadata: { description: text.trim() },
            }],
        };
    }

    /**
     * Full analyze: captures frame + calls Gemini.
     * Used as a fallback if pre-capture fails.
     */
    async analyze(timestamp: number, videoTitle?: string, videoUri?: string): Promise<AnalysisResult> {
        if (!videoUri) {
            throw new Error('True AI Analysis requires a valid local video URI');
        }

        try {
            // 1. Extract Raw Thumbnail Frame from Video
            const thumbnail = await VideoThumbnails.getThumbnailAsync(videoUri, {
                time: timestamp,
                quality: 0.8,
            });

            // 2. Resize the image for faster upload and processing
            const manipResult = await ImageManipulator.manipulateAsync(
                thumbnail.uri,
                [{ resize: { width: 512 } }],
                { format: ImageManipulator.SaveFormat.JPEG, compress: 0.7 }
            );

            // 3. Convert to base64
            const base64 = await FileSystem.readAsStringAsync(manipResult.uri, { encoding: 'base64' });

            // 4. Send to Gemini
            return await this.analyzeWithBase64(base64, timestamp, videoTitle);
        } catch (error: any) {
            console.error('Gemini API Error:', error);
            const errorMessage = error?.message || String(error);
            throw new Error(`AI Analysis failed: ${errorMessage}`);
        }
    }
}

export const aiService = new GeminiService();
