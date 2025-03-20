import { ConfigService } from './configService';
import { LogService } from '../utils/logService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Tipo de proxy
 */
export enum ProxyType {
  HTTP = 'http',
  HTTPS = 'https',
  SOCKS4 = 'socks4',
  SOCKS5 = 'socks5'
}

/**
 * Status de um proxy
 */
export enum ProxyStatus {
  AVAILABLE = 'available',
  IN_USE = 'in_use',
  FAILING = 'failing',
  BANNED = 'banned'
}

/**
 * Interface para detalhes de um proxy
 */
export interface ProxyDetails {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: ProxyType;
  username?: string;
  password?: string;
  country?: string;
  city?: string;
  isp?: string;
  lastChecked?: Date;
  status: ProxyStatus;
  responseTime?: number;
  failCount: number;
  successRate: number;
  tags?: string[];
  expiresAt?: Date;
  createdAt: Date;
  lastUsed?: Date;
}

/**
 * Opções para criação de um proxy
 */
export interface CreateProxyOptions {
  name?: string;
  host: string;
  port: number;
  protocol?: ProxyType;
  username?: string;
  password?: string;
  country?: string;
  city?: string;
  isp?: string;
  tags?: string[];
  expiresAt?: Date;
}

/**
 * Gerenciador de proxies
 */
export class ProxyManager {
  private proxies: Map<string, ProxyDetails> = new Map();

  constructor(
    private configService: ConfigService,
    private logService: LogService
  ) {}

  /**
   * Inicializa o gerenciador de proxies
   */
  public async initialize(): Promise<void> {
    try {
      // Carregar proxies existentes
      const proxiesData = await this.configService.get<ProxyDetails[]>('proxies.list', []);
      
      // Adicionar proxies ao mapa
      for (const proxy of proxiesData) {
        if (proxy && typeof proxy === 'object' && 'id' in proxy) {
          this.proxies.set(proxy.id, {
            ...proxy,
            createdAt: new Date(proxy.createdAt instanceof Date ? proxy.createdAt : proxy.createdAt || Date.now()),
            lastChecked: proxy.lastChecked ? new Date(proxy.lastChecked) : undefined,
            lastUsed: proxy.lastUsed ? new Date(proxy.lastUsed) : undefined,
            expiresAt: proxy.expiresAt ? new Date(proxy.expiresAt) : undefined
          });
        }
      }
      
      this.logService.info(`Gerenciador de proxies inicializado com ${this.proxies.size} proxies`);
    } catch (error) {
      this.logService.error('Erro ao inicializar gerenciador de proxies', error);
      throw error;
    }
  }

  /**
   * Adiciona um novo proxy
   */
  public async addProxy(options: CreateProxyOptions): Promise<string> {
    const id = uuidv4();
    
    // Criar proxy com valores padrão
    const proxy: ProxyDetails = {
      id,
      name: options.name || `Proxy ${options.host}:${options.port}`,
      host: options.host,
      port: options.port,
      protocol: options.protocol || ProxyType.HTTP,
      username: options.username,
      password: options.password,
      country: options.country,
      city: options.city,
      isp: options.isp,
      tags: options.tags || [],
      status: ProxyStatus.AVAILABLE,
      failCount: 0,
      successRate: 100, // Iniciar com taxa de sucesso de 100%
      expiresAt: options.expiresAt,
      createdAt: new Date()
    };
    
    // Adicionar ao mapa
    this.proxies.set(id, proxy);
    
    // Salvar no armazenamento persistente
    await this.saveProxies();
    
    this.logService.info(`Proxy adicionado: ${proxy.name} (${proxy.host}:${proxy.port})`);
    
    return id;
  }

  /**
   * Obtém detalhes de um proxy pelo ID
   */
  public getProxy(id: string): ProxyDetails | null {
    const proxy = this.proxies.get(id);
    return proxy || null;
  }

