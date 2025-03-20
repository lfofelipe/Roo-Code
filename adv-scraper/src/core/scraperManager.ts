import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

import { ConfigService } from '../services/configService';
import { BrowserAutomationService } from '../services/browser/browserAutomation';
import { IdentityManager } from '../services/identityManager';
import { ProxyManager } from '../services/proxyManager';
import { AIProcessingService } from '../services/ai/aiProcessing';
import { DataRepository } from '../services/dataRepository';
import { LogService } from '../utils/logService';
import { 
  ScrapingTaskOptions, 
  ScrapingTaskStatus, 
  ScrapingMethod,
  BrowserFingerprint
} from '../types/context';

/**
 * Interface para uma tarefa de scraping
 */
export interface ScrapingTask {
  id: string;
  name: string;
  status: ScrapingTaskStatus;
  options: ScrapingTaskOptions;
  sessionId?: string;
  identityId?: string;
  proxyId?: string;
  targetUrl: string;
  startTime?: Date;
  endTime?: Date;
  data: any[];
  errors: string[];
  stopRequested: boolean;
  pauseRequested: boolean;
}

/**
 * Interface para resultados de scraping
 */
export interface ScrapingResult {
  taskId: string;
  success: boolean;
  data: any[];
  errors: string[];
  startTime: Date;
  endTime: Date;
  itemsProcessed: number;
  targetUrl: string;
}

/**
 * Interface para eventos de scraping
 */
export interface ScraperEvents {
  'task-created': (task: ScrapingTask) => void;
  'task-started': (task: ScrapingTask) => void;
  'task-paused': (task: ScrapingTask) => void;
  'task-resumed': (task: ScrapingTask) => void;
  'task-completed': (task: ScrapingTask, result: ScrapingResult) => void;
  'task-failed': (task: ScrapingTask, error: Error) => void;
  'task-stopped': (task: ScrapingTask) => void;
  'data-extracted': (taskId: string, data: any) => void;
  'status-updated': (taskId: string, status: ScrapingTaskStatus) => void;
  'method-changed': (taskId: string, oldMethod: ScrapingMethod, newMethod: ScrapingMethod) => void;
  'error-occurred': (taskId: string, error: Error) => void;
  'anti-bot-detected': (taskId: string, url: string, technique: string) => void;
  'captcha-encountered': (taskId: string, url: string) => void;
}

/**
 * Gerenciador central do sistema de scraping
 */
export class ScraperManager extends EventEmitter {
  private tasks: Map<string, ScrapingTask> = new Map();
  private activeTasksCount = 0;
  private readonly MAX_CONCURRENT_TASKS = 5;
  private readonly taskUpdateInterval: NodeJS.Timeout;
  
  constructor(
    private configService: ConfigService,
    private browserService: BrowserAutomationService,
    private identityManager: IdentityManager,
    private proxyManager: ProxyManager,
    private aiService: AIProcessingService,
    private dataRepository: DataRepository,
    private logService: LogService
  ) {
    super();
    
    // Configurar ouvintes de eventos
    this.setupEventListeners();
    
    // Iniciar timer para atualização periódica de status
    this.taskUpdateInterval = setInterval(() => this.updateTaskStatuses(), 5000);
    
    // Carregar tarefas salvas ao inicializar
    this.loadSavedTasks().catch(error => {
      this.logService.error('Erro ao carregar tarefas salvas', error);
    });
    
    this.logService.info('ScraperManager inicializado com sucesso');
  }
  
