import { 
  initializeServices, 
  shutdownServices,
  getLogService,
  getConfigService,
  getIdentityManager,
  getProxyManager,
  getBrowserService,
  getScraperManager
} from '../extension';

import type { BrowserFingerprint, BrowserSettings } from '../types/context';
import type { ProxyDetails, ProxyType, ProxyStatus } from '../services/proxyManager';
import type { IdentityProfile } from '../services/identityManager';
import type { ScraperOptions, ScraperResult } from '../core/scraperManager';
import type { LogLevel } from '../utils/logService';
import type { BrowserAction } from '../services/browser/browserAutomation';

/**
 * Tipos de navegadores suportados
 */
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

/**
 * Interface para comportamento humanizado
 */
export interface HumanBehaviorOptions {
  typing?: {
    minDelay?: number;
    maxDelay?: number;
    mistakeProbability?: number;
  };
  mouse?: {
    moveSpeed?: number;
    clickDelay?: number;
    naturalMovement?: boolean;
  };
  wait?: {
    minDelay?: number;
    maxDelay?: number;
  };
}

/**
 * Interface para opções avançadas de evasão
 */
export type EvasionTechnique = 'stealth' | 'blockTrackers' | 'randomizeHeaders' | 'rotateBrowsers';

/**
 * Versão da API
 */
export const API_VERSION = '1.1.0';

/**
 * Função de inicialização da API
 * 
 * @param configPath Caminho opcional para arquivo de configuração personalizado
 */
export async function initialize(configPath?: string): Promise<void> {
  await initializeServices(configPath);
  const logService = getLogService();
  logService.info(`Advanced Scraper Solution API v${API_VERSION} inicializada com sucesso`);
}

/**
 * Função para finalizar todos os recursos
 */
export async function shutdown(): Promise<void> {
  const logService = getLogService();
  logService.info('Finalizando todos os serviços...');
  await shutdownServices();
  logService.info('Todos os serviços foram encerrados com sucesso');
}

/**
 * Interface aprimorada para opções de scraping
 */
export interface AdvancedScraperOptions extends Omit<ScraperOptions, 'extraOptions'> {
  browserType?: BrowserType;
  evasionTechniques?: EvasionTechnique[];
  viewport?: { width: number; height: number };
  locale?: string;
  geolocation?: { latitude: number; longitude: number; accuracy: number };
  blockDomains?: string[];
  humanBehavior?: HumanBehaviorOptions;
}

/**
 * Funções de scraping
 * 
 * @param options Opções avançadas de scraping
 */
export async function scrape<T = any>(options: AdvancedScraperOptions): Promise<ScraperResult<T>> {
  const scraperManager = getScraperManager();
  const logService = getLogService();
  
  logService.debug(`Iniciando scraping para URL: ${options.url}`);
  
  // Extrair propriedades avançadas e propriedades padrão
  const { 
    browserType, 
    evasionTechniques, 
    viewport, 
    locale, 
    geolocation, 
    blockDomains, 
    humanBehavior,
    ...standardOptions 
  } = options;
  
  // Armazenar as configurações avançadas (serão usadas pelo BrowserAutomationService internamente)
  const advancedConfigKey = `advanced_config_${Date.now()}`;
  const configService = getConfigService();
  await configService.set(advancedConfigKey, {
    browserType,
    evasionTechniques,
    viewport,
    locale,
    geolocation,
    blockDomains,
    humanBehavior
  });
  
  // Adicionar uma flag para indicar que existem configurações avançadas
  const scrapingOptions: ScraperOptions = {
    ...standardOptions,
    // Passar apenas as opções suportadas pelo ScraperOptions
    url: options.url,
    selectors: options.selectors,
    waitForSelector: options.waitForSelector,
    maxRetries: options.maxRetries,
    timeout: options.timeout,
    proxy: options.proxy,
    humanLike: options.humanLike || (humanBehavior !== undefined)
  };
  
  // Executar o scraping
  try {
    const result = await scraperManager.scrape<T>(scrapingOptions);
    
    if (result.success) {
      logService.info(`Scraping concluído com sucesso para: ${options.url}`);
    } else {
      logService.error(`Erro durante scraping para: ${options.url}`, result.error);
    }
    
    return result;
  } finally {
    // Limpar as configurações temporárias
    await configService.remove(advancedConfigKey).catch(() => {
      // Ignorar erros na limpeza
    });
  }
}

/**
 * Funções do gerenciador de identidades
 */
export async function createProfile(profile?: Partial<IdentityProfile>): Promise<string> {
  const identityManager = getIdentityManager();
  const logService = getLogService();
  
  logService.debug(`Criando perfil de identidade${profile?.name ? `: ${profile.name}` : ''}`);
  const id = await identityManager.createProfile(profile || {});
  logService.info(`Perfil de identidade criado com ID: ${id}`);
  
  return id;
}

export async function createRandomProfile(): Promise<string> {
  const identityManager = getIdentityManager();
  const logService = getLogService();
  
  logService.debug('Criando perfil de identidade aleatório');
  const id = await identityManager.createRandomProfile();
  logService.info(`Perfil de identidade aleatório criado com ID: ${id}`);
  
  return id;
}

export function getProfile(id: string): IdentityProfile | null {
  const identityManager = getIdentityManager();
  return identityManager.getProfile(id);
}

