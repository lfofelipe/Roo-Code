import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LogService } from '../utils/logService';
import { BehaviorSettings, ProxySettings } from '../types/context';

/**
 * Interface para os padrões de configuração persistidos no workspace
 */
export interface ConfigFile {
  version: string;
  tasks: TaskConfig[];
  profiles: ProfileConfig[];
  defaultBehavior: BehaviorSettings;
  defaultProxy: ProxySettings;
  lastRun?: {
    taskId: string;
    timestamp: string;
    status: string;
  };
}

/**
 * Interface para configuração de tarefa persistida
 */
export interface TaskConfig {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  targetUrl: string;
  config: any; // Configuração completa da tarefa
}

/**
 * Interface para configuração de perfil persistida
 */
export interface ProfileConfig {
  id: string;
  name: string;
  description?: string;
  browserType: 'chromium' | 'firefox' | 'webkit';
  userAgent: string;
  fingerprint: any; // Fingerprint específico do perfil
  cookies?: string; // Cookies serializados
  localStorage?: string; // LocalStorage serializado
  proxyConfig?: ProxySettings;
}

/**
 * Serviço central para gerenciamento de configurações da extensão
 */
export class ConfigService {
  private static readonly EXTENSION_NAME = 'adv-scraper';
  private static readonly CONFIG_FILE_NAME = 'adv-scraper-config.json';
  private configFile: ConfigFile | null = null;
  private configFilePath: string;
  private listeners: vscode.Disposable[] = [];
  private configChangeEmitter = new vscode.EventEmitter<void>();
  
  constructor(
    private context: vscode.ExtensionContext,
    private logService?: LogService
  ) {
    // Determinar caminho do arquivo de configuração
    this.configFilePath = this.getConfigFilePath();
  }
  
