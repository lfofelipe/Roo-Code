import { ProxySettings } from '../types/context';
import { ConfigService } from './configService';
import { SecureStorageService } from './secureStorage';
import { LogService } from '../utils/logService';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import * as ProxyChain from 'proxy-chain';
import axios from 'axios';
import { EventEmitter } from 'events';

/**
 * Interface para representar um proxy com metadados adicionais
 */
export interface ProxyInfo {
  id: string;
  url: string;
  type: 'residential' | 'datacenter' | 'mobile' | 'custom';
  country?: string;
  city?: string;
  provider: string;
  username?: string;
  password?: string;
  lastUsed?: Date;
  successCount: number;
  failureCount: number;
  responseTime: number;
  isActive: boolean;
  sessions: number;
}

/**
 * Interface para pool de proxies
 */
export interface ProxyPool {
  id: string;
  name: string;
  proxies: ProxyInfo[];
  strategy: 'round-robin' | 'random' | 'smart' | 'sticky';
  rotationInterval?: number;
  lastRotation?: Date;
}

/**
 * Interface para resultado de teste de proxy
 */
export interface ProxyTestResult {
  proxy: ProxyInfo;
  success: boolean;
  responseTime: number;
  error?: string;
  externalIp?: string;
  country?: string;
}

/**
 * Serviço para gerenciamento de proxies
 */
export class ProxyManager extends EventEmitter {
  private proxies: Map<string, ProxyInfo> = new Map();
  private pools: Map<string, ProxyPool> = new Map();
  private proxyServers: Map<string, ProxyChain.Server> = new Map();
  private activeProxies: Map<string, string> = new Map(); // sessionId -> proxyId
  private rotationTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Eventos emitidos pelo gerenciador
  static readonly EVENT_PROXY_ROTATED = 'proxy-rotated';
  static readonly EVENT_PROXY_FAILED = 'proxy-failed';
  static readonly EVENT_PROXY_ADDED = 'proxy-added';
  static readonly EVENT_PROXY_REMOVED = 'proxy-removed';
  
  constructor(
    private configService: ConfigService,
    private secureStorage: SecureStorageService,
    private logService: LogService
  ) {
    super();
    
    // Inicializar com configurações padrão
    this.initialize();
  }
  
  /**
   * Inicializa o gerenciador de proxies
   */
  private async initialize(): Promise<void> {
    try {
      await this.loadStoredProxies();
      
      this.logService.info('ProxyManager inicializado com sucesso');
    } catch (error) {
      this.logService.error('Erro ao inicializar ProxyManager', error);
    }
  }
  
  /**
   * Carrega proxies armazenados
   */
  private async loadStoredProxies(): Promise<void> {
    try {
      const dataDir = this.configService.getDataDirectory();
      // Aqui implementaríamos o carregamento de proxies armazenados
      // Para simplicidade neste exemplo, inicializamos com servidores de exemplo
      
      // Adicionar pool padrão
      const defaultPool: ProxyPool = {
        id: 'default',
        name: 'Pool Padrão',
        proxies: [],
        strategy: 'round-robin'
      };
      
      this.pools.set('default', defaultPool);
      
      // Carregar credenciais de proxy se disponíveis
      const credentials = await this.secureStorage.getProxyCredentials();
      if (credentials) {
        this.logService.info(`Credenciais de proxy carregadas para provedor: ${credentials.provider}`);
      }
    } catch (error) {
      this.logService.error('Erro ao carregar proxies armazenados', error);
      throw error;
    }
  }
  
