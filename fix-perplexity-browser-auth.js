// Script para corrigir o problema de autenticação do Perplexity no modo browser
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando correção do problema de autenticação do Perplexity...');

// Encontrar o diretório de configuração do VSCode
function findVsCodeConfigDir() {
  const possiblePaths = [
    // Windows
    path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
    // macOS
    path.join(process.env.HOME || '', 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
    // Linux
    path.join(process.env.HOME || '', '.config', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
    // VSCodium (alternativa open source)
    path.join(process.env.APPDATA || '', 'VSCodium', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
    path.join(process.env.HOME || '', 'Library', 'Application Support', 'VSCodium', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
    path.join(process.env.HOME || '', '.config', 'VSCodium', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
  ];

  for (const dirPath of possiblePaths) {
    if (fs.existsSync(dirPath)) {
      console.log(`✅ Diretório de configuração encontrado: ${dirPath}`);
      return dirPath;
    }
  }
  
  console.log('❌ Diretório de configuração não encontrado nos caminhos padrão');
  return null;
}

// Verificar e corrigir arquivos de configuração
function fixConfigFiles() {
  const configDir = findVsCodeConfigDir();
  
  if (!configDir) {
    console.log('❗ Não foi possível encontrar o diretório de configuração. Continuando com a correção do código...');
  } else {
    // Procurar por arquivos de configuração
    const files = fs.readdirSync(configDir);
    let settingsFound = false;
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const fullPath = path.join(configDir, file);
        console.log(`📄 Analisando arquivo de configuração: ${file}`);
        
        try {
          const config = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          
          // Fazer backup do arquivo
          fs.writeFileSync(`${fullPath}.backup`, JSON.stringify(config, null, 2));
          console.log(`✅ Backup criado em: ${fullPath}.backup`);
          
          // Verificar e ajustar configurações do Perplexity
          if (config.perplexityPreferMethod || config.encryptedPerplexityApiKey) {
            settingsFound = true;
            
            // Se o modo browser estiver selecionado, remover chaves de API
            if (config.perplexityPreferMethod === "browser") {
              delete config.encryptedPerplexityApiKey;
              delete config.perplexityApiKey;
              console.log('🔄 Configuração ajustada: Removidas chaves de API para modo browser');
            }
            
            // Salvar configuração modificada
            fs.writeFileSync(fullPath, JSON.stringify(config, null, 2));
            console.log(`✅ Configuração salva em: ${fullPath}`);
          }
        } catch (error) {
          console.error(`❌ Erro ao processar arquivo ${file}: ${error.message}`);
        }
      }
    }
    
    if (!settingsFound) {
      console.log('❗ Nenhuma configuração do Perplexity encontrada nos arquivos');
    }
    
    // Criar diretório de logs se não existir
    const logDir = path.join(configDir, 'logs');
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
        console.log(`✅ Diretório de logs criado: ${logDir}`);
      } catch (error) {
        console.error(`❌ Erro ao criar diretório de logs: ${error.message}`);
      }
    }
    
    // Tentar criar um arquivo de log de teste
    const testLogFile = path.join(configDir, 'perplexity-logs.txt');
    try {
      fs.writeFileSync(testLogFile, `--- Log de teste criado em ${new Date().toISOString()} ---\n`);
      console.log(`✅ Arquivo de log de teste criado: ${testLogFile}`);
    } catch (error) {
      console.error(`❌ Erro ao criar arquivo de log de teste: ${error.message}`);
    }
  }
}

// Corrigir o código fonte do provedor Perplexity
function fixPerplexityProviderCode() {
  const perplexityPath = path.join(__dirname, 'src', 'api', 'providers', 'perplexity.ts');
  console.log(`📄 Modificando arquivo: ${perplexityPath}`);
  
  if (!fs.existsSync(perplexityPath)) {
    console.error(`❌ Arquivo não encontrado: ${perplexityPath}`);
    return false;
  }
  
  // Ler o conteúdo do arquivo
  let content = fs.readFileSync(perplexityPath, 'utf8');
  
  // Criar backup do arquivo original
  fs.writeFileSync(`${perplexityPath}.backup`, content);
  console.log(`✅ Backup criado em: ${perplexityPath}.backup`);
  
  // Modificar o código para isolar completamente o modo browser
  console.log('🔄 Modificando código para separar completamente modo browser e API...');
  
  // 1. Modificar a função principal para criar uma separação clara entre modos browser e API
  const newBrowserModeCode = `
    // MODO BROWSER: Verificação separada e isolada para modo browser
    if (perplexityPreferMethod === "browser") {
      // Verificar credenciais exclusivamente para o modo browser
      logger.critical("MODO BROWSER selecionado explicitamente. Ignorando totalmente API.");
      
      if (!perplexityEmail || !perplexityPassword || 
          (typeof perplexityEmail === 'string' && perplexityEmail.trim() === '') || 
          (typeof perplexityPassword === 'string' && perplexityPassword.trim() === '')) {
        const erro = "Email e senha do Perplexity são necessários para o modo navegador. Configure-os nas configurações do RooCode.";
        logger.critical(\`ERRO MODO BROWSER: \${erro}\`);
        throw new Error(erro);
      }
      
      logger.info("Credenciais para modo BROWSER validadas. Prosseguindo com automação de navegador.");
      
      // Usar diretamente o browser sem nenhuma conversão de formato de mensagem para API
      return await vscode.window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: "Perplexity Browser",
          cancellable: true,
        },
        async (progress, cancellationToken) => {
          if (cancellationToken.isCancellationRequested) {
            logger.info("Operação cancelada pelo usuário");
            throw new Error("Operação cancelada pelo usuário");
          }

          return await usePerplexityBrowser(
            perplexityEmail || '',
            perplexityPassword || '',
            messages,
            imageUrls,
            apiModelId,
            progress,
            cancellationToken,
            logger
          );
        }
      );
    }
  `;
  
  // Substituir o código do modo browser
  const browserModeRegex = /if\s*\(\s*perplexityPreferMethod\s*===\s*"browser"\s*\)\s*\{[\s\S]+?\}\s*else\s*if/;
  if (browserModeRegex.test(content)) {
    content = content.replace(browserModeRegex, match => `${newBrowserModeCode}\n    // MODO API: Verificação separada e isolada para modo API\n    if`);
  } else {
    console.warn('⚠️ Não foi possível encontrar o padrão exato para substituição do modo browser.');
    
    // Abordagem alternativa: Adicionar nosso código após a detecção do método preferido
    const preferMethodRegex = /const\s*{[^}]*perplexityPreferMethod\s*=\s*"auto"[^}]*}\s*=\s*options;/;
    if (preferMethodRegex.test(content)) {
      content = content.replace(preferMethodRegex, match => `${match}\n\n  // VERIFICAÇÃO FUNDAMENTAL: Qual método está selecionado\n  logger.critical(\`[VERIFICAÇÃO] Método selecionado: \${perplexityPreferMethod}\`);\n  \n  try {\n    ${newBrowserModeCode}`);
      
      // Precisamos fechar o try no final da função
      const functionEndRegex = /return await vscode\.window\.withProgress[\s\S]+?}\s*\)\s*;\s*}\s*$/;
      if (functionEndRegex.test(content)) {
        content = content.replace(functionEndRegex, match => `${match.slice(0, -1)}\n  } catch (error) {\n    // Log detalhado de qualquer erro que ocorra na função principal\n    logger.critical(\`Erro fatal em perplexityCompletion: \${error instanceof Error ? error.message : String(error)}\`);\n    if (error instanceof Error && error.stack) {\n      logger.debug(\`Stack trace do erro principal: \${error.stack}\`);\n    }\n    // Relançar o erro para ser tratado pelo chamador\n    throw error;\n  }\n}`);
      }
    }
  }
  
  // 2. Modificar a função callPerplexityApi para validar a chave API antes de construir headers
  const apiCallRegex = /async function callPerplexityApi[\s\S]+?{/;
  const validationCode = `
  // Validação rigorosa da chave de API
  if (!apiKey || apiKey.trim() === '') {
    const erro = "Chave de API do Perplexity é necessária. Configure-a nas configurações do RooCode.";
    logger.error('Validação falhou: Chave de API não fornecida ou vazia');
    throw new Error(erro);
  }
  `;
  
  if (apiCallRegex.test(content)) {
    content = content.replace(apiCallRegex, match => `${match}\n${validationCode}`);
  }
  
  // 3. Melhorar a criação da função createLogger para debug
  const createLoggerRegex = /function createLogger\(loggingEnabled = false\) {/;
  const criticalLogCode = `
    critical: (message: string, error?: any) => {
      // Logs críticos sempre são gravados, mesmo se logging desabilitado
      const errorMessage = error ? \`\${message}: \${error.message || error}\` : message;
      safeAppendToLog('CRITICAL', \`ATENÇÃO - ERRO GRAVE: \${errorMessage}\`);
      
      // Sempre tenta gravar no arquivo, mesmo com logging desabilitado
      try {
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logFile, \`[\${timestamp}][CRITICAL] \${errorMessage}\\n\`);
        if (error && error.stack) {
          fs.appendFileSync(logFile, \`[\${timestamp}][STACK] \${error.stack}\\n\`);
        }
      } catch (criticalError) {
        console.error(\`Não foi possível registrar erro crítico: \${criticalError}\`);
      }
    }
  `;
  
  const returnLoggerRegex = /return \{\s*debug:[^}]+},\s*warn:[^}]+},\s*info:[^}]+},\s*error:[^}]+}\s*};/;
  if (returnLoggerRegex.test(content)) {
    content = content.replace(returnLoggerRegex, match => match.replace(/}(\s*)};/, `},\n    ${criticalLogCode}\n  $1};`));
  }
  
  // 4. Melhorar o manuseio de erros no wrapper principal
  const errorHandlingRegex = /} catch \(error(?: |:)(?:any)?\) {[\s\S]+?throw new Error\([^)]+\);[\s\S]+?}/;
  if (errorHandlingRegex.test(content)) {
    content = content.replace(errorHandlingRegex, match => `} catch (error: any) {
    // Log detalhado e enriquecido do erro
    let errorDetails = "Erro desconhecido";
    let userFriendlyMessage = "Ocorreu um erro ao se comunicar com o Perplexity. Tente novamente mais tarde.";
    
    if (axios.isAxiosError(error)) {
      // Log dos headers da requisição (exceto auth) para debugging
      if (error.config && error.config.headers) {
        const safeHeaders = { ...error.config.headers };
        if ('Authorization' in safeHeaders) {
          safeHeaders['Authorization'] = 'Bearer [REDACTED]';
        }
        logger.debug(\`Headers enviados na requisição: \${JSON.stringify(safeHeaders)}\`);
      }
      
      if (error.response) {
        const status = error.response.status;
        const responseData = error.response.data || {};
        
        errorDetails = \`Status HTTP: \${status}, Resposta: \${JSON.stringify(responseData)}\`;
        logger.debug(\`Resposta de erro completa: \${JSON.stringify(error.response.headers || {})}\`);
        
        // Detecção e tratamento detalhado de erros específicos
        if (status === 400) {
          const errorType = responseData.error?.type || 'bad_request';
          logger.error(\`Erro de requisição inválida (\${errorType}): parâmetros incorretos ou mal formatados\`, error);
          
          // Mensagens específicas baseadas no tipo de erro
          if (errorType.includes('authentication') || responseData.error?.message?.includes('authentication')) {
            userFriendlyMessage = "Erro de autenticação: método de autenticação não pode ser resolvido. Verifique suas configurações no Perplexity.";
          } else {
            userFriendlyMessage = "A requisição enviada ao Perplexity contém erros. Verifique as configurações e tente novamente.";
          }
        } 
        else if (status === 401) {
          logger.error(\`Erro de autenticação (401): API key inválida ou expirada\`, error);
          userFriendlyMessage = "Falha na autenticação da API Perplexity. Verifique se sua chave de API está correta e válida.";
        } 
        else if (status === 403) {
          logger.error(\`Erro de permissão (403): Acesso negado\`, error);
          userFriendlyMessage = "Acesso negado à API Perplexity. Sua chave de API pode não ter permissões para este modelo ou recurso.";
        } 
        else if (status === 404) {
          logger.error(\`Erro 404: Recurso não encontrado\`, error);
          userFriendlyMessage = "O recurso solicitado não foi encontrado na API do Perplexity. Verifique o modelo selecionado.";
        }
        else if (status === 429) {
          logger.error(\`Limite de taxa excedido (429): Muitas requisições\`, error);
          userFriendlyMessage = "Limite de requisições da API Perplexity excedido. Tente novamente mais tarde.";
        }
        else if (status >= 500) {
          logger.error(\`Erro do servidor Perplexity (\${status})\`, error);
          userFriendlyMessage = "O servidor do Perplexity encontrou um erro. Tente novamente mais tarde.";
        }
      } 
      else if (error.request) {
        errorDetails = "Nenhuma resposta recebida do servidor";
        logger.error(\`Erro de conexão: Solicitação enviada mas sem resposta\`, error);
        logger.debug(\`Detalhes da requisição: \${JSON.stringify(error.request)}\`);
        userFriendlyMessage = "Não foi possível conectar à API Perplexity. Verifique sua conexão de internet.";
      } 
      else {
        errorDetails = error.message;
        logger.error(\`Erro ao criar requisição: \${error.message}\`, error);
        userFriendlyMessage = "Erro ao preparar a requisição para o Perplexity. Verifique a configuração.";
      }
    } 
    else if (error instanceof Error) {
      errorDetails = \`Erro não-Axios: \${error.message}\`;
      logger.error(\`Erro não relacionado ao Axios: \${error.message}\`, error);
    }
    
    // Log detalhado do erro para diagnosticar o problema
    logger.error(\`Falha na requisição à API: \${errorDetails}\`);
    
    // Log da pilha de chamadas para ajudar no diagnóstico
    if (error.stack) {
      logger.debug(\`Stack trace: \${error.stack}\`);
    }
    
    // Lançar erro com mensagem amigável para o usuário
    throw new Error(userFriendlyMessage);
  }`);
  }
  
  // Salvar o arquivo modificado
  fs.writeFileSync(perplexityPath, content);
  console.log('✅ Correções aplicadas ao código do provider Perplexity');
  
  return true;
}