  /**
   * Inicializa o serviço de configuração
   */
  public async initialize(): Promise<void> {
    try {
      // Carregar arquivo de configuração ou criar se não existir
      this.configFile = await this.loadConfigFile();
      
      // Registrar listener para mudanças nas configurações do VS Code
      this.listeners.push(
        vscode.workspace.onDidChangeConfiguration(e => {
          if (e.affectsConfiguration(ConfigService.EXTENSION_NAME)) {
            this.configChangeEmitter.fire();
          }
        })
      );
      
      this.log('info', 'ConfigService inicializado com sucesso');
    } catch (error) {
      this.log('error', `Erro ao inicializar ConfigService: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Retorna um observable para monitorar mudanças na configuração
   */
  public get onConfigChange(): vscode.Event<void> {
    return this.configChangeEmitter.event;
  }
  
  /**
   * Obtém uma configuração do VS Code
   */
  public getConfig<T>(key: string, defaultValue?: T): T {
    const config = vscode.workspace.getConfiguration(ConfigService.EXTENSION_NAME);
    return config.get(key, defaultValue as any);
  }
  
  /**
   * Atualiza uma configuração do VS Code
   */
  public async setConfig<T>(key: string, value: T, global = false): Promise<void> {
    const config = vscode.workspace.getConfiguration(ConfigService.EXTENSION_NAME);
    await config.update(
      key, 
      value, 
      global ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace
    );
  }
  
  /**
   * Obtém o diretório de dados configurado
   */
  public getDataDirectory(): string {
    const configDir = this.getConfig<string>('storageLocation', '${workspaceFolder}/scraper-data');
    
    // Resolver variáveis
    let resolvedDir = configDir;
    if (configDir.includes('${workspaceFolder}') && vscode.workspace.workspaceFolders?.length) {
      resolvedDir = configDir.replace(
        '${workspaceFolder}',
        vscode.workspace.workspaceFolders[0].uri.fsPath
      );
    }
    
    // Garantir que o diretório existe
    if (!fs.existsSync(resolvedDir)) {
      fs.mkdirSync(resolvedDir, { recursive: true });
    }
    
    return resolvedDir;
  }
  
  /**
   * Obtém as configurações de comportamento padrão
   */
  public getDefaultBehaviorSettings(): BehaviorSettings {
    return this.getConfig<BehaviorSettings>('defaultBehavior', {
      humanLike: true,
      randomizeUserAgent: true,
      respectRobotsTxt: true,
      evasionLevel: 'standard',
      waitTimes: {
        minDelay: 500,
        maxDelay: 3000
      }
    });
  }
  
  /**
   * Obtém as configurações de proxy padrão
   */
  public getDefaultProxySettings(): ProxySettings {
    return this.getConfig<ProxySettings>('proxySettings', {
      enabled: false,
      type: 'residential',
      rotationInterval: 300
    });
  }
  
  /**
   * Obtém o nível de segurança/evasão anti-bot configurado
   */
  public getSecurityLevel(): 'basic' | 'standard' | 'advanced' | 'maximum' {
    return this.getConfig<'basic' | 'standard' | 'advanced' | 'maximum'>('securityLevel', 'standard');
  }
  
  /**
   * Obtém as configurações de serviços de IA
   */
  public getAiServicesConfig(): any {
    return this.getConfig<any>('aiServices', {
      enabled: false,
      provider: 'openai',
      apiKey: ''
    });
  }
  
  /**
   * Obtém a configuração do provedor de IA
   */
  public getAIConfiguration(): any {
    return this.getConfig<any>('aiServices', {
      enabled: false,
      provider: 'openai',
      model: 'gpt-4-vision-preview',
      apiKey: '',
      modelParameters: {
        temperature: 0.2,
        maxTokens: 1000,
        timeout: 60000
      }
    });
  }
  
  /**
   * Atualiza a configuração do provedor de IA
   */
  public updateAIConfiguration(config: any): void {
    this.setConfig('aiServices', config, false);
  }
  
  /**
   * Adiciona uma nova tarefa configurada
   */
  public async addTask(task: TaskConfig): Promise<void> {
    await this.ensureConfigFileLoaded();
    
    if (!this.configFile) {
      throw new Error('Arquivo de configuração não inicializado');
    }
    
    // Verificar se já existe uma tarefa com mesmo ID
    const existingIndex = this.configFile.tasks.findIndex(t => t.id === task.id);
    if (existingIndex >= 0) {
      this.configFile.tasks[existingIndex] = task;
    } else {
      this.configFile.tasks.push(task);
    }
    
    await this.saveConfigFile();
  }
  
  /**
   * Remove uma tarefa configurada
   */
  public async removeTask(taskId: string): Promise<void> {
    await this.ensureConfigFileLoaded();
    
    if (!this.configFile) {
      throw new Error('Arquivo de configuração não inicializado');
    }
    
    this.configFile.tasks = this.configFile.tasks.filter(t => t.id !== taskId);
    
    await this.saveConfigFile();
  }
  
  /**
   * Retorna todas as tarefas configuradas
   */
  public async getTasks(): Promise<TaskConfig[]> {
    await this.ensureConfigFileLoaded();
    
    if (!this.configFile) {
      throw new Error('Arquivo de configuração não inicializado');
    }
    
    return [...this.configFile.tasks];
  }
  
  /**
   * Obtém uma tarefa específica pelo ID
   */
  public async getTask(taskId: string): Promise<TaskConfig | null> {
    await this.ensureConfigFileLoaded();
    
    if (!this.configFile) {
      throw new Error('Arquivo de configuração não inicializado');
    }
    
    const task = this.configFile.tasks.find(t => t.id === taskId);
    return task || null;
  }
  
  /**
   * Adiciona ou atualiza um perfil
   */
  public async addProfile(profile: ProfileConfig): Promise<void> {
    await this.ensureConfigFileLoaded();
    
    if (!this.configFile) {
      throw new Error('Arquivo de configuração não inicializado');
    }
    
    // Verificar se já existe um perfil com mesmo ID
    const existingIndex = this.configFile.profiles.findIndex(p => p.id === profile.id);
    if (existingIndex >= 0) {
      this.configFile.profiles[existingIndex] = profile;
    } else {
      this.configFile.profiles.push(profile);
    }
    
    await this.saveConfigFile();
  }
  
  /**
   * Remove um perfil
   */
  public async removeProfile(profileId: string): Promise<void> {
    await this.ensureConfigFileLoaded();
    
    if (!this.configFile) {
      throw new Error('Arquivo de configuração não inicializado');
    }
    
    this.configFile.profiles = this.configFile.profiles.filter(p => p.id !== profileId);
    
    await this.saveConfigFile();
  }
  
  /**
   * Retorna todos os perfis configurados
   */
  public async getProfiles(): Promise<ProfileConfig[]> {
    await this.ensureConfigFileLoaded();
    
    if (!this.configFile) {
      throw new Error('Arquivo de configuração não inicializado');
    }
    
    return [...this.configFile.profiles];
  }
  
  /**
   * Obtém um perfil específico pelo ID
   */
  public async getProfile(profileId: string): Promise<ProfileConfig | null> {
    await this.ensureConfigFileLoaded();
    
    if (!this.configFile) {
      throw new Error('Arquivo de configuração não inicializado');
    }
    
    const profile = this.configFile.profiles.find(p => p.id === profileId);
    return profile || null;
  }
  
  /**
   * Atualiza as informações da última execução
   */
  public async updateLastRun(taskId: string, status: string): Promise<void> {
    await this.ensureConfigFileLoaded();
    
    if (!this.configFile) {
      throw new Error('Arquivo de configuração não inicializado');
    }
    
    this.configFile.lastRun = {
      taskId,
      timestamp: new Date().toISOString(),
      status
    };
    
    await this.saveConfigFile();
  }
  
  /**
   * Obtém as informações da última execução
   */
  public async getLastRun(): Promise<{ taskId: string; timestamp: string; status: string } | undefined> {
    await this.ensureConfigFileLoaded();
    
    if (!this.configFile) {
      throw new Error('Arquivo de configuração não inicializado');
    }
    
    return this.configFile.lastRun;
  }
  
  /**
   * Garante que o arquivo de configuração está carregado
   */
  private async ensureConfigFileLoaded(): Promise<void> {
    if (!this.configFile) {
      this.configFile = await this.loadConfigFile();
    }
  }
  
  /**
   * Carrega ou cria o arquivo de configuração
   */
  private async loadConfigFile(): Promise<ConfigFile> {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const fileContent = fs.readFileSync(this.configFilePath, 'utf8');
        return JSON.parse(fileContent);
      } else {
        // Criar arquivo de configuração padrão
        const defaultConfig: ConfigFile = {
          version: '1.0.0',
          tasks: [],
          profiles: [],
          defaultBehavior: this.getDefaultBehaviorSettings(),
          defaultProxy: this.getDefaultProxySettings()
        };
        
        // Garantir que o diretório existe
        const configDir = path.dirname(this.configFilePath);
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }
        
        fs.writeFileSync(this.configFilePath, JSON.stringify(defaultConfig, null, 2), 'utf8');
        return defaultConfig;
      }
    } catch (error) {
      this.log('error', `Erro ao carregar arquivo de configuração: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Salva o arquivo de configuração
   */
  private async saveConfigFile(): Promise<void> {
    try {
      if (!this.configFile) {
        throw new Error('Arquivo de configuração não inicializado');
      }
      
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.configFile, null, 2), 'utf8');
    } catch (error) {
      this.log('error', `Erro ao salvar arquivo de configuração: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Determina o caminho para o arquivo de configuração
   */
  private getConfigFilePath(): string {
    // Preferir armazenar no diretório do workspace se disponível
    if (vscode.workspace.workspaceFolders?.length) {
      const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
      return path.join(workspaceFolder, '.adv-scraper', ConfigService.CONFIG_FILE_NAME);
    }
    
    // Caso contrário, usar o diretório global da extensão
    return path.join(this.context.globalStorageUri.fsPath, ConfigService.CONFIG_FILE_NAME);
  }
  
  /**
   * Registra uma mensagem de log
   */
  private log(level: 'info' | 'warn' | 'error', message: string): void {
    if (this.logService) {
      if (level === 'info') {
        this.logService.info(message);
      } else if (level === 'warn') {
        this.logService.warn(message);
      } else if (level === 'error') {
        this.logService.error(message);
      }
    } else {
      console.log(`[ConfigService] [${level.toUpperCase()}] ${message}`);
    }
  }
  
  /**
   * Libera recursos ao desativar a extensão
   */
  public dispose(): void {
    this.listeners.forEach(listener => listener.dispose());
    this.configChangeEmitter.dispose();
  }
}
