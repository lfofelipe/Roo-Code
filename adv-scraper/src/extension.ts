import * as vscode from 'vscode';
import { ScraperManager } from './core/scraperManager';
import { ExtensionContext } from './types/context';
import { registerCommands } from './ui/commands';
import { setupWebviewPanel } from './ui/webview';
import { SecureStorageService } from './services/secureStorage';
import { ConfigService } from './services/configService';
import { LogService } from './utils/logService';
import { ProxyManager } from './services/proxyManager';
import { IdentityManager } from './services/identityManager';
import { BrowserAutomationService } from './services/browser/browserAutomation';
import { AIProcessingService } from './services/ai/aiProcessing';
import { DataRepository } from './services/dataRepository';

// Contexto global da extensão
const extensionContext: ExtensionContext = {
  scraperManager: null,
  secureStorage: null,
  configService: null,
  logService: null,
  proxyManager: null,
  identityManager: null,
  browserService: null,
  aiService: null,
  dataRepository: null,
};

export async function activate(context: vscode.ExtensionContext) {
  try {
    // Inicializa serviços básicos
    extensionContext.logService = new LogService();
    extensionContext.logService.info('Advanced Web Scraper: Inicializando extensão...');

    extensionContext.secureStorage = new SecureStorageService(context.secrets);
    extensionContext.configService = new ConfigService(context);
    
    // Inicializa serviços dependentes
    extensionContext.proxyManager = new ProxyManager(
      extensionContext.configService,
      extensionContext.secureStorage,
      extensionContext.logService
    );
    
    extensionContext.identityManager = new IdentityManager(
      extensionContext.configService,
      extensionContext.secureStorage,
      extensionContext.logService
    );
    
    extensionContext.browserService = new BrowserAutomationService(
      extensionContext.configService,
      extensionContext.identityManager,
      extensionContext.proxyManager,
      extensionContext.logService
    );
    
    extensionContext.aiService = new AIProcessingService(
      extensionContext.configService,
      extensionContext.logService
    );
    
    extensionContext.dataRepository = new DataRepository(
      extensionContext.configService,
      extensionContext.logService
    );
    
    // Inicializa o gerenciador principal
    extensionContext.scraperManager = new ScraperManager(
      extensionContext.configService,
      extensionContext.browserService,
      extensionContext.identityManager,
      extensionContext.proxyManager,
      extensionContext.aiService,
      extensionContext.dataRepository,
      extensionContext.logService
    );
    
    // Registra comandos e interfaces
    context.subscriptions.push(
      ...registerCommands(extensionContext),
      ...setupWebviewPanel(context, extensionContext)
    );
    
    // Registra provedores de views
    registerViewProviders(context, extensionContext);
    
    extensionContext.logService.info('Advanced Web Scraper: Extensão inicializada com sucesso');
    
    // Mostra mensagem de ativação
    vscode.window.showInformationMessage('Advanced Web Scraper ativado com sucesso!');
  } catch (error) {
    console.error('Erro ao inicializar a extensão:', error);
    vscode.window.showErrorMessage(`Erro ao inicializar Advanced Web Scraper: ${error.message}`);
  }
}

function registerViewProviders(context: vscode.ExtensionContext, extContext: ExtensionContext) {
  // Registra os provedores de visualização para os painéis laterais
  const taskProvider = new TasksViewProvider(extContext);
  const profilesProvider = new ProfilesViewProvider(extContext);
  const monitoringProvider = new MonitoringViewProvider(extContext);
  const resultsProvider = new ResultsViewProvider(extContext);
  
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('scraper-tasks', taskProvider),
    vscode.window.registerTreeDataProvider('scraper-profiles', profilesProvider),
    vscode.window.registerTreeDataProvider('scraper-monitoring', monitoringProvider),
    vscode.window.registerTreeDataProvider('scraper-results', resultsProvider)
  );
}

// Classes para os provedores de visualização
class TasksViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  constructor(private context: ExtensionContext) {}
  
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }
  
  getChildren(): Thenable<vscode.TreeItem[]> {
    // Implementação simplificada - será expandida
    return Promise.resolve([
      new vscode.TreeItem('Nova Tarefa', vscode.TreeItemCollapsibleState.None),
      new vscode.TreeItem('Tarefas Salvas', vscode.TreeItemCollapsibleState.Collapsed)
    ]);
  }
}

class ProfilesViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  constructor(private context: ExtensionContext) {}
  
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }
  
  getChildren(): Thenable<vscode.TreeItem[]> {
    // Implementação simplificada - será expandida
    return Promise.resolve([
      new vscode.TreeItem('Novo Perfil', vscode.TreeItemCollapsibleState.None),
      new vscode.TreeItem('Perfis Salvos', vscode.TreeItemCollapsibleState.Collapsed)
    ]);
  }
}

class MonitoringViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  constructor(private context: ExtensionContext) {}
  
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }
  
  getChildren(): Thenable<vscode.TreeItem[]> {
    // Implementação simplificada - será expandida
    return Promise.resolve([
      new vscode.TreeItem('Tarefas Ativas', vscode.TreeItemCollapsibleState.Collapsed),
      new vscode.TreeItem('Relatórios', vscode.TreeItemCollapsibleState.Collapsed)
    ]);
  }
}

class ResultsViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  constructor(private context: ExtensionContext) {}
  
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }
  
  getChildren(): Thenable<vscode.TreeItem[]> {
    // Implementação simplificada - será expandida
    return Promise.resolve([
      new vscode.TreeItem('Resultados Recentes', vscode.TreeItemCollapsibleState.Collapsed),
      new vscode.TreeItem('Exportar Dados', vscode.TreeItemCollapsibleState.None)
    ]);
  }
}

export function deactivate() {
  // Limpar recursos ao desativar
  if (extensionContext.browserService) {
    // Fechar todas as sessões de navegador ativas
    const activeSessions = extensionContext.browserService.getActiveSessions();
    for (const sessionId of activeSessions) {
      extensionContext.browserService.closeSession(sessionId).catch(() => {});
    }
  }
  
  // Liberar recursos dos serviços
  if (extensionContext.scraperManager) {
    extensionContext.scraperManager.dispose();
  }
  
  if (extensionContext.configService) {
    extensionContext.configService.dispose();
  }
  
  if (extensionContext.logService) {
    extensionContext.logService.info('Advanced Web Scraper: Extensão desativada');
  }
}
