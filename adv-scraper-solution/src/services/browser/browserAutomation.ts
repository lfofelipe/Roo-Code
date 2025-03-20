import * as playwright from 'playwright';
import { ConfigService } from '../configService';
import { LogService } from '../../utils/logService';
import { IdentityManager } from '../identityManager';
import { ProxyManager } from '../proxyManager';
import { BrowserFingerprint, BrowserSettings } from '../../types/context';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

/**
 * Status da sessão de navegador
 */
type BrowserSessionStatus = 'initializing' | 'ready' | 'running' | 'error' | 'closed';

/**
 * Tipo de browser suportado
 */
type BrowserType = 'chromium' | 'firefox' | 'webkit';

/**
 * Ação a ser executada
 */
export interface BrowserAction {
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
  defaultUrl?: string;
}

/**
 * Serviço principal para automação de navegador com técnicas avançadas de evasão
 */
export class BrowserAutomationService extends EventEmitter {
  private sessions: Map<string, BrowserSession> = new Map();
  private static readonly COMMON_TRACKER_DOMAINS = [
    'google-analytics.com',
    'analytics.google.com',
    'doubleclick.net',
    'googletagmanager.com',
    'hotjar.com',
    'mouseflow.com',
    'clarity.ms',
    'datadome.co',
    'imperva.com'
  ];

  constructor(
    private configService: ConfigService,
    private identityManager: IdentityManager,
    private proxyManager: ProxyManager,
    private logService: LogService
  ) {
    super();
  }
  