  /**
   * Adiciona um novo proxy
   */
  public async addProxy(proxy: Omit<ProxyInfo, 'successCount' | 'failureCount' | 'responseTime' | 'isActive' | 'sessions'>): Promise<ProxyInfo> {
    const proxyInfo: ProxyInfo = {
      ...proxy,
      successCount: 0,
      failureCount: 0,
      responseTime: 0,
      isActive: true,
      sessions: 0
    };
    
    // Validar proxy antes de adicionar
    const testResult = await this.testProxy(proxyInfo);
    if (!testResult.success) {
      this.logService.warn(`Proxy ${proxy.url} falhou no teste: ${testResult.error}`);
      proxyInfo.isActive = false;
    } else {
      // Atualizar com informações do teste
      proxyInfo.responseTime = testResult.responseTime;
      if (testResult.country) {
        proxyInfo.country = testResult.country;
      }
      
      this.logService.info(`Proxy ${proxy.url} adicionado e testado com sucesso`);
    }
    
    this.proxies.set(proxyInfo.id, proxyInfo);
    
    // Adicionar ao pool padrão
    const defaultPool = this.pools.get('default');
    if (defaultPool) {
      defaultPool.proxies.push(proxyInfo);
      this.pools.set('default', defaultPool);
    }
    
    // Armazenar credenciais de forma segura se fornecidas
    if (proxyInfo.username && proxyInfo.password) {
      await this.secureStorage.storeProxyCredentials(
        proxyInfo.provider,
        proxyInfo.username,
        proxyInfo.password
      );
    }
    
    this.emit(ProxyManager.EVENT_PROXY_ADDED, proxyInfo);
    
    return proxyInfo;
  }
  
  /**
   * Remove um proxy
   */
  public removeProxy(proxyId: string): boolean {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) {
      return false;
    }
    
    // Remover de todos os pools
    for (const [poolId, pool] of this.pools.entries()) {
      pool.proxies = pool.proxies.filter(p => p.id !== proxyId);
      this.pools.set(poolId, pool);
    }
    
    // Fechar servidor de proxy se estiver em execução
    if (this.proxyServers.has(proxyId)) {
      const server = this.proxyServers.get(proxyId);
      server?.close();
      this.proxyServers.delete(proxyId);
    }
    
    this.proxies.delete(proxyId);
    
    this.emit(ProxyManager.EVENT_PROXY_REMOVED, proxy);
    
