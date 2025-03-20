/**
 * Níveis de log disponíveis
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Interface para um manipulador de logs
 */
export interface LogHandler {
  log(level: LogLevel, message: string, context?: any): void;
}

/**
 * Manipulador de logs para console
 */
export class ConsoleLogHandler implements LogHandler {
  constructor(private minLevel: LogLevel = LogLevel.INFO) {}

  public log(level: LogLevel, message: string, context?: any): void {
    if (level < this.minLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = this.getLevelPrefix(level);

    // Mensagem básica com timestamp e prefixo de nível
    const formattedMessage = `${timestamp} ${prefix} ${message}`;

    // Escolher método de console apropriado para o nível
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        if (context) console.debug(context);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        if (context) console.info(context);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        if (context) console.warn(context);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        if (context) console.error(context);
        break;
    }
  }

  private getLevelPrefix(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '[DEBUG]';
      case LogLevel.INFO:
        return '[INFO]';
      case LogLevel.WARN:
        return '[WARN]';
      case LogLevel.ERROR:
        return '[ERROR]';
      default:
        return '[LOG]';
    }
  }
}

/**
 * Manipulador de logs para arquivo
 */
export class FileLogHandler implements LogHandler {
  private fs: any;
  private path: any;
  private logFilePath: string;
  private writeStream: any;

  constructor(
    logDirectory: string,
    private minLevel: LogLevel = LogLevel.INFO
  ) {
    // Importar módulos dinamicamente para evitar problemas em ambiente de navegador
    this.fs = require('fs');
    this.path = require('path');

    // Garantir que o diretório de logs exista
    if (!this.fs.existsSync(logDirectory)) {
      this.fs.mkdirSync(logDirectory, { recursive: true });
    }

    // Criar nome de arquivo com data atual
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.logFilePath = this.path.join(logDirectory, `adv-scraper-${date}.log`);

    // Criar ou abrir stream para escrita
    this.writeStream = this.fs.createWriteStream(this.logFilePath, { flags: 'a' });
  }

  public log(level: LogLevel, message: string, context?: any): void {
    if (level < this.minLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = this.getLevelPrefix(level);
    
    try {
      // Formatar mensagem básica
      let logEntry = `${timestamp} ${prefix} ${message}\n`;
      
      // Adicionar contexto se fornecido
      if (context) {
        if (context instanceof Error) {
          logEntry += `Stack: ${context.stack || context.toString()}\n`;
        } else {
          try {
            logEntry += `Context: ${JSON.stringify(context)}\n`;
          } catch (error) {
            logEntry += `Context: [Non-serializable object]\n`;
          }
        }
      }
      
      // Escrever no arquivo
      this.writeStream.write(logEntry);
    } catch (error) {
      console.error('Erro ao escrever no arquivo de log:', error);
    }
  }
  
  private getLevelPrefix(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '[DEBUG]';
      case LogLevel.INFO:
        return '[INFO]';
      case LogLevel.WARN:
        return '[WARN]';
      case LogLevel.ERROR:
        return '[ERROR]';
      default:
        return '[LOG]';
    }
  }
  
  public close(): void {
    if (this.writeStream) {
      this.writeStream.end();
    }
  }
}

/**
 * Serviço de log principal
 */
export class LogService {
  private handlers: LogHandler[] = [];
  private minLevel: LogLevel = LogLevel.INFO;

  constructor() {
    // Adicionar manipulador de console por padrão
    this.addHandler(new ConsoleLogHandler(this.minLevel));
  }

  /**
   * Define o nível mínimo de logs
   */
  public setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Adiciona um manipulador de logs
   */
  public addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Log de nível DEBUG
   */
  public debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log de nível INFO
   */
  public info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log de nível WARN
   */
  public warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log de nível ERROR
   */
  public error(message: string, context?: any): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Método principal de log
   */
  private log(level: LogLevel, message: string, context?: any): void {
    if (level < this.minLevel) {
      return;
    }

    for (const handler of this.handlers) {
      handler.log(level, message, context);
    }
  }
}
