// Script especializado para depurar problemas com a integração do Perplexity
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📋 Iniciando diagnóstico da integração Perplexity...');

// Adicionar logs temporários de debug ao código do Perplexity
function injectDebugLogs() {
  console.log('🔍 Injetando logs de diagnóstico no código...');
  
  const perplexityPath = path.join(__dirname, 'src', 'api', 'providers', 'perplexity.ts');
  let content = fs.readFileSync(perplexityPath, 'utf8');
  
  // Backup do arquivo original
  fs.writeFileSync(`${perplexityPath}.backup`, content);
  console.log(`✅ Backup criado em: ${perplexityPath}.backup`);
  
  // Adicionar log detalhado no início da função perplexityCompletion
  const completionFunctionRegex = /export async function perplexityCompletion\([^)]*\)[^{]*{/;
  const debugLogCode = `
  console.log('🔴 PERPLEXITY DEBUG: Iniciando chamada a perplexityCompletion');
  console.log('🔴 PERPLEXITY CONFIG:', {
    email: perplexityEmail ? 'presente' : 'ausente',
    password: perplexityPassword ? 'presente' : 'ausente',
    apiKey: perplexityApiKey ? 'presente' : 'ausente',
    preferMethod: perplexityPreferMethod,
    loggingEnabled: perplexityLoggingEnabled
  });
`;
  
  content = content.replace(completionFunctionRegex, match => `${match}\n${debugLogCode}`);
  
  // Adicionar log na condição de método browser
  const browserMethodRegex = /if\s*\(\s*perplexityPreferMethod\s*===\s*"browser"\s*\)\s*{/g;
  const browserMethodLogCode = `
    console.log('🔴 PERPLEXITY DEBUG: Modo BROWSER selecionado explicitamente');
    console.log('🔴 PERPLEXITY BROWSER CONFIG:', {
      email: perplexityEmail ? 'presente' : 'ausente',
      password: perplexityPassword ? 'presente' : 'ausente',
      apiKey: perplexityApiKey ? 'presente' : 'ausente'
    });
`;
  
  content = content.replace(browserMethodRegex, match => `${match}\n${browserMethodLogCode}`);
  
  // Adicionar log na função callPerplexityApi
  const apiCallRegex = /async function callPerplexityApi\([^)]*\)[^{]*{/;
  const apiCallLogCode = `
  console.log('🔴 PERPLEXITY DEBUG: Tentando chamar API do Perplexity');
  console.log('🔴 PERPLEXITY API CONFIG:', {
    apiKeyLength: apiKey ? apiKey.length : 0,
    modelId,
    streamingEnabled: !!onPartialResponse
  });
`;
  
  content = content.replace(apiCallRegex, match => `${match}\n${apiCallLogCode}`);
  
  // Adicionar log ao construir headers HTTP
  const headersRegex = /const headers: Record<string, string> = {[^}]*};/;
  const headersLogCode = `
  console.log('🔴 PERPLEXITY DEBUG: Headers HTTP construídos:', {
    ...headers,
    "Authorization": headers["Authorization"] ? "Bearer [REDACTED]" : "AUSENTE"
  });
`;
  
  if (headersRegex.test(content)) {
    content = content.replace(headersRegex, match => `${match}\n${headersLogCode}`);
  }
  
  // Melhorar a função de log para registrar em arquivo
  const loggerRegex = /function createLogger\([^)]*\)[^{]*{/;
  const loggerExtraCode = `
  // Verificar diretamente se o diretório de logs existe
  console.log('🔴 PERPLEXITY DEBUG: Verificando diretório de logs');
  const logDirPath = (() => {
    if (process.platform === "win32") {
      return path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline');
    } else if (process.platform === "darwin") {
      return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline');
    } else {
      return path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline');
    }
  })();
  
  console.log('🔴 PERPLEXITY DEBUG: Diretório de logs definido como:', logDirPath);
  console.log('🔴 PERPLEXITY DEBUG: Diretório existe?', fs.existsSync(logDirPath));
  
  // Criar diretório de logs temporário no diretório atual se o padrão não funcionar
  if (!fs.existsSync(logDirPath)) {
    const tempLogDir = path.join(__dirname, 'temp-logs');
    console.log('🔴 PERPLEXITY DEBUG: Tentando criar diretório temporário:', tempLogDir);
    
    try {
      if (!fs.existsSync(tempLogDir)) {
        fs.mkdirSync(tempLogDir, { recursive: true });
      }
      console.log('🔴 PERPLEXITY DEBUG: Usando diretório de logs temporário:', tempLogDir);
      return createLogger(loggingEnabled, tempLogDir); 
    } catch (e) {
      console.error('🔴 PERPLEXITY DEBUG ERROR: Falha ao criar diretório temporário:', e);
    }
  }
`;
  
  content = content.replace(loggerRegex, match => `${match}\n${loggerExtraCode}`);
  
  // Salvar o arquivo modificado
  fs.writeFileSync(perplexityPath, content);
  console.log('✅ Logs de diagnóstico adicionados com sucesso');
}

// Restaurar o arquivo original após o teste
function restoreOriginalFile() {
  const perplexityPath = path.join(__dirname, 'src', 'api', 'providers', 'perplexity.ts');
  const backupPath = `${perplexityPath}.backup`;
  
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, perplexityPath);
    console.log('✅ Arquivo original restaurado com sucesso');
  }
}

// Processo principal de depuração
try {
  // Injetar logs de diagnóstico
  injectDebugLogs();
  
  console.log('🔧 Compilando a extensão em modo de depuração...');
  
  // Executa o esbuild com depuração ativada
  execSync('node esbuild.js', { stdio: 'inherit' });
  
  console.log('⚙️ Configurando ambiente de depuração...');
  
  // Criar arquivo .env.debug temporário com configurações de depuração
  const envContent = `
DEBUG=roo-cline:*,perplexity:*
VSCODE_DEBUG=true
NODE_ENV=development
PERPLEXITY_DEBUG=true
`;
  
  const envPath = path.join(__dirname, '.env.debug');
  fs.writeFileSync(envPath, envContent);
  
  // Criar diretório de logs temporário
  const tempLogDir = path.join(__dirname, 'temp-logs');
  if (!fs.existsSync(tempLogDir)) {
    fs.mkdirSync(tempLogDir, { recursive: true });
  }
  
  // Criar arquivo de log inicial
  fs.writeFileSync(path.join(tempLogDir, 'perplexity-debug.log'), 
    `--- Início do log de depuração do Perplexity: ${new Date().toISOString()} ---\n`);
  
  console.log('🚀 Iniciando VS Code com depuração avançada...');
  
  // Inicia o VS Code com depuração ativada e apenas a extensão Roo Code
  const currentDir = process.cwd();
  const args = [
    `--extensionDevelopmentPath="${currentDir}"`,
    '--disable-extensions',
    '--verbose',
    '--new-window'
  ].join(' ');
  
  // Adicionar env vars específicas para o Perplexity
  const env = {
    ...process.env,
    DEBUG: 'roo-cline:*,perplexity:*',
    VSCODE_DEBUG: 'true',
    PERPLEXITY_DEBUG: 'true',
    PERPLEXITY_LOG_DIR: tempLogDir
  };
  
  console.log('📝 Instruções para testar o problema do Perplexity:');
  console.log('1. No VS Code que será aberto, vá para as configurações do RooCode');
  console.log('2. Selecione Perplexity como o provedor');
  console.log('3. Informe seu email e senha do Perplexity');
  console.log('4. Selecione EXPLICITAMENTE o método "Somente navegador"');
  console.log('5. Deixe o campo de API Key vazio');
  console.log('6. Salve as configurações e tente usar o Perplexity');
  console.log('\nOs logs serão exibidos no console e em: ' + path.join(tempLogDir, 'perplexity-debug.log'));
  
  execSync(`code ${args}`, { 
    stdio: 'inherit',
    env: env
  });
  
  console.log('✅ VS Code iniciado em modo de depuração avançada.');
  console.log('📊 Após testar, verifique os logs em: ' + tempLogDir);
  
} catch (error) {
  console.error('❌ Erro ao iniciar a extensão em modo de depuração:', error);
  // Restaurar arquivo original em caso de erro
  restoreOriginalFile();
} finally {
  // Lembrete para restaurar o arquivo original
  console.log('\n⚠️ IMPORTANTE: Execute o comando abaixo quando terminar os testes para restaurar o arquivo original:');
  console.log('node -e "require(\'fs\').copyFileSync(\'src/api/providers/perplexity.ts.backup\', \'src/api/providers/perplexity.ts\'); console.log(\'Arquivo restaurado\')"');
}
