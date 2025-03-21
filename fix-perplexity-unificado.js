/**
 * Script unificado para correção das configurações do Perplexity PRO no RooCode
 * 
 * Este script combina todas as correções necessárias para configurações,
 * ajustando o formato dos arquivos de configuração e garantindo que as
 * credenciais do Perplexity sejam salvas corretamente.
 * 
 * Uso: node fix-perplexity-unificado.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Caminhos importantes
const USER_FOLDER = process.env.USERPROFILE || process.env.HOME;
const CONFIG_BASE_DIR = path.join(USER_FOLDER, 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline');
const CONFIG_FILE = path.join(CONFIG_BASE_DIR, 'config');
const SETTINGS_FILE = path.join(CONFIG_BASE_DIR, 'settings.json');
const LOG_FILE = path.join(CONFIG_BASE_DIR, 'perplexity-logs.txt');

// Banner
function showBanner() {
  console.log(`${colors.blue}=======================================================================${colors.reset}`);
  console.log(`${colors.blue}       CORREÇÃO UNIFICADA DE CONFIGURAÇÕES DO PERPLEXITY PRO          ${colors.reset}`);
  console.log(`${colors.blue}=======================================================================${colors.reset}`);
  console.log(`\nEste script corrige:${colors.reset}`);
  console.log(`1. Formatos incorretos de arquivos de configuração${colors.reset}`);
  console.log(`2. Configurações padrão para melhorar a integração com Perplexity${colors.reset}`);
  console.log(`3. Preparação de sistema de logs para diagnóstico${colors.reset}\n`);
}

// Verificar e criar diretórios
function setupDirectories() {
  console.log(`${colors.blue}Verificando diretórios de configuração...${colors.reset}`);
  
  try {
    if (!fs.existsSync(CONFIG_BASE_DIR)) {
      console.log(`Criando diretório: ${CONFIG_BASE_DIR}`);
      fs.mkdirSync(CONFIG_BASE_DIR, { recursive: true });
      console.log(`${colors.green}✓ Diretório criado com sucesso${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ Diretório já existe: ${CONFIG_BASE_DIR}${colors.reset}`);
    }
    return true;
  } catch (error) {
    console.error(`${colors.red}Erro ao criar diretório: ${error.message}${colors.reset}`);
    return false;
  }
}

// Corrigir arquivo de configuração
function fixConfigFile() {
  console.log(`${colors.blue}Corrigindo arquivo de configuração...${colors.reset}`);
  
  // Valores padrão
  let config = {
    apiProvider: "perplexity",
    apiModelId: "claude-3-7-sonnet"
  };
  
  // Verificar se o arquivo existe e tentar carregar seu conteúdo
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      
      // Verificar se o conteúdo é um JSON válido
      try {
        const loadedConfig = JSON.parse(content);
        
        // Manter configurações existentes que não estejam em nossos padrões
        config = { ...loadedConfig, ...config };
        
        console.log(`${colors.green}✓ Arquivo de configuração existente carregado e mesclado${colors.reset}`);
      } catch (parseError) {
        // Se não for um JSON válido, mas contiver dados, informar ao usuário
        if (content.trim()) {
          console.log(`${colors.yellow}! Arquivo de configuração existente está em formato inválido. Substituindo.${colors.reset}`);
        }
      }
    } catch (readError) {
      console.log(`${colors.yellow}! Erro ao ler arquivo de configuração: ${readError.message}${colors.reset}`);
    }
  } else {
    console.log(`${colors.yellow}! Arquivo de configuração não encontrado. Criando novo.${colors.reset}`);
  }
  
  // Salvar arquivo de configuração
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`${colors.green}✓ Arquivo de configuração salvo com sucesso: ${CONFIG_FILE}${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}Erro ao salvar arquivo de configuração: ${error.message}${colors.reset}`);
    return false;
  }
}

// Corrigir arquivo de configurações
function fixSettingsFile() {
  console.log(`${colors.blue}Corrigindo arquivo de configurações...${colors.reset}`);
  
  // Valores padrão para o Perplexity
  const perplexityDefaults = {
    perplexityPreferMethod: "auto",  // Auto: tenta API primeiro, depois browser
    perplexityLoggingEnabled: true,  // Ativar logs para diagnóstico
    perplexityRequestTimeout: 60000  // Timeout de 60 segundos
  };
  
  // Estrutura base das configurações
  let settings = {
    apiProviders: {}
  };
  
  // Verificar se o arquivo existe e tentar carregar seu conteúdo
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      
      // Verificar se o conteúdo é um JSON válido
      try {
        settings = JSON.parse(content);
        
        // Garantir que a estrutura básica existe
        if (!settings.apiProviders) {
          settings.apiProviders = {};
        }
        
        console.log(`${colors.green}✓ Arquivo de configurações existente carregado${colors.reset}`);
      } catch (parseError) {
        console.log(`${colors.yellow}! Arquivo de configurações existente está em formato inválido. Substituindo.${colors.reset}`);
      }
    } catch (readError) {
      console.log(`${colors.yellow}! Erro ao ler arquivo de configurações: ${readError.message}${colors.reset}`);
    }
  } else {
    console.log(`${colors.yellow}! Arquivo de configurações não encontrado. Criando novo.${colors.reset}`);
  }
  
  // Garantir que as configurações do Perplexity existam
  if (!settings.apiProviders.perplexity) {
    settings.apiProviders.perplexity = perplexityDefaults;
    console.log(`${colors.green}✓ Configurações padrão do Perplexity adicionadas${colors.reset}`);
  } else {
    // Verificar valores ausentes e adicionar os padrões
    let updatesMade = false;
    Object.entries(perplexityDefaults).forEach(([key, value]) => {
      if (settings.apiProviders.perplexity[key] === undefined) {
        settings.apiProviders.perplexity[key] = value;
        updatesMade = true;
      }
    });
    
    if (updatesMade) {
      console.log(`${colors.green}✓ Configurações do Perplexity atualizadas com valores padrão faltantes${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ Configurações do Perplexity já estão completas${colors.reset}`);
    }
  }
  
  // Preservar credenciais existentes
  const credentials = settings.apiProviders.perplexity || {};
  const hasApiKey = credentials.perplexityApiKey && typeof credentials.perplexityApiKey === 'string' && credentials.perplexityApiKey.trim() !== '';
  const hasEmail = credentials.perplexityEmail && typeof credentials.perplexityEmail === 'string' && credentials.perplexityEmail.trim() !== '';
  const hasPassword = credentials.perplexityPassword && typeof credentials.perplexityPassword === 'string' && credentials.perplexityPassword.trim() !== '';
  
  console.log(`${colors.blue}Status das credenciais:${colors.reset}`);
  console.log(`- API Key: ${hasApiKey ? colors.green + '✓ Presente' : colors.yellow + '✗ Ausente'}${colors.reset}`);
  console.log(`- Email: ${hasEmail ? colors.green + '✓ Presente' : colors.yellow + '✗ Ausente'}${colors.reset}`);
  console.log(`- Senha: ${hasPassword ? colors.green + '✓ Presente' : colors.yellow + '✗ Ausente'}${colors.reset}`);
  
  // Salvar arquivo de configurações
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    console.log(`${colors.green}✓ Arquivo de configurações salvo com sucesso: ${SETTINGS_FILE}${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}Erro ao salvar arquivo de configurações: ${error.message}${colors.reset}`);
    return false;
  }
}

// Preparar sistema de logs
function setupLogging() {
  console.log(`${colors.blue}Configurando sistema de logs...${colors.reset}`);
  
  // Verificar se o arquivo de logs já existe
  if (fs.existsSync(LOG_FILE)) {
    console.log(`${colors.green}✓ Arquivo de logs já existe: ${LOG_FILE}${colors.reset}`);
    
    // Adicionar marcador de execução deste script
    try {
      fs.appendFileSync(
        LOG_FILE, 
        `[${new Date().toISOString()}] Script de correção unificada executado\n`,
        'utf-8'
      );
      return true;
    } catch (error) {
      console.error(`${colors.red}Erro ao atualizar arquivo de logs: ${error.message}${colors.reset}`);
      return false;
    }
  } else {
    // Criar novo arquivo de logs
    try {
      fs.writeFileSync(
        LOG_FILE,
        `[${new Date().toISOString()}] Arquivo de logs do Perplexity PRO criado\n` +
        `[${new Date().toISOString()}] Script de correção unificada executado\n` +
        `[${new Date().toISOString()}] Sistema de logs inicializado\n`,
        'utf-8'
      );
      console.log(`${colors.green}✓ Arquivo de logs criado com sucesso: ${LOG_FILE}${colors.reset}`);
      return true;
    } catch (error) {
      console.error(`${colors.red}Erro ao criar arquivo de logs: ${error.message}${colors.reset}`);
      return false;
    }
  }
}

// Mostrar instruções
function showInstructions() {
  console.log(`\n${colors.blue}Próximos passos:${colors.reset}`);
  console.log(`1. Abra o VS Code e acesse as configurações do RooCode`);
  console.log(`2. Selecione "Perplexity" como provedor de API`);
  console.log(`3. Configure suas credenciais:`);
  console.log(`   a) Modo API: Apenas chave de API`);
  console.log(`   b) Modo Browser: Email e senha`);
  console.log(`   c) Modo Auto (recomendado): Ambos (tenta API primeiro, depois browser)`);
  console.log(`4. Escolha o modelo desejado (recomendado: "claude-3-7-sonnet")`);
  console.log(`5. Salve as configurações\n`);
  
  console.log(`${colors.blue}Caminho para logs de diagnóstico:${colors.reset}`);
  console.log(`${LOG_FILE}\n`);
}

// Função principal
async function main() {
  showBanner();
  
  // Verificar e configurar diretórios
  if (!setupDirectories()) {
    console.error(`${colors.red}Falha ao configurar diretórios. Abortando.${colors.reset}`);
    return;
  }
  
  // Corrigir arquivo de configuração principal
  if (!fixConfigFile()) {
    console.error(`${colors.red}Falha ao corrigir arquivo de configuração. Abortando.${colors.reset}`);
    return;
  }
  
  // Corrigir arquivo de configurações detalhadas
  if (!fixSettingsFile()) {
    console.error(`${colors.red}Falha ao corrigir arquivo de configurações. Abortando.${colors.reset}`);
    return;
  }
  
  // Configurar sistema de logs
  if (!setupLogging()) {
    console.error(`${colors.red}Falha ao configurar sistema de logs. Continuando mesmo assim.${colors.reset}`);
  }
  
  // Mostrar instruções finais
  console.log(`\n${colors.green}✅ Correções de configuração aplicadas com sucesso!${colors.reset}`);
  showInstructions();
  
  console.log(`${colors.blue}=======================================================================${colors.reset}`);
  console.log(`${colors.blue}                           CORREÇÃO CONCLUÍDA                          ${colors.reset}`);
  console.log(`${colors.blue}=======================================================================${colors.reset}`);
}

// Executar script
main().catch(error => {
  console.error(`${colors.red}Erro inesperado: ${error.message}${colors.reset}`);
  process.exit(1);
});
