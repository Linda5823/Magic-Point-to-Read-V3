
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TextBlock, LanguageCode, SUPPORTED_LANGUAGES } from "../types";

const OCR_MODEL = 'gemini-3-flash-preview';
const REASONING_MODEL = 'gemini-3-flash-preview';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

const getAIClient = () => {
  // Use VITE_ prefix for client-side Vite apps
  const apiKey = (import.meta.env as any).VITE_API_KEY || (import.meta.env as any).VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("API_KEY_MISSING: API Key is not configured. Please check your environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

const parseGeminiError = (error: any): string => {
  console.error("Gemini API Error:", error);
  const msg = error.message || "Unknown error";
  if (msg.includes('429')) return "API Quota exceeded. Please try again later.";
  if (msg.includes('API_KEY_INVALID')) return "Invalid API Key. Please verify your key.";
  return msg;
};

export const analyzeImage = async (base64Image: string): Promise<TextBlock[]> => {
  const ai = getAIClient();
  const prompt = `Perform OCR on this image. Return a JSON array of blocks. 
  Each block: {"text": "found text", "box_2d": [ymin, xmin, ymax, xmax]}. 
  Normalize coordinates to 0-1000. Detect all visible text clearly.`;
  
  try {
    const response = await ai.models.generateContent({
      model: OCR_MODEL,
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Image } },
          { text: prompt }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER } }
            },
            required: ["text", "box_2d"]
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (e) {
    throw new Error(parseGeminiError(e));
  }
};

export const translateWithPivot = async (text: string, targetLangCode: LanguageCode): Promise<string> => {
  if (targetLangCode === 'none') return text;
  const ai = getAIClient();
  
  const targetLang = SUPPORTED_LANGUAGES.find(l => l.code === targetLangCode)?.name.split('/')[1]?.trim() || 'English';

  try {
    const response = await ai.models.generateContent({
      model: REASONING_MODEL,
      contents: [{ 
        parts: [{ 
          text: `Translate the following text into ${targetLang}.
          
          Process:
          1. Detect the source language.
          2. If the source is not English, internally translate it to English first to capture the precise nuance.
          3. Finally, translate the English meaning into ${targetLang}.
          
          Source Text: "${text}"
          
          Output only the final translated text in ${targetLang}. No explanations or meta-talk.` 
        }] 
      }],
      config: { 
        systemInstruction: "You are a professional, high-accuracy translator. Maintain the tone of the original text.",
        temperature: 0.1 
      },
    });
    return response.text?.trim() || text;
  } catch (err) {
    throw new Error(parseGeminiError(err));
  }
};

export const generateSpeech = async (text: string): Promise<ArrayBuffer> => {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: text.trim() }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { 
            prebuiltVoiceConfig: { voiceName: 'Kore' } 
          } 
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
    const audioData = audioPart?.inlineData?.data;
    if (audioData) {
      const uint8Array = decodeBase64(audioData);
      const arrayBuffer = new ArrayBuffer(uint8Array.length);
      new Uint8Array(arrayBuffer).set(uint8Array);
      return arrayBuffer;
    }
    throw new Error("TTS response contained no audio data.");
  } catch (error: any) {
    throw new Error(parseGeminiError(error));
  }
};

export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
  // Gemini TTS provides raw 16-bit PCM at 24kHz
  const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const length = data.byteLength / 2;
  const audioBuffer = ctx.createBuffer(1, length, 24000);
  const channelData = audioBuffer.getChannelData(0);
  
  for (let i = 0; i < length; i++) {
    channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
  }
  return audioBuffer;
}
