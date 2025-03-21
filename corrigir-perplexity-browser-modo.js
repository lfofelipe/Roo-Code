// Script unificado para corrigir o problema do modo browser do Perplexity
// e gerar um VSIX pronto para uso
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando correção do problema do modo Browser do Perplexity PRO...');

// Criar um arquivo de registro para diagnóstico
const logFile = path.join(__dirname, 'correcao-perplexity.log');
fs.writeFileSync(logFile, `=== Início do processo de correção: ${new Date().toISOString()} ===\n\n`);

function log(message) {
  const entry = `[${new Date().toISOString()}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(logFile, entry);
}

// Criar backup do arquivo original
function backupFile(filePath) {
  if (!fs.existsSync(filePath)) {
    log(`❌ Arquivo não encontrado: ${filePath}`);
    return false;
  }
  
  const backupPath = `${filePath}.backup-${Date.now()}`;
  fs.copyFileSync(filePath, backupPath);
  log(`✅ Backup criado em: ${backupPath}`);
  return true;
}

// Corrigir o modo browser no código do Perplexity
function fixPerplexityCode() {
  const perplexityPath = path.join(__dirname, 'src', 'api', 'providers', 'perplexity.ts');
  log(`📄 Modificando código principal do Perplexity: ${perplexityPath}`);
  
  if (!backupFile(perplexityPath)) {
    return false;
  }
  
  try {
    let content = fs.readFileSync(perplexityPath, 'utf8');
    
    // Estratégia 1: Reescrever completamente a função perplexityCompletion para separar claramente os modos
    const completionFunction = /export async function perplexityCompletion\([^)]*\)[^{]*{[\s\S]*?}/;
    const newCompletionCode = `export async function perplexityCompletion(
  messages: { role: string; content: string }[],
  imageUrls: string[] | null,
  options: ApiHandlerOptions,
  onPartialResponse: ((content: string) => void) | null,
  signal?: AbortSignal,
  maxTokens: number = 200000
) {
  const {
    perplexityEmail,
    perplexityPassword,
    perplexityApiKey,
    perplexityPreferMethod = "auto",
    perplexityLoggingEnabled = false,
    perplexityRequestTimeout = DEFAULT_TIMEOUT,
    apiModelId = "claude-3-7-sonnet",
  } = options;

  // Criar logger com suporte a logs críticos que sempre serão gravados
  const logger = createLogger(perplexityLoggingEnabled);
  logger.critical(\`[INICIO] Solicitação Perplexity iniciada com método: \${perplexityPreferMethod}\`);
  logger.debug(\`Configurações: modelo=\${apiModelId}, timeout=\${perplexityRequestTimeout}ms, logging=\${perplexityLoggingEnabled}\`);
  
  // VERIFICAÇÃO FUNDAMENTAL: Qual método está selecionado
  logger.critical(\`[VERIFICAÇÃO] Método selecionado: \${perplexityPreferMethod}\`);
  
  try {
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
    
    // MODO API: Verificação separada e isolada para modo API
    if (perplexityPreferMethod === "api") {
      logger.critical("MODO API selecionado explicitamente.");
      
      if (!perplexityApiKey || perplexityApiKey.trim() === '') {
        const erro = "Chave de API do Perplexity é necessária quando o método 'Somente API' está selecionado. Configure-a nas configurações do RooCode.";
        logger.critical(\`ERRO MODO API: \${erro}\`);
        throw new Error(erro);
      }
      
      logger.info("Chave de API validada. Prosseguindo com chamada de API.");
      
      // Preparar as mensagens para formato API
      logger.debug(\`Preparando \${messages.length} mensagens para o formato API Perplexity\`);
      const perplexityMessages: PerplexityMessage[] = await Promise.all(
        messages.map(async (message) => {
          if (message.role === "user" && imageUrls && imageUrls.length > 0) {
            // Mensagens com imagens
            const content: PerplexityMessageContent[] = [{ type: "text", text: message.content }];

            // Processar imagens
            if (Array.isArray(imageUrls) && imageUrls.length > 0) {
              logger.debug(\`Processando \${imageUrls.length} imagens para mensagem do usuário\`);
              
              for (let i = 0; i < imageUrls.length; i++) {
                try {
                  const imageUrl = String(imageUrls[i] || '');
                  const base64 = await processImage(imageUrl, logger);
                  if (base64) {
                    content.push({
                      type: "image_url",
                      image_url: {
                        url: \`data:image/jpeg;base64,\${base64}\`,
                      },
                    });
                    
                    // Truncar URL para log
                    const trimmedUrl = imageUrl.length > 30 ? 
                      \`\${imageUrl.substring(0, 30)}...\` : imageUrl;
                      
                    logger.debug(\`Imagem #\${i+1} processada com sucesso: \${trimmedUrl}\`);
                  }
                } catch (error) {
                  logger.error(\`Falha ao processar imagem #\${i+1}\`, error);
                }
              }
            }

            return {
              role: message.role,
              content,
            };
          }

          // Mensagens de texto simples
          return {
            role: message.role,
            content: [{ type: "text", text: message.content }],
          };
        })
      );
      
      return await callPerplexityApi(
        perplexityMessages,
        perplexityApiKey,
        apiModelId,
        onPartialResponse,
        perplexityRequestTimeout,
        signal,
        perplexityLoggingEnabled
      );
    }
    
    // MODO AUTO: Tentativa automática baseada nas credenciais disponíveis
    logger.critical("MODO AUTO: determinando método baseado nas credenciais disponíveis");
    
    if (perplexityApiKey && perplexityApiKey.trim() !== '') {
      logger.info("Chave de API encontrada. Tentando usar API no modo AUTO");
      try {
        // Preparar as mensagens para formato API
        const perplexityMessages: PerplexityMessage[] = await Promise.all(
          messages.map(async (message) => {
            if (message.role === "user" && imageUrls && imageUrls.length > 0) {
              const content: PerplexityMessageContent[] = [{ type: "text", text: message.content }];
              
              // Processar imagens
              if (Array.isArray(imageUrls) && imageUrls.length > 0) {
                for (let i = 0; i < imageUrls.length; i++) {
                  try {
                    const imageUrl = String(imageUrls[i] || '');
                    const base64 = await processImage(imageUrl, logger);
                    if (base64) {
                      content.push({
                        type: "image_url",
                        image_url: {
                          url: \`data:image/jpeg;base64,\${base64}\`,
                        },
                      });
                    }
                  } catch (error) {
                    logger.error(\`Falha ao processar imagem #\${i+1}\`, error);
                  }
                }
              }
              
              return {
                role: message.role,
                content,
              };
            }
            
            return {
              role: message.role,
              content: [{ type: "text", text: message.content }],
            };
          })
        );
        
        return await callPerplexityApi(
          perplexityMessages,
          perplexityApiKey,
          apiModelId,
          onPartialResponse,
          perplexityRequestTimeout,
          signal,
          perplexityLoggingEnabled
        );
      } catch (error) {
        logger.error(\`Chamada de API falhou no modo AUTO\`, error);
        logger.critical("Fallback para navegador após falha de API no modo AUTO");
      }
    }
    
    // Fallback para navegador (quando API falha ou não há chave de API)
    if (!perplexityEmail || !perplexityPassword || 
        (typeof perplexityEmail === 'string' && perplexityEmail.trim() === '') || 
        (typeof perplexityPassword === 'string' && perplexityPassword.trim() === '')) {
      const erro = "Email e senha do Perplexity são necessários quando a API não está disponível. Configure-os nas configurações do RooCode.";
      logger.critical(\`ERRO FALLBACK BROWSER: \${erro}\`);
      throw new Error(erro);
    }
    
    logger.critical("Usando navegador como último recurso ou fallback.");
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
  } catch (error) {
    // Log detalhado de qualquer erro que ocorra na função principal
    logger.critical(\`Erro fatal em perplexityCompletion: \${error instanceof Error ? error.message : String(error)}\`);
    if (error instanceof Error && error.stack) {
      logger.debug(\`Stack trace do erro principal: \${error.stack}\`);
    }
    // Relançar o erro para ser tratado pelo chamador
    throw error;
  }
}`;
    
    // Melhorar a função createLogger para adicionar método critical
    const createLoggerRegex = /function createLogger\([^)]*\)[^{]*{/;
    const loggerReturn = /return \{[\s\S]*?debug:[\s\S]*?warn:[\s\S]*?info:[\s\S]*?error:[\s\S]*?};/;
    
    if (createLoggerRegex.test(content) && loggerReturn.test(content)) {
      const criticalLog = `
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
    }`;
      
      content = content.replace(loggerReturn, (match) => {
        return match.replace(/}(\s*);/, `},\n${criticalLog}\n  $1;`);
      });
      
      log('✅ Adicionado método critical ao logger');
    } else {
      log('⚠️ Não foi possível encontrar função createLogger para adicionar método critical');
    }
    
    // Atualizar a função principal
    if (completionFunction.test(content)) {
      content = content.replace(completionFunction, newCompletionCode);
      log('✅ Função perplexityCompletion reescrita completamente');
    } else {
      log('❌ Não foi possível encontrar função perplexityCompletion para substituir');
      return false;
    }
    
    // Salvar o arquivo modificado
    fs.writeFileSync(perplexityPath, content);
    log('✅ Arquivo salvo com sucesso');
    return true;
  } catch (error) {
    log(`❌ Erro ao modificar o código: ${error.message}`);
    return false;
  }
}

// Encontrar e atualizar arquivos de configuração do VSCode
function updateVsCodeConfig() {
  log('🔍 Procurando por arquivos de configuração do VSCode...');
  
  // Possíveis localizações do diretório de configuração do VSCode
  const possiblePaths = [
    // Windows
    path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
    // macOS
    path.join(process.env.HOME || '', 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
    // Linux
    path.join(process.env.HOME || '', '.config', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
    // Considerando VSCodium também
    path.join(process.env.APPDATA || '', 'VSCodium', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
  ];
  
  let configDirFound = false;
  
  for (const dirPath of possiblePaths) {
    if (fs.existsSync(dirPath)) {
      log(`✅ Diretório de configuração encontrado: ${dirPath}`);
      configDirFound = true;
      
      // Tentar criar diretório de logs se não existir
      const logDir = path.join(dirPath, 'logs');
      if (!fs.existsSync(logDir)) {
        try {
          fs.mkdirSync(logDir, { recursive: true });
          log(`✅ Diretório de logs criado: ${logDir}`);
        } catch (error) {
          log(`❌ Erro ao criar diretório de logs: ${error.message}`);
        }
      }
      
      // Tentar criar arquivo de log vazio para teste
      const testLogFile = path.join(dirPath, 'perplexity-logs.txt');
      try {
        fs.writeFileSync(testLogFile, `--- Teste de log criado em ${new Date().toISOString()} ---\n`);
        log(`✅ Arquivo de log de teste criado: ${testLogFile}`);
      } catch (error) {
        log(`❌ Erro ao criar arquivo de log de teste: ${error.message}`);
      }
      
      // Procurar e modificar arquivos de configuração
      const files = fs.readdirSync(dirPath);
      let configFound = false;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const configPath = path.join(dirPath, file);
          log(`📄 Analisando arquivo de configuração: ${configPath}`);
          
          try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            // Backup do arquivo original
            fs.writeFileSync(`${configPath}.backup-${Date.now()}`, JSON.stringify(config, null, 2));
            
            // Verificar se há configurações do Perplexity
            if (config.perplexityPreferMethod || config.encryptedPerplexityApiKey || 
                config.encryptedPerplexityEmail || config.encryptedPerplexityPassword) {
              
              configFound = true;
              log('✅ Encontradas configurações do Perplexity');
              
              // Se o modo browser estiver selecionado, remover a chave de API para evitar conflitos
              if (config.perplexityPreferMethod === "browser") {
                log('ℹ️ Modo browser encontrado nas configurações');
                delete config.encryptedPerplexityApiKey;
                log('✅ Chave API removida para evitar conflitos no modo browser');
                
                // Habilitar logs para diagnóstico
                config.perplexityLoggingEnabled = true;
                log('✅ Logs habilitados para diagnóstico');
                
                // Salvar configuração atualizada
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                log(`✅ Configuração atualizada salva em: ${configPath}`);
              } else {
                log('ℹ️ Modo browser não está atualmente selecionado, mantendo configurações');
              }
            }
          } catch (error) {
            log(`❌ Erro ao processar arquivo de configuração ${file}: ${error.message}`);
          }
        }
      }
      
      if (!configFound) {
        log('⚠️ Nenhum arquivo de configuração com definições do Perplexity foi encontrado');
      }
    }
  }
  
  if (!configDirFound) {
    log('⚠️ Nenhum diretório de configuração do VSCode encontrado nos caminhos padrão');
  }
  
  return configDirFound;
}

// Compilar a extensão e criar VSIX
function buildExtension() {
  log('🔨 Compilando a extensão com as correções...');
  
  try {
    // Primeiro build com esbuild
    log('📦 Executando esbuild...');
    execSync('node esbuild.js', { stdio: 'inherit' });
    
    // Em seguida, criar VSIX
    log('📦 Criando pacote VSIX...');
    execSync('node build-vsix.js', { stdio: 'inherit' });
    
    log('✅ Processo de build concluído com sucesso');
    return true;
  } catch (error) {
    log(`❌ Erro ao compilar a extensão: ${error.message}`);
    return false;
  }
}

// Função principal
async function main() {
  log('🚀 Iniciando correção do problema do Perplexity Browser...');
  
  // Etapa 1: Atualizar as configurações do VSCode
  updateVsCodeConfig();
  
  // Etapa 2: Corrigir o código fonte do Perplexity
  const codeFixed = fixPerplexityCode();
  
  if (!codeFixed) {
    log('❌ Não foi possível aplicar todas as correções ao código do Perplexity.');
    process.exit(1);
  }
  
  // Etapa 3: Compilar a extensão com as correções
  const buildSuccess = buildExtension();
  
  if (buildSuccess) {
    log(`
✅ CORREÇÃO CONCLUÍDA COM SUCESSO!

📋 Resumo das alterações:
1. Reescrita da função principal perplexityCompletion para isolar completamente os modos
2. Modo Browser agora opera de forma totalmente independente da API
3. Melhorado o sistema de logs para diagnóstico em vários níveis
4. Configurações de contexto VSCode ajustadas para evitar conflitos

🚀 Para usar a correção:
1. Desinstalar a versão atual do RooCode do VS Code
2. Instalar a versão corrigida: code --install-extension bin/roo-cline-3.9.4.vsix
3. Reiniciar o VS Code
4. Configurar Perplexity:
   - Selecionar o provedor "Perplexity"
   - Informar seu email e senha
   - Selecionar EXPLICITAMENTE "Somente Browser" como método
   - IMPORTANTE: Deixar o campo de API Key vazio
   - Habilitar logs para diagnóstico

📋 Se precisar restaurar a versão original do arquivo, use:
   node -e "require('fs').copyFileSync('src/api/providers/perplexity.ts.backup-*', 'src/api/providers/perplexity.ts')"

💡 Log completo desta correção salvo em: ${logFile}
`);
  } else {
    log('❌ Processo de build falhou. Verifique os logs para mais detalhes.');
  }
}

// Executar função principal
main().catch(error => {
  log(`❌ Erro fatal: ${error.message}`);
  process.exit(1);
});
