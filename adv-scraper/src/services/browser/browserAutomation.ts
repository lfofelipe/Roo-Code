import * as playwright from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '../configService';
import { LogService } from '../../utils/logService';
import { IdentityManager } from '../identityManager';
import { ProxyManager } from '../proxyManager';
import { BrowserFingerprint, BrowserSettings } from '../../types/context';
import { v4 as uuidv4 } from 'uuid';

/**
 * Status da sessão de navegador
 */
type BrowserSessionStatus = 'initializing' | 'ready' | 'running' | 'error' | 'closed';

/**
 * Tipo de browser suportado
 */
type BrowserType = 'chromium' | 'firefox' | 'webkit';

/**
 * Tipo de ação de mouse
 */
type MouseAction = 'click' | 'move' | 'hover' | 'doubleClick';

/**
 * Ação a ser executada
 */
interface BrowserAction {
  type: 'click' | 'type' | 'navigate' | 'wait' | 'screenshot' | 'scrollTo' | 'extractData' | 'evaluate' | 'setViewport';
  selector?: string;
  text?: string;
  url?: string;
  timeout?: number;
  x?: number;
  y?: number;
  function?: string;
  width?: number;
  height?: number;
  humanLike?: boolean;
}

/**
 * Evento da sessão de navegador
 */
interface BrowserSessionEvent {
  type: 'navigation' | 'requestFailed' | 'requestFinished' | 'console' | 'dialog' | 'error' | 'interceptionDetected';
  timestamp: number;
  data: any;
}

/**
 * Interface para resultado de ação
 */
interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  screenshot?: string;
}

/**
 * Opções para a captura de screenshot
 */
interface ScreenshotOptions {
  fullPage?: boolean;
  path?: string;
  type?: 'png' | 'jpeg';
  quality?: number;
  omitBackground?: boolean;
}

/**
 * Informações sobre uma sessão de navegador
 */
interface BrowserSession {
  id: string;
  createdAt: Date;
  lastActivity: Date;
  profileId: string;
  proxyId?: string;
  browser: playwright.Browser | null;
  context: playwright.BrowserContext | null;
  page: playwright.Page | null;
  status: BrowserSessionStatus;
  type: BrowserType;
  userAgent: string;
  viewportSize: { width: number; height: number };
  events: BrowserSessionEvent[];
  blockedDomains: string[];
  intercepts: {
    patterns: string[];
    handlers: Record<string, (request: playwright.Request) => Promise<void>>;
  };
  humanBehavior: {
    typing: {
      minDelay: number;
      maxDelay: number;
      mistakeProbability: number;
    };
    mouse: {
      moveSpeed: number;
      clickDelay: number;
      naturalMovement: boolean;
    };
    wait: {
      minDelay: number;
      maxDelay: number;
    };
    viewport: {
      width: number;
      height: number;
    };
  };
}

/**
 * Opções para criação de sessão de navegador
 */
interface CreateSessionOptions {
  profileId?: string;
  proxyId?: string;
  browserType?: BrowserType;
  headless?: boolean;
  userAgent?: string;
  viewport?: { width: number; height: number };
  locale?: string;
  geolocation?: { latitude: number; longitude: number; accuracy: number };
  evasionLevel?: string;
  humanLike?: boolean;
  humanBehavior?: {
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
  };
  blockDomains?: string[];
  interceptPatterns?: string[];
  stealth?: boolean;
}

/**
 * Eventos emitidos pelo serviço de automação
 */
type BrowserServiceEventMap = {
  'session-created': string;
  'session-closed': string;
  'error': Error;
  'navigation': { sessionId: string, url: string };
  'interception-detected': { sessionId: string, type: string, details: any };
  'bot-detection-attempt': { sessionId: string, url: string, technique: string };
  'captcha-detected': { sessionId: string, url: string, imageData: string };
};

/**
 * Serviço principal para automação de navegador com técnicas avançadas de evasão
 */
