import { v4 as uuidv4 } from 'uuid';
import { BrowserFingerprint } from '../types/context';
import { ConfigService, ProfileConfig } from './configService';
import { SecureStorageService } from './secureStorage';
import { LogService } from '../utils/logService';
import { EventEmitter } from 'events';

/**
 * Interface para representar uma identidade digital completa
 */
export interface DigitalIdentity {
  id: string;
  name: string;
  fingerprint: BrowserFingerprint;
  userAgent: string;
  platform: string;
  language: string[];
  timezone: string;
  geoLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  cookiesEnabled: boolean;
  doNotTrack: boolean;
  colorDepth: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  createdAt: Date;
  lastUsed?: Date;
  useCount: number;
  cookies?: string[];
  localStorage?: Record<string, string>;
  behaviorProfile?: BehaviorProfile;
}

/**
 * Interface para configurar a criação de uma identidade
 */
export interface IdentityOptions {
  browserType?: 'chromium' | 'firefox' | 'webkit';
  osType?: 'windows' | 'macos' | 'linux' | 'android' | 'ios';
  osVersion?: string;
  browserVersion?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  locale?: string;
  countryCode?: string;
  useProxy?: boolean;
  proxyCountry?: string;
}

/**
 * Interface para representar um padrão de comportamento de navegação
 */
export interface BehaviorProfile {
  typingSpeed: {
    mean: number;   // Média de milissegundos entre teclas
    variance: number; // Variância para simular padrões humanos
  };
  mouseMovement: {
    speed: number;  // Velocidade média de movimento em pixels/s
    precision: number; // Precisão do movimento (0-1)
    jerky: number;  // Quão irregular é o movimento (0-1)
  };
  navigationPatterns: {
    scrollSpeed: number; // Velocidade de rolagem em pixels/s
    scrollVariance: number; // Variância na velocidade de rolagem
    dwellTime: number;   // Tempo médio em uma página em milissegundos
    readingPause: boolean; // Se faz pausas para "ler" o conteúdo
  };
  interactionPatterns: {
    clickAccuracy: number; // Precisão do clique (0-1)
    doubleClickProbability: number; // Probabilidade de duplo clique (0-1)
    rightClickProbability: number;  // Probabilidade de clique direito (0-1)
    errorClickProbability: number;  // Probabilidade de erro de clique (0-1) 
  };
}

/**
 * Serviço para gerenciamento de identidades digitais
 */
export class IdentityManager extends EventEmitter {
  private identities: Map<string, DigitalIdentity> = new Map();
  private activeIdentities: Map<string, string> = new Map(); // sessionId -> identityId
  private readonly userAgentDatabase: string[] = [];
  
  // Eventos emitidos pelo gerenciador
  static readonly EVENT_IDENTITY_CREATED = 'identity-created';
  static readonly EVENT_IDENTITY_ROTATED = 'identity-rotated';
  static readonly EVENT_IDENTITY_UPDATED = 'identity-updated';
  
  constructor(
    private configService: ConfigService,
    private secureStorage: SecureStorageService,
    private logService: LogService
  ) {
    super();
    
    // Inicializar
    this.initialize();
  }
  
  /**
   * Inicializa o gerenciador de identidades
   */
  private async initialize(): Promise<void> {
    try {
      // Carregar identidades salvas
      await this.loadSavedIdentities();
      
      // Inicializar banco de dados de user agents
      this.initializeUserAgentDatabase();
      
      this.logService.info('IdentityManager inicializado com sucesso');
    } catch (error) {
      this.logService.error('Erro ao inicializar IdentityManager', error);
    }
  }
  
  /**
   * Carrega identidades salvas do armazenamento
   */
  private async loadSavedIdentities(): Promise<void> {
    try {
      // Carregar perfis do serviço de configuração
      const profiles = await this.configService.getProfiles();
      
      for (const profile of profiles) {
        try {
          // Converter perfil salvo para identidade digital
          const identity = await this.profileToIdentity(profile);
          this.identities.set(identity.id, identity);
        } catch (profileError) {
          this.logService.warn(`Erro ao carregar perfil ${profile.id}: ${profileError.message}`);
        }
      }
      
      this.logService.info(`Carregadas ${this.identities.size} identidades salvas`);
    } catch (error) {
      this.logService.error('Erro ao carregar identidades salvas', error);
      throw error;
    }
  }
  
