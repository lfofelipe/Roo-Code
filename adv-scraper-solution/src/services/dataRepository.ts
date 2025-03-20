import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from './configService';
import { LogService } from '../utils/logService';

/**
 * Interface para resultados salvos
 */
export interface SavedResultsMetadata {
  taskId: string;
  timestamp: string;
  count: number;
  format: string;
  path: string;
}

/**
 * Serviço para armazenamento e recuperação de dados coletados
 */
export class DataRepository {
  private dataDir: string;
  private resultsDir: string;
  private metadataFile: string;
  private resultsMetadata: Map<string, SavedResultsMetadata[]> = new Map();
  
  constructor(
    private configService: ConfigService,
    private logService: LogService
  ) {
    // Obter diretório de armazenamento das configurações
    this.dataDir = this.configService.getDataDirectory();
    this.resultsDir = path.join(this.dataDir, 'results');
    this.metadataFile = path.join(this.dataDir, 'results-metadata.json');
    
    // Criar diretórios se não existirem
    this.initializeDirectories();
    
    // Carregar metadados salvos
    this.loadMetadata();
  }
  
  /**
   * Inicializa os diretórios necessários
   */
  private initializeDirectories(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      
      if (!fs.existsSync(this.resultsDir)) {
        fs.mkdirSync(this.resultsDir, { recursive: true });
      }
    } catch (error) {
      this.logService.error('Erro ao criar diretórios para dados', error);
      throw error;
    }
  }
  
  /**
   * Carrega metadados de resultados salvos
   */
  private loadMetadata(): void {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const content = fs.readFileSync(this.metadataFile, 'utf8');
        const metadata = JSON.parse(content);
        
        // Converter para formato de Map
        for (const taskId in metadata) {
          this.resultsMetadata.set(taskId, metadata[taskId]);
        }
        
        this.logService.info(`Metadados de resultados carregados para ${this.resultsMetadata.size} tarefas`);
      } else {
        this.logService.info('Arquivo de metadados não existe, iniciando com estado vazio');
      }
    } catch (error) {
      this.logService.error('Erro ao carregar metadados de resultados', error);
      // Iniciar com estado vazio em caso de erro
    }
  }
  
  /**
   * Salva metadados de resultados
   */
  private saveMetadata(): void {
    try {
      // Converter de Map para objeto JSON
      const metadataObj: Record<string, SavedResultsMetadata[]> = {};
      
      for (const [taskId, metadata] of this.resultsMetadata.entries()) {
        metadataObj[taskId] = metadata;
      }
      
      fs.writeFileSync(this.metadataFile, JSON.stringify(metadataObj, null, 2), 'utf8');
    } catch (error) {
      this.logService.error('Erro ao salvar metadados de resultados', error);
      throw error;
    }
  }
  
  /**
   * Salva resultados para uma tarefa
   */
  public async saveResults(taskId: string, data: any[]): Promise<string> {
    if (!data || data.length === 0) {
      throw new Error('Dados vazios, nada para salvar');
    }
    
    try {
      // Criar diretório específico para a tarefa se não existir
      const taskDir = path.join(this.resultsDir, taskId);
      if (!fs.existsSync(taskDir)) {
        fs.mkdirSync(taskDir, { recursive: true });
      }
      
      // Criar nome de arquivo baseado no timestamp
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filePath = path.join(taskDir, `results-${timestamp}.json`);
      
      // Salvar dados em formato JSON
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      
      // Atualizar metadados
      const metadata: SavedResultsMetadata = {
        taskId,
        timestamp,
        count: data.length,
        format: 'json',
        path: filePath
      };
      
      // Adicionar aos metadados
      const taskMetadata = this.resultsMetadata.get(taskId) || [];
      taskMetadata.push(metadata);
      this.resultsMetadata.set(taskId, taskMetadata);
      
      // Salvar metadados atualizados
      this.saveMetadata();
      
      this.logService.info(`Resultados salvos para tarefa ${taskId}: ${data.length} itens em ${filePath}`);
      
      return filePath;
    } catch (error) {
      this.logService.error(`Erro ao salvar resultados para tarefa ${taskId}`, error);
      throw error;
    }
  }
  
  /**
   * Obtém resultados para uma tarefa
   */
  public async getResults(taskId: string): Promise<any[]> {
    try {
      const taskMetadata = this.resultsMetadata.get(taskId);
      if (!taskMetadata || taskMetadata.length === 0) {
        return [];
      }
      
      // Obter o resultado mais recente
      const latestMetadata = taskMetadata[taskMetadata.length - 1];
      
      // Verificar se o arquivo existe
      if (!fs.existsSync(latestMetadata.path)) {
        throw new Error(`Arquivo de resultados não encontrado: ${latestMetadata.path}`);
      }
      
      // Ler e retornar dados
      const content = fs.readFileSync(latestMetadata.path, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.logService.error(`Erro ao obter resultados para tarefa ${taskId}`, error);
      throw error;
    }
  }
  
  /**
   * Obtém histórico de resultados para uma tarefa
   */
  public getResultsHistory(taskId: string): SavedResultsMetadata[] {
    return this.resultsMetadata.get(taskId) || [];
  }
  
  /**
   * Exporta resultados para um formato específico
   */
  public async exportResults(taskId: string, format: 'json' | 'csv' | 'xlsx', outputPath?: string): Promise<string> {
    try {
      // Obter os dados mais recentes
      const data = await this.getResults(taskId);
      
      if (data.length === 0) {
        throw new Error('Sem dados para exportar');
      }
      
      // Definir caminho de saída se não foi fornecido
      if (!outputPath) {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        outputPath = path.join(this.dataDir, 'exports', `${taskId}-${timestamp}.${format}`);
        
        // Garantir que o diretório existe
        const exportDir = path.dirname(outputPath);
        if (!fs.existsSync(exportDir)) {
          fs.mkdirSync(exportDir, { recursive: true });
        }
      }
      
      // Exportar para o formato solicitado
      switch (format) {
        case 'json':
          fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
          break;
          
        case 'csv':
          const csvContent = this.convertToCSV(data);
          fs.writeFileSync(outputPath, csvContent, 'utf8');
          break;
          
        case 'xlsx':
          // Para XLSX, seria necessário usar uma biblioteca como ExcelJS
          // Como simplificação, vamos apenas salvar em JSON
          fs.writeFileSync(
            outputPath.replace(/\.xlsx$/, '.json'), 
            JSON.stringify(data, null, 2), 
            'utf8'
          );
          outputPath = outputPath.replace(/\.xlsx$/, '.json');
          break;
      }
      
      this.logService.info(`Resultados exportados para ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.logService.error(`Erro ao exportar resultados para tarefa ${taskId}`, error);
      throw error;
    }
  }
  
  /**
   * Converte dados para formato CSV
   */
  private convertToCSV(data: any[]): string {
    if (data.length === 0) {
      return '';
    }
    
    // Extrair cabeçalhos (do primeiro objeto)
    const headers = Object.keys(data[0]);
    
    // Criar linha de cabeçalho
    let csv = headers.join(',') + '\n';
    
    // Adicionar linhas de dados
    for (const item of data) {
      const values = headers.map(header => {
        const value = item[header];
        // Lidar com valores que podem conter vírgulas ou quebras de linha
        if (value === null || value === undefined) {
          return '';
        } else if (typeof value === 'string') {
          // Escapar aspas e envolver em aspas
          return `"${value.replace(/"/g, '""')}"`;
        } else if (typeof value === 'object') {
          // Converter objetos para string JSON e envolver em aspas
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        } else {
          return value;
        }
      });
      
      csv += values.join(',') + '\n';
    }
    
    return csv;
  }
  
  /**
   * Remove resultados para uma tarefa
   */
  public removeResults(taskId: string): boolean {
    try {
      const taskMetadata = this.resultsMetadata.get(taskId);
      if (!taskMetadata || taskMetadata.length === 0) {
        return false;
      }
      
      // Remover todos os arquivos
      for (const metadata of taskMetadata) {
        if (fs.existsSync(metadata.path)) {
          fs.unlinkSync(metadata.path);
        }
      }
      
      // Remover diretório da tarefa
      const taskDir = path.join(this.resultsDir, taskId);
      if (fs.existsSync(taskDir)) {
        fs.rmdirSync(taskDir);
      }
      
      // Remover metadados
      this.resultsMetadata.delete(taskId);
      this.saveMetadata();
      
      this.logService.info(`Resultados removidos para tarefa ${taskId}`);
      return true;
    } catch (error) {
      this.logService.error(`Erro ao remover resultados para tarefa ${taskId}`, error);
      return false;
    }
  }
}
