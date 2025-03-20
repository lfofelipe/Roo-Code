import { BrowserFingerprint } from "../types/context";
import { LogService } from "../utils/logService";
import { ConfigService } from "./configService";
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface para perfis de identidade
 */
export interface IdentityProfile {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  personal?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
  };
  browserFingerprint?: BrowserFingerprint;
  userAgent?: string;
  proxyId?: string;
  tags?: string[];
  createdAt: Date;
  lastUsed?: Date;
}

/**
 * Gerencia identidades para uso nas sessões de navegação
 */
export class IdentityManager {
  private profiles: Map<string, IdentityProfile> = new Map();
  private commonFirstNames: string[] = [
    'João', 'Maria', 'Pedro', 'Ana', 'Carlos', 'Mariana', 'Lucas', 'Juliana',
    'Paulo', 'Fernanda', 'Marcos', 'Patrícia', 'Rafael', 'Camila', 'Bruno'
  ];
  
  private commonLastNames: string[] = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Carvalho',
    'Almeida', 'Ferreira', 'Ribeiro', 'Rodrigues', 'Gomes', 'Lima', 'Martins'
  ];
  
  private commonUserAgents: string[] = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36'
  ];

  constructor(
    private configService: ConfigService,
    private logService: LogService
  ) {}

  /**
   * Inicializa o gerenciador de identidades
   */
  public async initialize(): Promise<void> {
    try {
      // Carregar perfis existentes
      const profilesData = await this.configService.get('identities.profiles', []);
      
      // Adicionar perfis ao mapa
      for (const profile of profilesData) {
        this.profiles.set(profile.id, {
          ...profile,
          createdAt: new Date(profile.createdAt)
        });
      }
      
      this.logService.info(`Gerenciador de identidades inicializado com ${this.profiles.size} perfis`);
    } catch (error) {
      this.logService.error('Erro ao inicializar gerenciador de identidades', error);
      throw error;
    }
  }

  /**
   * Cria um novo perfil de identidade
   */
  public async createProfile(profile: Partial<IdentityProfile> = {}): Promise<string> {
    const id = profile.id || uuidv4();
    
    // Criar novo perfil com valores padrão
    const newProfile: IdentityProfile = {
      id,
      name: profile.name || this.generateRandomName(),
      email: profile.email,
      phoneNumber: profile.phoneNumber,
      address: profile.address,
      personal: profile.personal || {
        firstName: this.getRandomItem(this.commonFirstNames),
        lastName: this.getRandomItem(this.commonLastNames),
      },
      browserFingerprint: profile.browserFingerprint,
      userAgent: profile.userAgent || this.getRandomItem(this.commonUserAgents),
      proxyId: profile.proxyId,
      tags: profile.tags || ['auto-generated'],
      createdAt: new Date()
    };
    
    // Adicionar ao mapa
    this.profiles.set(id, newProfile);
    
    // Salvar no armazenamento persistente
    await this.saveProfiles();
    
    return id;
  }

  /**
   * Cria um perfil aleatório
   */
  public async createRandomProfile(): Promise<string> {
    return this.createProfile({
      name: this.generateRandomName()
    });
  }

  /**
   * Atualiza um perfil existente
   */
  public async updateProfile(id: string, data: Partial<IdentityProfile>): Promise<boolean> {
    const profile = this.profiles.get(id);
    if (!profile) {
      return false;
    }
    
    // Atualizar propriedades
    Object.assign(profile, data);
    
    // Salvar no armazenamento persistente
    await this.saveProfiles();
    
    return true;
  }

  /**
   * Obtém um perfil pelo ID
   */
  public getProfile(id: string): IdentityProfile | null {
    const profile = this.profiles.get(id);
    return profile || null;
  }

  /**
   * Lista todos os perfis
   */
  public listProfiles(tags?: string[]): IdentityProfile[] {
    const profiles = Array.from(this.profiles.values());
    
    if (tags && tags.length > 0) {
      return profiles.filter(profile => 
        profile.tags && tags.some(tag => profile.tags?.includes(tag))
      );
    }
    
    return profiles;
  }

  /**
   * Remove um perfil
   */
  public async removeProfile(id: string): Promise<boolean> {
    const result = this.profiles.delete(id);
    if (result) {
      await this.saveProfiles();
    }
    return result;
  }

  /**
   * Salva perfis no armazenamento persistente
   */
  private async saveProfiles(): Promise<void> {
    try {
      const profilesData = Array.from(this.profiles.values());
      await this.configService.set('identities.profiles', profilesData);
    } catch (error) {
      this.logService.error('Erro ao salvar perfis', error);
      throw error;
    }
  }

  /**
   * Gera um nome aleatório
   */
  private generateRandomName(): string {
    const firstName = this.getRandomItem(this.commonFirstNames);
    const lastName = this.getRandomItem(this.commonLastNames);
    return `${firstName} ${lastName}`;
  }

  /**
   * Obtém um item aleatório de uma lista
   */
  private getRandomItem<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }
}