  /**
   * Converte um perfil salvo em uma identidade digital
   */
  private async profileToIdentity(profile: ProfileConfig): Promise<DigitalIdentity> {
    // Obter cookies salvos para este perfil, se houver
    let cookies: string[] | undefined;
    let localStorage: Record<string, string> | undefined;
    
    try {
      const cookiesJson = await this.secureStorage.getCookies(profile.id);
      if (cookiesJson) {
        cookies = JSON.parse(cookiesJson);
      }
      
      if (profile.localStorage) {
        localStorage = JSON.parse(profile.localStorage);
      }
    } catch (error) {
      this.logService.warn(`Erro ao carregar cookies/localStorage para perfil ${profile.id}`, error);
    }
    
    return {
      id: profile.id,
      name: profile.name,
      fingerprint: profile.fingerprint,
      userAgent: profile.userAgent,
      platform: profile.fingerprint.platform,
      language: profile.fingerprint.languages,
      timezone: profile.fingerprint.timezone,
      colorDepth: profile.fingerprint.screenResolution.pixelRatio * 24,
      deviceMemory: profile.fingerprint.deviceMemory,
      hardwareConcurrency: profile.fingerprint.hardwareConcurrency,
      cookiesEnabled: true,
      doNotTrack: profile.fingerprint.doNotTrack || false,
      createdAt: new Date(), // Data real seria carregada do perfil
      useCount: 0,
      cookies,
      localStorage
    };
  }
  