// Executar a correção
try {
  console.log('🔍 Verificando e corrigindo arquivos de configuração...');
  fixConfigFiles();
  
  console.log('🔍 Modificando código fonte do provider Perplexity...');
  if (fixPerplexityProviderCode()) {
    console.log('🔧 Compilando a extensão com as correções...');
    execSync('node esbuild.js', { stdio: 'inherit' });
    
    console.log(`
✅ Correções aplicadas com sucesso!

📋 Resumo das correções:
1. Separado completamente o modo browser do modo API
2. Validação rigorosa das credenciais antes de qualquer chamada
3. Melhorado sistema de logs e diagnóstico
4. Tratamento detalhado de erros para mensagens mais claras

🚀 Para testar a correção, você pode:
1. Desinstalar sua versão atual do RooCode
2. Criar um novo pacote VSIX com: node build-vsix.js
3. Instalar o pacote corrigido
4. Configurar apenas o email e senha (sem API key) e método "Somente Browser"

💡 Alternativa: Inicie a extensão em modo de debug com: node debug-extension.js
`);
  } else {
    console.error('❌ Não foi possível aplicar algumas das correções. Verifique os logs acima.');
  }
} catch (error) {
  console.error('❌ Erro ao executar script de correção:', error);
  
  // Restaurar arquivo original em caso de erro
  const perplexityPath = path.join(__dirname, 'src', 'api', 'providers', 'perplexity.ts');
  const backupPath = `${perplexityPath}.backup`;
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, perplexityPath);
    console.log('🔄 Arquivo original restaurado após erro');
  }
}
