
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
  { code: 'none', name: 'No Translation / 不翻译' },
  { code: 'zh', name: 'Chinese / 中文' },
  { code: 'en', name: 'English / 英文' },
  { code: 'ja', name: 'Japanese / 日语' },
  { code: 'ko', name: 'Korean / 韩语' },
  { code: 'es', name: 'Spanish / 西班牙语' },
  { code: 'fr', name: 'French / 法语' },
  { code: 'de', name: 'German / 德语' },
  { code: 'ru', name: 'Russian / 俄语' },
  { code: 'ar', name: 'Arabic / 阿拉伯语' },
  { code: 'th', name: 'Thai / 泰语' },
  { code: 'vi', name: 'Vietnamese / 越南语' },
  { code: 'la', name: 'Latin / 拉丁语' },
  { code: 'it', name: 'Italian / 意大利语' },
];

export type LanguageCode = 'none' | 'zh' | 'en' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'ru' | 'ar' | 'th' | 'vi' | 'la' | 'it';