  /**
   * Atualiza detalhes de um proxy
   */
  public async updateProxy(id: string, updates: Partial<ProxyDetails>): Promise<boolean> {
    const proxy = this.proxies.get(id);
    if (!proxy) {
      return false;
    }
    
    // Atualizar propriedades
    Object.assign(proxy, updates);
    
    // Atualizar timestamp de última atualização
    proxy.lastChecked = new Date();
    
    // Salvar no armazenamento persistente
    await this.saveProxies();
    
    this.logService.info(`Proxy atualizado: ${proxy.name} (${proxy.host}:${proxy.port})`);
    
    return true;
  }

  /**
   * Remove um proxy
   */
  public async removeProxy(id: string): Promise<boolean> {
    const proxy = this.proxies.get(id);
    if (!proxy) {
      return false;
    }
    
    // Remover do mapa
    this.proxies.delete(id);
    
    // Salvar no armazenamento persistente
    await this.saveProxies();
    
    this.logService.info(`Proxy removido: ${proxy.name} (${proxy.host}:${proxy.port})`);
    
    return true;
  }

  /**
   * Lista todos os proxies
   */
  public listProxies(filter?: {
    status?: ProxyStatus;
    protocol?: ProxyType;
    country?: string;
    tags?: string[];
  }): ProxyDetails[] {
    let results = Array.from(this.proxies.values());
    
    // Aplicar filtros se fornecidos
    if (filter) {
      if (filter.status) {
        results = results.filter(proxy => proxy.status === filter.status);
      }
      
      if (filter.protocol) {
        results = results.filter(proxy => proxy.protocol === filter.protocol);
      }
      
      if (filter.country) {
        results = results.filter(proxy => proxy.country === filter.country);
      }
      
      if (filter.tags && filter.tags.length > 0) {
        results = results.filter(proxy => 
          proxy.tags && filter.tags?.some(tag => proxy.tags?.includes(tag))
        );
      }
    }
    
    return results;
  }

  /**
   * Obtém o próximo proxy disponível usando um algoritmo básico de round-robin
   */
  public getNextAvailableProxy(): ProxyDetails | null {
    const availableProxies = this.listProxies({ status: ProxyStatus.AVAILABLE });
    if (availableProxies.length === 0) {
      return null;
    }
    
    // Ordenar por taxa de sucesso e último uso
    availableProxies.sort((a, b) => {
      // Preferir proxies com maior taxa de sucesso
      if (b.successRate !== a.successRate) {
        return b.successRate - a.successRate;
      }
      
      // Se as taxas de sucesso forem iguais, preferir o menos usado recentemente
      const aTime = a.lastUsed ? a.lastUsed.getTime() : 0;
      const bTime = b.lastUsed ? b.lastUsed.getTime() : 0;
      return aTime - bTime;
    });
    
    // Usar o primeiro proxy da lista ordenada
    const selectedProxy = availableProxies[0];
    
    // Atualizar status e timestamp de último uso
    this.updateProxy(selectedProxy.id, {
      status: ProxyStatus.IN_USE,
      lastUsed: new Date()
    });
    
    return selectedProxy;
  }

  /**
   * Reporta sucesso no uso de um proxy
   */
  public async reportSuccess(id: string): Promise<void> {
    const proxy = this.proxies.get(id);
    if (!proxy) {
      return;
    }
    
    // Calcular nova taxa de sucesso
    const newSuccessRate = (proxy.successRate * 9 + 100) / 10; // Média móvel ponderada
    
    // Atualizar status e métricas
    await this.updateProxy(id, {
      status: ProxyStatus.AVAILABLE,
      successRate: Math.min(newSuccessRate, 100),
      lastUsed: new Date()
    });
  }