export function listProfiles(tags?: string[]): IdentityProfile[] {
  const identityManager = getIdentityManager();
  const profiles = identityManager.listProfiles(tags);
  
  const logService = getLogService();
  logService.debug(`Listados ${profiles.length} perfis de identidade${tags ? ` com tags: ${tags.join(', ')}` : ''}`);
  
  return profiles;
}

/**
 * Função para deletar um perfil de identidade
 */
export async function deleteProfile(id: string): Promise<boolean> {
  const identityManager = getIdentityManager();
  const logService = getLogService();
  
  const result = await identityManager.removeProfile(id);
  if (result) {
    logService.info(`Perfil de identidade excluído: ${id}`);
  } else {
    logService.warn(`Falha ao excluir perfil de identidade: ${id}`);
  }
  
  return result;
}

/**
 * Opções para criação de proxy
 */
export interface CreateProxyOptions {
  host: string;
  port: number;
  protocol?: ProxyType;
  username?: string;
  password?: string;
  country?: string;
  city?: string;
  isp?: string;
  tags?: string[];
  rotationInterval?: number; // em minutos
}

/**
 * Funções do gerenciador de proxies
 */
export async function addProxy(options: CreateProxyOptions): Promise<string> {
  const proxyManager = getProxyManager();
  const logService = getLogService();
  
  logService.debug(`Adicionando proxy: ${options.protocol || 'http'}://${options.host}:${options.port}`);
  const id = await proxyManager.addProxy(options);
  logService.info(`Proxy adicionado com ID: ${id}`);
  
  return id;
}

/**
 * Cria um novo proxy com detalhes específicos
 */
export async function createProxy(options: CreateProxyOptions): Promise<string> {
  return addProxy(options);
}

export function getProxy(id: string): ProxyDetails | null {
  const proxyManager = getProxyManager();
  return proxyManager.getProxy(id);
}

export function listProxies(filter?: {
  status?: ProxyStatus;
  protocol?: ProxyType;
  country?: string;
  tags?: string[];
}): ProxyDetails[] {
  const proxyManager = getProxyManager();
  const proxies = proxyManager.listProxies(filter);
  
  const logService = getLogService();
  logService.debug(`Listados ${proxies.length} proxies${filter ? ' com filtros' : ''}`);
  
  return proxies;
}

/**
 * Deleta um proxy pelo ID
 */
export async function deleteProxy(id: string): Promise<boolean> {
  const proxyManager = getProxyManager();
  const logService = getLogService();
  
  const result = await proxyManager.removeProxy(id);
  
  if (result) {
    logService.info(`Proxy removido: ${id}`);
  } else {
    logService.warn(`Falha ao remover proxy: ${id}`);
  }
  
  return result;
}

/**
 * Verificar conectividade de um proxy (stub para futura implementação)
 */
export async function testProxy(id: string): Promise<{
  success: boolean;
  responseTime?: number;
  externalIp?: string;
  error?: string;
}> {
  const proxyManager = getProxyManager();
  const logService = getLogService();
  const proxy = proxyManager.getProxy(id);
  
  if (!proxy) {
    return {
      success: false,
      error: `Proxy não encontrado com ID: ${id}`
    };
  }
  
  logService.debug(`Verificando conectividade do proxy: ${proxy.host}:${proxy.port}`);
  
  try {
    // Simulação de teste de proxy (será implementado na versão completa)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      responseTime: 150, // simulado
      externalIp: '203.0.113.42' // simulado
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Interface aprimorada para opções de sessão do navegador
 */
export interface EnhancedSessionOptions {
  profileId?: string;
  proxyId?: string;
  browserType?: BrowserType;
  headless?: boolean;
  defaultUrl?: string;
  humanLike?: boolean;
  viewport?: { width: number; height: number };
  locale?: string;
  geolocation?: { latitude: number; longitude: number; accuracy: number };
  blockDomains?: string[];
  humanBehavior?: HumanBehaviorOptions;
}

/**
 * Funções do navegador
 */
export async function createSession(options?: EnhancedSessionOptions): Promise<string> {
  const browserService = getBrowserService();
  const logService = getLogService();
  
  // Filtrar apenas as opções suportadas pelo serviço de browser
  const compatibleOptions: any = {
    profileId: options?.profileId,
    proxyId: options?.proxyId,
    headless: options?.headless,
    defaultUrl: options?.defaultUrl,
    humanLike: options?.humanLike,
    browserType: options?.browserType,
    viewport: options?.viewport,
    locale: options?.locale,
    geolocation: options?.geolocation,
    blockDomains: options?.blockDomains,
    humanBehavior: options?.humanBehavior
  };
  
  logService.debug('Criando nova sessão de navegador');
  const sessionId = await browserService.createSession(compatibleOptions);
  logService.info(`Sessão de navegador criada: ${sessionId}`);
  
  return sessionId;
}

export async function closeSession(sessionId: string): Promise<boolean> {
  const browserService = getBrowserService();
  return browserService.closeSession(sessionId);
}

export async function executeAction(
  sessionId: string,
  action: BrowserAction
): Promise<{ success: boolean; data?: any; error?: string; screenshot?: string }> {
  const browserService = getBrowserService();
  return browserService.executeAction(sessionId, action);
}

// Exporta tipos para acesso público
export type {
  BrowserFingerprint,
  BrowserSettings,
  ProxyDetails,
  ProxyType,
  ProxyStatus,
  IdentityProfile,
  ScraperOptions,
  ScraperResult,
  LogLevel
};
