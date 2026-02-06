
export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface TextBlock {
  text: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
}

export enum AppStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  READY = 'READY',
  SPEAKING = 'SPEAKING',
  TRANSLATING = 'TRANSLATING',
  ERROR = 'ERROR'
}

export const SUPPORTED_LANGUAGES = [
  { code: 'none', name: '—/No Translation/不翻译' },
  { code: 'zh', name: '中文/Chinese/中文' },
  { code: 'en', name: 'English/English/英文' },
  { code: 'ja', name: '日本語/Japanese/日语' },
  { code: 'ko', name: '한국어/Korean/韩语' },
  { code: 'es', name: 'Español/Spanish/西班牙语' },
  { code: 'fr', name: 'Français/French/法语' },
  { code: 'de', name: 'Deutsch/German/德语' },
  { code: 'ru', name: 'Русский/Russian/俄语' },
  { code: 'ar', name: 'العربية/Arabic/阿拉伯语' },
  { code: 'th', name: 'ไทย/Thai/泰语' },
  { code: 'vi', name: 'Tiếng Việt/Vietnamese/越南语' },
  { code: 'la', name: 'Latina/Latin/拉丁语' },
  { code: 'it', name: 'Italiano/Italian/意大利语' },
];

export type LanguageCode = 'none' | 'zh' | 'en' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'ru' | 'ar' | 'th' | 'vi' | 'la' | 'it';
