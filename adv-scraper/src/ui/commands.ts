import * as vscode from 'vscode';
import { ExtensionContext } from '../types/context';

export function registerCommands(context: ExtensionContext): vscode.Disposable[] {
  const subscriptions: vscode.Disposable[] = [];
  
  // Comando para criar nova tarefa
  subscriptions.push(
    vscode.commands.registerCommand('adv-scraper.createTask', async () => {
      try {
        vscode.window.showInformationMessage('Criando nova tarefa...');
        // Implementação a ser expandida
      } catch (error) {
        vscode.window.showErrorMessage(`Erro ao criar tarefa: ${error.message}`);
        context.logService.error('Erro ao criar tarefa', error);
      }
    })
  );
  
  // Comando para iniciar uma tarefa
  subscriptions.push(
    vscode.commands.registerCommand('adv-scraper.startTask', async (taskId?: string) => {
      try {
        if (!taskId) {
          const tasks = await context.configService.getTasks();
          if (tasks.length === 0) {
            vscode.window.showInformationMessage('Não há tarefas para executar. Crie uma nova tarefa primeiro.');
            return;
          }
          
          interface TaskQuickPickItem extends vscode.QuickPickItem {
            id: string;
          }
          
          const taskItems: TaskQuickPickItem[] = tasks.map(task => ({ 
            label: task.name,
            description: task.targetUrl,
            id: task.id
          }));
          
          const selectedTask = await vscode.window.showQuickPick(taskItems, {
            placeHolder: 'Selecione uma tarefa para executar'
          });
          
          if (!selectedTask) return;
          
          taskId = selectedTask.id;
        }
        
        vscode.window.showInformationMessage(`Iniciando tarefa...`);
        await context.scraperManager.startTask(taskId);
        
      } catch (error) {
        vscode.window.showErrorMessage(`Erro ao iniciar tarefa: ${error.message}`);
        context.logService.error('Erro ao iniciar tarefa', error);
      }
    })
  );
  
  // Comando para parar uma tarefa
  subscriptions.push(
    vscode.commands.registerCommand('adv-scraper.stopTask', async (taskId?: string) => {
      try {
        if (!taskId) {
          const activeTasks = context.scraperManager.getAllTasks()
            .filter(task => task.status.status === 'running' || task.status.status === 'paused');
          
          if (activeTasks.length === 0) {
            vscode.window.showInformationMessage('Não há tarefas em execução.');
            return;
          }
          
          interface TaskQuickPickItem extends vscode.QuickPickItem {
            id: string;
          }
          
          const taskItems: TaskQuickPickItem[] = activeTasks.map(task => ({ 
            label: task.name,
            description: `${task.status.status} - ${task.targetUrl}`,
            id: task.id
          }));
          
          const selectedTask = await vscode.window.showQuickPick(taskItems, {
            placeHolder: 'Selecione uma tarefa para parar'
          });
          
          if (!selectedTask) return;
          
          taskId = selectedTask.id;
        }
        
        vscode.window.showInformationMessage(`Parando tarefa...`);
        await context.scraperManager.stopTask(taskId);
        
      } catch (error) {
        vscode.window.showErrorMessage(`Erro ao parar tarefa: ${error.message}`);
        context.logService.error('Erro ao parar tarefa', error);
      }
    })
  );
  
  // Comando para configurar identidade
  subscriptions.push(
    vscode.commands.registerCommand('adv-scraper.configureIdentity', async () => {
      try {
        vscode.window.showInformationMessage('Configurando identidade...');
        // Implementação a ser expandida
      } catch (error) {
        vscode.window.showErrorMessage(`Erro ao configurar identidade: ${error.message}`);
        context.logService.error('Erro ao configurar identidade', error);
      }
    })
  );
  
  // Comando para configurar proxy
  subscriptions.push(
    vscode.commands.registerCommand('adv-scraper.configureProxy', async () => {
      try {
        vscode.window.showInformationMessage('Configurando proxy...');
        // Implementação a ser expandida
      } catch (error) {
        vscode.window.showErrorMessage(`Erro ao configurar proxy: ${error.message}`);
        context.logService.error('Erro ao configurar proxy', error);
      }
    })
  );
  
  // Comando para mostrar webview
  subscriptions.push(
    vscode.commands.registerCommand('adv-scraper.openDashboard', () => {
      try {
        vscode.commands.executeCommand('adv-scraper.webview.open');
      } catch (error) {
        vscode.window.showErrorMessage(`Erro ao abrir dashboard: ${error.message}`);
        context.logService.error('Erro ao abrir dashboard', error);
      }
    })
  );
  
  // Comando para exportar dados
  subscriptions.push(
    vscode.commands.registerCommand('adv-scraper.exportData', async (taskId?: string) => {
      try {
        vscode.window.showInformationMessage('Exportando dados...');
        // Implementação a ser expandida
      } catch (error) {
        vscode.window.showErrorMessage(`Erro ao exportar dados: ${error.message}`);
        context.logService.error('Erro ao exportar dados', error);
      }
    })
  );
  
  return subscriptions;
}
