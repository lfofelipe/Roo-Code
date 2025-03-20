/**
 * Configurações do navegador para uma sessão
 */
export interface BrowserSettings {
  userAgent: string;
  viewportSize: { width: number; height: number };
  locale: string;
  timezone?: string;
  platform?: string;
  hasTouch?: boolean;
  deviceScaleFactor?: number;
  colorScheme?: 'dark' | 'light' | 'no-preference';
}

/**
 * Fingerprint de navegador para evitar detecção
 */
export interface BrowserFingerprint {
  id: string;
  name: string;
  userAgent: string;
  platform: string;
  version: string;
  language: string;
  screenResolution: { width: number; height: number };
  timezone: string;
  plugins: string[];
  fonts: string[];
  canvas?: { r: number; g: number; b: number };
  webgl?: { vendor: string; renderer: string };
  hardwareConcurrency: number;
  deviceMemory?: number;
  colorDepth: number;
  touchSupport: boolean;
}
