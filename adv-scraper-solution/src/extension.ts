import { LogService } from './utils/logService';
import { ConfigService } from './services/configService';
import { IdentityManager } from './services/identityManager';
import { ProxyManager } from './services/proxyManager';
import { BrowserAutomationService } from './services/browser/browserAutomation';
import { ScraperManager } from './core/scraperManager';

// Serviços singleton
let logService: LogService | null = null;
let configService: ConfigService | null = null;
let identityManager: IdentityManager | null = null;
let proxyManager: ProxyManager | null = null;
let browserService: BrowserAutomationService | null = null;
let scraperManager: ScraperManager | null = null;

/**
 * Inicializa todos os serviços necessários
 */
export async function initializeServices(configPath?: string): Promise<void> {
  // Inicializar serviço de logs
  logService = new LogService();
  logService.info('Inicializando serviços...');
  
  // Configurar serviço de configuração
  configService = new ConfigService(logService, configPath);
  await configService.initialize();
  
  // Inicializar gerenciadores
  identityManager = new IdentityManager(configService, logService);
  await identityManager.initialize();
  
  proxyManager = new ProxyManager(configService, logService);
  await proxyManager.initialize();
  
  // Inicializar serviço de automação
  browserService = new BrowserAutomationService(
    configService,
    identityManager,
    proxyManager,
    logService
  );
  
  // Inicializar gerenciador de scraping
  scraperManager = new ScraperManager(
    browserService,
    identityManager,
    proxyManager,
    configService,
    logService
  );
  
  logService.info('Todos os serviços inicializados com sucesso.');
}

/**
 * Recupera o serviço de log
 */
export function getLogService(): LogService {
  if (!logService) {
    logService = new LogService();
  }
  return logService;
}

/**
 * Recupera o serviço de configuração
 */
export function getConfigService(): ConfigService {
  if (!configService) {
    throw new Error('O serviço de configuração não foi inicializado. Chame initializeServices() primeiro.');
  }
  return configService;
}

/**
 * Recupera o gerenciador de identidades
 */
export function getIdentityManager(): IdentityManager {
  if (!identityManager) {
    throw new Error('O gerenciador de identidades não foi inicializado. Chame initializeServices() primeiro.');
  }
  return identityManager;
}

/**
 * Recupera o gerenciador de proxies
 */
export function getProxyManager(): ProxyManager {
  if (!proxyManager) {
    throw new Error('O gerenciador de proxies não foi inicializado. Chame initializeServices() primeiro.');
  }
  return proxyManager;
}

/**
 * Recupera o serviço de automação de browser
 */
export function getBrowserService(): BrowserAutomationService {
  if (!browserService) {
    throw new Error('O serviço de automação de browser não foi inicializado. Chame initializeServices() primeiro.');
  }
  return browserService;
}

/**
 * Recupera o gerenciador de scraping
 */
export function getScraperManager(): ScraperManager {
  if (!scraperManager) {
    throw new Error('O gerenciador de scraping não foi inicializado. Chame initializeServices() primeiro.');
  }
  return scraperManager;
}

/**
 * Encerra todos os serviços
 */
export async function shutdownServices(): Promise<void> {
  if (browserService) {
    await browserService.destroy();
  }
  
  logService?.info('Todos os serviços foram encerrados.');
}

// Define funções e classes exportadas
export { LogService } from './utils/logService';
export { ConfigService } from './services/configService';
export { IdentityManager, IdentityProfile } from './services/identityManager';
export { ProxyManager, ProxyDetails, ProxyType, ProxyStatus } from './services/proxyManager';
export { BrowserAutomationService } from './services/browser/browserAutomation';
export { ScraperManager, ScraperOptions, ScraperResult } from './core/scraperManager';
export { BrowserFingerprint, BrowserSettings } from './types/context';
