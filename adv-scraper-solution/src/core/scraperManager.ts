import { LogService } from '../utils/logService';
import { ConfigService } from '../services/configService';
import { BrowserAutomationService } from '../services/browser/browserAutomation';
import { IdentityManager } from '../services/identityManager';
import { ProxyManager } from '../services/proxyManager';

/**
 * Opções de scraping
 */
export interface ScraperOptions {
  url: string;
  selectors: {
    [key: string]: string;
  };
  waitForSelector?: string;
  maxRetries?: number;
  timeout?: number;
  proxy?: boolean;
  humanLike?: boolean;
}

/**
 * Resultado de scraping
 */
export interface ScraperResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  screenshot?: string;
  timing: {
    start: number;
    end: number;
    duration: number;
  };
}

/**
 * Gerenciador principal de scraping que orquestra os vários serviços
 */
export class ScraperManager {
  constructor(
    private browserService: BrowserAutomationService,
    private identityManager: IdentityManager,
    private proxyManager: ProxyManager,
    private configService: ConfigService,
    private logService: LogService
  ) {}

  /**
   * Executa uma operação de scraping
   */
  public async scrape<T = any>(options: ScraperOptions): Promise<ScraperResult<T>> {
    const startTime = Date.now();
    let sessionId: string | null = null;
    
    try {
      // Configurar proxy se necessário
      let proxyId: string | undefined;
      
      if (options.proxy) {
        const proxy = this.proxyManager.getNextAvailableProxy();
        if (proxy) {
          proxyId = proxy.id;
          this.logService.info(`Usando proxy: ${proxy.host}:${proxy.port}`);
        } else {
          this.logService.warn('Nenhum proxy disponível. Continuando sem proxy.');
        }
      }
      
      // Criar um perfil de identidade
      const profileId = await this.identityManager.createRandomProfile();
      
      // Criar sessão de navegador
      sessionId = await this.browserService.createSession({
        profileId,
        proxyId,
        headless: true,
        humanLike: options.humanLike,
        defaultUrl: options.url
      });
      
      // Esperar pelo seletor se especificado
      if (options.waitForSelector) {
        await this.browserService.executeAction(sessionId, {
          type: 'wait',
          selector: options.waitForSelector,
          timeout: options.timeout || 30000
        });
      }
      
      // Extrair dados baseados nos seletores fornecidos
      const extractionResults: Record<string, any> = {};
      
      for (const [key, selector] of Object.entries(options.selectors)) {
        const result = await this.browserService.executeAction(sessionId, {
          type: 'extractData',
          selector
        });
        
        if (result.success && result.data) {
          extractionResults[key] = result.data;
        }
      }
      
      // Capturar screenshot
      const screenshotResult = await this.browserService.executeAction(sessionId, {
        type: 'screenshot'
      });
      
      // Fechar sessão
      await this.browserService.closeSession(sessionId);
      
      // Calcular tempo
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Reportar sucesso do proxy se usado
      if (proxyId) {
        await this.proxyManager.reportSuccess(proxyId);
      }
      
      return {
        success: true,
        data: extractionResults as T,
        screenshot: screenshotResult.success ? screenshotResult.screenshot : undefined,
        timing: {
          start: startTime,
          end: endTime,
          duration
        }
      };
    } catch (error) {
      // Registrar erro
      this.logService.error('Erro durante scraping', error);
      
      // Fechar sessão se ainda estiver aberta
      if (sessionId) {
        await this.browserService.closeSession(sessionId);
      }
      
      // Calcular tempo
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timing: {
          start: startTime,
          end: endTime,
          duration
        }
      };
    }
  }
}
