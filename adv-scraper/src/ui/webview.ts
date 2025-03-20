import * as vscode from 'vscode';
import { ExtensionContext } from '../types/context';

// Painel de webview
let webviewPanel: vscode.WebviewPanel | undefined;

export function setupWebviewPanel(
  context: vscode.ExtensionContext,
  extensionContext: ExtensionContext
): vscode.Disposable[] {
  const subscriptions: vscode.Disposable[] = [];
  
  // Registrar comando para abrir o webview
  subscriptions.push(
    vscode.commands.registerCommand('adv-scraper.webview.open', () => {
      if (webviewPanel) {
        // Se o painel já existe, mostrar
        webviewPanel.reveal();
      } else {
        // Criar novo painel
        webviewPanel = vscode.window.createWebviewPanel(
          'advScraperDashboard',
          'Advanced Web Scraper - Dashboard',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
              vscode.Uri.joinPath(context.extensionUri, 'media')
            ]
          }
        );
        
        // Configurar conteúdo HTML
        webviewPanel.webview.html = getWebviewContent(webviewPanel.webview, context);
        
        // Manipular mensagens recebidas
        webviewPanel.webview.onDidReceiveMessage(
          message => handleWebviewMessage(message, extensionContext),
          undefined,
          subscriptions
        );
        
        // Reagir ao fechamento do painel
        webviewPanel.onDidDispose(
          () => {
            webviewPanel = undefined;
          },
          null,
          subscriptions
        );
      }
    })
  );
  
  return subscriptions;
}

/**
 * Gera o conteúdo HTML para o webview
 */
function getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext): string {
  // Caminho para recursos (CSS, JS)
  const stylesUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'styles.css')
  );
  
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'main.js')
  );
  
  const nonce = getNonce();
  
  // HTML básico com CSP
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource};">
  <link href="${stylesUri}" rel="stylesheet">
  <title>Advanced Web Scraper</title>
</head>
<body>
  <header>
    <h1>Advanced Web Scraper</h1>
    <p>Painel de controle para tarefas de scraping</p>
  </header>
  
  <nav class="tabs">
    <button class="tab-button active" data-tab="dashboard">Dashboard</button>
    <button class="tab-button" data-tab="tasks">Tarefas</button>
    <button class="tab-button" data-tab="identities">Identidades</button>
    <button class="tab-button" data-tab="proxies">Proxies</button>
    <button class="tab-button" data-tab="settings">Configurações</button>
  </nav>
  
  <main>
    <!-- Tab content -->
    <section id="dashboard" class="tab-content active">
      <h2>Dashboard</h2>
      <div class="dashboard-grid">
        <div class="card">
          <h3>Tarefas Ativas</h3>
          <div class="task-list" id="active-tasks">
            <p>Carregando tarefas...</p>
          </div>
        </div>
        
        <div class="card">
          <h3>Estatísticas</h3>
          <div class="stats">
            <div class="stat-item">
              <span class="stat-label">Total de Tarefas</span>
              <span class="stat-value" id="total-tasks">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Em Execução</span>
              <span class="stat-value" id="running-tasks">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Completadas</span>
              <span class="stat-value" id="completed-tasks">0</span>
            </div>
          </div>
        </div>
      </div>
    </section>
    
    <section id="tasks" class="tab-content">
      <h2>Gerenciar Tarefas</h2>
      <div class="actions">
        <button id="create-task">Nova Tarefa</button>
      </div>
      
      <div class="task-list" id="all-tasks">
        <p>Carregando tarefas...</p>
      </div>
    </section>
    
    <section id="identities" class="tab-content">
      <h2>Gerenciar Identidades</h2>
      <div class="actions">
        <button id="create-identity">Nova Identidade</button>
      </div>
      
      <div class="identity-list" id="all-identities">
        <p>Carregando identidades...</p>
      </div>
    </section>
    
    <section id="proxies" class="tab-content">
      <h2>Gerenciar Proxies</h2>
      <div class="actions">
        <button id="create-proxy">Novo Proxy</button>
      </div>
      
      <div class="proxy-list" id="all-proxies">
        <p>Carregando proxies...</p>
      </div>
    </section>
    
    <section id="settings" class="tab-content">
      <h2>Configurações</h2>
      <form id="settings-form">
        <div class="form-group">
          <label for="ai-provider">Provedor de IA</label>
          <select id="ai-provider" name="ai-provider">
            <option value="openai">OpenAI</option>
            <option value="gemini">Google Gemini</option>
            <option value="claude">Anthropic Claude</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="api-key">API Key</label>
          <input type="password" id="api-key" name="api-key" placeholder="API Key do provedor selecionado">
        </div>
        
        <div class="form-group">
          <label for="default-behavior">Comportamento Padrão</label>
          <select id="default-behavior" name="default-behavior">
            <option value="standard">Standard</option>
            <option value="advanced">Advanced</option>
            <option value="maximum">Maximum</option>
          </select>
        </div>
        
        <div class="form-group">
          <button type="submit">Salvar Configurações</button>
        </div>
      </form>
    </section>
  </main>
  
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

/**
 * Processa mensagens recebidas do webview
 */
function handleWebviewMessage(
  message: any,
  extensionContext: ExtensionContext
): void {
  switch (message.command) {
    case 'createTask':
      vscode.commands.executeCommand('adv-scraper.createTask');
      break;
      
    case 'startTask':
      vscode.commands.executeCommand('adv-scraper.startTask', message.taskId);
      break;
      
    case 'stopTask':
      vscode.commands.executeCommand('adv-scraper.stopTask', message.taskId);
      break;
      
    case 'createIdentity':
      vscode.commands.executeCommand('adv-scraper.configureIdentity');
      break;
      
    case 'createProxy':
      vscode.commands.executeCommand('adv-scraper.configureProxy');
      break;
      
    case 'saveSettings':
      // Salvar configurações
      const { provider, apiKey, behavior } = message.settings;
      extensionContext.configService.setConfig('aiServices', {
        enabled: true,
        provider,
        apiKey
      });
      
      extensionContext.configService.setConfig('securityLevel', behavior);
      
      vscode.window.showInformationMessage('Configurações salvas com sucesso!');
      break;
      
    case 'getTasks':
      // Retornar lista de tarefas
      if (extensionContext.scraperManager) {
        const tasks = extensionContext.scraperManager.getAllTasks();
        webviewPanel?.webview.postMessage({
          command: 'tasksData',
          tasks
        });
      }
      break;
      
    default:
      console.log('Mensagem não reconhecida:', message);
  }
}

/**
 * Gera um nonce aleatório para CSP
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
