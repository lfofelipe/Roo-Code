import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Níveis de log suportados
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Configurações para o sistema de log
 */
interface LogOptions {
  // Diretório onde os logs serão salvos
  logDirectory?: string;
  
  // Nível mínimo de log
  minLevel?: LogLevel;
  
  // Nome do arquivo de log
  logFileName?: string;
  
  // Se deve mostrar mensagens no console do VS Code
  showInOutputChannel?: boolean;
  
  // Se deve salvar logs em arquivo
  saveToFile?: boolean;
  
  // Tamanho máximo do arquivo de log em bytes
  maxFileSize?: number;
  
  // Número máximo de arquivos de backup
  maxBackupCount?: number;
}

/**
 * Serviço de log para a extensão
 */
export class LogService {
  private static readonly LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  
  private readonly outputChannel: vscode.OutputChannel;
  private readonly options: LogOptions;
  private logFilePath: string | null = null;
  
  /**
   * Construtor do serviço de log
   */
  constructor(options: LogOptions = {}) {
    // Opções padrão
    this.options = {
      minLevel: 'info',
      logFileName: 'adv-scraper.log',
      showInOutputChannel: true,
      saveToFile: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      maxBackupCount: 3,
      ...options
    };
    
    // Criar canal de saída
    this.outputChannel = vscode.window.createOutputChannel('Advanced Web Scraper');
    
    // Configurar diretório de log
    if (this.options.saveToFile) {
      this.setupLogDirectory();
    }
    
    // Log inicial
    this.info('LogService inicializado');
  }
  
  /**
   * Configura o diretório de log
   */
  private setupLogDirectory(): void {
    try {
      let logDir = this.options.logDirectory;
      
      // Se diretório não foi especificado, criar um no diretório de logs do VS Code
      if (!logDir) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
          logDir = path.join(workspaceFolder.uri.fsPath, '.adv-scraper', 'logs');
        } else {
          // Estado global da extensão, independente do workspace
          const extensionContext = vscode.extensions.getExtension('advanced-web-scraper.adv-scraper');
          if (extensionContext) {
            logDir = path.join(extensionContext.extensionPath, 'logs');
          } else {
            // Fallback para diretório temporário
            logDir = path.join(require('os').tmpdir(), 'adv-scraper-logs');
          }
        }
      }
      
      // Criar diretório se não existir
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      // Caminho completo para o arquivo de log
      this.logFilePath = path.join(logDir, this.options.logFileName!);
      
      // Verificar rotação de logs
      this.checkLogRotation();
      
    } catch (error) {
      console.error('Erro ao configurar diretório de log:', error);
      this.logFilePath = null;
    }
  }
  
  /**
   * Verifica se o arquivo de log precisa ser rotacionado
   */
  private checkLogRotation(): void {
    if (!this.logFilePath || !fs.existsSync(this.logFilePath)) {
      return;
    }
    
    try {
      const stats = fs.statSync(this.logFilePath);
      
      // Se o arquivo for maior que o tamanho máximo, rotacionar
      if (stats.size > this.options.maxFileSize!) {
        this.rotateLogFile();
      }
    } catch (error) {
      console.error('Erro ao verificar tamanho do arquivo de log:', error);
    }
  }
  
  /**
   * Rotaciona o arquivo de log
   */
  private rotateLogFile(): void {
    if (!this.logFilePath) return;
    
    try {
      // Remover arquivo de backup mais antigo se exceder o número máximo
      const backupPath = `${this.logFilePath}.${this.options.maxBackupCount}`;
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
      
      // Movimentar arquivos de backup
      for (let i = this.options.maxBackupCount! - 1; i >= 1; i--) {
        const oldPath = `${this.logFilePath}.${i}`;
        const newPath = `${this.logFilePath}.${i + 1}`;
        
        if (fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath);
        }
      }
      
      // Renomear arquivo atual para .1
      fs.renameSync(this.logFilePath, `${this.logFilePath}.1`);
      
    } catch (error) {
      console.error('Erro ao rotacionar arquivo de log:', error);
    }
  }
  
  /**
   * Verifica se um nível de log deve ser registrado
   */
  private shouldLog(level: LogLevel): boolean {
    return LogService.LOG_LEVELS[level] >= LogService.LOG_LEVELS[this.options.minLevel!];
  }
  
  /**
   * Registra uma mensagem de log
   */
  private log(level: LogLevel, message: string, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }
    
    // Formatar mensagem
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const millis = String(now.getMilliseconds()).padStart(3, '0');
    
    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${millis}`;
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Adicionar stack trace se disponível
    if (error && error.stack) {
      logMessage += `\n${error.stack}`;
    }
    
    // Mostrar no canal de saída
    if (this.options.showInOutputChannel) {
      this.outputChannel.appendLine(logMessage);
    }
    
    // Salvar em arquivo
    if (this.options.saveToFile && this.logFilePath) {
      this.writeToFile(logMessage);
    }
  }
  
  /**
   * Escreve no arquivo de log
   */
  private writeToFile(message: string): void {
    if (!this.logFilePath) return;
    
    try {
      // Verificar rotação de logs
      this.checkLogRotation();
      
      // Adicionar quebra de linha
      message += '\n';
      
      // Criar arquivo se não existir, ou adicionar ao existente
      fs.appendFileSync(this.logFilePath, message, { encoding: 'utf8' });
    } catch (error) {
      console.error('Erro ao escrever no arquivo de log:', error);
    }
  }
  
  /**
   * Registra uma mensagem de debug
   */
  public debug(message: string, error?: Error): void {
    this.log('debug', message, error);
  }
  
  /**
   * Registra uma mensagem de informação
   */
  public info(message: string, error?: Error): void {
    this.log('info', message, error);
  }
  
  /**
   * Registra uma mensagem de aviso
   */
  public warn(message: string, error?: Error): void {
    this.log('warn', message, error);
  }
  
  /**
   * Registra uma mensagem de erro
   */
  public error(message: string, error?: Error): void {
    this.log('error', message, error);
  }
  
  /**
   * Mostra o painel de saída
   */
  public show(): void {
    this.outputChannel.show();
  }
  
  /**
   * Limpa o conteúdo do painel de saída
   */
  public clear(): void {
    this.outputChannel.clear();
  }
  
  /**
   * Altera o nível mínimo de log
   */
  public setLogLevel(level: LogLevel): void {
    this.options.minLevel = level;
    this.info(`Nível de log alterado para: ${level}`);
  }
  
  /**
   * Libera recursos
   */
  public dispose(): void {
    this.outputChannel.dispose();
  }
}
