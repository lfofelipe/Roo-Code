import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { LogService } from '../utils/logService';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * Serviço de configuração para gerenciar configurações persistentes
 */
export class ConfigService {
  private configPath: string;
  private config: Record<string, any> = {};
  private isInitialized = false;

  constructor(
    private logService: LogService,
    configDir?: string
  ) {
    // Definir diretório de configuração padrão se não especificado
    const defaultConfigDir = path.join(process.cwd(), 'config');
    this.configPath = path.join(configDir || defaultConfigDir, 'settings.json');
  }

  /**
   * Inicializa o serviço de configuração
   */
  public async initialize(): Promise<void> {
    try {
      // Garantir que o diretório de configuração existe
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        await mkdir(configDir, { recursive: true });
      }

      // Carregar configurações se o arquivo existir
      if (fs.existsSync(this.configPath)) {
        const data = await readFile(this.configPath, 'utf-8');
        this.config = JSON.parse(data);
      } else {
        // Criar arquivo inicial de configuração vazio
        this.config = {};
        await this.save();
      }

      this.isInitialized = true;
      this.logService.info('Serviço de configuração inicializado');
    } catch (error) {
      this.logService.error('Erro ao inicializar serviço de configuração', error);
      throw error;
    }
  }

  /**
   * Obtém um valor de configuração pelo caminho (com notação de ponto)
   */
  public async get<T>(key: string, defaultValue?: T): Promise<T> {
    this.ensureInitialized();

    // Percorrer o objeto de configuração seguindo o caminho
    const parts = key.split('.');
    let current: any = this.config;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (current === undefined || current === null || typeof current !== 'object') {
        return defaultValue as T;
      }
      current = current[part];
    }

    return (current === undefined) ? (defaultValue as T) : current;
  }

  /**
   * Define um valor de configuração pelo caminho (com notação de ponto)
   */
  public async set<T>(key: string, value: T): Promise<void> {
    this.ensureInitialized();

    // Percorrer e criar caminho no objeto de configuração
    const parts = key.split('.');
    let current = this.config;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }

    // Definir valor final
    current[parts[parts.length - 1]] = value;

    // Salvar no arquivo
    await this.save();
  }

  /**
   * Remove uma configuração pelo caminho
   */
  public async remove(key: string): Promise<boolean> {
    this.ensureInitialized();

    // Percorrer o objeto de configuração seguindo o caminho
    const parts = key.split('.');
    let current = this.config;
    const stack = [current];

    // Navegar até o penúltimo nó
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current === undefined || current === null || typeof current !== 'object') {
        return false;
      }
      current = current[part];
      if (current === undefined) {
        return false;
      }
      stack.push(current);
    }

    const lastPart = parts[parts.length - 1];
    const exists = lastPart in current;

    if (exists) {
      delete current[lastPart];
      await this.save();
    }

    return exists;
  }

  /**
   * Salva as configurações no arquivo
   */
  private async save(): Promise<void> {
    try {
      const data = JSON.stringify(this.config, null, 2);
      await writeFile(this.configPath, data, 'utf-8');
    } catch (error) {
      this.logService.error('Erro ao salvar configurações', error);
      throw error;
    }
  }

  /**
   * Garante que o serviço foi inicializado
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Serviço de configuração não inicializado');
    }
  }
}