export class BrowserAutomationService {
  private sessions: Map<string, BrowserSession> = new Map();
  private eventListeners: Map<keyof BrowserServiceEventMap, Array<(data: any) => void>> = new Map();
  private static readonly COMMON_TRACKER_DOMAINS = [
    'google-analytics.com',
    'analytics.google.com',
    'doubleclick.net',
    'googletagmanager.com',
    'hotjar.com',
    'mouseflow.com',
    'clarity.ms',
    'datadome.co',
    'imperva.com',
    'akamaized.net',
    'cloudflare-bot-detection.com',
    'distil.io',
    'kasada.io',
    'perimeterx.net',
    'shapeshifter.io',
    'perimetrix.net',
    'fingerprintjs.com'
  ];

  constructor(
    private configService: ConfigService,
    private identityManager: IdentityManager,
    private proxyManager: ProxyManager,
    private logService: LogService
  ) {
    // Inicializar listeners de eventos
    this.eventListeners.set('session-created', []);
    this.eventListeners.set('session-closed', []);
    this.eventListeners.set('error', []);
    this.eventListeners.set('navigation', []);
    this.eventListeners.set('interception-detected', []);
    this.eventListeners.set('bot-detection-attempt', []);
    this.eventListeners.set('captcha-detected', []);
  }

  /**
   * Registra um handler para eventos específicos
   */
  public on<K extends keyof BrowserServiceEventMap>(event: K, handler: (data: BrowserServiceEventMap[K]) => void): void {
    const handlers = this.eventListeners.get(event) || [];
    handlers.push(handler);
    this.eventListeners.set(event, handlers);
  }