  /**
   * Inicializa o banco de dados de user agents
   */
  private initializeUserAgentDatabase(): void {
    // User agents comuns de 2025 
    // Windows 11 + Chrome
    this.userAgentDatabase.push(
      'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    
    // Windows 11 + Firefox
    this.userAgentDatabase.push(
      'Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0',
      'Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
      'Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'
    );
    
    // Windows 11 + Edge
    this.userAgentDatabase.push(
      'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
      'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'
    );
    
    // macOS + Safari
    this.userAgentDatabase.push(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/616.1.15 (KHTML, like Gecko) Version/18.3 Safari/616.1.15',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/616.2.1 (KHTML, like Gecko) Version/18.4 Safari/616.2.1'
    );
    
    // macOS + Chrome
    this.userAgentDatabase.push(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    
    // Android + Chrome
    this.userAgentDatabase.push(
      'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
    );
    
    // iOS + Safari
    this.userAgentDatabase.push(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/616.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/616.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/616.2.1 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/616.2.1'
    );
    
    this.logService.info(`Banco de dados de user agents inicializado com ${this.userAgentDatabase.length} entradas`);
  }
  
  /**
   * Obtém um user agent aleatório do banco de dados
   */
  private getRandomUserAgent(options?: IdentityOptions): string {
    let filteredAgents = [...this.userAgentDatabase];
    
    // Filtrar por sistema operacional se solicitado
    if (options?.osType) {
      switch (options.osType) {
        case 'windows':
          filteredAgents = filteredAgents.filter(ua => ua.includes('Windows'));
          break;
        case 'macos':
          filteredAgents = filteredAgents.filter(ua => ua.includes('Macintosh'));
          break;
        case 'linux':
          filteredAgents = filteredAgents.filter(ua => ua.includes('Linux') && !ua.includes('Android'));
          break;
        case 'android':
          filteredAgents = filteredAgents.filter(ua => ua.includes('Android'));
          break;
        case 'ios':
          filteredAgents = filteredAgents.filter(ua => ua.includes('iPhone') || ua.includes('iPad'));
          break;
      }
    }
    
    // Filtrar por navegador se solicitado
    if (options?.browserType) {
      switch (options.browserType) {
        case 'chromium':
          filteredAgents = filteredAgents.filter(ua => 
            ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('Firefox') && !ua.includes('Safari/6')
          );
          break;
        case 'firefox':
          filteredAgents = filteredAgents.filter(ua => ua.includes('Firefox'));
          break;
        case 'webkit':
          filteredAgents = filteredAgents.filter(ua => 
            (ua.includes('Safari/6') || ua.includes('Mobile Safari')) && !ua.includes('Chrome')
          );
          break;
      }
    }
    
    // Filtrar por tipo de dispositivo se solicitado
    if (options?.deviceType) {
      switch (options.deviceType) {
        case 'mobile':
          filteredAgents = filteredAgents.filter(ua => 
            ua.includes('Mobile') || ua.includes('iPhone')
          );
          break;
        case 'desktop':
          filteredAgents = filteredAgents.filter(ua => 
            !ua.includes('Mobile') && !ua.includes('iPhone') && !ua.includes('iPad')
          );
          break;
        case 'tablet':
          filteredAgents = filteredAgents.filter(ua => ua.includes('iPad'));
          break;
      }
    }
    
    // Se após os filtros não sobrou nenhum user agent, usar a lista completa
    if (filteredAgents.length === 0) {
      filteredAgents = [...this.userAgentDatabase];
    }
    
    // Selecionar aleatoriamente
    const randomIndex = Math.floor(Math.random() * filteredAgents.length);
    return filteredAgents[randomIndex];
  }
  
  /**
   * Cria uma nova identidade digital
   */
  public async createIdentity(options?: IdentityOptions): Promise<DigitalIdentity> {
    try {
      const id = uuidv4();
      const name = options?.browserType 
        ? `${options.browserType.charAt(0).toUpperCase() + options.browserType.slice(1)} Profile`
        : `Profile ${this.identities.size + 1}`;
      
      // Selecionar user agent
      const userAgent = this.getRandomUserAgent(options);
      
      // Determinar plataforma com base no user agent
      let platform = 'Win32';
      if (userAgent.includes('Macintosh')) {
        platform = 'MacIntel';
      } else if (userAgent.includes('Android')) {
        platform = 'Linux armv8l';
      } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        platform = 'iPhone';
      } else if (userAgent.includes('Linux') && !userAgent.includes('Android')) {
        platform = 'Linux x86_64';
      }
      
      // Gerar dados de fingerprint aleatórios mas realistas
      const fingerprint: BrowserFingerprint = {
        userAgent,
        platform,
        screenResolution: this.generateScreenResolution(options?.deviceType),
        languages: [options?.locale || 'pt-BR', 'en-US'],
        timezone: options?.countryCode === 'BR' ? 'America/Sao_Paulo' : 'America/New_York',
        plugins: this.generatePlugins(userAgent),
        fonts: this.generateFonts(platform),
        webGLVendor: this.generateWebGLVendor(platform),
        webGLRenderer: this.generateWebGLRenderer(platform),
        doNotTrack: Math.random() > 0.8, // 20% chance de ter Do Not Track ativado
        hardwareConcurrency: this.generateHardwareConcurrency(),
        deviceMemory: this.generateDeviceMemory()
      };
      
      // Gerar comportamento padrão
      const behaviorProfile = this.generateBehaviorProfile();
      
      // Criar identidade
      const identity: DigitalIdentity = {
        id,
        name,
        fingerprint,
        userAgent,
        platform,
        language: fingerprint.languages,
        timezone: fingerprint.timezone,
        cookiesEnabled: true,
        doNotTrack: fingerprint.doNotTrack || false,
        colorDepth: fingerprint.screenResolution.pixelRatio * 24,
        deviceMemory: fingerprint.deviceMemory,
        hardwareConcurrency: fingerprint.hardwareConcurrency,
        createdAt: new Date(),
        useCount: 0,
        behaviorProfile
      };
      
      // Persistir a identidade
      this.identities.set(id, identity);
      await this.saveIdentity(identity);
      
      this.logService.info(`Nova identidade criada: ${name} (${id})`);
      this.emit(IdentityManager.EVENT_IDENTITY_CREATED, identity);
      
      return identity;
    } catch (error) {
      this.logService.error('Erro ao criar identidade', error);
      throw error;
    }
  }
  
  /**
   * Salva uma identidade na configuração persistente
   */
  private async saveIdentity(identity: DigitalIdentity): Promise<void> {
    try {
      // Converter identidade para perfil
      const profile: ProfileConfig = {
        id: identity.id,
        name: identity.name,
        description: `Perfil criado em ${identity.createdAt.toLocaleString()}`,
        browserType: this.getBrowserTypeFromUserAgent(identity.userAgent),
        userAgent: identity.userAgent,
        fingerprint: identity.fingerprint,
        localStorage: identity.localStorage ? JSON.stringify(identity.localStorage) : undefined
      };
      
      // Salvar perfil
      await this.configService.addProfile(profile);
      
      // Salvar cookies se houver
      if (identity.cookies && identity.cookies.length > 0) {
        await this.secureStorage.storeCookies(identity.id, JSON.stringify(identity.cookies));
      }
    } catch (error) {
      this.logService.error(`Erro ao salvar identidade ${identity.id}`, error);
      throw error;
    }
  }
  
  /**
   * Obtém o tipo de navegador a partir do user agent
   */
  private getBrowserTypeFromUserAgent(userAgent: string): 'chromium' | 'firefox' | 'webkit' {
    if (userAgent.includes('Firefox')) {
      return 'firefox';
    } else if (userAgent.includes('Chrome') && !userAgent.includes('Safari/6')) {
      return 'chromium';
    } else {
      return 'webkit';
    }
  }
  
  /**
   * Gera uma resolução de tela com base no tipo de dispositivo
   */
  private generateScreenResolution(deviceType?: 'desktop' | 'mobile' | 'tablet'): { width: number; height: number; pixelRatio: number } {
    switch (deviceType) {
      case 'mobile':
        return {
          width: 375 + Math.floor(Math.random() * 100),
          height: 667 + Math.floor(Math.random() * 200),
          pixelRatio: 2 + Math.random()
        };
        
      case 'tablet':
        return {
          width: 768 + Math.floor(Math.random() * 100),
          height: 1024 + Math.floor(Math.random() * 100),
          pixelRatio: 2 + Math.random() * 0.5
        };
        
      case 'desktop':
      default:
        // Resoluções comuns para desktop
        const resolutions = [
          { width: 1366, height: 768 },
          { width: 1440, height: 900 },
          { width: 1536, height: 864 },
          { width: 1600, height: 900 },
          { width: 1920, height: 1080 },
          { width: 2560, height: 1440 },
          { width: 3840, height: 2160 } // 4K
        ];
        
        const selected = resolutions[Math.floor(Math.random() * resolutions.length)];
        return {
          ...selected,
          pixelRatio: 1 + Math.random()
        };
    }
  }
  
  /**
   * Gera uma lista realista de plugins de navegador
   */
  private generatePlugins(userAgent: string): { name: string; description: string }[] {
    const plugins: { name: string; description: string }[] = [];
    
    // Plugins comuns em 2025
    const possiblePlugins = [
      { name: 'Chrome PDF Plugin', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', description: 'Chrome PDF Viewer' },
      { name: 'Native Client', description: 'Native Client Executable' },
      { name: 'AirPods Extension', description: 'AirPods Integration for Browser' },
      { name: 'AI Assistant', description: 'Browser AI Helper' },
      { name: 'WebAuthn API', description: 'Web Authentication' }
    ];
    
    // Se for Firefox, não adicionar plugins do Chrome
    if (userAgent.includes('Firefox')) {
      return [];
    }
    
    // Se for Safari, adicionar poucos plugins
    if ((userAgent.includes('Safari') && !userAgent.includes('Chrome')) || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      return [possiblePlugins[3], possiblePlugins[5]];
    }
    
    // Para Chrome/Chromium, adicionar número aleatório de plugins
    const pluginCount = 2 + Math.floor(Math.random() * 4); // 2-5 plugins
    
    // Selecionar plugins aleatoriamente
    const shuffled = [...possiblePlugins].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, pluginCount);
  }
  
  /**
   * Gera uma lista realista de fontes com base na plataforma
   */
  private generateFonts(platform: string): string[] {
    const commonFonts = ['Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Courier New'];
    
    if (platform.includes('Win')) {
      return [
        ...commonFonts,
        'Segoe UI', 'Calibri', 'Cambria', 'Consolas', 'Tahoma', 'Trebuchet MS'
      ];
    } else if (platform.includes('Mac')) {
      return [
        ...commonFonts,
        'SF Pro', 'Helvetica Neue', 'Lucida Grande', 'Menlo', 'Monaco', 'San Francisco'
      ];
    } else if (platform.includes('Linux')) {
      return [
        ...commonFonts,
        'Ubuntu', 'DejaVu Sans', 'Liberation Sans', 'Noto Sans', 'Droid Sans'
      ];
    } else if (platform.includes('iPhone')) {
      return [
        ...commonFonts,
        'SF Pro', 'Helvetica Neue', 'San Francisco'
      ];
    }
    
    return commonFonts;
  }
  
  /**
   * Gera informação realista de WebGL vendor
   */
  private generateWebGLVendor(platform: string): string {
    if (platform.includes('Win')) {
      const vendors = [
        'Google Inc. (NVIDIA)',
        'Google Inc. (Intel)',
        'Google Inc. (AMD)',
        'Google Inc. (Microsoft)'
      ];
      return vendors[Math.floor(Math.random() * vendors.length)];
    } else if (platform.includes('Mac')) {
      return 'Apple Inc.';
    } else if (platform.includes('Linux')) {
      const vendors = [
        'Google Inc.',
        'Mesa/X.org',
        'NVIDIA Corporation'
      ];
      return vendors[Math.floor(Math.random() * vendors.length)];
    } else if (platform.includes('iPhone') || platform.includes('iPad')) {
      return 'Apple Inc.';
    }
    
    return 'Google Inc.';
  }
  
  /**
   * Gera informação realista de WebGL renderer
   */
  private generateWebGLRenderer(platform: string): string {
    if (platform.includes('Win')) {
      const renderers = [
        'ANGLE (NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0)',
        'ANGLE (Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0)',
        'ANGLE (AMD Radeon RX 7900 XT Direct3D11 vs_5_0)',
        'ANGLE (Microsoft Basic Render Driver Direct3D11 vs_5_0)'
      ];
      return renderers[Math.floor(Math.random() * renderers.length)];
    } else if (platform.includes('Mac')) {
      const renderers = [
        'Apple GPU',
        'Apple M3 Pro',
        'Apple M3 Max',
        'AMD Radeon Pro 6900X'
      ];
      return renderers[Math.floor(Math.random() * renderers.length)];
    } else if (platform.includes('Linux')) {
      const renderers = [
        'Mesa DRI Intel(R) UHD Graphics (TGL GT2)',
        'Mesa DRI NVIDIA GeForce',
        'Mesa DRI AMD Radeon'
      ];
      return renderers[Math.floor(Math.random() * renderers.length)];
    } else if (platform.includes('iPhone') || platform.includes('iPad')) {
      return 'Apple GPU';
    }
    
    return 'ANGLE (Unknown)';
  }
  
  /**
   * Gera valor realista para hardwareConcurrency
   */
  private generateHardwareConcurrency(): number {
    // Em 2025, a maioria dos dispositivos tem entre 4 e 32 núcleos
    const values = [4, 6, 8, 10, 12, 16, 24, 32];
    return values[Math.floor(Math.random() * values.length)];
  }
  
  /**
   * Gera valor realista para deviceMemory
   */
  private generateDeviceMemory(): number {
    // Em 2025, a memória varia de 4 a 32 GB
    const values = [4, 8, 16, 32];
    return values[Math.floor(Math.random() * values.length)];
  }
  
  /**
   * Gera um perfil de comportamento humano
   */
  private generateBehaviorProfile(): BehaviorProfile {
    return {
      typingSpeed: {
        mean: 100 + Math.random() * 150, // 100-250ms entre teclas
        variance: 20 + Math.random() * 40  // 20-60ms de variância
      },
      mouseMovement: {
        speed: 500 + Math.random() * 1000, // 500-1500 pixels/segundo
        precision: 0.7 + Math.random() * 0.3, // 70-100% de precisão
        jerky: Math.random() * 0.3 // 0-30% de irregularidade
      },
      navigationPatterns: {
        scrollSpeed: 300 + Math.random() * 700, // 300-1000 pixels/segundo
        scrollVariance: 50 + Math.random() * 100, // 50-150 pixels de variância
        dwellTime: 2000 + Math.random() * 8000, // 2-10 segundos de pausa
        readingPause: Math.random() > 0.3 // 70% de chance de pausar para "ler"
      },
      interactionPatterns: {
        clickAccuracy: 0.8 + Math.random() * 0.2, // 80-100% de precisão no clique
        doubleClickProbability: Math.random() * 0.1, // 0-10% chance de duplo clique
        rightClickProbability: Math.random() * 0.05, // 0-5% chance de clique direito
        errorClickProbability: Math.random() * 0.1 // 0-10% chance de clique errado
      }
    };
  }
  
  /**
   * Obtém uma identidade para usar em uma sessão
   */
  public async getIdentity(
    sessionId: string,
    options?: {
      browserType?: 'chromium' | 'firefox' | 'webkit';
      deviceType?: 'desktop' | 'mobile' | 'tablet';
      country?: string;
    }
  ): Promise<DigitalIdentity> {
    // Verificar se já há uma identidade associada à sessão
    const existingIdentityId = this.activeIdentities.get(sessionId);
    if (existingIdentityId) {
      const existingIdentity = this.identities.get(existingIdentityId);
      if (existingIdentity) {
        existingIdentity.useCount++;
        existingIdentity.lastUsed = new Date();
        this.identities.set(existingIdentityId, existingIdentity);
        return existingIdentity;
      }
    }
    
    // Filtrar identidades disponíveis com base nas opções
    let availableIdentities = Array.from(this.identities.values());
    
    if (options?.browserType) {
      availableIdentities = availableIdentities.filter(identity => {
        const browserType = this.getBrowserTypeFromUserAgent(identity.userAgent);
        return browserType === options.browserType;
      });
    }
    
    if (options?.deviceType) {
      availableIdentities = availableIdentities.filter(identity => {
        const userAgent = identity.userAgent.toLowerCase();
        
        if (options.deviceType === 'mobile') {
          return userAgent.includes('mobile') || userAgent.includes('iphone');
        } else if (options.deviceType === 'tablet') {
          return userAgent.includes('ipad') || (userAgent.includes('android') && !userAgent.includes('mobile'));
        } else { // desktop
          return !userAgent.includes('mobile') && !userAgent.includes('ipad');
        }
      });
    }
    
    // Se não houver identidades disponíveis após os filtros, criar uma nova
    if (availableIdentities.length === 0) {
      const identityOptions: IdentityOptions = {
        browserType: options?.browserType,
        deviceType: options?.deviceType,
        countryCode: options?.country
      };
      
      const newIdentity = await this.createIdentity(identityOptions);
      availableIdentities = [newIdentity];
    }
    
    // Selecionar uma identidade aleatória das disponíveis
    const selectedIdentity = availableIdentities[Math.floor(Math.random() * availableIdentities.length)];
    
    // Associar a identidade à sessão
    this.activeIdentities.set(sessionId, selectedIdentity.id);
    
    // Atualizar estatísticas
    selectedIdentity.useCount++;
    selectedIdentity.lastUsed = new Date();
    this.identities.set(selectedIdentity.id, selectedIdentity);
    
    this.logService.debug(`Identidade ${selectedIdentity.name} (${selectedIdentity.id}) alocada para sessão ${sessionId}`);
    
    return selectedIdentity;
  }
  
  /**
   * Rotaciona a identidade de uma sessão
   */
  public async rotateIdentity(
    sessionId: string,
    options?: {
      browserType?: 'chromium' | 'firefox' | 'webkit';
      deviceType?: 'desktop' | 'mobile' | 'tablet';
      country?: string;
    }
  ): Promise<DigitalIdentity> {
    // Remover associação atual, se houver
    this.activeIdentities.delete(sessionId);
    
    // Obter nova identidade
    const identity = await this.getIdentity(sessionId, options);
    
    this.emit(IdentityManager.EVENT_IDENTITY_ROTATED, { sessionId, identity });
    this.logService.info(`Identidade rotacionada para sessão ${sessionId}: ${identity.name} (${identity.id})`);
    
    return identity;
  }
  
  /**
   * Atualiza os cookies armazenados para uma identidade
   */
  public async updateCookies(identityId: string, cookies: string[]): Promise<void> {
    const identity = this.identities.get(identityId);
    if (!identity) {
      throw new Error(`Identidade ${identityId} não encontrada`);
    }
    
    identity.cookies = cookies;
    
    // Persistir cookies
    await this.secureStorage.storeCookies(identityId, JSON.stringify(cookies));
    
    this.identities.set(identityId, identity);
    this.emit(IdentityManager.EVENT_IDENTITY_UPDATED, identity);
    
    this.logService.debug(`Cookies atualizados para identidade ${identityId}`);
  }
  
  /**
   * Atualiza o localStorage para uma identidade
   */
  public async updateLocalStorage(identityId: string, localStorage: Record<string, string>): Promise<void> {
    const identity = this.identities.get(identityId);
    if (!identity) {
      throw new Error(`Identidade ${identityId} não encontrada`);
    }
    
    identity.localStorage = localStorage;
    
    // Atualizar perfil
    const profile = await this.configService.getProfile(identityId);
    if (profile) {
      profile.localStorage = JSON.stringify(localStorage);
      await this.configService.addProfile(profile);
    }
    
    this.identities.set(identityId, identity);
    this.emit(IdentityManager.EVENT_IDENTITY_UPDATED, identity);
    
    this.logService.debug(`LocalStorage atualizado para identidade ${identityId}`);
  }
  
  /**
   * Libera uma identidade associada a uma sessão
   */
  public releaseIdentity(sessionId: string): void {
    this.activeIdentities.delete(sessionId);
    this.logService.debug(`Identidade liberada para sessão ${sessionId}`);
  }
  
  /**
   * Remove uma identidade
   */
  public async removeIdentity(identityId: string): Promise<boolean> {
    const identity = this.identities.get(identityId);
    if (!identity) {
      return false;
    }
    
    // Remover de todas as sessões ativas
    for (const [sessionId, id] of this.activeIdentities.entries()) {
      if (id === identityId) {
        this.activeIdentities.delete(sessionId);
      }
    }
    
    // Remover da persistência
    await this.configService.removeProfile(identityId);
    
    // Remover cookies
    await this.secureStorage.clear('cookieStore');
    
    this.identities.delete(identityId);
    
    this.logService.info(`Identidade ${identity.name} (${identityId}) removida`);
    
    return true;
  }
  
  /**
   * Obtém todas as identidades
   */
  public getAllIdentities(): DigitalIdentity[] {
    return Array.from(this.identities.values());
  }
  
  /**
   * Obtém uma identidade específica pelo ID
   */
  public getIdentityById(identityId: string): DigitalIdentity | null {
    return this.identities.get(identityId) || null;
  }
  
  /**
   * Finaliza recursos ao desativar a extensão
   */
  public dispose(): void {
    this.removeAllListeners();
    this.logService.info('IdentityManager: recursos liberados');
  }
}
