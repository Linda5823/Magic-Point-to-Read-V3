/// <reference types="vite/client" />

interface ImportMetaEnv extends Readonly<Record<string, string>> {
  readonly VITE_API_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
}