    return true;
  }
  
  /**
   * Testa um proxy para verificar se está funcionando
   */
  public async testProxy(proxy: ProxyInfo): Promise<ProxyTestResult> {
    const startTime = Date.now();
    const result: ProxyTestResult = {
      proxy,
      success: false,
      responseTime: 0
    };
    
    try {
      // Configurar proxy para axios
      const axiosConfig = {
        proxy: {
          host: new URL(proxy.url).hostname,
          port: parseInt(new URL(proxy.url).port),
          auth: proxy.username && proxy.password ? {
            username: proxy.username,
            password: proxy.password
          } : undefined
        },
        timeout: 10000 // 10 segundos de timeout
      };
      
      // Testar conectividade usando um serviço de verificação de IP
      const response = await axios.get('https://api.ipify.org?format=json', axiosConfig);
      
      const endTime = Date.now();
      result.responseTime = endTime - startTime;
      result.success = response.status === 200;
      
      if (result.success && response.data && response.data.ip) {
        result.externalIp = response.data.ip;
        
        // Opcionalmente, obter informações de geolocalização do IP
        try {
          const geoResponse = await axios.get(`https://ipapi.co/${result.externalIp}/json/`, { timeout: 5000 });
          if (geoResponse.data && geoResponse.data.country) {
            result.country = geoResponse.data.country;
          }
        } catch (geoError) {
          // Falha ao obter geo info não é crítica
          this.logService.debug(`Não foi possível obter informações de geolocalização: ${geoError.message}`);
        }
      }
    } catch (error) {
      result.success = false;
      result.error = error.message;
      
      const endTime = Date.now();
      result.responseTime = endTime - startTime;
    }
    
    // Atualizar estatísticas do proxy
    if (result.success) {
      proxy.successCount++;
    } else {
      proxy.failureCount++;
    }
    
    proxy.responseTime = result.responseTime;
    this.proxies.set(proxy.id, proxy);
    
    return result;
  }
  
  /**
   * Obtém um proxy para uso com base na estratégia de seleção
   */
  public async getProxy(
    sessionId: string,
    options: {
      country?: string;
      type?: 'residential' | 'datacenter' | 'mobile' | 'custom';
      poolId?: string;
    } = {}
  ): Promise<ProxyInfo | null> {
    try {
      const poolId = options.poolId || 'default';
      const pool = this.pools.get(poolId);
      
      if (!pool) {
        throw new Error(`Pool de proxies ${poolId} não encontrado`);
      }
      
      // Filtrar proxies pela configuração
      let availableProxies = pool.proxies.filter(p => p.isActive);
      
      if (options.country) {
        availableProxies = availableProxies.filter(p => p.country === options.country);
      }
      
      if (options.type) {
        availableProxies = availableProxies.filter(p => p.type === options.type);
      }
      
      if (availableProxies.length === 0) {
        this.logService.warn(`Nenhum proxy disponível para os filtros especificados`);
        return null;
      }
      
      // Selecionar proxy com base na estratégia
      let selectedProxy: ProxyInfo | null = null;
      
      switch (pool.strategy) {
        case 'round-robin':
          // Usar o próximo proxy na lista circular
          const index = Date.now() % availableProxies.length;
          selectedProxy = availableProxies[index];
          break;
          
        case 'random':
          // Selecionar aleatoriamente
          const randomIndex = Math.floor(Math.random() * availableProxies.length);
          selectedProxy = availableProxies[randomIndex];
          break;
          
        case 'smart':
          // Selecionar com base em performance (menor tempo de resposta e maior taxa de sucesso)
          selectedProxy = availableProxies.reduce((best, current) => {
            const bestScore = (best.successCount / (best.successCount + best.failureCount || 1)) * (1000 / (best.responseTime || 1000));
            const currentScore = (current.successCount / (current.successCount + current.failureCount || 1)) * (1000 / (current.responseTime || 1000));
            
            return currentScore > bestScore ? current : best;
          }, availableProxies[0]);
          break;
          
        case 'sticky':
          // Usar o mesmo proxy para a sessão se já alocado
          const existingProxyId = this.activeProxies.get(sessionId);
          if (existingProxyId) {
            const existingProxy = this.proxies.get(existingProxyId);
            if (existingProxy && existingProxy.isActive) {
              selectedProxy = existingProxy;
              break;
            }
          }
          
          // Caso contrário, usar round-robin
          const stickyIndex = Date.now() % availableProxies.length;
          selectedProxy = availableProxies[stickyIndex];
          break;
      }
      
      if (!selectedProxy) {
        throw new Error('Falha ao selecionar proxy');
      }
      
      // Atualizar estatísticas e associar à sessão
      selectedProxy.lastUsed = new Date();
      selectedProxy.sessions++;
      this.proxies.set(selectedProxy.id, selectedProxy);
      this.activeProxies.set(sessionId, selectedProxy.id);
      
      this.logService.debug(`Proxy ${selectedProxy.url} alocado para sessão ${sessionId}`);
      
      return selectedProxy;
    } catch (error) {
      this.logService.error('Erro ao obter proxy', error);
      return null;
    }
  }
  
  /**
   * Inicializa um servidor de proxy local para tunelamento
   */
  public async startLocalProxyServer(proxy: ProxyInfo): Promise<string> {
    // Verificar se já existe um servidor para este proxy
    if (this.proxyServers.has(proxy.id)) {
      const existingServer = this.proxyServers.get(proxy.id);
      return `http://localhost:${(existingServer as any).port}`;
    }
    
    try {
      // Formatar URL do proxy upstream
      let upstreamProxyUrl = proxy.url;
      
      // Adicionar credenciais se disponíveis
      if (proxy.username && proxy.password) {
        const parsedUrl = new URL(proxy.url);
        upstreamProxyUrl = `${parsedUrl.protocol}//${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@${parsedUrl.host}`;
      }
      
      // Criar servidor de proxy local
      const server = new ProxyChain.Server({
        port: 0, // Porta aleatória
        prepareRequestFunction: () => {
          return {
            upstreamProxyUrl
          };
        }
      });
      
      // Iniciar servidor
      await new Promise<void>((resolve, reject) => {
        server.listen(() => resolve());
      });
      
      const port = (server as any).port;
      const localProxyUrl = `http://localhost:${port}`;
      
      this.proxyServers.set(proxy.id, server);
      this.logService.info(`Servidor de proxy local iniciado em ${localProxyUrl} para ${proxy.url}`);
      
      return localProxyUrl;
    } catch (error) {
      this.logService.error(`Erro ao iniciar servidor de proxy local para ${proxy.url}`, error);
      throw error;
    }
  }
  
  /**
   * Libera um proxy associado a uma sessão
   */
  public releaseProxy(sessionId: string): void {
    const proxyId = this.activeProxies.get(sessionId);
    if (proxyId) {
      const proxy = this.proxies.get(proxyId);
      if (proxy) {
        proxy.sessions = Math.max(0, proxy.sessions - 1);
        this.proxies.set(proxyId, proxy);
      }
      
      this.activeProxies.delete(sessionId);
      this.logService.debug(`Proxy liberado para sessão ${sessionId}`);
    }
  }
  
  /**
   * Configura a rotação automática de proxies para uma sessão
   */
  public setupAutoRotation(sessionId: string, intervalSeconds = 300): void {
    // Cancelar timer existente se houver
    if (this.rotationTimers.has(sessionId)) {
      clearInterval(this.rotationTimers.get(sessionId)!);
    }
    
    // Configurar nova rotação automática
    const timer = setInterval(() => {
      this.rotateProxy(sessionId)
        .catch(error => this.logService.error(`Erro ao rotacionar proxy para sessão ${sessionId}`, error));
    }, intervalSeconds * 1000);
    
    this.rotationTimers.set(sessionId, timer);
    this.logService.info(`Rotação automática de proxy configurada para sessão ${sessionId} a cada ${intervalSeconds} segundos`);
  }
  
  /**
   * Rotaciona o proxy de uma sessão
   */
  public async rotateProxy(sessionId: string): Promise<ProxyInfo | null> {
    // Liberar proxy atual
    this.releaseProxy(sessionId);
    
    // Obter novo proxy
    const newProxy = await this.getProxy(sessionId);
    
    if (newProxy) {
      this.emit(ProxyManager.EVENT_PROXY_ROTATED, { sessionId, proxy: newProxy });
    }
    
    return newProxy;
  }
  
  /**
   * Reporta falha em um proxy
   */
  public async reportProxyFailure(proxyId: string, error: string): Promise<void> {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) {
      return;
    }
    
    proxy.failureCount++;
    
    // Desativar proxy se tiver muitas falhas consecutivas
    if (proxy.failureCount > 5 && proxy.successCount / proxy.failureCount < 0.2) {
      proxy.isActive = false;
      this.logService.warn(`Proxy ${proxy.url} desativado devido a múltiplas falhas: ${error}`);
    }
    
    this.proxies.set(proxyId, proxy);
    
    this.emit(ProxyManager.EVENT_PROXY_FAILED, { proxy, error });
    
    // Tentar retestar o proxy após um tempo
    setTimeout(() => {
      this.testProxy(proxy)
        .then(result => {
          if (result.success) {
            proxy.isActive = true;
            this.logService.info(`Proxy ${proxy.url} reativado após teste bem-sucedido`);
            this.proxies.set(proxyId, proxy);
          }
        })
        .catch(() => {
          // Ignorar erros no teste automático
        });
    }, 300000); // Retestar após 5 minutos
  }
  
  /**
   * Cria um pool de proxies
   */
  public createPool(name: string, strategy: 'round-robin' | 'random' | 'smart' | 'sticky' = 'round-robin'): ProxyPool {
    const id = `pool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const pool: ProxyPool = {
      id,
      name,
      proxies: [],
      strategy
    };
    
    this.pools.set(id, pool);
    return pool;
  }
  
  /**
   * Adiciona um proxy a um pool
   */
  public addProxyToPool(poolId: string, proxyId: string): boolean {
    const pool = this.pools.get(poolId);
    const proxy = this.proxies.get(proxyId);
    
    if (!pool || !proxy) {
      return false;
    }
    
    // Verificar se o proxy já está no pool
    if (pool.proxies.some(p => p.id === proxyId)) {
      return true; // Já está no pool
    }
    
    pool.proxies.push(proxy);
    this.pools.set(poolId, pool);
    
    return true;
  }
  
  /**
   * Modifica a configuração de proxy para uma conexão http/https
   */
  public configureHttpOptions(
    requestOptions: http.RequestOptions | https.RequestOptions,
    proxy: ProxyInfo
  ): http.RequestOptions | https.RequestOptions {
    try {
      const parsedUrl = new URL(proxy.url);
      
      // Modificar opções de request para usar o proxy
      const modifiedOptions = {
        ...requestOptions,
        host: parsedUrl.hostname,
        port: parsedUrl.port ? parseInt(parsedUrl.port) : 80,
        path: `${requestOptions.protocol}//${requestOptions.host}${requestOptions.path}`,
        headers: {
          ...requestOptions.headers,
          Host: requestOptions.host
        }
      };
      
      // Adicionar autenticação se disponível
      if (proxy.username && proxy.password) {
        const auth = Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64');
        modifiedOptions.headers = {
          ...modifiedOptions.headers,
          'Proxy-Authorization': `Basic ${auth}`
        };
      }
      
      return modifiedOptions;
    } catch (error) {
      this.logService.error('Erro ao configurar opções de proxy HTTP', error);
      return requestOptions; // Retornar opções originais em caso de erro
    }
  }
  
  /**
   * Obtém a URL de proxy para um agente do Playwright/Puppeteer
   */
  public getProxyUrlForBrowser(proxy: ProxyInfo): { server: string; username?: string; password?: string } {
    const parsedUrl = new URL(proxy.url);
    
    return {
      server: `${parsedUrl.protocol}//${parsedUrl.host}`,
      username: proxy.username,
      password: proxy.password
    };
  }
  
  /**
   * Importa uma lista de proxies de um arquivo ou string
   */
  public async importProxies(proxyList: string, type: 'residential' | 'datacenter' | 'mobile' | 'custom', provider: string): Promise<number> {
    let importCount = 0;
    
    try {
      // Separar lista por linhas
      const lines = proxyList.trim().split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue; // Ignorar linhas vazias ou comentários
        }
        
        try {
          // Tentar extrair formato ip:porta:usuario:senha ou ip:porta
          const parts = trimmedLine.split(':');
          
          let url = '';
          let username: string | undefined;
          let password: string | undefined;
          
          if (parts.length >= 4) {
            // Formato completo com autenticação
            url = `http://${parts[0]}:${parts[1]}`;
            username = parts[2];
            password = parts[3];
          } else if (parts.length >= 2) {
            // Apenas ip:porta
            url = `http://${parts[0]}:${parts[1]}`;
          } else {
            // Formato inválido
            this.logService.warn(`Formato de proxy inválido: ${trimmedLine}`);
            continue;
          }
          
          // Adicionar proxy
          await this.addProxy({
            id: `proxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url,
            type,
            provider,
            username,
            password
          });
          
          importCount++;
        } catch (lineError) {
          this.logService.warn(`Erro ao processar linha de proxy: ${trimmedLine}`, lineError);
        }
      }
      
      this.logService.info(`Importação de proxies concluída: ${importCount} proxies adicionados`);
      return importCount;
    } catch (error) {
      this.logService.error('Erro ao importar lista de proxies', error);
      throw error;
    }
  }
  
  /**
   * Finaliza recursos ao desativar a extensão
   */
  public dispose(): void {
    // Fechar todos os timers de rotação
    for (const timer of this.rotationTimers.values()) {
      clearInterval(timer);
    }
    this.rotationTimers.clear();
    
    // Fechar todos os servidores de proxy locais
    for (const server of this.proxyServers.values()) {
      server.close();
    }
    this.proxyServers.clear();
    
    this.logService.info('ProxyManager: recursos liberados');
  }
}
