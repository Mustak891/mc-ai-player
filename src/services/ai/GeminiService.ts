import { GoogleGenerativeAI } from '@google/generative-ai';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { IAIService, AnalysisResult } from './types';
import { GEMINI_API_KEY } from '../../constants/keys';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export class GeminiService implements IAIService {
    async analyze(timestamp: number, videoTitle?: string, videoUri?: string): Promise<AnalysisResult> {
        if (!videoUri) {
            throw new Error("True AI Analysis requires a valid local video URI");
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
                [{ resize: { width: 512 } }], // Resize width, maintain aspect ratio
                { format: ImageManipulator.SaveFormat.JPEG, compress: 0.7 }
            );

            // 3. Convert to base64
            const base64 = await FileSystem.readAsStringAsync(manipResult.uri, { encoding: 'base64' });

            // 4. Send to Gemini
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const prompt = `You are analyzing a frame from a video${videoTitle ? ` titled "${videoTitle}"` : ''}. In one sentence, describe what is on screen right now. Be direct and specific.`;

            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: base64,
                        mimeType: "image/jpeg"
                    }
                }
            ]);

            const text = result.response.text();

            return {
                timestamp,
                detections: [
                    {
                        id: `gemini-detect-${timestamp}`,
                        type: 'scene',
                        label: 'Scene Details',
                        confidence: 1.0,
                        metadata: {
                            description: text,
                        }
                    }
                ]
            };
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw new Error('Failed to analyze frame with Gemini API.');
        }
    }
}

export const aiService = new GeminiService();
