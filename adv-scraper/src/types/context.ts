/**
 * Definição dos tipos de dados usados pelo sistema
 */

/**
 * Níveis de evasão de detecção
 */
export type EvasionLevel = 'basic' | 'standard' | 'advanced' | 'maximum';

/**
 * Métodos de scraping disponíveis
 */
export type ScrapingMethod = 
  | 'browser-automation' 
  | 'api-client' 
  | 'visual-scraping' 
  | 'hybrid' 
  | 'direct-request';

/**
 * Status possíveis para tarefa
 */
export type TaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

/**
 * Configurações de comportamento
 */
export interface BehaviorSettings {
  humanLike?: boolean; 
  randomizeUserAgent?: boolean;
  respectRobotsTxt?: boolean;
  evasionLevel?: EvasionLevel;
  waitTimes?: {
    minDelay?: number;
    maxDelay?: number;
  };
}

/**
 * Configurações de navegador
 */
export interface BrowserSettings {
  browserType?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  viewportSize?: { width: number; height: number };
  userAgent?: string;
  cookies?: string[];
  localStorage?: Record<string, string>;
}

/**
 * Seletor para extração de dados
 */
export interface Selector {
  name: string;
  selector: string;
  selectorType: 'css' | 'xpath' | 'visual';
  multiple?: boolean;
  attribute?: string;
  transform?: string;
  required?: boolean;
}

/**
 * Definição de fingerprint do navegador
 */
export interface BrowserFingerprint {
  userAgent: string;
  platform: string;
  screenResolution: {
    width?: number;
    height?: number;
    pixelRatio: number;
  };
  languages: string[];
  timezone: string;
  plugins: { name: string; description: string }[];
  fonts: string[];
  webGLVendor?: string;
  webGLRenderer?: string;
  doNotTrack?: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

/**
 * Opções de tarefa de scraping
 */
export interface ScrapingTaskOptions {
  name: string;
  description?: string;
  targetUrl: string;
  method?: ScrapingMethod;
  selectors?: Selector[];
  pagination?: {
    type: 'infinite-scroll' | 'button-click' | 'page-number';
    selector?: string;
    maxPages?: number;
  };
  authentication?: {
    required: boolean;
    type?: 'form' | 'oauth' | 'basic' | 'token';
    username?: string;
    password?: string;
    loginUrl?: string;
    tokenUrl?: string;
    formSelector?: string;
    usernameSelector?: string;
    passwordSelector?: string;
    submitSelector?: string;
  };
  browserSettings?: BrowserSettings;
  behaviorSettings?: BehaviorSettings;
  schedule?: {
    enabled: boolean;
    interval?: number;
    cron?: string;
  };
  outputFormat?: 'json' | 'csv' | 'xlsx';
  maxRetries?: number;
  timeout?: number;
}

/**
 * Configurações de proxy
 */
export interface ProxySettings {
  enabled: boolean;
  type: 'datacenter' | 'residential' | 'mobile';
  rotationInterval?: number;
  countryCode?: string;
  city?: string;
  state?: string;
  username?: string;
  password?: string;
  authToken?: string;
  url?: string;
}

/**
 * Contexto global da extensão
 */
export interface ExtensionContext {
  scraperManager: any;
  secureStorage: any;
  configService: any;
  logService: any;
  proxyManager: any;
  identityManager: any;
  browserService: any;
  aiService: any;
  dataRepository: any;
}

/**
 * Status de uma tarefa de scraping
 */
export interface ScrapingTaskStatus {
  id: string;
  name: string;
  status: TaskStatus;
  progress: number;
  targetUrl: string;
  startTime?: Date;
  endTime?: Date;
  lastError?: string;
  lastRun?: Date;
  nextRun?: Date;
  itemsProcessed: number;
  itemsTotal?: number;
  method: ScrapingMethod;
}