  /**
   * Configura listeners para eventos de outros serviços
   */
  private setupEventListeners(): void {
    // Browser events
    this.browserService.on('error', (error, sessionId) => {
      const task = this.findTaskBySessionId(sessionId);
      if (task) {
        this.handleTaskError(task.id, error);
      }
    });
    
    this.browserService.on('bot-detection-attempt', (details) => {
      const task = this.findTaskBySessionId(details.sessionId);
      if (task) {
        this.emit('anti-bot-detected', task.id, details.url, details.technique);
        this.logService.warn(`Tentativa de detecção de bot para tarefa ${task.id} em ${details.url}: ${details.technique}`);
      }
    });
    
    this.browserService.on('captcha-detected', (url, sessionId) => {
      const task = this.findTaskBySessionId(sessionId);
      if (task) {
        this.emit('captcha-encountered', task.id, url);
        this.logService.warn(`CAPTCHA detectado para tarefa ${task.id} em ${url}`);
      }
    });
    
    // Identity rotation events
    this.identityManager.on('identity-rotated', (data) => {
      const task = this.findTaskBySessionId(data.sessionId);
      if (task) {
        task.identityId = data.identity.id;
        this.logService.info(`Identidade rotacionada para tarefa ${task.id}: ${data.identity.name}`);
      }
    });
    
    // Proxy rotation events
    this.proxyManager.on('proxy-rotated', (data) => {
      const task = this.findTaskBySessionId(data.sessionId);
      if (task) {
        task.proxyId = data.proxy.id;
        this.logService.info(`Proxy rotacionado para tarefa ${task.id}: ${data.proxy.url}`);
      }
    });
  }
  
  /**
   * Encontra uma tarefa pelo ID de sessão
   */
  private findTaskBySessionId(sessionId: string): ScrapingTask | undefined {
    for (const task of this.tasks.values()) {
      if (task.sessionId === sessionId) {
        return task;
      }
    }
    return undefined;
  }
  