  /**
   * Emite um evento para os handlers registrados
   */
  private emit<K extends keyof BrowserServiceEventMap>(event: K, data: BrowserServiceEventMap[K]): void {
    const handlers = this.eventListeners.get(event) || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        this.logService.error(`Erro ao executar handler para evento ${event}`, error);
      }
    }
  }

  /**
   * Cria uma nova sessão de navegador com perfil e configurações específicas
   */
  public async createSession(options: CreateSessionOptions = {}): Promise<string> {
    try {
      const sessionId = uuidv4();
      
      // Obter configurações padrão ou usar as fornecidas
      const defaultBehavior = this.configService.getDefaultBehaviorSettings();
      const defaultSettings = {
        browserType: 'chromium' as BrowserType,
        headless: false,
        viewport: { width: 1280, height: 800 },
        locale: 'pt-BR',
        humanBehavior: {
          typing: {
            minDelay: defaultBehavior.waitTimes?.minDelay || 50,
            maxDelay: defaultBehavior.waitTimes?.maxDelay || 150,
            mistakeProbability: 0.05
          },
          mouse: {
            moveSpeed: 5,
            clickDelay: 100,
            naturalMovement: true
          },
          wait: {
            minDelay: defaultBehavior.waitTimes?.minDelay || 500,
            maxDelay: defaultBehavior.waitTimes?.maxDelay || 3000
          }
        },
        blockDomains: defaultBehavior.respectRobotsTxt ? [] : BrowserAutomationService.COMMON_TRACKER_DOMAINS,
        stealth: defaultBehavior.humanLike
      };
      
      // Criar novo ID de perfil se não fornecido
      let profileId = options.profileId || uuidv4();
      
      // Inicializar navegador com configuração específica
      const browserType = options.browserType || defaultSettings.browserType;
      
      let launchOptions: any = {
        headless: options.headless !== undefined ? options.headless : defaultSettings.headless,
        args: []
      };
      
      // Adicionar argumentos para evasão de detecção
      if (browserType === 'chromium') {
        launchOptions.args = [
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--no-sandbox',
        ];
        
        if (defaultSettings.stealth) {
          launchOptions.args.push(
            '--disable-web-security',
            '--disable-extensions',
            '--disable-sync',
            '--no-first-run',
            '--metrics-recording-only',
            '--disable-default-apps',
            '--mute-audio',
            '--no-default-browser-check',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-background-timer-throttling',
            '--disable-background-networking',
            '--disable-breakpad',
            '--disable-component-extensions-with-background-pages',
            '--disable-domain-reliability',
            '--disable-features=TranslateUI,BlinkGenPropertyTrees',
            '--disable-hang-monitor',
            '--disable-ipc-flooding-protection',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--force-color-profile=srgb',
            '--disable-client-side-phishing-detection',
            '--disable-dev-shm-usage'
          );
        }
      }
      
      // Configurar proxy
      let proxySettings: any = null;
      if (options.proxyId) {
        try {
          proxySettings = await this.proxyManager.getProxyDetails(options.proxyId);
          if (proxySettings) {
            if (browserType === 'chromium') {
              launchOptions.proxy = {
                server: proxySettings.url,
                username: proxySettings.username,
                password: proxySettings.password
              };
            } else {
              launchOptions.proxy = {
                server: proxySettings.url,
                username: proxySettings.username,
                password: proxySettings.password
              };
            }
          }
        } catch (error) {
          this.logService.warn(`Proxy ${options.proxyId} não encontrado, usando conexão direta`);
        }
      }
      
      // Iniciar o navegador
      const browser = await playwright[browserType].launch(launchOptions);
      
      // User agent personalizado ou aleatório
      const userAgent = options.userAgent || 
                       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
      
      // Configurar contexto do navegador
      const contextOptions: playwright.BrowserContextOptions = {
        viewport: options.viewport || defaultSettings.viewport,
        userAgent: userAgent,
        locale: options.locale || defaultSettings.locale,
        deviceScaleFactor: 1.0,
        bypassCSP: defaultSettings.stealth,
        ignoreHTTPSErrors: defaultSettings.stealth,
        javaScriptEnabled: true
      };
      
      // Adicionar geolocalização se definida
      if (options.geolocation) {
        contextOptions.geolocation = options.geolocation;
      }
      
      // Criar contexto
      const context = await browser.newContext(contextOptions);
      
      // Configurar rastreamento de requisições para logging
      await context.route('**/*', async (route, request) => {
        const hostname = new URL(request.url()).hostname;
        
        // Verificar se o domínio deve ser bloqueado
        const blockedDomains = options.blockDomains || defaultSettings.blockDomains;
        if (blockedDomains && blockedDomains.some(domain => hostname.includes(domain))) {
          await route.abort();
          return;
        }
        
        // Continuar com a requisição
        await route.continue();
      });
      
      // Criar página
      const page = await context.newPage();
      
      // Se modo stealth estiver ativado, injetar scripts de evasão
      if (defaultSettings.stealth) {
        await this.injectEvasionScripts(page);
      }
      
      // Configurar handlers de eventos
      this.setupEventHandlers(page, sessionId);
      
      // Criar e armazenar a sessão
      const session: BrowserSession = {
        id: sessionId,
        createdAt: new Date(),
        lastActivity: new Date(),
        profileId,
        proxyId: options.proxyId,
        browser,
        context,
        page,
        status: 'ready',
        type: browserType,
        userAgent,
        viewportSize: options.viewport || defaultSettings.viewport,
        events: [],
        blockedDomains: options.blockDomains || defaultSettings.blockDomains || [],
        intercepts: {
          patterns: options.interceptPatterns || [],
          handlers: {}
        },
        humanBehavior: {
          typing: {
            minDelay: options.humanBehavior?.typing?.minDelay || defaultSettings.humanBehavior.typing.minDelay,
            maxDelay: options.humanBehavior?.typing?.maxDelay || defaultSettings.humanBehavior.typing.maxDelay,
            mistakeProbability: options.humanBehavior?.typing?.mistakeProbability || defaultSettings.humanBehavior.typing.mistakeProbability
          },
          mouse: {
            moveSpeed: options.humanBehavior?.mouse?.moveSpeed || defaultSettings.humanBehavior.mouse.moveSpeed,
            clickDelay: options.humanBehavior?.mouse?.clickDelay || defaultSettings.humanBehavior.mouse.clickDelay,
            naturalMovement: options.humanBehavior?.mouse?.naturalMovement !== undefined 
              ? options.humanBehavior.mouse.naturalMovement 
              : defaultSettings.humanBehavior.mouse.naturalMovement
          },
          wait: {
            minDelay: options.humanBehavior?.wait?.minDelay || defaultSettings.humanBehavior.wait.minDelay,
            maxDelay: options.humanBehavior?.wait?.maxDelay || defaultSettings.humanBehavior.wait.maxDelay
          },
          viewport: options.viewport || defaultSettings.viewport
        }
      };
      
      this.sessions.set(sessionId, session);
      this.logService.info(`Sessão ${sessionId} criada com sucesso (perfil: ${profileId}, browser: ${browserType})`);
      
      // Emitir evento de sessão criada
      this.emit('session-created', sessionId);
      
      return sessionId;
      
    } catch (error) {
      this.logService.error('Erro ao criar sessão de navegador', error);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Fecha uma sessão de navegador
   */
  public async closeSession(sessionId: string): Promise<void> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Sessão ${sessionId} não encontrada`);
      }
      
      // Fechar página, contexto e navegador
      if (session.page) {
        await session.page.close();
      }
      
      if (session.context) {
        await session.context.close();
      }
      
      if (session.browser) {
        await session.browser.close();
      }
      
      // Atualizar status da sessão
      session.status = 'closed';
      session.page = null;
      session.context = null;
      session.browser = null;
      
      this.logService.info(`Sessão ${sessionId} fechada com sucesso`);
      
      // Emitir evento de sessão fechada
      this.emit('session-closed', sessionId);
      
      // Remover da lista após algum tempo para permitir logs/consultas
      setTimeout(() => {
        this.sessions.delete(sessionId);
      }, 60000);
      
    } catch (error) {
      this.logService.error(`Erro ao fechar sessão ${sessionId}`, error);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Executar uma sequência de ações no navegador
   */
  public async executeActions(
    sessionId: string, 
    actions: BrowserAction[]
  ): Promise<ActionResult[]> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Sessão ${sessionId} não encontrada`);
      }
      
      if (!session.page) {
        throw new Error(`Sessão ${sessionId} não tem página ativa`);
      }
      
      const results: ActionResult[] = [];
      
      for (const action of actions) {
        // Atualizar timestamp de atividade
        session.lastActivity = new Date();
        
        // Espera aleatória entre ações para comportamento humano
        if (action.humanLike !== false) {
          const waitTime = this.randomInt(
            session.humanBehavior.wait.minDelay,
            session.humanBehavior.wait.maxDelay
          );
          await this.wait(waitTime);
        }
        
        // Executar ação específica
        try {
          let result: ActionResult;
          
          switch (action.type) {
            case 'navigate':
              result = await this.executeNavigate(session, action);
              break;
              
            case 'click':
              result = await this.executeClick(session, action);
              break;
              
            case 'type':
              result = await this.executeType(session, action);
              break;
              
            case 'wait':
              result = await this.executeWait(session, action);
              break;
              
            case 'screenshot':
              result = await this.executeScreenshot(session);
              break;
              
            case 'scrollTo':
              result = await this.executeScrollTo(session, action);
              break;
              
            case 'extractData':
              result = await this.executeExtractData(session, action);
              break;
              
            case 'evaluate':
              result = await this.executeEvaluate(session, action);
              break;
              
            case 'setViewport':
              result = await this.executeSetViewport(session, action);
              break;
              
            default:
              result = {
                success: false,
                error: `Tipo de ação não suportado: ${(action as any).type}`
              };
          }
          
          results.push(result);
          
          // Se falhar, parar execução
          if (!result.success) {
            break;
          }
          
        } catch (error) {
          const errorResult: ActionResult = {
            success: false,
            error: `Erro na ação ${action.type}: ${error.message}`
          };
          
          results.push(errorResult);
          break;
        }
      }
      
      return results;
      
    } catch (error) {
      this.logService.error(`Erro ao executar ações na sessão ${sessionId}`, error);
      throw error;
    }
  }
  
  /**
   * Executa uma única ação no navegador
   */
  public async executeAction(
    sessionId: string,
    action: BrowserAction
  ): Promise<ActionResult> {
    const results = await this.executeActions(sessionId, [action]);
    return results[0];
  }
  
  /**
   * Obtém capturas de tela da página atual
   */
  public async takeScreenshot(
    sessionId: string,
    options: ScreenshotOptions = {}
  ): Promise<Buffer> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Sessão ${sessionId} não encontrada`);
      }
      
      if (!session.page) {
        throw new Error(`Sessão ${sessionId} não tem página ativa`);
      }
      
      const screenshotOptions: playwright.PageScreenshotOptions = {
        fullPage: options.fullPage ?? true,
        type: options.type ?? 'jpeg',
        quality: options.type === 'jpeg' ? (options.quality ?? 90) : undefined,
        omitBackground: options.omitBackground ?? false
      };
      
      // Se caminho fornecido, garantir que diretório existe
      if (options.path) {
        const dir = path.dirname(options.path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        screenshotOptions.path = options.path;
      }
      
      const screenshot = await session.page.screenshot(screenshotOptions);
      
      // Atualizar timestamp de atividade
      session.lastActivity = new Date();
      
      return screenshot;
      
    } catch (error) {
      this.logService.error(`Erro ao capturar screenshot da sessão ${sessionId}`, error);
      throw error;
    }
  }
  
  /**
   * Obtém a lista de IDs de sessões ativas
   */
  public getActiveSessions(): string[] {
    return Array.from(this.sessions.keys()).filter(id => {
      const session = this.sessions.get(id);
      return session && session.status !== 'closed' && session.status !== 'error';
    });
  }
  
  /**
   * Obtém informações sobre uma sessão específica
   */
  public getSessionInfo(sessionId: string): Omit<BrowserSession, 'browser' | 'context' | 'page'> | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    // Retornar cópia sem referências ao browser para evitar serialização circular
    const { browser, context, page, ...info } = session;
    return info;
  }
  
  /**
   * Fecha todas as sessões de navegador
   */
  public async closeAllSessions(): Promise<void> {
    const sessionIds = this.getActiveSessions();
    
    for (const sessionId of sessionIds) {
      try {
        await this.closeSession(sessionId);
      } catch (error) {
        this.logService.error(`Erro ao fechar sessão ${sessionId}`, error);
      }
    }
  }
  
  /**
   * Configura interceptadores para monitorar requisições de rede
   */
  public async addRequestInterceptor(
    sessionId: string,
    pattern: string,
    handler: (request: any) => Promise<void>
  ): Promise<void> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Sessão ${sessionId} não encontrada`);
      }
      
      if (!session.page) {
        throw new Error(`Sessão ${sessionId} não tem página ativa`);
      }
      
      // Adicionar padrão à lista de intercepts
      const handlerId = uuidv4();
      session.intercepts.patterns.push(pattern);
      session.intercepts.handlers[handlerId] = handler;
      
      // Configurar roteamento
      await session.page.route(pattern, handler);
      
    } catch (error) {
      this.logService.error(`Erro ao adicionar interceptador para sessão ${sessionId}`, error);
      throw error;
    }
  }
  
  /**
   * Executa a navegação para uma URL
   */
  private async executeNavigate(
    session: BrowserSession,
    action: BrowserAction
  ): Promise<ActionResult> {
    if (!action.url) {
      return { success: false, error: 'URL não especificada para navegação' };
    }
    
    if (!session.page) {
      return { success: false, error: 'Página não disponível' };
    }
    
    try {
      await session.page.goto(action.url, {
        waitUntil: 'domcontentloaded',
        timeout: action.timeout || 30000
      });
      
      // Registrar evento de navegação
      session.events.push({
        type: 'navigation',
        timestamp: Date.now(),
        data: { url: action.url }
      });
      
      // Emitir evento de navegação
      this.emit('navigation', { sessionId: session.id, url: action.url });
      
      // Esperar um pouco mais para carregamento completo
      await this.wait(this.randomInt(1000, 2000));
      
      return { success: true };
    } catch (error) {
      this.logService.error(`Erro ao navegar para ${action.url}`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Executa clique em elemento ou coordenada
   */
  private async executeClick(
    session: BrowserSession,
    action: BrowserAction
  ): Promise<ActionResult> {
    if (!session.page) {
      return { success: false, error: 'Página não disponível' };
    }
    
    try {
      // Se comportamento humano estiver ativado, usar movimento natural do mouse
      if (action.humanLike !== false && session.humanBehavior.mouse.naturalMovement) {
        let targetX: number;
        let targetY: number;
        
        // Clicar em coordenadas específicas ou em elemento
        if (action.x !== undefined && action.y !== undefined) {
          targetX = action.x;
          targetY = action.y;
        } else if (action.selector) {
          // Esperar elemento estar visível
          await session.page.waitForSelector(action.selector, { 
            state: 'visible',
            timeout: action.timeout || 10000
          });
          
          // Obter posição e dimensões do elemento
          const boundingBox = await session.page.locator(action.selector).boundingBox();
          
          if (!boundingBox) {
            return { success: false, error: `Elemento não encontrado: ${action.selector}` };
          }
          
          // Definir coordenadas para o centro do elemento + pequeno offset aleatório
          const offsetX = this.randomInt(-10, 10);
          const offsetY = this.randomInt(-5, 5);
          
          targetX = boundingBox.x + boundingBox.width / 2 + offsetX;
          targetY = boundingBox.y + boundingBox.height / 2 + offsetY;
        } else {
          return { success: false, error: 'Nem coordenadas nem seletor fornecidos para clique' };
        }
        
        // Obter posição atual do mouse
        const mousePosition = await session.page.evaluate(() => {
          return { x: 0, y: 0 }; // Implementar rastreamento real da posição do mouse
        });
        
        // Mover o mouse de forma natural (curva bezier)
        await this.moveMouseNaturally(
          session.page,
          mousePosition.x,
          mousePosition.y,
          targetX,
          targetY,
          session.humanBehavior.mouse.moveSpeed
        );
        
        // Pequena pausa antes do clique
        await this.wait(session.humanBehavior.mouse.clickDelay);
        
        // Executar o clique
        await session.page.mouse.down();
        await this.wait(this.randomInt(50, 150));
        await session.page.mouse.up();
        
      } else {
        // Clique simples sem simulação de comportamento humano
        if (action.selector) {
          await session.page.click(action.selector, {
            timeout: action.timeout || 10000
          });
        } else if (action.x !== undefined && action.y !== undefined) {
          await session.page.mouse.click(action.x, action.y);
        } else {
          return { success: false, error: 'Nem coordenadas nem seletor fornecidos para clique' };
        }
      }
      
      return { success: true };
    } catch (error) {
      this.logService.error(`Erro ao executar clique`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Executa digitação em elemento
   */
  private async executeType(
    session: BrowserSession,
    action: BrowserAction
  ): Promise<ActionResult> {
    if (!session.page) {
      return { success: false, error: 'Página não disponível' };
    }
    
    if (!action.selector) {
      return { success: false, error: 'Seletor não especificado para digitação' };
    }
    
    if (!action.text) {
      return { success: false, error: 'Texto não especificado para digitação' };
    }
    
    try {
      // Esperar elemento estar visível
      await session.page.waitForSelector(action.selector, { 
        state: 'visible',
        timeout: action.timeout || 10000
      });
      
      // Clicar no elemento antes de digitar
      await session.page.click(
