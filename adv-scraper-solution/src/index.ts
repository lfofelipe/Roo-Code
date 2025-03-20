import { ConfigService } from './services/configService';
import { LogService } from './utils/logService';
import { IdentityManager } from './services/identityManager';
import { ProxyManager } from './services/proxyManager';
import { BrowserAutomationService } from './services/browser/browserAutomation';
import * as dotenv from 'dotenv';
import { Command } from 'commander';

// Configuração inicial
dotenv.config();

/**
 * Função principal da aplicação
 */
async function main() {
  const program = new Command();
  
  // Instanciar serviços
  const logService = new LogService();
  logService.info('Inicializando serviços...');
  
  // Configurar serviço de configuração
  const configService = new ConfigService(logService);
  await configService.initialize();
  
  // Inicializar gerenciadores
  const identityManager = new IdentityManager(configService, logService);
  await identityManager.initialize();
  
  const proxyManager = new ProxyManager(configService, logService);
  await proxyManager.initialize();
  
  // Inicializar serviço de automação
  const browserService = new BrowserAutomationService(
    configService,
    identityManager,
    proxyManager,
    logService
  );
  
  // Configurar linha de comando
  program
    .name('adv-scraper')
    .description('Ferramenta avançada para automação web e scraping')
    .version('1.0.0');
  
  program.command('create-profile')
    .description('Cria um novo perfil de identidade')
    .action(async () => {
      try {
        const id = await identityManager.createRandomProfile();
        const profile = identityManager.getProfile(id);
        console.log('Perfil criado com sucesso:');
        console.log(JSON.stringify(profile, null, 2));
      } catch (error) {
        console.error('Erro ao criar perfil:', error);
      }
    });
  
  program.command('list-profiles')
    .description('Lista todos os perfis de identidade')
    .action(() => {
      const profiles = identityManager.listProfiles();
      console.log(`Total de perfis: ${profiles.length}`);
      profiles.forEach((profile) => {
        console.log(`- ${profile.id}: ${profile.name}`);
      });
    });
  
  program.command('create-session')
    .description('Cria uma nova sessão de navegador')
    .option('-p, --profile <id>', 'ID do perfil a usar')
    .option('-x, --proxy <id>', 'ID do proxy a usar')
    .option('-u, --url <url>', 'URL inicial')
    .option('--headless', 'Executar em modo headless', false)
    .action(async (options) => {
      try {
        const sessionId = await browserService.createSession({
          profileId: options.profile,
          proxyId: options.proxy,
          defaultUrl: options.url,
          headless: options.headless
        });
        
        console.log(`Sessão criada com ID: ${sessionId}`);
      } catch (error) {
        console.error('Erro ao criar sessão:', error);
      }
    });
  
  program.command('navigate')
    .description('Navega para uma URL em uma sessão existente')
    .argument('<sessionId>', 'ID da sessão')
    .argument('<url>', 'URL para navegar')
    .action(async (sessionId, url) => {
      try {
        const result = await browserService.executeAction(sessionId, {
          type: 'navigate',
          url
        });
        
        if (result.success) {
          console.log('Navegação concluída com sucesso');
        } else {
          console.error('Erro na navegação:', result.error);
        }
      } catch (error) {
        console.error('Erro ao executar navegação:', error);
      }
    });
  
  program.command('close-session')
    .description('Fecha uma sessão de navegador')
    .argument('<sessionId>', 'ID da sessão')
    .action(async (sessionId) => {
      try {
        const result = await browserService.closeSession(sessionId);
        
        if (result) {
          console.log('Sessão fechada com sucesso');
        } else {
          console.error('Erro ao fechar sessão');
        }
      } catch (error) {
        console.error('Erro ao fechar sessão:', error);
      }
    });
  
  program.parse();
  
  // Se não for passado nenhum comando, mostrar ajuda
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

// Executar aplicação
main().catch(error => {
  console.error('Erro fatal na aplicação:', error);
  process.exit(1);
});