  /**
   * Atualiza o status de todas as tarefas ativas
   */
  private async updateTaskStatuses(): Promise<void> {
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status.status === 'running') {
        // Verificar tempo de execução
        if (task.startTime) {
          const elapsedTime = new Date().getTime() - task.startTime.getTime();
          
          // Atualizar progresso se possível
          if (task.status.itemsTotal) {
            const progress = (task.status.itemsProcessed / task.status.itemsTotal) * 100;
            task.status.progress = Math.min(progress, 99.9); // Nunca chegar a 100% até completar
          } else {
            // Progresso indeterminado, basear em tempo
            task.status.progress = Math.min(elapsedTime / (10 * 60 * 1000) * 100, 99.9); // Assumir 10min como máximo
          }
          
          // Emitir evento de atualização
          this.emit('status-updated', taskId, task.status);
        }
      }
    }
  }
  
  /**
   * Carrega tarefas salvas
   */
  private async loadSavedTasks(): Promise<void> {
    try {
      const savedTasks = await this.configService.getTasks();
      
      this.logService.info(`Carregando ${savedTasks.length} tarefas salvas`);
      
      for (const taskConfig of savedTasks) {
        // Criar objeto de tarefa a partir da configuração
        const task: ScrapingTask = {
          id: taskConfig.id,
          name: taskConfig.name,
          targetUrl: taskConfig.targetUrl,
          options: taskConfig.config,
          status: {
            id: taskConfig.id,
            name: taskConfig.name,
            status: 'idle',
            progress: 0,
            targetUrl: taskConfig.targetUrl,
            itemsProcessed: 0,
            method: taskConfig.config.method || 'browser-automation'
          },
          data: [],
          errors: [],
          stopRequested: false,
          pauseRequested: false
        };
        
        this.tasks.set(taskConfig.id, task);
      }
    } catch (error) {
      this.logService.error('Erro ao carregar tarefas salvas', error);
      throw error;
    }
  }
  
  /**
   * Cria uma nova tarefa de scraping
   */
  public async createTask(options: ScrapingTaskOptions): Promise<string> {
    try {
      const taskId = uuidv4();
      
      // Validar opções
      this.validateTaskOptions(options);
      
      // Criar objeto de tarefa
      const task: ScrapingTask = {
        id: taskId,
        name: options.name,
        targetUrl: options.targetUrl,
        options,
        status: {
          id: taskId,
          name: options.name,
          status: 'idle',
          progress: 0,
          targetUrl: options.targetUrl,
          itemsProcessed: 0,
          method: this.determineScrapingMethod(options)
        },
        data: [],
        errors: [],
        stopRequested: false,
        pauseRequested: false
      };
      
      // Armazenar tarefa
      this.tasks.set(taskId, task);
      
      // Persistir tarefa
      await this.saveTask(task);
      
      this.logService.info(`Tarefa criada: ${options.name} (${taskId})`);
      this.emit('task-created', task);
      
      return taskId;
    } catch (error) {
      this.logService.error('Erro ao criar tarefa', error);
      throw error;
    }
  }
  
  /**
   * Valida as opções da tarefa
   */
  private validateTaskOptions(options: ScrapingTaskOptions): void {
    if (!options.name) {
      throw new Error('Nome da tarefa é obrigatório');
    }
    
    if (!options.targetUrl) {
      throw new Error('URL alvo é obrigatório');
    }
    
    try {
      new URL(options.targetUrl);
    } catch (error) {
      throw new Error(`URL alvo inválido: ${options.targetUrl}`);
    }
    
    if (!options.behaviorSettings) {
      options.behaviorSettings = this.configService.getDefaultBehaviorSettings();
    }
  }
  
  /**
   * Determina o método de scraping com base nas opções
   */
  private determineScrapingMethod(options: ScrapingTaskOptions): ScrapingMethod {
    // Lógica para determinar o melhor método
    // No futuro, isso poderia usar ML para selecionar o método ideal
    
    if (options.selectors && options.selectors.some(s => s.selectorType === 'visual')) {
      return 'visual-scraping';
    }
    
    // Se o site tiver proteções anti-bot avançadas, usar o modo híbrido
    if (options.behaviorSettings && options.behaviorSettings.evasionLevel === 'maximum') {
      return 'hybrid';
    }
    
    // Verificar se há outras opções específicas que podem indicar método preferido
    if (options.method) {
      return options.method;
    }
    
    return 'browser-automation';
  }
  
  /**
   * Inicia a execução de uma tarefa
   */
  public async startTask(taskId: string): Promise<void> {
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new Error(`Tarefa ${taskId} não encontrada`);
      }
      
      // Verificar se já está em execução
      if (task.status.status === 'running') {
        this.logService.warn(`Tarefa ${taskId} já está em execução`);
        return;
      }
      
      // Verificar limite de concorrência
      if (this.activeTasksCount >= this.MAX_CONCURRENT_TASKS) {
        throw new Error(`Limite de tarefas concorrentes atingido (${this.MAX_CONCURRENT_TASKS})`);
      }
      
      // Atualizar status
      task.status.status = 'running';
      task.status.startTime = new Date();
      task.startTime = new Date();
      task.stopRequested = false;
      task.pauseRequested = false;
      
      // Incrementar contador de tarefas ativas
      this.activeTasksCount++;
      
      // Emitir evento de início
      this.emit('task-started', task);
      
      // Executar tarefa no método apropriado
      let result: ScrapingResult;
      try {
        switch (task.status.method) {
          case 'browser-automation':
            result = await this.executeViaBrowser(task);
            break;
          case 'api-client':
            result = await this.executeViaAPI(task);
            break;
          case 'visual-scraping':
            result = await this.executeViaVisualScraping(task);
            break;
          case 'hybrid':
            result = await this.executeViaHybrid(task);
            break;
          case 'direct-request':
            result = await this.executeViaDirectRequest(task);
            break;
          default:
            // Fallback para browser automation
            result = await this.executeViaBrowser(task);
        }
        
        // Atualizar status após conclusão
        task.status.status = 'completed';
        task.status.endTime = new Date();
        task.status.progress = 100;
        task.endTime = new Date();
        
        // Salvar resultados
        await this.saveTaskResults(task, result);
        
        // Emitir evento de conclusão
        this.emit('task-completed', task, result);
        
      } catch (error) {
        // Tratar falha
        this.handleTaskError(taskId, error);
      } finally {
        // Decrementar contador de tarefas ativas
        this.activeTasksCount--;
      }
      
      // Registrar última execução
      await this.configService.updateLastRun(taskId, task.status.status);
      
    } catch (error) {
      this.logService.error(`Erro ao iniciar tarefa ${taskId}`, error);
      throw error;
    }
  }
  
  /**
   * Trata erro na execução de tarefa
   */
  private handleTaskError(taskId: string, error: Error): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    // Atualizar status
    task.status.status = 'failed';
    task.status.endTime = new Date();
    task.status.lastError = error.message;
    task.endTime = new Date();
    task.errors.push(error.message);
    
    // Emitir evento de erro
    this.emit('task-failed', task, error);
    this.emit('error-occurred', taskId, error);
    
    this.logService.error(`Tarefa ${taskId} falhou: ${error.message}`, error);
  }
  
  /**
   * Interrompe a execução de uma tarefa
   */
  public async stopTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Tarefa ${taskId} não encontrada`);
    }
    
    if (task.status.status !== 'running' && task.status.status !== 'paused') {
      this.logService.warn(`Tarefa ${taskId} não está em execução ou pausada`);
      return;
    }
    
    // Marcar para interrupção
    task.stopRequested = true;
    
    // Se tiver sessão ativa, fechá-la
    if (task.sessionId) {
      try {
        await this.browserService.closeSession(task.sessionId);
      } catch (error) {
        this.logService.warn(`Erro ao fechar sessão para tarefa ${taskId}`, error);
      }
    }
    
    // Atualizar status
    task.status.status = 'idle';
    task.status.endTime = new Date();
    task.endTime = new Date();
    
    // Emitir evento de interrupção
    this.emit('task-stopped', task);
    
    this.logService.info(`Tarefa ${taskId} interrompida`);
  }
  
  /**
   * Pausa a execução de uma tarefa
   */
  public async pauseTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Tarefa ${taskId} não encontrada`);
    }
    
    if (task.status.status !== 'running') {
      this.logService.warn(`Tarefa ${taskId} não está em execução`);
      return;
    }
    
    // Marcar para pausa
    task.pauseRequested = true;
    
    // Atualizar status
    task.status.status = 'paused';
    
    // Emitir evento de pausa
    this.emit('task-paused', task);
    
    this.logService.info(`Tarefa ${taskId} pausada`);
  }
  
  /**
   * Retoma a execução de uma tarefa pausada
   */
  public async resumeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Tarefa ${taskId} não encontrada`);
    }
    
    if (task.status.status !== 'paused') {
      this.logService.warn(`Tarefa ${taskId} não está pausada`);
      return;
    }
    
    // Desmarcar pausa
    task.pauseRequested = false;
    
    // Atualizar status
    task.status.status = 'running';
    
    // Emitir evento de retomada
    this.emit('task-resumed', task);
    
    this.logService.info(`Tarefa ${taskId} retomada`);
    
    // Continue from where we left off 
    // The implementation would depend on specifics of how the task execution is structured
    // Aqui podemos reimplementar a lógica de continuar a tarefa de onde parou
  }
  
  /**
   * Remove uma tarefa
   */
  public async removeTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }
    
    // Se estiver em execução, interromper
    if (task.status.status === 'running' || task.status.status === 'paused') {
      await this.stopTask(taskId);
    }
    
    // Remover da persistência
    await this.configService.removeTask(taskId);
    
    // Remover do mapa
    this.tasks.delete(taskId);
    
    this.logService.info(`Tarefa ${taskId} removida`);
    
    return true;
  }
  
  /**
   * Salva uma tarefa na persistência
   */
  private async saveTask(task: ScrapingTask): Promise<void> {
    try {
      const taskConfig = {
        id: task.id,
        name: task.name,
        description: task.options.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        targetUrl: task.targetUrl,
        config: task.options
      };
      
      await this.configService.addTask(taskConfig);
    } catch (error) {
      this.logService.error(`Erro ao salvar tarefa ${task.id}`, error);
      throw error;
    }
  }
  
  /**
   * Salva resultados de uma tarefa
   */
  private async saveTaskResults(task: ScrapingTask, result: ScrapingResult): Promise<void> {
    try {
      // Salvar dados no repositório
      await this.dataRepository.saveResults(task.id, result.data);
      
      // Atualizar tarefa
      task.data = result.data;
      
      this.logService.info(`Resultados salvos para tarefa ${task.id}: ${result.data.length} itens`);
    } catch (error) {
      this.logService.error(`Erro ao salvar resultados para tarefa ${task.id}`, error);
      throw error;
    }
  }
  
  /**
   * Obtém todas as tarefas
   */
  public getAllTasks(): ScrapingTask[] {
    return Array.from(this.tasks.values());
  }
  
  /**
   * Obtém uma tarefa pelo ID
   */
  public getTask(taskId: string): ScrapingTask | null {
    return this.tasks.get(taskId) || null;
  }
  
  /**
   * Obtém o status de uma tarefa
   */
  public getTaskStatus(taskId: string): ScrapingTaskStatus | null {
    const task = this.tasks.get(taskId);
    return task ? task.status : null;
  }
  
  /**
   * Obtém os resultados de uma tarefa
   */
  public async getTaskResults(taskId: string): Promise<any[]> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Tarefa ${taskId} não encontrada`);
    }
    
    // Se já temos dados em memória, retorná-los
    if (task.data.length > 0) {
      return task.data;
    }
    
    // Caso contrário, carregar do repositório
    return this.dataRepository.getResults(taskId);
  }
  
  /**
   * Executa uma tarefa via automação de navegador
   */
  private async executeViaBrowser(task: ScrapingTask): Promise<ScrapingResult> {
    this.logService.info(`Iniciando execução via Browser para tarefa ${task.id}`);
    
    const startTime = new Date();
    const data: any[] = [];
    const errors: string[] = [];
    
    try {
      // Inicializar uma nova sessão de navegador
      const sessionId = await this.browserService.createSession({
        browserType: task.options.browserSettings?.browserType || 'chromium',
        evasionLevel: task.options.behaviorSettings?.evasionLevel,
        humanLike: task.options.behaviorSettings?.humanLike,
        headless: true,
        defaultUrl: task.targetUrl
      });
      
      // Armazenar ID da sessão
      task.sessionId = sessionId;
      
      // TODO: Implementar a lógica real de scraping baseada nas opções da tarefa
      // Incluindo seleção de elementos, navegação, extração de dados, etc.
      
      // Simulação simplificada
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Dados de exemplo
      data.push({ title: "Exemplo de dados extraídos via browser", timestamp: new Date() });
      
      // Incrementar contador de itens processados
      task.status.itemsProcessed = data.length;
      
      // Fechar sessão
      await this.browserService.closeSession(sessionId);
      task.sessionId = undefined;
      
      return {
        taskId: task.id,
        success: true,
        data,
        errors,
        startTime,
        endTime: new Date(),
        itemsProcessed: data.length,
        targetUrl: task.targetUrl
      };
    } catch (error) {
      errors.push(error.message);
      
      // Se tiver sessão, tentar fechá-la
      if (task.sessionId) {
        try {
          await this.browserService.closeSession(task.sessionId);
        } catch (closeError) {
          this.logService.warn(`Erro ao fechar sessão para tarefa ${task.id}`, closeError);
        }
        task.sessionId = undefined;
      }
      
      throw error;
    }
  }
  
  /**
   * Executa uma tarefa via API
   */
  private async executeViaAPI(task: ScrapingTask): Promise<ScrapingResult> {
    this.logService.info(`Iniciando execução via API para tarefa ${task.id}`);
    
    const startTime = new Date();
    const data: any[] = [];
    const errors: string[] = [];
    
    try {
      // TODO: Implementar lógica de API scraping
      
      // Dados de exemplo
      data.push({ title: "Exemplo de dados extraídos via API", timestamp: new Date() });
      
      // Incrementar contador de itens processados
      task.status.itemsProcessed = data.length;
      
      return {
        taskId: task.id,
        success: true,
        data,
        errors,
        startTime,
        endTime: new Date(),
        itemsProcessed: data.length,
        targetUrl: task.targetUrl
      };
    } catch (error) {
      errors.push(error.message);
      throw error;
    }
  }
  
  /**
   * Executa uma tarefa via scraping visual
   */
  private async executeViaVisualScraping(task: ScrapingTask): Promise<ScrapingResult> {
    this.logService.info(`Iniciando execução via Visual Scraping para tarefa ${task.id}`);
    
    const startTime = new Date();
    const data: any[] = [];
    const errors: string[] = [];
    
    try {
      // Inicializar uma nova sessão de navegador
      const sessionId = await this.browserService.createSession({
        browserType: task.options.browserSettings?.browserType || 'chromium',
        evasionLevel: task.options.behaviorSettings?.evasionLevel,
        humanLike: false, // Não precisamos de comportamento humano para captura de screenshots
        headless: true,
        defaultUrl: task.targetUrl
      });
      
      // Armazenar ID da sessão
      task.sessionId = sessionId;
      
      // TODO: Implementar captura e processamento de screenshots
      // Incluindo OCR e análise de imagem usando APIs de IA
      
      // Dados de exemplo
      data.push({ title: "Exemplo de dados extraídos via Visual Scraping", timestamp: new Date() });
      
      // Incrementar contador de itens processados
      task.status.itemsProcessed = data.length;
      
      // Fechar sessão
      await this.browserService.closeSession(sessionId);
      task.sessionId = undefined;
      
      return {
        taskId: task.id,
        success: true,
        data,
        errors,
        startTime,
        endTime: new Date(),
        itemsProcessed: data.length,
        targetUrl: task.targetUrl
      };
    } catch (error) {
      errors.push(error.message);
      
      // Se tiver sessão, tentar fechá-la
      if (task.sessionId) {
        try {
          await this.browserService.closeSession(task.sessionId);
        } catch (closeError) {
          this.logService.warn(`Erro ao fechar sessão para tarefa ${task.id}`, closeError);
        }
        task.sessionId = undefined;
      }
      
      throw error;
    }
  }
  
  /**
   * Executa uma tarefa via modo híbrido (combinando métodos)
   */
  private async executeViaHybrid(task: ScrapingTask): Promise<ScrapingResult> {
    this.logService.info(`Iniciando execução via modo Híbrido para tarefa ${task.id}`);
    
    const startTime = new Date();
    const data: any[] = [];
    const errors: string[] = [];
    
    // Tentar primeiro via Browser
    try {
      const result = await this.executeViaBrowser(task);
      return result;
    } catch (browserError) {
      this.logService.warn(`Método browser falhou para tarefa ${task.id}, tentando Visual Scraping: ${browserError.message}`);
      errors.push(`Browser falhou: ${browserError.message}`);
      
      // Fallback para Visual Scraping
      try {
        const result = await this.executeViaVisualScraping(task);
        return result;
      } catch (visualError) {
        this.logService.warn(`Método Visual Scraping falhou para tarefa ${task.id}, tentando API: ${visualError.message}`);
        errors.push(`Visual Scraping falhou: ${visualError.message}`);
        
        // Fallback final para API
        try {
          const result = await this.executeViaAPI(task);
          return result;
        } catch (apiError) {
          errors.push(`API falhou: ${apiError.message}`);
          throw new Error(`Todos os métodos falharam para tarefa ${task.id}: ${errors.join(', ')}`);
        }
      }
    }
  }
  
  /**
   * Executa uma tarefa via requisição direta
   */
  private async executeViaDirectRequest(task: ScrapingTask): Promise<ScrapingResult> {
    this.logService.info(`Iniciando execução via Requisição Direta para tarefa ${task.id}`);
    
    const startTime = new Date();
    const data: any[] = [];
    const errors: string[] = [];
    
    try {
      // TODO: Implementar lógica de requisição direta
      
      // Dados de exemplo
      data.push({ title: "Exemplo de dados extraídos via Requisição Direta", timestamp: new Date() });
      
      // Incrementar contador de itens processados
      task.status.itemsProcessed = data.length;
      
      return {
        taskId: task.id,
        success: true,
        data,
        errors,
        startTime,
        endTime: new Date(),
        itemsProcessed: data.length,
        targetUrl: task.targetUrl
      };
    } catch (error) {
      errors.push(error.message);
      throw error;
    }
  }
  
  /**
   * Limpa recursos ao desativar
   */
  public dispose(): void {
    // Limpar timer de atualização
    clearInterval(this.taskUpdateInterval);
    
    // Fechar todas as sessões ativas
    for (const task of this.tasks.values()) {
      if (task.sessionId) {
        try {
          this.browserService.closeSession(task.sessionId).catch(() => {});
        } catch (error) {
          this.logService.error(`Erro ao fechar sessão ${task.sessionId} durante dispose`, error);
        }
      }
    }
    
    this.logService.info('ScraperManager desativado com sucesso');
  }
}