  /**
   * Reporta falha no uso de um proxy
   */
  public async reportFailure(id: string, permanent: boolean = false): Promise<void> {
    const proxy = this.proxies.get(id);
    if (!proxy) {
      return;
    }
    
    // Incrementar contador de falhas
    const failCount = proxy.failCount + 1;
    
    // Calcular nova taxa de sucesso
    const newSuccessRate = (proxy.successRate * 9) / 10; // Média móvel ponderada
    
    // Determinar novo status
    let newStatus: ProxyStatus;
    
    if (permanent) {
      newStatus = ProxyStatus.BANNED;
    } else if (failCount >= 5 || newSuccessRate < 30) {
      newStatus = ProxyStatus.FAILING;
    } else {
      newStatus = ProxyStatus.AVAILABLE;
    }
    
    // Atualizar status e métricas
    await this.updateProxy(id, {
      status: newStatus,
      failCount,
      successRate: Math.max(newSuccessRate, 0),
      lastUsed: new Date()
    });
    
    this.logService.warn(`Proxy reportado com falha: ${proxy.name} (${proxy.host}:${proxy.port}). Status: ${newStatus}`);
  }

  /**
   * Verifica a conexão de um proxy
   */
  public async checkProxy(id: string): Promise<boolean> {
    const proxy = this.proxies.get(id);
    if (!proxy) {
      return false;
    }
    
    try {
      // Implementar verificação real de proxy
      // Aqui você pode usar axios, got ou outras bibliotecas para testar a conexão
      
      // Por enquanto, vamos simular uma verificação com 90% de chance de sucesso
      const success = Math.random() < 0.9;
      
      if (success) {
        await this.updateProxy(id, {
          status: ProxyStatus.AVAILABLE,
          failCount: 0,
          successRate: 100,
          responseTime: Math.floor(Math.random() * 200) + 50, // 50-250ms de tempo de resposta
          lastChecked: new Date()
        });
      } else {
        await this.reportFailure(id);
      }
      
      return success;
    } catch (error) {
      this.logService.error(`Erro ao verificar proxy: ${proxy.name} (${proxy.host}:${proxy.port})`, error);
      await this.reportFailure(id);
      return false;
    }
  }

  /**
   * Verifica todos os proxies
   */
  public async checkAllProxies(): Promise<{ total: number; available: number; failing: number; banned: number }> {
    const allProxies = this.listProxies();
    let available = 0;
    let failing = 0;
    let banned = 0;
    
    for (const proxy of allProxies) {
      // Não verificar proxies já banidos
      if (proxy.status === ProxyStatus.BANNED) {
        banned++;
        continue;
      }
      
      const success = await this.checkProxy(proxy.id);
      
      // Verificar o status após a verificação
      const updatedProxy = this.getProxy(proxy.id);
      if (!updatedProxy) continue;
      
      if (updatedProxy.status === ProxyStatus.AVAILABLE) {
        available++;
      } else if (updatedProxy.status === ProxyStatus.FAILING) {
        failing++;
      } else if (updatedProxy.status === ProxyStatus.BANNED) {
        banned++;
      }
    }
    
    this.logService.info(`Verificação de proxies concluída. Total: ${allProxies.length}, Disponíveis: ${available}, Falhando: ${failing}, Banidos: ${banned}`);
    
    return {
      total: allProxies.length,
      available,
      failing,
      banned
    };
  }

  /**
   * Salva proxies no armazenamento persistente
   */
  private async saveProxies(): Promise<void> {
    try {
      const proxiesData = Array.from(this.proxies.values()).map(proxy => ({
        ...proxy,
        // Converter datas para strings ISO para serialização segura
        createdAt: proxy.createdAt.toISOString(),
        lastChecked: proxy.lastChecked ? proxy.lastChecked.toISOString() : undefined,
        lastUsed: proxy.lastUsed ? proxy.lastUsed.toISOString() : undefined,
        expiresAt: proxy.expiresAt ? proxy.expiresAt.toISOString() : undefined
      }));
      
      await this.configService.set('proxies.list', proxiesData);
    } catch (error) {
      this.logService.error('Erro ao salvar proxies', error);
      throw error;
    }
  }
}