  /**
   * Espera um determinado tempo em milissegundos
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Gera um caractere aleatório para simular erros de digitação
   */
  private getRandomCharacter(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  /**
   * Cria uma nova sessão de navegador
   */
  public async createSession(options: CreateSessionOptions = {}): Promise<string> {
    const sessionId = uuidv4();
    
    try {
      // Configurar opções do browser
      const browserType = options.browserType || 'chromium';
      const isHeadless = options.headless !== false;
      
      // Definir perfil (identidade) para uso
      const profileId = options.profileId || await this.identityManager.createRandomProfile();
      const profile = await this.identityManager.getProfile(profileId);
      
      if (!profile) {
        throw new Error(`Perfil não encontrado: ${profileId}`);
      }
      
      // Definir proxy, se fornecido
      let proxy: any = null;
      if (options.proxyId) {
        proxy = await this.proxyManager.getProxy(options.proxyId);
        if (!proxy) {
          throw new Error(`Proxy não encontrado: ${options.proxyId}`);
        }
      }
      
      // Configurar opções do navegador
      const launchOptions: playwright.LaunchOptions = {
        headless: isHeadless,
        args: [
          '--disable-features=site-per-process',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
        ]
      };
      
      // Adicionar proxy às opções de lançamento se fornecido
      if (proxy) {
        launchOptions.proxy = {
          server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
        };
        
        if (proxy.username && proxy.password) {
          launchOptions.proxy.username = proxy.username;
          launchOptions.proxy.password = proxy.password;
        }
      }
      
      // Lançar o browser
      const browser = await playwright[browserType].launch(launchOptions);
      
      // User agent personalizado ou aleatório
      const userAgent = options.userAgent || profile.userAgent || 
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      
      // Viewport padrão ou customizada
      const viewportSize = options.viewport || { width: 1280, height: 720 };
      
      // Configurar domínios bloqueados
      const blockedDomains = [
        ...(options.blockDomains || []),
        ...BrowserAutomationService.COMMON_TRACKER_DOMAINS
      ];
      
      // Criar contexto do navegador
      const context = await browser.newContext({
        userAgent,
        viewport: viewportSize,
        locale: options.locale || 'pt-BR',
        deviceScaleFactor: 1,
        geolocation: options.geolocation,
        permissions: ['geolocation'],
        ignoreHTTPSErrors: true,
        bypassCSP: true
      });
      
      // Criar uma nova página
      const page = await context.newPage();
      
      // Configurar comportamentos humanos (padrões senão for especificado)
      const humanBehavior = {
        typing: {
          minDelay: options.humanBehavior?.typing?.minDelay || 50,
          maxDelay: options.humanBehavior?.typing?.maxDelay || 150,
          mistakeProbability: options.humanBehavior?.typing?.mistakeProbability || 0.03
        },
        mouse: {
          moveSpeed: options.humanBehavior?.mouse?.moveSpeed || 10,
          clickDelay: options.humanBehavior?.mouse?.clickDelay || 150,
          naturalMovement: options.humanBehavior?.mouse?.naturalMovement !== false
        },
        wait: {
          minDelay: options.humanBehavior?.wait?.minDelay || 500,
          maxDelay: options.humanBehavior?.wait?.maxDelay || 3000
        },
        viewport: viewportSize
      };
      
      // Criar objeto de sessão
      const session: BrowserSession = {
        id: sessionId,
        createdAt: new Date(),
        lastActivity: new Date(),
        profileId: profile.id,
        proxyId: proxy?.id,
        browser,
        context,
        page,
        status: 'initializing',
        type: browserType as BrowserType,
        userAgent,
        viewportSize,
        events: [],
        blockedDomains,
        intercepts: {
          patterns: options.interceptPatterns || [],
          handlers: {}
        },
        humanBehavior
      };
      
      // Adicionar ao mapa de sessões
      this.sessions.set(sessionId, session);
      
      // Navegar para URL inicial se fornecida
      if (options.defaultUrl) {
        await page.goto(options.defaultUrl, { waitUntil: 'domcontentloaded' });
      }
      
      // Atualizar status da sessão
      session.status = 'ready';
      
      return sessionId;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      this.logService.error(`Erro ao criar sessão de navegador: ${errorMessage}`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Fecha uma sessão de navegador
   */
  public async closeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    try {
      // Fechar página, contexto e browser
      if (session.page && !session.page.isClosed()) {
        await session.page.close();
      }
      
      if (session.context) {
        await session.context.close();
      }
      
      if (session.browser) {
        await session.browser.close();
      }
      
      // Remover do mapa de sessões
      this.sessions.delete(sessionId);
      
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logService.error(`Erro ao fechar sessão de navegador: ${errorMessage}`, error);
      return false;
    }
  }

  /**
   * Obtém informações sobre uma sessão
   */
  public getSessionInfo(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    return {
      id: session.id,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      profileId: session.profileId,
      proxyId: session.proxyId,
      status: session.status,
      type: session.type,
      userAgent: session.userAgent,
      viewportSize: session.viewportSize,
      url: session.page?.url(),
      eventCount: session.events.length
    };
  }

  /**
   * Lista todas as sessões ativas
   */
  public listSessions(): any[] {
    const sessions = [];
    
    for (const [id, session] of this.sessions.entries()) {
      sessions.push({
        id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        status: session.status,
        type: session.type,
        url: session.page?.url()
      });
    }
    
    return sessions;
  }
  
  /**
   * Executa uma ação na página
   */
  public async executeAction(
    sessionId: string,
    action: BrowserAction
  ): Promise<ActionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: `Sessão não encontrada: ${sessionId}` };
    }
    
    if (!session.page) {
      return { success: false, error: 'Página não inicializada na sessão' };
    }
    
    // Atualizar última atividade
    session.lastActivity = new Date();
    session.status = 'running';
    
    try {
      let result: any = null;
      
      // Executar a ação com base no tipo
      switch (action.type) {
        case 'navigate':
          if (!action.url) {
            throw new Error('URL não fornecida para navegação');
          }
          
          // Aplicar comportamento humano - esperar um pouco antes de navegar
          if (action.humanLike) {
            const delay = Math.random() * 
              (session.humanBehavior.wait.maxDelay - session.humanBehavior.wait.minDelay) + 
              session.humanBehavior.wait.minDelay;
            await this.wait(delay);
          }
          
          // Navegar para a URL
          await session.page.goto(action.url, { 
            waitUntil: 'domcontentloaded',
            timeout: action.timeout || 30000
          });
          
          result = { url: action.url };
          break;
          
        case 'click':
          if (!action.selector) {
            throw new Error('Seletor não fornecido para clique');
          }
          
          // Verificar se o elemento existe
          const element = await session.page.$(action.selector);
          if (!element) {
            throw new Error(`Elemento não encontrado: ${action.selector}`);
          }
          
          // Clique humanizado
          if (action.humanLike) {
            // Rolar até o elemento ficar visível
            await element.scrollIntoViewIfNeeded();
            
            // Mover o mouse naturalmente para o elemento
            await session.page.hover(action.selector, { 
              force: false,
              timeout: action.timeout || 5000
            });
            
            // Pequena pausa antes de clicar
            await this.wait(session.humanBehavior.mouse.clickDelay);
          }
          
          // Clicar no elemento
          await session.page.click(action.selector, { 
            force: !action.humanLike,
            timeout: action.timeout || 5000
          });
          
          result = { selector: action.selector };
          break;
          
        case 'type':
          if (!action.selector) {
            throw new Error('Seletor não fornecido para digitação');
          }
          
          if (!action.text) {
            throw new Error('Texto não fornecido para digitação');
          }
          
          // Focar no elemento
          await session.page.focus(action.selector);
          
          // Digitação humanizada
          if (action.humanLike) {
            // Digitar caractere por caractere com atrasos variados
            for (let i = 0; i < action.text.length; i++) {
              // Possibilidade de erro de digitação
              if (Math.random() < session.humanBehavior.typing.mistakeProbability && i > 0) {
                // Digitar caractere errado
                await session.page.keyboard.press(this.getRandomCharacter());
                await this.wait(300); // Pequena pausa
                // Apagar o erro
                await session.page.keyboard.press('Backspace');
                await this.wait(250);
              }
              
              // Digitar o caractere correto
              await session.page.keyboard.press(action.text[i]);
              
              // Pausa variável entre digitações
              const delay = Math.random() * 
                (session.humanBehavior.typing.maxDelay - session.humanBehavior.typing.minDelay) + 
                session.humanBehavior.typing.minDelay;
              await this.wait(delay);
            }
          } else {
            // Digitação rápida (não humana)
            await session.page.fill(action.selector, action.text);
          }
          
          result = { selector: action.selector, text: action.text };
          break;
          
        case 'wait':
          const timeout = action.timeout || 1000;
          await this.wait(timeout);
          result = { waited: timeout };
          break;
          
        case 'screenshot':
          const screenshot = await session.page.screenshot({
            fullPage: true,
            type: 'jpeg',
            quality: 80
          });
          
          // Converter para base64
          const base64Screenshot = screenshot.toString('base64');
          return {
            success: true,
            data: { timestamp: new Date().toISOString() },
            screenshot: `data:image/jpeg;base64,${base64Screenshot}`
          };
          
        case 'scrollTo':
          if (action.x !== undefined && action.y !== undefined) {
            await session.page.evaluate(
              ({ x, y }) => window.scrollTo(x, y),
              { x: action.x, y: action.y }
            );
            result = { x: action.x, y: action.y };
          } else {
            throw new Error('Coordenadas x e y não fornecidas para rolagem');
          }
          break;
          
        case 'extractData':
          if (!action.selector) {
            throw new Error('Seletor não fornecido para extração de dados');
          }
          
          result = await session.page.$$eval(action.selector, elements => 
            elements.map(el => ({
              text: el.textContent?.trim() || '',
              html: el.innerHTML,
              attributes: Array.from(el.attributes).reduce((acc, attr) => {
                acc[attr.name] = attr.value;
                return acc;
              }, {} as Record<string, string>)
            }))
          );
          break;
          
        case 'evaluate':
          if (!action.function) {
            throw new Error('Função não fornecida para avaliação');
          }
          
          // Executar código JavaScript na página
          result = await session.page.evaluate(action.function);
          break;
          
        case 'setViewport':
          if (!action.width || !action.height) {
            throw new Error('Dimensões não fornecidas para redimensionamento da viewport');
          }
          
          await session.page.setViewportSize({ 
            width: action.width, 
            height: action.height 
          });
          
          // Atualizar as dimensões armazenadas na sessão
          session.viewportSize = { 
            width: action.width, 
            height: action.height 
          };
          session.humanBehavior.viewport = session.viewportSize;
          
          result = { width: action.width, height: action.height };
          break;
          
        default:
          throw new Error(`Tipo de ação não suportado: ${action.type}`);
      }
      
      // Registrar o evento de ação
      session.events.push({
        type: 'navigation',
        timestamp: Date.now(),
        data: { action, result }
      });
      
      // Atualizar status
      session.status = 'ready';
      
      // Tirar um screenshot após a ação (opcional, apenas se solicitado)
      let screenshot = null;
      
      return { 
        success: true,
        data: result
      };
    } catch (error: unknown) {
      session.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logService.error(`Erro ao executar ação: ${errorMessage}`, error);
      return { success: false, error: errorMessage };
    }
  }
  
  /**
   * Destruir todas as sessões e limpar recursos
   */
  public async destroy(): Promise<void> {
    for (const sessionId of this.sessions.keys()) {
      await this.closeSession(sessionId);
    }
    
    this.sessions.clear();
    this.removeAllListeners();
  }
}
