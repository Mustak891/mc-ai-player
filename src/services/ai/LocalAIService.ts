import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import jpeg from 'jpeg-js';
import { IAIService, AnalysisResult, Detection } from './types';

function base64ToUint8Array(base64: string): Uint8Array {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) {
        lookup[chars.charCodeAt(i)] = i;
    }

    let bufferLength = base64.length * 0.75;
    if (base64[base64.length - 1] === '=') bufferLength--;
    if (base64[base64.length - 2] === '=') bufferLength--;

    const bytes = new Uint8Array(bufferLength);
    let p = 0;
    for (let i = 0; i < base64.length; i += 4) {
        let encoded1 = lookup[base64.charCodeAt(i)];
        let encoded2 = lookup[base64.charCodeAt(i + 1)];
        let encoded3 = lookup[base64.charCodeAt(i + 2)];
        let encoded4 = lookup[base64.charCodeAt(i + 3)];

        bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
        bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
    return bytes;
}

export class LocalAIService implements IAIService {
    private model: TensorflowModel | null = null;
    private labels: string[] = [];
    private isInitializing = false;

    constructor() {
        this.init();
    }

    private async init() {
        if (this.isInitializing || this.model) return;
        this.isInitializing = true;
        try {
            // Load the bundled TFLite Model
            this.model = await loadTensorflowModel(require('../../../assets/models/mobilenet_v1_1.0_224_quant.tflite'));

            // Load the human-readable ImageNet Labels
            const labelsAsset = Asset.fromModule(require('../../../assets/models/labels_mobilenet_quant_v1_224.txt'));
            await labelsAsset.downloadAsync();
            if (labelsAsset.localUri) {
                const text = await FileSystem.readAsStringAsync(labelsAsset.localUri);
                this.labels = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            }
        } catch (error) {
            console.error('Failed to initialize AI ML Model:', error);
        } finally {
            this.isInitializing = false;
        }
    }

    private async ensureInitialized() {
        if (!this.model) {
            await this.init();
        }
        let retries = 0;
        while (!this.model && retries < 40) {
            await new Promise(r => setTimeout(r, 100));
            retries++;
        }
    }

    async analyze(timestamp: number, videoTitle?: string, videoUri?: string): Promise<AnalysisResult> {
        if (!videoUri) {
            throw new Error("True AI Analysis requires a valid local video URI");
        }

        await this.ensureInitialized();
        if (!this.model || this.labels.length === 0) {
            throw new Error('ML Model not successfully loaded into memory.'); // Fallback to safe error
        }

        // 1. Extract Raw Thumbnail Frame from Video
        const thumbnail = await VideoThumbnails.getThumbnailAsync(videoUri, {
            time: timestamp,
            quality: 0.8
        });

        // 2. Format tensor to 224x224 (MobileNet standard requirement)
        const manipResult = await ImageManipulator.manipulateAsync(
            thumbnail.uri,
            [{ resize: { width: 224, height: 224 } }],
            { format: ImageManipulator.SaveFormat.JPEG, compress: 1.0 }
        );

        // 3. Decode JPEG buffer into Uint8Array
        const base64 = await FileSystem.readAsStringAsync(manipResult.uri, { encoding: 'base64' });
        const jpegData = base64ToUint8Array(base64);
        const rawImageData = jpeg.decode(jpegData, { useTArray: true }); // RGBA format

        // 4. Transform RGBA into flat RGB Sequence [1, 224, 224, 3]
        const rgbData = new Uint8Array(224 * 224 * 3);
        let rgbIndex = 0;
        const totalPixels = 224 * 224;

        for (let i = 0; i < totalPixels; i++) {
            const rawIndex = i * 4; // Source is RGBA
            rgbData[rgbIndex++] = rawImageData.data[rawIndex];     // R
            rgbData[rgbIndex++] = rawImageData.data[rawIndex + 1]; // G
            rgbData[rgbIndex++] = rawImageData.data[rawIndex + 2]; // B
        }

        // 5. Invoke Hardware-Accelerated TFLite Model
        const outputTensor = await this.model.run([rgbData]);

        // 6. Evaluate Confidences
        // The mobilenet "quant" model outputs a Uint8Array where 0-255 corresponds to confidences 0.0-1.0
        const confidences = outputTensor[0] as Uint8Array | Float32Array;

        let maxConfidenceValue = -1;
        let maxIndex = -1;
        for (let i = 0; i < confidences.length; i++) {
            if (confidences[i] > maxConfidenceValue) {
                maxConfidenceValue = confidences[i];
                maxIndex = i;
            }
        }

        console.log(`[ML_DEBUG] Time: ${timestamp}ms | Thumbnail URI: ${thumbnail.uri}`);
        console.log(`[ML_DEBUG] Tensor Sample (first 5 bytes):`, rgbData.slice(0, 5));
        console.log(`[ML_DEBUG] Confidences array type:`, confidences.constructor.name, `| Max Value:`, maxConfidenceValue, `| Max Index:`, maxIndex);

        const predictedLabel = this.labels[maxIndex] || 'Unknown Scene';
        const percentConfidence = maxConfidenceValue / 255; // Normalize 0-255 to 0.0-1.0

        // Parse human-readable output
        const titleCase = predictedLabel.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        return {
            timestamp,
            detections: [
                {
                    id: `ml-detect-${timestamp}`,
                    type: 'scene',
                    label: titleCase,
                    confidence: percentConfidence,
                    metadata: {
                        description: `Detected: ${titleCase}`
                    }
                }
            ]
        };
    }
}

export const aiService = new LocalAIService();
